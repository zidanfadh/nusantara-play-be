# Phase 09: Email verification, password reset, and a local mail catcher

## 1. Summary

The backend now has email verification and password reset built on one-time email tokens. Tokens are stored
in a new `auth_tokens` table as hashes only; each is single-use, claimed by one race-safe conditional UPDATE,
and a new link invalidates the older ones. Four public endpoints use them: `verify-email`,
`resend-verification`, `forgot-password` and `reset-password`. Registration now sends either the verification
email or an "akun Anda sudah ada" email; the HTTP answer is unchanged. Emails are in Indonesian, with a text
and an HTML version.

The `local-jwt` strategy now rejects access tokens issued before the last password change (5 s skew). It still
does one query per request, which also yields `emailVerified`. `GET /api/users/me` carries `emailVerified`. A
reusable `@RequireVerifiedEmail()` returns 403 `EMAIL_NOT_VERIFIED`; it is not applied to any route yet. A
daily cron cleans up old refresh and email tokens.

Mailpit runs locally as the mail catcher. Tests never use it; they use a capturing email double.

All unit, integration and e2e tests pass, the build passes, and lint is unchanged. **The phase is complete.**
It was interrupted by a usage limit and resumed (see section 5).

## 2. Git

**nusantara-play-be**: branch `phase-09-email-flows`, base `e4ab674` (main, Phase 08 report).

| Commit | Message |
|---|---|
| `10870dc` | chore(dev): Mailpit mail catcher and Phase 09 env examples |
| `4f50fd4` | feat(auth): auth_tokens and email_verifications tables (migration + entities) |
| `f18da46` | wip(auth): one-time email token service and Phase 09 auth config |
| `8711c52` | feat(auth): email verification, password reset, verified-email guard, token cleanup cron |
| `01a61fb` | test(auth): update existing unit tests for the Phase 09 strategy, hooks and /users/me |
| `972377b` | test(auth): unit tests for Phase 09 token service, email flows, limiter, cleanup, templates, verified-email guard |
| `a6d0f76` | test(auth): Phase 09 integration tests and a capturing email double |
| `b8cff74` | test(auth): Phase 09 e2e email flows; lint-clean touched files |
| `93f8708` | docs(auth): Mailpit walk-through for email verification and password reset |
| `38d76c6` | docs(phase-09): email flows, env vars, self-service migration, decisions, pending deployment, commit-per-step rule |
| (this report) | docs(phase-09): phase report — hash given in the final message |

`git diff --stat e4ab674` (before the report commit): 44 files changed, 4107 insertions(+), 128 deletions(-).

**nusantara-play-fe**: branch `phase-09-email-flows`, base `2610903` (main).

| Commit | Message |
|---|---|
| `7892ff1` | docs(phase-09): email flows, self-service migration, decisions, pending deployment, commit-per-step rule |

`git diff --stat 2610903`: 1 file changed (CLAUDE.md), 42 insertions(+), 4 deletions(-).

Nothing was pushed.

## 3. Changes

### Backend: configuration and Docker

- `docker-compose.dev.yml`: new `mailpit` service (`axllent/mailpit:v1.33.1`, container
  `nusantara-dev-mailpit`). SMTP on `127.0.0.1:1025`, UI on `127.0.0.1:8025`, no volume.
- `.env.local.example`: SMTP settings point to Mailpit; adds `APP_PUBLIC_URL=http://localhost:3001` and both
  TTL variables.
- `.env.example`: adds `APP_PUBLIC_URL` (production value), both TTL variables, and a comment on which emails
  use SMTP.
- `src/config/auth.config.ts`: new settings `emailVerificationTtlHours`, `passwordResetTtlMinutes` and
  `appPublicUrl`, plus the `parseAppPublicUrl()` parser.

### Backend: database

- `src/migrations/1795200000000-CreateEmailAuthTokens.ts`: the one Phase 09 migration. It creates
  `auth_tokens` and `email_verifications`.
- `src/modules/auth-core/entities/auth-token.entity.ts`: entity for `auth_tokens`, with the same explicit
  names as the migration.
- `src/modules/auth-core/entities/email-verification.entity.ts`: entity for `email_verifications`.

### Backend: new auth-core code

- `auth-token.service.ts`: creates, peeks, consumes (race-safe) and cleans up one-time tokens.
- `email-flows.service.ts`: the registration hooks, resend, forgot, verify, reset and the "password changed"
  email. Email work runs in a background queue.
