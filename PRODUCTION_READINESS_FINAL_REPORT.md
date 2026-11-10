# Production Readiness: Final Report

**Gupta Vanshavali.** Work is on branch `prod/readiness`: 22 commits on top of `redesign/scroll-story`. Completed 2026-11-10.
The initial audit, with the full detail of every finding, is in [PRODUCTION_READINESS_AUDIT.md](PRODUCTION_READINESS_AUDIT.md).

## At a glance

**Verdict: ready to deploy once you complete the manual steps in §13 and §17.** Those steps are setting secrets, creating the Turnstile widget, checking the proxy setting, and taking a first backup. The code-side blockers are all fixed and were verified against a production build running on real data. This is **not** a "it builds, so it's ready" verdict: the items under *Not verified* can only be confirmed on the live host.

| Status | What it covers |
|---|---|
| ✅ **Ready** (checked here) | Dependencies with no known vulnerabilities in production. Security headers and a strict CSP, which works with Turnstile in a real browser. Rate limits, tested under load with per-visitor separation behind a proxy. Input validation; no 500s from bad input. Admin access control; signed-out and forged requests are rejected. Sessions end when a password changes. The error boundary and friendly error screens. Graceful degradation when the database is down. Graceful shutdown. Compression and caching. A production build from a clean clone with `NODE_ENV=production`. Integrity of the live family-tree data (read-only check: 0 problems). Phone, tablet and desktop layouts render correctly, and no styles were changed. |
| 🔧 **Needs you** | Host secrets and settings. A Turnstile widget for the real domain. Choosing the database URL (session pooler). Confirming the real visitor IP behind the host's proxy. Installing `pg_dump` and taking backups. Confirming RLS on the production database. The privacy decisions (search-engine indexing, keeping phone numbers). |
| ❓ **Not verified** | Behaviour on the actual host: the proxy hop count, cold starts, TLS/HSTS on the real domain and Node version selection. Real admin writes (edit, add child, review, manage admins) and a real comment submission against the production database. I deliberately didn't write to your database; these flows are covered by the in-memory API tests only. A real `pg_dump` backup (`pg_dump` isn't installed on this machine). The CI workflow's first run on GitHub. |

---

## 1. Summary of the initial audit

The codebase started with sound security fundamentals:
- scrypt-hashed passwords;
- HMAC-signed `HttpOnly; SameSite=Strict` session cookies;
- writes that must be JSON;
- admin and owner checks on the server;
- per-IP and per-phone limits;
- Turnstile on comments;
- no HTML rendered from data.

The audit found **31 findings: 5 high, 18 medium, 7 low and 1 informational**. Verification later found one more (PERF-01) and raised SEC-08 to high. Five of them blocked deployment:
- a vulnerable body-parser;
- a build that fails on hosts with `NODE_ENV=production`;
- no security headers or CSP (the admin UI could be clickjacked);
- a bot check that silently switches off in production;
- no error boundary, so one bad render blanked the site.

## 2. All issues discovered

Issues found during the audit are summarised here; the audit report has the full detail. The two items marked **NEW** were found during verification and implementation.

