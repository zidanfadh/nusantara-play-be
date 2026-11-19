# Phase 18: Navbar links, the "Nusantara Legacy" brand, login before the map, and small fixes

## 1. Summary

The brand is now "Nusantara Legacy" everywhere users see it, from one constant (`lib/brand.ts`), with `<html lang="id">`
and Open Graph metadata. The app navbar links to Jelajah and Game (on phones through a small menu button), and the landing
navbar to "Tur Virtual" and "Game" (on phones in a second row). Heavy routes are no longer prefetched, and the active link
is marked. The Jelajah map now needs a login: logged-out visitors are sent to `/login?redirectTo=…&reason=jelajah`, see the
notice, and every login path (email/password, Google, the OAuth callback, the signup round trip) returns them to the page
they wanted through a validated same-site `redirectTo`. The games under `/main` stay public. The landing statistics count
only published PROT and provinces (frontend now; the backend change is in "Pending deployment"). The congklak store totals
sit on a readable pill outside the seeds. The five remaining landing images go through next/image, and phones never fetch
the desktop-only one: phone `/` cold load fell from 674 KB to 433 KB. **The phase is complete**, except that a real login
could not be done locally (the frontend's Supabase values are placeholders); the post-login redirect is unit-tested and is
on the boss's checklist for the Vercel preview.

## 2. Git

**nusantara-play-fe**, branch `phase-18-brand-nav-login`, base `6985e79` (main, Phase 17 merge):

| Commit | Step |
|---|---|
| `4462701` | feat(brand): Nusantara Legacy from one constant, lang=id, Open Graph |
| `0858eef` | feat(nav): Jelajah/Game links, phone menu, landing links, active link, no prefetch |
| `6aa4d27` | feat(auth): Jelajah login gate, redirectTo + reason through every login path, notice, landing hint |
| `c5a70a0` | feat(landing): published-only statistics, zero numbers hidden |
| `626fb81` | fix(games): congklak store totals on a solid pill outside the seeds |
| `89383aa` | perf(landing): remaining landing images through next/image; lg-only image never on phones |
| `48c0ebc` | docs(claude): Phase 18 sections |

`git diff --stat main`: 40 files changed, 1348 insertions(+), 171 deletions(-).

**nusantara-play-be**, branch `phase-18-brand-nav-login`, base `78a96b9` (main, Phase 17 report):

| Commit | Step |
|---|---|
| `fc61645` | feat(stats): landing statistics count only ARSIP_NASIONAL PROT and their provinces, with tests |
| `ad4ded7` | docs(claude): Phase 18 shared sections |
| (this report's commit) | docs(phase-18): phase report, stats line in the module list |

`git diff --stat main` (before the report commit): 3 files changed, 138 insertions(+), 6 deletions(-)
(`CLAUDE.md`, `src/modules/stats/stats.service.ts`, `src/modules/stats/stats.service.spec.ts`).

Nothing was pushed.

## 3. Changes

Frontend:
- `lib/brand.ts` (new): `SITE_NAME` "Nusantara Legacy", `SITE_TAGLINE`, `SITE_DESCRIPTION`, `SITE_NAME_WORDS`.
- `lib/jelajah/brand.ts` (deleted): the bumper imports `lib/brand.ts` directly.
- `components/jelajah/bumper/BrandScene.tsx`, `tests/jelajah/bumper-scenes.test.tsx`: import from `@/lib/brand`.
- `app/layout.tsx`: title/description/applicationName/Open Graph from the brand, `lang="id"`.
- `app/page.tsx`: brand everywhere (navbar, hero on two lines from `SITE_NAME_WORDS`, quote, FAQ, footer, alt texts);
  the banner heading is "Tur Virtual / Jelajah Nusantara"; navbar page links and a phone row; "Perlu masuk akun" hint;
  `prefetch={false}` on links to `/menu` and `/jelajah`; published-only stats tiles; images through next/image /
  `DesktopOnlyImage`; the unused `LandingStats` import removed.
- `app/(auth)/layout.tsx`, `app/(protected)/admin/dashboard/page.tsx`, `app/calendar/page.tsx`,
  `app/landing-page/1/page.tsx`, `app/landing-page/2/page.tsx`, `components/admin/AdminHeader.tsx`,
  `components/admin/AdminSidebar.tsx`, `components/ui/AppFooter.tsx`, `components/ui/HeroCarousel.tsx` (alt text, and
  `prefetch={false}` on the slide link): brand from `SITE_NAME`.
- `components/ui/nav-links.ts` (new): the link lists, `NO_PREFETCH_ROUTES`, `isActiveLink`.
- `components/ui/AppNavbar.tsx`: links from the shared list, `aria-current`, the phone menu button and panel, no
  prefetch of heavy routes, brand one size smaller below `sm`.
- `components/ui/UserNav.tsx`: chevron hidden below `sm` (room for the menu button at 360 px).
- `middleware.ts`: `/jelajah` and `/jelajah/*` removed from the public routes (the static geo/assets/demo files stay
  public); new pure `routeDecision()`; the redirect carries the path, the query and `reason=jelajah`; a logged-in visitor
  on `/login` goes to a valid `redirectTo`.
- `components/auth/login-redirect.ts` (new): `safeRedirectPath`, `redirectTargetOr`, `parseLoginReason`, `authQuery`,
  `loginUrlFor`, the Google cookie helpers, `callbackTarget`, `loginRetryPath`, the notice text.
- `components/auth/LoginNotice.tsx` (new): the Jelajah notice.
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`: read `redirectTo`/`reason`/`error` and pass them on.
- `components/auth/LoginForm.tsx`: notice, callback error, `loginAndRedirect()` (lands on `redirectTo`), signup link
  keeps the query; brand.
- `components/auth/SignupForm.tsx`: notice, both login links keep the query, Google keeps the target; brand; unused
  `router` removed.
- `components/auth/SocialAuthButtons.tsx`: stores the target in the `np_post_login` cookie before Google sign-in.
- `app/auth/callback/route.ts`: validated target (`next` or the cookie or `/menu`), cookie cleared, failures go back
  to the login page with the target.
- `components/landing/published-stats.ts` (new): published counts with the map's code, tiles without zeros.
- `components/landing/DesktopOnlyImage.tsx` (new), `components/landing/image-sizes.ts` (new): landing images.
- `components/games/congklak/store-label.ts` (new), `components/games/congklak/CongklakBoard.tsx`: store total pill
  and name positions.
- Tests (new): `tests/config/brand.test.ts`, `tests/landing/navbar-links.test.tsx`,
  `tests/landing/published-stats.test.ts`, `tests/middleware/login-gate.test.tsx`,
  `tests/games/congklak-store-label.test.tsx`. Changed: `tests/middleware/public-routes.test.ts` (Jelajah now
  protected), `tests/landing/landing-images.test.tsx` (Phase 18 images).
- `CLAUDE.md`: new section "Brand, navbar and the Jelajah login gate (Phase 18)", updated Architecture, Jelajah,
  bumper, games, images; shared sections.

Backend:
- `src/modules/stats/stats.service.ts`: `totalProt` and `totalProvinsi` count ARSIP_NASIONAL only.
- `src/modules/stats/stats.service.spec.ts` (new): 3 tests.
- `CLAUDE.md`: shared sections (identical to the frontend's), the stats line in the module list.
- `docs/phase-reports/phase-18.md`: this report.

## 4. Decisions

- The static files under `/jelajah/geo/`, `/jelajah/assets/` and `/jelajah/demo/` stay public: they are data, not
  pages, and only the map pages fetch them.
- `redirectTo` keeps the query string (`/jelajah?debug=1` survives the login); it may never be `/login` or `/signup`;
  the fallback stays `/menu` (the old default). A logged-in visitor who opens `/login?redirectTo=…` goes there
  instead of `/profile`.
- Google sign-in carries the target in a short-lived cookie (`np_post_login`, 10 min, SameSite=Lax), not in a query
  on the Supabase redirect URL, so the Supabase redirect allowlist (exact `/auth/callback`) needs no change. The
  callback still accepts a validated `next`.
- The callback's old `next` handling was an open redirect (`${origin}${next}` with `next=@evil.com` leaves the site);
  fixed as part of "check every login path".
- The signup page shows the same notice as the login page, so the reason is not lost on the way.
- App navbar on phones: a menu button next to the theme toggle (not the account dropdown), so guests and members find
  the links the same way. Landing navbar on phones: a second row, because the bar is already full.
- Landing heading "Nusantara Virtual Tour" → "Tur Virtual / Jelajah Nusantara" (both feature names). The landing
  hero shows the two words of `SITE_NAME` on two lines.
- Landing statistics are computed in the frontend (server side, no login token, 60 s cache) with the map's own code
  (`fetchPublicProt` + `shapeProvinceSummaries` over `KNOWN_PROVINCES`), so they match the map and the bumper even
  before the backend change is deployed. When every tile is 0 or unknown the whole stats bar is hidden.
- `prefetch={false}` also on the landing hero links to `/menu` and `/jelajah` and the carousel slide, otherwise the
  landing page would still prefetch those routes.
- Store label: total at the top end of the tall (horizontal-board) store and at the left end of the wide (portrait)
  store, owner name at the other end; fixed board colours, so the same pill reads in both site themes.

## 5. Deviations

- Files added outside the named list but within the allowed groups: `components/ui/nav-links.ts` (navbar),
  `components/auth/login-redirect.ts` and `LoginNotice.tsx` (login components; the validator lives there rather than
  in `lib/` to stay inside the allowed files), `components/landing/*` (landing components),
  `components/games/congklak/store-label.ts` (store label). `components/ui/UserNav.tsx` (part of the navbar) lost its
  chevron below `sm`.
- The post-login redirect was not tried with a real login: locally the frontend's Supabase values are placeholders, so
  no login is possible. It is covered by unit tests (`loginAndRedirect`, `callbackTarget`, the middleware decisions)
  and is item 3 of the boss's checklist.

## 6. Verification

Frontend (all with `TEMP/TMP/TMPDIR=D:/dev-cache/tmp`):

| Command | Result |
|---|---|
| `pnpm test` | exit 0, 42 files, **546 passed**, 0 failed, 0 skipped (main: 40 files, 507) |
| `pnpm lint` | exit 1 (baseline), **44 errors, 80 warnings** (main 44 / 82); every new and touched file has 0 errors |
| `pnpm check:jelajah` | exit 0: `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)`, `check:jelajah OK` |
| `pnpm build` (inline placeholder Supabase, `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api`) | exit 0, no warnings; `ƒ /login`, `ƒ /signup`, `○ /jelajah`, `○ /main`, `○ /main/congklak` |

Backend:

| Command | Result |
|---|---|
| `npm test -- --cacheDirectory D:/dev-cache/jest` | exit 0, 46 suites, **587 passed** (3 new) |
| `npm run build` | exit 0 |
| `npm run lint` | exit 1 (baseline), 220 errors, 29 warnings (unchanged); `npx eslint src/modules/stats` clean |

Production build checks (`next start`, production API read-only, logged out):

```
curl /jelajah                   307 → /login?redirectTo=%2Fjelajah&reason=jelajah
curl /jelajah/sumatera-selatan  307 → /login?redirectTo=%2Fjelajah%2Fsumatera-selatan&reason=jelajah
curl /jelajah?debug=1           307 → /login?redirectTo=%2Fjelajah%3Fdebug%3D1&reason=jelajah
curl /main, /main/congklak      200
curl /jelajah/geo/indonesia-provinces.json 200
curl /profile                   307 → /login?redirectTo=%2Fprofile
```

Rendered HTML (`curl -L`): "Nusantara Virtual" 0 times on `/`, `/prot`, `/jelajah` (→ login), `/main`, `/main/congklak`,
`/login`, `/signup`, `/calendar`, `/events`, `/nfts`, `/menu`; "Nusantara Legacy" 9 to 28 times each; `lang="id"`
everywhere; `og:title`/`og:site_name` "Nusantara Legacy", `og:locale` id_ID.

Headless Chrome (`D:/dev-cache/tmp/phase-18/checks.txt`):
```
login notice 390/desktop: url=/login?redirectTo=%2Fjelajah&reason=jelajah, notice text as specified,
  signup=/signup?redirectTo=%2Fjelajah&reason=jelajah, overflow=0
landing button: /jelajah describedby=tur-virtual-login-hint hint="Perlu masuk akun" -> /login?redirectTo=%2Fjelajah&reason=jelajah
congklak "Kembali ke desa" (logged out) -> /login?redirectTo=%2Fjelajah%2Fsumatera-selatan&reason=jelajah
app navbar 360: overflow=0, last control right edge 344/360; phone menu Menu, Kalender, Jelajah, Game[current]; Esc closes
app navbar 390: overflow=0, 374/390; same menu
app navbar desktop: Menu, Kalender, Jelajah, Game[current]
landing navbar 360/390: Masuk, Daftar, Tur Virtual, Game visible, overflow=0, nav 122 px, hero starts at 120 px
landing navbar desktop: 5 anchors + Tur Virtual, Game, Masuk, Daftar, no horizontal overflow
landing stats: 5 PERMAINAN | 5 PROVINSI | 1 EVENTS | 53 ANGGOTA
congklak light/dark × portrait 390 / landscape 844 / desktop: scores 20,17, pills 20,17, overflow 0
```

Free space: before C: 13 GB, D: 342 GB; after C: 13 GB, D: 342 GB.

## 7. Manual checks

For the boss, on the Vercel preview of `phase-18-brand-nav-login`:

1. Open the site logged out: the name is "Nusantara Legacy" in the navbar, the hero, the footer and the browser tab.
2. Press "Mulai Tur Virtual" (it shows "Perlu masuk akun" underneath): the login page opens with the notice "Masuk dulu
   untuk memulai Tur Virtual. Setelah masuk, kamu langsung diarahkan ke peta."
3. Log in with email and password: the map opens directly (the intro bumper plays if it has not played today). Log out,
   repeat with "Continue with Google": again the map opens.
4. Logged out, open `/jelajah/sumatera-selatan` directly: notice; after login you are in the Sumatera Selatan village.
5. Logged out, open `/main/congklak` and play: no login asked. Play a few moves: the store totals are on light pills next
   to the seeds, never on top of them (try the phone upright and sideways, and the dark theme).
6. On a phone: the app navbar's ☰ button lists Menu, Kalender, Jelajah, Game (the current page highlighted); the landing
   page shows "Tur Virtual" and "Game" in a row under the bar.
7. Landing statistics: Permainan and Provinsi show the same numbers as the Jelajah map (published PROT only).

Screenshots (`D:/dev-cache/screens/phase-18/`): `navbar-app-360.png`, `navbar-app-360-menu-open.png`,
`navbar-app-390.png`, `navbar-app-390-menu-open.png`, `navbar-app-desktop.png`, `navbar-landing-360.png`,
`navbar-landing-390.png`, `navbar-landing-desktop.png`, `login-notice-390.png`, `login-notice-desktop.png`,
`landing-tur-virtual-hint-390.png`, `landing-stats-390.png`, `landing-stats-desktop.png`,
`congklak-store-portrait-390-light.png`, `congklak-store-portrait-390-dark.png`,
`congklak-store-landscape-844-light.png`, `congklak-store-landscape-844-dark.png`,
`congklak-store-desktop-light.png`, `congklak-store-desktop-dark.png`.

## 8. Findings

Cold load (production build, production API read-only, headless Chrome, cache off; phone 390x844 dpr 3; 2 runs each,
identical):

| Page | main | Phase 18 |
|---|---|---|
| `/` phone, on load | 674 KB (images 299 KB) | **433 KB** (images 57 KB) |
| `/` phone, after scrolling to the bottom | 939 KB (images 495 KB) | **765 KB** (images 358 KB) |
| `/` desktop 1440x900, on load | 801 KB | **600 KB** |
| `/` desktop, after scrolling | 972 KB | **778 KB** |
| `/main/congklak` phone | 342 KB | 341 KB |
| `/main/congklak` desktop | 361 KB | 355 KB (no prefetch of /calendar, /menu) |

Landing images on a phone, before → after: `nusantara-legacy.webp` 126 KB at load → 54 KB (w=1080, lazy);
`arsip` 39 → 25 KB, `komunitas` 31 → 14 KB, `sertifikasi` 85 → 65 KB (all now lazy; phones request the w=1920 variant,
which the optimizer serves at the 512 px source size); `blockchain.webp` 15 KB → **not downloaded**.

Production statistics on 2026-11-19: published 5 PROT in 5 provinces (the backend's current all-status counts are
higher; its change is in Pending deployment item 11), 1 event, 53 members.

Checklist for the boss:
- [ ] Brand "Nusantara Legacy" looks right everywhere (tab title, navbar, landing, login, footer).
- [ ] Login before the map works with email/password and Google, and lands on the map (manual checks 2 to 4).
- [ ] Congklak stays playable without login; the store numbers are readable.
- [ ] Phone navbar menu and the landing "Tur Virtual · Game" row are acceptable.
- [ ] Merge, then deploy the backend stats change when server access exists.

## 9. Out-of-scope observations

- The landing page's featured PROT (`getFeaturedGames` in `app/page.tsx`) still calls `/prot` with the visitor's token
  and no status filter, so a kurator or admin may see unpublished PROT there (the map sends `status=ARSIP_NASIONAL`).
- The login and signup pages show an English heading ("Sign In", "Create Account") above the Indonesian one ("Masuk",
  "Daftar").
- "Masuk sebagai Tamu" goes to `/menu`, not to `redirectTo` (a guest cannot open the map anyway).
- Email signup confirmation goes through Supabase's own link and lands on the Supabase Site URL, without `redirectTo`.
- `/landing-page/1` and `/landing-page/2` are old landing variants that are still routes (login required); they now
  show the new brand.
- Next.js 16 still warns that `middleware.ts` should become `proxy.ts` (unchanged).
- On the horizontal congklak board the owner name ("Komputer") nearly fills the store width; it stays readable.

## 10. Open questions

1. Should the Supabase redirect allowlist ever contain query-string variants of `/auth/callback`? Not needed today
   (the target travels in a cookie); only relevant if the self-hosted Google login is built differently.
2. Should guests ("Masuk sebagai Tamu") see a hint that the map needs an account, or should the guest button be hidden
   when `reason=jelajah`?
3. Should the old `/landing-page/1` and `/2` routes be removed?

## 11. Ready for next phase?

Yes. The frontend can be merged after the boss's review of the Vercel preview (checklist above). The backend stats
change waits for server access (Pending deployment item 11) and is not needed for correct numbers on the site, because
the landing page already computes them.
