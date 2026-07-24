# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HireHub (branded "JobOrbit", live at joborbit.org) is a job-board web app: a public job board, an employer self-serve portal, and an admin panel, all served by one Express app backed by MySQL. A separate WhatsApp bot pipeline (`channel-forwarder/`) posts new jobs to WhatsApp channels/groups.

## Commands

```bash
npm install        # install server dependencies (run from repo root)
npm start           # run production server: node server/server.js
npm run dev         # run with nodemon auto-restart
```

There is no build step (plain server-rendered HTML/CSS/JS, no bundler) and no automated test suite or lint config in this repo — do not assume `npm test`/`npm run lint` do anything meaningful.

Database: MySQL 8+. `server/db/schema.sql` seeds only the original core tables (`admins`, `categories`, `jobs`, `settings`, `monetization`, `ad_placements`, `messages`) — the live schema has grown well beyond this file via ad-hoc `ALTER TABLE`s (e.g. `employers`, `employer_sessions`, `job_applications`, `redirects`, `admin_roles`, blog tables, `analytics_pageviews`/`analytics_events`, `jobs.sponsored_until`). **Treat `schema.sql` as a historical starting point, not the source of truth** — check the actual database or grep route files for the columns/tables they reference.

Channel-forwarder bot (separate Node project, own `package.json`):
```bash
cd channel-forwarder
npm install
node smart-cron.js   # posts active jobs to WhatsApp channel, pending jobs to a review group
node pair-link.js    # link WhatsApp via pairing code (no QR) instead of scanning
```
It loads env from a hardcoded VPS path (`/var/www/HireHub2/.env`) and expects `WHATSAPP_GROUP_ID`/`WHATSAPP_CHANNEL_ID` plus the same `DB_*` vars as the main server.

## Architecture

**Single Express app, three front-ends, one codebase:**
- `public/` — public job board (served at `/`), employer portal (`public/employer/`), misc calculator/checker tools (`public/tools/`), blog (`public/blog/`)
- `admin/` — admin panel, served statically at `/admin` with an SPA-style fallback (`app.get('/admin/*', ...)` returns `admin/index.html`)
- `server/` — Express app, routes, DB access

Everything is plain HTML/CSS/vanilla JS (no framework, no build step) — pages are static files that call the JSON API via `fetch`.

