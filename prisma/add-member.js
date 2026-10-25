const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// USAGE:
//   node prisma/add-member.js
//
// Edit the data below, then run the script.
// After adding, clear the data and use again
// for the next person.
// ─────────────────────────────────────────────

// ╔═══════════════════════════════════════════╗
// ║  FILL IN THE NEW PERSON'S DETAILS BELOW   ║
// ╚═══════════════════════════════════════════╝

const newPerson = {
  salutation:       "",              // e.g. "Shri", "Smt", "Late Shri" (or leave empty)
  firstName:        "",              // e.g. "Nidhish"
  middleName:       "",              // e.g. "Kumar" (or leave empty)
  surname:          "",              // e.g. "Gupta"
  displayName:      "",              // e.g. "Shri Nidhish Gupta"
  gender:           "",              // "Male" or "Female"
  generationNumber: 0,               // e.g. 6 (for 6th generation)
};

// Parent IDs — use one or both. Set to null if unknown.
// You can find parent IDs by running: npm run db:studio
const fatherId = null;  // e.g. 42
const motherId = null;  // e.g. 43

// ─────────────────────────────────────────────

async function main() {
  // Validate
  if (!newPerson.firstName || !newPerson.surname || !newPerson.gender || !newPerson.generationNumber) {
    console.error("❌ Please fill in at least: firstName, surname, gender, generationNumber");
    process.exit(1);
  }

  console.log(`\n👤 Adding: ${newPerson.displayName || newPerson.firstName + " " + newPerson.surname}`);

  // Create the person
  const person = await prisma.person.create({
    data: {
      salutation:       newPerson.salutation || null,
      firstName:        newPerson.firstName,
      middleName:       newPerson.middleName || null,
      surname:          newPerson.surname,
      displayName:
        newPerson.displayName ||
        [newPerson.salutation, newPerson.firstName, newPerson.middleName, newPerson.surname]
          .filter(Boolean)
          .join(" ")
          .trim(),
      gender:           newPerson.gender,
      generationNumber: newPerson.generationNumber,
    },
  });

  console.log(`   ✅ Created person with ID: ${person.id}`);

  // Link to father if provided
  if (fatherId) {
    await prisma.parentChild.create({
      data: { parentId: fatherId, childId: person.id },
    });
    console.log(`   🔗 Linked to father (ID: ${fatherId})`);
  }

  // Link to mother if provided
  if (motherId) {
    await prisma.parentChild.create({
      data: { parentId: motherId, childId: person.id },
    });
    console.log(`   🔗 Linked to mother (ID: ${motherId})`);
  }

  console.log(`\n🎉 Done! Person ID ${person.id} added to generation ${newPerson.generationNumber}`);
  console.log(`   Run "npm run db:studio" to verify.\n`);
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
