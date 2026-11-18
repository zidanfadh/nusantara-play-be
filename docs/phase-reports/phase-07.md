# Phase 07: Self-hosted auth, part 1 (foundation) + two small frontend fixes

## 1. Summary

The foundation of the self-hosted authentication is built, tested and committed on
`phase-07-auth-foundation` in both repos. The backend has a new module `src/modules/auth-core/` with
Argon2id password hashing (plus legacy bcrypt verification and a password policy), RS256 access tokens
with `jose`, race-safe rotating refresh tokens with reuse detection and a 20 s grace window, a JWKS
endpoint, and a new `local-jwt` passport strategy. `JwtAuthGuard` now tries `local-jwt` first and then the
unchanged legacy Supabase strategy, which moved to `src/modules/auth/legacy/` and is registered only while
`AUTH_ACCEPT_SUPABASE_TOKENS` is true (default). One hand-written migration makes `users.supabase_user_id`
nullable and adds `user_credentials`, `refresh_tokens` and `auth_identities`. Without the `JWT_*` env vars
the backend boots and behaves exactly as before (verified by an e2e test). No login/register endpoints
yet (Phase 08). The frontend shows the calendar creator's email only when present and redacts
secret-looking keys in the admin audit page. Nothing touched production and nothing was pushed.
**The phase is complete.**

## 2. Git

| Repo | Branch | Base commit | New commits |
|------|--------|-------------|-------------|
| nusantara-play-be | `phase-07-auth-foundation` | `fe447a8` docs(phase-06): phase report (= `main` = `origin/main`) | `e04ac01` feat(auth-core): auth tables, nullable users.supabase_user_id; `49a0673` feat(auth-core): Argon2id passwords, RS256 tokens, refresh rotation, JWKS; `c161775` feat(auth): guard tries local-jwt first, legacy Supabase behind AUTH_ACCEPT_SUPABASE_TOKENS; `a45bd99` test(auth-core): refresh token integration, local token e2e, per-process test keys; `0c34312` docs(phase-07): auth design notes, env vars, pending deployment, decisions; plus the commit that adds this report |
| nusantara-play-fe | `phase-07-auth-foundation` | `bb6d20e` Merge pull request #7 (phase-06-security-fixes) (= `main` = `origin/main`) | `b6a7414` fix(fe): show the calendar creator email only when present; `dcee964` fix(fe): redact secret-looking keys in audit log changes; `76577e9` docs(phase-07): auth design notes, pending deployment, decisions |

Precondition check: both `main` branches were pulled and contain the Phase 06 commits (backend `main` =
`fe447a8` with `9ac659d`, `4d99bdc`, …; frontend `main` = `bb6d20e`, the merge of PR #7 with `2cdabd4`,
`7280df4`).

`git diff --stat main..HEAD` (backend, before the report commit):