**Typography**: Lexend (display/headings) + Source Sans 3 (body) sitewide — public site, employer portal, and admin panel all load the same Google Fonts pair. (Previously Syne/DM Sans; changed across all three front-ends in one pass — if you see either of those names anywhere, it's a leftover that should be updated to match.)

**Request pipeline (see `server/server.js` top to bottom — order matters):**
1. `helmet` (CSP disabled) + `cors({origin:false})` + tiered rate limiting (`server/middleware/tieredRateLimit.js`: `globalLimiter` on all `/api/*` as a baseline, `publicFormLimiter`/`authenticatedLimiter` layered on top per route group; `server/middleware/authRateLimit.js` is a separate DB-backed per-IP+per-account exponential-backoff limiter used only by login/register/password-reset — a fixed-window limiter doesn't fit that case, and DB-backed is required since PM2 runs the app in cluster mode so an in-memory limiter wouldn't be shared across workers)
2. Body parsing, cookie-parser, MySQL-backed `express-session` (used by admin auth only)
3. `htmlLayout` middleware runs on every non-`/api` GET (see below)
4. A DB-driven redirect middleware (5-min in-memory cache, invalidated via `global._invalidateRedirectCache()`) checks the `redirects` table before falling through to routes
5. SEO routes (`sitemap.xml`, `feed.rss`, SSR `/job/:slug` for crawlers — a missing/expired job now returns a real `404`, not the SPA fallback), blog routes, admin-users, dynamic `/robots.txt` (DB-backed with static-file fallback), then `express.static` for `public/` and `admin/`
6. `/api/*` routers mounted
7. Admin SPA fallback, `/requirement/:batchId` share pages, then a catch-all that serves `public/index.html` (client-side routing for anything unmatched)

Three background jobs run on intervals from `server.js`: CV cleanup (daily, deletes CVs older than 30 days), analytics retention cleanup (daily, deletes tracking rows older than `ANALYTICS_RETENTION_DAYS`, default 180), and a job-expiry sweep (hourly — flips `jobs.status` from `'active'` to `'expired'` once `expires_at` passes; nothing else in the codebase checks that column, so without this sweep expired jobs stay live indefinitely).

**`server/middleware/htmlLayout.js`** is central to how pages are assembled — it is not just static file serving:
- Injects shared `public/partials/navbar.html`/`footer.html` into any HTML wherever `<!-- NAVBAR -->` / `<!-- FOOTER -->` comment markers appear, and hot-reloads those partials via `fs.watch` (edit once, every page updates, no restart)
- `injectMeta()` rewrites `<title>`, meta description, and OG/Twitter tags per-page using DB settings (`settings` table, keys like `meta_home_title`, `meta_home_desc`), cached 5 minutes (flush early via `POST /api/settings/flush-meta-cache`) — gated by `PAGE_META_KEYS` in this file, so any new static HTML page needs its meta keys added there to get per-page SEO metadata
- `injectAnalytics()` is separate and **unconditional** — GA4, the first-party tracking beacon (`/js/analytics.js`), and the `bing_verify`/`twitter_handle` meta tags are injected here regardless of `PAGE_META_KEYS`, so they land on every page under `public/` (including the employer portal), not just the 8 pages with custom meta. It's exported (`htmlLayout.injectAnalytics`) and reused directly by `blog-routes.js` and the manual `htmlLayout.inject()` call sites in `server.js` (`/requirement/:batchId`, the final catch-all), since those build their HTML outside the normal `tryNext()` static-file path. The SSR job-page in `seo.js` (`/job/:slug`) now also calls `htmlLayout.inject()` manually so it gets the real shared navbar/footer (with working nav + theme toggle) instead of its own bespoke header — but it still computes its own `ga4Script`/verification tags inline rather than calling `injectAnalytics()`, so GA4/meta changes there still need to be made in both places. The SEO-landing-page routes in the same file (`/aramco-jobs`, `/hse-jobs`, etc.) remain fully independent of `htmlLayout.js`, as originally documented.

**Two independent auth systems — do not confuse them:**
- Admin: `express-session` (MySQL-backed store) checked by `server/middleware/auth.js` (`requireAdmin`). Role/permission model lives in `admin_roles` (JSON `permissions` column), assigned per-admin and loaded into `req.session.permissions` at login (`server/routes/auth.js`).
- Employer: a bearer/cookie token (`emp_token` cookie or `x-employer-token` header) validated against the `employer_sessions` table by `server/middleware/employerAuth.js` (`requireEmployer`). `employer_sessions.remember_me` (bool) picks a 30-day vs 1-day session at login; `last_activity` tracks sliding expiry.

**Route responsibility split** (`server/routes/`): `jobs.js` (public job search/detail — full-text `MATCH...AGAINST`, `SQL_CALC_FOUND_ROWS` pagination), `admin.js` (admin job/category/upload CRUD, requires `requireAdmin` on the whole router), `admin-employers.js`/`admin-users.js` (admin management of employer accounts and admin sub-users), `employer.js` (employer self-serve: register/login/post jobs/applications — largest route file), `auth.js` (admin login), `settings.js` (site-wide key/value config used throughout), `seo.js` (sitemap/RSS/SSR — largest file, must stay registered before the SPA catch-all), `blog.js`/`blog-routes.js` (blog CMS + its own SEO routes), `redirects.js` (DB-backed redirect CRUD, must call `bustCache()` after writes so the server.js redirect cache picks up changes), `reviews.js`/`blacklist.js` (employer reviews & scam-reporting), `alerts.js` (email job-alert subscriptions + a 24h auto-digest scheduler started from `server.js`), `pdf.js` (Puppeteer-based PDF generation — conditionally loaded only when `PDF_ENABLED !== 'false'`, since Puppeteer isn't installed everywhere), `analytics.js`/`admin-analytics.js` (first-party page/event tracking — see below), `ads.js` (public feed for the Ad Placements zones — see Monetization below).

**Jobs can come from two sources**: legacy admin-created jobs (`employer_id IS NULL`) and employer-portal jobs (`employer_id` set). Nearly every public jobs query therefore joins `employers e` and filters `(j.employer_id IS NULL OR e.status = 'active')` so jobs from suspended/deleted employer accounts disappear without deleting the job rows — replicate this filter in any new public-facing job query.

**Dynamic job form**: `settings.form_schema_v2` (JSON) defines the public job-submission form fields, editable via `admin/form-builder.html`; submitted extra data is stored per-job as `jobs.extra_fields` (JSON).

**Uploads**: `multer` writes to `public/uploads/` (logos) and `uploads-private/cvs/` (CVs — outside the web root, served only via the authenticated `GET /api/employer/cv/:id` route, not as static files), with subfolders for blog images and employer assets excluded from git (see `.gitignore`). Uploaded images are validated by magic bytes (`server/utils/fileValidation.js`), not just extension/mimetype.

**Input validation**: `server/middleware/validate.js` is a shared zod-based middleware (`validate(schema, source)`) used across most public-facing routes — rejects malformed input outright rather than sanitizing it. New public endpoints should follow this pattern rather than hand-rolled checks.

**Monetization** (`monetization`/`ad_placements` tables, `admin/monetization.html`): `featured`/`sponsored` job flags each have an expiry column (`featured_until`, `sponsored_until`) enforced in every `jobs.js` query that grants priority ordering or section inclusion — a job past its expiry silently loses the boost, no cron needed for this part (the *job's own* expiry is handled by the hourly sweep mentioned above; these two columns are the *promotion's* expiry, independent of whether the job itself is still active). `show_featured`/`show_sponsored` (Settings → Section Visibility) are site-wide kill switches computed per-request in `jobs.js` via `getPromotionSql()` — when off, the feature is `(1=0)` in every query (not a bare `0` — MySQL treats a bare integer in `ORDER BY` as a positional column reference, not a constant). Ad Placements (`GET /api/ads`, public) feeds admin-authored `ad_code` per zone (`top`/`sidebar`/`between_jobs`/`footer`) into the corresponding container, injected client-side in `main.js` (`top`/`sidebar` also still require the older `show_banner_top`/`show_banner_side` settings) and in `footer.html`'s own script (footer zone — that partial is shared sitewide, unlike `main.js` which only loads on the homepage). The `between_jobs` zone backs **two** separate placements on the homepage that share the same admin toggle/`ad_code`: a static banner (`#ad-between-jobs`) sitting once between the "Job of the Day" section and the job grid, populated by `loadAds()` like `top`/`sidebar`; and a second, distinct in-grid slot (`#ad-inline-between-jobs`, deliberately a different id) shown every 6th job card, which `loadJobs()` recreates on every search/filter/sort/page change and re-populates via `injectInlineBetweenJobsAd()` since it can't be wired up once at load like the static zones. There is no payment gateway anywhere in this codebase — `monetization.price`/`duration_days` are reference numbers for manual/offline invoicing; checking Featured/Sponsored in Add/Edit Job pre-fills the expiry date from `duration_days` but doesn't charge anyone.

**Analytics** (`analytics_pageviews`/`analytics_events` tables, `admin/analytics.html`): a first-party alternative/complement to GA4. `public/js/analytics.js` is a small beacon (`navigator.sendBeacon`, falls back to `fetch(...,{keepalive:true})`) that posts a pageview on load plus a small allowlisted set of funnel events (`job_view`, `job_apply_submitted`, `search_performed`, `job_alert_subscribed`, `employer_registered`, `job_posted`) via `window.jbTrack(name, data)`. No cookies — a `visitor_hash` (sha256 of IP+UA+today's date+`SESSION_SECRET`) rotates daily, so `COUNT(DISTINCT visitor_hash)` approximates unique visitors without ever storing a cross-day identifier. Bot traffic is filtered both by nature (most bots don't execute JS) and server-side by UA regex (`server/utils/analyticsHelpers.js`). Scope is public site + employer portal, never the admin panel.

## Conventions to preserve

- All SQL uses `mysql2` parameterized queries (`?` placeholders) — never string-concatenate user input into SQL.
- Every route handler wraps its body in try/catch and responds `{ success: boolean, message?, ... }` — keep new endpoints consistent with this shape.
- `.backup`/`.bak` files (e.g. `server/server.js.backup`, `public/index.html.bak`) are manual snapshots left in the working tree, not build artifacts — leave them alone unless asked to clean them up.
- `.env` holds `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET`, `NODE_ENV` (and, for the WhatsApp bot, `WHATSAPP_GROUP_ID`/`WHATSAPP_CHANNEL_ID`). It's gitignored — never print or commit its contents.
- **Theme toggle (`#themeToggle`)**: `navbar.html` and `footer.html` each independently wire a click listener onto this same button (so pages work whichever partials they load), and `main.js`'s `bindEvents()` does too for the homepage. All three now check a shared `dataset.themeWired` guard before attaching — without it, a page loading more than one of these stacks duplicate listeners that toggle the theme back and forth on a single click, silently canceling out. Any new page/partial that wires this button must check the same guard.
- **Bootstrap's `.text-muted`/`.text-secondary` utility classes are not dark-mode-aware** — they're a fixed gray with no relation to this site's `data-theme` system. Use `var(--text-muted)`/`var(--text-secondary)` instead in new code. (`style.css` and `admin/css/admin.css` both carry a `[data-theme="dark"] .text-muted/.text-secondary` override as a safety net for existing uses, but that's a patch, not a reason to keep reaching for the Bootstrap classes.)
- `adminApi.get/post/put/del/patch` (`admin/js/admin.js`) reject on any non-2xx response or `{success:false}` body — they used to resolve normally on failed requests too, so a save could 401 (expired session) or hit a validation error and the calling page would still show a "Saved!" toast. Keep relying on `catch` blocks to surface real failures; don't reintroduce a bare `fetch(...).then(r => r.json())` that skips this check.


## Operational Rules (non-negotiable — decisions, not code)

- Workflow: local changes → git commit → push → VPS: `cd /var/www/HireHub2 && git pull origin main && pm2 restart all`. NEVER edit files directly on the VPS.
- All DB schema changes must be provided as commands for BOTH local AND VPS (`mysql -u jobuser -p hirehub`). This rule has been violated before and caused real damage.
- Windows local DB: MariaDB 12.3, full path `"C:\Program Files\MariaDB 12.3\bin\mysql.exe"`, user jobuser. Termux local: `mariadb -u jobuser -pHireHub2 hirehub`.
- WhatsApp pipeline: VPS crontab runs `run-smart.sh` every 5 minutes → `smart-cron.js`. Session lives in `cron-session/`. Relink with `node pair-link.js <phone-number>` (pairing code, single-phone friendly). Do NOT modify smart-cron.js or the crontab without explicit approval.
- `job-scraper` (server/jobs-scraper.js) is deliberately NOT running — output quality was poor. All jobs are manually uploaded. Do not re-enable. **Seeing `pm2 list` show "stopped" is not sufficient confirmation it's off** — it was found on 2026-07-24 to have a PM2-level `cron_restart: "0 0 * * *"` still attached (set outside the repo, not via an ecosystem file), silently running it daily at midnight and inserting scraped jobs despite the "stopped" display; `pm2 restart all` (the normal deploy step) also triggered it immediately as a side effect. Fixed by `pm2 delete job-scraper` + `pm2 save` (the VPS's `pm2-root` systemd service resurrects from the saved dump on reboot, so the delete had to be saved or it would have come back). If it ever reappears, check `pm2 show job-scraper` for a lingering `cron restart` field, not just its status.
- PM2 on VPS runs ONLY: HireHub2 (cluster ×2). The old `job-bot`/forwarder.js process was a zombie, deleted July 2026 (its 517MB log file was cleaned up 2026-07-24). `job-scraper` was fully removed from PM2 (not just left stopped) on 2026-07-24 — see above.
- Employer flow: register → status 'pending' → manual admin approval → email sent → can log in and post. Employers id=1 (Orbit) and id=2 (Orbit2) are test accounts.
- Correction to note above: `.bak`/`.backup` files are junk slated for cleanup (gitignored since July 2026), not snapshots to preserve.
- Never restart, stop, or delete PM2 processes without explicit user approval.