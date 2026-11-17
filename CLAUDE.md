# CLAUDE.md — Nusantara Play Backend

> There is **no** root `CLAUDE.md` above this repo (an earlier version of this file pointed to
> `../CLAUDE.md`, which does not exist). This file and `nusantara-play-fe/CLAUDE.md` are the project
> context. The sections from "Current direction" onwards are identical in both repos.

## Project Overview

NestJS 11 backend for Nusantara Play — a digital archive platform for Indonesian traditional
games and sports (PROT). Features JWT auth via Supabase, TypeORM + PostgreSQL, RBAC,
blockchain anchoring on Polygon (deprioritized), and AWS S3 file storage.

Other things in this repo: `blockchain/` (a separate Hardhat project with its own `package.json`),
`nginx/nginx.conf`, `Dockerfile`, `docker-compose.prod.yml`, `docs/`.

## Commands

```bash
npm run start:dev           # Start with hot reload (http://localhost:3000, API under /api)
npm run build               # Compile TypeScript (nest build -> dist/)
npm run lint                # ESLint + Prettier check, read-only (no --fix). Exits 1 while the lint baseline is not 0.
npm run lint:fix            # Same with --fix (modifies files!)
npm run format              # Prettier --write on src/**/*.ts and test/**/*.ts
npm test                    # Run all unit tests (jest); on this machine add -- --cacheDirectory D:/dev-cache/jest
npm test -- --testPathPattern=prot.service   # Run single test file
npm run test:int            # Integration tests (*.int-spec.ts) against the local nusantara_play_test (needs npm run db:up)
npm run test:e2e            # E2E tests — full AppModule against the local nusantara_play_test (needs npm run db:up). Env is forced to local test values.
npm run migration:run       # Run TypeORM migrations in src/migrations/*.ts (same DATABASE_* env vars and env files as the app)
npm run db:up               # Start local PostgreSQL 15 (docker-compose.dev.yml); also db:down, db:logs, db:reset -- --yes
npm run db:setup            # Local schema (entities) + migration baseline + daerah + DEMO seed; local _dev/_test DBs only. npm run seed = alias
```

## Git Workflow

This is a standalone git repo. Run all git commands directly — no need to `cd` first.

```bash
# Correct — plain git commands in this directory
git add src/modules/marketplace/order.service.ts
git commit -m "feat(marketplace): add order service"
```

Never chain navigation with git using `&&` — always run them as separate commands.

## Architecture

**All endpoints are under `/api` prefix** and protected by JWT by default.
- Use `@Public()` to expose a route without auth.
- Use `@Roles('admin_kpoti', ...)` for RBAC enforcement.
- Use `@CurrentUser()` to get the authenticated user in a controller.

**Auth flow**: Frontend gets a JWT from Supabase → sends `Authorization: Bearer <token>` →
`JwtStrategy` (`src/modules/auth/strategies/jwt.strategy.ts`) verifies it through Supabase's JWKS
endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, algorithm **ES256**, audience
`authenticated`). It does NOT use `SUPABASE_JWT_SECRET`; that value only configures an unused
`JwtModule` in `auth.module.ts`. On **every** authenticated request `validate()` fetches the user
from the Supabase admin API (service role key), syncs it into the local `users` table, and updates
`last_login_at`. If the Supabase call fails and the user is not in the DB, it creates a local user
with the default `publik` role (JIT sync).

**Module structure** (`src/modules/`):
- `auth/` — JWT strategy, Supabase client, change password
- `users/` — profile management, admin role assignment, admin-created users
- `prot/` — PROT CRUD + verification workflow (`verifikasi.service.ts`)
- `blockchain/` — Polygon anchoring via ethers.js (deprioritized)
- `events/` — event CRUD + registration
- `calendar/` — personal/team calendar, invites
- `daerah/` — hierarchical Indonesian regional data; all endpoints `@Public()`
- `storage/` — AWS S3 file uploads
- `audit/` — audit logging via `AuditInterceptor` (applied per controller with `@UseInterceptors`, currently in auth, nfts, prot and verifikasi controllers — it is NOT global)
- `marketplace/` — marketplace: toko, produk, order
- `nfts/` — NFT catalog
- `stats/` — landing page stats
- `notifications/` — SMTP email (admin-created user credentials)
- `supabase/` — shared Supabase admin client