| ID | Severity | Issue | Outcome |
|---|---|---|---|
| SEC-01 | High | body-parser 2.3.0 DoS advisory (GHSA-27r3-jxmh-p828) | Fixed |
| SEC-02 | High | No security headers or CSP; framing allowed; `X-Powered-By` sent | Fixed |
| SEC-03 | High | Bot check silently off in production without `TURNSTILE_SECRET_KEY` | Fixed |
| SEC-04 | Medium | CORS `*` on every response | Fixed |
| SEC-05 | Medium | Sessions survive a password change | Fixed |
| SEC-06 | Medium | `?search=a&search=b` crashes (500); no length limit on `search` | Fixed |
| SEC-07 | Medium | No general API rate limit; limits can't be configured; no `Retry-After` | Fixed |
| SEC-08 | **High** (upgraded from Medium) | **NEW, confirmed in verification:** `TRUST_PROXY=1` never worked. Express read the string `"1"` as an IP address, so behind any proxy every visitor shared one rate-limit bucket. Originally logged as "no warning when TRUST_PROXY is unset". | Fixed |
| SEC-09 | Low | Weak `SESSION_SECRET` accepted; admin responses could be cached | Fixed |
| SEC-10 | Low | `.env.example` names the real Supabase project | Fixed |
| PRIV-01 | Info | Public names can be indexed; phone numbers are kept forever | Left to you (§4) |
| REL-01 | Medium | Malformed or oversized JSON returned 500 and logged a stack trace | Fixed |
| REL-02 | Low | Ids above INT4 returned 500 | Fixed |
| REL-03 | Medium | No process error handlers; shutdown not graceful | Fixed |
| REL-04 | Medium | Health check never touches the database; no request logs | Fixed |
| DB-01 | Medium | Tree integrity not enforced or checked; the CSV append trusts its generations | Fixed (checker and warning) |
| DB-02 | Medium | `db:reset` wipes whichever database `.env` points to, without asking | Fixed |
| DB-03 | Medium | No backup procedure (Supabase free tier) | Fixed (script); running it is up to you |
| DB-04 | Low | No index on `parent_child.child_id` | Left (P3) |
| DEP-01 | Medium | `nodemon` shipped to production; no `engines` field | Fixed |
| DEP-02 | High | Build fails or Prisma client isn't generated when `NODE_ENV=production` | Fixed |
| DEP-03 | Medium | No compression; hashed assets not cached long-term | Fixed |
| DEP-04 | Low | No CI | Fixed |
| PERF-01 | Medium | **NEW, found in verification:** each query takes about 4 network round trips through the transaction pooler (`pgbouncer=true`), so `/api/tree` took about 2–4 s from this machine. The session pooler measured about 6× faster. | Documented; needs your config change (§13) |
| FE-01 | High | No React error boundary | Fixed |
| FE-02 | Medium | Raw errors and `npm run dev` hint on the public error screen | Fixed |
| FE-03 | Medium | No fetch timeout; HTML responses shown as `SyntaxError` | Fixed |
| FE-04 | Medium | A tree reload could show the tree from before an admin's save | Fixed |
| FE-05 | Medium | Failed sign-out became an unhandled rejection | Fixed |
| FE-06 | Medium | Turnstile load failure left visitors stuck with no explanation | Fixed |
| FE-07 | Low | Comment review could show the wrong tab's comments | Fixed |
| FE-08 | Low | Leftover tween and timeout cleanups; double comment fetch on focus; no empty state; no OG meta tags | Left (P3) |

A bug was also found and fixed while building the DB-02 guard. A first version of the confirmation prompt exited with status 0 when you pressed Ctrl-D, so `&&` would have gone on to run the reset. It now cancels on anything except the word `reset`. This was tested under a pseudo-terminal: "no", an empty answer, Ctrl-D and Ctrl-C all exit 1, and only `reset` exits 0.

## 3. Issues fixed

Each issue was fixed in its own commit, which explains the reason in its message. Commits on `prod/readiness`, oldest first:

| Commit | Fixes |
|---|---|
| `55b33f3` | Audit report |
| `f5bd18e` | SEC-01, DEP-01, DEP-02 |
| `21b3c11` | SEC-02 |
| `a229da9` | SEC-03, SEC-08 (warning), SEC-09 (secret length) |
| `dfb437f` | FE-01, FE-02 |
| `0c2436d` | SEC-04 |
| `824881b` | SEC-05 |
| `200bb93` | SEC-06, REL-02 |
| `3b7bc19` | SEC-07 |
| `fb28030` | REL-01 |
| `39168d7` | REL-03 |
| `b035536` | FE-03, FE-04, FE-05, FE-06 |
| `159b539` | REL-04, SEC-09 (no-store) |
| `b1f8023` | DEP-03 |
| `1e04807` | DB-01 |
| `35d8219` | DB-02 |
| `b3f6298` | DB-03 |
| `01fbbc7` | FE-07 |
| `1a48a5f` | SEC-10 and documentation |
| `2b2e4be` | DEP-04 |
| `ca47839` | SEC-08 (the real bug) |
| `d35ddd6` | PERF-01 (documentation) |

## 4. Issues intentionally left unresolved

