# CLAUDE.md — Nusantara Play Backend

> There is **no** root `CLAUDE.md` above this repo (an earlier version of this file pointed to
> `../CLAUDE.md`, which does not exist). This file and `nusantara-play-fe/CLAUDE.md` are the project
> context. The sections from "Current direction" onwards are identical in both repos.

## Project Overview

NestJS 11 backend for Nusantara Play — a digital archive platform for Indonesian traditional
games and sports (PROT). Features JWT auth (self-hosted RS256 tokens since Phase 07, legacy Supabase
tokens still accepted), TypeORM + PostgreSQL, RBAC,
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
npm run auth:generate-keys  # Print a NEW RS256 key pair, key id and the matching .env lines (writes nothing to disk)
npm run rewards:reconcile   # Recompute reward balances and levels from reward_ledger; report only. -- --fix rewrites them (Phase 15)
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

**Auth flow** (Phase 07): `JwtAuthGuard` reads `Authorization: Bearer <token>` and tries two passport
strategies in order:
1. `local-jwt` (`src/modules/auth-core/strategies/local-jwt.strategy.ts`): our own RS256 access tokens
   (`TokenService`, keys from `JWT_*`). Verifies signature, `kid`, `iss`, `aud`, `exp`, loads the user by
   `sub` (= users.id) and rejects unknown, `suspended` and `inactive` users. Since Phase 09 it also rejects a
   token whose `iat` is more than 5 s (`PASSWORD_CHANGE_SKEW_MS`) before `user_credentials.password_changed_at`.
   One read-only query (users LEFT JOIN user_credentials LEFT JOIN email_verifications, `email-verification.ts`)
   that also yields "email verified"; that state is attached to `req.user` under a symbol (never serialized).
   No Supabase call, no database write. Without keys (local auth disabled) every token simply fails here.
2. `supabase-jwt` (LEGACY, `src/modules/auth/legacy/supabase-jwt.strategy.ts`), only while
   `AUTH_ACCEPT_SUPABASE_TOKENS` is true (default). Unchanged behavior, described below.

**Self-hosted login** (Phase 08, `src/modules/auth-core/local-auth.controller.ts` + `local-auth.service.ts`),
all under `/api/auth` (browser path `/backend-api/auth/*` in production, `/api/auth/*` locally):
- `POST /register` `{email, password, full_name}` → always 201 with the same generic body, no tokens. Creates
  `users` (publik, active, no Supabase id) + `user_credentials` (Argon2id) in one transaction only if NO user
  has the email; an existing account (Supabase-only included) is never changed. Since Phase 09 the hooks
  `onRegistered` / `onDuplicateRegistration` queue the verification email or the "akun Anda sudah ada" email
  (background; the response is unchanged).
- `POST /login` `{email, password}` → 200 `{ accessToken, expiresIn, user }` (`user` = the same object
  `GET /api/users/me` returns) + cookies. Generic 401 for unknown email (dummy Argon2 verify), wrong password,
  locked account and users without `user_credentials`; generic 403 for suspended/inactive users (only after a
  correct password). Wrong passwords increment `failed_login_count` atomically in SQL and lock the account for
  `LOGIN_LOCK_MINUTES` once the count reaches `LOGIN_MAX_FAILED`. Success resets the counter, rehashes legacy
  hashes to Argon2id, updates `last_login_at`, starts a new refresh token family.
- `POST /refresh` (cookie + CSRF) → rotates the cookie, 200 like login, updates `last_login_at`. 409
  `{"error":"refresh_conflict"}` keeps the cookies; 401 `invalid_refresh_token` clears both. A user who is no
  longer active loses the family (401).
- `POST /logout` (CSRF) → revokes the cookie's family if valid, always clears both cookies, 204.
- `POST /logout-all` (access token + CSRF) → revokes every refresh token of the user, clears cookies, 204.
- `POST /change-password` (access token; `AuthController`): users WITH `user_credentials` → local change
  (same lockout rules, Phase 07 policy, `password_changed_at`, all refresh tokens revoked except the current
  family when the request carries its cookie, which then also needs the CSRF headers), 204. Users without →
  the legacy Supabase flow exactly as before (old validation incl. required `confirmPassword`, 201).
- Login and refresh answer 503 while local auth is disabled (no keys). Login and refresh responses carry
  `Cache-Control: no-store`.
- Cookies (`auth-core/auth-cookies.ts`): `np_refresh` (raw refresh token; httpOnly; Secure per
  `AUTH_COOKIE_SECURE`; SameSite=Lax; Path=`AUTH_COOKIE_PATH`; no Domain; Max-Age = `REFRESH_TOKEN_TTL_DAYS`)
  and `np_logged_in=1` (NOT httpOnly, same flags, Path=/, no secret; only for frontend redirects). Cleared with
  the same attributes. `cookie-parser` is installed in `main.ts`.
- CSRF (`src/common/guards/csrf.guard.ts`, `CsrfGuard`): `X-Requested-With: nusantara-play` AND an `Origin`
  in `FRONTEND_URLS` or fully matching a `FRONTEND_ORIGIN_PATTERNS` regex; otherwise 403.
- Throttling: `/login` and `/register` 30 / min, `/refresh` 60 / min per tracker (`@Throttle` on the
  default throttler), plus `LoginEmailLimiter`: 10 login attempts per normalized email per 15 minutes (429),
  counted in the in-memory throttler storage. See Risks.
- Emails are trimmed + lower-cased; lookups use `LOWER(email) = LOWER(:email)` (no unique index on
  lower(email)); several matches → refused (generic error) with a warning that contains no email.
- `user` in the login/refresh body and `GET /api/users/me` carry `emailVerified` (boolean) since Phase 09.

**Email verification and password reset** (Phase 09, `auth-core/email-flows.controller.ts` +
`email-flows.service.ts` + `auth-token.service.ts`), all `@Public()` under `/api/auth`, per-tracker limit 30 / min:
- One-time tokens in `auth_tokens` (32 random bytes, base64url, only the SHA-256 hash stored; `type`
  `email_verification` 24 h / `password_reset` 1 h). A new token deletes the user's older unused tokens of that
  type (advisory lock per user and type). Consuming = ONE conditional `UPDATE ... SET used_at = now() WHERE
  token_hash AND type AND used_at IS NULL AND expires_at > now() RETURNING user_id` (race-safe, single use).
- `POST /verify-email {token}` → 200 `{success, message}`; sets `user_credentials.email_verified_at`, or for an
  account without credentials inserts `email_verifications` (method `email_link`). Unusable token → 400
  `{code: "invalid_or_expired_token"}` (kept by `AuthErrorFilter`).
- `POST /resend-verification {email}` / `POST /forgot-password {email}` → always 200 with one fixed body each.
  The work runs in the BACKGROUND after the response (timing reveals nothing): exactly one matching account →
  new link (resend: only while unverified; forgot: any account, Supabase-only included); several matches →
  nothing + warning without the email. `EmailSendLimiter`: 3 emails per normalized address per hour per purpose
  (`verification` = registration emails + resend; `password_reset`), in-memory, over the limit the email is
  silently skipped (still 200).
- `POST /reset-password {token, newPassword}` → policy check, read-only token check, then ONE transaction:
  consume the token, upsert `user_credentials` (Argon2id, `password_changed_at`, `email_verified_at` if null,
  `failed_login_count = 0`, `locked_until = NULL`), revoke ALL refresh tokens (`password_reset`). Then the
  "password Anda telah diubah" email. A Supabase-only account gets local credentials this way (self-service
  migration). 200 `{success, message}`; unusable token → 400 `invalid_or_expired_token`.
- Emails (`notifications/auth-email.templates.ts`, Indonesian, text + HTML): verification, "akun sudah ada",
  password reset, "password telah diubah" (after reset and local change-password). Links:
  `{APP_PUBLIC_URL}/verify-email?token=...`, `{APP_PUBLIC_URL}/reset-password?token=...` (frontend pages come
  later). `EmailService.sendTransactional()` never throws and logs only error name/codes; nothing logs an
  address, a token or a link. `EmailFlowsService.whenIdle()` waits for queued email work (tests, shutdown).
- `@RequireVerifiedEmail()` (`common/decorators/`, guard + filter in `common/guards/verified-email.guard.ts`):
  403 `{code: "EMAIL_NOT_VERIFIED"}`; not applied to any route yet (Points will use it).
- `AuthCleanupScheduler` (daily 03:15): deletes refresh tokens expired > 7 days and email tokens used or expired
  > 7 days; logs only counts.

**Rewards** (Phase 15, `src/modules/rewards/`; the shared "Current direction" item 10 has the rules and decisions):
- `RewardsService.grant(userId, ruleCode, source, opts)` is the ONLY code that writes `reward_ledger` and
  `reward_balances`. One transaction: `pg_advisory_xact_lock` on a hash of the user id, idempotency keys built on the
  server (`reward-keys.ts`; never from client input), an existing key → the current result with `duplicate: true`, ledger
  rows + atomic balance increments + `levelForXp()` (`level.ts`, pure) in the same transaction. PROT_VIEW also inserts
  `user_prot_views` and checks the Paspor rule for the PROT's province in the same transaction (PASPOR_STAMP +
  `user_province_stamps`). Points: refused without a verified email (only the XP part is granted, `pointsWithheld`),
  `available_at = now + POINTS_HOLD_DAYS`. `grant-plan.ts` turns a rule into ledger rows (pure, unit-tested).
- `rewards.rules.ts`: every rule code, amount, the Paspor threshold, the activity types the browser may send, the
  activity throttle (60 / min) and the `POINTS_HOLD_DAYS` parsing. Change reward numbers ONLY there.
