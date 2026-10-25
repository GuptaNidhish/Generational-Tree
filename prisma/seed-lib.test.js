const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readCSV, parsePersons, parseLinks } = require("./seed-lib");

test("parsePersons maps CSV headers to schema fields", () => {
  const [person] = parsePersons([
    {
      Id: "4",
      Salutation: "Sh",
      First_Name: "Bhagat",
      Middle_Name: "Ram",
      Last_Name: "Gupta",
      Display_Name: "Sh. Bhagat Ram Gupta",
      Gender: "Male",
      Generation_Number: "3",
    },
  ]);
  assert.deepEqual(person, {
    id: 4,
    salutation: "Sh",
    firstName: "Bhagat",
    middleName: "Ram",
    surname: "Gupta",
    displayName: "Sh. Bhagat Ram Gupta",
    gender: "Male",
    generationNumber: 3,
  });
});

test("parsePersons maps empty optional fields to null", () => {
  const [person] = parsePersons([
    {
      Id: "9",
      Salutation: "",
      First_Name: "Asha",
      Middle_Name: "",
      Last_Name: "Gupta",
      Display_Name: "",
      Gender: "Female",
      Generation_Number: "5",
    },
  ]);
  assert.equal(person.salutation, null);
  assert.equal(person.middleName, null);
  assert.equal(person.displayName, "Asha Gupta");
});

test("parseLinks uses Person_Id as parent and drops NULL children", () => {
  const links = parseLinks([
    { Person_Id: "1", child_id: "2", parent_id: "NULL" },
    { Person_Id: "2", child_id: "NULL", parent_id: "1" },
    { Person_Id: "3", child_id: "", parent_id: "1" },
  ]);
  assert.deepEqual(links, [{ parentId: 1, childId: 2 }]);
});

test("real CSVs yield 127 persons and 126 links", () => {
  const persons = parsePersons(readCSV("persons.csv"));
  const links = parseLinks(readCSV("parent_child.csv"));
  assert.equal(persons.length, 127);
  assert.equal(links.length, 126);

  const ids = new Set(persons.map((p) => p.id));
  const parentCount = new Map();
  for (const { parentId, childId } of links) {
    assert.ok(ids.has(parentId), `unknown parent ${parentId}`);
    assert.ok(ids.has(childId), `unknown child ${childId}`);
    parentCount.set(childId, (parentCount.get(childId) || 0) + 1);
  }
  assert.ok([...parentCount.values()].every((n) => n === 1));
});
