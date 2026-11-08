const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("./app");
const auth = require("./auth");
const { normalisePhone, validatePerson } = require("./validate");
const { main: createOwner } = require("../prisma/create-owner");

const SECRET = "test-secret";

// ─────────────────────────────────────────────
// In-memory stand-in for the parts of PrismaClient the routes use
// ─────────────────────────────────────────────
function pick(row, select) {
  if (!row || !select) return row;
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
}

function memoryDb() {
  const db = {
    persons: [
      { id: 1, salutation: "Sh", firstName: "Deviram", middleName: null, surname: "Gupta", displayName: "Sh. Deviram Gupta", gender: "Male", generationNumber: 1 },
      { id: 2, salutation: "Sh", firstName: "Johari", middleName: null, surname: "Gupta", displayName: "Sh. Johari Gupta", gender: "Male", generationNumber: 2 },
    ],
    links: [{ parentId: 1, childId: 2 }],
    admins: [],
    comments: [],
  };
  const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "gte" in v ? row[k] >= v.gte : row[k] === v));

  const prisma = {
    db,
    person: {
      findUnique: async ({ where, select }) => pick(db.persons.find((p) => p.id === where.id) ?? null, select),
      findMany: async () => db.persons,
      update: async ({ where, data, select }) => {
        const row = db.persons.find((p) => p.id === where.id);
        Object.assign(row, data);
        return pick(row, select);
      },
      create: async ({ data, select }) => {
        const { childOf, ...fields } = data;
        const row = { id: nextId(db.persons), ...fields };
        db.persons.push(row);
        if (childOf) db.links.push({ parentId: childOf.create.parent.connect.id, childId: row.id });
        return pick(row, select);
      },
    },
    parentChild: { findMany: async () => db.links },
    admin: {
      findUnique: async ({ where, select }) =>
        pick(db.admins.find((a) => (where.id !== undefined ? a.id === where.id : a.username === where.username)) ?? null, select),
      findFirst: async ({ where }) => db.admins.find((a) => matches(a, where)) ?? null,
      findMany: async ({ select }) => db.admins.map((a) => pick(a, select)),
      create: async ({ data, select }) => {
        if (db.admins.some((a) => a.username === data.username)) throw Object.assign(new Error("unique"), { code: "P2002" });
        const row = { id: nextId(db.admins), createdAt: new Date(), role: "admin", ...data };
        db.admins.push(row);
        return pick(row, select);
      },
      update: async ({ where, data }) => Object.assign(db.admins.find((a) => a.id === where.id), data),
      delete: async ({ where }) => {
        db.admins = db.admins.filter((a) => a.id !== where.id);
      },
    },
    comment: {
      count: async ({ where }) => db.comments.filter((c) => matches(c, where)).length,
      create: async ({ data }) => {
        const row = { id: nextId(db.comments), status: "new", createdAt: new Date(), ...data };
        db.comments.push(row);
        return row;
      },
      findMany: async ({ where }) => db.comments.filter((c) => matches(c, where)),
      findUnique: async ({ where, select }) => pick(db.comments.find((c) => c.id === where.id) ?? null, select),
      update: async ({ where, data, select }) => pick(Object.assign(db.comments.find((c) => c.id === where.id), data), select),
    },
  };
  return prisma;
}

let prisma, server, base, human;