**Common utilities** (`src/common/`):
- `decorators/` — `@Public()`, `@Roles()`, `@CurrentUser()`
- `guards/` — `JwtAuthGuard` (global), `RolesGuard`
- `filters/` — `HttpExceptionFilter` for consistent error responses
- Global `ThrottlerGuard`: 100 requests / 60 s.

**Database schema has two sources**:
- `src/migrations/*.ts` — TypeORM migrations, run with `npm run migration:run` (data source `src/config/typeorm.config.ts`).
- `src/database/migrations/*.sql` + `src/database/seeds/initial-data.sql` — raw SQL that the README says to run manually with `psql -f`.
They overlap (both create e.g. `verifikasi_status` and `verifikasi`) and cannot build a fresh DB. Local dev/test databases are therefore built from the entities by `npm run db:setup` (see "Local development").

## Domain Model

**PROT status workflow**: `DRAFT` → `DIKURASI` → `DIVERIFIKASI` → `ARSIP_NASIONAL` (with `REVISI` as returnable state)

**Roles** (stored in app DB, not Supabase):
| Role | Access |
|------|--------|
| `admin_kpoti` | Full access, publish to national archive, manage users |
| `kurator_daerah` | Input and edit PROT for their region |
| `pakar` | Verify/reject/request revisions on PROT |
| `publik` | Read-only (default for new users) |

**Marketplace order status**: `menunggu` → `dikonfirmasi` → `dikirim` → `selesai` (or `dibatalkan`)

## Key Conventions

- New DTOs must use `class-validator` decorators; global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true`.
- TypeORM entities live in `src/modules/<module>/entities/`.
- Migrations use timestamp filenames: `src/migrations/<timestamp>-<Name>.ts`. Run raw SQL inside `queryRunner.query()`.
- Ownership checks (ForbiddenException) go in the **service layer**, not guards.
- Use TypeORM transactions (`DataSource.createQueryRunner()`) for any multi-table write that must be atomic (e.g. order creation + stock decrement).
- For file uploads (multipart), the frontend uses raw `fetch` with `FormData` — do not set `Content-Type` manually.

## Env Vars

Loaded by `@nestjs/config` from `.env.local`, then `.env` (`src/config/config.module.ts`).

- App: `NODE_ENV`, `PORT`, `APP_NAME`, `FRONTEND_URLS` (comma-separated CORS origins; falls back to `FRONTEND_URL`)
- Database: `DATABASE_URL` (takes precedence) or `DATABASE_HOST` (default `localhost`), `DATABASE_PORT` (5432), `DATABASE_USER` (`postgres`), `DATABASE_PASSWORD`, `DATABASE_NAME` (`nusantara_play`); `DATABASE_SSL` (`'true'` = SSL with `rejectUnauthorized: false`). One builder, `src/config/data-source-options.ts`, is used by both the app (`src/database/database.module.ts`) and the migration CLI (`src/config/typeorm.config.ts`, which also loads `.env.local` then `.env`). The CLI alone still accepts the deprecated `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL` as a per-variable fallback and prints one warning; the app ignores `DB_*`. (`src/config/database.config.ts` still registers the same values under `database.*`, but nothing reads them any more.)
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_JWT_SECRET` and `SUPABASE_JWT_PUBLIC_KEY_JWK` are read into config but not used for token validation
- AWS: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `USER_CREDENTIAL_EMAIL_ENABLED`
- Blockchain: `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`, `BLOCKCHAIN_NETWORK`

`.env.example` lists all of the above with placeholders (Phase 02). `RATE_LIMIT_TTL` and `RATE_LIMIT_MAX` were removed from it: the code never read them (the throttler is hard-coded to 100 requests / 60 s in `app.module.ts`). Node version: `.nvmrc` (24).

## Current direction

