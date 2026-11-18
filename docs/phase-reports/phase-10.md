# Phase 10 (Visual track V1): Jelajah Nusantara foundation and the Indonesia hub map

> **Sumatera Selatan, the pilot province, has 0 public PROT (status ARSIP_NASIONAL) in production.** Only 5 public PROT
> exist in total (Aceh, Jawa Barat, Jawa Tengah, Kepulauan Riau, Sulawesi Selatan: one each). The V2 province scene
> needs PROT content in Sumatera Selatan first.

## 1. Summary

The frontend has a new public page `/jelajah`: a gently extruded, low-poly 3D map of Indonesia's provinces on a calm sea,
built with three.js / @react-three/fiber / @react-three/drei. You can pan and zoom it, but not rotate it. It comes with a
2D SVG fallback, automatic device tiers (full, lite, 2d) and a settings menu to override the tier. Provinces with public
PROT are coloured and open a card that lists their PROT, with links to `/prot/[id]`. Sumatera Selatan, the pilot, carries
a "★ Pilot" marker, and its card has a "Masuk" button to the placeholder page `/jelajah/sumatera-selatan`. The retired
domain nusantaravirtual.org (and its www) now redirects with a 308 to https://nusantaralegacy.org. three.js loads only in
the 3D tier of `/jelajah` and stays out of every other route. A cold load of `/jelajah` transfers at most 962 KB (budget
5 MB), and the scene uses 3 draw calls and about 39k triangles. The work was paused once because C: dropped below 3 GB;
after the owner moved Docker's data to D: it was resumed and finished. **The phase is complete.** Not yet verified: the
frame rate on a real mid-range Android phone (see 7 and 10). No navbar link was added; the boss reviews through the
Vercel preview.

## 2. Git

**Frontend** (`nusantara-play-fe`), branch `phase-10-jelajah-hub`, base `7892ff1` (main, Phase 09 docs).

| Commit | Step |
|--------|------|
| `7276c53` | 2: redirect retired nusantaravirtual.org hosts (308), tests, Deployment facts |
| `4978d55` | 3: three / fiber / drei (+ @types/three, mapshaper), `/jelajah` route, public paths, three.js isolation test |
| `19262dd` | 4: province registry, name-to-code matching, public PROT data layer |
| `4c29bd3` | 5: geo script and data, 3D hub map, province card, text list |
| `1ff968d` | 6: `/jelajah/sumatera-selatan` placeholder, other slugs 404 |
| `77a203e` | 7: device tiers, SVG fallback map, budgets, dev overlay |
| `9be474e` | 8 (fixes found during verification): DOM pilot marker, closer first view on phones, gradient legend |
| `e93105b` | 8: dev overlay position, one warning per set of exceeded budgets |
| `78df1ab` | Owner's disk rule: "Local machine" section (everything on D:) |
| `6543e79` | 9: CLAUDE.md (visual track, /jelajah structure, decisions) |

`git diff --stat 7892ff1..HEAD`: 36 files changed, 4224 insertions(+), 11 deletions(-) (of which `pnpm-lock.yaml`
1038 lines; without it 35 files, 3186 insertions, 11 deletions).

**Backend** (`nusantara-play-be`), branch `phase-10-jelajah-hub`, base `5431bc7` (main, Phase 09 report).

| Commit | Content |
|--------|---------|
| `9e31fcd` | Deployment facts: single domain, pending item 9 (`FRONTEND_URLS`) |
| `69949db` | Owner's disk rule: "Local machine" section (everything on D:) |
| `2ea0022` | Step 9: visual track decisions, Jelajah summary, decisions log, lint baseline |
| (report commit, see the final message) | `docs/phase-reports/phase-10.md` |

`git diff --stat 5431bc7..HEAD` (before the report commit): `CLAUDE.md` only. Nothing is pushed.

## 3. Changes

