// A small in-memory sliding-window limiter. Good enough for one server
// process; counts reset when the server restarts.
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

  return { hit, reset: () => hits.clear() };
}

module.exports = { createLimiter };