```
 .env.example                                       |  24 ++
 .env.local.example                                 |  26 +-
 CLAUDE.md                                          |  67 ++++-
 package-lock.json                                  | 271 ++++++++++++++++++++-
 package.json                                       |   6 +-
 src/app.module.ts                                  |   2 +
 src/common/guards/jwt-auth.guard.ts                | 131 ++++++----
 src/config/auth.config.ts                          | 116 +++++++++
 .../1795100000000-CreateSelfHostedAuthTables.ts    | 116 +++++++++
 .../auth-core/__tests__/auth.config.spec.ts        |  64 +++++
 src/modules/auth-core/__tests__/helpers.ts         |  39 +++
 .../auth-core/__tests__/jwt-auth.guard.spec.ts     | 181 ++++++++++++++
 .../auth-core/__tests__/local-jwt.strategy.spec.ts | 107 ++++++++
 .../auth-core/__tests__/password.service.spec.ts   | 101 ++++++++
 .../auth-core/__tests__/token.service.spec.ts      | 262 ++++++++++++++++++++
 src/modules/auth-core/auth-core.constants.ts       |   2 +
 src/modules/auth-core/auth-core.module.ts          |  39 +++
 src/modules/auth-core/auth-errors.ts               |  56 +++++
 .../auth-core/entities/auth-identity.entity.ts     |  48 ++++
 .../auth-core/entities/refresh-token.entity.ts     |  64 +++++
 .../auth-core/entities/user-credential.entity.ts   |  62 +++++
 src/modules/auth-core/jwks.controller.ts           |  19 ++
 src/modules/auth-core/key-pair.util.ts             |  34 +++
 src/modules/auth-core/key.service.ts               | 142 +++++++++++
 src/modules/auth-core/password.service.ts          | 120 +++++++++
 src/modules/auth-core/refresh-token.service.ts     | 231 ++++++++++++++++++
 src/modules/auth-core/scripts/generate-keys.ts     |  33 +++
 .../auth-core/strategies/bearer-token.strategy.ts  |  50 ++++
 .../auth-core/strategies/local-jwt.strategy.ts     |  49 ++++
 src/modules/auth-core/token.service.ts             | 128 ++++++++++
 src/modules/auth/auth.controller.ts                |   9 +
 src/modules/auth/auth.module.ts                    |   8 +-
 src/modules/auth/legacy/supabase-jwt.strategy.ts   | 116 +++++++++
 src/modules/auth/strategies/jwt.strategy.ts        |  68 ------
 src/modules/users/entities/user.entity.ts          |   6 +-
 test/auth-local.e2e-spec.ts                        | 206 ++++++++++++++++
 test/integration/refresh-token.int-spec.ts         | 218 +++++++++++++++++
 test/test-env.ts                                   |  21 ++
 38 files changed, 3110 insertions(+), 132 deletions(-)
```

`git diff --stat main..HEAD` (frontend):

```
 CLAUDE.md                                  |  45 ++++++++++--
 components/audit/AuditChangesDisplay.tsx   |   7 +-
 components/audit/redact-secrets.ts         |  50 +++++++++++++
 components/calendar/CalendarItemDetail.tsx |  14 +++-
 tests/audit/redact-secrets.test.tsx        | 110 +++++++++++++++++++++++++++++
 tests/calendar/creator-label.test.ts       |  30 ++++++++
 6 files changed, 248 insertions(+), 8 deletions(-)
```

## 3. Changes

### Backend (`nusantara-play-be`)

