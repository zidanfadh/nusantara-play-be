# Phase 03: Hotfix browser API calls with a Vercel proxy

## 1. Summary

Browser API calls in production now go to the same-origin path `/backend-api/*`. A rewrite in `next.config.ts` proxies them to `<BACKEND_ORIGIN>/api/*`, with `BACKEND_ORIGIN` defaulting to `https://api.nusantaralegacy.org`. Same-origin requests are not subject to CORS, so the production backend's CORS allowlist no longer blocks nusantaralegacy.org. This works on any domain, including nusantaravirtual.org and `*.vercel.app` previews. The fragile `https://api.<hostname>/api` derivation (F3) is removed. Server-side calls are unchanged.

The other changes:
- `BACKEND_ORIGIN` is validated, and an invalid value fails `pnpm build`.
- `middleware.ts` no longer runs for `/backend-api`.
- Proxied responses are opted out of Vercel CDN caching.

Tests (42), the build, and lint (no new errors) all pass. Through a local production build, `/backend-api/health` and `/backend-api/prot?page=1&limit=1` returned 200 from the real production API. **The code part of the phase is complete.** Large uploads (> 4.5 MB) through Vercel are the one thing that cannot be verified locally; see §7, step 7. Nothing was pushed.

## 2. Git

**nusantara-play-fe**, branch `phase-03-api-proxy`, base `dbdb1dc` (main, "Merge pull request #3 from zidanfadh/phase-02-tooling", contains `c2d83f6 chore(fe): pnpm builds, vitest, env example, hygiene`)

| Commit | Message |
|---|---|
| `45d588b` | fix(fe): proxy browser API calls through same-origin /backend-api |
| `433318f` | docs(phase-03): document /backend-api proxy, CORS facts and risks |

`git diff --stat dbdb1dc..HEAD`:
```
 .env.example                     |   8 ++-
 CLAUDE.md                        |  29 ++++++++---
 lib/api/base-url.ts              |  44 +++++++++-------
 middleware.ts                    |   4 +-
 next.config.ts                   |  74 ++++++++++++++++++++++++++-
 tests/api/base-url.test.ts       |  92 +++++++++++++++++++++++----------
 tests/config/next-config.test.ts | 108 +++++++++++++++++++++++++++++++++++++++
 tests/middleware/matcher.test.ts |  32 ++++++++++++
 8 files changed, 337 insertions(+), 54 deletions(-)
```

**nusantara-play-be**, branch `phase-03-api-proxy`, base `d21ad55` (main, "docs(phase-02): phase report")

| Commit | Message |
|---|---|
| `91a3f70` | docs(phase-03): document /backend-api proxy, CORS facts and risks |
| (this report) | docs(phase-03): phase report |

`git diff --stat d21ad55..91a3f70`: `CLAUDE.md | 12 +++++++++++-, 1 file changed, 11 insertions(+), 1 deletion(-)`.

## 3. Changes