- `email-flows.controller.ts`: the four endpoints.
- `dto/email-flows.dto.ts`: request DTOs.
- `email-send-limiter.service.ts`: 3 emails per address per hour per purpose.
- `auth-cleanup.scheduler.ts`: the daily cleanup cron.
- `email-verification.ts`: where "verified" lives, the one-query user + auth-state loader, and the symbol
  holding the auth state.
- `auth-users.ts`: `normalizeEmail`, `findUsersByEmail` and the policy check, shared without an import cycle.

### Backend: changed auth code

- `auth-core.module.ts`: registers the new providers, controller and entities, and imports
  `NotificationsModule`.
- `auth-errors.ts`: new `InvalidOrExpiredTokenError`.
- `auth-error.filter.ts`: also keeps the `code` field of `invalid_or_expired_token`.
- `local-auth.service.ts`: the hooks now call `EmailFlowsService`; it uses the shared helpers; the session
  `user` gets `emailVerified`; change-password sends the "password changed" email.
- `local-auth.controller.ts`: register passes the client IP; `SessionUser` type.
- `strategies/local-jwt.strategy.ts`: one-query load and the check against password changes.

### Backend: notifications, users, common

- `notifications/auth-email.templates.ts`: the four Indonesian templates (text + HTML).
- `notifications/email.service.ts`: `sendTransactional()`, which never throws and logs only the error name
  and codes.
- `notifications/index.ts`: exports the templates.
- `users/users.controller.ts`: `GET /users/me` adds `emailVerified`.
- `common/guards/verified-email.guard.ts`: `VerifiedEmailGuard`, `EmailNotVerifiedException` and
  `EmailNotVerifiedFilter`.
- `common/decorators/require-verified-email.decorator.ts`: `@RequireVerifiedEmail()`.

### Backend: tests

- New unit specs:
  - `auth-token.service.spec.ts`
  - `email-flows.service.spec.ts`
  - `email-flows-parts.spec.ts` (limiter, scheduler, controller and filter, helpers, hooks)
  - `notifications/auth-email.spec.ts`
  - `common/guards/verified-email.guard.spec.ts` (a test-only route)
- Extended unit specs: `auth.config.spec.ts` and `local-auth.service.spec.ts` (the "password changed" email).
- Updated unit specs: `local-jwt.strategy.spec.ts` (new loader, password-change cases),
  `local-auth.controller.spec.ts`, `users.controller.spec.ts`.
- `test/capturing-email.ts`: the email test double.
- `test/e2e-app.ts`: always installs the double and returns it as `email`.
- `test/test-env.ts`: `SMTP_HOST` is forced empty; adds `SMTP_FROM`, `APP_PUBLIC_URL` and the TTLs.
- `test/integration/email-flows.int-spec.ts`: new integration tests.
- `test/email-flows.e2e-spec.ts`: new e2e tests.

### Docs

- `docs/auth-local-testing.md`: new Mailpit walk-through.
- `CLAUDE.md`: architecture, environment variables, shared sections, Decisions log, Pending deployment item 8,
  lint baseline, and the new commit-after-each-step rule.
- `docs/phase-reports/phase-09.md`: this report.

### Frontend

- `CLAUDE.md`: the shared sections, identical to the backend's.

## 4. Decisions

1. **Where "verified" lives (Step 4.9; Phase 10 relies on it).**
   - Accounts with a password use `user_credentials.email_verified_at`.
   - Accounts without one use a new table, `email_verifications` (`user_id` PK, `method` `email_link` |
     `google`, `verified_at`).
   - `emailVerified` = `email_verified_at IS NOT NULL` OR an `email_verifications` row exists.
   - Why: a credential-less account has nowhere to record it. `user_credentials.password_hash` is NOT NULL, and
     the `users` entity was outside the allowed files.
   - Phase 10: a Google-only account whose Google `email_verified` is true writes a row with method `google`.
   - Both tables are created in the single Phase 09 migration.
2. **How verify-email records credential-less accounts** (Supabase-only today). It inserts an
   `email_verifications` row with method `email_link`. If such an account later resets its password, the reset
   also sets `email_verified_at`.
3. **Email work runs in the background**, after the response. This covers the registration hooks, resend,
   forgot and "password changed". Neither the body nor the timing shows whether an account exists. Failures
   are logged with the error name only. `whenIdle()` exists for tests and shutdown.
4. **Rate-limit semantics.**
   - The limit is counted per normalized address (SHA-256 key, in memory, like Phase 08), for every request,
     whether or not the address is known.
   - Over the limit, the email is silently skipped and the answer is still 200. I let "always 200" win over a
     429.
   - Two buckets: `verification` (registration emails and resend) and `password_reset` (forgot).
   - Registration emails count too, so `register` can't be used to spam an address.
