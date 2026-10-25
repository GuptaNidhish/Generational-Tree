const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

// ─────────────────────────────────────────────
// Helper: Read and parse a CSV file from seed-data/
// ─────────────────────────────────────────────
function readCSV(filename) {
  const filePath = path.join(__dirname, "seed-data", filename);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  return parse(fileContent, {
    columns: true, // Use first row as headers
    skip_empty_lines: true,
    trim: true,
  });
}

// Empty strings and the literal "NULL" both mean "no value"
function clean(value) {
  const v = value?.trim();
  return v && v !== "NULL" ? v : null;
}

// ─────────────────────────────────────────────
// persons.csv → Person create inputs (CSV headers are case-sensitive)
// ─────────────────────────────────────────────
function parsePersons(rows) {
  return rows.map((row) => {
    const salutation = clean(row.Salutation);
    const firstName = clean(row.First_Name) || "";
    const middleName = clean(row.Middle_Name);
    const surname = clean(row.Last_Name) || "";
    const displayName =
      clean(row.Display_Name) ||
      [salutation, firstName, middleName, surname].filter(Boolean).join(" ");

    return {
      id: parseInt(row.Id, 10),
      salutation,
      firstName,
      middleName,
      surname,
      displayName,
      gender: clean(row.Gender) || "Unknown",
      generationNumber: parseInt(row.Generation_Number, 10),
    };
  });
}

// ─────────────────────────────────────────────
// parent_child.csv → ParentChild create inputs
// The CSV is recorded from Person_Id's perspective: Person_Id is the PARENT,
// child_id is their child (the parent_id column is actually the grandparent).
// Rows with no child_id are leaf individuals and are skipped.
// ─────────────────────────────────────────────
function parseLinks(rows) {
  return rows
    .filter((row) => clean(row.Person_Id) && clean(row.child_id))
    .map((row) => ({
      parentId: parseInt(row.Person_Id, 10),
      childId: parseInt(row.child_id, 10),
    }));
}

module.exports = { readCSV, parsePersons, parseLinks };
