# Phase 08: Self-hosted auth, part 2 (endpoints and cookies)

## 1. Summary

The self-hosted auth endpoints are built on top of the Phase 07 services, tested and committed on
`phase-08-auth-endpoints` in both repos:

- **Endpoints:** `POST /api/auth/register`, `/login`, `/refresh`, `/logout` and `/logout-all`, plus a local
  path in `POST /api/auth/change-password`. Accounts without a local password keep the unchanged Supabase flow.
- **Register** never attaches a password to an existing account, and it always answers the same 201 body.
- **Login:**
  - Unknown emails get a dummy verification (constant timing).
  - Failed attempts are counted atomically in SQL, with a lockout after 5 in a row.
  - Legacy bcrypt hashes are rehashed to Argon2id.
  - Suspended and inactive users are refused.
  - `last_login_at` is updated on login and on refresh.
- **Cookies:** the refresh token travels only in the httpOnly, host-only `np_refresh` cookie, and a readable
  `np_logged_in=1` marker is set next to it.
- **Protections:**
  - CSRF check on every cookie endpoint: `X-Requested-With` plus an Origin allowlist, with regex patterns for
    Vercel previews.
  - Generous per-IP throttles.
  - A per-email limit of 10 attempts per 15 minutes.
- **Phase 07 fixes:**
  - `JwtAuthGuard` now verifies the token once per request.
  - The unused `JwtModule` is removed.

All existing tests still pass, plus 70 new unit tests, 7 new integration tests and 16 new e2e tests. Nine
formerly skipped events e2e tests now log in through the new endpoint. A curl walk-through
(`docs/auth-local-testing.md`) was run against a locally started backend. Nothing touched production, no
migration was needed, and nothing was pushed. The frontend changed only in CLAUDE.md.
**The phase is complete.**

## 2. Git

| Repo | Branch | Base commit | New commits |
|------|--------|-------------|-------------|
| nusantara-play-be | `phase-08-auth-endpoints` | `e2efe36` docs(phase-07): phase report (= `main` = `origin/main`) | `e89559b` fix(auth): JwtAuthGuard authenticates once per request; `b90e09c` feat(auth): self-hosted register, login, refresh, logout endpoints and cookies; `3c340b1` test(auth): integration and e2e tests for the login endpoints; `1dbd987` docs(phase-08): auth endpoints, cookies, CSRF, env vars, risks, decisions; plus the commit that adds this report |
| nusantara-play-fe | `phase-08-auth-endpoints` | `0f366ff` Merge pull request #8 (phase-07-auth-foundation) (= `main` = `origin/main`) | `2610903` docs(phase-08): self-hosted auth endpoints, cookies, CSRF, risks, decisions |

Precondition check: both `main` branches were pulled (the frontend's local `main` was 4 commits behind and
was fast-forwarded) and contain the Phase 07 commits (backend: `e04ac01` … `e2efe36`; frontend: `b6a7414`,
`dcee964`, `76577e9`, merged as `0f366ff`).

`git diff --stat main..HEAD` (backend, before the report commit):

```
 .env.example                                       |  13 +
 .env.local.example                                 |  13 +
 CLAUDE.md                                          | 112 +++-
 docs/auth-local-testing.md                         |  96 +++
 package-lock.json                                  |  31 +
 package.json                                       |   2 +
 src/common/guards/csrf.guard.spec.ts               | 117 ++++
 src/common/guards/csrf.guard.ts                    | 122 ++++
 src/common/guards/jwt-auth.guard.ts                |  19 +-
 src/config/auth.config.ts                          |  70 ++-
 src/main.ts                                        |   7 +-
 .../auth-core/__tests__/auth-cookies.spec.ts       | 102 ++++
 .../auth-core/__tests__/auth.config.spec.ts        |  59 ++
 .../auth-core/__tests__/jwt-auth.guard.spec.ts     |  28 +
 .../__tests__/local-auth.controller.spec.ts        | 150 +++++
 .../auth-core/__tests__/local-auth.service.spec.ts | 578 ++++++++++++++++++
 .../__tests__/login-email-limiter.spec.ts          |  35 ++
 src/modules/auth-core/auth-cookies.ts              |  92 +++
 src/modules/auth-core/auth-core.module.ts          |  21 +-
 src/modules/auth-core/auth-error.filter.ts         |  33 ++
 src/modules/auth-core/dto/login.dto.ts             |  17 +
 src/modules/auth-core/dto/register.dto.ts          |  28 +
 src/modules/auth-core/local-auth.controller.ts     | 155 +++++
 src/modules/auth-core/local-auth.service.ts        | 480 +++++++++++++++
 .../auth-core/login-email-limiter.service.ts       |  51 ++
 src/modules/auth-core/refresh-token.service.ts     |  37 ++
 src/modules/auth/auth.controller.spec.ts           | 176 ++++++
 src/modules/auth/auth.controller.ts                |  85 ++-
 src/modules/auth/auth.module.ts                    |  18 +-
 src/modules/auth/dto/change-password.dto.ts        |  32 +-
 test/auth-endpoints.e2e-spec.ts                    | 646 +++++++++++++++++++++
 test/e2e-app.ts                                    |  84 +++
 test/events.e2e-spec.ts                            | 116 ++--
 test/integration/local-auth.int-spec.ts            | 252 ++++++++
 test/test-env.ts                                   |  10 +
 35 files changed, 3804 insertions(+), 83 deletions(-)
```

