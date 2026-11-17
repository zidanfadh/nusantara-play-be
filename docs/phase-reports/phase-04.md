# Phase 04: Frontend security fixes (F1, F2, F5)

## 1. Summary

Three frontend findings from Phase 01 are fixed. **F1:** `/api/proxy-image` used to fetch any URL. It now goes through a pure, unit-tested module (`lib/security/image-proxy.ts`). The module only allows https URLs with no credentials and the default port, on an exact hostname allowlist (`PROXY_IMAGE_ALLOWED_HOSTS`, default `lh3.googleusercontent.com`). It resolves DNS once and requires every address to be public, then pins the HTTPS socket to those validated addresses. It also refuses redirects, enforces a 5 s timeout, accepts only `image/*` (no SVG), caps the body at 5 MB while streaming, and sets `nosniff` plus a sandbox CSP on every response. **F2:** the NFT detail page renders `about` as plain text (`whitespace-pre-line`). The single published NFT has no `<` or `&` in `about`, so nothing changes visually today. **F5:** `/about` is removed from the public routes. Tests (120), lint (no new errors; whole repo still 44 errors / 87 warnings) and `pnpm build` pass. A local production-mode check confirms the proxy route and `/about` redirect to `/login` when logged out. **The phase is complete.** Note that `ProfileCard`, the only caller of the proxy, is not rendered by any page (see §5 and §10). Nothing was pushed.

## 2. Git

**nusantara-play-fe**, branch `phase-04-fe-security`, base `cfd1b72` (main, "Merge pull request #4 from zidanfadh/phase-03-api-proxy", contains `45d588b fix(fe): proxy browser API calls through same-origin /backend-api`)

| Commit | Message |
|---|---|
| `dc30ff1` | fix(fe): harden image proxy, render NFT about as text, drop /about from public routes |
| `fb730a5` | docs(phase-04): document image proxy allowlist and F1/F2/F5 decisions |

`git diff --stat cfd1b72..HEAD`:
```
 .env.example                           |   4 +
 CLAUDE.md                              |   4 +
 app/api/proxy-image/route.ts           |  63 +++---
 app/nfts/[slug]/page.tsx               |   2 +-
 lib/security/image-proxy.ts            | 346 +++++++++++++++++++++++++++++++++
 middleware.ts                          |   3 +-
 tests/middleware/public-routes.test.ts |  19 ++
 tests/nfts/nft-about.test.ts           |  16 ++
 tests/security/image-proxy.test.ts     | 326 +++++++++++++++++++++++++++++++
 9 files changed, 749 insertions(+), 34 deletions(-)
```

**nusantara-play-be**, branch `phase-04-fe-security`, base `d708f4d` (local branch `phase-03-api-proxy`, "docs(phase-03): phase report"; **not** main, see §5)

| Commit | Message |
|---|---|
| `3f14ccb` | docs(phase-04): document image proxy allowlist and F1/F2/F5 decisions |
| (this report) | docs(phase-04): phase report |

`git diff --stat d708f4d..3f14ccb`: `CLAUDE.md | 3 +++, 1 file changed, 3 insertions(+)`.

## 3. Changes

### Frontend
| File | Why |
|---|---|
| `lib/security/image-proxy.ts` (new) | Pure module, no Next.js imports. Exports `parseAllowedHosts`, `validateImageUrl`, `isBlockedAddress`, `resolveSafeAddresses`, `createPinnedLookup`, `fetchImage`, `ImageProxyError`, `PROXY_SECURITY_HEADERS` and the default limits. |
| `app/api/proxy-image/route.ts` | Rewritten as a thin wrapper: allowlist from env → `validateImageUrl` → `fetchImage`. Adds `export const runtime = 'nodejs'` and security headers on every response. `Cache-Control: public, max-age=86400` is sent on success only. Errors are generic JSON. |
| `app/nfts/[slug]/page.tsx` | `<div className="whitespace-pre-line">{nft.about}</div>` replaces `dangerouslySetInnerHTML`. The `.replace(/\n/g, '<br/>')` is no longer needed, because `whitespace-pre-line` keeps line breaks. |
| `middleware.ts` | `'/about'` removed from `publicExactRoutes`. `isPublicPath` is now exported so it can be tested. The matcher is unchanged. |
| `.env.example` | `PROXY_IMAGE_ALLOWED_HOSTS`, commented out, with an explanation and an example. |
| `tests/security/image-proxy.test.ts` (new) | 67 tests for the module (see §6). |
| `tests/nfts/nft-about.test.ts` (new) | Source check: the page has no `dangerouslySetInnerHTML` and renders `{nft.about}` with `whitespace-pre-line`. |
| `tests/middleware/public-routes.test.ts` (new) | `/about` and `/api/proxy-image` are not public; the existing public routes still are. |
| `CLAUDE.md` | Env list: `PROXY_IMAGE_ALLOWED_HOSTS`. Decisions log: F1, F2, F5. |

