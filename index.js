const crypto = require("crypto");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("./server/app");
const { createTurnstileVerifier } = require("./server/turnstile");
const { checkEnv } = require("./server/config");

const PORT = process.env.PORT || 4000;

// Production refuses to start without the settings it can't run safely without
const { production, errors, warnings } = checkEnv(process.env);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`Configuration error: ${error}`);
  process.exit(1);
}

const prisma = new PrismaClient();

// Admin sessions are signed with SESSION_SECRET. Development falls back to a
// random key (admins are signed out whenever the server restarts).
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET is not set: using a temporary key, so admins are signed out when the server restarts.");
}

const app = createApp({
  prisma,
  staticDir: path.join(__dirname, "client", "dist"),
  sessionSecret,
  verifyHuman: createTurnstileVerifier(process.env.TURNSTILE_SECRET_KEY),
  secureCookies: production,
  production,
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
