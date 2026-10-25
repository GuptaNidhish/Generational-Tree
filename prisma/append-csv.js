const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// USAGE:
//   npm run db:append
//   (or: node prisma/append-csv.js)
//
// This script reads: prisma/seed-data/append_members.csv
// and appends new family members WITHOUT deleting any existing data.
// It auto-assigns IDs and automatically links them to father_id / mother_id.
// ─────────────────────────────────────────────

async function main() {
  const csvPath = path.join(__dirname, "seed-data", "append_members.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8").trim();
  if (!fileContent) {
    console.log("ℹ️  append_members.csv is empty. Nothing to append.");
    return;
  }

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    console.log("ℹ️  No data rows found in append_members.csv.");
    return;
  }

  console.log(`\n📥 Found ${records.length} member(s) to append...\n`);

  let addedCount = 0;

  for (const row of records) {
    if (!row.first_name || !row.surname || !row.gender || !row.generation_number) {
      console.warn(`⚠️ Skipping row with missing required fields:`, row);
      continue;
    }

    const displayName =
      row.display_name ||
      [row.salutation, row.first_name, row.middle_name, row.surname]
        .filter(Boolean)
        .join(" ")
        .trim();

    // 1. Create person (PostgreSQL auto-increments ID)
    const person = await prisma.person.create({
      data: {
        salutation:       row.salutation || null,
        firstName:        row.first_name,
        middleName:       row.middle_name || null,
        surname:          row.surname,
        displayName:      displayName,
        gender:           row.gender,
        generationNumber: parseInt(row.generation_number),
      },
    });

    console.log(`✅ Added: ${person.displayName} (Gen ${person.generationNumber}) -> ID: ${person.id}`);

    // 2. Link to father if father_id provided
    if (row.father_id && row.father_id.trim() !== "") {
      const fatherId = parseInt(row.father_id);
      const fatherExists = await prisma.person.findUnique({ where: { id: fatherId } });
      if (fatherExists) {
        await prisma.parentChild.create({
          data: { parentId: fatherId, childId: person.id },
        });
        console.log(`   🔗 Linked to Father (ID ${fatherId}: ${fatherExists.displayName})`);
      } else {
        console.warn(`   ⚠️ Warning: Father with ID ${fatherId} not found in database!`);
      }
    }

    // 3. Link to mother if mother_id provided
    if (row.mother_id && row.mother_id.trim() !== "") {
      const motherId = parseInt(row.mother_id);
      const motherExists = await prisma.person.findUnique({ where: { id: motherId } });
      if (motherExists) {
        await prisma.parentChild.create({
          data: { parentId: motherId, childId: person.id },
        });
        console.log(`   🔗 Linked to Mother (ID ${motherId}: ${motherExists.displayName})`);
      } else {
        console.warn(`   ⚠️ Warning: Mother with ID ${motherId} not found in database!`);
      }
    }

    addedCount++;
  }

  console.log(`\n🎉 Successfully appended ${addedCount} member(s)! Existing data remained untouched.`);
  console.log(`💡 You can view and verify the updated tree with: npm run db:studio\n`);
}

main()
  .catch((e) => {
    console.error("❌ Append failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