Frontend `git diff --stat main..HEAD`: `CLAUDE.md | 63 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++-------` (56 insertions, 7 deletions).

## 3. Changes

### Backend: source

- `package.json`, `package-lock.json`: added `cookie-parser@^1.4.7` and `@types/cookie-parser` (dev).
- `src/main.ts`: added `app.use(cookieParser())` and `X-Requested-With` in the CORS `allowedHeaders`. Nothing else changed.
- `src/config/auth.config.ts`: parses `AUTH_COOKIE_PATH`, `AUTH_COOKIE_SECURE`, `FRONTEND_ORIGIN_PATTERNS`,
  `LOGIN_MAX_FAILED` and `LOGIN_LOCK_MINUTES` (pure parser, defaults, validation).
- `src/common/guards/csrf.guard.ts` (new): `CsrfGuard` plus the helpers `isAllowedOrigin`, `csrfFailure` and
  `compileOriginPatterns` (full-match, case-insensitive regexes).
- `src/common/guards/jwt-auth.guard.ts`: marks the request after authenticating; a second run in the same
  request reuses the result (Step 4.1).
- `src/modules/auth-core/local-auth.service.ts` (new): register, login (lockout, rehash, status check),
  refresh, logout, logout-all, local change-password, case-insensitive email lookup, and the Phase 09 hooks.
- `src/modules/auth-core/local-auth.controller.ts` (new): the register, login, refresh, logout and logout-all
  routes; cookies; `@Throttle`; `Cache-Control: no-store` on token responses.
- `src/modules/auth-core/auth-cookies.ts` (new): sets, clears and reads `np_refresh` and `np_logged_in` with
  identical attributes.
- `src/modules/auth-core/login-email-limiter.service.ts` (new): the per-email limit (10 attempts / 15 min) in
  the throttler storage.
- `src/modules/auth-core/auth-error.filter.ts` (new): keeps the `error` code (`refresh_conflict`,
  `invalid_refresh_token`), which the global filter drops.
- `src/modules/auth-core/dto/register.dto.ts`, `dto/login.dto.ts` (new): class-validator DTOs.
- `src/modules/auth-core/refresh-token.service.ts`: added `findActive()` and `revokeAllForUserExcept()`.
- `src/modules/auth-core/auth-core.module.ts`: registers the new controller and providers; exports
  `LocalAuthService` and `CsrfGuard`.
- `src/modules/auth/auth.controller.ts`: change-password splits into the local path (204, CSRF when the
  cookie is present) and the legacy Supabase path (unchanged, 201).
- `src/modules/auth/dto/change-password.dto.ts`: `confirmPassword` is optional; `LegacyChangePasswordDto`
  keeps the old rules for the Supabase path.
- `src/modules/auth/auth.module.ts`: imports `AuthCoreModule`; the unused `JwtModule` is removed (Step 4.2).

### Backend: tests

- `src/modules/auth-core/__tests__/local-auth.service.spec.ts` (new): every service branch.
- `local-auth.controller.spec.ts` (new): cookie handling, including 401 clears the cookies and 409 does not.
- `auth-cookies.spec.ts` (new): cookie attributes.
- `login-email-limiter.spec.ts` (new): the per-email limit.
- `auth.config.spec.ts`: the new parsers.
- `jwt-auth.guard.spec.ts`: proves the strategy runs once.
- `src/common/guards/csrf.guard.spec.ts` (new): CSRF rules.
- `src/modules/auth/auth.controller.spec.ts` (new): the local vs legacy change-password branches.
- `test/integration/local-auth.int-spec.ts` (new): parallel lockout, register race, Supabase-only email,
  case variants, rehash, `last_login_at`.
- `test/auth-endpoints.e2e-spec.ts` (new): the full HTTP flow, cookies (including production mode), CSRF,
  lockout, suspended users, generic errors, throttles, guard-once, audit redaction.
