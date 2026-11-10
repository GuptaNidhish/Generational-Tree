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
npm ci --include=dev  # dev tools are needed to build, even with NODE_ENV=production
npm run build         # generates the Prisma client and builds client/dist
npm start             # serves the UI and /api from one origin on $PORT (default 4000)
```

Deploy it as **one** web service: Express serves the built client and the API from the same origin, which the admin cookie (`SameSite=Strict`, `Path=/api`) relies on. With `NODE_ENV=production` the server refuses to start until `DATABASE_URL`, a `SESSION_SECRET` of at least 32 characters and `TURNSTILE_SECRET_KEY` are set. Step-by-step hosting instructions (Render free tier and Supabase) are in [PRODUCTION_READINESS_FINAL_REPORT.md](PRODUCTION_READINESS_FINAL_REPORT.md).

What production adds:
- security headers and a Content-Security-Policy (only this site and Cloudflare Turnstile), HSTS, no framing;
- gzip, with year-long caching for the fingerprinted files in `assets/` and none for the page itself;
- a general limit of 300 API requests per minute per visitor, on top of the sign-in and comment limits;
- one JSON log line per API request, and per server error;
- graceful shutdown on `SIGTERM`.

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
| `DATABASE_URL`, `DIRECT_URL` | `.env` | Supabase transaction pooler (app) and session pooler (CLI, backups). |
| `SESSION_SECRET` | `.env` | Signs admin sign-in cookies. **Required in production, at least 32 characters.** In development, a temporary key is used if it's missing. |
| `TURNSTILE_SECRET_KEY` | `.env` | Cloudflare Turnstile secret. **Required in production.** Empty skips the check in development. |
| `TURNSTILE_DISABLED` | `.env` | `1` lets production run without Turnstile on purpose. |
| `VITE_TURNSTILE_SITE_KEY` | `client/.env` | Turnstile site key shown on the comment form. Read when the client is **built**. |
| `NODE_ENV` | host | `production` turns on the startup checks, secure cookies, HSTS and request logs. |
| `TRUST_PROXY` | `.env` | Set to `1` behind a reverse proxy so rate limits see real visitor IPs. Production warns if it's missing. |
| `CORS_ORIGINS` | `.env` | Other sites allowed to call the API from a browser (comma-separated). Unset: none. |
| `RATE_LIMIT_API_PER_MIN`, `RATE_LIMIT_LOGIN_PER_15MIN`, `RATE_LIMIT_COMMENTS_PER_HOUR` | `.env` | Override the limits below. |
| `LOG_REQUESTS` | `.env` | `1` logs API requests outside production too. |

Limits: 300 API requests per minute per IP; 10 sign-in attempts per 15 minutes per IP; 5 comments per hour per IP and 5 per day per phone number. A blocked request gets `429` with `Retry-After`.

Changing a password signs that admin out everywhere else (the current browser stays signed in).

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/tree` | `{ persons, relationships: [{ parentId, childId }] }` |
| `GET /api/persons?search=ram&generation=3` | Matching people (case-insensitive name search) |
| `GET /api/persons/:id` | A person with their `parents` and `children` |
| `GET /api/health` | `{ ok: true }`: the process is up (liveness) |
| `GET /api/health/ready` | `{ ok, database: "up" \| "down" }`, 503 when the database doesn't answer (readiness) |
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

Looking after the data:

```bash
npm run db:check     # read-only: cycles, self-links, wrong generations, missing parents
npm run db:backup    # read-only: pg_dump of the app's tables to backups/ (needs PostgreSQL client tools)
npm run db:reset     # DESTRUCTIVE: wipes the database and re-seeds; asks you to type "reset" first
```

## Troubleshooting

**`node` commands hang with no output.** This project lives on the iCloud-synced Desktop. macOS can evict files in `node_modules` to iCloud, and then every `require` stalls. Reinstall with `rm -rf node_modules client/node_modules && npm ci && npm --prefix client ci`, or move the project outside iCloud Drive.
