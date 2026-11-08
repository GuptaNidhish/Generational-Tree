const crypto = require("crypto");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("./server/app");
const { createTurnstileVerifier } = require("./server/turnstile");

const PORT = process.env.PORT || 4000;
const production = process.env.NODE_ENV === "production";
const prisma = new PrismaClient();

// Admin sessions are signed with SESSION_SECRET. Production refuses to start
// without one; development falls back to a random key (admins are signed out
// whenever the server restarts).
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (production) {
    console.error("SESSION_SECRET is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
  }
  sessionSecret = crypto.randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET is not set: using a temporary key, so admins are signed out when the server restarts.");
}

const app = createApp({
  prisma,
  staticDir: path.join(__dirname, "client", "dist"),
  sessionSecret,
  verifyHuman: createTurnstileVerifier(process.env.TURNSTILE_SECRET_KEY),
  secureCookies: production,
  trustProxy: process.env.TRUST_PROXY,
});

const server = app.listen(PORT, () => {
  console.log(`🌳 Generational Tree API listening on http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
