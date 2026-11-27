# Phase 29: Frontend on the self-hosted login (email + password), behind a switch

> Draft written step by step; completed in step 8.

## 0. Preflight (step 0)

- Phase number: highest report was `phase-28.md` → **29**. Branch `phase-29-local-auth-frontend` in both repos.
- Unmerged branches: none. The frontend's LOCAL `main` was stale (at PR #24); `origin/main` already contained PR #25
  (`phase-28-visual-map`, merge `489d176`). Local `main` was fast-forwarded to `origin/main`, then branched. Backend base
  `00a3921` (main = origin/main; `phase-28-visual-map` is merged).
- Free space at the start: C: 8.04 GB, D: 340.67 GB.
- Ports at the start: nothing listening on 3000, 3001, 3002, 3003, 3010, 3011, 5432, 1025, 8025; no Docker container running.

## Inventory (step 0)

### A. Every Supabase usage in the frontend, and its local-mode replacement

| # | File | What it does today (Supabase) | Local mode |
|---|------|-------------------------------|------------|
| 1 | `lib/supabase/client.ts` | `createBrowserClient(URL, ANON_KEY)` | not loaded |
| 2 | `lib/supabase/server.ts` | `createServerClient` on the request cookies (server components, callback) | not loaded |
| 3 | `lib/supabase/middleware.ts` | `updateSession()`: refreshes the Supabase session cookies, returns the user | not loaded; the middleware reads the `np_logged_in` hint |
| 4 | `contexts/AuthContext.tsx` | `onAuthStateChange`, `getSession`, `signInWithPassword`, `signUp`, `signOut`, `getAccessToken` | the facade (`lib/auth/`) |
| 5 | `types/auth.ts` | imports Supabase `User`/`Session` types for the context | own types in `lib/auth/types.ts` |
| 6 | `lib/api/client.ts` | `getSession()` → `Authorization: Bearer` on every `apiClient` call | facade token; on 401 refresh once and retry once; refresh failure → login with `redirectTo` |
| 7 | `lib/api/prot.ts` (`getAuthToken`, 4 multipart uploads) | Bearer from `getSession()` | same authorized fetch as `apiClient` |
| 8 | `lib/api/nfts.ts` (`uploadImage`) | Bearer from `getSession()` | same authorized fetch |
| 9 | `hooks/useCurrentUser.ts` | session present? → `GET /users/me` (role, profile) | the facade's `currentUser()` (user from login/refresh = `/users/me`), live on sign-in/out in other tabs |
| 10 | `app/(protected)/layout.tsx` | client check `getUser()`, else `router.push('/login')` | facade session check, same push |
| 11 | `middleware.ts` | `updateSession()` → `routeDecision(Boolean(user), …)` (Phase 18 gate) | `routeDecision(hasLoggedInHint, …)`; pure `routeDecision` unchanged |
| 12 | `app/auth/callback/route.ts` | Google OAuth `exchangeCodeForSession`; target from `next` or the Phase 18 `np_post_login` cookie, cleared | Google is NOT in this phase: in local mode the route only clears the cookie and redirects to `/login` (no Supabase import) |
| 13 | `components/auth/SocialAuthButtons.tsx` | `signInWithOAuth('google')`, stores the `np_post_login` cookie | hidden in local mode (the buttons and the "atau …" divider) |
| 14 | `components/auth/LoginForm.tsx`, `SignupForm.tsx`, `LogoutButton.tsx` | `useAuth()` → context → Supabase | facade; local-mode messages (lockout, legacy hint, "Cek email kamu") |
| 15 | `components/ui/UserNav.tsx` | `useCurrentUser` + `signOut` → `/login` | facade; local sign-out goes to `/` |
| 16 | `components/admin/AdminHeader.tsx` | own `createClient().auth.signOut()` → `/login` | facade sign-out |
| 17 | `app/page.tsx` (server) | `getUser()` (navbar and hero buttons), `getSession()` → token sent with the featured PROT and `/stats/landing` fetches | no token on the server: both fetches public (featured PROT is already `status=ARSIP_NASIONAL` + filtered again; stats are public); logged-in UI from the `np_logged_in` hint (display only) |
| 18 | `app/menu/page.tsx` (server) | `getUser()` → `user_metadata.full_name` for "Selamat Datang, X" | first name from the facade user in a small client component (no server token) |
| 19 | `app/landing-page/1`, `/2` (server, old drafts) | `getUser()` for logged-in UI | the `np_logged_in` hint (display only) |
| 20 | Role checks: `canSeeProtDocuments(user?.role)` (Phase 25, `/prot/[id]`), `selfReviewState(user, …)` (Phase 26 review page), admin layout and pages, ProtTabBar, CalendarTabBar, marketplace, events | role from `useCurrentUser()` = backend `GET /users/me` (already NOT from Supabase) | unchanged code; `useCurrentUser` gets the backend user through the facade |
| 21 | `tests/middleware/login-gate.test.tsx` | mocks `@/lib/supabase/client` and `@/hooks/useAuth` | still valid for supabase mode; new tests for local mode |
| 22 | Local test harness "fake Supabase" (Phase 19/26, scratch only, `D:/dev-cache/tmp/phase-26/pw/fake-supabase.mjs`, never committed) | fake `/auth/v1/user` + a hand-made `sb-*` session cookie so a local build looks logged in | not needed in local mode: the real local backend login is used (`tests/e2e-local/`) |
| 23 | `package.json` `@supabase/ssr`, `@supabase/supabase-js`; `.env.example` `NEXT_PUBLIC_SUPABASE_*` | dependencies and env | stay (supabase mode is the default); not bundled in local mode (verified in step 7) |
| 24 | `types/user.ts` `supabase_user_id` | a field of the backend user | unchanged (data, not code) |