- `test/e2e-app.ts` (new): builds the app like `main.ts` and parses Set-Cookie headers.
- `test/test-env.ts`: forced Phase 08 env values (`AUTH_COOKIE_PATH=/api/auth`, a test origin pattern,
  lockout defaults).
- `test/events.e2e-spec.ts`: the login-dependent block is un-skipped and logs in through the new endpoint.
  Two tests stay skipped (see Deviations).

### Backend: docs

- `docs/auth-local-testing.md` (new): a curl walk-through showing the cookies at each step.
- `.env.example`, `.env.local.example`: the new variables, with comments.
- `CLAUDE.md`: Architecture (endpoints, cookies, CSRF, throttling), module and guard list, env vars, the
  shared sections (see below).

### Frontend

- `CLAUDE.md`: the shared sections, identical to the backend: Current direction (Phase 08 design), Pending
  deployment item 6, Local development, Risks, Lint baseline, Decisions log.

## 4. Decisions

- **Where the code lives:**
  - The new endpoints are in `auth-core` (no Supabase dependency).
  - `change-password` stays in `AuthController`, because one route serves both kinds of account. It branches
    on whether the user has `user_credentials`.
  - The email lookup is in `LocalAuthService` (User repository), not in `UsersService`, which depends on
    Supabase. So `src/modules/users/` is untouched.
- **Responses:**
  - Login returns `{ accessToken, expiresIn, user }`, where `user` is the full users row exactly as
    `GET /api/users/me` returns it (a test compares the keys).
  - Register body: `{ success: true, message: "Registration received. If this email can be used, you can now
    sign in. Check your inbox for further steps." }`.
  - Login 401 message: "Invalid email or password". Login 403 message: "This account cannot sign in".
  - Register hashes the password in every branch, so its response time does not reveal the branch.
  - When several users match one email, register silently does nothing (same 201) and login answers the
    generic 401. Both log a warning that contains no email.
- **Lockout:**
  - The counter is reset only by a correct password. After a lock expires, the next wrong password locks
    again at once.
  - Change-password uses the same counter and lock.
  - A locked account is refused before the password is verified (as specified).
- **Per-email limit:** stored in the existing in-memory `ThrottlerStorage`, keyed by a SHA-256 of the
  normalized email. It counts every attempt, for known and unknown emails and successes and failures alike,
  and answers 429. Limits with several instances are covered in Risks.
- **Throttles:** route-level `@Throttle` overrides of the default throttler (login and register 30/min,
  refresh 60/min per tracker). On these routes they replace the global 100/min (in throttler v6 every route
  has its own bucket anyway).
- **CSRF:**
  - A missing `Origin` header fails the check.
  - Patterns are anchored as `^(?:…)$`; invalid patterns are skipped with a warning (index only).
  - Change-password checks CSRF only when the request carries the `np_refresh` cookie.
- **Error codes:** a new `AuthErrorFilter`, scoped to `LocalAuthController`, keeps the `error` field
  (`refresh_conflict`, `invalid_refresh_token`), which the global `HttpExceptionFilter` drops.
  `src/common/filters` was not in the allowed files.
- **Disabled local auth:** login and refresh answer 503. Register still works, because it needs no keys.
- **Refresh:** a user who is gone, suspended or inactive loses the token family and gets 401.
- **Caching:** login and refresh send `Cache-Control: no-store`. Tokens pass through the Vercel CDN, see the
  existing Risks entry.
- **Change-password status codes:**
  - The local path answers 204 (as specified).
  - The legacy path keeps its old 201 with `{ success, message }`.
  - Supporting both meant writing the response directly (`@Res()`) instead of using Nest's default status.
- **Change-password validation:** the local path uses only the Phase 07 policy (8 to 128 characters, not the
  email), not the old upper/lower/digit rule. The legacy path still applies that rule.
- **JwtAuthGuard:** the "already ran" marker is a Symbol property set only by the guard itself. A `req.user`
  set by anything else does not skip authentication (tested).
- **No migration:** the Phase 07 columns cover everything this phase needs.

## 5. Deviations

- **Two events e2e tests stay skipped:** "should register for event" and "should get user registrations".
  Both now log in through the new endpoint but fail for reasons unrelated to login:
  - they publish the already-published event (400);
  - the event starts 2026-03-01, so registration is closed;
  - the my-registrations test expects both an array and a `.data` property.

  The prompt asks to un-skip only tests that "only needed a working login", so they carry an explanatory
  comment instead. In the other tests I changed only what login needed: the token field name
  (`accessToken`), real users instead of `kurator@test.com` and `user@test.com`, the expected `user_id`, and
  the second user's token in the "other user cannot access" check.
