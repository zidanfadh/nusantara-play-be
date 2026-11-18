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
- `audit/` — audit logging via `AuditInterceptor` (applied per route with `@UseInterceptors`, currently in auth, nfts, prot (incl. all media routes since Phase 06) and verifikasi controllers — it is NOT global). The stored request body goes through `redactSecrets()` (`audit/redact.ts`): keys like password/token/secret are stored as `[REDACTED]`.
- `marketplace/` — marketplace: toko, produk, order
- `nfts/` — NFT catalog
- `stats/` — landing page stats
- `notifications/` — SMTP email (admin-created user credentials)
- `supabase/` — shared Supabase admin client

**Common utilities** (`src/common/`):
- `decorators/` — `@Public()`, `@Roles()`, `@CurrentUser()`
- `guards/` — `JwtAuthGuard` (global), `RolesGuard`, `UserThrottlerGuard` (global)
- `filters/` — `HttpExceptionFilter` for consistent error responses; logs only name, message and stack of unexpected errors (never the whole exception object)
- `serializers/user-shape.ts` — `toPublicUser()` (public user shape) and `stripPrivateUserFields()` (Phase 06)
- `http/trust-proxy.ts` — Express `trust proxy` from `TRUST_PROXY`
- Global guards, in this order (`app.module.ts`, `APP_GUARD` with `useExisting`): `JwtAuthGuard`, then `UserThrottlerGuard` (100 requests / 60 s, tracked per user id when logged in, per `req.ip` otherwise). The order matters: the throttler needs `req.user`.

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
- Migrations use timestamp filenames: `src/migrations/<timestamp>-<Name>.ts`, hand-written raw SQL inside `queryRunner.query()`; follow "Migration rules" under Engineering rules.
- Ownership checks (ForbiddenException) go in the **service layer**, not guards.
- Use TypeORM transactions (`DataSource.createQueryRunner()`) for any multi-table write that must be atomic (e.g. order creation + stock decrement).
- For file uploads (multipart), the frontend uses raw `fetch` with `FormData` — do not set `Content-Type` manually.

## Env Vars

Loaded by `@nestjs/config` from `.env.local`, then `.env` (`src/config/config.module.ts`).

