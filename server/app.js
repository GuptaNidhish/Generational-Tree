const express = require("express");
const compression = require("compression");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const auth = require("./auth");
const { createLimiter, createWindowCounter } = require("./rateLimit");
const { securityHeaders } = require("./security");
const { log } = require("./log");
const { MAX_ID, validateComment, validatePerson, validateUsername } = require("./validate");

// Public person fields (timestamps are internal)
const PERSON_SELECT = {
  id: true,
  salutation: true,
  firstName: true,
  middleName: true,
  surname: true,
  displayName: true,
  gender: true,
  generationNumber: true,
};

const PERSON_ORDER = [{ generationNumber: "asc" }, { id: "asc" }];

// Parse a strictly-integer string that fits the database's INT4 columns;
// returns null for anything else (arrays from repeated query keys included)
function toInt(value) {
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) return null;
  const n = parseInt(value, 10);
  return n <= MAX_ID ? n : null;
}

const MAX_SEARCH_LENGTH = 100;

function badRequest(res, error) {
  return res.status(400).json({ error });
}

function tooMany(res, retryAfterSeconds, error) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  return res.status(429).json({ error });
}

const SUMMARY_SELECT = { id: true, displayName: true, generationNumber: true };
const COMMENT_STATUSES = ["new", "resolved", "dismissed"];
const PHONE_LIMIT_PER_DAY = 5;

// body-parser's error types → messages fit to show
const CLIENT_ERRORS = {
  "entity.parse.failed": "Malformed JSON.",
  "entity.too.large": "Request too large.",
  "encoding.unsupported": "Unsupported content encoding.",
  "charset.unsupported": "Unsupported character set.",
};

const READY_TIMEOUT_MS = 5_000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const isUniqueViolation = (err) => err?.code === "P2002";

