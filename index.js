const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("./server/app");

const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

const app = createApp({
  prisma,
  staticDir: path.join(__dirname, "client", "dist"),
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
