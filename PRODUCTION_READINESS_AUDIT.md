# Production Readiness Audit: Gupta Vanshavali

Audit date: 2026-11-10 · Branch audited: `redesign/scroll-story` at `b943896` · Fixes go on `prod/readiness`.

---

## 1. Executive summary

**Overall readiness: not ready to deploy publicly yet, but close.** The core security design is sound and better than usual for a project this size. Admin passwords are hashed with scrypt. Sessions are signed with HMAC and stored in `HttpOnly; SameSite=Strict` cookies. Every write must be JSON. Admin and owner checks run on the server. Login and comments are rate-limited, and comments are protected by Cloudflare Turnstile. The client renders no HTML from data and stores nothing in the browser.

What stops a confident public deployment is mostly **missing production hardening and deployment plumbing**, not broken logic.

**Most serious risks:**
1. **The production build and start fail on typical free hosts (DEP-02).** The Prisma client is never generated, and dev dependencies are skipped when `NODE_ENV=production`.
2. **There are no security headers at all (SEC-02).** There is no Content-Security-Policy and nothing stops the page from being framed, so the admin screens can be clickjacked.
3. **A high-severity DoS advisory affects the installed body-parser 2.3.0 (SEC-01).** A fix is available within the current version range.
4. **The bot check on comments silently turns off** if `TURNSTILE_SECRET_KEY` is missing in production (SEC-03). Comments contain visitors' phone numbers.
5. **A single render error blanks the whole site** (FE-01), and the public error screen shows developer instructions (FE-02).
6. **Rate limits can't tell visitors apart behind a proxy** unless `TRUST_PROXY` is set (SEC-08). One abusive visitor could then lock everyone out of comments and admin sign-in.

**Major weaknesses:**
- No operational visibility: no request logs and no database health check.
- Shutdown isn't graceful.
- No backup procedure for the Supabase free tier.
- `npm run db:reset` can wipe whichever database `.env` points to.

**General recommendations:**
- Keep the current architecture: one Node service serving the built UI and `/api` from one origin. It is the right fit for free hosting, and it keeps the strict cookie model intact.
- Add headers, configuration checks at startup, a general rate limit, compression and caching, plus a few client reliability fixes. All of this can be done with **one** new dependency (`compression`).

**Scale context:** the tree has 127 people and 126 parent→child links. `GET /api/tree` returns the whole lineage in one response of about 15 KB. That is fine now and for thousands of people, so I don't recommend pagination.

---

## 2. Architecture overview

### Frontend (`client/`)
- Vite 8, React 19, TypeScript 6, Tailwind CSS 4, and GSAP + ScrollTrigger. Fonts are bundled through `@fontsource`.
- The entry point is `client/src/main.tsx` → `App.tsx`.
  - `App` loads `/api/tree` once and indexes it in memory (`lib/family.ts`).
  - It then builds the generation sections (`lib/generations.ts`) and the hero tree silhouette (`lib/treeShape.ts`).
- The page is one long scroll story. Clicking a card opens `ProfilePanel`, which has the visitor comment form and the admin edit tools.
- Admin mode:
  - `useAdmin` calls `/api/admin/me` when the page loads.
  - `/admin` is a client-side path that opens the sign-in dialog.
  - Admin UI includes `AdminBar`, `PersonForm`, `CommentsReview`, `ManageAdmins` and `ChangePassword`.
- Every request goes through `client/src/api.ts` to **relative** `/api/...` URLs with `credentials: 'same-origin'`.
- After an admin saves, the tree is fetched again. Visitors' pages fetch it again when they return to the tab, at most once every 15 seconds.

### Backend (`index.js`, `server/`)
- Express 5.
  - `index.js` reads environment variables, creates `PrismaClient`, and calls `createApp()` (`server/app.js`) with the session secret, a Turnstile verifier and the cookie settings.
  - It then listens on `PORT`, which defaults to 4000.
- The middleware runs in this order: `cors()` → `express.json({limit:"20kb"})` → the JSON-only rule for `/api` POST and PATCH → the API router → static `client/dist` with the SPA fallback → the error handler.
- Public routes:
  - `GET /api/health`
  - `GET /api/tree`
  - `GET /api/persons?search&generation`
  - `GET /api/persons/:id`
  - `POST /api/persons/:id/comments`
- Admin routes under `/api/admin`:
  - Open: `POST /login`, `POST /logout` and `GET /me`.
  - Behind `requireAdmin`: `POST /me/password`, `PATCH /persons/:id`, `POST /persons/:id/children`, `GET /comments` and `PATCH /comments/:id`.
  - Owner only: `GET`, `POST` and `DELETE /admins`.
