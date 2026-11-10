const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLimiter, createWindowCounter } = require("./rateLimit");

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test("the window counter allows `limit` hits per window, then says how long to wait", () => {
  const c = clock();
  const counter = createWindowCounter({ limit: 2, windowMs: 60_000, now: c.now });
  assert.equal(counter.hit("ip"), true);
  assert.equal(counter.hit("ip"), true);
  assert.equal(counter.hit("ip"), false);
  assert.equal(counter.hit("other-ip"), true);
  c.advance(15_000);
  assert.equal(counter.retryAfter("ip"), 45);
  c.advance(45_000);
  assert.equal(counter.hit("ip"), true);
});

test("the window counter keeps memory bounded", () => {
  const c = clock();
  const counter = createWindowCounter({ limit: 5, windowMs: 1_000, now: c.now, maxKeys: 100 });
  for (let i = 0; i < 100; i++) counter.hit(`old-${i}`);
  c.advance(2_000);
  for (let i = 0; i < 50; i++) counter.hit(`new-${i}`);
  assert.ok(counter.size() <= 100);
  // even when every key is live, it never grows past the cap
  for (let i = 0; i < 500; i++) counter.hit(`flood-${i}`);
  assert.ok(counter.size() <= 100);
});

test("the sliding limiter reports when its oldest hit expires", () => {
  const c = clock();
  const limiter = createLimiter({ limit: 2, windowMs: 60_000, now: c.now });
  limiter.hit("ip");
  c.advance(10_000);
  limiter.hit("ip");
  assert.equal(limiter.hit("ip"), false);
  assert.equal(limiter.retryAfter("ip"), 50);
});