Server components that sent the visitor's token: **only `app/page.tsx`** (featured PROT and `/stats/landing`). Both become
public fetches in local mode. No other server component, route handler or `lib/api` function runs with a token on the server.

### B. Backend auth endpoints (read from the code, base `00a3921`)

All under `/api/auth` (browser: `/backend-api/auth/*` through the rewrite). Error bodies of the global `HttpExceptionFilter`:
`{statusCode, timestamp, path, method, message}`; `AuthErrorFilter` (scoped to the auth controllers) adds `error` / `code`.

| Method + path | Request | Success | Errors |
|---|---|---|---|
| `POST /register` | `{email, password, full_name}` (DTO: email ≤ 254, password ≤ 1024, full_name ≤ 255, all required; whitelist) | 201 `{success:true, message}` ALWAYS the same (new, existing, Supabase-only) | 400 policy (`Password must be at least 8 characters long` / `at most 128` / `must not be the same as the email address`), 400 validation, 429 throttle |
| `POST /login` | `{email, password}` | 200 `{accessToken, expiresIn, user}` + cookies `np_refresh` (httpOnly, Path=`AUTH_COOKIE_PATH`) and `np_logged_in=1` (Path=/), `Cache-Control: no-store` | **401 `Invalid email or password` for unknown email, wrong password, LOCKED account and Supabase-only account (no `user_credentials`)**; 403 `This account cannot sign in` (suspended/inactive, only after a correct password); 429 `Too many login attempts. Try again later.` (10 / 15 min per email, no retry time); 429 per-IP throttle; 503 local auth disabled |
| `POST /refresh` | cookie + CSRF | 200 like login (rotated cookie) | 409 `{error:"refresh_conflict"}` (cookies kept), 401 `{error:"invalid_refresh_token"}` (cookies cleared), 403 CSRF, 503 |
| `POST /logout` | cookie + CSRF | 204, cookies cleared | 403 CSRF |
| `POST /logout-all` | Bearer + CSRF | 204, every refresh token revoked | 401, 403 |
| `POST /verify-email` | `{token}` | 200 `{success, message:"Email address verified."}` | 400 `{code:"invalid_or_expired_token"}` (one code for unknown, used, expired) |
| `POST /resend-verification` | `{email}` | 200 fixed body, always (work in the background; 3 / hour / address, silently skipped above) | 400 validation, 429 throttle |
| `POST /forgot-password` | `{email}` | 200 fixed body, always (any account incl. Supabase-only) | 400 validation, 429 throttle |
| `POST /reset-password` | `{token, newPassword}` | 200 `{success, message}`; creates `user_credentials` for Supabase-only accounts; revokes all refresh tokens; older access tokens rejected | 400 policy, 400 `invalid_or_expired_token` |
| `POST /change-password` (AuthController) | Bearer (+ CSRF when the cookie is sent) | local: 204; legacy: 201 | 401 / 400 |
| `GET /users/me` | Bearer | the user incl. `role`, `emailVerified` | 401 |
| `@RequireVerifiedEmail()` | — | — | 403 `{code:"EMAIL_NOT_VERIFIED"}`; **applied to no route yet** |

