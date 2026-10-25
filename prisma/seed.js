const { PrismaClient } = require("@prisma/client");
const { readCSV, parsePersons, parseLinks } = require("./seed-lib");

const prisma = new PrismaClient();

const EXPECTED_PERSONS = 127;
const EXPECTED_LINKS = 126;

// Point a table's id sequence past its current max id
function resetSequence(table) {
  return prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
  );
}

// ─────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Step 1: Clear existing data (children of the FK first) ──
  console.log("🗑️  Clearing existing data...");
  await prisma.parentChild.deleteMany();
  await prisma.person.deleteMany();

  // ── Step 2: Seed Persons from CSV (explicit ids from the CSV) ──
  const persons = parsePersons(readCSV("persons.csv"));
  console.log(`👤 Inserting ${persons.length} persons...`);
  await prisma.person.createMany({ data: persons });
  await resetSequence("person");

  // ── Step 3: Seed ParentChild from CSV (ids auto-assigned) ──
  const rawLinks = readCSV("parent_child.csv");
  const links = parseLinks(rawLinks);
  console.log(
    `🔗 Inserting ${links.length} parent-child links (${rawLinks.length - links.length} leaf rows skipped)...`
  );
  await prisma.parentChild.createMany({ data: links });
  await resetSequence("parent_child");

  // ── Step 4: Verify ──
  const [personCount, linkCount] = await Promise.all([
    prisma.person.count(),
    prisma.parentChild.count(),
  ]);
  console.log(`\n   ✅ ${personCount} persons, ${linkCount} parent-child links in database.`);
  if (personCount !== EXPECTED_PERSONS || linkCount !== EXPECTED_LINKS) {
    throw new Error(
      `Expected ${EXPECTED_PERSONS} persons / ${EXPECTED_LINKS} links, got ${personCount} / ${linkCount}`
    );
  }
  console.log("\n🎉 Database seeding complete!");
}

// ─────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────
main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
