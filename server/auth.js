const crypto = require("crypto");

// ─────────────────────────────────────────────
// Passwords: scrypt with a random salt, stored as "scrypt$<salt>$<hash>" (hex)
// ─────────────────────────────────────────────
const KEY_LENGTH = 64;

function scrypt(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Checks run against a throwaway hash when the username is unknown, so a
// wrong username takes as long as a wrong password
let dummyHash;
async function verifyAgainstNothing(password) {
  dummyHash ??= await hashPassword(crypto.randomBytes(16).toString("hex"));
  await verifyPassword(password, dummyHash);
  return false;
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 10) return "Use a password of at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

// ─────────────────────────────────────────────
// Sessions: "<payload>.<signature>", payload = base64url JSON { adminId, exp }
// ─────────────────────────────────────────────
const COOKIE_NAME = "vanshavali_admin";
const SESSION_DAYS = 7;

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function signSession(adminId, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ adminId, exp: now + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

// Returns the admin id, or null for anything missing, tampered with or expired
function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const { adminId, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isInteger(adminId) && typeof exp === "number" && exp > now ? adminId : null;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionCookie(token, { secure }) {
  const parts = [`${COOKIE_NAME}=${token}`, "HttpOnly", "SameSite=Strict", "Path=/api", `Max-Age=${SESSION_DAYS * 86_400}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function clearedCookie({ secure }) {
  const parts = [`${COOKIE_NAME}=`, "HttpOnly", "SameSite=Strict", "Path=/api", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

const ADMIN_SELECT = { id: true, username: true, role: true, createdAt: true };

// Loads the signed-in admin fresh from the database on every request, so a
// removed admin loses access at once even if their cookie is still valid
function requireAdmin({ prisma, secret }) {
  return async (req, res, next) => {
    const adminId = verifySession(readCookie(req, COOKIE_NAME), secret);
    const admin = adminId === null ? null : await prisma.admin.findUnique({ where: { id: adminId }, select: ADMIN_SELECT });
    if (!admin) return res.status(401).json({ error: "Please sign in as an admin." });
    req.admin = admin;
    next();
  };
}

function requireOwner(req, res, next) {
  if (req.admin?.role !== "owner") return res.status(403).json({ error: "Only the owner can manage admin accounts." });
  next();
}

module.exports = {
  ADMIN_SELECT,
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  verifyAgainstNothing,
  passwordProblem,
  signSession,
  verifySession,
  readCookie,
  sessionCookie,
  clearedCookie,
  requireAdmin,
  requireOwner,
};