CSRF: `X-Requested-With: nusantara-play` + `Origin` in `FRONTEND_URLS` (or `FRONTEND_ORIGIN_PATTERNS`).
Email links (`email-flows.service.ts`): `{APP_PUBLIC_URL}/verify-email?token=…`, `{APP_PUBLIC_URL}/reset-password?token=…`,
and the "akun sudah ada" email links `{APP_PUBLIC_URL}/login`. Password policy: 8 to 128 characters (code points), not
equal to the email (case-insensitive).

**Gaps found:**
1. Lockout: the locked account answers the generic 401, so the frontend cannot say "Coba lagi dalam N menit". The 429 of
   the per-email limit has no retry time either. → Added in step 3, **enumeration-safe** (see Decisions): an in-memory
   per-email failure counter that treats known and unknown emails alike; at 5 failures the login answers 429
   `{code:"login_locked", retryAfterSeconds}` + `Retry-After` for 15 minutes.
2. Supabase-only account: also the generic 401. A code that singles it out would reveal that an account exists for the
   email (Phase 08 rule: generic errors never reveal accounts). → **Not added.** The frontend shows the legacy hint
   ("Akun lama? Atur kata sandi baru sekali lewat email") with EVERY invalid-credentials error instead; it leads to the
   forgot-password flow with the email pre-filled.
3. verify-email: one code for used and expired links, but the landing page must tell success / expired / used apart. →
   Added in step 3: `reason: "used" | "expired" | "invalid"` next to `code` (only the holder of the 32-byte token can
   ask, so it reveals nothing about other accounts).
4. No route uses `@RequireVerifiedEmail()` yet, so no real endpoint answers `EMAIL_NOT_VERIFIED`. Not added (an endpoint
   without a feature); the frontend handles the code globally, tested with a mocked response (see Deviations).

### C. Rewrite and cookies

`next.config.ts` `rewrites()`: `/backend-api/:path*` → `${resolveBackendOrigin(BACKEND_ORIGIN)}/api/:path*`, default
origin `https://api.nusantaralegacy.org` (validated; invalid fails the build). `BACKEND_ORIGIN` already exists and is
reused. The backend sets cookies without a Domain attribute, so through the rewrite they are host-only cookies of the
frontend origin; `np_refresh` needs `AUTH_COOKIE_PATH=/backend-api/auth` (the backend default). In development
`getBackendApiUrl()` returns `NEXT_PUBLIC_BACKEND_API_URL` (cross-origin); the local auth code therefore always uses the
same-origin `/backend-api` path, so `BACKEND_ORIGIN` must point at the local backend in local mode (checked by
`next.config.ts`, see step 1).

### Plan and files

- Step 1 (fe): `lib/auth/{mode,types,index,server}.ts`, `lib/auth/supabase/*` (today's code moved), `contexts/AuthContext.tsx`,
  `types/auth.ts`, `lib/api/client.ts`, `lib/api/prot.ts`, `lib/api/nfts.ts`, `hooks/useCurrentUser.ts`,
  `app/(protected)/layout.tsx`, `components/admin/AdminHeader.tsx`, `next.config.ts` (local-mode BACKEND_ORIGIN guard),
  `vitest.config.ts` (testTimeout 15 s), tests.
- Step 2 (fe): `lib/auth/local/{http,session,broadcast,index}.ts` + tests.
- Step 3 (be): `login-failure-tracker.service.ts`, `auth-errors.ts`, `auth-error.filter.ts`, `local-auth.controller.ts`,
  `email-flows.service.ts`, `auth-token.service.ts`, module wiring + unit and e2e tests.
- Step 4 (fe): `app/(auth)/{forgot-password,reset-password,verify-email,cek-email}/page.tsx`, `components/auth/*` (forms,
  messages, resend with countdown), tests.
- Step 5 (fe): `middleware.ts`, `app/page.tsx`, `app/menu/page.tsx`, `app/landing-page/1|2`, `app/auth/callback/route.ts`,
  email-not-verified notice, tests.
- Step 6 (fe): `tests/e2e-local/` (Playwright script + README), run, screenshots.