| Item | Why it's left | Recommendation |
|---|---|---|
| DB-04: index on `parent_child.child_id` | Needs `prisma db push` against your production database, which you should run yourself. With 132 rows it makes no measurable difference. | Add `@@index([childId])` the next time you change the schema. |
| Database `CHECK (parent_id <> child_id)` and generation rules | Needs a migration on production data. The API can't create bad links, and `npm run db:check` reports 0 problems. | Optional. Run `db:check` after any CSV import. |
| An audit trail of admin edits | Needs a new table: a feature, not hardening. | Worth adding if more admins join. |
| Revoking a single session on logout | Needs a server-side session table. A password change or rotating `SESSION_SECRET` already revokes sessions. | If a device is lost, change that admin's password. |
| Per-username login lockout | It would let anyone lock the owner out by guessing wrongly on purpose. The per-IP limit plus scrypt and a 10-character minimum is the safer trade-off. | None. |
| Shared rate-limit store | It only matters with several instances; a free tier runs one. | Use Redis if you ever scale out. |
| FE-08 cleanups | No visible effect. | Optional polish. |
| `minimatch` advisory (moderate) through `nodemon` | Dev-only, never shipped (`npm audit --omit=dev` shows 0). The only fix npm offers is downgrading nodemon. | Re-check when nodemon releases a new version. |
| **PRIV-01: search indexing and data retention** | **Your decision.** The site publishes the full names of living family members, and search engines can index them. Visitors' phone numbers are kept indefinitely. | If you'd rather the tree weren't findable on Google, ask me to add `<meta name="robots" content="noindex">` (one line). Consider deleting resolved comments after about 12 months. |

## 5. Security improvements implemented