1. We are building "Jelajah Nusantara": a lightweight 3D virtual world inside Nusantara Play. Users pick a province on a map of Indonesia, walk around a small village scene, interact with PROT objects (only PROT with status ARSIP_NASIONAL), meet other players (multiplayer), and earn rewards.
2. Rewards come in two currencies. XP gives levels and leaderboard rank and is never redeemable. Points will later be redeemable for in-platform rewards (marketplace vouchers, NFT badges). Points can never be cashed out to money and never transferred between accounts.
3. Golden rule for rewards: the browser is never trusted. The client only reports actions; the backend validates them and decides every reward. Every point change goes through an append-only ledger with server-built idempotency keys.
4. Authentication will be migrated away from Supabase to a self-hosted auth module in the NestJS backend (Argon2id passwords, RS256 JWT access tokens of 15 minutes, rotating refresh tokens in httpOnly cookies, Google OAuth). Until that phase is done, do not add any NEW dependency on Supabase.
5. Multiplayer will run on a separate realtime server (Colyseus, Node.js, TypeScript) in nusantara-play-be/realtime/, with one room per province.
6. Hardware target: a mid-range Android phone (4 GB RAM, Chrome). Performance budget: at least 30 fps, initial 3D download max 5 MB, max 8 MB per province, max 100k triangles and 100 draw calls per scene, textures max 1024x1024 and compressed, max 20 visible avatars per room. A 2D fallback must exist for weak devices.
7. Out of scope: open world, vehicles, combat, heavy physics, AI NPCs, day-night cycle, realtime shadows, detailed avatar editors, realistic graphics.
8. Blockchain anchoring is not a priority. Do not change blockchain/ or src/modules/blockchain/ unless a phase asks for it.

## Deployment facts

- Frontend: Vercel, https://nusantaralegacy.org (`www.` is a CNAME to the apex; `nusantaravirtual.org` points to the same Vercel IP).
- Production database: PostgreSQL, most likely on Supabase. Never connect to it from a dev machine.
- Production backend: **confirmed** (Phase 01) at `https://api.nusantaralegacy.org` (API under `/api`; IP 103.235.72.203, nginx/1.24.0 on Ubuntu in front of the NestJS app). The live frontend bundle has `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api` baked in. Hosting provider of that server is unknown. `nginx/nginx.conf` in this repo still uses `server_name api-nusantaraplay.kpoti.id`, which no longer resolves, so the repo nginx config does not match production.
- Production backend CORS: its allowlist contains `https://nusantaravirtual.org` but **not** `nusantaralegacy.org` (Phase 03: `Access-Control-Allow-Origin` is returned only for `Origin: https://nusantaravirtual.org`). **Nobody currently has access to that server**, so its CORS config, nginx config and env cannot be changed or inspected.
- Browser → backend: browser calls go to the same-origin path `/backend-api/*`, which a Vercel rewrite (frontend `next.config.ts`) proxies to `https://api.nusantaralegacy.org/api/*` (Phase 03). Server-side calls (server components, route handlers) go directly to `NEXT_PUBLIC_BACKEND_API_URL`.
- Local development database: PostgreSQL 15 in Docker (`nusantara-play-be/docker-compose.dev.yml`, container `nusantara-dev-db`, `127.0.0.1:5432`), databases `nusantara_play_dev` and `nusantara_play_test` (Phase 05). See "Local development".

## Local development

Both repos run fully locally against a disposable PostgreSQL (Phase 05). **Login does not work locally**
until the self-hosted auth phase: auth is still Supabase, and the local Supabase values are fake
(`https://supabase-placeholder.invalid`), so authenticated backend endpoints return 401 and the
frontend cannot sign in. Public pages and public endpoints work.

1. Database (in `nusantara-play-be`): `npm run db:up` starts `postgres:15-alpine` (container
   `nusantara-dev-db`, port bound to `127.0.0.1:5432`, volume `nusantara-dev-db-data`, local-only
   password `localdev`) and creates `nusantara_play_dev` and `nusantara_play_test` on first start.