### Frontend
| File | Why |
|---|---|
| `next.config.ts` | `rewrites()`: one rule, `/backend-api/:path*` → `<BACKEND_ORIGIN>/api/:path*`. `resolveBackendOrigin()` validates `BACKEND_ORIGIN`: empty or unset means the default; it must be https (http only for localhost, 127.0.0.1, [::1]), with no trailing slash and no path, query, fragment or credentials; otherwise it throws a clear error. `headers()`: `x-vercel-enable-rewrite-caching: 0` on `/backend-api/:path*`. Exports `BACKEND_PROXY_PATH` and `DEFAULT_BACKEND_ORIGIN` for tests. |
| `middleware.ts` | Matcher excludes `backend-api(?:/\|$)`, so proxied calls never run `updateSession` and are never redirected to `/login`. `/backend-apix` is still matched. |
| `lib/api/base-url.ts` | Production browser: `${window.location.origin}/backend-api`. Development and server: `NEXT_PUBLIC_BACKEND_API_URL` (unchanged). The `hostname` option became `browserOrigin`, and the `api.<hostname>` derivation is removed. |
| `tests/api/base-url.test.ts` | Covers development (browser + missing env), production browser on nusantaralegacy.org, www., nusantaravirtual.org and a `*.vercel.app` host, server side, missing env, and no NODE_ENV. Also tests `getBackendApiUrl()` itself with stubbed `window`/env. |
| `tests/config/next-config.test.ts` (new) | Imports `next.config.ts`. Checks `rewrites()` for the default, an empty value, a custom origin and http://localhost. Checks 7 invalid values throw. Checks the no-cache header, that the proxy path in config and client match, and that no `app/**/backend-api/` or `public/**/backend-api/` exists. |
| `tests/middleware/matcher.test.ts` (new) | Uses Next's `unstable_doesMiddlewareMatch` on the real `config`: 6 `/backend-api…` URLs do not match; `/`, `/login`, `/profile`, `/prot`, `/prot/123`, `/api/proxy-image`, `/backend-apix` still match. |
| `.env.example` | `BACKEND_ORIGIN` (commented out, optional, default production API). Updated comment on `NEXT_PUBLIC_BACKEND_API_URL`. |
| `CLAUDE.md` | Backend URL architecture note and env vars. Shared sections: Deployment facts, new "Risks" section, Decisions log. |

### Backend
| File | Why |
|---|---|
| `CLAUDE.md` | Shared sections, identical to the frontend (checked with `diff`). |
| `docs/phase-reports/phase-03.md` (new) | This report. |