- **Headers on every response** (`server/security.js`):
  - The CSP is `default-src 'self'`, with Cloudflare Turnstile's script and iframe allowed explicitly. It also sets `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`, plus `upgrade-insecure-requests` in production.
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy` and `Cross-Origin-Opener-Policy: same-origin`.
  - HSTS for 180 days in production, without `includeSubDomains`.
  - `X-Powered-By` is removed.
  - Checked in Chromium: there are no CSP violations across page load, navigation, search, the profile panel and the Turnstile widget.
- **Startup checks** (`server/config.js`):
  - Production refuses to start without `DATABASE_URL`, a `SESSION_SECRET` of at least 32 characters, and `TURNSTILE_SECRET_KEY` (unless `TURNSTILE_DISABLED=1` is set deliberately).
  - A rate-limit variable that isn't a positive whole number also stops startup.
  - A missing `TRUST_PROXY` produces a warning.
- **CORS:** off by default, because the UI is same-origin. Extra origins can be allowed with `CORS_ORIGINS`.
- **Sessions:**
  - Cookies carry an HMAC fingerprint of the password hash, checked on every request, so changing a password signs out every other session.
  - Old cookies are rejected once, so admins sign in again after this deploy.
- **Input checks:**
  - `search` must be a single string of at most 100 characters.
  - Every id must fit Postgres INT4.
- **Error handling:**
  - Mistakes in the request (bad JSON, a body that's too large) get 400 or 413 and aren't logged.
  - Server errors return a generic 500 and are logged on one line, with no query strings, request bodies or cookies.
  - Database errors are logged with the host but never the credentials (checked).
- **No caching of admin answers:** `/api/admin/*` sends `Cache-Control: no-store`, because those answers include visitors' phone numbers.
- **Proxy handling:** `TRUST_PROXY` is now parsed correctly (SEC-08).

## 6. Rate-limiting configuration

| Limit | Default | Environment variable | Scope | Window |
|---|---|---|---|---|
| Every `/api` request | 300 | `RATE_LIMIT_API_PER_MIN` | per IP | 1 minute, fixed window, bounded memory |
| Admin sign-in | 10 | `RATE_LIMIT_LOGIN_PER_15MIN` | per IP | 15 minutes, sliding |
| Visitor comments | 5 | `RATE_LIMIT_COMMENTS_PER_HOUR` | per IP | 1 hour, sliding |
| Comments from one phone number | 5 | (fixed) | per phone, counted in the database | 24 hours |
| `/api/health`, `/api/health/ready` | exempt | — | — | — |

- A blocked request gets `429` with a JSON `{ error }` and `Retry-After` in seconds.
- Counts are kept in memory, which suits one instance. They reset when the server restarts.
- **Behind a proxy, `TRUST_PROXY` must be correct**, or all visitors share one bucket. See §13 for how to check it.
- Tested on the production build with `TRUST_PROXY=1`: 45 rapid requests from one visitor gave 40 × 200 and 5 × 429 (`Retry-After: 42`), while a second visitor still got 200.

## 7. Database improvements

- **`npm run db:check`** (`prisma/integrity.js`, `check-integrity.js`) is **read-only**.
  - It reports dangling links, self-links, cycles (someone as their own ancestor), generation mismatches, people with no parent and people with more than two parents.
  - Run against the live database: **133 people, 132 links, no problems.**
  - The repository's seed data is checked in the unit tests.
- **`append-csv.js`** warns when a row's generation doesn't follow its parent's.
- **`npm run db:reset`** now asks first: it shows the target host and requires you to type `reset`. It refuses outright with `NODE_ENV=production` or without a terminal.
- **`npm run db:backup`** (`prisma/backup.js`) runs a read-only `pg_dump` of the `public` schema into `backups/`, which is gitignored. The password goes in `PGPASSWORD`, not on the command line.
- **Readiness check:** `GET /api/health/ready` runs `SELECT 1` with a 5-second timeout and returns 200 or 503.
- **Pooler recommendation (PERF-01):** see §8 and §13.

No schema changes were made, and **no data was written, changed or deleted**. The only queries against your database were `SELECT`s: the integrity check, the readiness check, and `GET /api/tree` and `/api/persons/:id` while browser-testing.

## 8. Performance improvements

| Change | Measured effect |
|---|---|
| gzip (`compression`) | Main JS bundle: 410 KB → 135 KB over the wire. CSS: 50 KB → about 10 KB. Large API answers are compressed too. |
| Caching | `/assets/*` files have content-hashed names, so they're served as `public, max-age=31536000, immutable`: repeat visits make no requests for them. `index.html` and the SPA fallback are `no-cache`, so a new deploy shows up immediately. |
| **Session pooler for `DATABASE_URL` (recommended, config only)** | Warm query: about **1.8 s → about 0.3 s**. `/api/tree`: about 2–4 s → about 0.4 s, measured from this machine, which is about 480 ms from the Sydney region. From a Singapore server the absolute times will be lower, but the ratio of about 4 round trips to 1 stays the same. |

I measured no rendering bottleneck worth changing at 133 people. Every tree routine is linear, cards are memoised, and the page has about 18 DOM nodes per person, so it should stay comfortable into the low thousands.

## 9. Frontend reliability improvements

- An **error boundary** catches render crashes and shows the same card design with "Reload the page". Checked in the browser with malformed data.
- The **load-failure screen** shows plain language in production; developer hints appear only in `npm run dev`. Checked with the API unreachable; "Try again" recovers.
- **Requests** time out after 60 seconds, which allows for a free-tier cold start. Network failures, timeouts and non-JSON answers all become friendly messages. A failed save keeps its "Your changes weren't saved" wording.
- A **stale tree reload** can no longer overwrite an admin's fresh save.
- A **failed sign-out** no longer becomes an unhandled rejection.
- If Cloudflare's check can't load (blocked or offline), the **comment form** explains why and how to fix it. The loader can also retry.
- The **comment review** list can't show another tab's comments.

## 10. Files modified

40 files changed (+2,260 / −126).

| Area | Files |
|---|---|
| **New, server** | `server/security.js`, `server/config.js`, `server/log.js` |
| **New, server tests** | `server/hardening.test.js`, `server/config.test.js`, `server/rateLimit.test.js` |
| **Changed, server** | `server/app.js`, `server/auth.js`, `server/rateLimit.js`, `server/validate.js`, `server/turnstile.js` (message text), `server/admin.test.js`, `index.js` |
| **New, database scripts** | `prisma/integrity.js`, `prisma/integrity.test.js`, `prisma/check-integrity.js`, `prisma/confirm-reset.js`, `prisma/backup.js` |
| **Changed, database scripts** | `prisma/append-csv.js` |
| **New, client** | `client/src/components/ErrorBoundary.tsx`, `client/src/api.test.ts` |
| **Changed, client** | `client/src/main.tsx`, `App.tsx`, `api.ts`, `hooks/useAdmin.ts`, `lib/turnstile.ts`, `components/Turnstile.tsx`, `CommentForm.tsx`, `CommentsReview.tsx`, `PersonForm.tsx` |
| **Build, config, docs** | `package.json`, `package-lock.json`, `client/package.json`, `client/package-lock.json`, `.env.example`, `client/.env.example`, `.gitignore`, `README.md`, `.github/workflows/ci.yml`, `PRODUCTION_READINESS_AUDIT.md` |

**Visual and design changes:** none to the layout, colours, typography or animation.
- The two error screens reuse the existing card exactly.
- Two new pieces of text appear: the "Something went wrong" crash card, and one line in the comment form when Cloudflare's check can't load.

**API compatibility:**
- Every existing endpoint and response shape is unchanged.
- `GET /api/health/ready` is new.
- Behaviour changes, each documented:
  - Cross-origin browser calls are no longer allowed unless listed in `CORS_ORIGINS`.
  - Admins must sign in once after this deploy.
  - Requests that used to return 500 now return 400 or 413.

## 11. New dependencies and why

| Package | Type | Why |
|---|---|---|
| `compression` ^1.8.2 (expressjs) | production | gzip for the 410 KB bundle and API answers. It's the standard Express middleware, and its only dependencies are small, long-standing packages. |

**Moved:** `nodemon` went from dependencies to devDependencies. **Updated:** body-parser 2.3.0 → 2.4.0 (lockfile only, within Express 5's range). Nothing else was added. Security headers, rate limiting, logging and configuration checks are all written in-house, in under 250 lines.

## 12. Tests executed and actual results

Every result below comes from a command run during this session.

| Check | Command | Result |
|---|---|---|
| Backend tests (API, security, config, limiter, sessions, integrity, seed) | `npm test` | **76/76 pass** (was 35) |
| Client tests | `npm --prefix client test` | **22/22 pass** in 5 files (was 16) |
| Lint | `npm --prefix client run lint` | clean, exit 0 (I confirmed oxlint does flag problems with a probe file) |
| Typecheck and production build | `npm --prefix client run build` | pass; JS 409 KB, 137 KB gzipped |
| Production install audit | `npm audit --omit=dev` (root and client) | **0 vulnerabilities** |
| Full audit including dev tools | `npm audit` | 2 moderate (minimatch via nodemon, dev-only) |
| Clean-clone build as a host would run it | `NODE_ENV=production npm ci --include=dev && npm run build` | pass |
| CI steps in the clean clone | tests, lint, audits | all pass |
| Production refuses bad configuration | `NODE_ENV=production node index.js` with no secrets | exit 1, listing every missing setting |
| Graceful shutdown | SIGTERM to a running server | logged; exit 0 |
| Live database: integrity | `npm run db:check` | 133 people, 132 links, 0 problems |
| Live database: readiness | `GET /api/health/ready` | `{"ok":true,"database":"up"}` |
| Database down (unreachable host) | production server against `127.0.0.1:1` | `/api/health` 200, `/ready` 503, `/api/tree` generic 500, page still served, process stays up, no credentials in logs |
| Headers, CSP, HSTS, gzip, caching, CORS | curl against the production build | as specified in §5 and §8 |
| Invalid and hostile requests | curl | malformed JSON → 400, 30 KB body → 413, form POST → 415, array or long search → 400, huge id → 400, unknown person → 404, invalid comment → 400 (nothing written), admin routes signed out or with a forged cookie → 401, unknown route → 404 |
| Excessive requests | 45 rapid requests from one visitor (limit set to 40) | 40 × 200, 5 × 429 with `Retry-After`; another visitor unaffected |
| Browser, desktop 1366 px | Playwright on the production build with real data | tree loads; generation nav, search, profile (parent, siblings, children, line of descent) work; Turnstile renders and passes with the test key; **0 console messages, no CSP violations** |
| Browser, failure paths | API aborted; malformed data | friendly load-error card and "Try again" recovery; error boundary card shown |
| Browser, phone 390 px and tablet 820 px | Playwright | layout unchanged, no horizontal overflow, the generation dock works, 0 console messages |
| Reset guard | pseudo-terminal: no, empty, Ctrl-D, Ctrl-C, reset | only `reset` lets the reset proceed (exit 0); everything else exits 1. The reset itself was never run. |

**Not executed:**
- Real admin writes and a real comment submission against your database (I wouldn't write to it).
- `pg_dump` (not installed here).
- The CI workflow on GitHub.
- Anything on the live host.

## 13. Remaining deployment blockers

There are no code blockers. **Before going public you must:**

1. **Set the production environment variables** (§14), above all `SESSION_SECRET` and the Turnstile keys. The server won't start without them, which is intended.
2. **Create the Turnstile widget** for your real hostname (for example `vanshavali.onrender.com` and any custom domain). Put its *site key* in `VITE_TURNSTILE_SITE_KEY` **before the build runs**, and its *secret* in `TURNSTILE_SECRET_KEY`. If they don't match, every comment fails.
3. **Check that the real visitor IP reaches the app (`TRUST_PROXY`).** After the first deploy, open the site and look at the host's logs. The `ip` in the `/api/tree` log line should be your own public IP, which you can look up by searching "what is my IP".
   - If it shows a private or proxy address instead, set `TRUST_PROXY=2` and check again.
   - If this is wrong, one visitor can lock everyone out of sign-in and comments.
4. **Take a first backup** (§16) before you announce the site.
5. **Recommended: switch `DATABASE_URL` to the session pooler** (§15). Without it the site works, but every tree load is several times slower.

## 14. Required environment variables

| Variable | Required? | Where | Value |
|---|---|---|---|
| `NODE_ENV` | **yes** | host | `production` |
| `DATABASE_URL` | **yes** | host | Supabase pooler URL. On a long-running host use the **session** pooler (§15). |
| `DIRECT_URL` | yes for CLI and backups | your machine | Supabase session pooler, port 5432 |
| `SESSION_SECRET` | **yes**, ≥32 characters | host | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TURNSTILE_SECRET_KEY` | **yes** (or `TURNSTILE_DISABLED=1`) | host | from the Cloudflare Turnstile widget |
| `VITE_TURNSTILE_SITE_KEY` | **yes**, read at **build** time | host build environment | the same widget's site key |
| `TRUST_PROXY` | yes behind a proxy (all PaaS hosts) | host | `1`; check it as described in §13 |
| `PORT` | set by the host | host | — |
| `CORS_ORIGINS` | no | host | leave unset |
| `RATE_LIMIT_API_PER_MIN` / `_LOGIN_PER_15MIN` / `_COMMENTS_PER_HOUR` | no | host | defaults 300 / 10 / 5 |
| `LOG_REQUESTS` | no | — | production logs requests already |
| `TURNSTILE_DISABLED` | no | host | `1` only to run without the bot check on purpose |

`.env` is gitignored and was never committed. Keep secrets only in the host's environment settings and your local `.env`.

## 15. Production configuration instructions (free hosting)

The recommended free setup is **Render (free web service) and Supabase (free)**. Everything runs as **one** service: Express serves both the UI and `/api` from one origin, which the `SameSite=Strict` admin cookie relies on. **Don't** split the frontend onto Vercel or Netlify; admin sign-in would break.

**Render web service settings:**

| Setting | Value |
|---|---|
| Region | **Singapore**, the closest Render region to your Supabase project in Sydney |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` (liveness). Use `/api/health/ready` only for an external uptime monitor; if the host checks it, a paused database would make the host restart a healthy server. |
| Node version | Taken from `engines` (≥ 20.19). If Render picks another, set `NODE_VERSION=22`. |
| Environment | the variables in §14 |

**Database URL for a long-running server:** use Supabase's session pooler with a small pool:
```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?connection_limit=5"
```
This is about 6× faster per query than the transaction pooler, which disables Prisma's prepared statements. Keep the transaction pooler (`:6543?pgbouncer=true`) only if you move to a serverless host.

**What to expect from the free tiers:**
- **Cold starts.** Render's free services sleep after a period without traffic, and the first visit then takes up to about a minute. The client's 60-second timeout allows for this; the visitor sees the "Opening the vanshavali" spinner. A paid instance or an external pinger avoids it.
- **Supabase pauses** inactive free projects. Check Supabase's current policy. `/api/health/ready` returning 503 is the sign; restore the project from the dashboard.
- **One instance.** Rate limits are in memory, which is correct for one instance.

**Custom domain:** add it in Render, then add the hostname to the Turnstile widget. HSTS turns on automatically in production.

**After this deploy:** every admin must **sign in again once**, because the session format changed.

## 16. Backup and recovery recommendations

- **What needs backing up:** admin edits, added children, admin accounts and visitor comments. The seed CSVs only restore the original 127 people.
- **How:**
  1. Install the PostgreSQL client tools once. On macOS: `brew install postgresql@17`; use the same major version as your Supabase server, or newer.
  2. Run `npm run db:backup`. It reads only and writes `backups/vanshavali-<date>.dump`.
  3. **Copy each dump off your laptop**, for example to a cloud drive.
- **When:** before launch, before any `db:append`, `add:member` or schema change, and weekly. Keep at least 4 weekly copies.
- **Restore** (this overwrites the tables, so check the target first):
  ```bash
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" backups/<file>.dump
  npm run db:rls      # re-apply RLS and the single-owner index
  npm run db:check    # confirm the tree is consistent
  ```
- **Practise a restore once** into a second free Supabase project, so you know it works before you need it.
- `npm run db:reset` now asks before wiping anything, but its target is still whatever `.env` points to. Keep backups current.

## 17. Step-by-step deployment checklist

**Before deploying**
- [ ] Review and merge `prod/readiness`. CI will run on the first push to GitHub.
- [ ] `npm run db:backup`, and copy the dump somewhere safe.
- [ ] `npm run db:check` shows no problems.
- [ ] Run `npm run db:rls` against production to make sure RLS and the single-owner index are applied (it's safe to run again). Optionally, confirm in the Supabase dashboard (Table Editor) that `person`, `parent_child`, `admin` and `comment` show **RLS enabled**.
- [ ] Generate `SESSION_SECRET`.
- [ ] Create the Cloudflare Turnstile widget for the Render hostname and any custom domain; note its site key and secret.
- [ ] Decide on PRIV-01: search indexing, and how long to keep comments.

**On Render**
- [ ] Create a free web service from the repository, in the Singapore region.
- [ ] Build command: `npm ci --include=dev && npm run build`. Start command: `npm start`. Health check: `/api/health`.
- [ ] Environment:
  - `NODE_ENV=production`
  - `DATABASE_URL` (session pooler, `?connection_limit=5`)
  - `SESSION_SECRET`
  - `TURNSTILE_SECRET_KEY`
  - `VITE_TURNSTILE_SITE_KEY`
  - `TRUST_PROXY=1`
- [ ] Deploy. The logs should show `listening`, with no `Configuration error`. A `Warning:` about TRUST_PROXY means it isn't set.

**After deploying**
- [ ] `https://<your-site>/api/health/ready` returns `{"ok":true,"database":"up"}`.
- [ ] Open the site: the tree loads, the generation nav works, search finds someone, and a profile opens.
- [ ] Check the response headers (`curl -I https://<your-site>/`): CSP, HSTS and `X-Frame-Options` are present.
- [ ] Check the real IP: the `ip` in the `/api/tree` log line matches your public IP. If not, set `TRUST_PROXY=2` and check again.
- [ ] Open a profile → "Tell the family admins": the Cloudflare check shows **Success** (not "For testing only"). Send one real test comment, then dismiss it in the admin review.
- [ ] Sign in at `/admin` as the owner (everyone signs in again once). Edit a test field and change it back; review the test comment.
- [ ] Optionally, change an admin's password and check that their other browser is signed out.
- [ ] Optionally, add an external uptime monitor on `/api/health/ready`, for example UptimeRobot (free).
- [ ] Back up weekly (§16).
