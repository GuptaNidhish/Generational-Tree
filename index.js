const crypto = require("crypto");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("./server/app");
const { createTurnstileVerifier } = require("./server/turnstile");
const { checkEnv, readCorsOrigins, readLimits, readTrustProxy } = require("./server/config");
const { log } = require("./server/log");

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
  corsOrigins: readCorsOrigins(process.env),
  limits: readLimits(process.env),
  logRequests: production || process.env.LOG_REQUESTS === "1",
  trustProxy: readTrustProxy(process.env),
});

const server = app.listen(PORT, () => {
  console.log(`🌳 Generational Tree API listening on http://localhost:${PORT}`);
});

// Graceful shutdown (a redeploy sends SIGTERM): stop taking new connections,
// let requests in flight finish, close the database pool, then exit. If that
// takes longer than 10 s, exit anyway so the host isn't kept waiting.
const SHUTDOWN_GRACE_MS = 10_000;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", { message: `${signal}: shutting down` });
  setTimeout(() => {
    log("error", { message: `Shutdown took over ${SHUTDOWN_GRACE_MS / 1000} s; exiting anyway` });
    process.exit(1);
  }, SHUTDOWN_GRACE_MS).unref();
  try {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  } catch (err) {
    log("error", { message: "Error while shutting down", detail: err?.message });
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// A promise rejected outside a request: log it and carry on (Express already
// handles rejections inside route handlers)
process.on("unhandledRejection", (reason) => {
  log("error", { message: "Unhandled promise rejection", detail: reason instanceof Error ? reason.message : String(reason), stack: reason?.stack });
});

// After an uncaught exception the process state can't be trusted: log it and
// shut down, so the host restarts a clean process
process.on("uncaughtException", (err) => {
  log("error", { message: "Uncaught exception", detail: err?.message, stack: err?.stack });
  shutdown("uncaughtException", 1);
});
