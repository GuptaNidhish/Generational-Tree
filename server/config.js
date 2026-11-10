// Startup checks on environment variables. Production refuses to start when a
// setting it can't run safely without is missing; development only warns.
const MIN_SECRET_LENGTH = 32;
const GENERATE_SECRET = "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";

// Optional overrides for the rate limits (defaults live in server/app.js)
const LIMIT_VARS = {
  RATE_LIMIT_API_PER_MIN: "api",
  RATE_LIMIT_LOGIN_PER_15MIN: "login",
  RATE_LIMIT_COMMENTS_PER_HOUR: "comment",
};
const isPositiveWhole = (value) => /^[1-9]\d{0,6}$/.test(value);

function checkEnv(env) {
  const production = env.NODE_ENV === "production";
  const errors = [];
  const warnings = [];

  for (const name of Object.keys(LIMIT_VARS)) {
    if (env[name] !== undefined && env[name] !== "" && !isPositiveWhole(env[name])) {
      errors.push(`${name} must be a positive whole number (got "${env[name]}").`);
    }
  }
  if (!production) return { production, errors, warnings };

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set (Supabase transaction pooler URL, port 6543).");

  if (!env.SESSION_SECRET) {
    errors.push(`SESSION_SECRET is not set. Generate one with: ${GENERATE_SECRET}`);
  } else if (env.SESSION_SECRET.length < MIN_SECRET_LENGTH) {
    errors.push(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: ${GENERATE_SECRET}`);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.TURNSTILE_DISABLED === "1") {
      warnings.push("TURNSTILE_DISABLED=1: visitor comments are accepted without the bot check.");
    } else {
      errors.push(
        "TURNSTILE_SECRET_KEY is not set, so visitor comments would skip the bot check. " +
          "Set it (and VITE_TURNSTILE_SITE_KEY when building the client), or set TURNSTILE_DISABLED=1 to run without it on purpose."
      );
    }
  }

  if (readTrustProxy(env) === undefined) {
    warnings.push(
      "TRUST_PROXY is not set. Behind a hosting proxy (Render, Railway, Nginx…) every visitor then shares one IP " +
        "and one rate limit. Set TRUST_PROXY=1 unless the server faces the internet directly."
    );
  }

  return { production, errors, warnings };
}

// "https://a.example, https://b.example" → ["https://a.example", "https://b.example"]
function readCorsOrigins(env) {
  return (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// { api: { limit }, login: { limit }, comment: { limit } } for the variables that are set
function readLimits(env) {
  const limits = {};
  for (const [name, key] of Object.entries(LIMIT_VARS)) {
    if (isPositiveWhole(env[name] ?? "")) limits[key] = { limit: Number(env[name]) };
  }
  return limits;
}

// Express reads the string "1" as an IP address to trust, not as "one proxy",
// so TRUST_PROXY=1 used to have no effect: every visitor behind the host's
// proxy shared one IP and one rate limit. Numbers become hop counts.
function readTrustProxy(env) {
  const value = (env.TRUST_PROXY ?? "").trim();
  if (value === "" || value === "false") return undefined;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value; // e.g. "loopback" or a list of addresses/subnets
}

module.exports = { checkEnv, readCorsOrigins, readLimits, readTrustProxy, MIN_SECRET_LENGTH };