| File | Why |
|------|-----|
| `package.json` | Dependencies `@node-rs/argon2` ^2.2.2 (Argon2id; prebuilt N-API binaries per platform incl. `linux-x64-musl` for `node:alpine`, no install script), `bcryptjs` ^3.0.3 (pure JS verification of legacy Supabase bcrypt hashes; ships its own types), `jose` ^5.10.0 (JWT sign/verify and JWK export; 5.x because 6.x is ESM-only, see Decisions). No `@types/*` needed. New script `auth:generate-keys`. |
| `package-lock.json` | Lock entries for the three packages and the 13 optional platform packages of `@node-rs/argon2` (nothing else changed). |
| `src/config/auth.config.ts` (new) | Pure parser `readAuthConfig(getEnv)` for all new env vars; PEM base64 decoding; defaults 900 s / 30 days / 20 s; `AUTH_ACCEPT_SUPABASE_TOKENS` default true. |
| `src/migrations/1795100000000-CreateSelfHostedAuthTables.ts` (new) | The one migration: `supabase_user_id` DROP NOT NULL, three new tables with explicit constraint/index names, a guarded `down()`. |
| `src/modules/users/entities/user.entity.ts` | `supabase_user_id` nullable (`string \| null`), still unique. Only this change. |
| `src/modules/auth-core/entities/*.entity.ts` (new) | `UserCredential`, `RefreshToken`, `AuthIdentity`, names identical to the migration. |
| `src/modules/auth-core/password.service.ts` (new) | `hash()`, `verify(hash, algo, password)` → `{ ok, needsRehash }`, `verifyDummy()`, `checkPasswordPolicy()`. |
| `src/modules/auth-core/key.service.ts` (new) | Loads and cross-checks the key pair once; disabled mode with one warning; `getJwks()`. |
| `src/modules/auth-core/token.service.ts` (new) | `signAccessToken(user)` / `verifyAccessToken(token)` (RS256 only, kid/iss/aud/exp, claim shape). |
| `src/modules/auth-core/refresh-token.service.ts` (new) | `issue`, `rotate` (conditional UPDATE in a transaction, grace window, reuse → family revoke), `revokeFamily`, `revokeAllForUser`, `cleanupExpired`. |
| `src/modules/auth-core/auth-errors.ts` (new) | `LocalAuthDisabledError`, `AccessTokenInvalidError`, `RefreshTokenInvalidError` (401 `invalid_refresh_token`), `RefreshConflictError` (409 `refresh_conflict`). |
| `src/modules/auth-core/strategies/bearer-token.strategy.ts` (new) | Minimal passport strategy (bearer token → `validate()`; falsy = fail so passport tries the next strategy). |
| `src/modules/auth-core/strategies/local-jwt.strategy.ts` (new) | `local-jwt` strategy: verify token, load user by id, reject unknown/suspended/inactive; read-only. |
| `src/modules/auth-core/jwks.controller.ts` (new) | `GET /api/auth/jwks.json`, `@Public()`, 404 when disabled, `Cache-Control: public, max-age=300`. |
| `src/modules/auth-core/auth-core.module.ts`, `auth-core.constants.ts`, `key-pair.util.ts` (new) | Module wiring, strategy name, RSA key generation shared by the script and the test env. |
| `src/modules/auth-core/scripts/generate-keys.ts` (new) | `npm run auth:generate-keys`: prints PEMs, key id and `.env` lines; writes nothing. |
| `src/modules/auth/strategies/jwt.strategy.ts` → `src/modules/auth/legacy/supabase-jwt.strategy.ts` (moved, `git mv`) | Legacy strategy isolated; passport name `supabase-jwt`; conditional factory provider; `console.error` → Nest `Logger` (error name only). Verification and sync logic unchanged. |
| `src/modules/auth/auth.module.ts` | Uses the conditional legacy provider; `PassportModule` default strategy `local-jwt`. |
| `src/modules/auth/auth.controller.ts` | Compile fix forced by the nullable column: change-password returns 400 for an account without a Supabase id (none exist yet) instead of calling Supabase with `null`. |
| `src/common/guards/jwt-auth.guard.ts` | Tries `local-jwt` then (if enabled) `supabase-jwt`; same public/protected semantics; Nest `Logger` instead of `console.log`, no user ids logged. |
| `src/app.module.ts` | Registers `AuthCoreModule` (registration only; guard order unchanged). |
| `src/modules/auth-core/__tests__/*.spec.ts` (new) | Unit tests (57): config, passwords, tokens, JWKS, disabled mode, strategy, guard. |
| `test/test-env.ts` | Fresh RS256 key pair per test process (in memory) plus all auth env vars. |
| `test/integration/refresh-token.int-spec.ts` (new) | 9 integration tests on the real test database. |
| `test/auth-local.e2e-spec.ts` (new) | 7 e2e tests with the full AppModule (incl. one app booted without keys). |
| `.env.example`, `.env.local.example` | New env vars with comments; no key material. |
| `CLAUDE.md` | Auth flow, module list, env vars, commands; shared sections (see below). |
| `docs/phase-reports/phase-07.md` (new) | This report. |
| `.env.local` (git-ignored, not committed) | A freshly generated DEV-ONLY key pair (kid `dev-20261118-e186dd42`) and the other auth vars. |

### Frontend (`nusantara-play-fe`)

| File | Why |
|------|-----|
| `components/calendar/CalendarItemDetail.tsx` | New exported `formatCreatorLabel()`: "Name (email)" or just "Name" when the email is missing/empty. |
| `components/audit/redact-secrets.ts` (new) | `isSecretKey()` and deep, non-mutating `redactSecrets()` (any depth, arrays, cycles, depth cap). |
| `components/audit/AuditChangesDisplay.tsx` | Runs `changes` through `redactSecrets()` before any rendering branch. It is the only place that renders audit changes (`AuditLogTable.tsx` delegates to it; grep for `.changes` found nothing else). |
| `tests/audit/redact-secrets.test.tsx` (new) | 30 tests incl. rendering the real component with `react-dom/server` for 4 actions. |
| `tests/calendar/creator-label.test.ts` (new) | 6 tests for the creator label. |
| `CLAUDE.md` | Shared sections (identical to backend), plus two frontend-only notes (audit redaction convention, `.tsx` tests). |

