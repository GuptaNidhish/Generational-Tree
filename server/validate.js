// Input checks for admin edits and visitor comments. Each returns
// { value } on success or { error } with a message fit to show the user.

// Ids are Postgres INT4; anything larger makes the query itself fail
const MAX_ID = 2_147_483_647;
const isId = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_ID;

const text = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

// Indian mobiles may be typed as 98765 43210, 098765-43210, +91 98765 43210 …
// Anything else must be in international form: + and 8–15 digits.
function normalisePhone(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  const digits = raw.replace(/[\s\-().]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) {
    if (digits.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(digits)) return null;
    return digits;
  }
  const local = digits.replace(/^(0091|91|0)(?=\d{10}$)/, "");
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  return null;
}

const GENDERS = ["Male", "Female"];

function validatePerson(body) {
  const salutation = text(body?.salutation);
  const firstName = text(body?.firstName);
  const middleName = text(body?.middleName);
  const surname = text(body?.surname);
  const gender = text(body?.gender);
  const typedDisplay = text(body?.displayName);

  if (!firstName) return { error: "First name is required." };
  if (!surname) return { error: "Surname is required." };
  if (!GENDERS.includes(gender)) return { error: "Gender must be Male or Female." };
  for (const [label, v] of [["Salutation", salutation], ["First name", firstName], ["Middle name", middleName], ["Surname", surname]]) {
    if (v.length > 60) return { error: `${label} is too long.` };
  }
  if (typedDisplay.length > 120) return { error: "Display name is too long." };

  // Same rule as the CSV import (prisma/seed-lib.js): built from the parts unless given
  const displayName = typedDisplay || [salutation, firstName, middleName, surname].filter(Boolean).join(" ");
  return {
    value: { salutation: salutation || null, firstName, middleName: middleName || null, surname, gender, displayName },
  };
}

const LINKS = ["self", "ancestor", "none"];

function validateComment(body) {
  const name = text(body?.name);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const link = body?.link;
  const relation = text(body?.relation);
  const linkedPersonId = body?.linkedPersonId;

  if (name.length < 2) return { error: "Please tell us your name." };
  if (name.length > 100) return { error: "That name is too long." };
  const phone = normalisePhone(body?.phone);
  if (!phone) return { error: "Please enter a valid mobile number, e.g. 98765 43210 or +44 7700 900123." };
  if (!LINKS.includes(link)) return { error: "Please say whether you or an ancestor are in the tree." };

  let linked = { linkedPersonId: null, relation: null };
  if (link !== "none") {
    if (!isId(linkedPersonId)) {
      return { error: link === "self" ? "Please choose which person in the tree is you." : "Please choose your ancestor in the tree." };
    }
    if (!relation) return { error: "Please say how you are related." };
    if (relation.length > 200) return { error: "Please keep the relation under 200 characters." };
    linked = { linkedPersonId, relation };
  }

  if (message.length < 5) return { error: "Please tell us a little more in your message." };
  if (message.length > 2000) return { error: "Please keep your message under 2000 characters." };

  return { value: { name, phone, link, ...linked, message } };
}

function validateUsername(input) {
  const username = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return { error: "Usernames are 3–40 characters: letters, numbers, dots, dashes or underscores." };
  }
  return { value: username };
}

module.exports = { MAX_ID, normalisePhone, validatePerson, validateComment, validateUsername };