async function start(options = {}) {
  prisma = memoryDb();
  human = true;
  const app = createApp({ prisma, sessionSecret: SECRET, verifyHuman: async () => human, ...options });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${server.address().port}`;
}

beforeEach(() => start());
afterEach(() => server.close());

const send = (method, path, body, cookie) =>
  fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

async function addAdmin(username, password, role = "admin") {
  prisma.db.admins.push({ id: prisma.db.admins.length + 1, username, role, createdAt: new Date(), passwordHash: await auth.hashPassword(password) });
}

async function signIn(username, password) {
  const res = await send("POST", "/api/admin/login", { username, password });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie").split(";")[0];
}

// ─────────────────────────────────────────────
// Units
// ─────────────────────────────────────────────
test("normalisePhone accepts Indian and international numbers", () => {
  assert.equal(normalisePhone("98765 43210"), "+919876543210");
  assert.equal(normalisePhone("098765-43210"), "+919876543210");
  assert.equal(normalisePhone("+91 98765 43210"), "+919876543210");
  assert.equal(normalisePhone("919876543210"), "+919876543210");
  assert.equal(normalisePhone("+44 7700 900123"), "+447700900123");
  for (const bad of ["12345", "5876543210", "+91 12345 67890", "abc", "", null, "+1234"]) {
    assert.equal(normalisePhone(bad), null, `rejects ${bad}`);
  }
});

test("validatePerson builds a display name and requires the basics", () => {
  assert.equal(validatePerson({ salutation: "Smt", firstName: "Kamla", surname: "Gupta", gender: "Female" }).value.displayName, "Smt Kamla Gupta");
  assert.equal(validatePerson({ firstName: "A", surname: "B", gender: "Male", displayName: "Sh. A B" }).value.displayName, "Sh. A B");
  assert.ok(validatePerson({ firstName: "", surname: "Gupta", gender: "Male" }).error);
  assert.ok(validatePerson({ firstName: "A", surname: "Gupta", gender: "Other" }).error);
});

test("sessions reject tampered and expired tokens", () => {
  const token = auth.signSession(7, SECRET);
  assert.equal(auth.verifySession(token, SECRET), 7);
  assert.equal(auth.verifySession(token, "other-secret"), null);
  assert.equal(auth.verifySession(token.replace(/^./, "x"), SECRET), null);
  const old = auth.signSession(7, SECRET, Date.now() - 8 * 86_400_000);
  assert.equal(auth.verifySession(old, SECRET), null);
});

test("passwords hash and verify", async () => {
  const hash = await auth.hashPassword("correct horse battery");
  assert.ok(await auth.verifyPassword("correct horse battery", hash));
  assert.ok(!(await auth.verifyPassword("wrong", hash)));
});

// ─────────────────────────────────────────────
// Sign-in
// ─────────────────────────────────────────────
test("login sets a session cookie; wrong details get one message", async () => {
  await addAdmin("ravi", "a-long-password");
  const cookie = await signIn("ravi", "a-long-password");
  assert.match(cookie, /^vanshavali_admin=/);
  const me = await send("GET", "/api/admin/me", undefined, cookie);
  assert.deepEqual(await me.json(), { username: "ravi", role: "admin" });

  const wrongPassword = await send("POST", "/api/admin/login", { username: "ravi", password: "nope" });
  const unknownUser = await send("POST", "/api/admin/login", { username: "nobody", password: "nope" });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(await wrongPassword.json(), await unknownUser.json());
});

test("the session cookie is HttpOnly and SameSite=Strict", async () => {
  await addAdmin("ravi", "a-long-password");
  const res = await send("POST", "/api/admin/login", { username: "ravi", password: "a-long-password" });
  const header = res.headers.get("set-cookie");
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Path=\/api/);
});

test("me is 401 when signed out", async () => {
  assert.equal((await send("GET", "/api/admin/me")).status, 401);
});

test("login is rate limited", async () => {
  server.close();
  await start({ limits: { login: { limit: 2 } } });
  await send("POST", "/api/admin/login", { username: "x", password: "y" });
  await send("POST", "/api/admin/login", { username: "x", password: "y" });
  assert.equal((await send("POST", "/api/admin/login", { username: "x", password: "y" })).status, 429);
});

test("changing data needs JSON", async () => {
  const res = await fetch(`${base}/api/admin/login`, { method: "POST", body: "username=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(res.status, 415);
});

// ─────────────────────────────────────────────
// Roles
// ─────────────────────────────────────────────
test("only the owner manages admins, and never creates another owner", async () => {
  await addAdmin("owner", "owner-password", "owner");
  await addAdmin("ravi", "a-long-password");
  const ravi = await signIn("ravi", "a-long-password");
  assert.equal((await send("GET", "/api/admin/admins", undefined, ravi)).status, 403);
  assert.equal((await send("POST", "/api/admin/admins", { username: "new", password: "0123456789" }, ravi)).status, 403);
  assert.equal((await send("DELETE", "/api/admin/admins/1", undefined, ravi)).status, 403);

  const owner = await signIn("owner", "owner-password");
  const created = await send("POST", "/api/admin/admins", { username: "Meena", password: "0123456789", role: "owner" }, owner);
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.username, "meena");
  assert.equal(body.role, "admin");
  assert.equal(body.passwordHash, undefined);

  const list = await (await send("GET", "/api/admin/admins", undefined, owner)).json();
  assert.deepEqual(list.map((a) => a.username), ["owner", "ravi", "meena"]);
  assert.ok(list.every((a) => a.passwordHash === undefined));

  assert.equal((await send("POST", "/api/admin/admins", { username: "meena", password: "0123456789" }, owner)).status, 409);
  assert.equal((await send("POST", "/api/admin/admins", { username: "x y", password: "0123456789" }, owner)).status, 400);
  assert.equal((await send("POST", "/api/admin/admins", { username: "short", password: "123" }, owner)).status, 400);
});

test("the owner can't be removed; a removed admin is signed out at once", async () => {
  await addAdmin("owner", "owner-password", "owner");
  await addAdmin("ravi", "a-long-password");
  const owner = await signIn("owner", "owner-password");
  const ravi = await signIn("ravi", "a-long-password");

  assert.equal((await send("DELETE", "/api/admin/admins/1", undefined, owner)).status, 400);
  assert.equal((await send("DELETE", "/api/admin/admins/2", undefined, owner)).status, 200);
  assert.equal((await send("GET", "/api/admin/me", undefined, ravi)).status, 401);
});

test("admins change their own password with the current one", async () => {
  await addAdmin("ravi", "a-long-password");
  const ravi = await signIn("ravi", "a-long-password");
  assert.equal((await send("POST", "/api/admin/me/password", { currentPassword: "wrong", newPassword: "another-long-one" }, ravi)).status, 400);
  assert.equal((await send("POST", "/api/admin/me/password", { currentPassword: "a-long-password", newPassword: "another-long-one" }, ravi)).status, 200);
  await signIn("ravi", "another-long-one");
});

// ─────────────────────────────────────────────
// Editing the tree
// ─────────────────────────────────────────────
test("editing and adding children need an admin", async () => {
  const person = { firstName: "Kamla", surname: "Gupta", gender: "Female" };
  assert.equal((await send("PATCH", "/api/admin/persons/2", person)).status, 401);
  assert.equal((await send("POST", "/api/admin/persons/2/children", person)).status, 401);
});

test("an admin edits a person", async () => {
  await addAdmin("ravi", "a-long-password");
  const ravi = await signIn("ravi", "a-long-password");
  const res = await send("PATCH", "/api/admin/persons/2", { salutation: "Sh", firstName: "Johari", middleName: "Lal", surname: "Gupta", gender: "Male" }, ravi);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.displayName, "Sh Johari Lal Gupta");
  assert.equal(body.generationNumber, 2);
  assert.equal((await send("PATCH", "/api/admin/persons/99", { firstName: "A", surname: "B", gender: "Male" }, ravi)).status, 404);
});

test("a new child is one generation below the parent and linked to them", async () => {
  await addAdmin("ravi", "a-long-password");
  const ravi = await signIn("ravi", "a-long-password");
  const res = await send("POST", "/api/admin/persons/2/children", { salutation: "Smt", firstName: "Kamla", surname: "Gupta", gender: "Female" }, ravi);
  assert.equal(res.status, 201);
  const child = await res.json();
  assert.equal(child.generationNumber, 3);
  assert.deepEqual(prisma.db.links.at(-1), { parentId: 2, childId: child.id });

  const tree = await (await send("GET", "/api/tree")).json();
  assert.ok(tree.persons.some((p) => p.id === child.id));
  assert.equal((await send("POST", "/api/admin/persons/99/children", { firstName: "A", surname: "B", gender: "Male" }, ravi)).status, 404);
});

// ─────────────────────────────────────────────
// Visitor comments
// ─────────────────────────────────────────────
const comment = { name: "Asha Mehta", phone: "98765 43210", link: "ancestor", linkedPersonId: 1, relation: "His great-granddaughter", message: "Johari also had a daughter, Kamla." };

test("a visitor leaves a comment; phone is normalised", async () => {
  const res = await send("POST", "/api/persons/2/comments", comment);
  assert.equal(res.status, 201);
  assert.equal((await res.json()).phone, "+919876543210");
  assert.equal(prisma.db.comments[0].phone, "+919876543210");
  assert.equal(prisma.db.comments[0].personId, 2);
  assert.equal(prisma.db.comments[0].linkedPersonId, 1);
});

test("comments need a name, a valid phone and the tree connection", async () => {
  for (const bad of [
    { ...comment, name: "" },
    { ...comment, phone: "" },
    { ...comment, phone: "12345" },
    { ...comment, link: undefined },
    { ...comment, link: "self", linkedPersonId: undefined },
    { ...comment, relation: "" },
    { ...comment, message: "hi" },
  ]) {
    assert.equal((await send("POST", "/api/persons/2/comments", bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await send("POST", "/api/persons/2/comments", { ...comment, linkedPersonId: 99 })).status, 400);
  assert.equal((await send("POST", "/api/persons/99/comments", comment)).status, 404);
});

test("'none' clears the linked person and relation", async () => {
  await send("POST", "/api/persons/2/comments", { ...comment, link: "none" });
  assert.equal(prisma.db.comments[0].linkedPersonId, null);
  assert.equal(prisma.db.comments[0].relation, null);
});

test("comments fail the human check", async () => {
  human = false;
  assert.equal((await send("POST", "/api/persons/2/comments", comment)).status, 400);
  assert.equal(prisma.db.comments.length, 0);
});

test("comments are limited per connection and per phone", async () => {
  server.close();
  await start({ limits: { comment: { limit: 2 }, phonePerDay: 10 } });
  await send("POST", "/api/persons/2/comments", comment);
  await send("POST", "/api/persons/2/comments", comment);
  assert.equal((await send("POST", "/api/persons/2/comments", comment)).status, 429);

  server.close();
  await start({ limits: { phonePerDay: 1 } });
  await send("POST", "/api/persons/2/comments", comment);
  assert.equal((await send("POST", "/api/persons/2/comments", { ...comment, phone: "+91 98765 43210" })).status, 429);
  assert.equal((await send("POST", "/api/persons/2/comments", { ...comment, phone: "91234 56789" })).status, 201);
});

test("admins review comments; visitors can't read them", async () => {
  await send("POST", "/api/persons/2/comments", comment);
  assert.equal((await send("GET", "/api/admin/comments")).status, 401);

  await addAdmin("ravi", "a-long-password");
  const ravi = await signIn("ravi", "a-long-password");
  const list = await (await send("GET", "/api/admin/comments", undefined, ravi)).json();
  assert.equal(list.length, 1);

  const res = await send("PATCH", `/api/admin/comments/${list[0].id}`, { status: "resolved", adminNote: "Added Kamla" }, ravi);
  assert.equal(res.status, 200);
  const stored = prisma.db.comments[0];
  assert.equal(stored.status, "resolved");
  assert.equal(stored.adminNote, "Added Kamla");
  assert.equal(stored.resolvedById, 1);
  assert.ok(stored.resolvedAt instanceof Date);
  assert.equal((await send("PATCH", `/api/admin/comments/${list[0].id}`, { status: "maybe" }, ravi)).status, 400);
});

// ─────────────────────────────────────────────
// Owner setup script
// ─────────────────────────────────────────────
test("the owner script refuses when an owner exists", async () => {
  await addAdmin("owner", "owner-password", "owner");
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(await createOwner(prisma), 1);
  } finally {
    console.log = log;
  }
  assert.equal(prisma.db.admins.length, 1);
});
