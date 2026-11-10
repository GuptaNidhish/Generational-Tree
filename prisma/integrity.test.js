const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkIntegrity } = require("./integrity");
const { readCSV, parsePersons, parseLinks } = require("./seed-lib");

const p = (id, generationNumber) => ({ id, displayName: `Person ${id}`, generationNumber });
const kinds = (result) => result.problems.map((x) => x.kind).sort();

test("a well-formed family has no problems", () => {
  const result = checkIntegrity([p(1, 1), p(2, 2), p(3, 2), p(4, 3)], [
    { parentId: 1, childId: 2 },
    { parentId: 1, childId: 3 },
    { parentId: 2, childId: 4 },
  ]);
  assert.deepEqual(result.problems, []);
  assert.equal(result.errors, 0);
});

test("finds people who are their own parent", () => {
  const result = checkIntegrity([p(1, 1), p(2, 2)], [{ parentId: 1, childId: 2 }, { parentId: 2, childId: 2 }]);
  assert.ok(kinds(result).includes("self-link"));
  assert.ok(result.errors > 0);
});

test("finds cycles: someone who is their own ancestor", () => {
  const result = checkIntegrity([p(1, 1), p(2, 2), p(3, 3)], [
    { parentId: 1, childId: 2 },
    { parentId: 2, childId: 3 },
    { parentId: 3, childId: 1 },
  ]);
  const cycle = result.problems.find((x) => x.kind === "cycle");
  assert.ok(cycle);
  assert.deepEqual([...cycle.ids].sort(), [1, 2, 3]);
});

test("finds a child not exactly one generation below the parent", () => {
  const result = checkIntegrity([p(1, 1), p(2, 3)], [{ parentId: 1, childId: 2 }]);
  assert.deepEqual(kinds(result), ["generation"]);
});

test("finds links to people who don't exist", () => {
  const result = checkIntegrity([p(1, 1)], [{ parentId: 1, childId: 99 }]);
  assert.deepEqual(kinds(result), ["dangling-link"]);
});

test("warns about people with no parent below the first generation, and more than two parents", () => {
  const result = checkIntegrity([p(1, 1), p(2, 1), p(3, 1), p(4, 2), p(5, 3)], [
    { parentId: 1, childId: 4 },
    { parentId: 2, childId: 4 },
    { parentId: 3, childId: 4 },
  ]);
  assert.deepEqual(kinds(result), ["no-parent", "too-many-parents"]);
  assert.equal(result.errors, 0);
  assert.equal(result.warnings, 2);
});

test("the seed data in the repository is consistent", () => {
  const persons = parsePersons(readCSV("persons.csv"));
  const links = parseLinks(readCSV("parent_child.csv"));
  const result = checkIntegrity(persons, links);
  assert.deepEqual(result.problems.filter((x) => x.level === "error"), []);
});