**Frontend, new**
- `app/jelajah/page.tsx`: hub page (static), navbar + `JelajahHub`, metadata.
- `app/jelajah/[provinsi]/page.tsx`: `generateStaticParams` + `dynamicParams = false`; only `sumatera-selatan` exists, every other slug is a 404.
- `components/jelajah/JelajahHub.tsx`: state (hover, selection), tier choice, loading / error / retry banners, Demo label, legend, text alternative list, attribution; loads `Map3D` via `next/dynamic` with `ssr: false` and falls back to 2D if WebGL throws.
- `components/jelajah/Map3D.tsx`: R3F canvas (full and lite tiers), merged province geometry, borders, sea, fixed-angle `MapControls` (no rotation, pan clamped to the map, zoom limits), ground-plane picking, DOM pilot marker, development stats overlay.
- `components/jelajah/Map2D.tsx`: SVG map with the same data and interactions; drag, wheel and pinch to pan and zoom; clickable provinces are keyboard buttons.
- `components/jelajah/ProvinceCard.tsx`: DOM card (non-modal dialog, focus moves to it, Esc closes and returns focus), PROT list with photos, "Masuk" for the pilot.
- `components/jelajah/TierMenu.tsx`: "Tampilan" settings menu (radio group Otomatis / Lengkap / Ringan / 2D).
- `components/jelajah/ProvincePlaceholder.tsx`: "Segera hadir" page body with the province's PROT list and a link back to the map.
- `lib/jelajah/provinces.ts`: the 35 production province codes, pilot, enterable provinces, name normalization, aliases, shape-to-code matching.
- `lib/jelajah/data.ts`: loading through `apiClient` (always `status=ARSIP_NASIONAL`, paged, capped), per-province shaping, https-only photo URLs.
- `lib/jelajah/use-jelajah-data.ts`, `use-province-shapes.ts`, `use-device-tier.ts`, `use-theme-mode.ts`: hooks (isMounted + refresh pattern; theme via `useSyncExternalStore`).
- `lib/jelajah/geo.ts`: projection, GeoJSON parsing, hit test, SVG paths, bounds, portrait framing, attribution text (no three.js).
- `lib/jelajah/map-model.ts`: shared view props, clickability, visual state, fills.
- `lib/jelajah/palette.ts`: light and dark map colours derived from the `globals.css` tokens.
- `lib/jelajah/three/map-geometry.ts`: merged extruded geometry (top caps and walls, no bottom), per-province colour ranges.
- `lib/jelajah/device-tier.ts`: tier decision, WebGL2 / deviceMemory / hardwareConcurrency signals, fps probe, localStorage choice (try/catch).
- `lib/jelajah/budget.ts`: budget constants and violation check.
- `public/jelajah/geo/indonesia-provinces.json` (225 KB, 68 KB gzipped) and `ATTRIBUTION.txt` (source, licence, changes, how to regenerate).
- `scripts/build-jelajah-geo.mjs`: downloads (pinned commit, SHA-256 check) and simplifies the boundaries with mapshaper; fails above 400 KB.
- `tests/config/domain-redirects.test.ts`: redirects evaluated with Next.js' own route matcher (host match, path and query kept, `/backend-api` included, apex / www / look-alike hosts untouched).
- `tests/jelajah/*.test.ts`: data shaping and paging, name-to-code matching (including the committed GeoJSON), geometry and hit test, device tier and storage, palette and clickability, budgets, three.js import isolation.

**Frontend, modified**
- `next.config.ts`: `redirects()` for the retired hosts (`CANONICAL_ORIGIN`, `RETIRED_HOSTS`, `domainRedirects()`).
- `middleware.ts`: `/jelajah` and `/jelajah/*` are public.
- `package.json`, `pnpm-lock.yaml`: three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9; dev @types/three 0.187.0, mapshaper 0.6.18; script `jelajah:geo`.
- `tests/middleware/public-routes.test.ts`: `/jelajah` routes public, no widening.
- `CLAUDE.md`: Deployment facts, Current direction item 9, Jelajah structure, Local machine, Decisions log, lint baseline.

**Backend**
- `CLAUDE.md`: the same shared sections (identical to the frontend from "Current direction" on).
- `docs/phase-reports/phase-10.md`: this report.

## 4. Decisions

- **Pilot without PROT stays clickable** (accepted by the owner as a deviation): Sumatera Selatan gets its own soft colour
  and a card that says "Belum ada PROT berstatus Arsip Nasional di provinsi ini." plus the "Masuk" button. Every other
  province without public PROT is muted and not clickable.
