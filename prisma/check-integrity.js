const { PrismaClient } = require("@prisma/client");
const { checkIntegrity } = require("./integrity");

// ─────────────────────────────────────────────
// USAGE: npm run db:check
//
// Reads the whole tree and reports anything that breaks its rules: links to
// missing people, someone as their own parent or ancestor, a child not one
// generation below a parent, people with no parent or more than two.
// READ-ONLY: it never changes the database. Exits 1 if it finds errors.
// ─────────────────────────────────────────────
async function main() {
  const prisma = new PrismaClient();
  try {
    const [persons, links] = await Promise.all([
      prisma.person.findMany({ select: { id: true, displayName: true, generationNumber: true } }),
      prisma.parentChild.findMany({ select: { parentId: true, childId: true } }),
    ]);
    const { problems, errors, warnings } = checkIntegrity(persons, links);

    console.log(`Checked ${persons.length} people and ${links.length} parent → child links.`);
    for (const problem of problems) console.log(`  ${problem.level === "error" ? "✖ error" : "⚠ warning"} [${problem.kind}] ${problem.message}`);
    console.log(errors || warnings ? `${errors} error(s), ${warnings} warning(s).` : "✅ No problems found.");
    return errors ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("The check couldn't run:", err.message);
    process.exit(2);
  });
