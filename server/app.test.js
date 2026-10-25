const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("./app");

const deviram = { id: 1, salutation: "Sh", firstName: "Deviram", middleName: null, surname: "Gupta", displayName: "Sh. Deviram Gupta", gender: "Male", generationNumber: 1 };
const johari = { id: 2, salutation: "Sh", firstName: "Johari", middleName: null, surname: "Gupta", displayName: "Sh. Johari Gupta", gender: "Male", generationNumber: 2 };

// Minimal stand-in for PrismaClient; `calls` records the arguments each query received
function fakePrisma({ fail = false } = {}) {
  const calls = {};
  const record = (name, result) => async (args) => {
    calls[name] = args;
    if (fail) throw new Error("db down");
    return typeof result === "function" ? result(args) : result;
  };
  return {
    calls,
    person: {
      findMany: record("person.findMany", [deviram, johari]),
      findUnique: record("person.findUnique", ({ where }) =>
        where.id === 1 ? { ...deviram, childOf: [], parentOf: [{ child: johari }] } : null
      ),
    },
    parentChild: {
      findMany: record("parentChild.findMany", [{ parentId: 1, childId: 2 }]),
    },
  };
}

async function serve(prisma) {
  const server = createApp({ prisma }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://localhost:${server.address().port}`;
  return { server, get: (path) => fetch(base + path) };
}

let ok, broken, prisma;
before(async () => {
  prisma = fakePrisma();
  ok = await serve(prisma);
  broken = await serve(fakePrisma({ fail: true }));
});
after(() => {
  ok.server.close();
  broken.server.close();
});

test("GET /api/health returns ok", async () => {
  const res = await ok.get("/api/health");
  assert.deepEqual(await res.json(), { ok: true });
});

test("GET /api/tree returns persons and relationships", async () => {
  const res = await ok.get("/api/tree");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    persons: [deviram, johari],
    relationships: [{ parentId: 1, childId: 2 }],
  });
  assert.deepEqual(prisma.calls["person.findMany"].orderBy, [{ generationNumber: "asc" }, { id: "asc" }]);
});

test("GET /api/persons filters by search and generation", async () => {
  const res = await ok.get("/api/persons?search=ram&generation=3");
  assert.equal(res.status, 200);
  assert.deepEqual(prisma.calls["person.findMany"].where, {
    displayName: { contains: "ram", mode: "insensitive" },
    generationNumber: 3,
  });
});

test("GET /api/persons rejects a non-integer generation", async () => {
  const res = await ok.get("/api/persons?generation=abc");
  assert.equal(res.status, 400);
});

test("GET /api/persons/:id returns parents and children", async () => {
  const res = await ok.get("/api/persons/1");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ...deviram, parents: [], children: [johari] });
});

test("GET /api/persons/:id returns 404 for unknown id", async () => {
  const res = await ok.get("/api/persons/999");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Person not found" });
});

test("GET /api/persons/abc returns 400", async () => {
  const res = await ok.get("/api/persons/abc");
  assert.equal(res.status, 400);
});

test("GET /api/tree returns 500 JSON when prisma throws", async () => {
  const res = await broken.get("/api/tree");
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "Internal server error" });
});

test("unknown /api route returns 404 JSON", async () => {
  const res = await ok.get("/api/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found" });
});