### CLAUDE.md shared sections (identical in both repos, verified with `diff`)

"Current direction" item 4 replaced by the full design notes; "Pending deployment" items 4 (migration),
5 (auth env vars, keys generated on the server) and 6 (audit_log cleanup); "Local development" (key
generation step, login status, test keys); lint baseline after Phase 07; seven Decisions log entries.

## 4. Decisions

1. **Separate module `src/modules/auth-core/`** instead of putting everything into `auth/`. `auth/` is
   built around Supabase (its `AuthService` constructor creates a Supabase client and throws without
   Supabase config). `auth-core` has no Supabase dependency, so the legacy path (`auth/legacy/` and the
   Supabase parts of `auth/`) can later be deleted without touching the new code. Phase 08 controllers can
   import `AuthCoreModule`'s exported services.
2. **`jose` 5.10.0, not 6.x.** jose 6 is ESM-only (`"type": "module"`, no CJS export). The app would load it
   at runtime on Node 24 (`require(esm)`), but Jest with ts-jest (CommonJS) cannot without extra transform
   configuration. jose 5 has the same API (`SignJWT`, `jwtVerify`, `exportJWK`) and accepts Node
   `KeyObject`s.
3. **Guard implementation:** `JwtAuthGuard` no longer extends `AuthGuard('jwt')` (its strategy list is fixed
   at class definition). It calls `passport.authenticate([...names])` itself with the list computed from
   `AUTH_ACCEPT_SUPABASE_TOKENS`, and keeps the old semantics exactly, including `req.user === false` on a
   `@Public()` route without a valid token and `req.user` unset when a strategy errors.
4. **Legacy strategy off = not registered at all** (factory provider returns `null`), so with
   `AUTH_ACCEPT_SUPABASE_TOKENS=false` its constructor (which requires `SUPABASE_URL`) never runs.
5. **Strategy failure vs. error:** `local-jwt` never throws for a bad token (it fails, so the legacy fallback
   runs); only infrastructure errors (DB) are errors. The role used for authorization comes from the
   database row, not from the token claim.
6. **Strategy is read-only:** it does not update `last_login_at` (the old Supabase strategy did on every
   request). Phase 08 should set it on login/refresh.
7. **Invalid keys = disabled**, like missing ones: `KeyService` checks RSA type, ≥ 2048 bits and that the
   public key matches the private key (sign/verify probe). Messages name variables only, never key data.
8. **`JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` also accept a raw PEM** (multi-line or with `\n`), besides the
   specified base64 form, for secret stores that keep PEMs as-is.
9. **Rotation details:** expiry is checked before revocation status (an expired token is a plain 401 and
   never triggers a family revoke); each rotated token gets a fresh 30-day expiry (sliding); a lost race
   (conditional UPDATE affected 0 rows) re-reads the row and goes through the same reuse/grace logic, which
   yields `refresh_conflict`. `refresh_conflict` is HTTP 409; invalid tokens are HTTP 401 with
   `error: 'invalid_refresh_token'` and an internal `reason` (`unknown`, `expired`, `reuse_detected`).
10. **`ip` / `user_agent` meta:** an `ip` that is not a valid IP is stored as `NULL` (the column is `inet`);
    the user agent is truncated to 512 characters.
11. **Schema parity:** every PK/FK/index/check of the new tables has an explicit name in both the entity and
    the migration, `user_credentials.user` is `ManyToOne` (a `OneToOne` would add an extra `REL_…` unique
    constraint on the PK column), ids default to `uuid_generate_v4()` like other TypeORM uuid columns.
    Result: the migrated schema is byte-identical to the `synchronize()` schema (pg_dump diff).
12. **Migration `down()`:** restores `supabase_user_id NOT NULL` only when no row has `NULL`; otherwise it
    keeps the column nullable (with a NOTICE) instead of failing or deleting users.
