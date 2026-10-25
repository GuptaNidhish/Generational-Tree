const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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

// Parse a strictly-integer string; returns null for anything else
function toInt(value) {
  return /^\d+$/.test(value ?? "") ? parseInt(value, 10) : null;
}

function badRequest(res, error) {
  return res.status(400).json({ error });
}

// ─────────────────────────────────────────────
// createApp({ prisma, staticDir? })
//   prisma    — PrismaClient (or a test double with the same shape)
//   staticDir — optional built client to serve with SPA fallback
// ─────────────────────────────────────────────
function createApp({ prisma, staticDir }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const api = express.Router();

  api.get("/health", (req, res) => res.json({ ok: true }));

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
    const search = req.query.search?.trim();
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

  api.use((req, res) => res.status(404).json({ error: "Not found" }));

  app.use("/api", api);

  // Production: serve the built React app, falling back to index.html for client routes
  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir));
    app.get("/{*splat}", (req, res) => res.sendFile(path.join(staticDir, "index.html")));
  }

  // Express 5 forwards rejected async handlers here
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
