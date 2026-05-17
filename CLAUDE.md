# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies (run once after clone)
npm install
npx playwright install chromium

# Build the CLI
npm run build                        # builds packages/cloner → packages/cloner/dist/
npm run build -w packages/cloner     # same, explicit workspace

# Run the cloner (after build)
node packages/cloner/dist/cli.js clone <url> [options]

# Start the web UI (browser-based clone + visual editor)
node packages/cloner/dist/cli.js serve [--port 3333] [--out ./output]

# Run during development (no build step needed)
cd packages/cloner && npx tsx src/cli.ts clone <url> [options]
cd packages/cloner && npx tsx src/cli.ts serve
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

## Architecture

This is an npm workspaces monorepo with two packages:

### `packages/cloner` — the CLI tool

Pipeline executed in sequence by `src/cli.ts`:

1. **`robots.ts`** — fetches and parses `/robots.txt` via `robots-parser`; aborts if disallowed
2. **`crawler.ts`** — BFS queue using `p-queue`; one Playwright `Browser`, N `BrowserContext`s per `--concurrency`; calls `capture.ts` per page; enqueues discovered same-origin links
3. **`capture.ts`** — per-page logic: intercepts all requests via `page.route()` to build a `NetworkEntry[]` log and download static assets; takes `page.content()` snapshot after `networkidle`; returns `PageRecord` + same-origin links
4. **`rewriter.ts`** — walks the captured HTML with `parse5`, rewrites asset URLs to `/_assets/<hash>.<ext>` and absolute same-origin links to relative paths
5. **`analyzer.ts`** — groups network entries by `(METHOD, normalizedPath)`, normalizes dynamic segments (`/users/123` → `/users/[id]`), emits `ApiRouteSpec[]`
6. **`generator.ts`** — renders Handlebars templates from `templates/` into the output Next.js project

### `packages/runtime`

Plain JS module (`src/replay.js`) that is copied verbatim into generated apps as `lib/replay.ts` via the `replay.ts.hbs` template. It reads fixture JSON files from the `fixtures/` directory.

### `packages/cloner/templates/`

Handlebars (`.hbs`) templates rendered by `generator.ts`. **Important:** JSX double-brace syntax (`style={{ }}`) conflicts with Handlebars — escape with `\{{` when needed inside templates. Current templates:

| Template | Emits |
|---|---|
| `page.tsx.hbs` | `app/[[...slug]]/page.tsx` — catch-all Next.js page |
| `route.ts.hbs` | `app/api/<route>/route.ts` — API stub per detected endpoint |
| `schema.prisma.hbs` | `prisma/schema.prisma` with models for form-like POST routes |
| `replay.ts.hbs` | `lib/replay.ts` — fixture loader |
| `package.json.hbs` | generated app's `package.json` |
| `next.config.js.hbs` | `next.config.js` |
| `tsconfig.json.hbs` | `tsconfig.json` |
| `Dockerfile.hbs` | `Dockerfile` |
| `docker-compose.yml.hbs` | `docker-compose.yml` |
| `README.md.hbs` | `README.md` |

### Key types (`packages/cloner/src/types.ts`)

- `PageRecord` — one captured page: url, route, rewritten html, assets[], network[]
- `Manifest` — full crawl output: targetOrigin, capturedAt, pages[]
- `ApiRouteSpec` — one detected API route: method, Next.js-style path, fixture key, inferred fields, `looksLikeForm` flag
- `AssetEntry` — originalUrl → localPath mapping
- `NetworkEntry` — intercepted request: method, url, postData, status, contentType, body

### Generated app layout

```
output/<site>/
├── app/[[...slug]]/page.tsx   # reads route-map.json, serves captured-pages/*.html
├── app/api/*/route.ts         # fixture-backed stubs
├── captured-pages/*.html      # one file per crawled page (safe filename)
├── fixtures/*.json            # one file per (route, method, status)
├── public/_assets/            # downloaded static assets, named <sha1-8>.<ext>
├── prisma/schema.prisma
├── lib/replay.ts
├── route-map.json             # { "/about": "__about__.html", ... }
└── manifest.json              # crawl metadata (HTML omitted to save space)
```

### Form/model detection heuristic (`analyzer.ts`)

A network entry is considered a form submission (`looksLikeForm = true`) when:
- method is POST
- has a non-null postData
- URL does not contain `/graphql` or `/api/auth`

Detected fields are inferred by JSON-parsing the postData; fallback to URLSearchParams. Each form route generates a Prisma model in `schema.prisma`.

### Safety constraints (hardcoded)

- Same-origin links only; cross-origin assets are downloaded but not crawled
- 250ms minimum delay between page navigations
- 30s per-page navigation timeout
- `User-Agent: CLONYFY/0.1 (+local archival)`
- robots.txt enforced by default
