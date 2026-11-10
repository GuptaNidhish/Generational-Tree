const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────
// USAGE: npm run db:backup
//
// Saves the app's tables (people, links, admins, comments) to
// backups/vanshavali-<date>.dump with pg_dump. READ-ONLY: it never changes
// the database. Needs the PostgreSQL client tools, at the server's major
// version or newer (macOS: brew install postgresql@17).
//
// Restore (this OVERWRITES the tables, so be sure):
//   pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" backups/<file>.dump
// ─────────────────────────────────────────────
try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DIRECT_URL (Supabase session pooler, port 5432) in .env first.");
  process.exit(1);
}

// Keep the password out of the process list: pass it in PGPASSWORD instead
const target = new URL(url);
const password = decodeURIComponent(target.password);
target.password = "";
target.searchParams.delete("pgbouncer");

const dir = path.join(__dirname, "..", "backups");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const file = path.join(dir, `vanshavali-${stamp}.dump`);

const args = ["--format=custom", "--schema=public", "--no-owner", "--no-privileges", `--file=${file}`, `--dbname=${target}`];
const dump = spawn("pg_dump", args, { stdio: "inherit", env: { ...process.env, PGPASSWORD: password } });

dump.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error("pg_dump isn't installed. Install the PostgreSQL client tools (macOS: brew install postgresql@17) and try again.");
  } else {
    console.error("pg_dump couldn't start:", err.message);
  }
  process.exit(1);
});

dump.on("exit", (code) => {
  if (code !== 0) {
    fs.rmSync(file, { force: true });
    console.error(`pg_dump failed (exit ${code}). No backup was written.`);
    process.exit(code ?? 1);
  }
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`✅ Backup saved: ${path.relative(process.cwd(), file)} (${kb} KB)`);
  console.log("   Keep a copy somewhere other than this computer (cloud drive, external disk).");
});