- **Map source: geoBoundaries gbHumanitarian IDN ADM1** (OCHA ROAP via HDX, 2019, CC BY 3.0 IGO; accepted by the owner).
  The prompt's example, gbOpen, turned out to be ODbL 1.0 (OpenStreetMap). The attribution is on the page and in
  `public/jelajah/geo/ATTRIBUTION.txt`.
- **mapshaper 0.6.18** (accepted by the owner): versions from 0.6.19 onwards depend on `msgpackr` (native
  `msgpackr-extract`) and 0.8.x on `better-sqlite3`. Both are new build scripts that pnpm 12 refuses
  (`ERR_PNPM_IGNORED_BUILDS`). 0.8.5 was also younger than the release-age policy, and pnpm then wrote an exclusion into
  `pnpm-workspace.yaml` (reverted; that file was not in the allowed list).
- **@types/three 0.187.0 as a dev dependency** (accepted by the owner): three ships no types, and the copy pulled in as a
  peer is not visible to app code.
- Only `sumatera-selatan` is a valid `/jelajah/[provinsi]` slug; other province slugs are 404 too (they cannot be entered yet).
- Province codes are matched to shapes at runtime in the browser by name, against the API list (or the built-in list of
  35 production codes when the API fails), so the map always renders. A test checks that all 34 committed shapes match.