13. **Config without editing `config.module.ts`:** the guard and services read env vars through
    `ConfigService.get('<ENV_NAME>')` + `readAuthConfig()`, so the allowed "new auth config only" change in
    `src/config/` was enough.
14. **Test keys:** `test/test-env.ts` generates a new RSA key pair at module load in each Jest process;
    nothing is written to disk. The "no keys" e2e test sets the five vars to `''` (not deleted), so
    `.env.local` can never fill them in.
15. **Frontend redaction** matches `api-key` too (superset of the requested apikey/api_key), and replaces
    circular references and nesting deeper than 20 levels by `[REDACTED]` so nothing is shown unchecked.
16. **Tests location:** backend unit tests live in `src/modules/auth-core/__tests__/` (the guard spec too),
    because `src/common/guards/` only allowed changes to `jwt-auth.guard.ts` itself.

## 5. Deviations

- `src/modules/auth/auth.controller.ts` changed (inside the allowed `src/modules/auth/`), but it is a
  behavior change beyond the strategy: making `supabase_user_id` nullable broke the compile of
  `changePassword(user.supabase_user_id, …)`. It now returns 400 "Password change is not available for this
  account yet" for accounts without a Supabase id. No such accounts exist until Phase 08.
- The script `auth:generate-keys` lives in `src/modules/auth-core/scripts/generate-keys.ts`, not
  `src/scripts/`, because `src/scripts/` was not in the allowed list.
- Otherwise none.

## 6. Verification

Shell: Git Bash with `npm_config_cache=D:/dev-cache/npm`, `TEMP/TMP/TMPDIR=D:/dev-cache/tmp`, Jest
`--cacheDirectory D:/dev-cache/jest`, pnpm cache `D:/dev-cache/pnpm-cache`.

