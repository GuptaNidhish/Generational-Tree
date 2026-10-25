# Project Context: Generational Family Tree Web App

## 1. Project Overview & Goal
Build a beautiful, interactive, dynamic web application visualizing a 7-generation Indian family lineage (Gupta family) comprising **127 individuals**.

- **Root Patriarch**: Sh. Deviram Gupta (Generation 1).
- **Lineage Depth**: 7 generations (Gen 1: 1 person, Gen 2: 2, Gen 3: 5, Gen 4: 6, Gen 5: 19, Gen 6: 47, Gen 7: 47).
- **Core Visualization Rules**:
  - **Orientation**: Top-to-bottom (Generation 1 at the top, cascading down to Generation 7).
  - **No Marriages**: Tree depicts **direct bloodlines only** (parent $\rightarrow$ child links). Do NOT create marriage/union nodes or spouse links.
  - **Interactivity**: Zoom, pan, search by name, filter by generation, click person card to open side details panel.

---

## 2. Tech Stack & Repository
- **Backend / Database Layer**: Node.js, Express (or TypeScript), Prisma ORM, PostgreSQL (Supabase).
- **Frontend**: React (Vite or Next.js with TypeScript), `@xyflow/react` (React Flow) paired with `elkjs` (or Dagre) for hierarchical top-to-bottom layout, Tailwind CSS.
- **Remote Git Repository**: `https://github.com/GuptaNidhish/Generational-Tree.git`
- **Git Strategy**: Make meaningful, clean commits at the end of each phase/sub-phase and push to GitHub.

---

## 3. Database & Schema Details

> [!IMPORTANT]
> **Database Schema Policy**: Do NOT modify the Prisma schema (`prisma/schema.prisma`) unless absolutely required.

### Connection
- Database: Supabase PostgreSQL (currently empty).
- Credentials stored in `.env` (ignored via `.gitignore`; template in `.env.example`). Uses Supabase's IPv4 shared poolers:
  ```env
  # Transaction-mode pooler (Prisma Client at runtime)
  DATABASE_URL="postgresql://postgres.yaerdbdcmbwyhigpooco:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
  # Session-mode pooler (Prisma CLI: db push / migrations)
  DIRECT_URL="postgresql://postgres.yaerdbdcmbwyhigpooco:[YOUR-PASSWORD]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres"
  ```

### Existing Prisma Schema (`prisma/schema.prisma`)
```prisma
model Person {
  id               Int      @id @default(autoincrement())
  salutation       String?  // e.g. "Sh", "Smt", "Dr"
  firstName        String   @map("first_name")
  middleName       String?  @map("middle_name")
  surname          String   @map("surname")
  displayName      String   @map("display_name")
  gender           String   // "Male" or "Female"
  generationNumber Int      @map("generation_number")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  parentOf         ParentChild[] @relation("ParentRelation")
  childOf          ParentChild[] @relation("ChildRelation")

  @@map("person")
}

model ParentChild {
  id       Int @id @default(autoincrement())
  parentId Int @map("parent_id")
  childId  Int @map("child_id")

  parent   Person @relation("ParentRelation", fields: [parentId], references: [id], onDelete: Cascade)
  child    Person @relation("ChildRelation", fields: [childId], references: [id], onDelete: Cascade)

  @@unique([parentId, childId])
  @@map("parent_child")
}
```

---

## 4. Critical Data Discoveries & Seed Script Fixes

### Data Files
1. `prisma/seed-data/persons.csv`
   - Headers: `Id,Salutation,First_Name,Middle_Name,Last_Name,Display_Name,Gender,Generation_Number`
   - 127 total records.
2. `prisma/seed-data/parent_child.csv`
   - Headers: `Id,parent_id,child_id,Person_Id,,`
   - 158 data rows.

