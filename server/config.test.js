const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkEnv, readCorsOrigins, readLimits } = require("./config");

const goodProduction = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@host:6543/postgres",
  SESSION_SECRET: "x".repeat(64),
  TURNSTILE_SECRET_KEY: "0x-secret",
  TRUST_PROXY: "1",
};

test("a complete production environment passes cleanly", () => {
  assert.deepEqual(checkEnv(goodProduction), { production: true, errors: [], warnings: [] });
});

test("production refuses to start without the essentials", () => {
  const { errors } = checkEnv({ NODE_ENV: "production" });
  assert.equal(errors.length, 3);
  assert.match(errors.join("\n"), /DATABASE_URL/);
  assert.match(errors.join("\n"), /SESSION_SECRET/);
  assert.match(errors.join("\n"), /TURNSTILE_SECRET_KEY/);
});

test("a short session secret is an error in production", () => {
  const { errors } = checkEnv({ ...goodProduction, SESSION_SECRET: "too-short" });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /at least 32 characters/);
});

test("the bot check can be switched off deliberately, with a warning", () => {
  const { errors, warnings } = checkEnv({ ...goodProduction, TURNSTILE_SECRET_KEY: "", TURNSTILE_DISABLED: "1" });
  assert.deepEqual(errors, []);
  assert.match(warnings.join("\n"), /TURNSTILE_DISABLED/);
});

test("a missing TRUST_PROXY is a production warning", () => {
  const { errors, warnings } = checkEnv({ ...goodProduction, TRUST_PROXY: undefined });
  assert.deepEqual(errors, []);
  assert.match(warnings.join("\n"), /TRUST_PROXY/);
});

test("development never fails on configuration", () => {
  const { production, errors } = checkEnv({});
  assert.equal(production, false);
  assert.deepEqual(errors, []);
});

test("CORS_ORIGINS is a comma-separated list, empty by default", () => {
  assert.deepEqual(readCorsOrigins({}), []);
  assert.deepEqual(readCorsOrigins({ CORS_ORIGINS: " https://a.example, https://b.example/ ,," }), ["https://a.example", "https://b.example"]);
});

test("rate limits can be set from the environment", () => {
  assert.deepEqual(readLimits({}), {});
  assert.deepEqual(readLimits({ RATE_LIMIT_API_PER_MIN: "600", RATE_LIMIT_LOGIN_PER_15MIN: "20", RATE_LIMIT_COMMENTS_PER_HOUR: "10" }), {
    api: { limit: 600 },
    login: { limit: 20 },
    comment: { limit: 10 },
  });
});

test("a rate limit that isn't a positive whole number is a configuration error", () => {
  const { errors } = checkEnv({ RATE_LIMIT_API_PER_MIN: "lots" });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /RATE_LIMIT_API_PER_MIN/);
  assert.deepEqual(checkEnv({ RATE_LIMIT_LOGIN_PER_15MIN: "0" }).errors.length, 1);
});