- **`package-lock.json`** changed (cookie-parser). The allowed list names only `package.json`, but the lock
  file follows from it.
- **`src/app.module.ts`** is unchanged: `AuthCoreModule` was already registered, and the new controller is
  registered through it.
- **Throttling** is "on top of" the Phase 06 per-user throttler in the sense of stricter per-route limits on
  the same tracker, not as a second throttler. A second named throttler would apply to every route.

## 6. Verification

| What | Command | Exit | Result |
|------|---------|------|--------|
| Free space before | `df -h /c /d` | 0 | C: 6.0 GB free, D: 360 GB free |
| Preconditions | `git checkout main && git pull --ff-only` (both) | 0 | backend already up to date at `e2efe36`; frontend fast-forwarded to `0f366ff` |
| DB | `npm run db:up`; `npm run db:setup`; `npm run db:setup -- --database=nusantara_play_test` | 0 | container healthy; "DEMO data present … Done." for both |
| Build | `npm run build` | 0 | no errors |
| Unit | `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | **36 suites, 419 passed, 0 failed, 0 skipped** (before: 30 suites, 349 passed) |
| Integration | `npm run test:int -- --cacheDirectory D:/dev-cache/jest` | 0 | **5 suites, 27 passed** (before: 4 suites, 20) |
| Parallel lockout ×5 | `npm run test:int -- --testPathPatterns local-auth` ×5 | 0 | 7 passed each time (5/5) |
| e2e | `npm run test:e2e -- --cacheDirectory D:/dev-cache/jest` | 0 | **6 suites, 46 passed, 2 skipped, 0 failed** (before: 5 suites, 21 passed, 11 skipped) |
| Lint (whole backend) | `eslint "{src,apps,libs,test}/**/*.ts"` | 1 (baseline not 0) | **220 errors, 29 warnings** (before: 221 / 29). `auth.module.ts` went from 1 to 0; `events.e2e-spec.ts` stays at 48; every new file is clean |
| Type check | `npx tsc --noEmit -p tsconfig.json` | 2 | 44 errors, identical before and after (stash check): `blockchain/` (hardhat/chai types) and `token.service.spec.ts:170` (Phase 07). Not touched; `nest build` is unaffected |
| Manual curl run | `docs/auth-local-testing.md` against `node dist/main` on the dev DB | 0 | see section 7 |
| Free space after | `df -h /c /d` | 0 | C: 6.0 GB free, D: 360 GB free |

Notes:
- The e2e console shows `console.error [TypeError: fetch failed] … supabase-placeholder.invalid` once. It comes
  from the test that sends a Supabase-only user through the legacy change-password path; the placeholder host
  cannot resolve, so the request ends in 400 as expected.
- The 2 skipped e2e tests are the ones described under Deviations.

## 7. Manual checks

Follow `docs/auth-local-testing.md`: `.env.local` needs a dev key pair and `AUTH_COOKIE_PATH=/api/auth`;
start the backend with `npm run start:dev`; run the curl block. Output of my run against `node dist/main` on
the dev database (the refresh token value is redacted here):

```
== 1 register
HTTP/1.1 201 Created
{"success":true,"message":"Registration received. If this email can be used, you can now sign in. Check your inbox for further steps."}
== 2 login
HTTP/1.1 200 OK
Set-Cookie: np_refresh=<redacted>; Max-Age=2592000; Path=/api/auth; Expires=Fri, 18 Dec 2026 04:41:15 GMT; HttpOnly; SameSite=Lax
Set-Cookie: np_logged_in=1; Max-Age=2592000; Path=/; Expires=Fri, 18 Dec 2026 04:41:15 GMT; SameSite=Lax
   jar: localhost / np_logged_in <value>
   jar: #HttpOnly_localhost /api/auth np_refresh <value>
== 3 me
200
== 4 refresh
HTTP/1.1 200 OK
   rotated: yes
== 4b no csrf
403
== 4c old cookie (grace)
"statusCode":409,"error":"refresh_conflict"
== 5 logout
HTTP/1.1 204 No Content
Set-Cookie: np_refresh=; Path=/api/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
Set-Cookie: np_logged_in=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax
   jar after logout:
