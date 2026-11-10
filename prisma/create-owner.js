const readline = require("readline");
const { PrismaClient } = require("@prisma/client");
const { hashPassword, passwordProblem } = require("../server/auth");
const { validateUsername } = require("../server/validate");

// ─────────────────────────────────────────────
// USAGE:
//   npm run admin:owner                      create the owner account (once)
//   npm run admin:owner -- --reset-password  set a new password for the owner
//
// The owner is the only account that can create or remove other admins (from
// "Manage admins" on the site). This script never creates ordinary admins.
// ─────────────────────────────────────────────

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // print the prompt, then swallow the characters typed
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function askPassword() {
  for (;;) {
    const password = await ask("Password (at least 10 characters): ", { hidden: true });
    const problem = passwordProblem(password);
    if (problem) {
      console.log(`  ${problem}`);
      continue;
    }
    const again = await ask("Type it again: ", { hidden: true });
    if (again === password) return password;
    console.log("  Those didn't match. Let's try again.");
  }
}

async function main(prisma) {
  const reset = process.argv.includes("--reset-password");
  const owner = await prisma.admin.findFirst({ where: { role: "owner" } });

  if (reset) {
    if (!owner) {
      console.log("There is no owner yet. Run `npm run admin:owner` to create one.");
      return 1;
    }
    console.log(`Setting a new password for the owner, "${owner.username}".`);
    const password = await askPassword();
    await prisma.admin.update({ where: { id: owner.id }, data: { passwordHash: await hashPassword(password) } });
    console.log("Done. Sign in at /admin with your new password.");
    return 0;
  }

  if (owner) {
    console.log(`An owner already exists ("${owner.username}"). There can only be one.`);
    console.log("Add other admins from \"Manage admins\" on the site, or reset the owner's password with:");
    console.log("  npm run admin:owner -- --reset-password");
    return 1;
  }

  console.log("Create the owner account for Gupta Vanshavali.\n");
  let username;
  for (;;) {
    const { value, error } = validateUsername(await ask("Username: "));
    if (!error) {
      username = value;
      break;
    }
    console.log(`  ${error}`);
  }
  if (await prisma.admin.findUnique({ where: { username } })) {
    console.log(`The username "${username}" is already used by an admin. Choose another.`);
    return 1;
  }
  const password = await askPassword();
  await prisma.admin.create({ data: { username, passwordHash: await hashPassword(password), role: "owner" } });
  console.log(`\nOwner "${username}" created. Sign in at /admin, then add other admins from "Manage admins".`);
  return 0;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(prisma)
    .then((code) => (process.exitCode = code))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { main };