- App: `NODE_ENV`, `PORT`, `APP_NAME`, `FRONTEND_URLS` (comma-separated CORS origins; falls back to `FRONTEND_URL`), `TRUST_PROXY` (Express `trust proxy`, default `loopback`; `"true"`/`"false"`, a hop count, or names/addresses/subnets such as `loopback, uniquelocal`; never `true`) (Phase 06)
- Database: `DATABASE_URL` (takes precedence) or `DATABASE_HOST` (default `localhost`), `DATABASE_PORT` (5432), `DATABASE_USER` (`postgres`), `DATABASE_PASSWORD`, `DATABASE_NAME` (`nusantara_play`); `DATABASE_SSL` (`'true'` = SSL with `rejectUnauthorized: false`). One builder, `src/config/data-source-options.ts`, is used by both the app (`src/database/database.module.ts`) and the migration CLI (`src/config/typeorm.config.ts`, which also loads `.env.local` then `.env`). The CLI alone still accepts the deprecated `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SSL` as a per-variable fallback and prints one warning; the app ignores `DB_*`. (`src/config/database.config.ts` still registers the same values under `database.*`, but nothing reads them any more.)
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_JWT_SECRET` and `SUPABASE_JWT_PUBLIC_KEY_JWK` are read into config but not used for token validation
- AWS: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `USER_CREDENTIAL_EMAIL_ENABLED`
- Blockchain: `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`, `BLOCKCHAIN_NETWORK`

`.env.example` lists all of the above with placeholders (Phase 02; `TRUST_PROXY` since Phase 06). `RATE_LIMIT_TTL` and `RATE_LIMIT_MAX` were removed from it: the code never read them (the throttler is hard-coded to 100 requests / 60 s in `app.module.ts`). Node version: `.nvmrc` (24).

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

### Pending deployment (backend, not yet on the production server)

Nobody has access to the production backend server yet. These backend changes are merged-ready but
NOT deployed. Frontend changes reach production through Vercel and are not listed here.

**Order matters: run the migration on the production database BEFORE the new backend code starts.**
The new `VerifikasiQueue` entity selects `verifikasi_queue.catatan_kurator`; old code ignores the
column, so running the migration first is safe for the old code too.

1. Migration `1795000000000-AddCatatanKuratorToVerifikasiQueue` (Phase 06, B7): adds one nullable
   `text` column `verifikasi_queue.catatan_kurator` (`ADD COLUMN IF NOT EXISTS`; down drops it).
2. Set `TRUST_PROXY` in the server env (Phase 06, P3). Default `loopback` fits Nest running directly on
   the host behind a host nginx. If production runs `docker-compose.prod.yml` (Nest in Docker, port
   published on `127.0.0.1:3000`), the peer is the Docker bridge gateway, so use `loopback, uniquelocal`.
3. Phase 06 backend fixes (all in the same release):
   - B1: PROT media routes (add/remove foto/video kegiatan, dokumen kurikulum, foto alat) check owner or
     admin_kpoti and status DRAFT/REVISI before any S3 call; removes save the DB before deleting from S3;
     media routes are audited.
   - B7: `POST /prot/:id/submit-kurasi` stores `catatan` as `catatan_kurator` on the queue entry; queue
     endpoints return it.
   - B4: race-safe marketplace stock (conditional UPDATEs in `create()` and `batalkan()`).
   - B5: race-safe verification queue claim/release (conditional UPDATEs).
   - P1: public endpoints return only the public user shape (events list/featured/detail, calendar
     item detail); other users' records lose `supabase_user_id` and `last_login_at`.
   - P2: no personal data in logs (PROT findAll, exception filter, SMTP errors); audit_log no longer
     stores passwords from `POST /auth/change-password`.
   - P3: rate limit per user id (anonymous per IP) and `trust proxy` from `TRUST_PROXY`.
   - P4: `avatar_url` must be an https URL of max 500 characters (null or empty clears it).

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
- All browser API traffic now reaches the backend from Vercel's IP addresses. Vercel sets `X-Forwarded-For`/`X-Real-IP` to the visitor's IP, but whether production nginx/NestJS use them is unknown (no server access; the repo nginx has `limit_req` 10 r/s burst 20 per `$binary_remote_addr`). Since Phase 06 (not yet deployed) the NestJS throttler limits logged-in users per user id; anonymous requests are still limited per `req.ip`, which behind Vercel is a Vercel egress IP shared by many visitors (Vercel IPs are not a stable published list, so they cannot be trusted as proxies). Per-IP limits (nginx `limit_req`, anonymous throttling) can therefore still hit many users at once (HTTP 429 or 503).
- Vercel CDN caching of proxied responses: projects created on or after 2026-04-06 honor upstream cache headers on external rewrites by default. `next.config.ts` sends `x-vercel-enable-rewrite-caching: 0` for `/backend-api/:path*` to turn that off. The backend currently sends no `Cache-Control` header.
- Same-origin cookies (including Supabase `sb-*` auth cookies) are now forwarded to the backend with every browser API call. Large cookie headers could exceed nginx header buffer limits (unknown production config).

## Engineering rules

- Before writing code, show a short plan and the list of files you will touch.
- Every phase ends with passing tests and a successful build. Add or update unit tests for every service you change.
- Lint rule: a phase must not add new lint errors in the files it touches.
- Ownership and permission checks live in the service layer and throw ForbiddenException.
- Any multi-table write that must be atomic uses a TypeORM transaction.
- Any read-then-write on a shared counter or claim (stock, queue claims, points) must be race-safe: use a conditional UPDATE or a pessimistic lock.
- Never log secrets, tokens, or passwords. Never log personal data either (email, phone, user ids next to them, request bodies with personal data); log through the Nest `Logger`, not `console`.
- Public endpoints only return the public user shape: a `@Public()` route returns other users ONLY as `{ id, full_name, avatar_url, institution }` (`toPublicUser()` in `src/common/serializers/user-shape.ts`). Logged-in endpoints that return OTHER users' records never include `supabase_user_id` or `last_login_at` (`stripPrivateUserFields()`); admin_kpoti user management keeps `last_login_at`. Add a test for every new endpoint that returns users.
- If a requirement is ambiguous or conflicts with existing code, stop and ask instead of guessing.

### Migration rules (Phase 06)

The local schema is built from the entities and differs from production (enum type names,
constraints, extra legacy tables), so migrations must not assume anything about existing objects.

- New migrations are hand-written raw SQL in `src/migrations/<timestamp>-<Name>.ts`. Never use
  `migration:generate`, and never run `synchronize` against anything except a local `_dev` or `_test` database.
- Migrations only ADD things (new tables, new nullable columns or columns with defaults, new indexes)
  and use `IF NOT EXISTS` where PostgreSQL allows it. They must not depend on the names of existing
  enum types or constraints, and must not alter or drop existing columns, types or constraints
  unless a phase explicitly asks for it.
- Every migration has a working `down()`.
- Every migration is tested locally: run it with `npm run migration:run` on the dev database after
  `npm run db:setup`, and revert it with `npm run migration:revert`. Note: `db:setup` records every
  migration in `src/migrations/` as already applied (and `synchronize()` has already created the
  column), so test in this order: `migration:revert` (down), `migration:run` (up), `migration:revert`,
  `migration:run`, checking the schema after each step.
- The entity is updated in the same commit, so local `synchronize()` and the migration produce the same column.

## Lint baseline (after Phase 02)

Phases must not add lint errors in the files they touch. Counts below are the whole-repo baseline.

- Backend `npm run lint`: 406 errors, 30 warnings; `prettier/prettier` 0. Per rule: no-unsafe-member-access 174, no-unsafe-call 88, no-unsafe-assignment 84, no-unused-vars 29, no-unsafe-argument 27 (warn), unbound-method 13, no-unsafe-return 10, require-await 4, no-floating-promises 3 (warn), no-unsafe-enum-comparison 2, no-unnecessary-type-assertion 2 (all `@typescript-eslint/`).
- Backend after Phase 05: 240 errors, 30 warnings (`test/events.e2e-spec.ts` went from 214 to 48 errors; all new files are clean).
- Backend after Phase 06: 237 errors, 30 warnings (no touched file gained errors; all new files are clean).
- Frontend after Phase 06: unchanged, 44 errors, 87 warnings.
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
- 2026-11-17: `/api/proxy-image` (finding F1) was hardened in Phase 04 (allowlist, DNS pinning, no redirects, size and type limits; details in the Phase 04 report). Removed in Phase 06 together with its only caller `components/dashboard/ProfileCard.tsx`, `lib/security/image-proxy.ts` and its tests, because nothing used them any more.
- 2026-11-17: NFT `about` is rendered as plain text (`whitespace-pre-line`), never as HTML (finding F2). Do not reintroduce `dangerouslySetInnerHTML` for API data; the only allowed use is the static theme script in `app/layout.tsx` (Phase 04).
- 2026-11-17: `/about` is no longer a public route in `middleware.ts` (finding F5): no such page exists, so logged-out visitors are redirected to `/login` like any other unknown path. `isPublicPath` is exported for tests (Phase 04).
- 2026-11-17: Until a production schema dump is available, the TypeORM entities are the source of truth for the LOCAL schema (dev and test databases): `npm run db:setup` builds it with `DataSource.synchronize()`. A later phase compares a production dump with the entities. The production database is never touched (Phase 05).
- 2026-11-17: Migration baseline for local databases: after `synchronize()`, every migration in `src/migrations/` is inserted into the TypeORM `migrations` table as already applied (without running it), so `npm run migration:run` reports nothing pending and only NEW migrations run on top (Phase 05).
- 2026-11-17: Local PostgreSQL is pinned to `postgres:15-alpine` (README says PostgreSQL 15) until the production version is known (Phase 05).
- 2026-11-18: Migration rules (see "Migration rules"): hand-written, additive-only raw SQL with `IF NOT EXISTS`, a working `down()`, tested locally with run/revert, entity updated in the same commit. Never `migration:generate`; `synchronize` only on local `_dev`/`_test` (Phase 06).
- 2026-11-18: The kurator's submission note (`POST /prot/:id/submit-kurasi`, `catatan`) is stored on the queue entry as `verifikasi_queue.catatan_kurator` (no existing column fit: `verifikasi.catatan` is the pakar's review note) (Phase 06, B7).
- 2026-11-18: Media edit rules for a PROT live in one helper, `PROTService.assertCanEditMedia()`, which `update()` also uses: owner or admin_kpoti (403), status DRAFT or REVISI (400). S3 objects are deleted only after the DB save; a failed S3 delete is logged (error name only) and the request still succeeds (Phase 06, B1).
- 2026-11-18: Shared counters and claims use conditional UPDATEs: stock (`stok >= :qty`), order cancel (`status IN (...)`), queue claim (`assigned_pakar_id IS NULL`), queue release (`assigned_pakar_id = :pakarId`). Order lines are merged per produk and processed in produk id order to avoid deadlocks (Phase 06, B4/B5).
- 2026-11-18: `assigned_at` on a queue claim is the app clock (a JS `Date` parameter), not SQL `now()`, to keep the existing `timestamp without time zone` convention (Phase 06, B5).
- 2026-11-18: Public user shape = `{ id, full_name, avatar_url, institution }`. Admin user management (GET/POST /users, GET /users/:id, PATCH role/status) hides `supabase_user_id` but keeps `last_login_at` for admin_kpoti (the admin user table shows it); kurator_daerah on GET /users/:id sees neither (owner decision, Phase 06, P1).
- 2026-11-18: Rate limiting: `UserThrottlerGuard` (global, after `JwtAuthGuard`) tracks `user:<id>` or `ip:<req.ip>`; Express `trust proxy` comes from `TRUST_PROXY` (default `loopback`) (Phase 06, P3).
- 2026-11-18: `audit_log.changes` stores the request body with secret-looking keys (password, token, secret, api key, authorization) replaced by `[REDACTED]` (Phase 06, P2).
- 2026-11-18: B2, B3, B6, B8 and B10 are deferred: blockchain is deprioritized, and B6/B10 are replaced by the self-hosted auth phase (Phase 06).
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
