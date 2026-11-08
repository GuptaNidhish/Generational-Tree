# Gupta Vanshavali

An interactive family tree of the Gupta family: 127 descendants of Sh. Deviram Gupta across 7 generations. It shows bloodlines only (parent → child), laid out top to bottom.

- **Database**: Supabase Postgres, accessed through Prisma 6
- **API**: Express 5 (`server/app.js`)
- **Client**: Vite, React 19, TypeScript, Tailwind CSS v4, GSAP + ScrollTrigger (`client/`)

## Setup

```bash
npm install
cp .env.example .env        # then put your Supabase database password in both URLs
npm run db:push             # create tables (session pooler) + enable RLS
npm run db:seed             # load prisma/seed-data/*.csv → 127 people, 126 links
```

`DATABASE_URL` is Supabase's transaction pooler (port 6543, `pgbouncer=true`), used by the app at runtime. `DIRECT_URL` is the session pooler (port 5432), used by the Prisma CLI. Both are IPv4-compatible.

RLS is enabled on both tables with no policies (`prisma/enable-rls.sql`). This keeps them unreadable through Supabase's public Data API, while Prisma connects as the table owner and is unaffected.

## Development

Run each in its own terminal:

```bash
npm run dev          # API on http://localhost:4000 (nodemon)
npm run client:dev   # UI on http://localhost:5173, proxies /api to :4000
```

## Production

```bash
npm run build        # builds client/dist
npm start            # serves the UI and /api from http://localhost:4000
```

## Exploring the tree

The site tells the family's story one generation at a time as you scroll down the page:

- **The opening** draws the whole family as a tree: the trunk is Sh. Deviram Gupta, and every leaf is one of the members below, placed on the branch they descend from.
- **Each generation** has its own section. Members are grouped by the parent they descend from ("Children of …"), and gold branches connect each parent label to their children's cards. Click a parent label to go up to that parent; click "n children" on a card to go down to their family.
- **Click any card** to open a profile with their parent, siblings, children and line of descent. Each relative links on to their own profile.
- **Search** finds anyone by name, scrolls to their card, and highlights them with their immediate family (parent, siblings, children). Press Escape or *Clear* to remove the highlight.
- **The roman numerals** in the header (a dock at the bottom on phones and tablets) show which generation is on screen and jump to any generation. The gold line under the header shows how far down the family you are.
- With *reduced motion* enabled in the OS, everything is shown at once and jumps happen without animation.

## Admins and visitor comments

**Visitors** don't need an account. On anyone's profile, *Know something we've missed?* lets them tell the family admins about a missing child or a mistake. They give their name and mobile number, say whether they (or an ancestor) are in the tree and which person that is, and pass Cloudflare Turnstile, a free "are you human" check. Comments and phone numbers are only visible to admins. There is no SMS code: admins call back to confirm when needed.

**Admins** sign in at `/admin` (or *Sign in as admin* at the foot of the page). They can:
- edit anyone's details and add children under anyone (a child is placed one generation below the parent; a child of generation VII starts generation VIII);
- review visitor comments, call the visitor, and mark each comment resolved or dismissed with a note.

Changes are saved to the database, so everyone sees them: the admin's page updates at once, and visitors' open pages refresh when they return to the tab.

**The owner** is the one account that can add and remove other admins (*Manage admins*). Create it once:

```bash
npm run admin:owner                      # asks for a username and password
npm run admin:owner -- --reset-password  # if you forget the owner password
```

The script refuses to make a second owner, and the database enforces this too. There is no way to create an admin except from the owner's *Manage admins* screen.

Settings (see `.env.example` and `client/.env.example`):

| Variable | Where | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | `.env` | Signs admin sign-in cookies. **Required in production.** In development, a temporary key is used if it's missing. |
| `TURNSTILE_SECRET_KEY` | `.env` | Cloudflare Turnstile secret. Empty skips the check (development only). |
| `VITE_TURNSTILE_SITE_KEY` | `client/.env` | Turnstile site key shown on the comment form. |
| `TRUST_PROXY` | `.env` | Set to `1` behind a reverse proxy so rate limits see real visitor IPs. |

Limits: 10 sign-in attempts per 15 minutes per IP; 5 comments per hour per IP and 5 per day per phone number.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/tree` | `{ persons, relationships: [{ parentId, childId }] }` |
| `GET /api/persons?search=ram&generation=3` | Matching people (case-insensitive name search) |
| `GET /api/persons/:id` | A person with their `parents` and `children` |
| `GET /api/health` | `{ ok: true }` |
| `POST /api/persons/:id/comments` | Visitor comment (name, phone, tree connection, message, Turnstile token) |
| `/api/admin/*` | Sign-in, editing people, adding children, comment review, admin accounts (see `server/app.js`) |

## Tests

```bash
npm test                    # seed CSV mapping + API (node:test, no database needed)
npm --prefix client test    # tree logic and layout (Vitest)
```

## Data notes

In `prisma/seed-data/parent_child.csv`, the `Person_Id` column is the **parent** and `child_id` is their child. The `parent_id` column is actually the grandparent. Rows with `child_id = NULL` are people with no recorded children and are skipped. See `prisma/seed-lib.js`.

To add people later, use `npm run add:member` (edit `prisma/add-member.js` first) or `npm run db:append` with `prisma/seed-data/append_members.csv`.

## Troubleshooting

**`node` commands hang with no output.** This project lives on the iCloud-synced Desktop. macOS can evict files in `node_modules` to iCloud, and then every `require` stalls. Reinstall with `rm -rf node_modules client/node_modules && npm ci && npm --prefix client ci`, or move the project outside iCloud Drive.
