# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies (run once after clone)
npm install
npx playwright install chromium

# Build the CLI (packages/cloner → packages/cloner/dist/)
npm run build

# Start the main web UI (listens on $PORT, default 5000)
npm start                    # or: node server.js

# Run the cloner CLI directly (after build)
node packages/cloner/dist/cli.js clone <url> [options]

# Run during development (no build step needed)
cd packages/cloner && npx tsx src/cli.ts clone <url> [options]
```

### CLI flags

| Flag | Default | Purpose |
|---|---|---|
| `--out <dir>` | `./output/site` | Output dir for generated Next.js project |
| `--max-pages <n>` | `50` | Page crawl cap |
| `--depth <n>` | `3` | BFS link depth |
| `--concurrency <n>` | `2` | Parallel Playwright browser contexts |
| `--ignore-robots` | off | Skip robots.txt check |

### Running a generated app

```bash
cd output/<site>
npm install
npx prisma db push   # only if prisma/schema.prisma has models
npm run dev          # → http://localhost:3000
```

## Environment Variables

The web server (`server.js`) requires these to be set in `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `ADMIN_PASSWORD` | Yes | Admin dashboard password — no default, login is disabled if unset |
| `PASSWORD_PEPPER` | Yes | Random secret mixed into all user password hashes — defaults to insecure hardcoded string; set before first user registers |
| `SHARE_PASSWORD_PEPPER` | No | Random secret for share link passwords — defaults to insecure hardcoded string |
| `PORT` | No | HTTP port (default 5000) |
| `APP_URL` | No | Public URL for email links; auto-detected on Vercel |
| `STRIPE_SECRET_KEY` | No | Enables Stripe payments |
| `STRIPE_PUBLISHABLE_KEY` | No | Sent to frontend for Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | No | Validates Stripe webhook signatures |
| `STRIPE_PRICE_*` | No | Price IDs per plan (STARTER, POPULAR, GROWTH, UNLIMITED, each × MONTHLY/YEARLY). Auto-created on first checkout if missing. |

**Stripe webhook events to enable** in the Stripe dashboard (`/api/stripe/webhook`):
`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.upcoming`

> `invoice.upcoming` fires 3 days before renewal (configurable in Stripe dashboard under "Subscriptions and emails"). This is what triggers the pre-renewal reminder email.
| `SMTP_HOST/PORT/USER/PASS` | No | Enables transactional email |
| `GOOGLE_CLIENT_ID/SECRET` | No | Enables Google OAuth |

## Architecture

This is an npm workspaces monorepo (`node 22.x`, ESM throughout):

```
/
├── server.js          # Main web UI + API backend (2,700+ LOC, vanilla JS)
├── db.js              # Supabase data-access layer (all DB calls go here)
├── templates/emails/  # 12 Handlebars email templates
└── packages/
    ├── cloner/        # CLI tool (TypeScript)
    │   ├── src/       # Pipeline source
    │   ├── templates/ # Handlebars templates for generated Next.js app
    │   └── dist/      # Build output (gitignored)
    └── runtime/       # replay.js — copied verbatim into generated apps
```

### Two separate servers

**`server.js`** is the product — it serves the web UI, manages users/subscriptions, and invokes the CLI pipeline via `child_process.spawn`. It is **not** the same as `packages/cloner/src/_server.ts`, which is a separate, unfinished alternative serve implementation.

**`packages/cloner/src/cli.ts`** exposes two subcommands: `clone` (run the pipeline once) and `serve` (lightweight dev server backed by `_server.ts`). The production deployment uses `server.js` directly, not the CLI `serve` subcommand.

### Clone pipeline (`packages/cloner/src/`)

Orchestrated by `runClone.ts` in sequence:

1. **`robots.ts`** — fetches and validates `/robots.txt`; throws if disallowed
2. **`crawler.ts`** — BFS queue via `p-queue`; one Playwright `Browser`, N `BrowserContext`s per `--concurrency`; calls `capture.ts` per page; enqueues discovered same-origin links
3. **`capture.ts`** — intercepts all requests via `page.route()` to build `NetworkEntry[]` and download static assets; two-pass render (second pass stubs CMS endpoints); forces lazy images; handles recursive CSS `url()` asset extraction; 100+ abort patterns for trackers/widgets
4. **`rewriter.ts`** — walks captured HTML with `parse5`; rewrites asset URLs to `/_assets/<sha1-8>.<ext>`; blanks live embeds; strips failed assets
5. **`analyzer.ts`** — groups `NetworkEntry[]` by `(METHOD, normalizedPath)`; normalizes dynamic segments (`/users/123` → `/users/[id]`); detects GraphQL; emits `ApiRouteSpec[]`
6. **`generator.ts`** — renders `packages/cloner/templates/*.hbs` into the output Next.js project