`tests/middleware/matcher.test.ts` did not need changes: the matcher config did not change, and `/about` was never in it.

### Backend
| File | Why |
|---|---|
| `CLAUDE.md` | Same three Decisions log entries. The shared sections are identical to the frontend (`diff` of everything from "## Current direction" onwards: no output). |
| `docs/phase-reports/phase-04.md` (new) | This report. |

## 4. Decisions

- **Default allowlist = `lh3.googleusercontent.com`.** The prompt asks for the hosts found in Step 1.2, but that search found **no** avatar hostname in public data (the only exposed `avatar_url` is `null`, see §8). I therefore took the default from the code. The only caller, `ProfileCard`, sends only URLs that contain `googleusercontent.com` or `googleapis.com` through the proxy. `avatar_url` comes from Supabase Google OAuth `user_metadata.avatar_url` (backend `users.service.ts` `syncFromSupabase`). Google serves those photos from `lh3.googleusercontent.com`. S3 avatars (`https://nusantara-play-storage.s3.ap-southeast-2.amazonaws.com/images/avatars/...`, from `POST /api/upload/avatar`) are rendered directly by `ProfileCard`, not proxied, so the S3 host is not in the default. `googleapis.com` has no known real use and is not in the default either. More hosts can be added with the env var, without a deploy of code.
- **Blank env = default.** `PROXY_IMAGE_ALLOWED_HOSTS` set to an empty or whitespace-only value behaves like unset. Hostnames are lowercased and must match exactly; no wildcards and no subdomains.
- **IPv6 policy:** only global unicast `2000::/3` is allowed, minus `2001::/23` (incl. Teredo), `2001:db8::/32`, `2002::/16` (6to4) and `3fff::/20`. This blocks `::`, `::1`, IPv4-mapped `::ffff:0:0/96`, NAT64 `64:ff9b::/96`, `fc00::/7`, `fe80::/10`, `fec0::/10` and `ff00::/8`. Addresses with a zone index (`%`) and anything unparseable are blocked as well. IPv4 blocks 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4 and 240/4. The lists use `node:net` `BlockList`.
- **All addresses must be public.** If DNS returns a mix of public and private addresses, the request is rejected.
- **Status codes:** 400 for a missing or invalid URL, the wrong scheme, credentials or a port; 403 for a host not on the allowlist or a non-public address; 415 for a non-image type or SVG; 502 for an upstream error, a 3xx, a non-200, a body that is too large or a DNS failure; 504 for a timeout. Messages are fixed strings. The upstream body is never read for errors and never echoed.
- **Content-Length precheck:** a declared length over 5 MB is rejected before reading. The streaming cap still applies when the header is missing or wrong.
- **Response `Content-Type`** is the normalized media type only (for example `image/png`, parameters dropped). It must match `^image/[a-z0-9.+-]+$`.
- **`agent: false`:** no keep-alive socket reuse, so every request goes through the pinned lookup.
- The upstream `User-Agent` changed from a spoofed browser string to `Mozilla/5.0 (compatible; NusantaraLegacyImageProxy/1.0)`, and `Accept: image/*` was added.
- **Backend branch base:** see §5.

## 5. Deviations