5. **Token type is part of the consume.** A verification token can never reset a password.
6. **A new token deletes older unused tokens** of the same type, serialized with an advisory lock per
   (user, type).
7. **reset-password order.** It checks the length rule, then the token (read-only), then "not the email" (that
   needs the user), then hashes. Only then is the token consumed, inside the write transaction. A policy error
   or a failed write therefore never burns the link.
8. **Clock.** `password_changed_at` uses the app clock (as change-password already does). It is compared with
   `iat`, which is also the app clock, with a 5 s skew.
9. **Change-password and the own session.** The response stays 204. The own session continues through its
   next refresh: the kept refresh family issues a fresh token. This is tested.
10. **"Password changed" email.** It is sent after a reset and after a local change-password. The legacy
    Supabase change-password is left unchanged.
11. **`emailVerified` also on the login/refresh `user`.** This keeps the Phase 08 contract that it is "the same
    object as `/users/me`".
12. **Missing or invalid `APP_PUBLIC_URL`.** Emails with a link are not sent, with a warning; I didn't guess a
    URL. The "akun sudah ada" email is still sent, without the login link.
13. **"Several matches" rule.** It is applied to resend-verification and to the duplicate-registration email as
    well as to forgot-password: nothing is sent and the warning contains no email address.
14. **Daily cron at 03:15 server time.** If one cleanup fails, the other still runs. Only counts are logged.
15. **`SMTP_HOST` is forced empty in `test/test-env.ts`.** `events.e2e-spec.ts` builds its own `AppModule`;
    without this change it would try real SMTP when it registers users.
16. **Mailpit pinned to `v1.33.1`** (released 2026-11-07) rather than v1.34.0, which came out the day before.

## 5. Deviations

**The phase was interrupted by a usage limit and resumed.** This is the state I found on resuming (Steps R2 and
R3):

- Backend branch `phase-09-email-flows` was checked out, with no commits beyond main.
- 10 modified files and 8 untracked files were uncommitted, all kept and fixed forward:
  - modified: compose file, env examples, `auth.config.ts`, `auth-errors.ts`, `auth-error.filter.ts`,
    `local-auth.service.ts`, `local-jwt.strategy.ts`, `email.service.ts`, `notifications/index.ts`
  - untracked: the migration, both entities, `auth-token.service.ts`, `auth-users.ts`,
    `email-send-limiter.service.ts`, `email-verification.ts`, the templates
- The frontend branch existed with no changes.
- `nusantara-dev-db` was healthy. Mailpit was in the compose file but not running.
- The migration had not been run; the `auth_tokens` and `email_verifications` tables did not exist.
- `npm run build` failed with one error: `local-auth.service.ts` imported `./email-flows.service`, which hadn't
  been written yet.
- Unit tests: 4 of 36 suites failed (365 passed, 4 failed). Three suites didn't compile because of that import;
  4 tests in `local-jwt.strategy.spec` failed because of an outdated mock.

Checklist at resume time:

| Step | State on resume |
|---|---|
| 0 | DONE (`db:setup` with Mailpit still to run) |
| 1 | PARTLY (test double missing) |
| 2 | PARTLY (revert/run test missing) |
| 3 | PARTLY (tests missing) |
| 4 | PARTLY (flows service, controller, DTOs, wiring, /me, guard missing) |
| 5 | PARTLY (tests missing) |
| 6 | PARTLY (tests missing) |
| 7 | NOT STARTED |
| 8 | NOT STARTED |
| 9 | NOT STARTED |
| 10 | NOT STARTED |

Nothing was reset, stashed or deleted. From then on I committed after each completed step.

Other deviations:

- **One migration creates two tables** (`auth_tokens` and `email_verifications`). Step 2 named only
  `auth_tokens`, but Step 4.2/4.9 left the storage choice to me (see decision 1).
- **The 4th forgot/resend request within the hour answers 200 without sending, instead of 429.** The prompt
  says these endpoints "always" answer 200 (see decision 4).
- **The e2e "access token issued before the reset" is signed 60 s in the past with the app's `TokenService`.**
  A token from a login seconds before the reset is still inside the 5 s skew by design. The manual Mailpit run
  shows the real login token rejected after waiting 6 s.

## 6. Verification

Free disk space (`df -h`):

| | C: | D: |
|---|---|---|
| Before (Step 0) | 6.0 GB | 360 GB |
| On resume | 5.9 GB | 360 GB |
| After | 5.9 GB | 360 GB |

The Mailpit image is small.

