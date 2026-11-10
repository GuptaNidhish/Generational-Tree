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
