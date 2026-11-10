// Family-tree consistency checks on plain data (no database access here).
//
// Errors break the tree's rules:
//   dangling-link  a link to a person who doesn't exist
//   self-link      someone listed as their own parent
//   cycle          someone who is their own ancestor
//   generation     a child not exactly one generation below a parent
// Warnings may be intended, but are worth a look:
//   no-parent         someone below the first generation with no parent
//   too-many-parents  someone with more than two parents
function checkIntegrity(persons, links) {
  const problems = [];
  const add = (level, kind, message, ids) => problems.push({ level, kind, message, ids });
  const byId = new Map(persons.map((p) => [p.id, p]));
  const name = (id) => (byId.has(id) ? `${byId.get(id).displayName} (#${id})` : `#${id}`);

  const childrenOf = new Map();
  const parentsOf = new Map();
  for (const { parentId, childId } of links) {
    if (!byId.has(parentId) || !byId.has(childId)) {
      add("error", "dangling-link", `Link ${name(parentId)} → ${name(childId)} points to someone not in the tree`, [parentId, childId]);
      continue;
    }
    if (parentId === childId) {
      add("error", "self-link", `${name(childId)} is listed as their own parent`, [childId]);
      continue;
    }
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId).push(childId);
    if (!parentsOf.has(childId)) parentsOf.set(childId, []);
    parentsOf.get(childId).push(parentId);

    const parentGen = byId.get(parentId).generationNumber;
    const childGen = byId.get(childId).generationNumber;
    if (childGen !== parentGen + 1) {
      add("error", "generation", `${name(childId)} is in generation ${childGen}, but their parent ${name(parentId)} is in generation ${parentGen}`, [parentId, childId]);
    }
  }

  // Cycles: depth-first search over parent → child, iterative so a deep tree can't overflow the stack
  const state = new Map(); // id → 1 (on the current path) | 2 (finished)
  for (const start of byId.keys()) {
    if (state.has(start)) continue;
    const path = [];
    const stack = [{ id: start, next: 0 }];
    state.set(start, 1);
    path.push(start);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const kids = childrenOf.get(top.id) ?? [];
      if (top.next < kids.length) {
        const kid = kids[top.next++];
        if (state.get(kid) === 1) {
          const ids = path.slice(path.indexOf(kid));
          add("error", "cycle", `${ids.map(name).join(" → ")} → ${name(kid)}: someone is their own ancestor`, ids);
        } else if (!state.has(kid)) {
          state.set(kid, 1);
          path.push(kid);
          stack.push({ id: kid, next: 0 });
        }
      } else {
        state.set(top.id, 2);
        path.pop();
        stack.pop();
      }
    }
  }

  const firstGeneration = Math.min(...persons.map((p) => p.generationNumber));
  for (const person of persons) {
    const parents = parentsOf.get(person.id) ?? [];
    if (parents.length === 0 && person.generationNumber > firstGeneration) {
      add("warn", "no-parent", `${name(person.id)} is in generation ${person.generationNumber} but has no parent`, [person.id]);
    }
    if (parents.length > 2) {
      add("warn", "too-many-parents", `${name(person.id)} has ${parents.length} parents: ${parents.map(name).join(", ")}`, [person.id, ...parents]);
    }
  }

  return {
    problems,
    errors: problems.filter((x) => x.level === "error").length,
    warnings: problems.filter((x) => x.level === "warn").length,
  };
}

module.exports = { checkIntegrity };