| Command | Exit | Result |
|---|---|---|
| `npm run build` (on resume) | 1 | `TS2307: Cannot find module './email-flows.service'` |
| `npm test` (on resume) | 1 | 4 failed / 32 passed suites; 4 failed / 365 passed tests |
| `npm run db:up` | 0 | `nusantara-dev-db Healthy`, `nusantara-dev-mailpit Healthy` |
| `npm run db:setup` (dev) / `-- --database=nusantara_play_test` | 0 / 0 | `[db:setup] Done.` (daerah counts unchanged, DEMO data present) |
| `migration:revert` → `run` → `revert` → `run` (dev) | 0 each | "CreateEmailAuthTokens1795200000000 has been reverted / executed successfully". After each revert: both tables gone and no migrations row; after each run: `auth_tokens\|email_verifications\|1` |
| `pg_dump -s` of both tables, `synchronize()` vs migration | — | Identical; the only differences are pg_dump's random `\restrict` keys |
| `npm run build` (final) | 0 | `nest build` |
| `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | **41 suites, 507 passed, 0 failed** |
| `npm run test:int` | 0 | **6 suites, 36 passed** (9 new in `email-flows.int-spec.ts`) |
| `npm run test:e2e` | 0 | **7 suites, 53 passed, 2 skipped** (the 2 skips are pre-existing, in `events.e2e-spec.ts`; 7 new tests in `email-flows.e2e-spec.ts`) |
| `npx eslint <all touched and new .ts files>` | 0 | 0 problems |
| `npm run lint` | 1 | 249 problems (220 errors, 29 warnings): unchanged from the Phase 08 baseline |

What the integration tests cover:

- 3 parallel consumes of one token: exactly 1 succeeds.
- 2 parallel verify-email calls: one fulfilled, one `InvalidOrExpiredTokenError`.
- A new token invalidates the older unused one of the same type only.
- A token of one type never works for the other; an expired token never works; the TTLs are 24 h and 60 min.
- Reset revokes all refresh tokens (reason `password_reset`), clears a real lockout (5 failures), sets
  `password_changed_at` and `email_verified_at`; the locked user can then log in with the new password.
- Reset of a Supabase-only account creates `user_credentials`, and `login()` with the new password succeeds.
- verify-email writes `email_verified_at` for a password account and an `email_verifications` row for a
  Supabase-only account.
- Cleanup removes only old tokens.

What the e2e tests cover:

- Register → verification email captured → verify-email → `/users/me` shows `emailVerified: true`. The token
  appears in no log line (all Nest logger levels are spied), and neither does the address.
- Forgot → reset email → reset-password: old password 401, new password 200, old refresh cookie 401, an access
  token from before the reset 401.
- An unknown email gets the same bodies as a known one and no email.
- A duplicate registration gets the "akun sudah ada" email and the same 201.
- 4 forgot requests from 4 different IPs: all 200, exactly 3 emails, and only the newest link works.
- Expired, unknown and wrong-type tokens: 400 `invalid_or_expired_token`; validation errors: 400.
- Change-password: an older access token gives 401, and the own refresh cookie gives a working new token.

**Manual Mailpit run (Step 9).** I ran it against the built backend (`node dist/main`), using `.env.local` with
session-only overrides `SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_USER= SMTP_PASS=
APP_PUBLIC_URL=http://localhost:3001`. Tokens and access tokens are redacted below.

```
== 1. register
{"success":true,"message":"Registration received. If this email can be used, you can now sign in. Check your inbox for further steps."} [HTTP 201]
== 2. Mailpit: verification email
Verifikasi email akun Nusantara Play Anda|Halo Manual Test,
Terima kasih telah mendaftar di Nusantara Play. Silakan verifikasi alamat email Anda dengan membuka tautan berikut:
http://localhost:3001/verify-email?token=<REDACTED>
Tautan ini berlaku selama 24 jam dan hanya dapat digunakan satu kali.
== 3. login before verifying: emailVerified
"emailVerified":false
== 4. verify-email
{"success":true,"message":"Email address verified."} [HTTP 200]
== 5. /users/me after verifying
"emailVerified":true
== 6. verify-email again (single use)
{"statusCode":400,"code":"invalid_or_expired_token","message":"The link is invalid or has expired",...} [HTTP 400]
== 7. forgot-password (known) and (unknown): same body
{"success":true,"message":"If an account with this email exists, we have sent a link to reset the password. Check your inbox."} [HTTP 200]
{"success":true,"message":"If an account with this email exists, we have sent a link to reset the password. Check your inbox."} [HTTP 200]
== 8. Mailpit: reset email
Atur ulang password Nusantara Play|Halo Manual Test,
http://localhost:3001/reset-password?token=<REDACTED>
== 9. reset-password
{"success":true,"message":"Password has been reset. You can now sign in with the new password."} [HTTP 200]
== 10. old password / new password / old access token
old password login: 401
new password login: 200
access token from the login before the reset: 401
== 11. Mailpit: all subjects for this address
 - Verifikasi email akun Nusantara Play Anda
 - Atur ulang password Nusantara Play
 - Password Nusantara Play Anda telah diubah
```