- `RewardsQueryService`: `/me`, `/me/ledger` (newest first, limit ≤ 50), `/me/paspor`, the leaderboard (top 50 +
  caller's rank, `toPublicUser()`, 60 s in-memory cache of the top 50 per scope). Controllers: `RewardsController`
  (`/api/rewards/*`, any logged-in role) and `AdminRewardsController` (`POST /api/admin/rewards/adjust`, admin_kpoti,
  `AuditInterceptor`; it inserts ADMIN_ADJUST rows through `RewardsService.adjust()`).
- Entities: `reward_ledger` (append-only, enforced by a database trigger), `reward_balances`, `user_prot_views`,
  `user_province_stamps` (migration `1795300000000-CreateRewardsLedger`; `db:setup` installs the trigger through its
  static `installDbObjects()`).
- Reconciliation: `reward-reconcile.ts` (`reconcileRewardBalances()`) + CLI `scripts/reconcile.ts`
  (`npm run rewards:reconcile`, `-- --fix`); same `DATABASE_*` env as the app; prints user ids only. Exit 0 clean or
  fixed, 1 differences without `--fix`, 2 failure. A stale `points_available_cache` is reported but is not a difference.
- Tests: unit `src/modules/rewards/__tests__/`, integration `test/integration/rewards.int-spec.ts` (trigger, races,
  reconciliation), e2e `test/rewards.e2e-spec.ts`. Manual curl walk-through: `docs/rewards-local-testing.md`.

Legacy Supabase path: Frontend gets a JWT from Supabase → sends `Authorization: Bearer <token>` →
`SupabaseJwtStrategy` verifies it through Supabase's JWKS
endpoint (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, algorithm **ES256**, audience
`authenticated`). It does NOT use `SUPABASE_JWT_SECRET` (the unused `JwtModule` that read it was removed in
Phase 08). On **every** authenticated request `validate()` fetches the user
from the Supabase admin API (service role key), syncs it into the local `users` table, and updates
`last_login_at`. If the Supabase call fails and the user is not in the DB, it creates a local user
with the default `publik` role (JIT sync).

**Module structure** (`src/modules/`):
- `auth/` — Supabase client, `POST /auth/change-password` (local accounts → `LocalAuthService`, Supabase accounts → legacy flow), legacy Supabase strategy in `auth/legacy/`
- `auth-core/` — self-hosted auth (Phase 07): `PasswordService` (Argon2id, legacy bcrypt verify, policy), `KeyService` + `TokenService` (RS256 access tokens, JWKS), `RefreshTokenService` (rotation, reuse detection, cleanup), `local-jwt` strategy, `GET /api/auth/jwks.json`, entities `user_credentials`, `refresh_tokens`, `auth_identities`. No Supabase dependency. Since Phase 08: `LocalAuthController` (register, login, refresh, logout, logout-all), `LocalAuthService`, `LoginEmailLimiter`, `AuthErrorFilter` (keeps the `error` code of refresh errors and the `code` of email-token errors), cookie helpers. Since Phase 09: `EmailFlowsController`/`EmailFlowsService` (verify-email, resend-verification, forgot-password, reset-password), `AuthTokenService`, `EmailSendLimiter`, `AuthCleanupScheduler`, entities `auth_tokens`, `email_verifications`, helpers `auth-users.ts` and `email-verification.ts`.
- `users/` — profile management, admin role assignment, admin-created users
- `prot/` — PROT CRUD + verification workflow (`verifikasi.service.ts`); since Phase 25 `AdminProtController` + `ProtAdminService` (`/api/admin/prot/:id/media/remove`, `/api/admin/prot/:id/revisi`, admin_kpoti, any status, own audit row; pending deploy)
- `blockchain/` — Polygon anchoring via ethers.js (deprioritized)
- `events/` — event CRUD + registration
- `calendar/` — personal/team calendar, invites
- `daerah/` — hierarchical Indonesian regional data; all endpoints `@Public()`
- `storage/` — AWS S3 file uploads. Every key is `<folder>/<randomUUID()>.<ext>` (`StorageService.uploadFile()`), so an
  upload never overwrites an object; keep it that way: the frontend caches optimized images for 31 days (Phase 14).
- `audit/` — audit logging via `AuditInterceptor` (applied per route with `@UseInterceptors`, currently in auth, nfts, prot (incl. all media routes since Phase 06), verifikasi and admin rewards (Phase 15) controllers — it is NOT global). The stored request body goes through `redactSecrets()` (`audit/redact.ts`): keys like password/token/secret are stored as `[REDACTED]`.
- `marketplace/` — marketplace: toko, produk, order
- `nfts/` — NFT catalog
- `stats/` — landing page stats (`GET /stats/landing`; since Phase 18 PROT and province counts are published-only, ARSIP_NASIONAL)
- `notifications/` — SMTP email (admin-created user credentials; Phase 09 auth emails via `sendTransactional()` + `auth-email.templates.ts`)
- `supabase/` — shared Supabase admin client
- `rewards/` — XP and Points ledger, balances, levels, PROT views, Paspor stamps, leaderboard, admin adjust, reconciliation (Phase 15; see "Rewards" above)

**Common utilities** (`src/common/`):
- `decorators/` — `@Public()`, `@Roles()`, `@CurrentUser()`, `@RequireVerifiedEmail()` (Phase 09)
- `guards/` — `JwtAuthGuard` (global; tries `local-jwt`, then legacy `supabase-jwt`; since Phase 08 a second run in the same request, e.g. from `@UseGuards(JwtAuthGuard, RolesGuard)`, reuses the first result), `RolesGuard`, `UserThrottlerGuard` (global), `CsrfGuard` (Phase 08, cookie-based auth endpoints), `VerifiedEmailGuard` + `EmailNotVerifiedFilter` (Phase 09, used through `@RequireVerifiedEmail()`)
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
- Self-hosted auth (Phase 07, parsed by `src/config/auth.config.ts`): `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` (PEM, base64-encoded on one line; a raw PEM also works), `JWT_KEY_ID`, `JWT_ISSUER`, `JWT_AUDIENCE` (all five required, otherwise local auth is disabled with one startup warning and the app still boots), `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_DAYS` (30), `REFRESH_REUSE_GRACE_SECONDS` (20), `AUTH_ACCEPT_SUPABASE_TOKENS` (default true; `false`/`0`/`no`/`off` turn the legacy path off). Phase 08: `AUTH_COOKIE_PATH` (default `/backend-api/auth`; `.env.local.example` uses `/api/auth`; must start with `/`), `AUTH_COOKIE_SECURE` (`true`/`false`; empty = true only when `NODE_ENV=production`), `FRONTEND_ORIGIN_PATTERNS` (comma-separated regular expressions, full match, case-insensitive; empty by default; extra allowed Origins for the CSRF check, meant for Vercel preview domains), `LOGIN_MAX_FAILED` (5), `LOGIN_LOCK_MINUTES` (15). Phase 09: `APP_PUBLIC_URL` (frontend base URL for email links; http(s), no query; trailing slash removed; unset or invalid = verification and reset emails are not sent; production `https://nusantaralegacy.org`), `EMAIL_VERIFICATION_TTL_HOURS` (24), `PASSWORD_RESET_TTL_MINUTES` (60)
- Rewards (Phase 15): `POINTS_HOLD_DAYS` (default 7; integer 0 to 365, anything else falls back to 7): days new Points stay on hold before they become redeemable
- AWS: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `USER_CREDENTIAL_EMAIL_ENABLED` (only for admin-created credentials; the Phase 09 auth emails need just `SMTP_HOST` + `SMTP_FROM`). Local: Mailpit (`SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, no user/password, `SMTP_SECURE=false`)
- Blockchain: `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`, `BLOCKCHAIN_NETWORK`

`.env.example` lists all of the above with placeholders (Phase 02; `TRUST_PROXY` since Phase 06; auth vars since Phase 07; cookie/CSRF/lockout vars since Phase 08; `APP_PUBLIC_URL` and the link lifetimes since Phase 09; `POINTS_HOLD_DAYS` since Phase 15, also in `.env.local.example`). `RATE_LIMIT_TTL` and `RATE_LIMIT_MAX` were removed from it: the code never read them (the throttler is hard-coded to 100 requests / 60 s in `app.module.ts`). Node version: `.nvmrc` (24).

## Current direction

1. We are building "Jelajah Nusantara": a lightweight 3D virtual world inside Nusantara Play. Users pick a province on a map of Indonesia, walk around a small village scene, interact with PROT objects (only PROT with status ARSIP_NASIONAL), meet other players (multiplayer), and earn rewards.
2. Rewards come in two currencies. XP gives levels and leaderboard rank and is never redeemable. Points will later be redeemable for in-platform rewards (marketplace vouchers, NFT badges). Points can never be cashed out to money and never transferred between accounts.
3. Golden rule for rewards: the browser is never trusted. The client only reports actions; the backend validates them and decides every reward. Every point change goes through an append-only ledger with server-built idempotency keys.
4. Authentication is being migrated away from Supabase to a self-hosted auth module in the NestJS backend (Phase 07 = foundation, Phase 08 = login/register/refresh endpoints and cookies, later Google OAuth). Until the migration is done, do not add any NEW dependency on Supabase. Design (Phase 07):
   - Passwords: Argon2id via `@node-rs/argon2` (prebuilt binaries, no install scripts; works on Windows and node:alpine), memoryCost 19456 KiB, timeCost 2, parallelism 1. Legacy bcrypt hashes from Supabase are verified with `bcryptjs` and rehashed to Argon2id on the next successful login (Phase 08). Unknown emails are verified against a dummy Argon2 hash (`PasswordService.verifyDummy()`) so timing does not reveal accounts. Policy: 8 to 128 characters, not equal to the email (case-insensitive).
   - Access tokens: JWT, RS256, signed with `jose` (5.x, the CJS build that Jest can load), 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`, default 900). Claims `sub` (users.id), `role`, `iss`, `aud`, `iat`, `exp`, `jti`; header `kid`. Public key at `GET /api/auth/jwks.json` (404 while local auth is disabled).
   - Refresh tokens: 32 random bytes, base64url; only the SHA-256 hex hash is stored (`refresh_tokens.token_hash`); 30 days (`REFRESH_TOKEN_TTL_DAYS`); rotated on every use (conditional UPDATE `revoked_at IS NULL` in a transaction). Reuse of a revoked token revokes the whole family (`reuse_detected`) and returns 401, EXCEPT when the token was rotated less than `REFRESH_REUSE_GRACE_SECONDS` (default 20) ago: then 409 `refresh_conflict` without revoking (two tabs refreshing at once; the client retries once with the newer cookie).
   - Browser path: the frontend calls the backend through the same-origin Vercel rewrite `/backend-api/*`, so cookies set by the backend belong to the FRONTEND domain, and the browser-visible path of the auth endpoints is `/backend-api/auth/*` (cookie Path/Domain must be chosen for that; implemented in Phase 08).
   - Transition: `AUTH_ACCEPT_SUPABASE_TOKENS` (default true) keeps accepting Supabase tokens through the legacy strategy (`src/modules/auth/legacy/`). `JwtAuthGuard` tries our `local-jwt` strategy first, then `supabase-jwt`.
   - Safe without config: if any of `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KEY_ID`, `JWT_ISSUER`, `JWT_AUDIENCE` is missing (or the keys are invalid), local auth is disabled with one startup warning and the backend behaves exactly as before.
   - Endpoints (Phase 08, backend only; the frontend still signs in through Supabase until a later phase): `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`, and `/change-password` (local accounts locally, Supabase accounts through the unchanged legacy flow). Browser paths: `/backend-api/auth/*` in production, `/api/auth/*` locally. Login returns `{ accessToken, expiresIn, user }` (`user` = `GET /api/users/me`); the refresh token travels ONLY in a cookie. Register always answers 201 with the same body and never touches an existing account. Generic errors never reveal whether an email exists. Backend CLAUDE.md "Architecture" has the details.
   - Cookies (Phase 08): `np_refresh` = raw refresh token, httpOnly, Secure in production (`AUTH_COOKIE_SECURE`), SameSite=Lax, Path=`AUTH_COOKIE_PATH` (`/backend-api/auth` in production, `/api/auth` locally), host-only (no Domain: each frontend domain has its own session), Max-Age 30 days. `np_logged_in=1` = readable marker, same flags, Path=/, no secret; the frontend middleware may use it ONLY to decide redirects, never as proof of a session. Both are cleared with the same attributes.
   - CSRF (Phase 08): the cookie-based endpoints (`/refresh`, `/logout`, `/logout-all`, and `/change-password` when it reads the cookie) require `X-Requested-With: nusantara-play` and an `Origin` that is in `FRONTEND_URLS` or fully matches a regex in `FRONTEND_ORIGIN_PATTERNS` (Vercel previews); otherwise 403. The frontend must send that header on these calls.
   - Email flows (Phase 09): email verification (24 h link) and password reset (1 h link) with one-time tokens in `auth_tokens` (hash only, single use, a new link invalidates the older one), endpoints `POST /api/auth/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`; generic answers that never reveal an account; at most 3 emails per address per hour per purpose; Indonesian emails with links to `{APP_PUBLIC_URL}/verify-email?token=...` and `{APP_PUBLIC_URL}/reset-password?token=...` (the frontend pages are built in a later phase). Users may log in without a verified email; `emailVerified` is on `GET /api/users/me` and `@RequireVerifiedEmail()` (403 `EMAIL_NOT_VERIFIED`) is ready for Points. "Verified" lives in `user_credentials.email_verified_at` for accounts with a password and in `email_verifications` for accounts without one (Supabase-only now; Google-only accounts in Phase 10 write a row with method `google`). A password reset clears the lockout, revokes all refresh tokens and makes every access token issued more than 5 s before it invalid (also after change-password; the own session continues through its next refresh).
   - Self-service migration (Phase 09, owner decision): forgot-password works for EVERY account with that email, including Supabase-only accounts without local credentials; completing the reset creates their `user_credentials` (and marks the email verified), so the user can sign in with the self-hosted login from then on. The reset link proves ownership of the address.
   - Brute force (Phase 08): per-account lockout (`LOGIN_MAX_FAILED` 5 wrong passwords → locked `LOGIN_LOCK_MINUTES` 15, atomic counter in SQL), per-email limit (10 login attempts / 15 min, in memory), generous per-IP limits (login and register 30 / min, refresh 60 / min). See Risks.
5. Multiplayer will run on a separate realtime server (Colyseus, Node.js, TypeScript) in nusantara-play-be/realtime/, with one room per province.
6. Hardware target: a mid-range Android phone (4 GB RAM, Chrome). Performance budget: at least 30 fps, initial 3D download max 5 MB, max 8 MB per province, max 100k triangles and 100 draw calls per scene, textures max 1024x1024 and compressed, max 20 visible avatars per room. A 2D fallback must exist for weak devices.
7. Out of scope: open world, vehicles, combat, heavy physics, AI NPCs, day-night cycle, realtime shadows, detailed avatar editors, realistic graphics.
8. Blockchain anchoring is not a priority. Do not change blockchain/ or src/modules/blockchain/ unless a phase asks for it.
9. Visual track first (owner decision, Phase 10): the boss needs something visual soon, so the frontend-only visual phases
   (V1 hub map, V2 province scene, ...) come before the remaining backend work (Google login, deployment), which continues
   afterwards. Visual phases reach users through Vercel only.
   - Pilot province: **Sumatera Selatan** (kode `16`, slug `sumatera-selatan`). It has **0 public PROT** in production
     (Phase 10), so V2 needs PROT content there first.
   - Rewards and multiplayer shown in demo phases are SIMULATED until the backend exists: clearly labelled in the UI
     ("Demo"; simulated rewards "Simulasi · tidak disimpan" since Phase 12) and never sent to or saved on the backend.
   - Demos are built on phase branches and shown to the boss through the Vercel preview link before anything is merged
     to production. Navbar links to /jelajah and /main exist since Phase 18 (owner decision).
   - Jelajah Nusantara V1 (Phase 10): `/jelajah` hub map of Indonesia (3D with three.js / @react-three/fiber /
     @react-three/drei, plus an SVG 2D fallback) and `/jelajah/sumatera-selatan` ("Segera hadir" placeholder). Frontend
     code lives only in `app/jelajah/`, `components/jelajah/`, `lib/jelajah/`, `public/jelajah/`; details in the frontend
     CLAUDE.md "Jelajah Nusantara". Province counts are computed on the client from `GET /prot?status=ARSIP_NASIONAL`
     (all pages); a backend endpoint `GET /api/jelajah/provinces` should replace that later.
   - Jelajah Nusantara V2 (Phase 11): `/jelajah/sumatera-selatan` is a walkable riverside village (procedural raised houses
     "terinspirasi rumah limas", CC0 low-poly nature and player character, 6 procedural PROT stands around a plaza, joystick
     or WASD/arrows, no bots). Stands fill automatically from the province's public PROT; production still has 0 there, so
     every stand shows "Segera hadir". Local development uses the labelled DEMO PROT. The scene is generic: later provinces
     add a scene data file (frontend CLAUDE.md "Province scene engine"). 3D assets are CC0 only, recorded in
     `public/jelajah/assets/ASSET_LICENSES.md`; `pnpm check:jelajah` enforces 8 MB per province and textures <= 1024 px.
   - Jelajah Nusantara V3 (Phase 12, polish): framed follow camera (player in the lower third, closer and wider on
     phones, 1.5 s entry glide), the hidden player's silhouette in the site's primary colour with a light edge, a neutral
     open pavilion in the plaza, larger fitted stand signs, light ambient motion (full tier only, never with reduced
     motion), a banner when the province has no public PROT yet, and a SIMULATED reward HUD (XP, level, Paspor with
     the 35 provinces, Misi). **Simulation only:** the rewards live in `lib/jelajah/demo-rewards.ts`, only in the
     browser tab's sessionStorage, labelled "Simulasi · tidak disimpan", and never reach the backend (a test guards the
     imports). Real rewards still follow item 3. Details in the frontend CLAUDE.md "Camera, polish and simulated rewards".
   - Jelajah Nusantara V4 (Phase 13, finishing the visual track before the backend work resumes): simulated levels start
     at 1 (level L needs 50 × (L − 1) × L total XP; the future backend uses the same curve), site-wide toasts at the top
     centre (kept clear of the Jelajah title bar, HUD and panel close button), a short "Segera hadir" phone stand prompt,
     a `?debug=1` stats overlay for measuring real phones, an automatic full → lite → 2d fallback when the frame rate
     stays low (never over a manual choice), and PROT photos through Vercel Image Optimization (`/prot` phone cold load
     2983 KB → 617 KB). Still no navbar link to /jelajah and no brand rename (both wait for the boss). Details in the
     frontend CLAUDE.md "Finish, real-device measurement and PROT photos".
   - Public page images (Phase 14): the landing page uses the same optimized photo approach as /prot (featured PROT
     through `ProtPhoto`; the desktop-only hero carousel through next/image and never downloaded on phones), so `/` on a
     phone cold load went from 1597 KB to 666 KB. Optimized images stay cached 31 days (`images.minimumCacheTTL`),
     which is safe only because every upload gets a new UUID object key (backend `StorageService.uploadFile()`). The
     site now really displays Plus Jakarta Sans and Geist Mono (separate commit, revertible). Details in the frontend
     CLAUDE.md "Public page images (Phase 14)".
   - Jelajah intro bumper (Phase 16, owner decision): opening `/jelajah` first plays a short animated tour of the
     whole site (6 scenes, 19 s: brand, Arsip PROT with the real public PROT count and photos, the province map with
     the provinces that have PROT, "Segera hadir" traditional games, events and members from `GET /stats/landing`,
     simulated XP and Paspor with "Mulai Jelajah"). Built in React + CSS + framer-motion (no video, no sound, no
     three.js), once per browser session (`sessionStorage`), always skippable ("Lewati", Esc), replayable from
     "Putar intro" in the hub's "Tampilan" menu, never on a province deep link. The hub loads its data and the 3D chunk
     behind it. Only real data or neutral text. The site name it shows is one constant, `SITE_NAME` in
     `nusantara-play-fe/lib/brand.ts` (since Phase 18 "Nusantara Legacy", shared by the whole site). Details in the frontend
     CLAUDE.md "Intro bumper (Phase 16)". Since Phase 17 it plays once per DAY per browser (local date in
     `localStorage['jelajah.bumperLastPlayed.v1']`, falling back to once per session when localStorage is
     unavailable), and its scene 4 has a "Main Congklak" button instead of "Segera hadir".
   - Hosted games (Phase 17, owner decision): the site hosts its own traditional games instead of linking to external
     sites (no files of the old external games exist, so games are built from scratch). The first is congklak in 2D
     (SVG + CSS, no three.js) at the public page `/main/congklak`, listed on `/main`: against the computer (Mudah,
     Sedang, Sulit; the AI runs in a Web Worker) or two players on one device. ONE common ruleset, "Aturan dasar",
     described in the game exactly as implemented and never claimed to be the only correct version; every rule switch
     lives in one config file, `nusantara-play-fe/lib/games/congklak/rules.ts`, for a curator to adjust. The Sumatera
     Selatan scene's plaza pavilion opens the game ("Main Congklak", neutral wording, no claim about where congklak
     comes from); the game page links back ("Kembali ke desa"). The landing page's "Mulai Tur Virtual" button and the
     carousel slide that pointed to external tour sites now open `/jelajah`. No navbar link yet. Details in the
     frontend CLAUDE.md "Games (Phase 17)".
   - Brand, navbar and login gate (Phase 18, owner decisions): the brand is "Nusantara Legacy" everywhere users see
     it, from one constant (`nusantara-play-fe/lib/brand.ts`, `SITE_NAME`); the navbar links to the Jelajah map
     ("Jelajah"; "Tur Virtual" on the landing page) and the games ("Game", `/main`), on phones too. **The Jelajah map
     requires login**: a logged-out visitor of `/jelajah` or `/jelajah/*` is sent to
     `/login?redirectTo=…&reason=jelajah`, sees "Masuk dulu untuk memulai Tur Virtual. …", and after logging in
     (email/password or Google) lands on the page they wanted; `redirectTo` is always a validated same-site path.
     The games under `/main` stay public. The gate uses the frontend's current login (Supabase today) and must move
     with it when the frontend switches to the self-hosted login. Landing statistics count only published content
     (ARSIP_NASIONAL PROT and their provinces), like the map and the bumper; numbers that are 0 are hidden. Details
     in the frontend CLAUDE.md "Brand, navbar and the Jelajah login gate (Phase 18)".
   - Concept video (Phase 19, owner decision): on the first `/jelajah` visit per browser a ≈48 s animated film ("Kenali"
     + the brand; 8 scenes: games in the courtyard, forgotten, Indonesia lights up, the archive, a province village,
     congklak with XP and a Paspor stamp, the community, start) plays after the intro bumper and before the map. Skippable
     ("Lewati", Esc), replayable ("Tonton pengenalan"), still frames with reduced motion, real data only
     (published PROT names and counts; no Points, prizes or multiplayer promised). Code-driven (React, framer-motion, SVG,
     a particle canvas on the 3D tiers), lazy-loaded, about 38 KB gzip. Every text and timing is in ONE file,
     `nusantara-play-fe/lib/jelajah/concept/script.ts`. The Jelajah login page no longer offers "Masuk sebagai Tamu"
     (the map needs an account; the games stay open) and the landing page's featured PROT are published only. Details
     in the frontend CLAUDE.md "Concept video (Phase 19)".
   - Gasing (Phase 20): the second self-hosted game, `/main/gasing` (public, listed on `/main` next to Congklak), 2D
     canvas, against the computer (Mudah, Sedang, Sulit) in two modes based on the published archive record "Gasing"
     (Kepulauan Riau): Uri (longest spin wins) and Pangkah (strike the opponent's spinning top; roles swap). Slingshot
     throw by touch/mouse or keyboard, best of 3, records nothing (item 11). ONE ruleset "Aturan dasar" in
     `nusantara-play-fe/lib/games/gasing/rules.ts` and every text in `texts.ts`, awaiting curator review. Not yet linked
     from the Jelajah pavilion or the bumper (they support one game only). Details in the frontend CLAUDE.md
     "Gasing (Phase 20)".
   - More provinces (Phase 22): four more provinces are enterable, each a distinct low-poly village built from data
     with the same engine and the same shared CC0 assets, with its published PROT on a stand: Aceh (dry-season timber
     stilt houses, an open hall), Kepulauan Riau (a coastal kampung with stilt houses in the sea, a jetty and a Gasing
     arena that opens `/main/gasing`), Jawa Tengah (a stepped-roof pendopo, rice terraces, a volcano in the haze, bamboo)
     and Sulawesi Selatan (a pinisi-like boat on the beach, raised houses with tiered gables). Buildings are loose hints
     ("terinspirasi"), never named in the UI. Provinces without a playable game show a "Game segera hadir" sign (no
     button). Sumatera Selatan stays the unchanged pilot. Every enterable province is marked on the map ("★ Desa") and has
     its own simulated Paspor stamp design. Jawa Barat has no scene (its only published record is a test record).
     Details in the frontend CLAUDE.md "More provinces (Phase 22)".
   - Sound (Phase 21): the concept film and the intro bumper have a gamelan-inspired score and synced sound effects,
     synthesized in code with the Web Audio API (no audio files or samples, no licences, no new dependency). Sound starts
     by itself only when the browser allows it (arriving by an in-app click); otherwise the film plays muted with a
     "Nyalakan suara" button. A sound toggle ("Suara") next to "Lewati", remembered per browser
     (`localStorage['np_sound_muted_v1']`) for both intros. Reduced motion keeps the sound. A voice-over can be added per
     scene later (none exist). The audio code loads only with the intros. Details in the frontend CLAUDE.md
     "Sound (Phase 21)".
   - Egrang (Phase 23): the third self-hosted game, `/main/egrang` (public, listed on `/main` next to Congklak and
     Gasing), a 2D canvas race against the computer (Mudah, Sedang, Sulit) in two variants, each based on its own
     published archive record: Bambu ("Egrang Bambu", Jawa Tengah: keep the swaying body balanced on tall stilts, a bad
     step can make you fall) and Batok ("Egrang Batok", Sulawesi Selatan: step on the kendang beat, out of rhythm the
     coconut shell slips off). Taps on the left / right half or ← / → keys; ONE ruleset "Aturan dasar" in
     `nusantara-play-fe/lib/games/egrang/rules.ts` and every text in `texts.ts`, awaiting curator review; synthesized
     sound on the Phase 21 engine; records nothing (item 11). Jawa Tengah and Sulawesi Selatan now have an egrang practice
     track instead of the "Game segera hadir" sign (it opens the game with their variant and leads back to the village);
     the intro bumper shows one button per game. Details in the frontend CLAUDE.md "Egrang (Phase 23)".
   - Privacy hotfix (Phase 25, urgent): published media cannot be removed in the UI, so the frontend hides problem files
     with ONE denylist, `nusantara-play-fe/lib/prot/hidden-media.ts`, applied by every renderer of PROT media (`/prot`,
     `/prot/[id]`, landing cards, Jelajah hub card, stand panels, 2d cards, bumper strip); PROT documents are not shown on
     public pages unless `NEXT_PUBLIC_SHOW_PROT_DOCUMENTS=true` (reviewer roles still see them). 13 files are hidden
     (personal data, children's faces without known consent, unrelated photos). Display filter only: the files stay in
     S3 and in the API until an admin removes them with the Phase 25 backend routes (Pending deployment item 12). Pavilion
     labels "Main Egrang Bambu" / "Main Egrang Batok"; every bumper scene uses the dense short-screen layout. Staff guide:
     `nusantara-play-be/docs/panduan-input-prot.md`. Details in the frontend CLAUDE.md "Hidden media and documents
     (Phase 25)".
10. Real rewards, part 1 (Phase 15, backend only): `nusantara-play-be/src/modules/rewards/`. `RewardsService` is the
    ONLY code that changes XP and Points. Every change is one transaction: `pg_advisory_xact_lock` per user, server-built
    idempotency keys (`PROVINCE_ENTER:{userId}:{provinsiKode}`, `PROT_VIEW:{userId}:{protId}`,
    `PASPOR_STAMP:{userId}:{provinsiKode}`; a repeated request is answered with `duplicate: true` and no error), rows in the
    append-only `reward_ledger` (a database trigger refuses UPDATE, DELETE and TRUNCATE; corrections are new compensating
    rows), and atomic increments of `reward_balances` (XP, Points, level) in the same transaction.
    - Two currencies: XP (levels, leaderboard, never redeemable) and Points (redeemable later for in-platform rewards;
      never cashed out, never transferable).
    - **Browser-reported actions give XP only, never Points** (a script can fake them). Points will come only from
      server-verified actions (server-graded quizzes, organizer-confirmed event check-ins, realtime-verified mini-games).
      Phase 15 has no rule that grants Points; only `ADMIN_ADJUST` can change them. Points need a verified email (otherwise
      only the XP part is granted) and stay on hold for `POINTS_HOLD_DAYS` (default 7) before they become redeemable.
    - Rules and every reward number live in ONE file, `src/modules/rewards/rewards.rules.ts` (same numbers as the Jelajah
      simulation): PROVINCE_ENTER +25 XP once per province; PROT_VIEW +10 XP once per PROT, ARSIP_NASIONAL only;
      PASPOR_STAMP +50 XP once per province, granted automatically when the user has viewed min(3, the province's
      ARSIP_NASIONAL PROT count) PROT there and the province has at least one. Levels: level L needs 50 × (L − 1) × L
      total XP (`levelForXp()` in `level.ts`).
    - Endpoints (login required, local and legacy Supabase tokens): `POST /api/rewards/activities {type, refId}` (only
      PROVINCE_ENTER and PROT_VIEW; the PROT's province comes from the database; 60 / min per user), `GET /api/rewards/me`,
      `/me/ledger`, `/me/paspor`, `/leaderboard?scope=national|province&provinsiKode=` (top 50 + own rank, public user
      shape, 60 s in-memory cache), `POST /api/admin/rewards/adjust` (admin_kpoti, audited, reason >= 5 characters).
    - Reconciliation: `npm run rewards:reconcile` recomputes balances and levels from the ledger and reports differences;
      `-- --fix` rewrites them. Manual walk-through: `nusantara-play-be/docs/rewards-local-testing.md`.
    - The Jelajah HUD keeps its SIMULATION (item 9) until the frontend switches to the self-hosted login in a later phase;
      only then may it call these endpoints.
11. Games record nothing yet (owner decision, Phase 17): games are played without logging in, and nothing about a game
    (moves, results, scores, XP) is recorded or sent to the backend. Only local settings (difficulty, animation speed,
    last mode) are kept in `localStorage['games.congklak.settings.v1']` (try/catch). A test fails if a game file calls
    the network or imports API code. Gasing (Phase 20) follows the same rule: `localStorage['games.gasing.settings.v1']`
    (mode, level) and `localStorage['games.gasing.tutorialSeen.v1']` only; Egrang (Phase 23) `localStorage['games.egrang.settings.v1']`
    (variant, level) and `localStorage['games.egrang.tutorialSeen.v1']` only (plus the shared sound choice `np_sound_muted_v1`).
    A later phase may add rewards for games, but only through server-verified results
    (item 10: browser-reported results never give Points, and a game result reported by the browser is not proof).

## Deployment facts

- Frontend: Vercel. **The product uses only https://nusantaralegacy.org** (owner decision, Phase 10). `nusantaravirtual.org` is
  retired: `next.config.ts` `redirects()` sends every request whose Host is `nusantaravirtual.org` or
  `www.nusantaravirtual.org` to `https://nusantaralegacy.org` with a 308, same path and query, `/backend-api` included.
  `www.nusantaralegacy.org` is redirected by Vercel itself (307 to the apex, Phase 10 check), so the app has no rule
  for it; never add one for the apex (loop risk). Phase 10 finding: the TLS certificate covers only the apex, so
  `https://www.nusantaralegacy.org` and `https://www.nusantaravirtual.org` fail with a certificate error in browsers
  (fix in the Vercel domain settings). All domains point to the same Vercel IP.
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
4. Migration `1795100000000-CreateSelfHostedAuthTables` (Phase 07): makes `users.supabase_user_id`
   nullable (unique constraint kept) and creates `user_credentials`, `refresh_tokens`, `auth_identities`
   (`IF NOT EXISTS`; down drops the tables and restores NOT NULL only if no user lacks a Supabase id).
   Run it before the Phase 07 code starts; the old code is unaffected by it.
5. Self-hosted auth env (Phase 07): `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KEY_ID`, `JWT_ISSUER`,
   `JWT_AUDIENCE`, optionally `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`,
   `REFRESH_REUSE_GRACE_SECONDS`, `AUTH_ACCEPT_SUPABASE_TOKENS` (keep `true`). Generate the key pair ON the
   server (`npm run auth:generate-keys`); never reuse dev or test keys; never commit the private key.
   Without these vars the Phase 07 backend still starts and behaves as before (local auth disabled).
6. Phase 08 (no migration; `npm ci` installs the new dependency `cookie-parser`): self-hosted register, login,
   refresh, logout, logout-all and local change-password endpoints, refresh cookies, CSRF check, lockout,
   `JwtAuthGuard` runs once per request, unused `JwtModule` removed. Env on the server:
   - `JWT_ISSUER=https://api.nusantaralegacy.org`, `JWT_AUDIENCE=nusantara-play` (owner decision; part of item 5).
   - `AUTH_COOKIE_PATH=/backend-api/auth` (the default; may be omitted). `AUTH_COOKIE_SECURE` unset (true because
     `NODE_ENV=production`; check that the server really runs with `NODE_ENV=production`, otherwise set `true`).
   - `FRONTEND_ORIGIN_PATTERNS` empty, unless login must work on Vercel preview deployments (then a full-match regex
     for the preview host names of the frontend project).
   - `LOGIN_MAX_FAILED=5`, `LOGIN_LOCK_MINUTES=15` (the defaults; may be omitted).
   - **`FRONTEND_URLS` must contain `https://nusantaralegacy.org`**: the CSRF check compares the browser's `Origin` with
     it, and the production allowlist currently lacks nusantaralegacy.org (Deployment facts), so refresh/logout would
     answer 403. See item 9 for the final value.
   - Before the frontend switches to these endpoints, verify on a Vercel preview that the `/backend-api` rewrite
     forwards `Origin`, `Cookie` and `X-Requested-With` and passes `Set-Cookie` back unchanged.
7. audit_log cleanup (Phase 06 finding, still open): production `audit_log.changes` still contains plain-text
   passwords from old `POST /auth/change-password` requests. Redact them in the database (replace the
   values of `currentPassword`, `newPassword`, `confirmPassword` with `[REDACTED]`) after a backup.
   Until then the admin audit page hides secret-looking values on display (frontend, Phase 07).
8. Phase 09 (run the migration BEFORE the new code; the old code never reads the new tables):
   - Migration `1795200000000-CreateEmailAuthTokens`: creates `auth_tokens` and `email_verifications`
     (`IF NOT EXISTS`, explicit names; down drops both tables).
   - Env: `APP_PUBLIC_URL=https://nusantaralegacy.org` (required: without it no verification or reset email is
     sent), optionally `EMAIL_VERIFICATION_TTL_HOURS=24`, `PASSWORD_RESET_TTL_MINUTES=60`.
   - **Real SMTP credentials** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` with
     a sender address of the production domain, ideally with SPF/DKIM). Until then emails fail and are only logged
     (error name/code); the endpoints still answer normally. Never point production at Mailpit.
   - Effects: access tokens issued before a password change are rejected; `/users/me`, login and refresh carry
     `emailVerified`; a daily cleanup job deletes old refresh and email tokens.
9. Single domain (Phase 10): production **`FRONTEND_URLS=https://nusantaralegacy.org`** (add
   `https://www.nusantaralegacy.org` only if `www.` is ever served as its own host instead of redirecting; today Vercel
   redirects it). `nusantaravirtual.org` no longer needs to be listed: the frontend redirects it before any page or
   `/backend-api` call runs. Also `APP_PUBLIC_URL=https://nusantaralegacy.org` (item 8).
10. Phase 15 rewards (run the migration BEFORE the new code; the old code never reads the new tables):
   - Migration `1795300000000-CreateRewardsLedger`: creates `reward_ledger`, `reward_balances`, `user_prot_views`,
     `user_province_stamps` (`IF NOT EXISTS`, explicit names), the function `reward_ledger_append_only()` and the triggers
     `TRG_reward_ledger_append_only` / `TRG_reward_ledger_no_truncate` (refuse UPDATE, DELETE, TRUNCATE; a DELETE cascaded
     from a deleted `users` row is allowed). Needs `uuid_generate_v4()` (uuid-ossp, already used by the Phase 07 and 09
     migrations). down() drops the triggers, the function and the four tables.
   - Env: optionally `POINTS_HOLD_DAYS` (default 7). Nothing else.
   - After deployment: `npm run rewards:reconcile` should report 0 differences (read-only).
11. Phase 18 landing statistics (no migration, no env): `GET /api/stats/landing` counts `totalProt` and
   `totalProvinsi` from PROT with status ARSIP_NASIONAL only (`src/modules/stats/stats.service.ts`); events and
   users unchanged. The frontend already computes the published counts itself, so the order does not matter.
12. Phase 25 admin corrections of PROT in ANY status (no migration, no env; additive routes only; the contributor rule
   `PROTService.assertCanEditMedia()`, owner or admin and DRAFT / REVISI only, is unchanged):
   - `POST /api/admin/prot/:id/media/remove` (admin_kpoti) `{ field, url, peralatanIndex?, reason }`: `field` is
     `fotoKegiatan` | `videoKegiatan` | `dokumenKurikulum` | `fotoAlat` | `urlPembelian`, `url` the exact stored URL,
     `reason` 5 to 500 characters (never personal data). One transaction (row lock, save, `audit_logs` row
     `ADMIN_PROT_MEDIA_REMOVE` with who, record, field, URL, reason; never file contents), then the S3 object is deleted
     through `StorageService.deleteFile()` (only PROT uploads under `prot/`, never `urlPembelian`). Answer
     `{ protId, field, status, removed, removedCount, s3Deleted }`; a repeat answers `removed: false` and changes nothing.
   - `POST /api/admin/prot/:id/revisi` (admin_kpoti) `{ reason }`: ARSIP_NASIONAL or DIVERIFIKASI → REVISI (hidden
     from the public at once; the owner can then correct it with the normal routes and resubmit), audited
     `ADMIN_PROT_MOVE_TO_REVISI`; already REVISI → `changed: false`. Before Phase 25 no route could do this.
   - **After deployment, remove the SEPANGKAL files** (record `752aeea4-a9c4-455b-a216-71f508bcfe3c`; the URLs are in
     `nusantara-play-fe/lib/prot/hidden-media.ts`):
     1. Get an access token of an `admin_kpoti` account: the self-hosted login (`POST /api/auth/login`, needs items 4 to
        6) or, until then, the Supabase access token of a logged-in admin from the browser. Never paste it anywhere else.
     2. `curl -X POST https://api.nusantaralegacy.org/api/admin/prot/752aeea4-a9c4-455b-a216-71f508bcfe3c/media/remove
        -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"field":"dokumenKurikulum",
        "url":"<the PDF URL>","reason":"Dokumen berisi data pribadi, tidak terkait permainan (Phase 24)"}'`
        → `removed: true, s3Deleted: true`.
     3. `curl -I "<the PDF URL>"` must now answer 403 or 404. If `s3Deleted` was false, someone with AWS access deletes
        the object `prot/dokumen-kurikulum/7a4de8b1-c0bd-4570-bc9f-9a8b421a673e.pdf` by hand and checks again.
     4. The same for the trophy photo (`"field":"fotoAlat","peralatanIndex":1`) and the cake link
        (`"field":"urlPembelian","peralatanIndex":1`); the other Phase 25 audit entries only after the curator decided
        (Phase 25 report, section 8).
     5. If the curator must rework the record: `POST .../752aeea4-.../revisi` `{"reason":"..."}`.
     6. `GET /api/prot/752aeea4-a9c4-455b-a216-71f508bcfe3c` shows `dokumenKurikulum: []`. The frontend denylist entries
        may stay (harmless) or be removed in a later phase.

## Local development

Both repos run fully locally against a disposable PostgreSQL (Phase 05). **The frontend still cannot log in
locally**: it signs in through Supabase, and the local Supabase values are fake
(`https://supabase-placeholder.invalid`). The backend's own login works since Phase 08 (register, login,
refresh, logout under `http://localhost:3000/api/auth/`; walk-through with curl in
`nusantara-play-be/docs/auth-local-testing.md`) once a dev key pair is in `.env.local`. Public pages and
public endpoints work.

1. Database (in `nusantara-play-be`): `npm run db:up` starts `postgres:15-alpine` (container
   `nusantara-dev-db`, port bound to `127.0.0.1:5432`, volume `nusantara-dev-db-data`, local-only
   password `localdev`) and creates `nusantara_play_dev` and `nusantara_play_test` on first start. Since Phase 09
   it also starts Mailpit (`axllent/mailpit:v1.33.1`, container `nusantara-dev-mailpit`, SMTP `127.0.0.1:1025`,
   web UI http://localhost:8025, no volume): every email the backend sends locally lands there; nothing is
   delivered. `.env.local.example` has the matching `SMTP_*` lines and `APP_PUBLIC_URL=http://localhost:3001`.
   Walk-through: `nusantara-play-be/docs/auth-local-testing.md`. Tests never use Mailpit (capturing double,
   `SMTP_HOST` forced empty in `test/test-env.ts`).
2. Backend env: `cp .env.local.example .env.local` (fake placeholders only; never put real secrets there).
   Then run `npm run auth:generate-keys` and paste the printed `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KEY_ID`
   lines into `.env.local` (DEV-ONLY keys; `.env.local` is git-ignored). Without them local auth stays disabled.
   Phase 08: also copy the cookie lines (`AUTH_COOKIE_PATH=/api/auth`, `AUTH_COOKIE_SECURE=false`) from
   `.env.local.example`; with the default `/backend-api/auth` the refresh cookie is never sent to `/api/auth/refresh`.
   Set them in `.env.local`, not with a Git Bash `export` (Git Bash turns `/api/auth` into a Windows path).
3. Schema and seed: `npm run db:setup` (`src/scripts/db-local-setup.ts`; `npm run seed` is an alias).
   Refuses unless the host is `localhost`/`127.0.0.1` and the database name ends with `_dev` or `_test`.
   Builds the schema from the entities, records all `src/migrations/` as applied, seeds daerah (34 provinsi,
   416 kabupaten, 98 kota, 7230 kecamatan, 74952 desa, 8487 kelurahan) and DEMO data (user
   `demo-kurator@example.test`, 3 PROT with status ARSIP_NASIONAL, 1 published event; names start with
   "DEMO"; since Phase 11 also `DEMO PROT Sumsel 1` to `4` in Sumatera Selatan (provinsi 16, ARSIP_NASIONAL, fixed UUIDs
   `…de31` to `…de34`, neutral placeholder text) for the Jelajah scene; since Phase 13 "DEMO PROT Sumsel 1" has one photo,
   `http://localhost:3001/jelajah/demo/foto-contoh.svg`, a neutral placeholder served by the local frontend). Idempotent. Flags: `-- --database=<name>`, `-- --no-demo`.
   Since Phase 15 it also installs the reward ledger trigger and the `(user_id, created_at DESC)` index after
   `synchronize()` (which cannot create them), through the migration's static
   `CreateRewardsLedger1795300000000.installDbObjects()`.
4. Backend: `npm run start:dev` → http://localhost:3000/api. Blockchain vars stay empty, so
   BlockchainService logs a warning and is inactive.
5. Frontend (in `nusantara-play-fe`): `.env.local` with `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000/api`
   and placeholder Supabase values (see `.env.example`), then `pnpm dev` → http://localhost:3001
   (`/prot` shows the DEMO PROT).
6. Tests (backend): `npm test` (unit, no database), `npm run test:int` (`*.int-spec.ts`, real
   `nusantara_play_test`), `npm run test:e2e` (full AppModule on `nusantara_play_test`). Integration and
   e2e run the same setup logic as `db:setup` in a Jest global setup and force every env var to local test
   values (`test/test-env.ts`, which also generates a fresh RS256 key pair per test process, in memory only).
   E2E tests that need a session register and log in through the real endpoints; `test/e2e-app.ts` builds the
   app like `main.ts` (cookie parser, trust proxy, pipes, filter). Two events e2e tests stay skipped for
   reasons unrelated to login (see the comment in `test/events.e2e-spec.ts`).
7. Reset: `npm run db:reset -- --yes` deletes the volume and starts an empty database; then `npm run db:setup`.
   `npm run db:down` stops the container and keeps the data; `npm run db:logs` follows the logs.

## Risks

- `/backend-api` proxy (Phase 03): Vercel runs external rewrites in its CDN/router, not in a Function. The proxied request timeout is **120 s** (`ROUTER_EXTERNAL_TARGET_ERROR` after that). Vercel documents **no request body limit** for external rewrites (the documented 4.5 MB limit is for Functions). Uploads above 4.5 MB through the proxy are therefore unverified on Vercel until a large upload is tested on a preview deployment. Locally `next start` proxied a 6 MB multipart body intact. The backend (repo nginx) allows 50 MB and has `proxy_read_timeout 60s`, so a slow large upload can still fail on that side.
- All browser API traffic now reaches the backend from Vercel's IP addresses. Vercel sets `X-Forwarded-For`/`X-Real-IP` to the visitor's IP, but whether production nginx/NestJS use them is unknown (no server access; the repo nginx has `limit_req` 10 r/s burst 20 per `$binary_remote_addr`). Since Phase 06 (not yet deployed) the NestJS throttler limits logged-in users per user id; anonymous requests are still limited per `req.ip`, which behind Vercel is a Vercel egress IP shared by many visitors (Vercel IPs are not a stable published list, so they cannot be trusted as proxies). Per-IP limits (nginx `limit_req`, anonymous throttling) can therefore still hit many users at once (HTTP 429 or 503).
- Vercel CDN caching of proxied responses: projects created on or after 2026-04-06 honor upstream cache headers on external rewrites by default. `next.config.ts` sends `x-vercel-enable-rewrite-caching: 0` for `/backend-api/:path*` to turn that off. The backend currently sends no `Cache-Control` header.
- Login throttling (Phase 08): behind Vercel, anonymous requests may all share a few Vercel egress IPs, so the
  per-IP limits are deliberately generous (login and register 30 / min, refresh 60 / min per tracker) and can
  still hit many visitors at once if `req.ip` turns out to be a Vercel IP in production. The real brute-force
  protection is per account: (1) the database lockout (5 wrong passwords → 15 minutes, shared by every backend
  instance) and (2) the per-email limit of 10 login attempts per 15 minutes. The per-email limit lives in the
  process memory (the throttler's in-memory storage): with N backend instances an attacker gets up to N × 10
  attempts per window, and a restart resets it. **Trade-off:** anyone who knows an email address can lock that
  account for 15 minutes (5 wrong passwords) and keep it locked by repeating; the per-email 429 also blocks the
  real owner for up to 15 minutes. Accepted for now; a later phase could add CAPTCHA or email-based unlock.
- Access tokens (15 minutes) stay valid after logout and logout-all until they expire; only refresh tokens are
  revoked. Since Phase 09 a password change or reset rejects every access token issued more than 5 s before it
  (clock skew allowance; a token issued in those 5 s stays valid until it expires). A suspended or inactive user
  is rejected at once (the `local-jwt` strategy checks the status on every request). Legacy Supabase tokens of a
  Supabase-only account stay valid after that account resets its password through the self-hosted flow (the
  legacy strategy does not look at `password_changed_at`) until `AUTH_ACCEPT_SUPABASE_TOKENS` is turned off.
- Email limits (Phase 09): the 3-emails-per-address-per-hour limit lives in process memory like the login limit
  (N instances → N × 3, a restart resets it). Anyone can make the backend send up to 3 verification / "akun sudah
  ada" and 3 reset emails per hour to any address (generous per-IP limit only). The emails contain no account data
  and the links only work for the mailbox owner. A later phase could add CAPTCHA.
- Email delivery (Phase 09): production has no SMTP credentials yet; until they are set, verification and reset
  emails are not delivered (logged as failures) while the endpoints still answer 200.
- Same-origin cookies (including Supabase `sb-*` auth cookies) are now forwarded to the backend with every browser API call. Large cookie headers could exceed nginx header buffer limits (unknown production config).
- Rewards (Phase 15): browser-reported XP can still be earned by a script with a valid login, but only up to the rule
  caps (each province and each public PROT counts once per account, 60 activity requests / min per user), and it is XP
  only, never Points. The leaderboard cache (60 s) lives in each backend instance's memory, so N instances can show
  slightly different boards for up to a minute.

## Cleanup list (known, not fixed yet)

Small known problems that a later phase should fix. Do not fix them in passing.

- (Phase 23 review, noted in Phase 25) The frontend gasing integration test
  (`nusantara-play-fe/tests/games/gasing-integration.test.tsx`) once hit Vitest's default 5 s test timeout while the
  machine was under load (a production build and headless Chrome running at the same time); it passes when run alone.
  Give its slow cases an explicit timeout or make the simulated match shorter.

## Engineering rules

- Before writing code, show a short plan and the list of files you will touch.
- Every phase ends with passing tests and a successful build. Add or update unit tests for every service you change.
- Lint rule: a phase must not add new lint errors in the files it touches.
- Ownership and permission checks live in the service layer and throw ForbiddenException.
- Any multi-table write that must be atomic uses a TypeORM transaction.
- Any read-then-write on a shared counter or claim (stock, queue claims, points) must be race-safe: use a conditional UPDATE or a pessimistic lock.
- XP and Points change ONLY through `RewardsService` (Phase 15): never write `reward_ledger` or `reward_balances` anywhere
  else, never edit or delete ledger rows (insert a compensating row), never build an idempotency key from client input,
  and never give Points for a browser-reported action.
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
- Backend after Phase 07: 221 errors, 29 warnings (`jwt-auth.guard.ts` went from 17 errors + 1 warning to 0; the moved legacy strategy is clean; no touched file gained errors; all new files are clean).
- Frontend after Phase 07: unchanged, 44 errors, 87 warnings (touched files clean).
- Backend after Phase 08: 220 errors, 29 warnings (`auth.module.ts` went from 1 error to 0; no touched file gained errors; all new files are clean).
- Frontend after Phase 08: unchanged (only CLAUDE.md changed).
- Backend after Phase 09: unchanged, 220 errors, 29 warnings (every touched and new file is clean; `users.controller.spec.ts` and the
  rewritten `local-jwt.strategy.spec.ts` have 0 problems).
- Frontend after Phase 09: unchanged (only CLAUDE.md changed).
- Frontend after Phase 10: unchanged, 44 errors, 87 warnings (every new and touched file is clean).
- Backend after Phase 10: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 11: unchanged, 44 errors, 87 warnings (every new and touched file is clean).
- Backend after Phase 11: unchanged, 220 errors, 29 warnings (`src/scripts/db-local-setup.ts` is clean).
- Frontend after Phase 12: unchanged, 44 errors, 87 warnings (every new and touched file is clean, including `app/layout.tsx`
  and `components/ui/AnimatedThemeToggler.tsx`).
- Backend after Phase 12: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 13: 44 errors, 82 warnings (@next/next/no-img-element 26 → 21: the five warnings in the touched PROT
  photo files are gone; every new and touched file is clean). Per rule: no-unused-vars 47 (warn), no-explicit-any 39,
  no-img-element 21 (warn), exhaustive-deps 14 (warn), no-empty-object-type 4, set-state-in-effect 1.
- Backend after Phase 13: unchanged, 220 errors, 29 warnings (`src/scripts/db-local-setup.ts` is clean).
- Frontend after Phase 14: unchanged, 44 errors, 82 warnings (every new and touched file is clean except the existing
  unused `LandingStats` import warning in `app/page.tsx`, also on main; no-img-element stays 21: the replaced `<img>`
  elements already had disable comments).
- Backend after Phase 14: unchanged (only CLAUDE.md and the phase report changed).
- Backend after Phase 15: unchanged, 220 errors, 29 warnings (every new and touched file is clean).
- Frontend after Phase 15: unchanged (only CLAUDE.md changed).
- Frontend after Phase 16: unchanged, 44 errors, 82 warnings (every new and touched file is clean).
- Backend after Phase 16: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 17: unchanged, 44 errors, 82 warnings (every new and touched file is clean except the existing
  unused `LandingStats` import warning in `app/page.tsx`).
- Backend after Phase 17: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 18: 44 errors, 80 warnings (two warnings fewer in touched files: the unused `LandingStats`
  import in `app/page.tsx` and the unused `router` in `components/auth/SignupForm.tsx`; every new and touched file
  has 0 errors; the remaining warnings in touched files existed before: `UserNav.tsx` and `AdminHeader.tsx`
  no-img-element, two unused imports in the admin dashboard page).
- Backend after Phase 18: unchanged, 220 errors, 29 warnings (`src/modules/stats/` is clean).
- Frontend after Phase 19: unchanged, 44 errors, 80 warnings (all 42 new and touched source files are clean).
- Backend after Phase 19: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 20: unchanged, 44 errors, 80 warnings (every new and touched source file is clean).
- Backend after Phase 20: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 21: unchanged, 44 errors, 80 warnings (all 38 new and touched source files are clean).
- Backend after Phase 21: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 22: unchanged, 44 errors, 80 warnings (all 41 new and touched source files are clean).
- Backend after Phase 22: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 23: unchanged, 44 errors, 80 warnings (all 49 new and touched source files are clean).
- Backend after Phase 23: unchanged (only CLAUDE.md and the phase report changed).
- Frontend after Phase 25: unchanged, 44 errors, 80 warnings (all 21 new and touched source files are clean).
- Backend after Phase 25: unchanged, 220 errors, 29 warnings (every new and touched file is clean).
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
- 2026-11-18: Self-hosted auth lives in a new module `src/modules/auth-core/` (passwords, keys/tokens, refresh tokens, JWKS, `local-jwt` strategy, entities) with no Supabase dependency. The Supabase strategy moved to `src/modules/auth/legacy/supabase-jwt.strategy.ts` (passport name `supabase-jwt`, registered only while `AUTH_ACCEPT_SUPABASE_TOKENS` is true), so a later phase can delete the legacy path in one step (Phase 07).
- 2026-11-18: `JwtAuthGuard` no longer extends `AuthGuard('jwt')`; it calls passport with `['local-jwt', 'supabase-jwt']` (or only `local-jwt`) and keeps the old semantics: protected routes get 401 "Authentication required" or the strategy's error rethrown; `@Public()` routes set `req.user` to the user or `false`, and leave it unset on a strategy error (Phase 07).
- 2026-11-18: The `local-jwt` strategy does one read-only `users` lookup per request (status must be `active`), never calls Supabase and never writes (no `last_login_at` update; Phase 08 sets it on login). The role comes from the database, not from the token (Phase 07).
- 2026-11-18: Auth config is a pure parser `readAuthConfig()` in `src/config/auth.config.ts` (same pattern as `data-source-options.ts`). `KeyService` loads the keys once at startup and cross-checks them (RSA >= 2048 bits, public key matches private key); invalid keys disable local auth like missing ones (Phase 07).
- 2026-11-18: `jose` is pinned to 5.x because jose 6 is ESM-only and Jest (ts-jest, CommonJS) cannot load it without extra transform config (Phase 07).
- 2026-11-18: New auth tables use `timestamptz` (as specified), unlike the older `timestamp without time zone` columns. Every constraint and index has an explicit name shared by the entity and the migration, so a migrated database and a `synchronize()`d one are identical (verified with `pg_dump`) (Phase 07).
- 2026-11-18: The admin audit page redacts secret-looking keys (password, token, secret, apikey/api_key/api-key, authorization; case-insensitive, any depth) on display with `components/audit/redact-secrets.ts` (Phase 07).
- 2026-11-18: Owner decisions for Phase 08: production `JWT_ISSUER=https://api.nusantaralegacy.org`, `JWT_AUDIENCE=nusantara-play`; the refresh cookie is host-only (no Domain attribute), so each frontend domain has its own session; `last_login_at` is updated on successful login AND on successful refresh (Phase 08).
- 2026-11-18: The self-hosted endpoints live in `auth-core` (`LocalAuthController`, `LocalAuthService`, no Supabase dependency). `POST /auth/change-password` stays in `AuthController` (one route for both kinds of account) and branches on "has `user_credentials`": local change → 204; otherwise the legacy Supabase flow unchanged (201 `{success, message}`, old validation incl. required `confirmPassword` and the upper/lower/digit rule, applied with `LegacyChangePasswordDto`). The shared DTO makes `confirmPassword` optional (the current frontend still sends it; when sent it must match) (Phase 08).
- 2026-11-18: Generic answers (Phase 08): register always 201 `{success, message}` (new account, existing account, Supabase-only account, lost race); login 401 "Invalid email or password" for unknown email, wrong password, locked account, no password and several matching users; 403 "This account cannot sign in" only after a correct password on a suspended/inactive account; register hashes the password in every branch so timing does not depend on the branch.
- 2026-11-18: Lockout counter (Phase 08): one conditional SQL UPDATE (`failed_login_count + 1`, `locked_until = now() + LOGIN_LOCK_MINUTES` when the new count reaches `LOGIN_MAX_FAILED`). The count is reset only by a correct password, so after a lock expires the next wrong password locks again at once. A locked account is refused before the password is verified. Change-password uses the same counter.
- 2026-11-18: Per-email login limit (Phase 08): `LoginEmailLimiter` uses the existing in-memory `ThrottlerStorage` (no new store, entries already expire), key = SHA-256 of the normalized email, counts EVERY attempt (known or unknown email, success or failure), 429 after 10 per 15 minutes. Per-IP limits use `@Throttle` overrides of the default throttler on the auth routes (they replace the global 100 / min there).
- 2026-11-18: CSRF (Phase 08): custom header `X-Requested-With: nusantara-play` plus Origin allowlist; a missing Origin fails. `FRONTEND_ORIGIN_PATTERNS` entries are compiled as `^(?:pattern)$`, case-insensitive; invalid ones are skipped with a warning (index only). Change-password checks CSRF only when the request carries `np_refresh` (otherwise it is a plain bearer-token call).
- 2026-11-18: Refresh errors keep their machine-readable code: `AuthErrorFilter` (scoped to `LocalAuthController`) answers `{statusCode, error, message, timestamp, path, method}` for `refresh_conflict` and `invalid_refresh_token`; the global `HttpExceptionFilter` would drop `error` (Phase 08).
- 2026-11-18: Login and refresh answer 503 while local auth is disabled; register still works without keys (it needs none). Refresh also revokes the family and answers 401 when the user is gone, suspended or inactive. Login and refresh responses send `Cache-Control: no-store` (Phase 08).
- 2026-11-18: `JwtAuthGuard` marks the request (a symbol) after authenticating; a second run in the same request reuses `req.user` instead of running the strategies again. A `req.user` set by anything else is not trusted (Phase 08).
- 2026-11-18: The unused `JwtModule` (configured with `SUPABASE_JWT_SECRET`) was removed from `auth.module.ts`; nothing injected `JwtService`. The `@nestjs/jwt` package stays in package.json for now (Phase 08).
- 2026-11-18: No migration in Phase 08: `user_credentials` (Phase 07) already has `failed_login_count`, `locked_until`, `password_changed_at`.
- 2026-11-18: Owner decisions for Phase 09: users may log in without a verified email (earning Points, a later phase, will require one; Phase 09 only provides `emailVerified` and `@RequireVerifiedEmail()`); a successful password reset also clears the login lockout; access tokens issued before the last password change are rejected; password reset works for every account with that email, Supabase-only accounts included, and completing it creates their local credentials (self-service migration; the link proves ownership of the address).
- 2026-11-18: Where "email verified" lives (Phase 09): `user_credentials.email_verified_at` for accounts with a password; a new table `email_verifications` (user_id PK, method `email_link` | `google`, verified_at) for accounts WITHOUT one, because `user_credentials.password_hash` is NOT NULL and the `users` entity was outside the phase's allowed files. `emailVerified = credentials.email_verified_at IS NOT NULL OR an email_verifications row`. Phase 10: a Google-only account whose Google `email_verified` is true writes a row with method `google`; when such an account later gets a password (reset), the reset also sets `email_verified_at`. Both tables are created by the one Phase 09 migration.
- 2026-11-18: Email work runs in the background (Phase 09): registration hooks, resend-verification, forgot-password and the "password changed" email are queued after the response, so neither body nor timing depends on whether an account exists. Failures are logged with the error name only. `EmailFlowsService.whenIdle()` (also called on shutdown) waits for queued tasks.
- 2026-11-18: Per-address email limit (Phase 09): `EmailSendLimiter`, same in-memory throttler storage and SHA-256 keys as the login limit, 3 per hour per address and purpose (`verification` = registration emails + resend-verification; `password_reset` = forgot-password). Counted for every request (known or unknown address); over the limit the email is silently skipped and the endpoint still answers 200 ("always 200" wins over a 429). verify-email and reset-password only have the per-tracker limit (30 / min).
- 2026-11-18: Email tokens (Phase 09): consuming includes the token `type`, so a verification link never resets a password. A new token DELETES the user's older unused tokens of that type, serialized with `pg_advisory_xact_lock` per (user, type). reset-password checks the length policy, then the token read-only, then "not the email" (needs the user), hashes, and only then consumes the token inside the write transaction, so a policy error or a failed write never burns the link. `password_changed_at` uses the app clock (like change-password), compared with the token's `iat` (also app clock) with a 5 s skew.
- 2026-11-18: After a local change-password the own session continues through its next refresh (the kept refresh family issues a new access token); the change-password response stays 204 (Phase 09). The "password telah diubah" email is sent after a reset and after a LOCAL change-password, not after the legacy Supabase change-password (unchanged).
- 2026-11-18: `emailVerified` is added to the `user` object of login and refresh as well, so it stays the same object as `GET /api/users/me` (Phase 08 contract) (Phase 09).
- 2026-11-18: Without `APP_PUBLIC_URL` (or with an invalid one) no email with a link is sent (warning per attempt, without the address) instead of falling back to a guessed URL; the "akun sudah ada" email is still sent, without the login link (Phase 09).
- 2026-11-18: Visual track first; pilot province Sumatera Selatan; demo rewards and multiplayer are simulated, labelled
  "Demo" and never sent to the backend; demos are reviewed on the Vercel preview before merging (owner decisions, Phase 10).
- 2026-11-18: Single product domain https://nusantaralegacy.org. `next.config.ts` redirects (308, same path and query,
  `/backend-api` included) every request whose Host is `nusantaravirtual.org` or `www.nusantaravirtual.org`. No rule for
  `www.nusantaralegacy.org` (Vercel already redirects it, 307) and never one for the apex (Phase 10).
- 2026-11-18: 3D stack for Jelajah: three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9 (React 19 peers),
  dev: @types/three 0.187.0. No other 3D, physics or animation libraries. three.js is loaded only through `next/dynamic`
  with `ssr: false` from the /jelajah hub; a test guards the import graph (Phase 10).
- 2026-11-18: Province boundaries: geoBoundaries gbHumanitarian IDN ADM1 (OCHA ROAP/HDX, 2019, CC BY 3.0 IGO) instead of
  gbOpen (ODbL), simplified with mapshaper 0.6.18 (last release without native build scripts) to 225 KB in
  `public/jelajah/geo/`. The 2019 data has 34 provinces; Papua Selatan (93) has no own shape (accepted by the owner, Phase 10).
- 2026-11-18: The pilot province is always clickable on the hub map (own soft colour, card with "no PROT yet" and the
  Masuk button) even without public PROT; every other province without public PROT is muted and not clickable
  (accepted deviation, Phase 10).
- 2026-11-18: Device tiers for 3D pages: full (antialias, pixel ratio up to 2), lite (no antialias, pixel ratio up to
  1.5), 2d (SVG, no three.js). Automatic choice from WebGL2, deviceMemory, hardwareConcurrency and a short fps probe,
  cached; the user's override is stored in localStorage (`jelajah.tier`). Budgets live in `lib/jelajah/budget.ts` (Phase 10).
- 2026-11-18: Everything that uses disk space goes to D:, never C:; Docker Desktop data moved to D:\DockerData\wsl by the
  owner (see "Local machine").
- 2026-11-18: Owner decisions for Phase 11 (visual track V2): 3D assets come from free CC0 low-poly packs (Kenney Nature
  Kit 2.1 and Mini Characters 2.0 chosen); traditional buildings are built procedurally in code because no free pack has
  Indonesian architecture, and are described only as "terinspirasi rumah limas"; no simulated other players (bots); the
  scene must look good on phones (first test device iPhone 11; target stays a 4 GB mid-range Android); production has 0 public
  PROT in Sumatera Selatan, so the scene must look intentional when empty ("Segera hadir" stands) and fill itself when real
  PROT are published; local development uses clearly labelled DEMO data; no invented cultural facts (scene text comes only
  from PROT data or neutral UI text).
- 2026-11-18: Asset licence rule: only CC0 assets in `public/jelajah/assets/`, each pack recorded in `ASSET_LICENSES.md` (name,
  author, source URL, licence as checked in the pack, files used). Raw packs are downloaded to D: and never committed; the
  committed files are built by `scripts/optimize-jelajah-assets.mjs` (meshopt, WebP <= 1024 px, no KTX2). Dev dependency
  `@gltf-transform/cli` 4.5.1 (its core/extensions/functions packages are resolved through it; lockfile stays 9.0, no new
  build scripts) (Phase 11).
- 2026-11-18: Province scenes are data files (`lib/jelajah/scenes/<slug>.ts`) rendered by one engine; collision is circles and
  turned boxes with push-out (no physics library); stands get PROT in name order, the last stand turns into a notice board when
  a province has more PROT than stands; signs are canvas sprites (not drei `<Html>`); no realtime shadows (blob shadows), one
  directional + one ambient light; the player stays visible behind roofs through a silhouette pass (Phase 11).
- 2026-11-18: Phase 11 was interrupted by a usage limit after the verification run and resumed; the resume finished the
  player-silhouette fix, the dev-overlay measurements, fresh screenshots and the docs (Phase 11 report, "Deviations").
- 2026-11-18: Owner decisions for Phase 12 (visual track V3, from the Phase 11 screenshots): the phone camera was too far
  behind the player (empty grass below, side stands cut off); the hidden player's silhouette must read as the character in
  the site's primary colour; the plaza gets one neutral centrepiece; stand signs must be larger and never cut off; rewards
  stay SIMULATED (frontend only, labelled "Simulasi, tidak disimpan", never sent to the backend, only for the current
  browser tab via sessionStorage in try/catch); no simulated other players yet; no invented cultural facts (new objects are
  neutral or worded "terinspirasi").
- 2026-11-18: Camera (Phase 12): fixed 40° pitch, no rotation; the player's chest sits at 40 % below the screen centre
  (lower third); the field of view goes from 62° (portrait phone) to 44° (landscape); the distance is the smallest one at
  which the player, the two stands nearest to the spawn point and every sign top fit inside 92 % of the screen; follow
  with a critically damped spring (0.16 s); 1.5 s entry glide only on the full tier and never with reduced motion, skipped
  by any key, pointer, wheel or touch. Pure math in `lib/jelajah/engine/camera.ts`.
- 2026-11-18: Silhouette (Phase 12): primary colour #9E3C24 (light-theme `--color-primary`; the 3D scene keeps one look in
  both site themes) at a fixed 0.82 opacity, blended in the opaque pass (CustomBlending, stencil so every pixel blends
  once), plus a light #FFF1DC edge from the same skinned meshes pushed out 5.5 cm along their normals. The canvas now
  requests a stencil buffer. +2 draw calls.
- 2026-11-18: Plaza centrepiece (Phase 12): a procedural open pavilion (two-tier pyramid roof on four posts, low
  platform), merged into the village mesh (0 extra draw calls), box collider; the UI never names it.
- 2026-11-18: Demo reward rules (Phase 12): entering a province scene +25 XP once per tab; opening the panel of a PROT
  +10 XP once per PROT (stand or notice-board entry, 3D and 2d); 3 different PROT of a province (all of them when it has
  fewer, at least 1) = that province's Paspor stamp +50 XP; level n needs 50 × n × (n + 1) total XP, read literally: the
  simulation starts at level 0 and reaches level 1 at 100 XP. Constants in `DEMO_REWARD_RULES`. Key
  `sessionStorage['jelajah.demoRewards.v1']`; anything unexpected in it means an empty simulation. The Paspor has an
  "Atur ulang simulasi" button for repeated demos.
- 2026-11-18: Theme (Phase 12, Phase 10 finding #418): the inline script in `app/layout.tsx` only sets the `dark` class on
  `<html>` (try/catch, still the only allowed `dangerouslySetInnerHTML`); components read the theme after mount with
  `useSyncExternalStore` and a light server snapshot (`AnimatedThemeToggler`, `lib/jelajah/use-theme-mode.ts`). Never read
  `localStorage` or the `dark` class during the first render.
- 2026-11-18: Icons (Phase 12): `app/favicon.ico` (258 KB, 9 sizes) replaced by `app/icon.png` (48 px), `app/apple-icon.png`
  (180 px, 128-colour palette) and `public/favicon.ico` (16 and 32 px PNG entries): 11.6 KB in total, generated with the sharp
  already in node_modules from the logo's own 256 px PNG (same design).
- 2026-11-18: C: fell to 2.9 GB during the Phase 12 verification (builds, `next dev` and headless Chrome at the same time):
  Windows grew `C:\pagefile.sys` to 11 GB. Run one heavy process at a time and check C: again after each.
- 2026-11-19: Owner decisions for Phase 13 (visual track V4): the boss approved continuing; this phase finishes the visual
  track before the backend work resumes. Levels start at 1: level L needs 50 × (L − 1) × L total XP (L1 = 0, L2 = 100,
  L3 = 300); the future backend uses the same curve (replaces the Phase 12 "level 0" reading). Site-wide toasts appear
  at the top centre. No navbar link to /jelajah and no brand rename yet (both still wait for the boss).
- 2026-11-19: Toast placement (Phase 13): one global sonner Toaster, `top-center`, 72 px from the top (below the 64 px
  navbar) through `--toast-top`; Jelajah pages move it below the overlays marked `data-toast-avoid` (title bar,
  "Tampilan", HUD, stand panel close button). Messages such as the empty-province banner and the help hint are not
  avoided: a toast may cover them for its 2 to 4 seconds.
- 2026-11-19: Simulated reward state key `sessionStorage['jelajah.demoRewards.v2']` (version 2) for the level-1 curve;
  v1 state is ignored (Phase 13).
- 2026-11-19: Real-device measurement (Phase 13): `?debug=1` overlay with the 2 s average fps, draw calls, triangles,
  tier, devicePixelRatio and canvas size; nothing is mounted without the flag. Automatic fallback in the province scene
  only (the hub map renders on demand): full → lite below 24 fps for 5 s, lite → 2d below 20 fps for another 5 s, after
  the intro, paused while the tab is hidden, cached like the measured automatic tier, never over a manual choice.
- 2026-11-19: PROT photos (Phase 13): option (a), next/image + Vercel Image Optimization, because plain lazy `<img>`
  (option b) cannot meet the `/prot` < 1 MB target (the 2.1 MB PNG is the second card on phones, inside the lazy-load
  distance) and leaves the detail page at 4.6 MB. Kept inside the Hobby limits (5K transformations, 300K cache reads,
  100K cache writes per month; over the limit new images answer 402): only the PROT bucket under `/prot/**` (https, no
  query) in `images.remotePatterns`, two display sizes (two variants per photo and size), Next 16 defaults otherwise
  (webp only, quality 75, `minimumCacheTTL` 4 h), and the original URL as fallback when optimization fails. No
  third-party image service. Real fix for the source sizes: resize at upload time in the backend (later phase).
- 2026-11-19: Jelajah photo rule (Phase 13): https only; an http URL on a loopback host is accepted only while the page
  itself runs on a loopback host (local `next dev` or `next start`), so the local DEMO placeholder also shows in a local
  production build while the deployed site stays https-only.
- 2026-11-19: Page file (owner, before Phase 13): `D:\pagefile.sys` system managed; a fixed 2 GB page file remains on C:.
- 2026-11-19: Fonts are self-hosted (Phase 13, after the PR #12 Vercel preview failed): `app/layout.tsx` loads Plus Jakarta
  Sans (variable, weights 300–800) and Geist Mono (variable, 100–900) with `next/font/local` from
  `app/fonts/*-latin.woff2` (latin subset, downloaded once from the Google Fonts CSS API, OFL files next to them, sources
  and SHA-256 in `app/fonts/README.md`); same CSS variables `--font-jakarta-sans` / `--font-geist-mono`, swap, preload. No
  build downloads fonts any more; `tests/config/fonts.test.ts` fails on a `next/font/google` import. Finding, not changed:
  `globals.css` sets `--font-sans: var(--font-jakarta-sans)` in a plain `@theme` block (emitted on `:root`, where the
  next/font variable does not exist), so the site actually renders in Tailwind's system font stack, before and after.
  Fixed in Phase 14 (see below).
- 2026-11-19: Owner decisions for Phase 14: the landing page `/` uses the same optimized photo approach as /prot;
  `images.minimumCacheTTL` may be raised to 31 days only if every upload gets a new file name; the Phase 13 http-photo
  rule (http only when both the photo and the page are on a loopback host) is accepted.
- 2026-11-19: Image cache TTL (Phase 14): `images.minimumCacheTTL` = 2678400 (31 days). Checked in the backend: every
  upload path (PROT foto/video/dokumen/peralatan, NFT image, `/upload/image|avatar|document|video`) goes through
  `StorageService.uploadFile()`, which builds the key `<folder>/<randomUUID()>.<ext>` (unchanged since the first
  commit); `getPresignedUrl(key)` takes a caller key but has no caller; nothing else writes to S3. A replaced photo is
  a new upload with a new URL, so no cache entry can go stale. Rule: S3 object keys are never reused; if that ever
  changes, lower the TTL again. Effect: each variant (source URL × width) is transformed at most about once per
  31 days instead of once per 4 hours of being requested.
- 2026-11-19: Landing carousel (Phase 14): shown only from `lg` (1024 px), so its photos are static imports passed
  through `getImageProps` into a `<picture>` whose `<source media="(min-width: 1024px)">` carries the optimized srcset;
  below `lg` the `<img>` shows a 1x1 data URI and downloads nothing. The first slide (the one visible on load,
  `hero.webp`) is eager with high fetch priority; `nusland.webp` (renamed from `nusland (1).webp`) is the second slide
  and lazy. The featured PROT on `/` use `ProtPhoto` `cover` (the /prot variants, no extra transformations).
- 2026-11-19: Events and NFT pages (Phase 14): no `RemotePhoto` and no new `remotePatterns`, because in production the
  only event has no banner and the only NFT has no image or gallery, so these pages load no remote images. Revisit when
  they get images (likely prefixes `/images/nfts/` for NFT uploads; event banners are a free-text URL).
- 2026-11-19: Fonts displayed (Phase 14, own commit so it can be reverted alone): the two font lines moved to
  `@theme inline` in `app/globals.css` and the `body` rule uses `var(--font-jakarta-sans)` directly (with the
  Arial/Helvetica fallbacks), so Plus Jakarta Sans and Geist Mono are used as intended
  (`tests/config/fonts.test.ts`). Jakarta is wider: the landing navbar's right-hand group got tighter spacing below
  `sm` (it overflowed by 1 px at 390 px); nothing else overflowed on `/`, `/prot`, a PROT detail and the Jelajah pages.
- 2026-11-19: Owner decisions for Phase 15 (real rewards, part 1): two currencies, XP (levels, leaderboard, never
  redeemable) and Points (redeemable later for in-platform rewards; never cashed out, never transferable). Actions
  reported by the browser give XP only, never Points; Points come only from server-verified actions (server-graded
  quizzes, organizer-confirmed event check-ins, later realtime-verified mini-games), and Phase 15 has no rule that grants
  them except admin adjustments. Levels: L needs 50 × (L − 1) × L XP. First rules PROVINCE_ENTER +25, PROT_VIEW +10
  (ARSIP_NASIONAL only), PASPOR_STAMP +50 at min(3, province PROT count) views, constants in one file. Points need a
  verified email when granted. No frontend changes until the frontend switches to the new auth.
- 2026-11-19: Local databases get the ledger trigger from `db:setup` (owner decision, Phase 15): `synchronize()` cannot
  create triggers or DESC indexes and the migration baseline only records migrations as applied, so `db-local-setup.ts`
  calls the migration's idempotent static `installDbObjects()` after `synchronize()`. It is a static method, not a second
  export, because TypeORM loads every exported function of a migration file as a migration ("someClass is not a
  constructor"). The migrated and the synchronized schema were compared with `pg_dump` and are identical.
- 2026-11-19: Leaderboard `scope=province` ranks by the XP a user earned IN that province (ledger rows tagged with its
  `provinsi_kode`: PROVINCE_ENTER, PROT_VIEW, PASPOR_STAMP), not by a home province (owner decision, Phase 15). The
  national board uses `reward_balances.xp_total`. Both list only `active` users with more than 0 XP, ranked with
  `RANK()` (ties share a rank, then user id order), show the user's overall level, and return users only as
  `toPublicUser()`. Only the top 50 is cached (60 s, per scope, in memory); the caller's own rank is computed live.
- 2026-11-19: Ledger design details (Phase 15): `currency` is text + CHECK; the XP row of a grant uses the base key, a
  Points row `{base}:POINTS`; a grant is a duplicate when any of its keys exists, so Points withheld for an unverified
  email are not granted later by repeating the action (the XP row records `points_withheld`). `created_at` is
  `clock_timestamp()` so the rows of one transaction keep their order (a PROT_VIEW before the stamp it earns). The
  append-only trigger allows exactly one kind of DELETE: the cascade from a deleted `users` row (the user row is already
  gone), otherwise accounts could never be deleted. `user_prot_views` has no foreign key to `prot` (a recorded view
  survives unpublishing). The Paspor counts only views of PROT that are ARSIP_NASIONAL now, and a repeated PROT_VIEW
  re-checks the stamp (a province whose PROT count dropped may have become complete).
- 2026-11-19: Grant response (Phase 15): `{ granted: {xp, points}, balance: {xp, points, pointsAvailable}, level, levelUp,
  stamp, duplicate, pointsWithheld }`. `granted` is what THIS request added (a PROT_VIEW that earns the stamp reports
  60 XP, `stamp.xp` 50); a duplicate returns `granted` 0 and the current balance with HTTP 200. Invalid references (a
  province code that is not a two-digit province in `daerah`, a PROT that does not exist or is not ARSIP_NASIONAL,
  including drafts) all answer 400 with the same message per type, so drafts cannot be probed.
- 2026-11-19: Admin adjustments (Phase 15): one ADMIN_ADJUST row per request (key `ADMIN_ADJUST:{userId}:{random uuid}`,
  `source_id` = admin id, reason in `metadata`), refused when the balance would go below 0; added Points need a verified
  email and are held like any Points, removed Points count at once. The response carries the new row `id`, which
  `AuditInterceptor` stores as `entity_id`. `points_available_cache` is refreshed on every grant; the endpoints compute
  the live value from the ledger, and the reconciliation reports a stale cache separately (not an error). Exit codes of
  `rewards:reconcile`: 0 clean or fixed, 1 differences without `--fix`, 2 failure.
- 2026-11-19: Existing e2e failure found in Phase 15, not changed: `test/email-flows.e2e-spec.ts` "registering an
  existing email" expects the emails in the order verification, account_exists, but the background queue sometimes
  delivers them the other way round (failed 2 of 2 full runs on main, about half of the full runs on the Phase 15 branch).
- 2026-11-19: Owner decisions for Phase 16 (Jelajah intro bumper): a short animated intro on `/jelajah` that shows
  what the whole site offers before the map; built in code (React + CSS + the existing framer-motion), not a video;
  plays automatically once per browser session (sessionStorage, try/catch), always skippable, replayable from
  "Putar intro"; the hub data and the 3D chunk load behind it; no sound; only real data or neutral text; the site
  name comes from one constant (default: the navbar's "Nusantara Virtual"), so a rename is a one-line change.
- 2026-11-19: Bumper details (Phase 16): 6 scenes of 3 s (the last 4 s), 19 s in total; "Lewati" and Esc skip;
  tap, click or Enter go to the next scene (Enter always means "next", so Lewati is pressed with Space, a click or
  Esc); the bumper is a full-screen `role="dialog"` above the navbar with focus on "Lewati", Tab kept inside, page
  scrolling locked and the hub `inert` behind it; focus goes to the hub's "Tampilan" button afterwards. The
  "session" is the browser tab (sessionStorage); when storage is unavailable an in-memory flag limits it to once
  per page load. Opening a province page also marks the intro as seen, so a visitor who arrived through a deep link
  does not get it on "Kembali ke peta". Number tiles of the community scene show only numbers above 0 (a 0 says
  nothing); while a number is unknown (loading, error) the scene shows its text without it.
- 2026-11-19: Bumper and the tier probe (Phase 16): the first-visit automatic tier probe (0.7 s of frame timing,
  cached in localStorage) measured the bumper's animations and chose lower tiers (headless check: 6 of 6 runs lower,
  3 of them 2d). The auto-played bumper therefore waits on its plain cover until the automatic tier is known (at most
  3 s); afterwards 6 of 6 runs chose full, as without the bumper. On later visits the tier is cached and the bumper
  starts right after hydration.
- 2026-11-19: Bumper logo (Phase 16): the site icon `app/apple-icon.png` (180 px, 6 KB, served at
  `/apple-icon.png`), shown unoptimized next to the accent diamond of the navbar mark; no new image files.
- 2026-11-19: Owner decisions for Phase 17 (first self-hosted game): the website hosts its own games instead of
  linking to external sites; no files of the old external games exist, so games are built from scratch; the first is
  congklak in 2D, light enough for mid-range phones. Games are played without logging in and record nothing (no XP,
  no scores, nothing sent to the backend); only local settings are kept in localStorage (try/catch). Congklak rules
  differ between regions: ONE common ruleset ("Aturan dasar") is implemented and described exactly as implemented,
  without claiming it is the only correct version, with every rule switch in one config file. The landing page's
  external "virtual tour" links are replaced with `/jelajah`. The Jelajah bumper now plays once per day per browser
  (local date in localStorage, versioned key; once per session as the fallback when localStorage is unavailable);
  "Putar intro" and the deep-link rule are unchanged.
- 2026-11-19: Congklak "Aturan dasar" (Phase 17): 2 rows of 7 holes, 7 seeds each (98), one store per player;
  sowing anticlockwise towards the own store, skipping the opponent's store; last seed in the own store = move
  again; in a non-empty small hole (either side) = pick up and keep sowing; in an empty own hole = capture the opposite
  hole plus that seed when the opposite has seeds (switch `captureRequiresLap`, default off), turn ends; in an empty
  opponent hole = turn ends; the game ends when the player to move has no seeds in their small holes, and the
  opponent sweeps their own side into their own store; more seeds wins, equal is a draw. Safety limit 10,000 seeds
  sown per move (never reached in 1,000 random games; longest move 272 seeds).
- 2026-11-19: Congklak AI worker (Phase 17): Next 16.1's Turbopack copies `new Worker(new URL('./x.ts',
  import.meta.url))` files as raw `.ts` assets instead of bundling them (found in the production build; in development
  the worker failed silently and the AI ran on the main thread). The engine and AI therefore live in one
  self-contained function (`lib/games/congklak/core.ts`, type-only imports, no classes, async code or generators) and
  the worker is started from a Blob of its source plus a small handler; a test runs that source in isolation. Without
  Blob workers (old browser, strict CSP) the move is computed on the main thread with a 40 ms limit. Revisit when
  Turbopack bundles worker files (then a plain `ai.worker.ts` can replace the Blob).
- 2026-11-19: Congklak page details (Phase 17): the board is horizontal on landscape and desktop and vertical on
  portrait phones up to 767 px wide ("Kamu" / "Pemain 1" on the right with their store at the top); hole numbers 1 to 7
  follow the sowing order; reduced motion and "Tanpa animasi" show the move at once with a short highlight (no hand,
  no movement); the computer waits at least 250 to 550 ms (by speed) before playing so its moves are readable;
  `from=` on the game page is allowlisted (`jelajah` → "Kembali ke peta", `jelajah-<enterable slug>` → "Kembali ke
  desa"), never an open redirect. The bumper's "Main Congklak" opens `/main/congklak?from=jelajah`.
- 2026-11-19: Owner decisions for Phase 18: the brand is renamed from "Nusantara Virtual" to "Nusantara Legacy"
  everywhere users see it; navbar links to the Jelajah map and the games are shown now; the Jelajah map requires login
  (a logged-out visitor of `/jelajah` or `/jelajah/*` sees a notice, logs in and lands on the page they wanted);
  the games under `/main` stay public; "Mulai Tur Virtual" goes straight to the map for logged-in users (the daily
  bumper rules still apply); landing statistics count only published content (ARSIP_NASIONAL PROT and their
  provinces); the gate uses whatever the frontend uses to know a user is logged in (Supabase today) and moves with it
  when the frontend switches to the self-hosted login.
- 2026-11-19: Login gate details (Phase 18): the static files under `public/jelajah/geo|assets|demo/` stay public (data,
  not pages); `redirectTo` keeps the query (`/jelajah?debug=1`), is a validated same-site path, never `/login` or
  `/signup`, and falls back to `/menu` (the old default); a logged-in visitor on `/login` with a valid `redirectTo`
  goes there instead of `/profile`. Google sign-in carries the target in a 10-minute `np_post_login` cookie instead of
  a query on the Supabase redirect URL, so the Supabase redirect allowlist needs no change. The OAuth callback's
  `next` parameter is validated (it was an open redirect, e.g. `next=@evil.com`). Existing `/login?redirectTo=…`
  links (events, menu) now work too.
- 2026-11-19: Navbar on phones (Phase 18): app navbar = a menu button (below `md`) with the same four links, the brand
  one size smaller and the account chevron hidden below `sm` (fits 360 px with 16 px to spare); landing navbar = a
  second row with "Tur Virtual" and "Game" below `md`, because its bar (brand, theme, Masuk, Daftar) is already full.
- 2026-11-19: Landing statistics (Phase 18): computed in the frontend from the public PROT list with the Jelajah map's
  own code, so they agree with the map and the bumper before the backend change is deployed; the backend
  `/stats/landing` change (published-only PROT and province counts) waits in "Pending deployment". A province
  counts when a published PROT has its code and the code is one of the 35 known provinces (the map's rule).
- 2026-11-19: Concept video (Phase 19, owner decision): a code-driven film, not an mp4 in the app. It plays by itself
  only on the first `/jelajah` visit per browser (`localStorage['np_concept_seen_v1']`), after the intro bumper's daily
  play; `?concept=1` forces it; "Tonton pengenalan" replays it. It counts as seen after 1 s of playing or when it ends, so a
  navigation away in the first second (for example the bumper's "Main Congklak") does not use it up; province pages do not
  mark it (open question in the Phase 19 report). All copy and timings live in `lib/jelajah/concept/script.ts`, except the
  map button's label, which lives in `gate.ts` so the captions stay out of `/jelajah`'s initial JS.
- 2026-11-19: Concept video performance (Phase 19): the first version ran at 3 to 15 fps in headless Chrome (software
  rendering) because moving SVG elements repainted full-screen backgrounds and SVG camera moves re-rasterised the map
  every frame. Rules since then: static backgrounds and moving parts on separate compositor layers (`will-change`), camera
  moves as CSS transforms, the lit map painted once and revealed by a transform-only wipe (the provinces still light west
  to east), the hub not painted under the film. The particles are dropped only when the 2 s average stays below 30 fps for
  3 s (a single first-paint stall had dropped them for the whole film). The dive into Sumatera Selatan stops at 6x (a
  compositor layer keeps its first raster scale, so deeper zooms turn blurry).
- 2026-11-19: Local checks of login-gated pages (Phase 19): the frontend cannot log in locally, so the Phase 19 browser
  checks used a fake Supabase auth endpoint on localhost (`/auth/v1/user` answering a test user) and a matching session
  cookie, in scratch files on D: only (never committed); requests to `/backend-api` had their Authorization header removed,
  so production saw only plain public read-only GETs.
- 2026-11-19: Gasing (Phase 20): the published archive record "Gasing" (Kepulauan Riau) describes Gasing Uri and Gasing
  Pangkah, so the game implements both, paraphrasing and crediting the record (linked to its `/prot` page). Decisions:
  both tops are identical (a heavier "pemangkah" striker made the striker win ~90 % of rounds); the Pangkah round is
  decided like Uri, by spin time measured from each top's own landing, plus out = loss (so a waiting striker gains
  nothing and a hit pays off by shortening the target's spin); a shaky release scatters the landing point so release
  quality also means accuracy; the computer's Sulit search is cheap enough for the main thread (no worker).
- 2026-11-19: Gasing canvas (Phase 20): the browser's default (GPU-backed) 2D canvas, static arena on its own canvas,
  compositor-only shake and meters. `desynchronized: true` is forbidden (frames bypassed the compositor and the tops
  were missing from screenshots, while the fps looked high).
- 2026-11-20: Concept film sound (Phase 21): everything synthesized with the Web Audio API in plain JS (instrument
  buffers rendered once in a Web Worker from a self-contained core, not with OfflineAudioContext: identical in every
  browser and in Node tests, never blocks the film); one shared ConvolverNode reverb instead of reverb baked into each
  buffer (render cost); pelog-inspired pitch set in `lib/audio/pitch.ts`. Sound plays automatically only when the
  browser allows it; otherwise "Nyalakan suara". The scheduler follows the film's own clock and the audio output
  timestamp. Cue times come only from `CONCEPT_SCENES`/`BEATS`; the scene components now read the stamp drop, seed
  roll, ring pulse and arc travel timings from `BEATS` too (the passport stamp's drop changed from 160 to 150 ms to
  match its shake). Both players load the engine through `lib/audio/runtime.ts` (one shared chunk).
- 2026-11-20: More provinces (Phase 22): Aceh, Kepulauan Riau, Jawa Tengah and Sulawesi Selatan are enterable,
  one scene data file each, no new asset files (the four new scenes reuse `v1/nature.glb` and `v1/player.glb`); every
  engine extension is an optional field whose default is the old behaviour, so Sumatera Selatan is unchanged (geometry
  fingerprints recorded on `main`, before/after screenshots differ only in the animated player). Three stands per new
  province, the published PROT on the one nearest to the spawn point; the others say "Segera hadir" until more PROT
  are published. Jawa Barat gets no scene (its only published record is "Test Permainan Jawa Barat"); no record is
  filtered by name in code.
- 2026-11-20: Multi-game pavilions (Phase 22): `PavilionDef.game` is a union (`congklak` | `gasing`), labels and links
  from one map (`lib/games/links.ts`), and `from=jelajah-<slug>` is allowlisted per game, so a province's "Kembali ke
  desa" only appears on the game its pavilion opens. Kepulauan Riau's Gasing arena opens Gasing; provinces without a
  game show a "Game segera hadir" sign and card (no button). The bumper keeps its single congklak button.
- 2026-11-20: Distant landmarks (Phase 22): the fixed 40 degree camera never shows the horizon, so islands, hills and
  the Jawa Tengah volcano stand within about 50 to 95 m of the camera and inside the fog's middle range; they show at
  the top of portrait views and when walking to the north edge, not on desktop at the spawn point.
- 2026-11-20: Egrang (Phase 23): one race against the computer per game, two variants from the two published egrang
  records (Bambu = balance with falls, Batok = rhythm with slips), both sharing one pure engine and input path
  (`stepWorld`; taps and keys stamped with their own time and judged at the 1/120 s step they happened in). The AI is
  the documented typical-player model with its errors scaled per level (calibrated 75 / 50 / 30 % ± 10 per variant).
  The computer's lane is drawn further back and higher (stacked lanes) so the racers never hide each other.
  `backdrop-blur` over the canvas was removed (re-blurring every frame); lane surfaces are pre-rendered strips. The game
  pavilion of Jawa Tengah and Sulawesi Selatan is a separate `gamePavilion` (a practice track next to stand 1) instead of
  the plaza centrepiece, so the Jawa Tengah pendopo stays as it was; new engine parts are appended so the other scenes'
  meshes and colliders are byte-identical (fingerprint tests). Phase 22's toast-over-panel observation fixed: the PROT
  panel's whole header is an avoided overlay and the panel re-measures when it opens.
- 2026-11-20: Paspor stamps (Phase 22): one code-drawn SVG stamp per enterable province (own colour and motif), shown in
  the Paspor and as the icon of the simulated stamp toast; other provinces keep the generic icon.
- 2026-11-19: Phase 18 follow-ups (owner answers): the Supabase redirect allowlist needs no query variants; removing
  `/landing-page/1` and `/2` waits for the cleanup phase. Phase 19: the Jelajah login page shows a note and a link to the
  games instead of "Masuk sebagai Tamu"; the landing page's featured PROT are requested with `status=ARSIP_NASIONAL` and
  filtered again.
- 2026-11-17: Local daerah seed reuses `src/database/migrations/002_replace_daerah_data.sql` (34 provinsi + 514 kab/kota, Kemendagri codes) and the `up()` of `src/migrations/1740500100000-SeedKecamatanKelurahanDesa.ts`; `1738826000000-SeedDaerahBPS.ts` is not used (12 provinces only, codes that do not match the kecamatan CSV) (Phase 05).
- 2026-11-20: Hidden PROT media (Phase 25): until published media can be removed on the backend, the frontend hides
  files with one denylist (`lib/prot/hidden-media.ts`, exact URLs + per-record field rules) applied by every renderer;
  PROT documents are hidden on public pages by default (`NEXT_PUBLIC_SHOW_PROT_DOCUMENTS`), reviewer roles still see
  them. Recognisable children's faces without known consent count as personal data and are hidden too, even when the
  photo matches the game (reversible per entry once the curator confirms consent).
- 2026-11-20: Admin corrections of PROT in any status (Phase 25, pending deploy): `POST /api/admin/prot/:id/media/remove`
  (by exact URL; row lock, save and an `audit_logs` row in one transaction, then the S3 delete; idempotent) and
  `POST /api/admin/prot/:id/revisi` (ARSIP_NASIONAL / DIVERIFIKASI → REVISI, audited). The contributor rule (owner or
  admin, DRAFT / REVISI only) is unchanged. These write their own audit row instead of using `AuditInterceptor`.

## Phase workflow

- Work happens in numbered phases. Each phase uses its own branch phase-XX-<short-slug>, created from the latest main.
- Do only what the phase prompt asks. Anything else you notice goes under "Out-of-scope observations" in the report.
- Every phase ends with a report at nusantara-play-be/docs/phase-reports/phase-XX.md that follows nusantara-play-be/docs/phase-reports/TEMPLATE.md, and the full report is printed as the final message.
- Commit after each completed step of a phase on the phase branch, so an interruption loses as little work as possible.

## Local machine

Windows 11; repos live on drive D: (`D:/Project/Nusantara Legacy/`). C: is small. **Standing rule (owner, 2026-11-18):
everything that uses disk space goes to D:, never C:.** Every cache, temp folder, build output, browser profile,
screenshot, Docker image, volume and container lives on D:; nothing new may be written to C:.

- Before heavy work, check free space on C: and D:. **Stop and tell the owner if C: has less than 3 GB free** or D:
  has less than 10 GB free. Check again after builds, test runs and browser automation.
- Detect the shell first (Git Bash: `export`, PowerShell: `$env:`, cmd: `set`) and set these **session-only** variables for every command. Use forward slashes (`D:/...`):
  - npm cache (also used by npx): `npm_config_cache=D:/dev-cache/npm`
  - Temp files: `TEMP`, `TMP` and `TMPDIR` = `D:/dev-cache/tmp`
- pnpm: always pass `--store-dir D:/.pnpm-store` and a D: cache dir, otherwise pnpm writes its metadata cache to C:. **pnpm 12 has no `--cache-dir` flag** (it fails with a misleading "unexpected argument" error); use `--config.cache-dir=D:/dev-cache/pnpm-cache` (or env `pnpm_config_cache_dir=D:/dev-cache/pnpm-cache`). Also pass `--state-dir D:/dev-cache/pnpm-state`. Example:
  `pnpm install --frozen-lockfile --store-dir D:/.pnpm-store --config.cache-dir=D:/dev-cache/pnpm-cache --state-dir D:/dev-cache/pnpm-state`
  If pnpm complains that node_modules was linked from a different store, the frontend `node_modules` folder may be deleted and reinstalled. Delete nothing else.
- Jest: `npm test -- --cacheDirectory D:/dev-cache/jest`
- Browser automation (headless Chrome): always `--user-data-dir=D:/dev-cache/tmp/<phase>/chrome-profile`; screenshots go to
  `D:/dev-cache/screens/<phase>/`. Downloads and scratch data go to `D:/dev-cache/tmp/<phase>/`.
- Git Bash rewrites arguments that start with `/` into Windows paths (`/prot` → `C:/Program Files/Git/prot`); set
  `MSYS_NO_PATHCONV=1` when passing URL paths to scripts.
- Create these folders if they do not exist.
- Do not change global settings (no `npm config set`, no `pnpm config set --global`, no edits to system or user environment variables) unless the owner asks.
- Docker Desktop's data lives on D: since 2026-11-18 (owner moved it; Docker setting `CustomWslDistroDir` =
  `D:\DockerData\wsl\DockerDesktopWSL`): images, containers and volumes are in
  `D:\DockerData\wsl\DockerDesktopWSL\disk\docker_data.vhdx` (the distro itself in `...\main\ext4.vhdx`). Nothing Docker-related
  remains under `%LOCALAPPDATA%\Docker\wsl`. Phases may pull images and start containers when the phase asks for it (for example
  `npm run db:up`); the volume `nusantara-dev-db-data` survived the move.
- Never connect to the production database. Local PostgreSQL uses port 5432 (Docker container `nusantara-dev-db`, bound to 127.0.0.1).
- Drive letter case (Phase 13 finding): run backend `npm run db:setup` and the e2e tests from a working directory that
  starts with an upper-case `D:\` (for example PowerShell `Set-Location 'D:\Project\Nusantara Legacy\nusantara-play-be'`).
  From a lower-case `d:\` working directory Node loads the entity classes twice (once per path spelling) and the DEMO
  seed fails with "this.subQuery is not a function".
