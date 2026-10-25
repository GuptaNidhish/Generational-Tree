# Generational Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed the Gupta family lineage (127 people, 126 parent→child links, 7 generations) into Supabase via Prisma, expose it through an Express API, and render it as an interactive top-to-bottom React Flow tree.

**Architecture:** Prisma 6 talks to Supabase through the IPv4 poolers: the transaction pooler (6543, `pgbouncer=true`) handles runtime queries and the session pooler (5432) handles `db push`. An Express 5 app (`server/app.js`, built by a `createApp({ prisma })` factory so tests can inject a fake client) serves `/api/*`, plus `client/dist` in production. A Vite + React + TS client in `client/` fetches `/api/tree` once and does layout (dagre, TB), search, and generation filtering in the browser, since 127 nodes is small.

**Tech Stack:** Node 26, Express 5, Prisma 6.4 / `@prisma/client`, `csv-parse`, Supabase Postgres, Vite, React 19, TypeScript, `@xyflow/react`, `@dagrejs/dagre`, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest, `node:test`.

**Spec:** `context.md` (+ Supabase Prisma connection instructions supplied by the user)

## Global Constraints

- Do NOT modify `prisma/schema.prisma` (its `datasource` already matches Supabase's snippet: `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`).
- `DATABASE_URL="postgresql://postgres.yaerdbdcmbwyhigpooco:<PASSWORD>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"`
- `DIRECT_URL="postgresql://postgres.yaerdbdcmbwyhigpooco:<PASSWORD>@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"`
- Secrets live only in `.env` (gitignored). No password may appear in any committed file, `context.md` included.
- Parent-child edge = `parentId = Person_Id`, `childId = child_id`; drop rows whose `child_id` is `NULL`/empty.
- Expected counts after seeding: **127** persons, **126** links; per generation `1:1, 2:2, 3:5, 4:6, 5:19, 6:47, 7:47`.
- Tree shows bloodlines only: no spouse or marriage nodes or edges. Orientation is top→bottom, Gen 1 at the top.
- Commit and push to `origin main` (`https://github.com/GuptaNidhish/Generational-Tree.git`) at the end of each phase.
- Personal files (`IMG_5436.JPG`, `Untitled.numbers`) are not committed.

## Review Focus

1. **Re-running `npm run db:seed`** must be idempotent and leave exactly 127/126, not duplicates or a unique-constraint crash. *(Task 2 verification re-runs the seed.)*
2. **Nullable name parts** (`salutation`, `middleName` empty in the CSV) must become `null`, not `""`, and display text must not show `"null"` or double spaces. *(Task 2 test `parsePersons maps empty optional fields to null`.)*
3. **Database unreachable / Prisma throws.** The API returns `500 {"error": ...}` JSON, and the UI shows an error state with a retry button instead of a blank canvas. *(Task 3 test `GET /api/tree returns 500 JSON when prisma throws`; Task 5 error state.)*
4. **Search** is case-insensitive and matches partial names (`"ram"` finds "Bhagat Ram"). No matches gives an empty list, not a crash. *(Task 4 tests for `searchPersons`.)*
5. **Root and leaf people in the details drawer.** Deviram has no parents and Gen 7 people have no children; the drawer shows "None recorded" rather than failing. *(Task 4 test `indexFamily handles root and leaves`.)*

---

## Phase 1: Supabase + Prisma + Seed

### Task 1: Supabase connection config, agent skills, schema push

**Files:**
- Modify: `.env` (pooler URLs, reusing the existing password)
- Modify: `.env.example` (concrete project ref and region, password placeholder)
- Modify: `context.md` §3 Connection (pooler URLs with `[YOUR-PASSWORD]`; plaintext password removed)
- Modify: `.gitignore` (add `IMG_*.JPG`, `*.numbers`)
- Modify: `package.json` (add `csv-parse` dependency)
- Create: whatever `npx skills add supabase/agent-skills` writes (commit it)

- [ ] **Step 1:** Rewrite `.env` with the two Global Constraints URLs, using the password already in `.env`.
- [ ] **Step 2:** `npm install csv-parse`. (`prisma` is already installed. `npx prisma init` is skipped because `prisma/schema.prisma` and `.env` already exist and `init` would refuse or overwrite.)
- [ ] **Step 3:** `npx skills add supabase/agent-skills` (non-interactive flags if offered).
- [ ] **Step 4:** Verify the connection: `npx prisma db push`. Expected: "Your database is now in sync with your Prisma schema" and the client generated.

### Task 2: Seed script with tested CSV mapping

**Files:**
- Create: `prisma/seed-lib.js`: pure CSV→record mapping
- Modify: `prisma/seed.js`: uses seed-lib, `createMany`, sequence reset, count verification
- Test: `prisma/seed-lib.test.js` (`node:test`)

**Interfaces:**
- Produces: `parsePersons(rows: object[]) -> PersonCreateInput[]` (includes `id`) and `parseLinks(rows: object[]) -> {parentId:number, childId:number}[]`, both from `prisma/seed-lib.js` (CommonJS).

- [ ] **Step 1: Write failing tests** in `prisma/seed-lib.test.js`:
  - `parsePersons maps CSV headers to schema fields`: row `{Id:"4",Salutation:"Sh",First_Name:"Bhagat",Middle_Name:"Ram",Last_Name:"Gupta",Display_Name:"Sh. Bhagat Ram Gupta",Gender:"Male",Generation_Number:"3"}` → `{id:4,salutation:"Sh",firstName:"Bhagat",middleName:"Ram",surname:"Gupta",displayName:"Sh. Bhagat Ram Gupta",gender:"Male",generationNumber:3}`
  - `parsePersons maps empty optional fields to null`: `Salutation:""`, `Middle_Name:""` → `salutation:null, middleName:null`. Empty `Display_Name` falls back to the non-empty parts joined by single spaces.
  - `parseLinks uses Person_Id as parent and drops NULL children`: rows `[{Person_Id:"1",child_id:"2"},{Person_Id:"2",child_id:"NULL"},{Person_Id:"3",child_id:""}]` → `[{parentId:1,childId:2}]`
  - `real CSVs yield 127 persons and 126 links`: reads `prisma/seed-data/*.csv` with the same `readCSV` options; asserts lengths and that every `childId` has exactly one parent.
- [ ] **Step 2:** `node --test prisma/` → FAIL (module not found).
- [ ] **Step 3:** Implement `prisma/seed-lib.js`, also exporting `readCSV(filename)` (moved out of `seed.js`).
- [ ] **Step 4:** `node --test prisma/` → PASS.
- [ ] **Step 5:** Rewrite `prisma/seed.js`: `deleteMany` links then persons, `person.createMany(parsePersons)`, `parentChild.createMany(parseLinks)`, then reset both sequences with `SELECT setval(pg_get_serial_sequence('<table>','id'), (SELECT MAX(id) FROM <table>))`. Then print counts and throw if they are not 127/126.
- [ ] **Step 6:** `npm run db:seed` twice. Both runs print 127 persons and 126 links.
- [ ] **Step 7:** Commit and push: `feat(db): configure supabase poolers and fix seed data import`.

## Phase 2: Express API

### Task 3: `/api/tree`, `/api/persons`, `/api/persons/:id`

**Files:**
- Create: `server/app.js`: `createApp({ prisma })`
- Create: `index.js`: real PrismaClient, `PORT` default `4000`, serves `client/dist` + SPA fallback if it exists
- Modify: `package.json` scripts: `"test": "node --test prisma/ server/"`, `"dev": "nodemon index.js"` (unchanged), `"client:dev"`, `"build"`
- Test: `server/app.test.js` (`node:test`, `app.listen(0)` + global `fetch`, fake prisma object)

**Interfaces:**
- Produces (HTTP, all JSON):
  - `GET /api/health` → `{ok:true}`
  - `GET /api/tree` → `{ persons: Person[], relationships: {parentId, childId}[] }`, where `Person = {id, salutation, firstName, middleName, surname, displayName, gender, generationNumber}` ordered by `generationNumber, id`
  - `GET /api/persons?search=&generation=` → `Person[]` (case-insensitive `contains` on `displayName`; `generation` integer)
  - `GET /api/persons/:id` → `Person & {parents: Person[], children: Person[]}`. 404 `{error:"Person not found"}`, 400 for a non-integer id.
  - Any thrown error → `500 {error:"Internal server error"}`

- [ ] **Step 1: Write failing tests:** `GET /api/tree returns persons and relationships`, `GET /api/persons filters by search and generation` (asserts the `where` passed to the fake `findMany`), `GET /api/persons/:id returns 404 for unknown id`, `GET /api/persons/abc returns 400`, `GET /api/tree returns 500 JSON when prisma throws`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `server/app.js` (cors, express.json, routes, error middleware) and `index.js`.
- [ ] **Step 4:** `npm test` → PASS. Then `npm start` and `curl localhost:4000/api/tree | jq '.persons|length, (.relationships|length)'` → `127`, `126`.
- [ ] **Step 5:** Commit and push: `feat(api): add express tree and person endpoints`.

## Phase 3: Frontend

### Task 4: Client scaffold + pure tree logic

**Files:**
- Create: `client/` via `npm create vite@latest client -- --template react-ts`, plus `@xyflow/react @dagrejs/dagre tailwindcss @tailwindcss/vite vitest`
- Modify: `client/vite.config.ts` (tailwind plugin, `server.proxy['/api'] = 'http://localhost:4000'`)
- Create: `client/src/types.ts`: `Person`, `Relationship`, `TreeData` (matching the Task 3 shapes)
- Create: `client/src/lib/family.ts`: `indexFamily(data: TreeData) -> FamilyIndex {byId: Map<number,Person>, parentsOf: Map<number,Person[]>, childrenOf: Map<number,Person[]>}`, `searchPersons(persons: Person[], query: string, limit = 8) -> Person[]`
- Create: `client/src/lib/layout.ts`: `layoutTree(data: TreeData) -> {nodes: Node<PersonNodeData>[], edges: Edge[]}`. dagre `rankdir:'TB'`, `nodesep:24`, `ranksep:90`, node size `NODE_WIDTH=180 × NODE_HEIGHT=72`, edge type `smoothstep`, node type `'person'`.
- Create: `client/src/lib/palette.ts`: `generationColor(gen: number) -> {bg, border, text, accent}` for gens 1–7
- Test: `client/src/lib/family.test.ts`, `client/src/lib/layout.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `indexFamily handles root and leaves`: root has `parentsOf.get(1) ?? []` empty, a leaf has an empty children list, a mid node has both.
  - `searchPersons is case-insensitive and partial`: `"ram"` matches "Sh. Bhagat Ram Gupta". `"zzz"` → `[]`. `""` → `[]`.
  - `layoutTree places each generation strictly below its parent`: every edge has `target.position.y > source.position.y`. Node count equals person count, edge count equals relationship count.
- [ ] **Step 2:** `npm --prefix client test` → FAIL. **Step 3:** implement. **Step 4:** → PASS.

### Task 5: Tree UI

**Files:**
- Create: `client/src/api.ts`: `fetchTree(): Promise<TreeData>` (throws on non-2xx)
- Create: `client/src/components/PersonNode.tsx`: generation colors, ♂/♀ badge, salutation, display name, `Gen N` tag, highlighted/dimmed states
- Create: `client/src/components/TopBar.tsx`: title, stats (members, generations computed from data), search, generation filter
- Create: `client/src/components/SearchBox.tsx`: autocomplete via `searchPersons`, keyboard ↑/↓/Enter/Esc, `onSelect(person)`
- Create: `client/src/components/GenerationFilter.tsx`: toggle chips 1–7. Unselected generations dim to 25% opacity, and the view fits to the selected generations.
- Create: `client/src/components/DetailsDrawer.tsx`: slide-in right panel with name parts, gender, generation, parents and children (clickable, "None recorded" when empty)
- Create: `client/src/components/FamilyTree.tsx`: `ReactFlow` with `MiniMap`, `Controls`, `Background`. Uses `setCenter` on search select. `nodesDraggable={false}`, `onlyRenderVisibleElements`.
- Modify: `client/src/App.tsx`, `client/src/index.css`: loading, error + retry, and the main layout

- [ ] **Step 1:** Build the components (use the frontend-design skill for visual direction).
- [ ] **Step 2:** `npm --prefix client run build` passes type-check. `npm --prefix client test` passes.
- [ ] **Step 3:** Run API + `vite`, then drive in the browser: tree renders 127 nodes top→bottom, search "bhagat" centers on him, clicking a node opens the drawer, the Gen 7 filter dims the others, and stopping the API shows the error state.
- [ ] **Step 4:** Commit and push: `feat(client): interactive family tree with search, filter and details`.

## Phase 4: Polish

### Task 6: Production serving, responsiveness, docs

**Files:**
- Modify: `index.js` (static serving verified), `client/src/*` (fixes found during testing)
- Create: `README.md`: setup (`.env`, `db:push`, `db:seed`, `dev`, `client:dev`, `build`, `start`)

- [ ] **Step 1:** `npm run build && npm start` → `localhost:4000` serves the UI and API from one process.
- [ ] **Step 2:** Check at a 390px mobile and a 1440px desktop viewport (drawer becomes full-width on mobile, top bar wraps). Pan and zoom stay smooth.
- [ ] **Step 3:** All tests pass (`npm test`, `npm --prefix client test`).
- [ ] **Step 4:** Commit and push: `chore: production build, responsive polish and README`.