- **`node:https` instead of `fetch(..., { redirect: 'manual' })`.** With `fetch`, the hostname would be resolved a second time when connecting, after the `node:dns` check. A DNS-rebinding server could answer "public" to the check and "127.0.0.1" to the connect. Pinning the address with `fetch` needs an `undici` `Agent`, which would be a new dependency (`package.json` is not in the allowed files). `node:https` takes a `lookup` option. The module resolves once with `node:dns`, validates the addresses, and hands exactly those addresses to the socket. `node:https` never follows redirects, so any 3xx is treated as an error, which is what `redirect: 'manual'` was meant to achieve. The timeout uses `AbortController` as requested (its `signal` is passed to `https.request`, and DNS is raced against it).
- **Backend branch base is `phase-03-api-proxy`, not main.** Backend `main` (`d21ad55`) does not contain the Phase 03 docs commits (`91a3f70`, `d708f4d`). That branch exists only locally; it was never pushed or merged. Branching from main would have left the backend shared CLAUDE.md sections different from the frontend's and would have caused a conflict later. The backend Phase 04 branch is therefore stacked on `phase-03-api-proxy`. Merge (or push and merge) Phase 03 first, or merge Phase 04, which includes it.
- **Manual check "open the page that shows ProfileCard":** no page shows it. `components/dashboard/ProfileCard.tsx` is not imported anywhere (searched for `ProfileCard` as a whole word in all `.ts`/`.tsx`/`.md` files). The `/profile` page uses `components/users/UserProfileCard.tsx`, which loads `avatar_url` directly with `<img>`, without the proxy. §7 gives an equivalent check of the proxy that calls the route directly.
- **Default allowlist** is based on the code, not on hosts found in public data (none were found), see §4.

## 6. Verification

Shell: Git Bash. Session-only variables `TEMP`/`TMP`/`TMPDIR=D:/dev-cache/tmp`, `npm_config_cache=D:/dev-cache/npm`. No `pnpm install` was needed (`node_modules` was already present). Node v24.22.0.

| Command | Exit | Output (trimmed) |
|---|---|---|
| `git checkout main && git pull` (fe) | 0 | Fast-forward `dbdb1dc..cfd1b72`; contains `45d588b fix(fe): proxy browser API calls through same-origin /backend-api` |
| `git checkout main && git pull` (be) | 0 | `Already up to date.` (`d21ad55`) |
| `pnpm test` | 0 | `Test Files 6 passed (6)`, `Tests 120 passed (120)` (0 failed, 0 skipped). Before this phase: 3 files. New: 67 in `image-proxy.test.ts`, 2 in `nft-about.test.ts`, 9 in `public-routes.test.ts`. |
| `npx tsc --noEmit -p .` | 0 | no output |
| `npx eslint <touched files> tests/` | 0 | 0 errors. 2 warnings, both pre-existing `@next/next/no-img-element` in `app/nfts/[slug]/page.tsx` (lines 57 and 76; the same 2 warnings exist on the base). |
| `pnpm lint` | 1 | `✖ 131 problems (44 errors, 87 warnings)`, exactly the Phase 02 baseline |
| `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key pnpm build` | 0 | All routes built; `ƒ /api/proxy-image`, `ƒ /nfts/[slug]`, `ƒ Proxy (Middleware)` |
| `next start -p 3001` (same placeholders) + curl | — | see below |

Local production-mode check (logged out, no cookies):
```
== /api/proxy-image?url=https://example.com/a.png
HTTP/1.1 307 Temporary Redirect
location: /login?url=https%3A%2F%2Fexample.com%2Fa.png&redirectTo=%2Fapi%2Fproxy-image
== /api/proxy-image?url=http://169.254.169.254/
HTTP/1.1 307 Temporary Redirect
location: /login?url=http%3A%2F%2F169.254.169.254%2F&redirectTo=%2Fapi%2Fproxy-image
== /about
HTTP/1.1 307 Temporary Redirect
location: /login?redirectTo=%2Fabout
== /nfts
HTTP/1.1 200 OK
== /login
HTTP/1.1 200 OK
```
The proxy-route redirect matches the previous behaviour: the middleware logic for this path did not change, and `/api/proxy-image` was not public before either. The server was stopped afterwards (0 listeners on 3001).

Unit tests required by the prompt (all in `tests/security/image-proxy.test.ts`):