### Call sites checked (item 2.5)
Searched for `NEXT_PUBLIC_BACKEND_API_URL`, `api.nusantara`, `` api.${ ``, `getBackendApiUrl`, `localhost:3000`, `BACKEND`, `fetch(`, `XMLHttpRequest`, `axios`, `EventSource`, `WebSocket`, and every `https?://` literal in `app/ lib/ hooks/ components/ contexts/ types/ middleware.ts`. Every backend URL is already built with `getBackendApiUrl()`, so **no other file needed changes**:

| Call site | Runs in | Result |
|---|---|---|
| `lib/api/client.ts:25` (`apiClient`, all JSON calls) | browser | `getBackendApiUrl()` → `/backend-api` |
| `lib/api/prot.ts:56` foto-kegiatan upload | browser | `getBackendApiUrl()` |
| `lib/api/prot.ts:77` video-kegiatan upload | browser | `getBackendApiUrl()` |
| `lib/api/prot.ts:104` dokumen-kurikulum upload | browser | `getBackendApiUrl()` |
| `lib/api/prot.ts:128` peralatan foto-alat upload | browser | `getBackendApiUrl()` |
| `lib/api/nfts.ts:77` NFT image upload | browser | `getBackendApiUrl()` |
| `lib/api/stats.ts:20` landing stats | server (`app/page.tsx`) | `getBackendApiUrl()` → env URL |
| `app/page.tsx:34` featured PROT | server component | `getBackendApiUrl()` → env URL |
| `hooks/useMarketplace.ts:31` | — | `fetch` is a local callback name, not `window.fetch` |
| `app/api/proxy-image/route.ts:12` | server | fetches an arbitrary image URL, not the backend (see §9) |
| `lib/api/base-url.ts` | — | the only place that built `api.${hostname}`; removed |
| other `https://` literals | — | images (googleusercontent), external links, form placeholders; none point to the backend |

## 4. Decisions

1. **Caching opt-out added in `next.config.ts` `headers()`.** The prompt asked for one rewrite rule. Vercel's docs say projects created on or after 2026-04-06 honor upstream cache headers on external rewrites by default, and the prompt says responses must not be cached. `x-vercel-enable-rewrite-caching: 0` is Vercel's documented opt-out. Next.js `headers()` compiles to the same routing headers as `vercel.json` (which is not in the allowed files). The backend currently sends no `Cache-Control`, so nothing would be cached today anyway; the header makes it deterministic.
2. **Validation runs inside `rewrites()`, not at module load.** Next calls `rewrites()` during `next build` and `next dev`, so an invalid value still fails the build (verified, §6). Tests can then import the config and change `BACKEND_ORIGIN` per test.
3. **"Origin only" is checked with `new URL(v).origin === v`.** This also rejects paths, queries, credentials, uppercase hosts and explicit default ports. The error message names the reason and shows an example.
4. **An empty `BACKEND_ORIGIN` counts as unset (default).** Vercel UI env vars can be empty strings.
5. **Plain array form for `rewrites()`** (afterFiles), not `beforeFiles`. No page uses `/backend-api` (a test enforces this), so both behave the same. The array form is the simplest.
6. **The proxy path is a literal in two places** (`next.config.ts` and `lib/api/base-url.ts`), with a test asserting they are equal. Importing app code into `next.config.ts`, or config into client code, was avoided.
7. **No `NODE_ENV=test` special case.** As before, anything that is not `development` is treated as production.

## 5. Deviations

1. **The extra `headers()` entry** in `next.config.ts` (see Decision 1).
2. **Two extra read-only GETs to production**, besides the two the prompt named:
   - `GET /backend-api/users/me` through the local proxy, without credentials, to prove middleware does not redirect. Result: the backend's own 401.
   - `GET https://api.nusantaralegacy.org/api/health` with `Origin: https://nusantaralegacy.org` and with `Origin: https://nusantaravirtual.org`, to confirm the CORS fact written into CLAUDE.md.

   No POST, PUT, PATCH or DELETE was sent to production.
3. **An extra local-only proxy test.** I added a build with `BACKEND_ORIGIN=http://localhost:4010` pointing at a scratch echo server (in the session scratchpad, not in the repo). It shows `Authorization`, cookies and a 6 MB multipart body passing through Next's proxy. Afterwards I rebuilt with the default origin.

## 6. Verification

Disk before: C: 7.5 GB free, D: 360 GB free. Disk after: C: 7.5 GB free, D: 360 GB free.
Session env for every command: `npm_config_cache=D:/dev-cache/npm`, `TEMP/TMP/TMPDIR=D:/dev-cache/tmp`. Build env (inline, not written to a file): `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api`.

| Step | Command | Exit | Output |
|---|---|---|---|
| 0 | `git checkout main && git pull --ff-only` (fe) | 0 | fast-forward `9550df9..dbdb1dc`; `c2d83f6 chore(fe): pnpm builds, vitest, env example, hygiene` present |
| 0 | same (be) | 0 | "Already up to date", HEAD `d21ad55` |
| 0 | `git checkout -b phase-03-api-proxy` (both) | 0 | — |
| 3 | `pnpm test` | 0 | `Test Files 3 passed (3)`, `Tests 42 passed (42)`, 0 failed, 0 skipped |
| 3 | `pnpm vitest run tests/middleware` against the **old** `middleware.ts` (mutation check, file restored afterwards) | 1 | `Tests 6 failed \| 8 passed (14)`: all 6 `/backend-api` cases fail, so the test detects the regression |
| 3 | `pnpm lint` | 1 | `✖ 131 problems (44 errors, 87 warnings)`, same as the baseline |
| 3 | `pnpm exec eslint next.config.ts middleware.ts lib/api/base-url.ts tests` | 0 | no output |
| 3 | `pnpm build` | 0 | full route table, `ƒ Proxy (Middleware)`. `.next/routes-manifest.json`: `afterFiles: [{source: "/backend-api/:path*", destination: "https://api.nusantaralegacy.org/api/:path*"}]`, header `x-vercel-enable-rewrite-caching: 0` on the same source |
| 3 | `BACKEND_ORIGIN=http://api.nusantaralegacy.org pnpm build` | 1 | `Error: Invalid BACKEND_ORIGIN "http://api.nusantaralegacy.org": it must use https (http is allowed only for localhost). Expected an origin such as "https://api.nusantaralegacy.org" (https, no path, no trailing slash; http only for localhost).` |
| 4 | `pnpm exec next start -p 3001` (after a default build) | — | `✓ Ready in 1187ms` |
| 4 | `curl -D - http://localhost:3001/backend-api/health` | 0 | `HTTP/1.1 200 OK`, `x-ratelimit-limit: 100`, body `{"status":"ok","message":"Nusantara Play API is running","timestamp":"2026-11-17T15:07:43.150Z","version":"1.0.0"}` |
| 4 | `curl "http://localhost:3001/backend-api/prot?page=1&limit=1"` | 0 | `HTTP 200 size=2790`, body starts `{"data":[{"id":"752aeea4-a9c4-455b-a216-71f508bcfe3c","nama":"SEPANGKAL","jenis":"PERMAINAN_RAKYAT",…` |
| 4 | `curl http://localhost:3001/backend-api/users/me` (no credentials) | 0 | `HTTP 401`, no redirect (the backend answered; middleware did not run) |
| 4 | server stopped (`Stop-Process` on the port 3001 listener) | — | `stopped pid 26292` |
| extra | build with `BACKEND_ORIGIN=http://localhost:4010`, local echo server, `next start -p 3001` | 0 | manifest destination `http://localhost:4010/api/:path*` |
| extra | `curl -H "Authorization: Bearer test-token-abc.def" -H "Cookie: sb-x=1" /backend-api/prot?page=1&limit=1` | 0 | echo saw `GET /api/prot?page=1&limit=1`, `authorization: Bearer test-token-abc.def` (unchanged), `host: localhost:4010`, `x-forwarded-host: localhost:3001`, `cookie: sb-x=1` |
| extra | `curl -F file=@photo-6mb.jpg` (6,291,456 random bytes) + Authorization → `/backend-api/prot/123/foto-kegiatan` | 0 | echo saw `POST`, multipart content-type with boundary, `content-length: 6291659`, `bodyBytes: 6291659` (complete) |
| extra | both servers stopped; rebuild with the default origin | 0 | `final build exit=0` |
| 5 | `diff` of the shared CLAUDE.md sections (from "Current direction" to the end) | 0 | identical |
| — | `curl -H "Origin: https://nusantaralegacy.org" https://api.nusantaralegacy.org/api/health` | 0 | 200, **no** `Access-Control-Allow-Origin` |
| — | same with `Origin: https://nusantaravirtual.org` | 0 | 200, `Access-Control-Allow-Origin: https://nusantaravirtual.org` |

## 7. Manual checks

On the Vercel preview deployment of frontend branch `phase-03-api-proxy` (push it and open the preview URL from the Vercel dashboard or the PR):

1. **Build log**: the build succeeds. If you set `BACKEND_ORIGIN` on Vercel, the build fails with "Invalid BACKEND_ORIGIN" when the value is wrong. Leaving it unset is fine.
2. **PROT list**: open `<preview>/prot` with DevTools open (Network tab, "Fetch/XHR" filter; Console tab).
   - Console: **no** CORS errors ("blocked by CORS policy").
   - Network: API requests go to `<preview>/backend-api/prot?...`, not to `api.nusantaralegacy.org` or `api.<preview-host>`, and their status is **200**.
   - Click one request. Its Response Headers should **not** include `x-vercel-cache: HIT`; `MISS`, `BYPASS` or no header is fine. Reload twice and check again.
3. **PROT detail**: click a PROT card (`<preview>/prot/<id>`). Same checks: no CORS errors, `/backend-api/prot/<id>…` with status 200, and the page content loads.
4. **Log in** at `<preview>/login`. Login itself talks to Supabase, not the backend. After login, Network should show `/backend-api/...` calls (for example the user profile) with status 200. They must not be 401, which would mean the `Authorization` header was lost, and must not be 400 "Request Header Or Cookie Too Large".
5. **Page that needs login**: open `<preview>/profile`, then `<preview>/calendar/my` or `<preview>/events/my-registrations`. The pages load your data. `/backend-api/...` requests are 200 and carry `Authorization: Bearer …` under Request Headers. You are not sent back to `/login`.
6. **Optional: production domain alias.** If the preview can be opened on nusantaravirtual.org or www., repeat step 2 there; requests must still go to the same origin's `/backend-api`.
7. **Large upload** (needs a `kurator_daerah` or `admin_kpoti` account): edit a PROT you may edit and upload **one photo larger than 5 MB** (for example 6–10 MB) as a foto kegiatan. In Network, the `POST /backend-api/prot/<id>/foto-kegiatan` request should be 200/201 and the photo should appear afterwards. Report the result in any case:
   - 413 from Vercel (response header `server: Vercel`) means Vercel limits external-rewrite bodies.
   - 413 from nginx means the production nginx limit is lower than the repo's 50M.
   - 504 or `ROUTER_EXTERNAL_TARGET_ERROR` means a timeout.

   This upload writes to production. Use a photo and PROT that may stay, or delete the photo afterwards in the UI.
8. **Merge** only after steps 2–5 pass.

## 8. Findings

### Step 1 research (Vercel and Next.js 16 docs)

| Question | Answer | Source |
|---|---|---|
| Who performs the rewrite? | Vercel's CDN/router acts as a reverse proxy ("Rewrites to external origins … effectively allowing Vercel to function as a reverse proxy or standalone CDN"). The timeout error is `ROUTER_EXTERNAL_TARGET_ERROR`, a router error, not a function error. Next.js `rewrites()` compiles into the deployment's routes (Vercel limits page: "Next.js will create a set of Routes corresponding to your use of … rewrites"). Because `middleware.ts` now skips `/backend-api`, no function runs for these requests. | [Vercel: Rewrites](https://vercel.com/docs/routing/rewrites), [Vercel: Limits](https://vercel.com/docs/limits) |
| Timeout | "The maximum timeout is **120 seconds** (2 minutes). If the external server does not reply until the maximum timeout is reached, an error with the message `ROUTER_EXTERNAL_TARGET_ERROR` will be returned." Same on all plans. | [Vercel: Limits → Proxied request timeout](https://vercel.com/docs/limits#proxied-request-timeout) |
| Request body limit | **Not documented** for external rewrites. The documented 4.5 MB request/response body limit is for Vercel Functions. Vercel's guidance for large uploads is to upload directly to storage. Unverified: whether >4.5 MB uploads through the rewrite work on Vercel (manual check 7). Locally, Next's proxy forwarded 6 MB intact. | [Vercel KB: bypass body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [community: 4.5 MB payload limit](https://community.vercel.com/t/4-5-mb-payload-limit/10500) |
| Middleware body limit (Next 16) | When middleware/proxy runs, Next buffers the body up to `experimental.proxyClientMaxBodySize`, **default 10 MB**, and silently truncates beyond it. This is another reason to keep `/backend-api` out of the middleware matcher. | [Next.js: proxyClientMaxBodySize](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize) |
| Headers forwarded | Vercel adds `x-real-ip`, `x-forwarded-for` (visitor IP), `x-forwarded-host` and `x-forwarded-proto` to external-origin requests. Vercel "overwrite[s] the X-Forwarded-For header and do[es] not forward external IPs" (anti-spoofing). The docs do not list `Authorization`; as a reverse proxy it forwards end-to-end request headers. Verified locally with Next's proxy: `Authorization` arrived unchanged, and `Host` was set to the destination host. On Vercel this is confirmed by manual checks 4–5. | [Vercel: Rewrites → Identifying the visitor](https://vercel.com/docs/routing/rewrites#identifying-the-visitor-at-your-origin), [Vercel: Request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for) |
| Caching | "Vercel honors `cache-control`, `CDN-Cache-Control`, and `Vercel-CDN-Cache-Control` headers from upstream servers on external rewrites … enabled by default for projects created on or after April 6, 2026." Opt-out: header `x-vercel-enable-rewrite-caching: 0`, now set in `next.config.ts`. The production backend sends no `Cache-Control` today (only ETag), so nothing was cacheable even before. | [Vercel: Rewrites → Caching](https://vercel.com/docs/routing/rewrites#caching-rewrites-to-external-origins) |
| Next.js 16 rewrites | `rewrites()` returning an array is applied after pages/public files and before dynamic routes. External destinations are allowed. Middleware/proxy runs before all rewrites. | [Next.js: rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites) (lastUpdated 2026-09-28; installed Next 16.1.6) |

**Would any limit break uploads?** Possibly, but none is documented. The backend accepts 50 MB. If manual check 7 fails with a Vercel 413, the options are:
- (a) Upload large files directly from the browser to S3 with backend-issued presigned URLs. This needs backend changes and server access to deploy.
- (b) Call the backend directly only for uploads once its CORS includes nusantaralegacy.org. This needs server access.
- (c) Compress or resize images in the browser before upload. Photos only; video and documents would still be capped.
- (d) Serve the frontend from nusantaravirtual.org, which is already on the CORS allowlist, and call `https://api.nusantaralegacy.org` directly for uploads. This needs a client-side switch.

I did not implement any of these.

### Production facts observed
- `https://api.nusantaralegacy.org/api/health` → 200, Helmet headers, `X-RateLimit-Limit: 100`, `X-RateLimit-Reset: 60`, no `Cache-Control`.
- CORS: `Access-Control-Allow-Origin` only for `https://nusantaravirtual.org`; none for `https://nusantaralegacy.org`.
- In repo code: `src/main.ts` has no `app.set('trust proxy', …)`, and the global `ThrottlerGuard` is 100 req/60 s. Repo `nginx/nginx.conf` has `limit_req_zone $binary_remote_addr … rate=10r/s`, `burst=20`, `client_max_body_size 50M`, `proxy_read_timeout 60s`. Production configs may differ; there is no server access.

## 9. Out-of-scope observations

1. **Rate limits may already be global.** If production NestJS sits behind nginx without `trust proxy`, `req.ip` is nginx's address for every user. The 100 req/60 s throttler is then shared by all users even without this proxy. With the proxy, nginx's `limit_req` per `$binary_remote_addr` (if production matches the repo) also keys on Vercel egress IPs. Watch for 429/503 after release. The fix (set `trust proxy`, key nginx on `X-Forwarded-For` from trusted ranges) needs server access.
2. **`app/api/proxy-image/route.ts` is an open proxy / SSRF.** It fetches any `?url=` the caller passes, from Vercel's servers, and caches the result for 24 h. It needs an allowlist of image hosts.
3. **Supabase auth cookies are now sent to the backend.** Browser calls are same-origin, so `sb-*` cookies (which contain access and refresh tokens) go with every `/backend-api` request and could appear in backend or nginx logs if cookies are logged. The backend does not need them (it uses the `Authorization` header).
4. **Server-side NEXT_PUBLIC_BACKEND_API_URL.** Server components (landing page stats, featured PROT) still depend on `NEXT_PUBLIC_BACKEND_API_URL` being set on Vercel. `BACKEND_ORIGIN` and this variable could drift apart. A later phase could derive one from the other.
5. **Vitest warning.** Vitest prints a Vite warning about `vitest.config.ts` being ESM loaded as CommonJS (`configLoader: 'native'`). It existed before this phase and is harmless for now.
6. **Next.js 16 deprecation.** Next.js 16 still reports `middleware.ts` as "Proxy (Middleware)". Renaming it to `proxy.ts` is pending (noted in Phase 01/02).

## 10. Open questions

1. Is the Vercel project older or newer than 2026-04-06? This affects only whether the caching opt-out was strictly needed; the header is harmless either way.
2. Who could regain access to the API server (103.235.72.203)? Fixing CORS, `trust proxy` and the rate-limit keys all depend on it.
3. Should `BACKEND_ORIGIN` be set explicitly on Vercel (Production and Preview) for clarity, or should the default stay in use?

## 11. Ready for next phase?

Yes for the code. Merge after the Vercel preview passes manual checks 2–5. Check 7 (upload > 5 MB) decides whether a follow-up for large uploads is needed (options in §8).