2. Backend env: `cp .env.local.example .env.local` (fake placeholders only; never put real secrets there).
3. Schema and seed: `npm run db:setup` (`src/scripts/db-local-setup.ts`; `npm run seed` is an alias).
   Refuses unless the host is `localhost`/`127.0.0.1` and the database name ends with `_dev` or `_test`.
   Builds the schema from the entities, records all `src/migrations/` as applied, seeds daerah (34 provinsi,
   416 kabupaten, 98 kota, 7230 kecamatan, 74952 desa, 8487 kelurahan) and DEMO data (user
   `demo-kurator@example.test`, 3 PROT with status ARSIP_NASIONAL, 1 published event; names start with
   "DEMO"). Idempotent. Flags: `-- --database=<name>`, `-- --no-demo`.
4. Backend: `npm run start:dev` → http://localhost:3000/api. Blockchain vars stay empty, so
   BlockchainService logs a warning and is inactive.
5. Frontend (in `nusantara-play-fe`): `.env.local` with `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000/api`
   and placeholder Supabase values (see `.env.example`), then `pnpm dev` → http://localhost:3001
   (`/prot` shows the DEMO PROT).
6. Tests (backend): `npm test` (unit, no database), `npm run test:int` (`*.int-spec.ts`, real
   `nusantara_play_test`), `npm run test:e2e` (full AppModule on `nusantara_play_test`). Integration and
   e2e run the same setup logic as `db:setup` in a Jest global setup and force every env var to local test
   values (`test/test-env.ts`). Login-dependent e2e tests are skipped until the auth phase.
7. Reset: `npm run db:reset -- --yes` deletes the volume and starts an empty database; then `npm run db:setup`.
   `npm run db:down` stops the container and keeps the data; `npm run db:logs` follows the logs.

## Risks

- `/backend-api` proxy (Phase 03): Vercel runs external rewrites in its CDN/router, not in a Function. The proxied request timeout is **120 s** (`ROUTER_EXTERNAL_TARGET_ERROR` after that). Vercel documents **no request body limit** for external rewrites (the documented 4.5 MB limit is for Functions). Uploads above 4.5 MB through the proxy are therefore unverified on Vercel until a large upload is tested on a preview deployment. Locally `next start` proxied a 6 MB multipart body intact. The backend (repo nginx) allows 50 MB and has `proxy_read_timeout 60s`, so a slow large upload can still fail on that side.
- All browser API traffic now reaches the backend from Vercel's IP addresses. Vercel sets `X-Forwarded-For`/`X-Real-IP` to the visitor's IP, but whether production nginx/NestJS use them is unknown (no server access; the repo nginx has `limit_req` 10 r/s burst 20 per `$binary_remote_addr`, and NestJS has a global throttler of 100 requests / 60 s per IP without `trust proxy`). Per-IP rate limits could therefore hit many users at once (HTTP 429 or 503).
- Vercel CDN caching of proxied responses: projects created on or after 2026-04-06 honor upstream cache headers on external rewrites by default. `next.config.ts` sends `x-vercel-enable-rewrite-caching: 0` for `/backend-api/:path*` to turn that off. The backend currently sends no `Cache-Control` header.
- Same-origin cookies (including Supabase `sb-*` auth cookies) are now forwarded to the backend with every browser API call. Large cookie headers could exceed nginx header buffer limits (unknown production config).

## Engineering rules

- Before writing code, show a short plan and the list of files you will touch.
- Every phase ends with passing tests and a successful build. Add or update unit tests for every service you change.
- Lint rule: a phase must not add new lint errors in the files it touches.
- Ownership and permission checks live in the service layer and throw ForbiddenException.
- Any multi-table write that must be atomic uses a TypeORM transaction.
- Any read-then-write on a shared counter or claim (stock, queue claims, points) must be race-safe: use a conditional UPDATE or a pessimistic lock.
- Never log secrets, tokens, or passwords.
- If a requirement is ambiguous or conflicts with existing code, stop and ask instead of guessing.

## Lint baseline (after Phase 02)

Phases must not add lint errors in the files they touch. Counts below are the whole-repo baseline.