| Case | Result |
|---|---|
| allowed host (validation + full fetch through a fake `https.request` that resolves through the pinned lookup) | pass |
| host not in the allowlist; suffix trick `lh3.googleusercontent.com.evil.example.com`; subdomain; IP literal | 403 |
| http URL | 400 |
| URL with credentials (user:pass and user only) | 400 |
| custom port `:8443` (and `:443` accepted) | 400 / ok |
| hostname resolving to 127.0.0.1, 10.0.0.5, 169.254.169.254, ::1, fc00::1, fd00:ec2::254 (mocked `node:dns/promises`) | 403, no request made |
| one public + one private address | 403 |
| DNS rebinding: second `lookup` answer would be 127.0.0.1 | DNS called once; the socket received only the validated public address |
| 301/302/307/308 responses | 502 |
| `image/svg+xml` (any case/params), `text/html`, `application/octet-stream`, missing type | 415 |
| body > 5 MB without Content-Length | 502, stream stopped before the end |
| exactly 5 MB | accepted |
| Content-Length > 5 MB | 502 before reading |
| timeout: upstream hangs / DNS hangs (50 ms override); default 5 s with fake timers | 504 |
| non-200 with a body containing "SECRET" | 502; the message does not contain it |
| `isBlockedAddress`: 21 blocked samples (incl. `::ffff:127.0.0.1`, `64:ff9b::7f00:1`, `2002:7f00:1::1`, `255.255.255.255`, `not-an-ip`), 3 public samples allowed | pass |

Free disk space: before C: 7.4 GB, D: 360 GB; after C: 7.4 GB, D: 360 GB.

Production API requests in Step 1 were **GET only, without login**, all to `https://api.nusantaralegacy.org/api`: `events?limit=100`, `events/featured`, `events/65dda91f-…`, `prot?limit=100`, `prot/<id>` ×5, `nfts?limit=100`, `nfts/slug/<slug>` ×1, `marketplace/toko?limit=100`, `marketplace/produk?limit=100` (400: `limit` not allowed), `stats/landing`. Responses were stored only in the session scratchpad; only field names, hostnames and counts are reported here.

## 7. Manual checks

On the Vercel preview of `phase-04-fe-security`:

1. **Avatar / image proxy.** No page renders `ProfileCard`, so check the proxy directly. Log in with a Google account. Open `/profile` and confirm your avatar still appears (it is loaded directly, not through the proxy, so it should look as before). Then open, in the same browser tab, `/api/proxy-image?url=<your Google photo URL, URL-encoded>` (the URL starts with `https://lh3.googleusercontent.com/`; you can copy it from the avatar with "Copy image address" on `/profile`). Expected: the photo is shown. In DevTools → Network, the response should have `Content-Type: image/...`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and `Cache-Control: public, max-age=86400`.
2. **Proxy rejections.** While logged in, open `/api/proxy-image?url=https%3A%2F%2Fexample.com%2Fa.png`. Expected: `{"error":"Host not allowed"}` with status 403 and the same two security headers, without `Cache-Control: public…`. Open `/api/proxy-image?url=http%3A%2F%2F169.254.169.254%2F`. Expected: `{"error":"Invalid URL"}`, status 400.
3. **NFT description.** Open `/nfts`, click the NFT and look at "Tentang Koleksi". Expected: the description text appears as normal text, the same as on production today, with no visible tags such as `<b>` or `&amp;`.
4. **`/about` when logged out.** In a private window, open `/about`. Expected: redirect to `/login?redirectTo=%2Fabout`.
5. Optional: if Google avatars do not load through the proxy (403), the photo host differs from `lh3.googleusercontent.com`. Add it to `PROXY_IMAGE_ALLOWED_HOSTS` in the Vercel project env and redeploy.

## 8. Findings

### Step 1.1: where `/api/proxy-image` is used and why
| Caller | Rendered by | Purpose |
|---|---|---|
| `components/dashboard/ProfileCard.tsx:16` (`getProxiedAvatarUrl`) | **nothing** (component is not imported anywhere) | Sends avatar URLs that contain `googleusercontent.com` or `googleapis.com` through the same-origin proxy, presumably to work around Google photo hotlink/referrer limits and rate limiting (429) on `lh3.googleusercontent.com`. Any other URL (for example S3) is used directly. |

No other code references `/api/proxy-image` (the only other hit is the matcher test). Other avatar renderers (`UserNav`, `AdminHeader`, `UserProfileCard`, `UsersTable`) use `avatar_url` directly in `<img>`.