### Critical CSV Quirks & Mappings:
1. **The `Person_Id` column in `parent_child.csv` is the actual PARENT**:
   - The CSV structure was recorded from the perspective of `Person_Id`.
   - `parent_id` column in CSV is actually the *grandparent* (parent of `Person_Id`).
   - `child_id` is the child of `Person_Id`.
   - **Correct Edge**: `parentId = parseInt(row.Person_Id)` and `childId = parseInt(row.child_id)`.
   - Rows where `child_id` is `"NULL"` or empty represent leaf individuals with no recorded children $\rightarrow$ **must be filtered out**.
   - Lines 2-3 represent Deviram's children: `Person_Id = 1`, `child_id = 2` (Johari) and `child_id = 3` (Malagar).
   - Total valid parent-child links: **126 relationships**.
2. **Field name & case mismatches in `prisma/seed.js`**:
   - `csv-parse` is case-sensitive!
   - `row.Id` (not `row.id`)
   - `row.Salutation` (not `row.salutation`)
   - `row.First_Name` (not `row.first_name`)
   - `row.Middle_Name` (not `row.middle_name`)
   - `row.Last_Name` (not `row.surname`)
   - `row.Display_Name` (not `row.display_name`)
   - `row.Gender` (not `row.gender`)
   - `row.Generation_Number` (not `row.generation_number`)
3. **Primary Key `Id` in `parent_child.csv`**:
   - Many rows have blank `Id`. The seed script should omit `id` and let PostgreSQL's auto-increment handle it, then reset sequence.

---

## 5. Current Workspace State
- `.env`: Created with Supabase credentials.
- `.gitignore`: Updated with `node_modules`, `.env`, `.DS_Store`, build artifacts.
- `prisma/schema.prisma`: Intact, ready for push.
- `prisma/seed.js`: Requires bug fixes outlined above.
- Existing Express dependencies in `package.json` (`express`, `cors`, `@prisma/client`, `prisma`, `nodemon`).

---

## 6. Recommended Execution Roadmap

### Phase 1: Database Setup & Seeding
1. Push schema: `npx prisma db push`
2. Fix `prisma/seed.js`:
   - Map CSV fields correctly (`row.Last_Name` $\rightarrow$ `surname`, etc.).
   - Insert persons 1 to 127.
   - Filter `parent_child.csv` where `child_id` is not NULL/empty.
   - Insert `ParentChild` records using `parentId: parseInt(row.Person_Id)`, `childId: parseInt(row.child_id)`.
   - Reset postgres sequences.
3. Run `npm run db:seed` and verify counts: 127 persons, 126 parent-child edges.
4. **Git commit & push**: `git add . && git commit -m "feat(db): configure supabase schema and fix seed data import" && git push`

### Phase 2: Backend API (Express or Next.js Route)
1. Provide an endpoint (e.g. `GET /api/tree` or `GET /api/persons` + `GET /api/relationships`).
2. Response payload:
   - `persons`: `[{ id, displayName, firstName, surname, salutation, gender, generationNumber, ... }]`
   - `relationships`: `[{ parentId, childId }]`
3. Optional search/filter query support.
4. **Git commit & push**.

### Phase 3: Frontend Family Tree UI (React + React Flow + ELK.js / Dagre)
1. Setup React app (e.g. Vite React TS in `client/` or full-stack Next.js).
2. Install `@xyflow/react` and `elkjs` (or `@dagrejs/dagre`).
3. Build Custom Node component:
   - Distinct color palettes per generation (Gen 1 to Gen 7).
   - Gender indicators (e.g. ♂ / ♀ badge or border accent).
   - Display name, generation tag, salutation.
4. Layout Calculation:
   - Top-to-bottom layout (`rankDir: 'TB'` or ELK direction `'DOWN'`).
   - Smooth step or orthogonal bezier edges.
5. Interactive Controls & Features:
   - Top navigation bar with family tree title and stats (127 members, 7 generations).
   - Search bar with instant autocomplete to center on a selected person.
   - Minimap and zoom/fit controls.
   - Slide-in details modal/drawer when clicking any person (shows parents, children, generation).
6. **Git commit & push**.

### Phase 4: Polish & Final Push
1. Test end-to-end responsiveness and pan/zoom performance.
2. Final push to `https://github.com/GuptaNidhish/Generational-Tree.git`.
