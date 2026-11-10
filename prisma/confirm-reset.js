const readline = require("readline");

// ─────────────────────────────────────────────
// Runs before `npm run db:reset`, which DROPS EVERY TABLE (people, links,
// admins, comments) in the database .env points to, then re-seeds the
// original CSV. Edits made on the site since then are lost for good.
// Shows which database that is and asks you to type "reset".
// ─────────────────────────────────────────────
try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

function hostOf(url) {
  try {
    const { hostname, port } = new URL(url);
    return port ? `${hostname}:${port}` : hostname;
  } catch {
    return "(not set)";
  }
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset: NODE_ENV is production.");
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error("Refusing to reset without someone at the keyboard to confirm it.");
  process.exit(1);
}

console.log("\n⚠️  This will DELETE EVERYTHING in this database and reload the original CSV data:");
console.log(`     ${hostOf(process.env.DIRECT_URL || process.env.DATABASE_URL)}`);
console.log("   All edits, added children, admin accounts and visitor comments will be lost.");
console.log("   Take a backup first: npm run db:backup\n");

// Exit 0 (let the reset run) only on an explicit "reset". Anything else,
// including Ctrl-D or Ctrl-C before answering, cancels.
let confirmed = false;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("close", () => {
  if (confirmed) process.exit(0);
  console.log("\nCancelled. Nothing was changed.");
  process.exit(1);
});
rl.on("SIGINT", () => rl.close());
rl.question('Type "reset" to continue: ', (answer) => {
  confirmed = answer.trim() === "reset";
  rl.close();
});