// ─────────────────────────────────────────────
// createApp({ prisma, staticDir?, sessionSecret, verifyHuman?, secureCookies?, limits? })
//   prisma        — PrismaClient (or a test double with the same shape)
//   staticDir     — optional built client to serve with SPA fallback
//   sessionSecret — HMAC key for admin session cookies
//   verifyHuman   — (token, ip) → Promise<boolean>, e.g. Cloudflare Turnstile
//   secureCookies — mark cookies Secure (production, HTTPS)
//   limits        — override rate limits (tests)
//   production    — HSTS and upgrade-insecure-requests (HTTPS deployments)
//   logRequests   — one log line per API request (production)
//   corsOrigins   — other origins allowed to call the API from a browser; none by default,
//                   since the client is served from the same origin
// ─────────────────────────────────────────────
function createApp({ prisma, staticDir, sessionSecret, verifyHuman = async () => true, secureCookies = false, trustProxy, limits = {}, production = false, corsOrigins = [], logRequests = false }) {
  if (!sessionSecret) throw new Error("createApp needs a sessionSecret");
  const app = express();
  app.disable("x-powered-by");
  if (trustProxy) app.set("trust proxy", trustProxy);
  app.use(securityHeaders({ production }));
  // gzip text answers over 1 KB (the client bundle shrinks to about a third)
  app.use(compression());
  // Same-origin requests need no CORS headers; only listed origins get them
  app.use(cors({ origin: (origin, done) => done(null, corsOrigins.includes(origin)) }));
  app.use(express.json({ limit: "20kb" }));

  // One line per API request: method, path (no query string, which can hold
  // names), status and time taken. Health probes would only add noise.
  if (logRequests) {
    app.use("/api", (req, res, next) => {
      if (req.path.startsWith("/health")) return next();
      const started = process.hrtime.bigint();
      res.on("finish", () => {
        const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10;
        log("info", { method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms, ip: req.ip });
      });
      next();
    });
  }

  // Requests that change data must be JSON: a cross-site form can't send that,
  // which (with SameSite=Strict cookies) protects admins from forged requests
  app.use("/api", (req, res, next) => {
    if ((req.method === "POST" || req.method === "PATCH") && !req.is("application/json")) {
      return res.status(415).json({ error: "Send JSON (Content-Type: application/json)." });
    }
    next();
  });

  // Every API request per visitor (generous: a page view makes two or three)
  const apiLimiter = createWindowCounter({ limit: 300, windowMs: 60_000, ...limits.api });
  const loginLimiter = createLimiter({ limit: 10, windowMs: 15 * 60_000, ...limits.login });
  const commentLimiter = createLimiter({ limit: 5, windowMs: 60 * 60_000, ...limits.comment });
  const phoneLimit = limits.phonePerDay ?? PHONE_LIMIT_PER_DAY;
  const cookieOptions = { secure: secureCookies };

  const api = express.Router();

  // Health checks come before the rate limit, so the host's probes never hit it
  // Liveness: the process is up (no database call, so a paused database
  // doesn't make the host restart a healthy server)
  api.get("/health", (req, res) => res.json({ ok: true }));

  // Readiness: the database answers too
  api.get("/health/ready", async (req, res) => {
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, READY_TIMEOUT_MS);
      res.json({ ok: true, database: "up" });
    } catch (err) {
      log("error", { message: "Readiness check: database unreachable", detail: err?.message });
      res.status(503).json({ ok: false, database: "down" });
    }
  });

  api.use((req, res, next) => {
    if (apiLimiter.hit(req.ip)) return next();
    tooMany(res, apiLimiter.retryAfter(req.ip), "Too many requests. Please wait a minute and try again.");
  });

  // Whole lineage in one payload — the client lays it out
  api.get("/tree", async (req, res) => {
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ select: PERSON_SELECT, orderBy: PERSON_ORDER }),
      prisma.parentChild.findMany({
        select: { parentId: true, childId: true },
        orderBy: { id: "asc" },
      }),
    ]);
    res.json({ persons, relationships });
  });

  // ?search=<name fragment>&generation=<n>
  api.get("/persons", async (req, res) => {
    const where = {};
    if (req.query.search !== undefined && typeof req.query.search !== "string") return badRequest(res, "search must be a single value");
    const search = req.query.search?.trim();
    if (search && search.length > MAX_SEARCH_LENGTH) return badRequest(res, `search must be at most ${MAX_SEARCH_LENGTH} characters`);
    if (search) where.displayName = { contains: search, mode: "insensitive" };
    if (req.query.generation !== undefined) {
      const generation = toInt(req.query.generation);
      if (generation === null) return badRequest(res, "generation must be an integer");
      where.generationNumber = generation;
    }
    const persons = await prisma.person.findMany({
      where,
      select: PERSON_SELECT,
      orderBy: PERSON_ORDER,
    });
    res.json(persons);
  });

  api.get("/persons/:id", async (req, res) => {
    const id = toInt(req.params.id);
    if (id === null) return badRequest(res, "id must be an integer");

    const person = await prisma.person.findUnique({
      where: { id },
      select: {
        ...PERSON_SELECT,
        childOf: { select: { parent: { select: PERSON_SELECT } } },
        parentOf: { select: { child: { select: PERSON_SELECT } }, orderBy: { childId: "asc" } },
      },
    });
    if (!person) return res.status(404).json({ error: "Person not found" });

    const { childOf, parentOf, ...rest } = person;
    res.json({
      ...rest,
      parents: childOf.map((link) => link.parent),
      children: parentOf.map((link) => link.child),
    });
  });

  // Visitors tell the admins about someone we may have missed
  api.post("/persons/:id/comments", async (req, res) => {
    const personId = toInt(req.params.id);
    if (personId === null) return badRequest(res, "id must be an integer");
    const { value, error } = validateComment(req.body);
    if (error) return badRequest(res, error);

    const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
    if (!person) return res.status(404).json({ error: "Person not found" });
    if (value.linkedPersonId !== null) {
      const linked = await prisma.person.findUnique({ where: { id: value.linkedPersonId }, select: { id: true } });
      if (!linked) return badRequest(res, "The person you chose is not in the tree.");
    }

    if (!commentLimiter.hit(req.ip)) {
      return tooMany(res, commentLimiter.retryAfter(req.ip), "Too many messages from this connection. Please try again in an hour.");
    }
    const since = new Date(Date.now() - 86_400_000);
    const fromPhone = await prisma.comment.count({ where: { phone: value.phone, createdAt: { gte: since } } });
    if (fromPhone >= phoneLimit) {
      return tooMany(res, 86_400, "We've had several messages from this number today. Please try again tomorrow.");
    }
    if (!(await verifyHuman(req.body.turnstileToken, req.ip))) {
      return badRequest(res, "We couldn't confirm you're not a robot. Please complete the check and send again.");
    }

    await prisma.comment.create({ data: { ...value, personId } });
    res.status(201).json({ ok: true, phone: value.phone });
  });

  // ── Admin ───────────────────────────────────
  const admin = express.Router();

  // Admin answers hold private details (visitors' phone numbers): never cache them
  admin.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  admin.post("/login", async (req, res) => {
    if (!loginLimiter.hit(req.ip)) {
      return tooMany(res, loginLimiter.retryAfter(req.ip), "Too many sign-in attempts. Please wait 15 minutes and try again.");
    }
    const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const found = username ? await prisma.admin.findUnique({ where: { username } }) : null;
    const valid = found ? await auth.verifyPassword(password, found.passwordHash) : await auth.verifyAgainstNothing(password);
    if (!valid) return res.status(401).json({ error: "That username and password don't match." });
    res.setHeader("Set-Cookie", auth.sessionCookie(auth.signSession(found, sessionSecret), cookieOptions));
    res.json({ username: found.username, role: found.role });
  });

  admin.post("/logout", (req, res) => {
    res.setHeader("Set-Cookie", auth.clearedCookie(cookieOptions));
    res.json({ ok: true });
  });

  // Who is signed in: the admin, or null for visitors (200 either way, so
  // ordinary visitors don't see a failed request in their console)
  admin.get("/me", async (req, res) => {
    const me = await auth.sessionAdmin(req, { prisma, secret: sessionSecret });
    res.json(me ? { username: me.username, role: me.role } : null);
  });

  // Everything below needs a signed-in admin
  admin.use(auth.requireAdmin({ prisma, secret: sessionSecret }));

  admin.post("/me/password", async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const problem = auth.passwordProblem(newPassword);
    if (problem) return badRequest(res, problem);
    const me = await prisma.admin.findUnique({ where: { id: req.admin.id } });
    if (!(await auth.verifyPassword(String(currentPassword ?? ""), me.passwordHash))) {
      return badRequest(res, "Your current password isn't right.");
    }
    const passwordHash = await auth.hashPassword(newPassword);
    await prisma.admin.update({ where: { id: me.id }, data: { passwordHash } });
    // Sessions made with the old password stop working; keep this one signed in
    res.setHeader("Set-Cookie", auth.sessionCookie(auth.signSession({ id: me.id, passwordHash }, sessionSecret), cookieOptions));
    res.json({ ok: true });
  });

  // Admin accounts: the owner only
  admin.get("/admins", auth.requireOwner, async (req, res) => {
    res.json(await prisma.admin.findMany({ select: auth.ADMIN_SELECT, orderBy: { createdAt: "asc" } }));
  });

  admin.post("/admins", auth.requireOwner, async (req, res) => {
    const { value: username, error } = validateUsername(req.body?.username);
    if (error) return badRequest(res, error);
    const problem = auth.passwordProblem(req.body?.password);
    if (problem) return badRequest(res, problem);
    try {
      const created = await prisma.admin.create({
        // role is fixed: this route can never create another owner
        data: { username, passwordHash: await auth.hashPassword(req.body.password), role: "admin", createdById: req.admin.id },
        select: auth.ADMIN_SELECT,
      });
      res.status(201).json(created);
    } catch (err) {
      if (isUniqueViolation(err)) return res.status(409).json({ error: `The username "${username}" is taken.` });
      throw err;
    }
  });

  admin.delete("/admins/:id", auth.requireOwner, async (req, res) => {
    const id = toInt(req.params.id);
    if (id === null) return badRequest(res, "id must be an integer");
    const target = await prisma.admin.findUnique({ where: { id }, select: auth.ADMIN_SELECT });
    if (!target) return res.status(404).json({ error: "Admin not found" });
    if (target.role === "owner") return badRequest(res, "The owner account can't be removed.");
    await prisma.admin.delete({ where: { id } });
    res.json({ ok: true });
  });

  // Editing the tree
  admin.patch("/persons/:id", async (req, res) => {
    const id = toInt(req.params.id);
    if (id === null) return badRequest(res, "id must be an integer");
    const { value, error } = validatePerson(req.body);
    if (error) return badRequest(res, error);
    const exists = await prisma.person.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Person not found" });
    res.json(await prisma.person.update({ where: { id }, data: value, select: PERSON_SELECT }));
  });

  // A new child sits one generation below their parent; the person and the
  // parent link are written together in one nested create (a single transaction)
  admin.post("/persons/:id/children", async (req, res) => {
    const parentId = toInt(req.params.id);
    if (parentId === null) return badRequest(res, "id must be an integer");
    const { value, error } = validatePerson(req.body);
    if (error) return badRequest(res, error);
    const parent = await prisma.person.findUnique({ where: { id: parentId }, select: { id: true, generationNumber: true } });
    if (!parent) return res.status(404).json({ error: "Person not found" });
    const child = await prisma.person.create({
      data: {
        ...value,
        generationNumber: parent.generationNumber + 1,
        childOf: { create: { parent: { connect: { id: parentId } } } },
      },
      select: PERSON_SELECT,
    });
    res.status(201).json(child);
  });

  // Reviewing visitor comments
  admin.get("/comments", async (req, res) => {
    const status = req.query.status ?? "new";
    if (status !== "all" && !COMMENT_STATUSES.includes(status)) return badRequest(res, "Unknown status");
    const comments = await prisma.comment.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        person: { select: SUMMARY_SELECT },
        linkedPerson: { select: SUMMARY_SELECT },
        resolvedBy: { select: { username: true } },
      },
    });
    res.json(comments);
  });

  admin.patch("/comments/:id", async (req, res) => {
    const id = toInt(req.params.id);
    if (id === null) return badRequest(res, "id must be an integer");
    const { status, adminNote } = req.body ?? {};
    if (!COMMENT_STATUSES.includes(status)) return badRequest(res, "Status must be new, resolved or dismissed.");
    if (adminNote !== undefined && adminNote !== null && (typeof adminNote !== "string" || adminNote.length > 1000)) {
      return badRequest(res, "Keep the note under 1000 characters.");
    }
    const exists = await prisma.comment.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: "Comment not found" });
    const done = status !== "new";
    const updated = await prisma.comment.update({
      where: { id },
      data: {
        status,
        ...(adminNote !== undefined ? { adminNote: adminNote?.trim() || null } : {}),
        resolvedById: done ? req.admin.id : null,
        resolvedAt: done ? new Date() : null,
      },
      select: { id: true, status: true, adminNote: true, resolvedAt: true },
    });
    res.json(updated);
  });

  api.use("/admin", admin);

  api.use((req, res) => res.status(404).json({ error: "Not found" }));

  app.use("/api", api);

  // Production: serve the built React app, falling back to index.html for client routes
  // Files under assets/ have a content hash in their name, so they never
  // change: browsers keep them a year. Everything else (index.html above all)
  // is checked on each visit, so a new deploy is picked up at once.
  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    const assetsDir = path.join(staticDir, "assets") + path.sep;
    app.use(
      express.static(staticDir, {
        setHeaders: (res, filePath) => {
          res.setHeader("Cache-Control", filePath.startsWith(assetsDir) ? "public, max-age=31536000, immutable" : "no-cache");
        },
      })
    );
    app.get("/{*splat}", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // Express 5 forwards rejected async handlers here. Mistakes in the request
  // (malformed JSON, a body over the limit) keep their 4xx status and aren't
  // logged; anything else is a generic 500, logged on one line
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status < 500) return res.status(status).json({ error: CLIENT_ERRORS[err.type] ?? "Bad request." });
    log("error", { method: req.method, path: req.originalUrl.split("?")[0], message: err?.message, stack: err?.stack });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