- One merged geometry for all provinces (vertex colours, highlight by recolouring only that province's vertex range) and
  one line set for the borders: 3 draw calls in total.
- Picking intersects the pointer ray with the ground plane and runs a point-in-polygon test, instead of raycasting about
  40k triangles on every pointer move. A tap counts only if the pointer moved less than 8 px, within 600 ms, with one
  finger, so pans and pinches never select.
- Production renders on demand (`frameloop="demand"`, saves battery); development renders continuously so the fps
  overlay measures real frame cost.
- Phones (portrait) first show Sumatra to Sulawesi (55 % of the map width); the whole country is one pan away. Same rule in 2D.
- Tier thresholds: 2d without WebGL2, with deviceMemory < 2 GB, or with a probe below 24 fps; lite with deviceMemory ≤ 4,
  ≤ 4 cores or a probe below 50 fps; otherwise full. Missing signals are ignored. The automatic result is cached per
  browser; a background-tab probe (no frames) is not cached.
- The "★ Pilot" marker is a DOM button that the scene positions every frame. drei `<Html>` created its wrapper but never
  rendered its content in the production build.
- The "Demo" label sits in the title chip (top-left corner) on both pages, with a tooltip saying that nothing is saved.
- Brand colours are mirrored as hex constants from `globals.css` (three.js needs plain colours), and the map recolours
  live when the navbar theme toggle is used.

## 5. Deviations

- The pilot province is clickable without PROT (see 4; accepted by the owner).
- Map source is gbHumanitarian, CC BY 3.0 IGO, not gbOpen (see 4; accepted by the owner).
- mapshaper is pinned to 0.6.18, not the latest version (see 4; accepted by the owner).
- `@types/three` was added besides the three named packages (see 4; accepted by the owner).
- No rule for `www.nusantaralegacy.org`: Step 1.2 showed Vercel already redirects it (307), as the prompt foresaw.
- Fps was not measured on target hardware: headless Chrome renders in software (SwiftShader), see 6 and 10.
- The dev-overlay screenshot was taken before commit `e93105b` moved the overlay away from the Next.js dev badge.

## 6. Verification

**Disk**
- Start: C: 5.9 GB free, D: 360 GB.
- During Step 8: C: 2.5 GB, so work stopped as the prompt requires. In the last 3 h the C: folders written by this
  phase grew only slightly (Chrome profile +33 MB, pnpm 0 MB); the rest is not explained by this phase.
- The owner then moved Docker Desktop data to D: (`D:\DockerData\wsl\DockerDesktopWSL\disk\docker_data.vhdx`, setting
  `CustomWslDistroDir`; no vhdx left under `%LOCALAPPDATA%\Docker\wsl`).
- After that: C: 8.3 GB, D: 357 GB. End: **C: 8.4 GB, D: 357 GB**.

**Local stack after the Docker move**
- `npm run db:up` (exit 0): `nusantara-dev-db` Up (healthy) 127.0.0.1:5432; `nusantara-dev-mailpit` Up (healthy)
  127.0.0.1:1025, 8025.
- `nusantara_play_dev` and `nusantara_play_test`: 24 tables each, `daerah` 91217 rows, `prot` 3, `users` 2 / 1, all five
  auth tables present. The volume `nusantara-dev-db-data` survived, so `db:setup` was not needed.

**Step 1: production API** (GET and HEAD only)
- `GET /api/daerah/provinces?page=1&limit=100`: 200, 35 provinces, two-digit Kemendagri codes (`"kode": "16"` = Sumatera
  Selatan). Papua Selatan is 93; Papua Tengah, Papua Pegunungan and Papua Barat Daya are absent.
- `QueryPROTDto`: `page`, `limit` (default 10, **no maximum**: `limit=1000` was accepted), `jenis`, `provinsi`
  (= `provinsiKode`), `kabkota`, `kecamatan`, `desa`, `targetUsia`, `search`, `status`, `created_by`.
- Anonymous callers only see ARSIP_NASIONAL. Logged-in kurator, pakar or admin also see other statuses unless
  `status=ARSIP_NASIONAL` is sent (the frontend always sends it).
- `GET /api/prot?page=1&limit=100&status=ARSIP_NASIONAL`: total 5. `GET /api/prot?provinsi=16&limit=100`: total 0.

**Step 1.2: redirects today**

| URL | Result |
|-----|--------|
| https://nusantaralegacy.org | 200, Vercel |
| https://www.nusantaralegacy.org | TLS error `SEC_E_WRONG_PRINCIPAL`; without verification: 307 → `https://nusantaralegacy.org/` |
| https://nusantaravirtual.org | 200 (serves the site itself) |
| https://www.nusantaravirtual.org | TLS error; without verification: 307 → `https://nusantaravirtual.org/` |
| http:// (all four) | 308 → https:// on the same host |

The certificate of all hosts is `CN=nusantaralegacy.org`, with only that name in its SAN list.

**Tests, lint, build**
- `pnpm test`: exit 0. 14 files, 175 tests passed, 0 failed, 0 skipped (before the phase: 7 files).
- `pnpm lint` (whole repo): exit 1, `✖ 131 problems (44 errors, 87 warnings)`, unchanged from the baseline.
- `npx eslint` on every new and touched file: exit 0, no output.
- `npx tsc --noEmit`: exit 0.
- `pnpm build` with `NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`
  and `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api`: exit 0.
  `✓ Compiled successfully`, 46/46 static pages, `○ /jelajah`, `● /jelajah/[provinsi] └ /jelajah/sumatera-selatan`.
- `pnpm install --frozen-lockfile` (pnpm 12.14.0): exit 0. `lockfileVersion: '9.0'`, no ignored build scripts, `pnpm-workspace.yaml` unchanged.

**Bundle isolation** (production build)
- The only chunk with three.js: 947 KB raw, 248 KB gzipped.
- Its only references: `server/app/jelajah/page/react-loadable-manifest.json` (the lazy `next/dynamic` import) and the
  `/jelajah` hub chunk.
- No other route's client-reference manifest or HTML references it.

**Local production server** (`next start -p 3001`, real Host headers)

| Host | `/` | `/prot?page=2&jenis=x` | `/backend-api/prot?limit=1` |
|------|-----|------------------------|-----------------------------|
| nusantaravirtual.org | 308 → `https://nusantaralegacy.org` | 308 → `…/prot?page=2&jenis=x` | 308 → `…/backend-api/prot?limit=1` |
| www.nusantaravirtual.org | 308 (same) | 308 (same) | 308 (same) |
| nusantaralegacy.org, www.nusantaralegacy.org, localhost | 200 | 200 | 200 |

| Path | Result |
|------|--------|
| `/jelajah` | 200 |
| `/jelajah/sumatera-selatan` | 200 |
| `/jelajah/jawa-barat` | 404 |
| `/jelajah/geo/indonesia-provinces.json` | 200, 225046 B |

**Step 8.2: cold-load transfer of /jelajah**
Measured with headless Chrome 157 through the DevTools protocol, cache disabled, fresh tab, network idle for 1.5 s;
budget 5 MB.

| Scenario | Bytes | Requests |
|----------|-------|----------|
| Desktop 1440×900, full tier | 947,669 | 31 |
| Phone 390×844, automatic tier (→ lite) | 927,410 | 24 |
| Desktop, 2d tier | 698,198 | 30 |
| Phone, 2d tier | 677,930 | 23 |
| Largest observed (desktop, card opened, photos) | 961,965 | 37 |

The biggest items of the 3D load are the existing favicon (258 KB), the three chunk (249 KB), the app chunk (71 KB) and
the geo file (68 KB).

**Render stats** (development overlay, headless Chrome, desktop, full tier)
- 3 draw calls, 39.3k triangles (unit test: < 100k for the committed map).
- 14 to 15 fps under SwiftShader (software rendering, development mode, continuous loop). This is not representative
  of the target phone; see 10.

**Step 8.3: screenshots** (`D:/dev-cache/screens/phase-10/`)
- `cold-desktop-full-light.png`, `desktop-full-dark.png`
- `cold-phone-auto-light.png`, `phone-lite-light.png`, `phone-lite-dark.png`
- `cold-desktop-2d-light.png`, `phone-2d-light.png`, `phone-2d-dark.png`
- `desktop-card-sumsel-light.png`, `phone-card-sumsel-dark.png`, `desktop-2d-card-sumsel-dark.png`
- `dev-overlay-api-error-desktop-full.png` (local backend not running: the map renders, with the error banner and "Coba lagi")

The dark screenshots switch the theme after load (like the navbar toggle), because a reload in dark mode loses the theme
(see 9).

## 7. Manual checks

Boss demo on the Vercel preview of `phase-10-jelajah-hub` (open `<preview-url>/jelajah` directly; there is no navbar link).

**Phone** (Android Chrome, ideally a 4 GB device)
1. Open `/jelajah`. Within a few seconds a map of Indonesia appears, with the western half (Sumatra to Sulawesi) in view.
   Coloured: Aceh, Kepulauan Riau, Jawa Barat, Jawa Tengah, Sulawesi Selatan. Sumatera Selatan is pale gold with a red
   "★ Pilot" marker. "Jelajah Nusantara · DEMO" is top-left, "Tampilan" top-right.
2. Drag with one finger: the map moves and stops at the edges. Pinch: it zooms in and out within limits. It never rotates.
3. Tap Jawa Barat: it turns teal and a card slides up from the bottom with its PROT and photo. Tap the PROT: its `/prot/…` page opens.
4. Go back, tap the "★ Pilot" marker (or Sumatera Selatan): the card says "0 PROT publik", "Belum ada PROT…" and shows
   "Masuk". Tap Masuk: the "Segera hadir" page for Sumatera Selatan appears. "Kembali ke peta" returns to the map.
5. Tap a grey province (e.g. Papua): nothing opens. Tap the sea: an open card closes.
6. "Tampilan" → "Peta 2D": a flat map with the same colours and card. Switch back to "Otomatis"; reload; the choice is remembered.
7. Watch smoothness while panning. If it stutters, note the phone model and try "Ringan".

**Laptop**
1. Open `/jelajah`: the whole of Indonesia is visible. Hovering a coloured province highlights it and shows
   "<name> · n PROT" at the top. Grey provinces do not react; the cursor stays an arrow.
2. Mouse wheel zooms towards the cursor; dragging pans.
3. Navbar theme toggle: the map, card and legend switch to the dark palette and stay readable.
4. Keyboard: Tab to "Daftar provinsi" below the map; Enter on "Sumatera Selatan" scrolls up and opens the card with focus
   on its title; Tab reaches "Masuk"; Esc closes the card.
5. `/jelajah/jawa-barat` shows the 404 page. Opening the preview with a nusantaravirtual.org Host is not possible on a
   preview; after merge, https://nusantaravirtual.org/prot should land on https://nusantaralegacy.org/prot.

## 8. Findings

**Sumatera Selatan has 0 public PROT.** Production has 5 public PROT in total, one each in Aceh (11), Jawa Barat (32),
Jawa Tengah (33), Kepulauan Riau (21) and Sulawesi Selatan (73). V2 needs at least 3 PROT in Sumatera Selatan.

**The www hosts have no TLS certificate.** The certificate served for every host contains only `nusantaralegacy.org`.
`https://www.nusantaralegacy.org` and `https://www.nusantaravirtual.org` therefore show a certificate error in browsers
before Vercel's 307 redirect can run. Fix in the Vercel project's domain settings: add both www domains, or remove their
DNS records.

| Item | Result |
|------|--------|
| Provinces in production | 35 (codes 11 … 93; the 2022 Papua provinces Tengah, Pegunungan and Barat Daya are missing) |
| Public PROT per province | 11: 1, 21: 1, 32: 1, 33: 1, 73: 1, all others 0 (including Sumatera Selatan, 16) |
| PROT page size | no maximum in `QueryPROTDto`; the frontend uses 100 per page, at most 50 pages |
| Shapes in the map data | 34 (2019), all matched to a code by exact normalized name; no aliases were needed |
| Province without a shape | Papua Selatan (93): listed in the text list with a note; its area is part of the old "Papua" shape |
| Cold load /jelajah, 3D | 0.93 to 0.96 MB (budget 5 MB) |
| Cold load /jelajah, 2D | 0.68 to 0.70 MB, three.js not fetched |
| Draw calls / triangles | 3 / 39.3k (budgets 100 / 100k) |
| Geo file | 225 KB raw, 68 KB gzipped, 13,413 points |

**Client-side counting does not scale.** `/jelajah` downloads every public PROT (full records, including descriptions)
to count them. Fine for 5 PROT, not for thousands. A backend endpoint `GET /api/jelajah/provinces` returning
`{ kode, nama, protCount, prots: [{ id, nama, foto }] (top n) }` should replace it.

**Redirect test approach.** The redirect tests use Next.js' internal route-matching helpers
(`next/dist/shared/lib/router/utils/*`, `next/dist/lib/redirect-status`). A Next.js upgrade may move them; the imports
are commented.

## 9. Out-of-scope observations

- **Dark-mode hydration error #418** (to be fixed in a visual phase). In the production build, any page loaded with
  `localStorage.theme = 'dark'` throws React error #418 and ends with an empty `<html>` class, so dark mode is lost after
  a reload. Reproduced on `/prot` and `/jelajah`, not in light mode. The likely cause is `AnimatedThemeToggler`, which
  reads localStorage in its `useState` initializer (server and client render differently), together with the inline
  theme script in `app/layout.tsx`. The hydration re-render also caused about 0.5 MB of extra transfer in one
  measurement.
- The navbar brand still says "Nusantara Virtual", and the root metadata title is "Nusantara Virtual", although the
  product domain is nusantaralegacy.org.
- `GET /api/prot` returns `created_by`, `verified_by` and `published_by` user ids, and full records, to anonymous
  callers; a lighter public list shape would cut transfer.
- `/favicon.ico` is 258 KB, the largest single file of a cold load.
- R3F 9.8 with three 0.187 logs "THREE.Clock: This module has been deprecated" once per page (harmless; fixed upstream later).
- The C: drop from 5.9 to 2.5 GB during this phase is mostly not explained by files the phase wrote (see 6); possibly
  the Windows pagefile during builds and headless Chrome.

## 10. Open questions

1. Who adds at least 3 public PROT for Sumatera Selatan before V2, and by when?
2. Should `www.nusantaralegacy.org` be kept (add it to Vercel so it gets a certificate) or dropped from DNS? The answer
   decides whether production `FRONTEND_URLS` also lists the www origin.
3. Frame rate on target hardware: can the boss or the owner open the preview on a 4 GB Android phone and report
   smoothness in 3D (Otomatis and Ringan)? If it is below 30 fps, "lite" becomes the default for 4 GB devices.
4. Is `GET /api/jelajah/provinces` wanted in the next backend phase?

## 11. Ready for next phase?

Yes, for review on the Vercel preview. V2 (the Sumatera Selatan scene) is blocked on content: Sumatera Selatan has no
public PROT yet.