- Authentication (`server/auth.js`):
  - Passwords are stored as `scrypt$salt$hash`.
  - The session cookie `vanshavali_admin` holds `base64url({adminId, exp}).HMAC-SHA256` and expires after 7 days.
  - `requireAdmin` loads the admin from the database on every request, so removing an admin takes effect immediately.
- Abuse controls:
  - `server/rateLimit.js` is an in-memory sliding-window limiter: 10 logins per 15 minutes per IP and 5 comments per hour per IP.
  - Comments are also limited to 5 per phone number per day, counted in the database.
  - `server/turnstile.js` sends the token to Cloudflare's siteverify with an 8-second timeout.
- Input validation is in `server/validate.js`.
  - Person fields come from an allowlist. `displayName` is derived if missing, and `generationNumber` can't be set.
  - Phone numbers are normalised to `+digits`.

### Database (Supabase Postgres via Prisma 6, `prisma/schema.prisma`)
- `person`: names, gender and `generation_number`.
- `parent_child`: `(parent_id, child_id)` is unique, and deleting either person cascades to the link.
- `admin`: `username` is unique, and a partial unique index (in `enable-rls.sql`) allows only one owner.
- `comment`: linked to the person it's about, the linked person and the admin who resolved it. It has indexes on its foreign keys, on `(status, created_at)` and on `(phone, created_at)`.
- Every table has RLS enabled with no policies, so Supabase's public Data API can't read anything. Prisma connects as the owner and bypasses RLS.
- The app connects through Supabase's transaction pooler (`DATABASE_URL`, `pgbouncer=true`). The CLI uses the session pooler (`DIRECT_URL`).
- The schema is managed with `prisma db push`, not migrations.
- Data scripts: `seed.js`/`seed-lib.js` (CSV import), `append-csv.js`, `add-member.js` and `create-owner.js`.

### Request lifecycle
```
Browser (React)  ── fetch('/api/…', same-origin cookie) ──▶  Express 5
  ├─ cors() → express.json(20kb) → JSON-only guard for POST/PATCH
  ├─ /api router
  │    ├─ public: toInt()/validate*() → per-IP limiter → Turnstile → Prisma
  │    └─ /admin: login | requireAdmin (HMAC cookie → DB lookup) → [requireOwner] → validate → Prisma
  ├─ Prisma Client ──(pgbouncer, port 6543)──▶ Supabase Postgres
  ├─ success → res.json(...)   |   not found → 404 JSON   |   bad input → 400 JSON { error }
  └─ thrown/rejected (Express 5 forwards async rejections) → error handler → 500 { error: "Internal server error" }
Browser: api.ts → ApiError(message, status) → component shows message; 401 on admin path → "signed out" event
```

