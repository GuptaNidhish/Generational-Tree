// Cloudflare Turnstile: a free check that a comment comes from a person, not a bot.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warned = false;

// Returns a function (token, ip) → Promise<boolean>
function createTurnstileVerifier(secret) {
  if (!secret) {
    return async () => {
      if (!warned) {
        console.warn("TURNSTILE_SECRET_KEY is not set: skipping the human check on comments (fine for local development only).");
        warned = true;
      }
      return true;
    };
  }
  return async (token, ip) => {
    if (typeof token !== "string" || !token) return false;
    try {
      const body = new URLSearchParams({ secret, response: token });
      if (ip) body.set("remoteip", ip);
      const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
      const result = await res.json();
      return result.success === true;
    } catch (err) {
      console.error("Turnstile check failed:", err.message);
      return false;
    }
  };
}

module.exports = { createTurnstileVerifier };
