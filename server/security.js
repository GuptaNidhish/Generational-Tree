// Security headers for every response (API and the built client).
// The client loads only its own bundle, self-hosted fonts and data: SVGs, plus
// Cloudflare Turnstile (a script and an iframe) on the comment form.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function contentSecurityPolicy({ production }) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${TURNSTILE_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "connect-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Only behind HTTPS: on plain-http localhost it would break every asset
  if (production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function securityHeaders({ production = false } = {}) {
  const csp = contentSecurityPolicy({ production });
  return (req, res, next) => {
    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Older browsers ignore frame-ancestors; this keeps the admin UI out of frames for them too
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    // 180 days. No includeSubDomains: other sites on the same parent domain aren't ours to decide for
    if (production) res.setHeader("Strict-Transport-Security", "max-age=15552000");
    next();
  };
}

module.exports = { securityHeaders, contentSecurityPolicy };