- Backend `npm run lint`: 406 errors, 30 warnings; `prettier/prettier` 0. Per rule: no-unsafe-member-access 174, no-unsafe-call 88, no-unsafe-assignment 84, no-unused-vars 29, no-unsafe-argument 27 (warn), unbound-method 13, no-unsafe-return 10, require-await 4, no-floating-promises 3 (warn), no-unsafe-enum-comparison 2, no-unnecessary-type-assertion 2 (all `@typescript-eslint/`).
- Backend after Phase 05: 240 errors, 30 warnings (`test/events.e2e-spec.ts` went from 214 to 48 errors; all new files are clean).
- Frontend `pnpm lint`: 44 errors, 87 warnings. Per rule: @typescript-eslint/no-unused-vars 47 (warn), @typescript-eslint/no-explicit-any 39, @next/next/no-img-element 26 (warn), react-hooks/exhaustive-deps 14 (warn), @typescript-eslint/no-empty-object-type 4, react-hooks/set-state-in-effect 1.

## Decisions log

- 2026-11-17: Blockchain work is deprioritized.
- 2026-11-17: Line endings are LF in both repos, enforced by `.gitattributes` (`* text=auto eol=lf`, common binary types marked `binary`). The working tree is LF even with a global `core.autocrlf=true` (Phase 02).
- 2026-11-17: Prettier was applied once to the backend (`src/`, `test/`) in Phase 02. Backend `npm run lint` is read-only; `npm run lint:fix` fixes. The frontend has no Prettier setup.
- 2026-11-17: The app and the migration CLI build their DB connection from one function, `src/config/data-source-options.ts` (DATABASE_* names, `.env.local` then `.env`). Deprecated `DB_*` names are a CLI-only fallback with a warning, so the app's behavior did not change (Phase 02, finding B9).
- 2026-11-17: pnpm build scripts (frontend): `pnpm-workspace.yaml` allows sharp and unrs-resolver with both `allowBuilds` (pnpm >= 10.26, 11, 12) and `onlyBuiltDependencies` (pnpm 10.x), plus `packages: ['.']` so pnpm 9 accepts the file. Verified `pnpm install --frozen-lockfile` with pnpm 9.15.9, 10.25.0, 10.34.9 and 12.14.0. Lockfile stays `lockfileVersion: '9.0'` (Vercel uses pnpm 9 or 10 for it). No `packageManager` field for now (Phase 02).
- 2026-11-17: Frontend tests use Vitest 5 (`pnpm test` = `vitest run`, config `vitest.config.ts` with the `@/` alias, tests in `tests/**/*.test.ts`) (Phase 02).
- 2026-11-17: .superpowers/ and .claude/settings.local.json are no longer tracked and are git-ignored in both repos (Phase 02).
- 2026-11-17: Frontend dev server runs on port 3001 (`next dev -p 3001`), matching the backend's default CORS origin; the backend uses 3000 (Phase 02).
- 2026-11-17: Browser API calls in production go through the same-origin Vercel rewrite `/backend-api/:path*` → `<BACKEND_ORIGIN>/api/:path*` (default `https://api.nusantaralegacy.org`), because the production backend's CORS allowlist lacks nusantaralegacy.org and nobody has server access. This replaces the `https://api.<hostname>/api` derivation (finding F3). Keep the proxy even after the server's CORS is fixed, unless a later phase decides otherwise (Phase 03).
- 2026-11-17: `/api/proxy-image` (finding F1) validates in `lib/security/image-proxy.ts`: https only, no credentials, default port, exact hostname allowlist `PROXY_IMAGE_ALLOWED_HOSTS` (default `lh3.googleusercontent.com`, the Google OAuth photo host; its only caller `components/dashboard/ProfileCard.tsx` proxies only Google URLs). The hostname is resolved once with `node:dns`; every address must be public (private, loopback, link-local, CGNAT, multicast, reserved IPv4; IPv6 outside 2000::/3 plus special ranges inside it), and the request goes out through `node:https` with a pinned `lookup`, so the socket connects to the validated addresses only (no DNS rebinding). No redirects (3xx = error), 5 s timeout, `image/*` except SVG (else 415), 5 MB cap while streaming, `nosniff` + `default-src 'none'; sandbox` CSP on every response, 24 h `Cache-Control` on success only, generic JSON errors. The route stays behind login (Phase 04).
- 2026-11-17: NFT `about` is rendered as plain text (`whitespace-pre-line`), never as HTML (finding F2). Do not reintroduce `dangerouslySetInnerHTML` for API data; the only allowed use is the static theme script in `app/layout.tsx` (Phase 04).
- 2026-11-17: `/about` is no longer a public route in `middleware.ts` (finding F5): no such page exists, so logged-out visitors are redirected to `/login` like any other unknown path. `isPublicPath` is exported for tests (Phase 04).
- 2026-11-17: Until a production schema dump is available, the TypeORM entities are the source of truth for the LOCAL schema (dev and test databases): `npm run db:setup` builds it with `DataSource.synchronize()`. A later phase compares a production dump with the entities. The production database is never touched (Phase 05).
- 2026-11-17: Migration baseline for local databases: after `synchronize()`, every migration in `src/migrations/` is inserted into the TypeORM `migrations` table as already applied (without running it), so `npm run migration:run` reports nothing pending and only NEW migrations run on top (Phase 05).
- 2026-11-17: Local PostgreSQL is pinned to `postgres:15-alpine` (README says PostgreSQL 15) until the production version is known (Phase 05).
- 2026-11-17: Local daerah seed reuses `src/database/migrations/002_replace_daerah_data.sql` (34 provinsi + 514 kab/kota, Kemendagri codes) and the `up()` of `src/migrations/1740500100000-SeedKecamatanKelurahanDesa.ts`; `1738826000000-SeedDaerahBPS.ts` is not used (12 provinces only, codes that do not match the kecamatan CSV) (Phase 05).