| Step | Command | Exit | Result |
|------|---------|------|--------|
| Preconditions | `git checkout main && git pull` (both) | 0 | backend already up to date at `fe447a8`; frontend fast-forwarded to `bb6d20e` |
| Disk (before) | `Get-PSDrive C,D` | 0 | **C: 6.33 GB free, D: 359.07 GB free** |
| DB | `npm run db:up` | 0 | `nusantara-dev-db` Healthy |
| Install | `npm install @node-rs/argon2 bcryptjs jose`, then `npm install jose@^5.10.0` | 0 | argon2 2.2.2, bcryptjs 3.0.3, jose 5.10.0; lockfile has `@node-rs/argon2-linux-x64-musl` |
| Schema | `npm run db:setup` (dev) | 0 | `Migration baseline: 15 migrations recorded as applied (1 new). Pending: none.`; only the known 8 `produk_prot` statements remain (Phase 05) |
| Migration test | snapshot → `migration:revert` → `migration:run` → `migration:revert` → `migration:run` | 0 each | see table in Findings; `diff` of `pg_dump --schema-only` (synchronize vs migrated) differs only in pg_dump's random `\restrict` token |
| Re-setup | `npm run db:setup` (dev) and `-- --database=nusantara_play_test` | 0 | `15 migrations recorded as applied (0 new)` / `(1 new)`, pending none |
| Unit (auth-core) | `npx jest src/modules/auth-core` | 0 | 5 suites, **57 passed** |
| Unit (all) | `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | **30 suites, 349 passed, 0 failed, 0 skipped** |
| Integration | `npm run test:int` | 0 | **4 suites, 20 passed** (9 new) |
| Race test x5 | `jest --config test/jest-int.json -t "parallel rotations"` ×5 | 0 | 1 passed each time (5/5) |
| e2e | `npm run test:e2e` | 0 | **5 suites, 21 passed, 11 skipped** (the 11 skipped are the existing login-dependent events tests), 0 failed |
| Build | `npm run build` | 0 | `nest build` OK |
| Lint (repo) | `npm run lint` | 1 (baseline not 0) | **221 errors, 29 warnings** (Phase 06: 237 / 30) |
| Lint (touched, before → after) | `npx eslint -f json` on touched files, stash vs. working tree | – | `jwt-auth.guard.ts` 17e/1w → 0; `auth.module.ts` 1e → 1e (pre-existing `require-await` in the JwtModule factory); `user.entity.ts` 2e → 2e (pre-existing unused imports); `app.module.ts`, `auth.controller.ts`, `test/test-env.ts` 0 → 0; all new files and the moved legacy strategy 0 |
| Key script | `npm run -s auth:generate-keys -- --prefix=dev` | 0 | 2 PEM blocks + `.env` lines; output piped into `.env.local` only, temp file deleted |
| Smoke | `PORT=3999 node dist/main` with dev `.env.local`; `curl /api/auth/jwks.json`, `/api/users/me` | – | JWKS `{"keys":[{"kty":"RSA","n":"wLzZ…` ; `/users/me` without token 401; boot log shows `AuthCoreModule dependencies initialized`, `JwksController {/api/auth}` |
| FE tests | `pnpm test` | 0 | **7 files, 89 passed** (36 new) |
| FE lint (touched) | `npx eslint` on the 5 touched/new files, before and after | 0 | no problems before or after |
| FE lint (repo) | `pnpm lint` | 1 (baseline) | **44 errors, 87 warnings** (unchanged) |
| FE build | `NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key pnpm build` | 0 | `✓ Compiled successfully in 7.5s`, `✓ Generating static pages … (44/44)` |
| CLAUDE.md | `diff` of the sections from "Current direction" on | 0 | IDENTICAL |
| Disk (after) | `Get-PSDrive C,D` | 0 | **C: 5.94 GB free, D: 359.05 GB free** |

C: lost about 0.4 GB during the phase (Docker data on C: grew with the test runs; npm/pnpm/Jest caches
and temp files were on D:). It is still above the 5 GB stop threshold, but close.

## 7. Manual checks

1. `cd nusantara-play-be && npm run db:up && npm run db:setup`.
2. If your `.env.local` has no `JWT_*` lines: `npm run auth:generate-keys` and paste the three printed
   `JWT_…` lines plus `JWT_ISSUER=nusantara-play-local` and `JWT_AUDIENCE=nusantara-play-local`.
3. `npm run start:dev`, then open http://localhost:3000/api/auth/jwks.json: one RSA key with your `kid`,
   `alg: RS256`, `use: sig`, and no `d`/`p`/`q` fields.
4. Remove (comment out) `JWT_KEY_ID` in `.env.local` and restart: the log shows one
   `[KeyService] Local auth (self-hosted tokens) is DISABLED: missing JWT_KEY_ID …` warning, the app
   runs, `/api/auth/jwks.json` returns 404, `/api/prot` still works.
5. `npm run test:e2e`: `test/auth-local.e2e-spec.ts` shows `/api/users/me` returning 200 for a token signed by
   `TokenService` for the DEMO user and 401 for a forged token.
6. Frontend: as admin_kpoti open the audit log page; a change-password or any row whose `changes` contain
   password/token/secret/api key/authorization keys shows `[REDACTED]` for those values. Open a public
   calendar item: "Dibuat oleh" shows only the name when the email is not sent (no empty "()").

## 8. Findings

### Migration test on `nusantara_play_dev`

| Step | `supabase_user_id` nullable | unique constraints on `users` | new tables |
|------|------|------|------|
| after `db:setup` (synchronize) | YES | `UQ_9362…`, `UQ_9767…` (email, supabase_user_id) | 3 |
| `migration:revert` | NO | same | 0 |
| `migration:run` | YES | same | 3 |
| `migration:revert` | NO | same | 0 |
| `migration:run` | YES | same | 3 |

Schema of the three tables after the last `migration:run` is identical to the `synchronize()` version
(`pg_dump --schema-only` diff = only the random `\restrict` token). A later `db:setup` on the migrated
database reports no new differences.

### Test coverage required by the prompt

| Requirement | Test |
|---|---|
| password hash/verify, bcrypt legacy + needsRehash, policy | `password.service.spec.ts` (Argon2id params, wrong password, outdated params → rehash, `$2a$` bcrypt → rehash, malformed hash, dummy verify, 8/128 bounds, code points, email equality) |
| sign/verify: wrong key, wrong iss, wrong aud, expired, tampered payload, unknown kid | `token.service.spec.ts` (+ HS256 / garbage, non-uuid `sub`) |
| JWKS shape | `token.service.spec.ts` (fields, no private parts, round-trip to the PEM) + e2e |
| disabled mode | `token.service.spec.ts` (each of the 5 vars, invalid/mismatched keys, one warning without key data, JWKS 404) + e2e app without keys |
| strategy accept/reject (suspended, inactive, unknown) | `local-jwt.strategy.spec.ts` (+ no DB write, forged token never queries, disabled) |
| guard fallback and `AUTH_ACCEPT_SUPABASE_TOKENS=false` | `jwt-auth.guard.spec.ts` (order, fallback, refusal, public semantics, error rethrow) |
| issue and rotate; 2 parallel rotations; reuse after grace; expired 401; cleanup | `refresh-token.int-spec.ts` (+ grace reuse, unknown token, revokeFamily/revokeAllForUser, ip/user agent) |
| e2e `/api/users/me` 200 / forged 401 / JWKS | `auth-local.e2e-spec.ts` (+ `@Roles` 403, suspended 401, public routes with any token, last_login_at unchanged) |

### Dependencies

| Package | Version | Why | Install scripts |
|---|---|---|---|
| `@node-rs/argon2` | 2.2.2 | Argon2id hashing (prebuilt binaries per platform via optionalDependencies) | none |
| `bcryptjs` | 3.0.3 | verify legacy Supabase bcrypt hashes; bundled types | none |
| `jose` | 5.10.0 | RS256 JWT sign/verify, JWK export | none |

## 9. Out-of-scope observations

- `JwtAuthGuard` runs twice for most protected routes: once globally (`APP_GUARD`) and again through
  `@UseGuards(JwtAuthGuard, RolesGuard)` on the controllers. With the legacy strategy that means two
  Supabase admin calls and two `last_login_at` writes per request; with `local-jwt` two user lookups. A
  later phase could skip re-authentication when `req.user` is already set.
- The `JwtModule` in `auth.module.ts` (secret `SUPABASE_JWT_SECRET`) is still unused; it can go with the
  legacy cleanup.
- `AuthService.verifyToken()` and the frontend's change-password flow still depend on Supabase; Phase 08
  needs a local change-password for accounts with `user_credentials`.
- `src/common/interfaces/jwt-payload.interface.ts` describes only the Supabase payload; only the legacy
  strategy uses it.
- The frontend type `CalendarItemDetail.creator` (`types/calendar.ts`) still declares `email: string`
  although the backend omits it for public items since Phase 06; the component now handles it, the type
  was not in the allowed files.
- `npm install` prints `install-scripts` warnings for existing packages (`@nestjs/core`, `@scarf/scarf`,
  `unrs-resolver`): this npm version does not run unapproved install scripts. Not caused by this phase.
- `tsc --noEmit -p tsconfig.json` (including spec files) reports pre-existing type errors in several older
  spec files and `blockchain/`; `nest build` (tsconfig.build.json) and ts-jest are unaffected.

## 10. Open questions

1. **Production `JWT_ISSUER` / `JWT_AUDIENCE`:** `.env.example` suggests `https://api.nusantaralegacy.org`
   and `nusantara-play`. Confirm before generating the production config.
2. **Phase 08 cookie scope:** the refresh cookie will be set on the frontend domain via `/backend-api`. Should
   it be host-only for `nusantaralegacy.org` (then `nusantaravirtual.org` and `www.` sessions are separate)
   or should `www.`/the second domain redirect to the apex first?
3. **`last_login_at`:** with self-hosted tokens it is no longer touched on every request. Is "time of the last
   login/refresh" (Phase 08) the meaning the admin user table should show?
4. **audit_log cleanup:** who runs the database redaction (Pending deployment item 6), and should it also
   cover rows written before Phase 06 by other endpoints with token-like keys?

## 11. Ready for next phase?

Yes. Phase 08 can build the login/register/refresh/logout endpoints and cookies on top of
`PasswordService`, `TokenService` and `RefreshTokenService`. Deployment of the backend still needs server
access (Pending deployment items 1 to 6).