== 6 refresh after logout
"statusCode":401,"error":"invalid_refresh_token"
```

On my first attempt I exported `AUTH_COOKIE_PATH=/api/auth` in Git Bash instead of putting it in
`.env.local`. Git Bash rewrote the value to `C:/Program Files/Git/api/auth`, the parser rejected it and fell
back to `/backend-api/auth`, and refresh then answered 401 because curl did not send the cookie. The doc and
CLAUDE.md now warn about this. The manual test users were deleted from the dev database afterwards.

## 8. Findings

**Endpoint behavior (all covered by e2e tests):**

| Endpoint | Success | Failures |
|----------|---------|----------|
| `POST /api/auth/register` | 201 generic body, no cookies | 400 policy/validation (before any lookup); existing email → same 201, nothing changed |
| `POST /api/auth/login` | 200 `{accessToken, expiresIn: 900, user}` + 2 cookies | 401 generic (unknown, wrong, locked, no credentials, several matches); 403 suspended/inactive; 429 per-email / per-IP; 503 local auth disabled |
| `POST /api/auth/refresh` | 200 + rotated cookie | 403 CSRF; 409 `refresh_conflict` (cookies kept); 401 `invalid_refresh_token` (cookies cleared); 503 disabled |
| `POST /api/auth/logout` | 204, cookies cleared | 403 CSRF |
| `POST /api/auth/logout-all` | 204, cookies cleared, all families revoked | 401 no access token; 403 CSRF |
| `POST /api/auth/change-password` | local 204 (other sessions revoked, own kept) / legacy 201 | 401 wrong current password or locked; 400 policy/same/mismatch; 403 CSRF when the cookie is sent |

**Cookie attributes (verified):**

| Cookie | HttpOnly | Secure | SameSite | Path | Domain | Max-Age |
|--------|----------|--------|----------|------|--------|---------|
| `np_refresh` | yes | production / `AUTH_COOKIE_SECURE` | Lax | `AUTH_COOKIE_PATH` (default `/backend-api/auth`) | none | 2592000 |
| `np_logged_in` | no | same | Lax | `/` | none | 2592000 |

**Race tests:**
- 10 parallel wrong passwords → `failed_login_count` = 10 exactly, locked for 15 min (5/5 runs).
- 2 parallel registrations → 1 user, identical responses (service and HTTP level).

**Audit:** the stored body of `POST /auth/change-password` is
`{"currentPassword":"[REDACTED]","newPassword":"[REDACTED]","confirmPassword":"[REDACTED]"}`.

**JwtAuthGuard:** on `GET /api/users/me` (global guard plus `@UseGuards(JwtAuthGuard, RolesGuard)`),
`LocalJwtStrategy.validate` now runs once (e2e spy) instead of twice.

**JwtModule:** before removing it I checked usage. `grep -rn "JwtService\|@nestjs/jwt" src` matched only the
import in `auth.module.ts`, so it was safe to remove.

## 9. Out-of-scope observations

- `@nestjs/jwt` is still in `package.json` but no longer imported anywhere. It could be removed in a cleanup
  phase.
- `npx tsc --noEmit` reports 44 errors that existed before this phase (`blockchain/` is type-checked by the
  root tsconfig without its own dependencies; `token.service.spec.ts:170` has a JWK typing mismatch).
  `nest build` and Jest are not affected.
- The global `HttpExceptionFilter` drops the `error` field of every HttpException body. Phase 08 works around
  it locally with `AuthErrorFilter`.
- `refresh_tokens` cleanup (`cleanupExpired()`) is still not scheduled (Phase 07 left it for later). Every
  login adds a row, so a cron becomes relevant once the frontend uses these endpoints.
- Access tokens stay valid for up to 15 minutes after a password change. `local-jwt` could compare `iat`
  with `user_credentials.password_changed_at` (one more read per request).
- The two still-skipped events e2e tests have bugs of their own (Deviations).
- `npm install` warns that `unrs-resolver`'s postinstall script is not approved. This existed before; the
  install worked.

## 10. Open questions

1. New accounts can log in immediately, without email verification. Should Phase 09 make verification
   required before login, or only nudge users to verify?
2. Is the lockout trade-off acceptable for now? Anyone who knows an email can lock that account for 15
   minutes, again and again. Options: CAPTCHA after N failures, or an unlock link by email (Phase 09
   infrastructure).
3. Should access tokens issued before the last password change be rejected at once (see Out-of-scope)?
4. Should login work on Vercel preview deployments? If yes, what is the frontend project's preview host name
   pattern for `FRONTEND_ORIGIN_PATTERNS`?
5. In which phase should the two remaining events e2e tests be fixed?

## 11. Ready for next phase?

Yes. Everything is committed locally (not pushed). Production deployment remains blocked by missing server
access, as before. When it happens, follow Pending deployment item 6 in CLAUDE.md, in particular
`FRONTEND_URLS`, which must include nusantaralegacy.org for the CSRF Origin check.
