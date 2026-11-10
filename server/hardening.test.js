// Production hardening: headers, CORS, input limits, errors, rate limits, health, caching
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("./app");

const person = { id: 1, salutation: "Sh", firstName: "Deviram", middleName: null, surname: "Gupta", displayName: "Sh. Deviram Gupta", gender: "Male", generationNumber: 1 };

function fakePrisma({ dbUp = true } = {}) {
  return {
    person: {
      findMany: async () => [person],
      findUnique: async ({ where }) => (where.id === 1 ? { ...person, childOf: [], parentOf: [] } : null),
    },
    parentChild: { findMany: async () => [] },
    admin: { findUnique: async () => null },
    $queryRaw: async () => {
      if (!dbUp) throw new Error("db down");
      return [{ "?column?": 1 }];
    },
  };
}

const servers = [];
after(() => servers.forEach((s) => s.close()));

async function serve(options = {}) {
  const { prisma = fakePrisma(), ...rest } = options;
  const server = createApp({ prisma, sessionSecret: "test-secret", ...rest }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  servers.push(server);
  const base = `http://localhost:${server.address().port}`;
  return (pathname, init) => fetch(base + pathname, init);
}

// ─────────────────────────────────────────────
// Security headers
// ─────────────────────────────────────────────
test("responses carry security headers and a CSP, without X-Powered-By", async () => {
  const get = await serve();
  const res = await get("/api/tree");
  assert.equal(res.headers.get("x-powered-by"), null);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(res.headers.get("permissions-policy"), /camera=\(\)/);
  assert.equal(res.headers.get("cross-origin-opener-policy"), "same-origin");
  const csp = res.headers.get("content-security-policy");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  assert.equal(res.headers.get("strict-transport-security"), null);
});

test("production adds HSTS and upgrade-insecure-requests", async () => {
  const get = await serve({ production: true });
  const res = await get("/api/health");
  assert.match(res.headers.get("strict-transport-security"), /max-age=15552000/);
  assert.match(res.headers.get("content-security-policy"), /upgrade-insecure-requests/);
});

// ─────────────────────────────────────────────
// CORS: same-origin by default, an explicit allowlist otherwise
// ─────────────────────────────────────────────
test("other sites get no CORS access by default", async () => {
  const get = await serve();
  const res = await get("/api/tree", { headers: { Origin: "https://evil.example" } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

test("origins in the allowlist get CORS access, others don't", async () => {
  const get = await serve({ corsOrigins: ["https://family.example"] });
  const allowed = await get("/api/tree", { headers: { Origin: "https://family.example" } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://family.example");
  const other = await get("/api/tree", { headers: { Origin: "https://evil.example" } });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

// ─────────────────────────────────────────────
// Input that used to cause 500s
// ─────────────────────────────────────────────
test("a repeated or overlong search is a 400, not a crash", async () => {
  const get = await serve();
  assert.equal((await get("/api/persons?search=ram&search=sita")).status, 400);
  assert.equal((await get(`/api/persons?search=${"a".repeat(101)}`)).status, 400);
  assert.equal((await get(`/api/persons?search=${"a".repeat(100)}`)).status, 200);
});

test("ids beyond the database's integer range are rejected, not sent to the database", async () => {
  const get = await serve();
  assert.equal((await get("/api/persons/2147483648")).status, 400);
  assert.equal((await get("/api/persons/99999999999999999999")).status, 400);
  assert.equal((await get("/api/persons?generation=2147483648")).status, 400);
  assert.equal((await get("/api/persons/2147483647")).status, 404);
});

// ─────────────────────────────────────────────
// General API rate limit
// ─────────────────────────────────────────────
test("the API is rate limited per visitor, with Retry-After; health checks are not", async () => {
  const get = await serve({ limits: { api: { limit: 3 } } });
  for (let i = 0; i < 3; i++) assert.equal((await get("/api/tree")).status, 200);
  const blocked = await get("/api/persons");
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.match((await blocked.json()).error, /Too many requests/);
  assert.equal((await get("/api/health")).status, 200);
});

// ─────────────────────────────────────────────
// Errors: the client's mistakes are 4xx, not logged as crashes
// ─────────────────────────────────────────────
async function capturingErrors(fn) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return logged;
}

test("malformed JSON is a 400 and isn't logged as a server error", async () => {
  const request = await serve();
  const logged = await capturingErrors(async () => {
    const res = await request("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Malformed JSON." });
  });
  assert.equal(logged.length, 0);
});

test("a body over 20 KB is a 413", async () => {
  const request = await serve();
  const res = await request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "x", password: "y".repeat(25_000) }),
  });
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { error: "Request too large." });
});

test("a server error is a generic 500, logged once on one line with where it happened", async () => {
  const broken = fakePrisma();
  broken.person.findMany = async () => {
    throw new Error("db down");
  };
  const get = await serve({ prisma: broken });
  const logged = await capturingErrors(async () => {
    const res = await get("/api/tree?secret=1");
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "Internal server error" });
  });
  assert.equal(logged.length, 1);
  const entry = JSON.parse(logged[0][0]);
  assert.equal(entry.level, "error");
  assert.equal(entry.method, "GET");
  assert.equal(entry.path, "/api/tree");
  assert.equal(entry.message, "db down");
  assert.match(entry.stack, /db down/);
});

// ─────────────────────────────────────────────
// Health, logging and caching of private responses
// ─────────────────────────────────────────────
test("readiness checks the database: 200 when it answers, 503 when it doesn't", async () => {
  const up = await serve();
  const ok = await up("/api/health/ready");
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, database: "up" });

  const down = await serve({ prisma: fakePrisma({ dbUp: false }) });
  const logged = await capturingErrors(async () => {
    const res = await down("/api/health/ready");
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, database: "down" });
  });
  assert.equal(logged.length, 1);
});

test("readiness is exempt from the rate limit", async () => {
  const get = await serve({ limits: { api: { limit: 1 } } });
  await get("/api/tree");
  assert.equal((await get("/api/tree")).status, 429);
  assert.equal((await get("/api/health/ready")).status, 200);
});

test("admin responses are never cached", async () => {
  const get = await serve();
  assert.equal((await get("/api/admin/me")).headers.get("cache-control"), "no-store");
  assert.equal((await get("/api/admin/comments")).headers.get("cache-control"), "no-store");
});

test("API requests are logged on one line without the query string; health checks aren't", async () => {
  const get = await serve({ logRequests: true });
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  try {
    await get("/api/persons?search=sita");
    await get("/api/health");
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.method, "GET");
  assert.equal(entry.path, "/api/persons");
  assert.equal(entry.status, 200);
  assert.equal(typeof entry.ms, "number");
  assert.doesNotMatch(lines[0], /sita/);
});