### Dependencies
| Package | Version | Notes |
|---|---|---|
| express | 5.3.0 | Current. It pulls in body-parser 2.3.0, which is **vulnerable** (SEC-01). |
| @prisma/client / prisma | 6.4.1 | Fine. The CLI is a devDependency, but the build needs it (DEP-02). |
| cors | 2.8.6 | Currently set to allow every origin (SEC-04). |
| csv-parse | 7.0.3 | Only the seed and append scripts use it. |
| nodemon | 3.1.14 | **Listed as a production dependency** and brings in vulnerable minimatch (DEP-01). |
| Client: react 19, gsap 3.15, @fontsource/* | — | `npm audit`: 0 vulnerabilities. |

### Baseline checks (run before any change)
| Check | Result |
|---|---|
| `npm test` (node:test, in-memory Prisma double) | 35/35 pass |
| `npm --prefix client test` (Vitest) | 16/16 pass |
| `oxlint` (client) | clean |
| `tsc -b` (client) | clean |
| `npm audit --omit=dev` (root) | 1 high (body-parser), 2 moderate (minimatch via nodemon) |
| `npm audit` (client) | 0 |
| `.env` in git history | never committed; `.gitignore` covers it |
| Debug statements / TODO / FIXME | none in `client/src` or `server/` |

---

## 3. Findings

Each finding is labelled with one of these types:
- **Confirmed vulnerability:** exploitable as the code stands.
- **Confirmed bug:** reproducible wrong behaviour.
- **Potential risk:** depends on how the app is deployed or operated.
- **Best practice:** a hardening step with no current exploit.

### Security

**SEC-01: body-parser DoS advisory**
| Field | |
|---|---|
| Type | Confirmed vulnerability (dependency) |
| Category / Severity | Security / **High** |
| Location | `package-lock.json`: `node_modules/body-parser` 2.3.0, pulled in by express 5.3.0 |
| Problem | GHSA-27r3-jxmh-p828: denial of service through trailing bytes after a compressed request body. |
| Impact | A crafted request could tie up the single free-tier instance. |
| Recommendation | Update the lockfile to body-parser 2.4.x, which is within Express 5's range. |
| Effort | Low |

**SEC-02: No security headers or CSP; framing allowed; `X-Powered-By` sent**
| Field | |
|---|---|
| Type | Confirmed (missing control) |
| Category / Severity | Security / **High** |
| Location | `server/app.js` `createApp()`: no header middleware |
| Problem | There is no `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` or HSTS. Express advertises itself with `X-Powered-By`. |
| Impact | Any site can frame the admin UI and trick a signed-in admin into clicking (clickjacking). There is no second line of defence if an XSS bug ever appears. Without HSTS, a first visit over HTTP can be downgraded. |
| Recommendation | Add a small header middleware with no new dependency. The CSP should allow only `'self'` plus `https://challenges.cloudflare.com` for the Turnstile script and frame, and set `frame-ancestors 'none'`. Send HSTS in production. Disable `x-powered-by`. |
| Effort | Low |

**SEC-03: The bot check silently turns off in production**
| Field | |
|---|---|
| Type | Potential risk (configuration) |
| Category / Severity | Security / **High** |
| Location | `server/turnstile.js` `createTurnstileVerifier()`; `index.js` |
| Problem | With no `TURNSTILE_SECRET_KEY`, the verifier returns `true` for every request. The only sign is one console warning, and production still starts. |
| Impact | Bots can post comments, which include phone numbers. Only the per-IP and per-phone limits stand in the way, and they are easy to get around by rotating IPs and numbers. Admins get flooded with spam. |
| Recommendation | In production, refuse to start without the key unless `TURNSTILE_DISABLED=1` is set deliberately (as you decided). |
| Effort | Low |

**SEC-04: CORS allows every origin**
| Field | |
|---|---|
| Type | Best practice |
| Category / Severity | Security / Medium |
| Location | `server/app.js:51` `app.use(cors())` |
| Problem | Every response carries `Access-Control-Allow-Origin: *`, but the UI is same-origin and needs no CORS. Credentialed requests are already blocked, because the cookie is `SameSite=Strict` and the wildcard can't be used with credentials. |
| Impact | Any website can read the full tree from its visitors' browsers, which makes scraping easier. Admin data is not exposed. |
| Recommendation | Read the allowed origins from `CORS_ORIGINS`, defaulting to none. |
| Effort | Low |

**SEC-05: Sessions survive a password change**
| Field | |
|---|---|
| Type | Confirmed (design gap) |
| Category / Severity | Security / Medium |
| Location | `server/auth.js` `signSession()`/`verifySession()`/`requireAdmin()`; `server/app.js` `POST /admin/me/password` |
| Problem | A session token depends only on the admin id and its expiry. Changing the password doesn't invalidate existing cookies, and logout only clears the cookie in the browser it's sent to. |
| Impact | If an admin's cookie is stolen or their password is compromised, changing the password doesn't lock the attacker out for up to 7 days. For the owner, who can't be removed, the only remedy is rotating `SESSION_SECRET`. |
| Recommendation | Put a short HMAC of the password hash in the session payload and check it on every request. A password change then ends all other sessions, with no schema change. |
| Effort | Low |

**SEC-06: An array `search` parameter crashes; no length limit**
| Field | |
|---|---|
| Type | Confirmed bug (HTTP parameter pollution) |
| Category / Severity | Security / Reliability / Medium |
| Location | `server/app.js:87` `req.query.search?.trim()` |
| Problem | `?search=a&search=b` is parsed as an array, so `.trim` is not a function and the request returns a 500 with a logged stack trace. A long `search` value goes straight into an `ILIKE '%…%'` query. |
| Impact | Anyone can flood the error logs. Very long patterns make the database do needless work. |
| Recommendation | Accept only a string of at most 100 characters, otherwise return 400. |
| Effort | Low |

**SEC-07: No general API rate limit; limits can't be configured; no `Retry-After`**
| Field | |
|---|---|
| Type | Confirmed (missing control) |
| Category / Severity | Security / Medium |
| Location | `server/rateLimit.js` `createLimiter()`; `server/app.js:63-65` |
| Problem | Only login and comments are limited. `/api/tree`, `/api/persons` and the other read routes can be called without limit. The limits are hard-coded. 429 responses have no `Retry-After`. The sliding-window limiter keeps one timestamp per request, so it isn't suited to a high-volume general limit. |
| Impact | Scraping or flooding the read routes keeps the free instance and the database pooler busy. |
| Recommendation | Add a fixed-window counter with bounded memory and a general `/api` limit (300/min/IP by default, health routes exempt). Make all limits configurable through environment variables and send `Retry-After`. |
| Effort | Low |

**SEC-08: The proxy setting isn't checked**
| Field | |
|---|---|
| Type | Potential risk (deployment) |
| Category / Severity | Security / Medium |
| Location | `index.js` (`TRUST_PROXY`); `server/app.js:50` |
| Problem | Behind Render's or any other proxy, `req.ip` is the proxy's address unless `TRUST_PROXY` is set. Nothing warns when it's missing. |
| Impact | Every visitor shares one rate-limit bucket. Ten bad login attempts lock **everyone** out of admin for 15 minutes, and five comments sitewide block every visitor for an hour. |
| Recommendation | Warn at startup in production when `TRUST_PROXY` is unset, and document the right value. |
| Effort | Low |

**SEC-09: Session secret strength isn't checked; admin responses can be cached**
| Field | |
|---|---|
| Type | Best practice |
| Category / Severity | Security / Low |
| Location | `index.js`; `server/app.js` admin router |
| Problem | `SESSION_SECRET="abc"` is accepted. Admin responses, including comments with phone numbers, have no `Cache-Control: no-store`. |
| Impact | A weak secret could be brute-forced offline to forge sessions. A shared or browser cache could keep admin-only data. |
| Recommendation | Require at least 32 characters in production. Send `Cache-Control: no-store` on `/api/admin/*`. |
| Effort | Low |

**SEC-10: `.env.example` names the real Supabase project**
| Field | |
|---|---|
| Type | Best practice |
| Category / Severity | Security / Low |
| Location | `.env.example`: `postgres.yaerdbdcmbwyhigpooco@aws-0-ap-southeast-2…` |
| Problem | It shows the real project ref and region. It isn't a secret, but it tells an attacker which project to target. RLS is on, so the public Data API exposes nothing. |
| Impact | Low. Slightly easier reconnaissance. |
| Recommendation | Use `[PROJECT-REF]` and `[REGION]` placeholders. |
| Effort | Low |

**PRIV-01: Privacy decisions for you**
| Field | |
|---|---|
| Type | Information (product decision) |
| Category / Severity | Security / Info |
| Location | `GET /api/tree`; `client/index.html`; the `comment` table |
| Problem | The tree is public by design: full names, gender, generation and parent links, including living people. Search engines can index the site, since there is no `robots`/`noindex`. Comments, which contain phone numbers, are kept forever. |
| Impact | Family members' names become searchable on the web. Phone numbers pile up indefinitely. |
| Recommendation | Decide whether to add `noindex`, and set a retention period for resolved comments (for example, delete them after 12 months). Neither is implemented, because both are your decisions. |
| Effort | Low |

### Reliability

**REL-01: Client errors from request bodies are reported as 500**
| Field | |
|---|---|
| Type | Confirmed bug |
| Category / Severity | Reliability / Medium |
| Location | `server/app.js:317-320`, the error handler |
| Problem | The handler ignores `err.status`. A malformed JSON body (body-parser 400) or an oversized body (413) returns `500 Internal server error`, and the full stack trace is logged. |
| Impact | Clients get the wrong status, and anyone can fill the logs with stack traces. |
| Recommendation | Pass 4xx errors through with a generic message and no stack trace. Log only real 5xx errors, in a structured one-line format. |
| Effort | Low |

**REL-02: Very large ids cause a 500**
| Field | |
|---|---|
| Type | Confirmed bug |
| Category / Severity | Reliability / Low |
| Location | `server/app.js:24` `toInt()`; `server/validate.js:63` (`linkedPersonId`) |
| Problem | `/api/persons/99999999999` passes the digits-only check, but Postgres `INT4` overflows inside Prisma, so the request returns 500. |
| Impact | Error-log noise and a wrong status code. |
| Recommendation | Treat ids above 2,147,483,647 as invalid. |
| Effort | Low |

**REL-03: No process-level error handling; shutdown isn't graceful**
| Field | |
|---|---|
| Type | Confirmed |
| Category / Severity | Reliability / Medium |
| Location | `index.js:37-44` |
| Problem | There are no `unhandledRejection`/`uncaughtException` handlers. `shutdown()` doesn't wait for `server.close()`, so in-flight requests are cut off on a redeploy. Nothing forces an exit if shutdown hangs, and a second signal starts shutdown again. |
| Impact | Requests fail during deploys. The process can die without a useful log, or hang when the platform stops it. |
| Recommendation | Add the process handlers. Make shutdown await `server.close()` and `prisma.$disconnect()`, with a 10-second forced exit. |
| Effort | Low |

**REL-04: The health check doesn't cover the database; no request logs**
| Field | |
|---|---|
| Type | Confirmed (missing operational control) |
| Category / Severity | Reliability / Medium |
| Location | `server/app.js:70` |
| Problem | `/api/health` always reports OK, even when Supabase is paused or unreachable. Requests aren't logged at all. |
| Impact | You can't tell "the app is up but the database is down" apart, and you can't investigate abuse or errors after the fact. |
| Recommendation | Keep `/api/health` as the liveness check. Add `/api/health/ready`, which runs `SELECT 1`. Log one line per API request in production, without query strings. |
| Effort | Low |

### Database

**DB-01: Family-tree integrity isn't enforced or checked**
| Field | |
|---|---|
| Type | Potential risk |
| Category / Severity | Database / Medium |
| Location | `prisma/schema.prisma` (`ParentChild`); `prisma/append-csv.js:48-100`; `prisma/add-member.js` |
| Problem | The **API itself can't** create a cycle, a self-link or a wrong generation: it only creates new children, at the parent's generation plus one. But nothing in the database prevents these, and the offline scripts trust their input. `append-csv.js` takes `generation_number` from the CSV, never compares it with the parent's, and creates the person and the links in separate, non-transactional writes, so a failure partway through leaves a person with no parent. There is no way to check the live data. |
| Impact | A bad CSV row could quietly put someone in the wrong generation section or leave an orphan. The client's traversals guard against cycles, so a bad row wouldn't freeze the page. |
| Recommendation | Add a **read-only** integrity checker (`npm run db:check`) for self-links, cycles, generation mismatches, orphans, people with more than two parents, and dangling links. Make `append-csv.js` warn on generation mismatches. Database `CHECK` constraints are optional and need a migration you would run yourself. |
| Effort | Medium |

**DB-02: `db:reset` can wipe production without asking**
| Field | |
|---|---|
| Type | Potential risk (data safety) |
| Category / Severity | Database / Medium |
| Location | `package.json` script `db:reset` (`prisma db push --force-reset`) |
| Problem | It drops every table in whichever database `DATABASE_URL`/`DIRECT_URL` points to, without asking. Locally, that **is** the production Supabase database. |
| Impact | Typing one command by mistake permanently loses all edits, admin accounts and comments. The seed restores only the original 127 people. |
| Recommendation | Ask for confirmation first: show the target host, make the user type `reset`, and refuse when `NODE_ENV=production`. |
| Effort | Low |

**DB-03: No backup procedure**
| Field | |
|---|---|
| Type | Potential risk (operations) |
| Category / Severity | Database / Medium |
| Location | Operations / README |
| Problem | The Supabase free tier has no downloadable backups or point-in-time recovery, and it pauses a project after a week without activity. Admin edits and comments exist only in the database. |
| Impact | One bad edit, a script mistake or a lost project means permanent data loss. |
| Recommendation | Add `npm run db:backup`, a read-only `pg_dump` to a gitignored `backups/` folder, and document how often to run it and how to restore. |
| Effort | Low |

**DB-04: No index on `parent_child.child_id`**
| Field | |
|---|---|
| Type | Best practice |
| Category / Severity | Database / Low |
| Location | `prisma/schema.prisma` `ParentChild` |
| Problem | The unique `(parent_id, child_id)` index covers lookups by parent. Lookups by child (`childOf` in `GET /persons/:id`) have no index. |
| Impact | None at 126 rows. It would matter at tens of thousands. |
| Recommendation | Add `@@index([childId])` the next time you run `db push`. **Documented only**, because it needs a schema push to the production database that you should run yourself. |
| Effort | Low |

Other database checks with no issue found:
- There are no N+1 queries: `/tree` uses 2 queries and `/persons/:id` uses 1 query with nested selects.
- The comment list is capped at 200.
- Unique violations (P2002) are handled.
- Adding a child is a single nested create, so it runs in one transaction.
- Cascades only remove links and comments when a person is deleted, and no API route deletes people.
- Concurrent person edits are last-write-wins. That is acceptable with only a few admins and is documented.

### Deployment

**DEP-01: `nodemon` ships to production; no Node version declared**
| Field | |
|---|---|
| Type | Confirmed |
| Category / Severity | Deployment / Medium |
| Location | `package.json` `dependencies.nodemon`; no `engines` field |
| Problem | `nodemon` is a development tool, but it's installed in production and brings in a vulnerable minimatch. The required Node version isn't declared, though Vite 8 needs ≥20.19. |
| Impact | A larger and more vulnerable production install. The host might pick an incompatible Node version. |
| Recommendation | Move `nodemon` to devDependencies. Add `engines.node >= 20.19`. |
| Effort | Low |

**DEP-02: The production build and startup fail on common hosts**
| Field | |
|---|---|
| Type | Confirmed bug (deployment) |
| Category / Severity | Deployment / **High** |
| Location | `package.json` script `build` |
| Problem | `build` doesn't run `prisma generate`. If the host installs with `NODE_ENV=production`, dev dependencies are skipped, so the Prisma CLI is missing and `@prisma/client` isn't generated. The client's `npm install` also skips Vite and TypeScript in that case. `install` is also not reproducible, unlike `ci`. |
| Impact | Either the build fails ("vite: not found"), or the server crashes on its first query ("@prisma/client did not initialize yet"). |
| Recommendation | Change `build` to `prisma generate && npm --prefix client ci --include=dev && npm --prefix client run build`, and document the build command `npm ci --include=dev && npm run build`. |
| Effort | Low |

**DEP-03: No compression; hashed assets aren't cached long-term**
| Field | |
|---|---|
| Type | Best practice (performance) |
| Category / Severity | Performance / Medium |
| Location | `server/app.js:310-313` (`express.static`) |
| Problem | 408 KB of JS and 50 KB of CSS are sent uncompressed. The fingerprinted `/assets/*` files use `max-age=0`, so they're revalidated on every visit. |
| Impact | Slower first loads on mobile networks, which is significant for relatives on phones. Repeat visits make needless requests. |
| Recommendation | Add `compression`. Send `immutable`, 1-year caching for `/assets/*` and `no-cache` for `index.html`. |
| Effort | Low |

**DEP-04: No CI**
| Field | |
|---|---|
| Type | Best practice |
| Category / Severity | Deployment / Low |
| Location | Repository (no `.github/workflows`) |
| Problem | Tests, lint, typecheck and the build only run when someone remembers to run them. |
| Impact | A regression can reach production. |
| Recommendation | Add a GitHub Actions workflow (as you decided). |
| Effort | Low |

**Deploying the frontend separately.** Every API call uses relative `/api` paths and same-origin cookies that are `SameSite=Strict` with `Path=/api`. That means a UI on Vercel or Netlify with the API elsewhere **will break admin sign-in**. It would only work behind a same-site rewrite of `/api`. Recommendation: deploy as a single service, which the server already supports (`client/dist` with an SPA fallback). I'm documenting this, not re-architecting it.

### Frontend

**FE-01: No error boundary**
| Field | |
|---|---|
| Type | Confirmed |
| Category / Severity | Frontend / **High** |
| Location | `client/src/main.tsx` (no boundary anywhere) |
| Problem | Any error thrown while rendering unmounts the whole React root. |
| Impact | Visitors see a blank cream page with no message and no way to recover. One unexpected record (for example, a malformed API response) takes down the whole site. |
| Recommendation | Wrap `<App/>` in an error boundary whose fallback reuses the existing error card and offers "Reload". |
| Effort | Low |

**FE-02: Developer instructions on the public error screen**
| Field | |
|---|---|
| Type | Confirmed |
| Category / Severity | Frontend / Medium |
| Location | `client/src/App.tsx:386-389` |
| Problem | It shows the raw `e.message` (such as "Failed to fetch." or a JSON `SyntaxError`) and tells visitors to run `npm run dev` in the project root. |
| Impact | Confusing for family members, and unprofessional. |
| Recommendation | Show the developer hint only in development. In production, show a friendly message for network or parsing failures. |
| Effort | Low |

**FE-03: No request timeout; non-JSON responses throw raw errors**
| Field | |
|---|---|
| Type | Confirmed |
| Category / Severity | Frontend / Medium |
| Location | `client/src/api.ts:14-36` `request()` |
| Problem | `fetch` has no timeout, so a hung request spins forever. A 200 response whose body is HTML (for example, a host error page) throws `SyntaxError`, and that text is shown to the user. |
| Impact | An endless "Opening the vanshavali" spinner, or a technical error message. |
| Recommendation | Add a 60-second timeout, generous enough for a free-tier cold start of about 50 seconds. Turn network, timeout and non-JSON failures into an `ApiError` with a friendly message. |
| Effort | Low |

**FE-04: The tree reload can show stale data**
| Field | |
|---|---|
| Type | Confirmed bug |
| Category / Severity | Frontend / Medium |
| Location | `client/src/App.tsx:353-366` `reload()` |
| Problem | A reload triggered by tab focus and a forced reload after an admin's save can overlap, and the older response can arrive last. |
| Impact | After saving, the admin sees the pre-save tree until the next refresh and may think the save failed. |
| Recommendation | Add a request-sequence ref so only the newest response is applied. |
| Effort | Low |

**FE-05: A failed sign-out becomes an unhandled rejection**
| Field | |
|---|---|
| Type | Confirmed bug |
| Category / Severity | Frontend / Medium |
| Location | `client/src/hooks/useAdmin.ts:25-31` |
| Problem | `try { … } finally { … }` with no `catch` rethrows into the click handler. |
| Impact | An unhandled promise rejection appears in the console, and error monitoring would report it. |
| Recommendation | Catch the error. The UI still switches to the visitor view. |
| Effort | Low |

**FE-06: A Turnstile load failure leaves visitors stuck**
| Field | |
|---|---|
| Type | Confirmed |
| Category / Severity | Frontend / Medium |
| Location | `client/src/components/Turnstile.tsx:29`; `client/src/lib/turnstile.ts:22` |
| Problem | If Cloudflare's script is blocked by an ad blocker, a network problem or a CSP, the widget area stays empty, and the form keeps asking the visitor to "complete the check below". If the script loads but `window.turnstile` is missing, the loader stays in a failed state and can't retry. |
| Impact | Some visitors can't send a comment and don't know why. |
| Recommendation | Show a one-line explanation when the check can't load, and reset the loader so it can retry. |
| Effort | Low |

**FE-07: The comment review list can show the wrong tab's comments**
| Field | |
|---|---|
| Type | Confirmed bug |
| Category / Severity | Frontend / Low |
| Location | `client/src/components/CommentsReview.tsx:25-34` |
| Problem | If an admin switches tabs quickly and the responses arrive out of order, the list can show another tab's comments under the selected tab. |
| Impact | Admin confusion. |
| Recommendation | Ignore responses that are out of date. |
| Effort | Low |

**FE-08: Minor cleanups**
| Field | |
|---|---|
| Type | Best practice |
| Category / Severity | Frontend / Low |
| Location | `Hero.tsx:20-23`, `ProfilePanel.tsx:162-178`, `SearchBox.tsx:31-47,104`, `PersonCard.tsx:31-35`, `App.tsx:75-79` |
| Problem | Several short GSAP tweens and one timeout are never killed. Comments are fetched twice when the tab regains focus. A tree with no people shows no message. There are no Open Graph or `theme-color` meta tags. |
| Impact | Negligible. React and GSAP tolerate all of these, and the database is never empty. |
| Recommendation | Optional, P3. |
| Effort | Low |

Frontend items with no issue found:
- No `dangerouslySetInnerHTML`, `innerHTML` or `eval`. Comment text is rendered as plain text.
- `tel:` links use server-normalised `+digits`.
- No `localStorage` or `sessionStorage`. The session is an `HttpOnly` cookie.
- No `console.*`.
- Every traversal guards against cycles (`lineageOf`, `buildGenerations`, `growTree`, `lineOfDescent`), so bad data can't freeze the browser.
- GSAP contexts and `matchMedia` listeners are reverted, and listeners and observers are cleaned up.
- Derived data is memoised, and cards use `React.memo`.
- There are no inline scripts, and fonts are self-hosted, so a strict CSP is achievable.
- Reduced motion is respected.

**Performance with a large tree:** each person takes about 17–19 DOM nodes, so 1,000 people is about 18k nodes, with one ScrollTrigger timeline per family cluster. That is comfortable at 127 people and acceptable into the low thousands. Virtualising would conflict with the scroll-story design, so I don't recommend it. Every routine in the libraries is O(n) or O(n log n).

---

## 4. Prioritized implementation roadmap

Each item is one focused commit on the `prod/readiness` branch. "Breaking" means a change someone using the app would notice.

### P0: Critical (must fix before public deployment)
| # | Fixes | Files | Change | Depends on | Breaking? | Testing |
|---|---|---|---|---|---|---|
| 1 | SEC-01, DEP-01 | `package.json`, `package-lock.json`, `client/package.json` | Update body-parser to 2.4.x. Move nodemon to devDependencies. Add `engines`. | — | No | `npm audit --omit=dev` = 0; full test run |
| 2 | DEP-02 | `package.json` | Run `prisma generate` and `ci --include=dev` in `build`. | 1 | No | `npm run build` |
| 3 | SEC-02 | new `server/security.js`, `server/app.js` | Security headers and CSP; no `x-powered-by`. | — | No (CSP checked in a browser with Turnstile) | New header tests; Playwright console check for CSP violations |
| 4 | SEC-03, SEC-08, SEC-09 | new `server/config.js`, `index.js` | Startup environment checks: errors in production, warnings otherwise. | — | **Production needs `TURNSTILE_SECRET_KEY` or `TURNSTILE_DISABLED=1`, and a `SESSION_SECRET` of ≥32 characters** | `checkEnv` unit tests; a manual start with and without the variables |
| 5 | FE-01, FE-02 | new `client/src/components/ErrorBoundary.tsx`, `main.tsx`, `App.tsx` | Error boundary; friendly error text in production. | — | No (same card design) | Browser: API down, render error |

### P1: High priority (security, integrity, reliability)
| # | Fixes | Files | Change | Depends on | Breaking? | Testing |
|---|---|---|---|---|---|---|
| 6 | SEC-04 | `server/app.js`, `index.js` | CORS allowlist from `CORS_ORIGINS`, empty by default. | — | Only for outside sites calling the API from a browser (none known). To re-enable one, set `CORS_ORIGINS`. | Origin header tests |
| 7 | SEC-05 | `server/auth.js`, `server/app.js` | Password fingerprint (`pv`) in the session; check it every request; re-issue the cookie after a password change. | — | **Admins sign in once more after the deploy** | Session tests |
| 8 | SEC-06, REL-02 | `server/app.js`, `server/validate.js` | `search` must be a string of ≤100 characters; ids are limited to INT4. | — | No | 400/404 tests |
| 9 | SEC-07 | `server/rateLimit.js`, `server/app.js`, `index.js` | General `/api` limit, `Retry-After`, limits set by environment variables. | — | No (300/min is generous) | 429 tests |
| 10 | REL-01 | `server/app.js` | The error handler passes 4xx through and logs 5xx in one structured line. | — | No | Malformed JSON → 400; >20 KB → 413 |
| 11 | REL-03 | `index.js` | Process handlers and graceful shutdown. | — | No | Manual SIGTERM test |
| 12 | FE-03–FE-06 | `client/src/api.ts`, `App.tsx`, `hooks/useAdmin.ts`, `components/Turnstile.tsx`, `lib/turnstile.ts`, `components/CommentForm.tsx` | Timeout and friendly errors; protection against stale reloads; catch the sign-out error; explain a Turnstile failure. | — | No (one new line of text in the existing error style) | Vitest for `api.ts`; browser |

### P2: Medium priority (operations and performance)
| # | Fixes | Files | Change | Depends on | Breaking? | Testing |
|---|---|---|---|---|---|---|
| 13 | REL-04, SEC-09 | `server/app.js`, `index.js` | `/api/health/ready`; request log; `no-store` on admin routes. | — | No (`/api/health` unchanged) | Tests; curl |
| 14 | DEP-03 | `server/app.js`, `package.json` | `compression`; cache headers for static files. | — | No | curl `-H 'Accept-Encoding: gzip'` |
| 15 | DB-01 | new `prisma/integrity.js`, `prisma/check-integrity.js`, `prisma/append-csv.js`, `package.json` | Read-only `db:check`; generation warning in append. | — | No | Unit tests; read-only run against real data |
| 16 | DB-02 | new `prisma/confirm-reset.js`, `package.json` | Confirmation prompt before `db:reset`. | — | Adds a prompt | Run it and answer no |
| 17 | DB-03 | `package.json`, `.gitignore`, README | `db:backup` using `pg_dump`. | Needs PostgreSQL client tools installed | No | Run if `pg_dump` is available |
| 18 | FE-07 | `client/src/components/CommentsReview.tsx` | Stale-response guard. | — | No | Browser |
| 19 | SEC-10 | `.env.example`, `client/.env.example`, `README.md` | Placeholders; document all variables. | — | No | Review |
| 20 | DEP-04 | new `.github/workflows/ci.yml` | CI. | — | No | YAML review (it runs on the next push) |

### P3: Optional (not deployment blockers, documented only)
- DB-04: `@@index([childId])`.
- Database `CHECK (parent_id <> child_id)`.
- An audit trail of admin edits, which needs a new table.
- Session revocation on logout, which needs a server-side session table.
- A per-username login lockout. Not recommended: an attacker could use it to lock the owner out.
- The FE-08 cleanups.
- PRIV-01 decisions: `noindex` and comment retention.
- Shared rate-limit storage (Redis) if you ever run more than one instance.

---

## 5. Deployment blockers

Public deployment is unsafe or unreliable until all of these are resolved:

1. **SEC-01:** the body-parser DoS advisory in a production dependency.
2. **DEP-02:** the build and startup fail on hosts that set `NODE_ENV=production`, because the Prisma client isn't generated and Vite is missing.
3. **SEC-02:** no clickjacking protection on the admin UI and no CSP.
4. **SEC-03:** the comment bot check can be off in production without anyone noticing.
5. **FE-01:** a single render error blanks the site with no way to recover.

Configuration that must be correct on the host. The code can check and warn, but you have to set it:
- `SESSION_SECRET`, at least 32 random characters.
- `TURNSTILE_SECRET_KEY` on the server and `VITE_TURNSTILE_SITE_KEY` **at build time**. If they don't match, every comment fails.
- The Turnstile widget's allowed hostnames must include the real domain.
- `TRUST_PROXY` set correctly for the host. Otherwise SEC-08 lets one visitor lock everyone out.
- RLS confirmed on the production database (`npm run db:rls` was run).
- A first backup taken before launch (DB-03).
