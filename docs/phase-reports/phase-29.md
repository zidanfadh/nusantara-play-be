`# Phase 29: Frontend on the self-hosted login (email + password), behind a switch
`
`## 1. Summary
`
`The frontend can now sign in with the backend's self-hosted login. The build-time switch `NEXT_PUBLIC_AUTH_MODE`
`chooses `supabase` (the default, which behaves as before) or `local`. One auth facade in `nusantara-play-fe/lib/auth/`
`has two implementations. The build contains only one of them, chosen by aliasing four switch-point modules in
``next.config.ts`. Local-mode builds have no Supabase code anywhere, and supabase-mode pages load within ±1 KB of
``main`. Local mode has every login path in Indonesian, in the Phase 27/28 design: sign-up with the password rules,
`"Cek email kamu", the verify-email landing, forgot/reset password, the lockout message, the legacy hint, the
`unverified-email notice with resend, and "Keluar dari semua perangkat". The session keeps the access token in memory
`only, with single-flight refresh, 401 retry, 409 retry, multi-tab sync and proactive refresh. The backend got two
`additive, enumeration-safe answers: 429 `login_locked` with the remaining time, and `reason` on unusable email links.
`A local end-to-end run against the local backend, database and Mailpit passes (63 checks), with 80 screenshots.
`**The phase is complete.** Production keeps Supabase mode until the backend is deployed (go-live checklist in the
`frontend CLAUDE.md).
`
`## 2. Git
`
`| Repo | Branch | Base | Commits | diff --stat vs base |
`|---|---|---|---|---|
`| nusantara-play-fe | `phase-29-local-auth-frontend` | `489d176` (origin/main, PR #25) | `40d01d7` step 1, `15e6e77` step 2, `71357b7` step 4, `2bee184` step 5, `849efa8` step 6, `9e1e2aa` step 7, `2b74fd5` step 8 (docs) | 75 files changed, 4767 insertions(+), 349 deletions(-) |
`| nusantara-play-be | `phase-29-local-auth-frontend` | `00a3921` | `328fd08` step 0, `d68a2ae` step 3, `31a9653` step 8 (docs), plus this report's commit (hash in the final message) | 14 files changed, 722 insertions(+), 46 deletions(-) (before this report) |
`
`Nothing was pushed.
`
`Preflight (step 0): the highest report was \`phase-28.md\`, so this is phase **29**. No phase branch is unmerged in
`either repo. The frontend's LOCAL \`main\` was stale (PR #24), while \`origin/main\` already contained PR #25 (merge
`\`489d176\`), so it was fast-forwarded and then branched. Ports 3000, 3001, 5432, 1025 and 8025 were free; no container
`was running (\`npm run db:up\` started the local PostgreSQL and Mailpit). The other ports used, 3201 to 3212, were free
`(\`next start\` of the measured builds).
`
`## 3. Changes
`
`**Frontend**
`- `lib/auth/types.ts`, `mode.ts`, `client.ts`, `server.ts`, `server-types.ts`: the facade (types, mode, what the app imports).
`- `lib/auth/impl/{client,server,middleware}.ts`, `impl/ui.tsx`: the four switch points (the supabase versions).
`- `lib/auth/supabase/{client,server,middleware}.ts`: today's Supabase calls, moved unchanged.
`- `lib/auth/local/{session,http,broadcast}.ts`, `impl-{client,server,middleware}.ts`, `impl-ui.tsx`: the local login.
`- `lib/auth/public-routes.ts`: the public routes moved out of `middleware.ts` (the client needs them); local auth pages are public only in local mode.
`- `lib/auth/password-policy.ts`, `resend-limit.ts`, `prefill.ts`: backend password policy, resend pacing, the email hand-over between pages.
`- `contexts/AuthContext.tsx`, `types/auth.ts`, `hooks/useCurrentUser.ts`: now go through the facade (no Supabase types).
`- `lib/api/client.ts`: `authorizedFetch` (one retry hook; null in supabase mode), `ApiError` (status, code), the `EMAIL_NOT_VERIFIED` event.
`- `lib/api/prot.ts`, `lib/api/nfts.ts`: uploads through `authorizedFetch` (no own Supabase calls).
`- `lib/api/base-url.ts`: local mode always uses `/backend-api` in the browser.
`- `middleware.ts`: `middlewareSession` (switch point) instead of `updateSession`; `routeDecision` unchanged.
`- `app/auth/callback/route.ts`, `app/page.tsx`, `app/menu/page.tsx`, `app/landing-page/1|2`: `getServerAuth`/`exchangeOAuthCode`; no token on the server in local mode; `/menu` name via `WelcomeName`.
`- `app/(protected)/layout.tsx`: `hasSession()`; in local mode the login URL keeps `redirectTo`.
`- `app/layout.tsx`: `AuthNotices` (the email-not-verified notice in local mode, nothing in supabase mode).
`- `app/(auth)/layout.tsx`: `<aside>` and `<main>` landmarks (axe).
`- `app/(auth)/{forgot-password,reset-password,verify-email,cek-email}/page.tsx`: new pages (local mode only, 404 otherwise).
`- `components/auth/LoginForm.tsx`, `SignupForm.tsx`: local-mode messages, legacy hint, "Lupa kata sandi?", name field, rules; supabase markup unchanged.
`- `components/auth/SocialAuthButtons.tsx`, `LogoutButton.tsx`, `components/ui/UserNav.tsx`, `components/admin/AdminHeader.tsx`: through the facade; sign-out goes to `afterSignOutPath`.
`- `components/auth/WelcomeName.tsx`, `components/auth/local/*`: the local pages, parts, profile panel, notice.
`- `app/(protected)/profile/page.tsx`: `AccountSecurity` (local mode).
`- `next.config.ts`: `resolveAuthMode`, `LOCAL_AUTH_ALIASES` (turbopack + webpack), `env.NEXT_PUBLIC_AUTH_MODE`, `assertLocalAuthBackend`.
`- `vitest.config.ts`: `testTimeout: 15_000`.
`- `.env.example`: `NEXT_PUBLIC_AUTH_MODE`.
`- `tests/auth/*` (7 new files), `tests/api/base-url.test.ts`, `tests/theme/phase-28-cleanup.test.tsx`: tests.
`- `tests/e2e-local/{README.md,auth-local.e2e.mjs,start-backend.ps1,start-frontend.ps1}`: the local end-to-end run.
`- `CLAUDE.md`: "Self-hosted login in the frontend (Phase 29)" (with the go-live checklist), Architecture, Env Vars, shared sections.
`
`**Backend**
`- `src/modules/auth-core/login-failure-tracker.service.ts` (new): 429 `login_locked` for any email after 5 generic failures.
`- `auth-errors.ts`: `LoginLockedError`, `InvalidOrExpiredTokenError(reason)`, `InvalidTokenReason`.
`- `auth-error.filter.ts`: keeps `reason` and `retryAfterSeconds` and sets `Retry-After`.
`- `local-auth.controller.ts`: tracker around login; `auth-core.module.ts`: provider.
`- `auth-token.service.ts`: `classifyUnusable()` (read-only); `email-flows.service.ts`: throws with the reason.
`- Tests: `__tests__/login-failure-tracker.spec.ts` (new), `local-auth.controller.spec.ts`, `email-flows.service.spec.ts`, `test/auth-endpoints.e2e-spec.ts`, `test/email-flows.e2e-spec.ts`.
`- `CLAUDE.md`: Architecture (auth), shared sections (identical to the frontend). `docs/phase-reports/phase-29.md`: this report.
`
`## 4. Decisions
`
`1. **Build-time selection by module aliases, not runtime checks.** `@/lib/auth/impl/{client,server,middleware,ui}`
`   are real files (the supabase versions, so tsc and Vitest work unchanged). In local mode `next.config.ts` points each
`   path at `lib/auth/local/impl-*`. That gives a hard guarantee in both directions (tested by
`   `tests/auth/mode-isolation.test.ts` and verified in the build output).
`2. **`next.config.ts` always defines `NEXT_PUBLIC_AUTH_MODE`.** An unset public variable is NOT inlined by Next.
`   The first supabase build therefore still carried every local-mode branch as runtime lookups (found in step 7).
`3. **Lockout message without account enumeration.** The backend's lock answered the generic 401 on purpose (Phase 08
`   rule). Instead of revealing locked accounts, `LoginFailureTracker` gives the same 429 to unknown emails. It mirrors
`   the database rule (5 failures → 15 minutes; only a success resets; the next failure after a lock locks again).
`   The 5th wrong password already gets the message.
`4. **No "Supabase-only account" code** (it would reveal accounts). The legacy hint appears with every
`   invalid-credentials error and leads to the reset flow, which migrates the account (Phase 09).
`5. **`reason` on unusable email links** (`used` / `expired` / `invalid`), so the verify landing can say "sudah
`   dipakai". Only the token's holder can ask.
`6. **No new `@RequireVerifiedEmail()` route.** The frontend handles 403 `EMAIL_NOT_VERIFIED` from any call (a notice
`   with resend) and shows the status with resend on the profile.
`7. **Local mode routes every browser call through `/backend-api`, also in development.** Host-only cookies of the
`   frontend origin are what production uses. Consequence: `BACKEND_ORIGIN` is required outside Vercel (guard),
`   otherwise a developer's local-mode build would send logins to the production API.
`8. **Where the email goes between pages**: sessionStorage of the tab (`np_auth_email_prefill_v1`), never a URL
`   (URLs end up in history, logs and referrers). The token pages remove the token from the address bar and send no
`   referrer.
`9. **Proactive refresh lead = min(60 s, half the TTL)**, so a short local test TTL does not refresh in a loop.
`   Production (900 s) keeps 60 s.
`10. **Logout destinations**: local mode goes to `/` (as asked); supabase mode keeps `/login`.
`11. **A session that ends by itself** (refresh 401, a stale or forged `np_logged_in` at start-up, a sign-out in another
`    tab) sends a protected page to `/login?redirectTo=…&reason=…`. The middleware only sees the hint, so this keeps the
`    Jelajah gate in local mode. Public pages just become signed out.
`12. **Auth layout landmarks** (`<aside>`, `<main>`): axe reported only best-practice landmark findings (no WCAG
`    failure). The fix changes the layout's markup in both modes (two element names, same classes and look).
`13. **Resend pacing in the UI**: 60 s between sends and at most 3 per hour per purpose, matching the backend's silent
`    3-per-hour limit. Only send times are stored.
`14. **The e2e script uses `playwright-core` from `D:/dev-cache/tools/pw`** (documented), not a repo dependency
`    (no lockfile change), plus the installed Chrome.
`
`## 5. Deviations
`
`- **Scenario (7)**: no backend route uses `@RequireVerifiedEmail()` yet, so the end-to-end run answers ONE request with
`  the backend's exact 403 `EMAIL_NOT_VERIFIED` shape (Playwright route) to exercise the frontend's handling. The
`  unverified message and the resend (a real new email in Mailpit) run against the real backend.
`- **Scenario (5)**: the 401 → refresh → retry path is triggered by sending one `/users/me` request with a token the
`  server rejects (Playwright rewrites the Authorization header once). With a real expired token the client refreshes
`  BEFORE sending, because it knows the expiry. The proactive refresh runs for real with a 20 s TTL (4 refreshes in 43 s).
`- **Screenshots**: rare states (verify used/expired/invalid, reset done/expired, lockout, unverified profile, the
`  notice) are produced with route answers in the backend's exact shapes. The real flows are checked by scenarios 1 to 8.
`- **Scenario (9)** is checked by `pnpm test` and the build comparison (section 8.3), not by the browser script.
`- **"Keluar dari semua perangkat"** is on the profile page (the backend supports it); no other placement was asked.
`- **Bundle budget**: per-page JS is within ±1 KB of `main`. The total of all chunk files on disk differs more (+46 KB),
`  because the four new pages and the lazily loaded modules are separate chunks that supabase pages never load (8.3).
`
`## 6. Verification
`
`| Command | Result |
`|---|---|
`| Frontend `npx vitest run` (full) | exit 0, **97 files, 1288 passed**, 0 failed |
`| Frontend `npx tsc --noEmit` | exit 0 |
`| Frontend `npx eslint .` | 43 errors, 64 warnings = baseline (every new file clean) |
`| Frontend `pnpm check:jelajah` | exit 0, "check:jelajah OK" |
`| Frontend `next build` supabase mode | exit 0 |
`| Frontend `next build` local mode (`NEXT_PUBLIC_AUTH_MODE=local`, `BACKEND_ORIGIN=http://localhost:3000`) | exit 0 |
`| `main` (489d176) `next build` in a D: worktree | exit 0 (reference) |
`| axe-core 4.10.2 (wcag2a/aa, wcag21a/aa, best-practice) on 9 auth URLs × 2 viewports × 2 themes | **0 violations** (36 runs; before the landmark fix: 72 best-practice findings, 0 WCAG) |
`| `node tests/e2e-local/auth-local.e2e.mjs --no-screens` (final build) | exit 0, **63 passed, 0 failed** (204 s) |
`| `node tests/e2e-local/auth-local.e2e.mjs --screens-only` | exit 0, 80 screenshots |
`| Backend `npx jest` (unit, full) | exit 0, **49 suites, 633 passed** |
`| Backend `npm run test:e2e` (full) | exit 0, **10 suites, 69 passed, 2 skipped** (the known skips) |
`| Backend `npm run test:int` | exit 1: 6 suites pass; `verifikasi-queue.int-spec.ts` 4 failures, **identical on 00a3921** (section 9) |
`| Backend `npm run build` | exit 0 |
`| Backend lint (whole repo) | 219 errors, 29 warnings = baseline; every touched file 0 before and after |
`
`Notes: one earlier run of the email-flows e2e hit the known flaky email-order test (Phase 15 decisions log); the full
`run passed. During the end-to-end development runs, 6 failures were all test-script issues (fields filled before
`hydration, waiting for `load` on 3D pages, a correct 60 s resend pause, `/admin` not being a page). One forged-cookie
`failure in a long run was most likely the shared local per-IP refresh limit (every request comes from 127.0.0.1).
`After those fixes the final run passed 63 of 63.
`
`Free space: start C: 8.04 GB, D: 340.67 GB; end C: 8.03 GB, D: 341.11 GB (C: stayed above 3 GB throughout).
`
`## 7. Manual checks (Windows PowerShell, everything on D:)
`
`1. Setup once: `nusantara-play-fe/tests/e2e-local/README.md` "One-time setup" (playwright-core in
`   `D:\dev-cache\tools\pw`). The backend `.env.local` needs the dev JWT keys (`npm run auth:generate-keys`).
`2. Window 1: `Set-Location 'D:\Project\Nusantara Legacy\nusantara-play-be'`; `$env:npm_config_cache='D:/dev-cache/npm'`;
`   `npm run db:up; npm run db:setup; npm run build`; then
`   `powershell -ExecutionPolicy Bypass -File ..\nusantara-play-fe\tests\e2e-local\start-backend.ps1` → "Nest application
`   successfully started" on port 3000 (token TTL 20 s).
`3. Window 2: `Set-Location 'D:\Project\Nusantara Legacy\nusantara-play-fe'`;
`   `powershell -ExecutionPolicy Bypass -File tests\e2e-local\start-frontend.ps1` → build, then "Ready" on 3001.
`4. Browser http://localhost:3001/jelajah → `/login?redirectTo=%2Fjelajah&reason=jelajah`, the Jelajah notice, no Google
`   button, no "Masuk sebagai Tamu". "Daftar sekarang" → fill name, email (`kamu@example.test`), password → the rules
`   tick → "Cek email kamu".
`5. http://localhost:8025 (Mailpit) → the verification email → its link → "Email terverifikasi". Open it again →
`   "Tautan sudah dipakai".
`6. Log in with `?redirectTo=%2Fjelajah` → the map opens. DevTools → Application → Cookies: `np_refresh` (HttpOnly,
`   Path `/backend-api/auth`), `np_logged_in=1`; Local/Session Storage contain no token.
`7. Open a second tab on http://localhost:3001/profile → "Keamanan akun". "Logout" in the first tab → the second goes
`   to `/login?redirectTo=%2Fprofile`.
`8. 5 wrong passwords → attempts 1–4 "Email atau kata sandi salah." + "Akun lama? …", the 5th "Terlalu banyak
`   percobaan. Coba lagi dalam 15 menit."
`9. "Lupa kata sandi?" → pre-filled → Mailpit → reset link → new password → "Kata sandi diperbarui" → log in with it.
`10. Automated: `node tests\e2e-local\auth-local.e2e.mjs` → "… passed, 0 failed"; screenshots in
`    `D:\dev-cache\screens\phase-29\`.
`11. Supabase mode unchanged: `pnpm test`, and `pnpm build` without `NEXT_PUBLIC_AUTH_MODE`. The login page shows "Masuk
`    dengan Google"; `/forgot-password` is a 404 (logged out: a redirect to `/login`, as for any unknown page).
`
`## 8. Findings
`
`### 8.1 Inventory (step 0)
`
`#### A. Every Supabase usage in the frontend, and its local-mode replacement
`
`| # | File | What it does today (Supabase) | Local mode |
`|---|------|-------------------------------|------------|
`| 1 | `lib/supabase/client.ts` | `createBrowserClient(URL, ANON_KEY)` | not loaded |
`| 2 | `lib/supabase/server.ts` | `createServerClient` on the request cookies (server components, callback) | not loaded |
`| 3 | `lib/supabase/middleware.ts` | `updateSession()`: refreshes the Supabase session cookies, returns the user | not loaded; the middleware reads the `np_logged_in` hint |
`| 4 | `contexts/AuthContext.tsx` | `onAuthStateChange`, `getSession`, `signInWithPassword`, `signUp`, `signOut`, `getAccessToken` | the facade (`lib/auth/`) |
`| 5 | `types/auth.ts` | imports Supabase `User`/`Session` types for the context | own types in `lib/auth/types.ts` |
`| 6 | `lib/api/client.ts` | `getSession()` → `Authorization: Bearer` on every `apiClient` call | facade token; on 401 refresh once and retry once; refresh failure → login with `redirectTo` |
`| 7 | `lib/api/prot.ts` (`getAuthToken`, 4 multipart uploads) | Bearer from `getSession()` | same authorized fetch as `apiClient` |
`| 8 | `lib/api/nfts.ts` (`uploadImage`) | Bearer from `getSession()` | same authorized fetch |
`| 9 | `hooks/useCurrentUser.ts` | session present? → `GET /users/me` (role, profile) | the facade's `currentUser()` (user from login/refresh = `/users/me`), live on sign-in/out in other tabs |
`| 10 | `app/(protected)/layout.tsx` | client check `getUser()`, else `router.push('/login')` | facade session check, same push |
`| 11 | `middleware.ts` | `updateSession()` → `routeDecision(Boolean(user), …)` (Phase 18 gate) | `routeDecision(hasLoggedInHint, …)`; pure `routeDecision` unchanged |
`| 12 | `app/auth/callback/route.ts` | Google OAuth `exchangeCodeForSession`; target from `next` or the Phase 18 `np_post_login` cookie, cleared | Google is NOT in this phase: in local mode the route only clears the cookie and redirects to `/login` (no Supabase import) |
`| 13 | `components/auth/SocialAuthButtons.tsx` | `signInWithOAuth('google')`, stores the `np_post_login` cookie | hidden in local mode (the buttons and the "atau …" divider) |
`| 14 | `components/auth/LoginForm.tsx`, `SignupForm.tsx`, `LogoutButton.tsx` | `useAuth()` → context → Supabase | facade; local-mode messages (lockout, legacy hint, "Cek email kamu") |
`| 15 | `components/ui/UserNav.tsx` | `useCurrentUser` + `signOut` → `/login` | facade; local sign-out goes to `/` |
`| 16 | `components/admin/AdminHeader.tsx` | own `createClient().auth.signOut()` → `/login` | facade sign-out |
`| 17 | `app/page.tsx` (server) | `getUser()` (navbar and hero buttons), `getSession()` → token sent with the featured PROT and `/stats/landing` fetches | no token on the server: both fetches public (featured PROT is already `status=ARSIP_NASIONAL` + filtered again; stats are public); logged-in UI from the `np_logged_in` hint (display only) |
`| 18 | `app/menu/page.tsx` (server) | `getUser()` → `user_metadata.full_name` for "Selamat Datang, X" | first name from the facade user in a small client component (no server token) |
`| 19 | `app/landing-page/1`, `/2` (server, old drafts) | `getUser()` for logged-in UI | the `np_logged_in` hint (display only) |
`| 20 | Role checks: `canSeeProtDocuments(user?.role)` (Phase 25, `/prot/[id]`), `selfReviewState(user, …)` (Phase 26 review page), admin layout and pages, ProtTabBar, CalendarTabBar, marketplace, events | role from `useCurrentUser()` = backend `GET /users/me` (already NOT from Supabase) | unchanged code; `useCurrentUser` gets the backend user through the facade |
`| 21 | `tests/middleware/login-gate.test.tsx` | mocks `@/lib/supabase/client` and `@/hooks/useAuth` | still valid for supabase mode; new tests for local mode |
`| 22 | Local test harness "fake Supabase" (Phase 19/26, scratch only, `D:/dev-cache/tmp/phase-26/pw/fake-supabase.mjs`, never committed) | fake `/auth/v1/user` + a hand-made `sb-*` session cookie so a local build looks logged in | not needed in local mode: the real local backend login is used (`tests/e2e-local/`) |
`| 23 | `package.json` `@supabase/ssr`, `@supabase/supabase-js`; `.env.example` `NEXT_PUBLIC_SUPABASE_*` | dependencies and env | stay (supabase mode is the default); not bundled in local mode (verified in step 7) |
`| 24 | `types/user.ts` `supabase_user_id` | a field of the backend user | unchanged (data, not code) |
`
`Server components that sent the visitor's token: **only `app/page.tsx`** (featured PROT and `/stats/landing`). Both become
`public fetches in local mode. No other server component, route handler or `lib/api` function runs with a token on the server.
`
`#### B. Backend auth endpoints (read from the code, base `00a3921`)
`
`All under `/api/auth` (browser: `/backend-api/auth/*` through the rewrite). Error bodies of the global `HttpExceptionFilter`:
``{statusCode, timestamp, path, method, message}`; `AuthErrorFilter` (scoped to the auth controllers) adds `error` / `code`.
`
`| Method + path | Request | Success | Errors |
`|---|---|---|---|
`| `POST /register` | `{email, password, full_name}` (DTO: email ≤ 254, password ≤ 1024, full_name ≤ 255, all required; whitelist) | 201 `{success:true, message}` ALWAYS the same (new, existing, Supabase-only) | 400 policy (`Password must be at least 8 characters long` / `at most 128` / `must not be the same as the email address`), 400 validation, 429 throttle |
`| `POST /login` | `{email, password}` | 200 `{accessToken, expiresIn, user}` + cookies `np_refresh` (httpOnly, Path=`AUTH_COOKIE_PATH`) and `np_logged_in=1` (Path=/), `Cache-Control: no-store` | **401 `Invalid email or password` for unknown email, wrong password, LOCKED account and Supabase-only account (no `user_credentials`)**; 403 `This account cannot sign in` (suspended/inactive, only after a correct password); 429 `Too many login attempts. Try again later.` (10 / 15 min per email, no retry time); 429 per-IP throttle; 503 local auth disabled |
`| `POST /refresh` | cookie + CSRF | 200 like login (rotated cookie) | 409 `{error:"refresh_conflict"}` (cookies kept), 401 `{error:"invalid_refresh_token"}` (cookies cleared), 403 CSRF, 503 |
`| `POST /logout` | cookie + CSRF | 204, cookies cleared | 403 CSRF |
`| `POST /logout-all` | Bearer + CSRF | 204, every refresh token revoked | 401, 403 |
`| `POST /verify-email` | `{token}` | 200 `{success, message:"Email address verified."}` | 400 `{code:"invalid_or_expired_token"}` (one code for unknown, used, expired) |
`| `POST /resend-verification` | `{email}` | 200 fixed body, always (work in the background; 3 / hour / address, silently skipped above) | 400 validation, 429 throttle |
`| `POST /forgot-password` | `{email}` | 200 fixed body, always (any account incl. Supabase-only) | 400 validation, 429 throttle |
`| `POST /reset-password` | `{token, newPassword}` | 200 `{success, message}`; creates `user_credentials` for Supabase-only accounts; revokes all refresh tokens; older access tokens rejected | 400 policy, 400 `invalid_or_expired_token` |
`| `POST /change-password` (AuthController) | Bearer (+ CSRF when the cookie is sent) | local: 204; legacy: 201 | 401 / 400 |
`| `GET /users/me` | Bearer | the user incl. `role`, `emailVerified` | 401 |
`| `@RequireVerifiedEmail()` | — | — | 403 `{code:"EMAIL_NOT_VERIFIED"}`; **applied to no route yet** |
`
`CSRF: `X-Requested-With: nusantara-play` + `Origin` in `FRONTEND_URLS` (or `FRONTEND_ORIGIN_PATTERNS`).
`Email links (`email-flows.service.ts`): `{APP_PUBLIC_URL}/verify-email?token=…`, `{APP_PUBLIC_URL}/reset-password?token=…`,
`and the "akun sudah ada" email links `{APP_PUBLIC_URL}/login`. Password policy: 8 to 128 characters (code points), not
`equal to the email (case-insensitive).
`
`**Gaps found:**
`1. Lockout: the locked account answers the generic 401, so the frontend cannot say "Coba lagi dalam N menit". The 429 of
`   the per-email limit has no retry time either. → Added in step 3, **enumeration-safe** (see Decisions): an in-memory
`   per-email failure counter that treats known and unknown emails alike; at 5 failures the login answers 429
`   `{code:"login_locked", retryAfterSeconds}` + `Retry-After` for 15 minutes.
`2. Supabase-only account: also the generic 401. A code that singles it out would reveal that an account exists for the
`   email (Phase 08 rule: generic errors never reveal accounts). → **Not added.** The frontend shows the legacy hint
`   ("Akun lama? Atur kata sandi baru sekali lewat email") with EVERY invalid-credentials error instead; it leads to the
`   forgot-password flow with the email pre-filled.
`3. verify-email: one code for used and expired links, but the landing page must tell success / expired / used apart. →
`   Added in step 3: `reason: "used" | "expired" | "invalid"` next to `code` (only the holder of the 32-byte token can
`   ask, so it reveals nothing about other accounts).
`4. No route uses `@RequireVerifiedEmail()` yet, so no real endpoint answers `EMAIL_NOT_VERIFIED`. Not added (an endpoint
`   without a feature); the frontend handles the code globally, tested with a mocked response (see Deviations).
`
`#### C. Rewrite and cookies
`
``next.config.ts` `rewrites()`: `/backend-api/:path*` → `${resolveBackendOrigin(BACKEND_ORIGIN)}/api/:path*`, default
`origin `https://api.nusantaralegacy.org` (validated; invalid fails the build). `BACKEND_ORIGIN` already exists and is
`reused. The backend sets cookies without a Domain attribute, so through the rewrite they are host-only cookies of the
`frontend origin; `np_refresh` needs `AUTH_COOKIE_PATH=/backend-api/auth` (the backend default). In development
``getBackendApiUrl()` returns `NEXT_PUBLIC_BACKEND_API_URL` (cross-origin); the local auth code therefore always uses the
`same-origin `/backend-api` path, so `BACKEND_ORIGIN` must point at the local backend in local mode (checked by
``next.config.ts`, see step 1).
`
`### 8.2 End-to-end results (final run, local backend, TTL 20 s)
`
`| Scenario | Result |
`|---|---|
`| 1 sign up → Mailpit → verify (success, then used) → sign in → `/jelajah` via redirectTo; host-only cookies; no token in storage | pass (13 checks) |
`| 2 five wrong passwords → "… Coba lagi dalam 15 menit."; the correct password refused while locked; an unknown email gets identical messages | pass |
`| 3 forgot (pre-filled, not via URL) → Mailpit → reset → sign in; reset link reuse "used"; old password refused; the other browser's session → `/login?redirectTo=%2Fprofile` | pass |
`| 4 Supabase-only user inserted into `nusantara_play_dev` → legacy hint → pre-filled legacy forgot → reset → sign in; credentials created, email verified | pass |
`| 5 proactive refresh (4 in 43 s, no logout); a refused token → users/me 401, 200 with one refresh in between | pass |
`| 6 sign-in picked up by a second tab; both tabs refreshing at once (requests held and released together): statuses 409, 200, 200, both stay signed in; sign-out → the other tab to the login | pass |
`| 7 unverified user signs in; profile message; resend → new email in Mailpit; 403 EMAIL_NOT_VERIFIED → notice | pass |
`| 8 `/main`, `/main/congklak` public; province deep link → login with target + reason; games note; forged `np_logged_in` → refresh 401 → login; roles: publik (no Tambah, no Antrean, no admin), kurator_daerah (Tambah, Antrean), pakar (Antrean), admin_kpoti (all + `/admin/dashboard`) | pass |
`
`### 8.3 Production builds
`
`Gzip of the JS each page loads (`next start`, HTML script tags), bytes:
`
`| Page | main 489d176 | Phase 29 supabase mode | Δ | Phase 29 local mode |
`|---|---|---|---|---|
`| `/` | 298,428 | 298,863 | +435 | 252,716 |
`| `/login` | 239,465 | 240,131 | +666 | 192,646 |
`| `/signup` | 239,401 | 240,214 | +813 | 192,647 |
`| `/main` | 293,756 | 293,190 | −566 | 246,170 |
`| `/prot` | 308,402 | 308,352 | −50 | 260,684 |
`| `/menu` | 293,756 | 293,190 | −566 | 246,170 |
`
`- Supabase mode: no local-login code on these pages (the only traces are the 100-byte email hand-over helper and the
`  legacy hint string on `/login`). All chunk files on disk: 1,177,239 vs 1,131,176 (+46 KB). That includes the chunks
`  of the four new local pages (4 chunks, 19.9 KB, never loaded in supabase mode) and the lazily loaded users API.
`- Local mode: 0 client chunks, 0 server files and no middleware code with Supabase (the only matches were two source
`  maps quoting a comment). Pages load about 46 KB gzip less.
`- Path of the measurement: the first supabase build was +2 to +5 KB per page. Three causes were found and fixed:
`  the variable was not inlined; client components imported by the root layout are loaded on every page; the
`  supabase facade imported the users API statically.
`
`### 8.4 Screenshots
`
``D:/dev-cache/screens/phase-29/`: 80 files = 20 states × {390x844, 1440x900} × {light, dark}. States: login, login with
`the Jelajah notice, invalid credentials + legacy hint, lockout, signup with rules, cek-email, cek-email countdown,
`verify-email success / used / expired / invalid, forgot-password, forgot legacy, forgot sent, reset form, reset
`expired, reset done, menu signed in, profile security (unverified), the EMAIL_NOT_VERIFIED notice.
`
`## 9. Out-of-scope observations
`
`- Backend `test/integration/verifikasi-queue.int-spec.ts` cannot build its module (missing `AuditLog` repository in
`  the test module); same on `00a3921`. Added to the Cleanup list.
`- The local backend's per-IP limits (refresh 60/min, login 30/min) are shared by every request of a local run, because
`  everything arrives from 127.0.0.1 through the Next rewrite. Long local runs can hit them; behind Vercel the same is
`  true for many visitors (Risks).
`- `/admin` itself has no page (404); the admin area starts at `/admin/dashboard`.
`- The `ChangePasswordForm` still sends `confirmPassword` and uses its own rules (upper/lower/digit). For local accounts
`  the backend's policy is 8–128 characters; the form's stricter rule still works. Not changed.
`- In local mode the root layout's `np_logged_in`-based buttons on `/` can show "logged in" for a moment after the
`  session ended elsewhere, until the next page load (display only).
`
`## 10. Open questions
`
`1. Is the lockout behaviour right? The 5th wrong password already shows the message, and an unknown email gets the
`   same message after 5 tries (no enumeration). The message lives in process memory (database lock unaffected).
`2. Should a route use `@RequireVerifiedEmail()` before Points exist, so the notice is reachable in production? It is
`   not reachable today.
`3. Local mode shows the "Akun lama?" hint with EVERY invalid-credentials error. Acceptable wording for users who simply
`   mistyped their password?
`4. After the switch, when may `AUTH_ACCEPT_SUPABASE_TOKENS` go to `false`, and should Supabase-only users get an
`   email announcing the one-time reset?
`5. The go-live check on a Vercel preview needs `FRONTEND_ORIGIN_PATTERNS` on the production backend for preview hosts.
`   Is that acceptable, or should the check use a separate backend?
`
`## 11. Ready for next phase?
`
`Yes for the next frontend/backend work (Google login for the local mode). Switching production to the local login is
`blocked only by the backend deployment (Pending deployment items 4 to 6, 8, 9, 14) and the go-live checklist.