## Phase workflow

- Work happens in numbered phases. Each phase uses its own branch phase-XX-<short-slug>, created from the latest main.
- Do only what the phase prompt asks. Anything else you notice goes under "Out-of-scope observations" in the report.
- Every phase ends with a report at nusantara-play-be/docs/phase-reports/phase-XX.md that follows nusantara-play-be/docs/phase-reports/TEMPLATE.md, and the full report is printed as the final message.

## Local machine

Windows 11; repos live on drive D: (`D:/Project/Nusantara Legacy/`). C: has very little free space (~7.5 GB), so anything that takes disk space goes to D:.

- Before heavy work, check free space on C: and D:. If D: has less than 10 GB free, stop and tell the owner.
- Detect the shell first (Git Bash: `export`, PowerShell: `$env:`, cmd: `set`) and set these **session-only** variables for every command. Use forward slashes (`D:/...`):
  - npm cache (also used by npx): `npm_config_cache=D:/dev-cache/npm`
  - Temp files: `TEMP`, `TMP` and `TMPDIR` = `D:/dev-cache/tmp`
- pnpm: always pass `--store-dir D:/.pnpm-store` and a D: cache dir, otherwise pnpm writes its metadata cache to C:. **pnpm 12 has no `--cache-dir` flag** (it fails with a misleading "unexpected argument" error); use `--config.cache-dir=D:/dev-cache/pnpm-cache` (or env `pnpm_config_cache_dir=D:/dev-cache/pnpm-cache`). Also pass `--state-dir D:/dev-cache/pnpm-state`. Example:
  `pnpm install --frozen-lockfile --store-dir D:/.pnpm-store --config.cache-dir=D:/dev-cache/pnpm-cache --state-dir D:/dev-cache/pnpm-state`
  If pnpm complains that node_modules was linked from a different store, the frontend `node_modules` folder may be deleted and reinstalled. Delete nothing else.
- Jest: `npm test -- --cacheDirectory D:/dev-cache/jest`
- Create these folders if they do not exist.
- Do not change global settings (no `npm config set`, no `pnpm config set --global`, no edits to system or user environment variables) unless the owner asks.
- Docker Desktop's data stays on C: (`%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx`) by the owner's decision (Phase 05); the owner freed space there. Phases may pull images and start containers when the phase asks for it (for example `npm run db:up`). Stop only if C: has less than 5 GB free.
- Never connect to the production database. Local PostgreSQL uses port 5432 (Docker container `nusantara-dev-db`, bound to 127.0.0.1).
