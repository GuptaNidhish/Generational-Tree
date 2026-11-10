// In-memory rate limiters. Right for one server process (a single free-tier
// instance); counts reset when the server restarts. Running several instances
// would need a shared store such as Redis.

// Sliding window: remembers each hit, for low limits where fairness matters
// (sign-in attempts, comments)
function createLimiter({ limit, windowMs, now = () => Date.now() }) {
  const hits = new Map();

  // Records a hit for `key` and says whether it is still within the limit
  function hit(key) {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    // keep memory bounded
    if (hits.size > 10_000) {
      for (const [k, times] of hits) if (!times.some((at) => t - at < windowMs)) hits.delete(k);
    }
    return true;
  }

  // Whole seconds until `key` may try again
  function retryAfter(key) {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
    if (recent.length < limit) return 0;
    return Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000));
  }

  return { hit, retryAfter, reset: () => hits.clear() };
}

// Fixed window: one counter per key, for high general limits where storing a
// timestamp per request would cost too much memory
function createWindowCounter({ limit, windowMs, now = () => Date.now(), maxKeys = 50_000 }) {
  const windows = new Map(); // key → { count, resetAt }

  function hit(key) {
    const t = now();
    let w = windows.get(key);
    if (!w || w.resetAt <= t) {
      if (!w && windows.size >= maxKeys) makeRoom(t);
      w = { count: 0, resetAt: t + windowMs };
      windows.set(key, w);
    }
    w.count += 1;
    return w.count <= limit;
  }

  // Drop expired windows; if every one is still live (a flood of distinct
  // addresses), drop the oldest half rather than grow without bound
  function makeRoom(t) {
    for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
    if (windows.size < maxKeys) return;
    let drop = Math.ceil(windows.size / 2);
    for (const k of windows.keys()) {
      if (drop-- <= 0) break;
      windows.delete(k);
    }
  }

  function retryAfter(key) {
    const w = windows.get(key);
    const t = now();
    return w && w.resetAt > t ? Math.max(1, Math.ceil((w.resetAt - t) / 1000)) : 0;
  }

  return { hit, retryAfter, size: () => windows.size, reset: () => windows.clear() };
}

module.exports = { createLimiter, createWindowCounter };