`runClone.ts` writes captured pages incrementally (one HTML file per page as each completes) so partial results survive a crash.

### Web server (`server.js` + `db.js`)

- **Auth:** password (SHA256+salt, bcryptjs if available) + Google OAuth; 30-day session tokens; rate-limited register (5/hr) and login (10/5min) per IP
- **Plans:** `free`, `starter`, `popular`, `growth`, `unlimited` (plus legacy `pro`/`enterprise`); limits enforced per `PLAN_LIMITS` map at line ~68
- **Stripe:** full subscription lifecycle, webhook handler, dunning/downgrade after 7-day grace period, usage-alert emails at 80% quota
- **Jobs:** clone jobs run as child processes; real-time progress streamed to client via SSE
- **DB layer:** all queries go through `db.js`; never import `@supabase/supabase-js` directly in `server.js`

### Templates

**`packages/cloner/templates/`** — rendered by `generator.ts` into the output Next.js app:

| Template | Output |
|---|---|
| `page.tsx.hbs` | `app/[[...slug]]/page.tsx` — catch-all route serving captured HTML |
| `route.ts.hbs` | `app/api/<route>/route.ts` — fixture-backed API stubs |
| `schema.prisma.hbs` | `prisma/schema.prisma` — models for detected form routes |
| `replay.ts.hbs` | `lib/replay.ts` — fixture loader |
| `layout.tsx.hbs` | `app/layout.tsx` |
| `package.json.hbs` | `package.json` |
| `next.config.js.hbs`, `tsconfig.json.hbs`, `Dockerfile.hbs`, `docker-compose.yml.hbs`, `README.md.hbs` | config files |

**Important:** JSX double-brace syntax (`style={{ }}`) conflicts with Handlebars — escape as `\{{` inside `.hbs` templates.

**`templates/emails/`** — Nodemailer templates: `_base.html` layout wrapper + 11 transactional templates (`verify-email`, `reset-password`, `clone-complete`, `payment-confirmed`, `payment-failed`, `renewal-reminder`, `downgraded`, `usage-alert`, etc.).

### Key types (`packages/cloner/src/types.ts`)

- `ClonerOptions` — CLI/API options passed into `runClone()`
- `PageRecord` — one captured page: `url`, `route`, `html`, `assets[]`, `network[]`, `failedAssets[]`
- `Manifest` — full crawl output: `targetOrigin`, `capturedAt`, `pages[]`
- `ApiRouteSpec` — detected API route: `method`, Next.js-style `path`, `fixtureKey`, `inferredFields`, `looksLikeForm`, optional `isGraphQL`/`graphQLOperation`
- `AssetEntry` — `originalUrl` → `localPath` mapping
- `NetworkEntry` — intercepted request: `method`, `url`, `postData`, `status`, `contentType`, `body`

### Generated app layout

```
output/<site>/
├── app/[[...slug]]/page.tsx   # reads route-map.json, serves captured-pages/*.html
├── app/api/*/route.ts         # fixture-backed stubs
├── captured-pages/*.html      # one file per crawled page
├── fixtures/*.json            # one file per (route, method, status)
├── public/_assets/            # downloaded assets, named <sha1-8>.<ext>
├── prisma/schema.prisma
├── lib/replay.ts
├── route-map.json             # { "/about": "__about__.html", ... }
└── manifest.json              # crawl metadata (html omitted)
```

### Form/model detection heuristic (`analyzer.ts`)

`looksLikeForm = true` when: method is POST, postData is non-null, URL doesn't contain `/graphql` or `/api/auth`. Each form route generates a Prisma model. Fields are inferred by JSON-parsing postData; fallback to URLSearchParams.

### Safety constraints (hardcoded)

- Same-origin links only; cross-origin assets downloaded but not crawled
- 250ms minimum delay between page navigations
- 30s per-page navigation timeout
- `User-Agent: CLONYFY/0.1 (+local archival)`
- robots.txt enforced by default; serverless mode uses tighter asset/page limits

## Known Issues

- **`packages/cloner/src/crawler.ts:325`** — pre-existing TypeScript error: unsafe cast of `window` to `Record<string, string[]>`; does not affect runtime
- **No integration/E2E tests** — unit tests exist (`npm test` in `packages/cloner`), but no browser/Playwright test suite
- **ES module `import()` calls inside downloaded JS files** — the replay patch intercepts `fetch`/XHR/beacon and injects an importmap for `<script type="module">` but cannot rewrite static `import '...'` statements already baked into bundled JS files pointing to the original CDN