Backend log check: 0 lines contain `token=`. 6 lines contain the test address, and all 6 are TypeORM's own
`query:` debug lines (see section 9); no application log line contains it. The backend was stopped afterwards.

## 7. Manual checks

1. `npm run db:up`. `docker ps` shows `nusantara-dev-db` and `nusantara-dev-mailpit` as healthy.
2. If your dev database was set up before this phase, run `npm run migration:run`.
3. Copy the Phase 09 lines from `.env.local.example` into `.env.local`: the `SMTP_*` lines, `APP_PUBLIC_URL`
   and the TTLs.
4. Run `npm run start:dev` and open http://localhost:8025.
5. Follow `docs/auth-local-testing.md`, section "Email verification and password reset with Mailpit". You
   should see the table in that section:
   - register sends a verification email, and verify-email turns `emailVerified` true
   - forgot sends a reset email (nothing for an unknown address, with the same answer)
   - reset sends the "telah diubah" email
   - the old password gives 401, the new one 200, and an older access token 401
6. Register the same address again: Mailpit shows "Akun Nusantara Play Anda sudah ada", and the HTTP answer
   is the same 201.

## 8. Findings

| Endpoint | Success | Unusable token | Unknown email | Limit |
|---|---|---|---|---|
| `POST /auth/verify-email` | 200 `{success, message}` | 400 `code: invalid_or_expired_token` | — | 30 / min per tracker |
| `POST /auth/resend-verification` | 200, fixed body | — | 200, same body, no email | 30 / min; 3 emails / h per address |
| `POST /auth/forgot-password` | 200, fixed body | — | 200, same body, no email | 30 / min; 3 emails / h per address |
| `POST /auth/reset-password` | 200 `{success, message}` | 400 `code: invalid_or_expired_token` | — | 30 / min per tracker |
| `GET /users/me` | adds `emailVerified` | — | — | — |

| Token | Lifetime | Storage | Single use | A new token… |
|---|---|---|---|---|
| `email_verification` | 24 h (`EMAIL_VERIFICATION_TTL_HOURS`) | SHA-256 hex, `auth_tokens.token_hash` | conditional UPDATE | deletes older unused ones |
| `password_reset` | 60 min (`PASSWORD_RESET_TTL_MINUTES`) | same | same | same |

Requests per authenticated call are unchanged: the local-jwt path still makes one query, which now joins
`user_credentials` and `email_verifications`. `/users/me` makes an extra query only for legacy Supabase tokens.

## 9. Out-of-scope observations

- With `NODE_ENV=development`, `src/database/database.module.ts` enables TypeORM query logging. That writes
  every SQL statement with its parameters to the console, including email addresses and password hashes, and
  only the SHA-256 hashes of tokens. This existed before this phase and is off in production
  (`NODE_ENV=production`). It conflicts with the "no personal data in logs" rule for local logs. Consider
  `logging: ['error']`, or an env switch.
- `.env.local` on this machine still has `SMTP_HOST=smtp.placeholder.invalid` and no `APP_PUBLIC_URL` or
  `AUTH_COOKIE_PATH`. The owner should copy the new lines from `.env.local.example`; I didn't edit the
  git-ignored file.
- `EmailService` still keeps its own private `escapeHtml()` for the admin credential email. It could use the
  exported one from `auth-email.templates.ts`.

## 10. Open questions

1. Is a 200 without sending OK as the answer above the 3-emails-per-hour limit, or would you prefer a 429
   (which every address gets, so it doesn't reveal accounts either)?
2. Which SMTP provider and sender address should production use? Pending deployment item 8 needs real
   credentials; SPF and DKIM for nusantaralegacy.org are recommended.
3. Should existing Supabase users count as verified, since Supabase confirmed their emails? Today they count
   as unverified until they click a link or reset their password. A one-time backfill into
   `email_verifications` from Supabase's `email_confirmed_at` would be possible once someone has production
   access.
4. Phase 10: please confirm that a Google-only account is "verified" through an `email_verifications` row with
   method `google`, written only when Google reports `email_verified: true`.

## 11. Ready for next phase?

Yes. Before production use, the deployment items still need to happen: the migration, `APP_PUBLIC_URL` and
real SMTP credentials (Pending deployment item 8). The frontend pages `/verify-email` and `/reset-password`
come in a later phase.