### Step 1.2: avatar hosts
Where `avatar_url` comes from (code):
| Source | Host |
|---|---|
| Supabase Google OAuth `user_metadata.avatar_url`, copied by backend `syncFromSupabase` on every authenticated request | Google profile photos (`lh3.googleusercontent.com`) |
| `POST /api/upload/avatar` → S3 `images/avatars/` | `nusantara-play-storage.s3.ap-southeast-2.amazonaws.com` (seen in public PROT data, same bucket) |
| `PATCH` user with `avatar_url` (`UpdateUserDto`: only `@IsString()`) | **any** string the user types |

Public production data: only `GET /api/events`, `/api/events/featured` and `/api/events/:id` expose a user (`organizer`) with `avatar_url`. In all three it is the same single organizer, and the value is `null`. **Distinct avatar hostnames found publicly: none.** URL hostnames that appear in other public fields: `nusantara-play-storage.s3.ap-southeast-2.amazonaws.com` (PROT photos/videos/documents), `opensea.io`, `example.com` (NFT metadata), `www.tokopedia.com`, `shopee.co.id`, `www.lazada.co.id` (purchase links).

### Step 1.3: NFT `about`
| Item | Value |
|---|---|
| Public endpoint used by `app/nfts/page.tsx` | `GET /api/nfts` (via `useNfts` → `nftsApi.list`) |
| Published NFTs (`pagination.total`) | 1 |
| NFTs whose `about` contains `<` or `&` | **0** (list and `GET /api/nfts/slug/:slug` detail both checked) |
| Tags / entities used | none |
| Newlines in `about` | 0 |

So plain-text rendering changes nothing visible today, and no NFT needs an admin edit. Unpublished NFTs (admin-only `GET /api/nfts/admin`) could not be checked without logging in. If any of them contain HTML, it will show as raw text once they are published.

### Step 3: other `dangerouslySetInnerHTML`
| File | Content | Action |
|---|---|---|
| `app/layout.tsx:33` | Static inline theme script (reads `localStorage.theme`), no API data | kept |
| `app/nfts/[slug]/page.tsx:130` | NFT `about` | removed (F2) |

No others in the frontend.

## 9. Out-of-scope observations

- **Personal data leak in public event endpoints (backend, high).** `GET /api/events`, `/api/events/featured` and `/api/events/:id` (all `@Public()`) return the full `organizer` user record: `id, supabase_user_id, email, full_name, role, status, phone, avatar_url, bio, daerah_id, institution, expertise, last_login_at, created_at, updated_at, created_by, updated_by`. Email and phone of organizers are therefore public. The fix is in the backend (select or serialize only public fields), and that needs server access to deploy.
- **`avatar_url` accepts any string** (`UpdateUserDto` `@IsString()` only), and it is rendered directly in `<img>` by `UserNav`, `AdminHeader`, `UserProfileCard` and `UsersTable`. A user can set an external tracking URL that admins load when they open the users table (it leaks their IP and user agent). This is not XSS in React, but consider `@IsUrl` with a host allowlist in the backend.
- **`ProfileCard.tsx` is dead code**, and with it the only caller of `/api/proxy-image`. If it stays unused, the route could be deleted entirely (smallest attack surface).
- `Cache-Control: public, max-age=86400` on a login-only route allows shared caches to store the image. The value was kept as instructed. Google photo URLs are not secret, but `private, max-age=86400` would be more accurate.
- `GET /api/marketplace/produk?limit=100` returns 400 (`property limit should not exist`), while other list endpoints accept `limit`. The paging parameters are inconsistent.
- The backend `phase-03-api-proxy` branch (2 docs commits) was never pushed (see §5).

## 10. Open questions

1. Should `ProfileCard` be used somewhere (for example a dashboard page), or should it and `/api/proxy-image` be deleted in a later phase?
2. Is `lh3.googleusercontent.com` enough, or do you know of avatars on other hosts (for example `lh4`–`lh6`, or the S3 bucket) that should go through the proxy?
3. Backend: merge `phase-03-api-proxy` before `phase-04-fe-security`, or merge the stacked phase-04 branch, which includes Phase 03?
4. Should the organizer data leak (§9) be scheduled as soon as someone has server access?

## 11. Ready for next phase?

Yes. The code is complete and verified locally. Before the change reaches production, run the Vercel preview checks in §7, and settle the backend branch base (§5, question 3).
