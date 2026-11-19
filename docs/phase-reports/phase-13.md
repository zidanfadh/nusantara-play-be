# Phase 13: Visual track V4: finishing the demo, real-device measurement, and /prot image weight

## 1. Summary

The simulated levels now start at 1: level L needs 50 × (L − 1) × L total XP, and the DEMO walk (105 XP) goes from
Lv 1 to Lv 2 exactly once. The state key was bumped to `jelajah.demoRewards.v2`. All toasts on the site now appear at
the top centre, below the navbar. On the Jelajah pages they move below the title bar, the HUD and the stand panel's
close button. On phones the empty-stand prompt is a short "Segera hadir", and the full text opens when tapped. `?debug=1`
shows a stats overlay for measuring real phones, and the province scene steps down from full to lite to 2d by itself
when the frame rate stays low, but never over a tier the user chose. PROT photos now go through Vercel Image
Optimization: a phone cold load of `/prot` dropped from 2983 KB to 617 KB, and a PROT detail page from 4606 KB to
455 KB. The local DEMO data has one placeholder photo, which the Jelajah panel shows. **The phase is complete.** All
tests, both production builds, the DEMO and production-API runs and the fallback simulation passed.

## 2. Git

The step 0 checks passed. Frontend `main` was at `fd89571`, the merge of PR #11 with the Phase 12 commits. Backend `main`
was at `3bf3a9e` and contains `docs/phase-reports/phase-12.md`. Nothing was pushed.

**nusantara-play-fe**, branch `phase-13-jelajah-finish`, base `fd89571`:

| Commit | Step |
|---|---|
| `5cf7ca5` | Step 1: level curve from 1, top-centre toasts clear of the Jelajah overlays |
| `ec7ed00` | Step 2: short phone stand prompt, overlay check at 360x740 |
| `d9f6f63` | Step 3: `?debug=1` overlay, automatic fallback, tests |
| `8264e44` | Step 4: PROT photos through next/image |
| `f73070c` | Step 5: local DEMO placeholder photo, loopback photo rule |
| `3e205c8` | Step 7: CLAUDE.md |

`git diff --stat fd89571..3e205c8`: 34 files changed, 1147 insertions(+), 132 deletions(-)

```
 CLAUDE.md                                   | 107 ++++++++++++++++++--
 app/layout.tsx                              |   9 +-
 app/prot/[id]/page.tsx                      |   9 +-
 app/prot/page.tsx                           |   4 +-
 components/jelajah/JelajahHub.tsx           |   9 +-
 components/jelajah/Map3D.tsx                |  16 +--
 components/jelajah/ProvinceCard.tsx         |   4 +-
 components/jelajah/ProvinceExperience.tsx   |  52 ++++++----
 components/jelajah/ProvinceScene2D.tsx      |   4 +-
 components/jelajah/RewardHud.tsx            |   8 +-
 components/jelajah/StandPanel.tsx           |   5 +-
 components/jelajah/StandPrompt.tsx          |  73 ++++++++++++++
 components/jelajah/TierMenu.tsx             |   1 +
 components/jelajah/three/StatsProbe.tsx     | 114 ++++++++++++++++++---
 components/jelajah/three/VillageScene3D.tsx |  26 +++--
 components/prot/ProtCard.tsx                |  11 +--
 components/prot/ProtPhoto.tsx               |  71 ++++++++++++++
 lib/jelajah/data.ts                         |  26 ++++-
 lib/jelajah/demo-rewards.ts                 |  33 ++++---
 lib/jelajah/device-tier.ts                  |   3 +-
 lib/jelajah/engine/scene-prot.ts            |   2 +-
 lib/jelajah/perf.ts                         | 115 ++++++++++++++++++++++
 lib/jelajah/toast-clearance.ts              |  76 ++++++++++++++
 lib/jelajah/use-debug-flag.ts               |  19 ++++
 lib/jelajah/use-device-tier.ts              |  17 +++-
 lib/jelajah/use-toast-clearance.ts          |  23 +++++
 next.config.ts                              |  13 +++
 public/jelajah/demo/foto-contoh.svg         |  11 +++
 tests/jelajah/data.test.ts                  |  19 ++++
 tests/jelajah/demo-rewards.test.ts          |  82 ++++++++++------
 tests/jelajah/perf.test.ts                  | 147 ++++++++++++++++++++++++++++
 tests/jelajah/stand-prompt.test.tsx         |  40 ++++++++
 tests/jelajah/toast-clearance.test.ts       |  62 ++++++++++++
 tests/prot/prot-photo.test.tsx              |  68 +++++++++++++
```

**nusantara-play-be**, branch `phase-13-jelajah-finish`, base `3bf3a9e`:

| Commit | Step |
|---|---|
| `020ce8a` | Step 5: one DEMO photo URL in `db-local-setup.ts` |
| `fe78d6a` | Step 7: CLAUDE.md |
| (this report) | Step 7: `docs/phase-reports/phase-13.md`, committed separately (hash in the final message) |

`git diff --stat 3bf3a9e..fe78d6a`: 2 files changed, 59 insertions(+), 2 deletions(-) (`CLAUDE.md` 43, `src/scripts/db-local-setup.ts` 18).

## 3. Changes

Frontend:
- `lib/jelajah/demo-rewards.ts`: new level curve with a minimum of level 1 (`MIN_LEVEL`, `xpForLevel`, `levelForXp`); key and version bumped to v2.
- `tests/jelajah/demo-rewards.test.ts`: tests for the new curve and its boundaries, the DEMO walk (exactly one level-up, 1 → 2), and that v1 state is ignored.
- `app/layout.tsx`: Toaster `top-center` with top offset `var(--toast-top, 72px)` (Toaster position and offset only).
- `lib/jelajah/toast-clearance.ts` (new): pure placement of the toasts below the overlays marked `data-toast-avoid`, plus `placeToasts()` and `resetToastPlacement()`.
- `lib/jelajah/use-toast-clearance.ts` (new): measures again on mount, on resize and when overlays change; resets when the page unmounts.
- `tests/jelajah/toast-clearance.test.ts` (new): sonner geometry, phone and desktop cases, stacked overlays, hidden elements.
- `components/jelajah/RewardHud.tsx`: per-toast `position` overrides removed; calls `placeToasts()`; HUD marked `data-toast-avoid`.
- `components/jelajah/TierMenu.tsx`, `StandPanel.tsx` (close button), `JelajahHub.tsx`, `ProvinceExperience.tsx` (title bars): marked `data-toast-avoid`; both pages use `useToastClearance`.
- `components/jelajah/StandPrompt.tsx` (new): the stand prompt. On phones an empty stand shows a short "Segera hadir" and the full text opens in a bubble above it on tap; PROT names are clamped to two lines.
- `tests/jelajah/stand-prompt.test.tsx` (new): phone and desktop text, two-line clamp, notice board.
- `components/jelajah/ProvinceExperience.tsx`: uses `StandPrompt`, reads `?debug=1`, wires the automatic fallback and its toast.
- `lib/jelajah/perf.ts` (new): `FpsWindow` (2 s average, ring buffer), `FALLBACK_RULES`, `fallbackStep`, `fallbackMessage`, `isDebugSearch`.
- `tests/jelajah/perf.test.ts` (new): thresholds, timing, hidden tab, warm-up, manual choice wins, 2d is the last step, toast texts, debug flag.
- `lib/jelajah/use-debug-flag.ts` (new): `?debug=1`, read after hydration.
- `components/jelajah/three/StatsProbe.tsx`: 2 s fps window, pixel ratio and canvas size; new `AutoFallbackProbe`; overlay with the new fields.
- `components/jelajah/three/VillageScene3D.tsx`: overlay only with `?debug=1`; mounts the fallback probe only while the tier is automatic.
- `components/jelajah/Map3D.tsx`: overlay only with `?debug=1`; renders continuously only while the flag is on.
- `lib/jelajah/device-tier.ts`: `writeCachedAutoTier` exported.
- `lib/jelajah/use-device-tier.ts`: `fallBack(tier)`, ignored while the user has chosen a tier manually.
- `components/prot/ProtPhoto.tsx` (new): next/image for PROT uploads on S3, two display sizes, falls back to the original URL.
- `tests/prot/prot-photo.test.tsx` (new): URL rule, sync with `remotePatterns`, srcset widths, priority, unoptimized URLs.
- `next.config.ts`: `images.remotePatterns` for the bucket under `/prot/**`, https only, no query string (nothing else changed).
- `components/prot/ProtCard.tsx`, `app/prot/page.tsx`, `app/prot/[id]/page.tsx`: use `ProtPhoto`; the first card and the detail main image load with priority.
- `components/jelajah/StandPanel.tsx`, `ProvinceScene2D.tsx`, `ProvinceCard.tsx`: use `ProtPhoto`.
- `lib/jelajah/data.ts`: `firstPhoto()` also accepts an http photo on a loopback host, but only while the page itself runs on a loopback host (`isLocalPage()`).
- `lib/jelajah/engine/scene-prot.ts`: doc comment only.
- `tests/jelajah/data.test.ts`: deployed site (https only), local site, and no-window cases.
- `public/jelajah/demo/foto-contoh.svg` (new, 1 KB): neutral placeholder, "Gambar contoh, bukan foto PROT".
- `CLAUDE.md`: new Phase 13 section, Jelajah notes, a PROT-photo convention, and the shared sections.

Backend:
- `src/scripts/db-local-setup.ts`: `DEMO_SUMSEL_PHOTO` on "DEMO PROT Sumsel 1", plus an idempotent `UPDATE` for databases seeded before this phase.
- `CLAUDE.md`: shared sections (V4 summary, local-development note, lint baseline, decisions log, drive-letter note).
- `docs/phase-reports/phase-13.md`: this report.

PROT photo files changed in step 4 (as the prompt asked): `components/prot/ProtCard.tsx`, `app/prot/page.tsx`,
`app/prot/[id]/page.tsx`, `components/jelajah/StandPanel.tsx`, `components/jelajah/ProvinceScene2D.tsx`,
`components/jelajah/ProvinceCard.tsx`, plus the new `components/prot/ProtPhoto.tsx`.

## 4. Decisions

- **Toasts on Jelajah pages.** At 390x844 a top-centre toast is 358 px wide and would cover the navbar buttons (y 12 to
  52), the title bar (77 to 115) and the HUD (133 to 221); the probe measured all three overlaps before the fix. The
  toasts now sit 72 px from the top on every page, below the 64 px navbar. On the Jelajah pages they move below the
  lowest marked overlay that their horizontal span would hit. On phones that is y 229, or below the panel's close button
  while the bottom sheet is open. On desktop they stay at y 72 because the overlays are at the sides. Banners and the help
  hint are not avoided; a toast may cover them for 2 to 4 seconds.
- **Phone prompt.** The full empty-stand text needs three or more lines at the width beside the joystick (about 180 px
  at 360 px), so after a tap it opens in a bubble above the prompt. The prompt itself never grows.
- **Debug overlay.** It now appears only with `?debug=1`, in development too. Phase 12's development-only overlay had
  covered the phone stand prompt. Development still mounts the probe for the console budget warnings. Overlay position:
  right edge, vertically centred.
- **Fallback only in the province scene.** The hub map renders on demand in production, so an idle map would look like
  a low frame rate. The fallback cache reuses the existing automatic-tier key. On a fallback the Canvas remounts (it is
  keyed by tier), so the measurement starts fresh: 2 s window, then 5 s.
- **PROT photos: option (a), next/image.** Vercel docs, checked 2026-11-19 (Limits and Pricing page updated
  2026-11-12):
  - Hobby includes 5K image transformations, 300K image cache reads and 100K cache writes per month (reads and writes are
    counted in 8 KB units).
  - On-demand rates: $0.05 to $0.0812 per 1K transformations, $0.40 to $0.64 per 1M reads, $4.00 to $6.40 per 1M writes.
  - On Hobby, past the limit new images fail with 402 and show their alt text; images already cached keep working, and
    nothing is charged.
  - A transformation is billed on every cache MISS and STALE. The remote-image cache key is the URL, width, quality and
    the Accept header.
  - The TTL is the larger of the upstream `max-age` and `minimumCacheTTL`. The S3 objects send no Cache-Control, and
    Next 16's default `minimumCacheTTL` is 4 h.
  - Source limits: 8192 px per side; jpeg, png, webp or avif.

  Option (b), lazy `<img>`, cannot reach the target. On a phone the 2.1 MB PNG is the second card, inside Chrome's
  lazy-load distance, so it still loads on a cold load. The detail page would also stay at 4.6 MB.

  How option (a) stays safe:
  - Only the PROT bucket under `/prot/**` (https, no query string) can be optimized.
  - There are two display sizes, so each photo has at most two variants per size, shared by /prot, the detail page and
    Jelajah. That is about 74 variants for today's 24 photos.
  - If optimization fails, the original URL is shown, as before.

  Worst case: if every variant were requested at least once every 4 h around the clock, that would be about
  74 × 180 = 13.3K transformations a month. A real month should be far lower, because a request inside the 4 h window is
  a cache hit, but the margin is not guaranteed while the TTL stays at 4 h (see Open questions).
- **DEMO photo URL.** I used an SVG: it is 1 KB, the browser renders its text, and it plainly is not a photo. It is
  served by the local frontend at `http://localhost:3001/jelajah/demo/foto-contoh.svg`.
- **Seed update.** The DEMO rows are inserted with `orIgnore()`, so an existing database would never receive the photo.
  A plain parameterized `UPDATE` on the fixed id `…de31` sets it there; it is idempotent.

## 5. Deviations

- **"Only in development" for the http photo.** A `NODE_ENV === 'development'` check would hide the DEMO photo in step
  6.2, which asks to see it in a production build against the local backend. The rule therefore accepts an http photo
  only when both the photo's host and the page's host are loopback (localhost, 127.0.0.1, ::1). On the deployed site the
  page is never on a loopback host, so production stays https-only (tested). Please confirm this reading.
- **New file `components/prot/ProtPhoto.tsx`.** It is not in the allowed-file list by name. It renders PROT photos and
  replaces the same logic in six files, so I counted it under "the files that render PROT photos".
- **`app/layout.tsx`.** Besides the position, the Toaster got `offset`/`mobileOffset` props. The prompt allowed offset
  changes ("adjust offsets if needed").
- **The landing page `/` was not changed.** It is not in step 4's list, although it also renders PROT photos (1595 KB
  cold load; see Out-of-scope).
- **Lite → 2d.** At 10× CPU throttling the lite tier held at 20 to 21 fps in headless Chrome, so that step did not
  trigger in the same run as full → lite. I showed it in a second run that started on lite with 20× throttling.

## 6. Verification

Free space at the start (after the owner moved the page file): C: 12.56 GB, D: 346.59 GB. Page files:
`C:\pagefile.sys` fixed at 2048 MB, `D:\pagefile.sys` system managed (8704 MB allocated). The earlier stop at step 0
was at C: 2.77 GB with an 8.5 GB page file on C:.

| Command | Exit | Output (trimmed) |
|---|---|---|
| `pnpm test` (frontend) | 0 | `Test Files 24 passed (24)`, `Tests 319 passed (319)` (Phase 12: 271) |
| `pnpm lint` (frontend) | 1 (baseline) | 44 errors (unchanged), 82 warnings (87 before; `no-img-element` 26 → 21); all new and touched files clean |
| `pnpm check:jelajah` | 0 | `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)`, `check:jelajah OK` |
| `pnpm build`, placeholder Supabase values inline, `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000/api`, `BACKEND_ORIGIN=http://localhost:3000` | 0 | `✓ Compiled successfully in 22.7s`; `● /jelajah/[provinsi]` → `/jelajah/sumatera-selatan` |
| `pnpm build`, placeholder Supabase values inline, `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api` | 0 | `✓ Compiled successfully in 9.0s` |
| `npm test -- --cacheDirectory D:/dev-cache/jest` (backend) | 0 | `Test Suites: 41 passed`, `Tests: 507 passed, 507 total` |
| `npm run test:e2e -- --cacheDirectory D:/dev-cache/jest` (backend, from `D:\`) | 0 | `Test Suites: 7 passed`, `Tests: 2 skipped, 53 passed, 55 total` (the two known skips) |
| `npm run db:setup` (backend, from `D:\`) | 0 | `DEMO data present: 1 user (...), 7 PROT (ARSIP_NASIONAL, 4 in Sumatera Selatan), 1 event (published).` `Done.` |
| `eslint` on the backend (whole repo) | 1 (baseline) | 220 errors, 29 warnings, unchanged; `db-local-setup.ts` clean |

`npm run db:setup` from a Git Bash shell whose working directory is `d:\…` (lower case) fails with
`this.subQuery is not a function`, both on this branch and on `main` (checked with `git stash`). The stack points to
`InsertQueryBuilder.into(User)`: the entity classes are loaded twice, once per spelling of the drive letter. Run from
`D:\` it passes. This is an environment issue and is now noted in CLAUDE.md "Local machine".

**6.2 Local backend (DEMO data) + production build**, headless Chrome through CDP (scratch tools in `D:/dev-cache/tmp/phase-13/tools/`):
```
desktop enter toast: +25 XP Masuk desa Sumatera Selatan (Simulasi · tidak disimpan)        (top centre, y 72 after the slide-in)
desktop spawn HUD: Lv 1 25 / 100 XP ... | session key v2: true
near after SE stand: DEMO PROT Sumsel 4 Lihat → HUD Lv 1 35 / 100 XP
near after E stand:  DEMO PROT Sumsel 3 Lihat → HUD Lv 1 45 / 100 XP
near after NE stand: DEMO PROT Sumsel 2 Lihat → HUD Lv 2 105 / 300 XP, Paspor 1/35
  toasts: Naik ke Level 2! @535,72,891,146 | +60 XP Membuka stan PROT · Stempel Paspor Sumatera Selatan @543,88,882,158
desktop final session: {"version":2,"xp":105,"entered":["16"],"opened":{"16":[…de34,…de33,…de32]},"stamps":["16"]}
360x740 spawn: HUD Lv 1 25 / 100 XP | toast @16,229,344,321 | HUD rect [12,133,244,221]
360x740 SW prompt: Segera hadir [168,667,348,709]            (one line)
360x740 panel: DEMO PROT Sumsel 1 photo {"src":"http://localhost:3001/jelajah/demo/foto-contoh.svg","loaded":true,"w":640}
               toast @16,307,344,399 | close [311,267,343,299]   (below the close button)
390x844 spawn: toast @16,229,374,321 | 390x844 SW prompt: Segera hadir [168,771,378,813]
390x844 panel: photo loaded | toast @16,229,374,303 | close [341,335,373,367]
?debug=1 overlay (390x844 dpr 3): 14 fps (2 s) 42 draw calls 18.4k triangles tier full dpr 3.00 → 2.00 780×1560 px
without ?debug=1 overlay present: false
console: clean (desktop and both phones)
```
Toast probe (all elements, on the dev server, after the fix): no overlap with the navbar buttons, title bar, Tampilan,
HUD or panel close at 390x844, 360x740 and 1440x900. Before the fix at 390x844 the toast (y 16 to 108) covered all
three navbar buttons and the title bar.

**6.3 Production API (read-only GET) + production build:**
```
scene desktop/phone: banner="PROT Sumatera Selatan sedang dalam proses kurasi. … Kembali ke peta" | HUD="Lv 1 25 / 100 XP …"
  stands: Stand 1 … Stand 6: segera hadir
  misi: 0 / 3 stan dibuka … misi ini belum bisa diselesaikan.
  after "Kembali ke peta": /jelajah HUD="Lv 1 25 / 100 XP …"
  console: clean
```
The /prot measurements are in section 8.

**6.4 Fallback simulation** (CPU throttling with `Emulation.setCPUThrottlingRate`, `?debug=1`, desktop 1440x900, production build):
```
auto (cached full), CPU x10: t+2s 17 fps tier full → t+8s autoTier=lite, toast "Beralih ke mode Ringan agar lebih lancar"
  lite then 20–21 fps (not below 20): stays lite. Reload: autoTier lite (remembered).
auto (cached lite), CPU x20: t+2s 10 fps tier lite → t+7s autoTier=2d, canvas gone, toast "Beralih ke Peta 2D agar lebih lancar"
manual "Lengkap (3D)", CPU x10: 13–15 fps for 20 s, tier stays full, no toast (never overridden)
console: clean
```
Also on the dev server: full → lite after about 9 s at 6× throttling; the manual choice was never overridden.

**6.5 Budgets** (headless Chrome with SwiftShader, so these fps are not representative of a phone):

| Page | Draw calls | Triangles | Cold load (prod API) | Budget |
|---|---|---|---|---|
| `/jelajah` (3D map) | 3 | 39.3k | 670 KB phone, 690 KB desktop | 100 / 100k / 5 MB |
| `/jelajah/sumatera-selatan` full | 45 (phone 42) | 18.7k (phone 18.4k) | 727 KB phone, 745 KB desktop | 100 / 100k / 8 MB |
| `/jelajah/sumatera-selatan` lite | 37 | 10.3k | – | 100 / 100k |

The three.js chunk `c77ae571dc1f29f9.js` (241 KB) loaded on `/jelajah` and `/jelajah/sumatera-selatan` only; it was
"not loaded" on `/` and `/prot`, on phone and desktop.

**6.6 Screenshots** (`D:/dev-cache/screens/phase-13/`):
- Phone spawn, HUD at Lv 1, toast at the top centre: `phone-360x740-spawn-lv1-toast.png`, `phone-390x844-spawn-lv1-toast.png`
- Toast at the top centre on desktop (level-up and stamp): `desktop-levelup-stamp-toast-top-centre.png`
- Short stand prompt: `phone-360x740-short-stand-prompt.png`, `phone-390x844-short-stand-prompt.png`
- `?debug=1` overlay: `phone-390x844-debug-overlay.png`, `fallback-phone-debug-overlay.png`, `fallback-phone-hub-debug-overlay.png`; without the flag: `fallback-phone-no-debug.png`
- Panel with the DEMO photo: `phone-360x740-panel-demo-photo.png`, `phone-390x844-panel-demo-photo.png`
- /prot on a phone, before and after: `before-prot-phone.png`, `after-prot-phone.png`; detail pages `before-detail-202e5330-phone.png`, `after-detail-202e5330-phone.png`, `before-detail-752aeea4-phone.png`, `after-detail-752aeea4-phone.png`
- Fallback: `fallback-desktop-fallback-toast.png` (full → lite), `fallback-desktop-fallback-2d-toast.png` (lite → 2d), `fallback-desktop-manual-not-overridden.png`
- Production API: `prod-phone-banner.png`, `prod-desktop-banner.png`, `prod-desktop-hub-hud.png`, the dark-mode and intro screenshots `prod-*.png`
- Development-server checks (360x740 overlay probe): `D:/dev-cache/tmp/phase-13/ov1-360x740-*.png`

Free space at the end: C: 13.03 GB, D: 345.87 GB. Page files: `C:\pagefile.sys` 2048 MB (4 MB in use),
`D:\pagefile.sys` 8704 MB (695 MB in use). C: never went below 12.5 GB during this phase.

## 7. Manual checks

1. On the Vercel preview of `phase-13-jelajah-finish`, open `/jelajah/sumatera-selatan` on a phone. You should see:
   - "Lv 1, 25 / 100 XP" in the HUD.
   - A "+25 XP" toast at the top centre, just below the HUD, not over the navbar, title bar or HUD.
   - "Segera hadir" beside the joystick when you walk to a stand (production has no PROT there). Tapping it shows the
     full sentence above it.
2. Open `/prot` on a phone with a cold cache (private window). The photos should load quickly. DevTools > Network shows
   `/_next/image?...&w=640` or `w=828` requests of tens of KB instead of the 2.1 MB PNG.
3. Open any other page that shows a toast (for example an admin calendar action). The toast now appears at the top
   centre, below the navbar.
4. **Measuring fps on your own phones** (please do this on each phone you have, Android especially):
   - Open `https://<preview-or-site>/jelajah/sumatera-selatan?debug=1` in Chrome (Safari on iPhone). In the "Tampilan"
     menu choose **Lengkap (3D)**, so the automatic fallback does not switch tiers while you measure.
   - Wait about 5 s after the village appears (the camera glide), then walk with the joystick for **60 seconds**: around
     the plaza, past several stands, along the river. Watch the dark box on the right edge.
   - Write down:
     - the lowest and the most typical **fps (2 s)** value while walking;
     - **draw calls** and **triangles**;
     - the **dpr** line (for example `3.00 → 2.00`);
     - the **canvas size** (`… × … px`).
   - Repeat with **Ringan (3D hemat)** chosen in the "Tampilan" menu.
   - Send back for each phone: the model, the Android or iOS version, the browser, and the numbers above for both tiers.
   - Optional: switch "Tampilan" back to **Otomatis**, reload, and walk for 20 s. If the phone is too slow you will see
     "Beralih ke mode Ringan agar lebih lancar". Tell me whether that happened.
5. Without `?debug=1` no dark box appears.

## 8. Findings

**/prot image weight** (production API, read-only GET; production build with `next start`; cache disabled; no network
throttling; phone 390x844 at dpr 3, desktop 1440x900):

| Page | Before (plain `<img>`) | After (`ProtPhoto`) |
|---|---|---|
| `/prot` phone | 2983 KB (photos 2637 KB: 9, **2128**, 217, 71, 213 KB) | **617 KB** (photos 265 KB: 9, 16, 46, 126, 69 KB) |
| `/prot` desktop | 3009 KB | 567 KB (photos 190 KB) |
| `/prot/202e5330…` phone | 4606 KB (the 2.1 MB PNG twice: main image and thumbnail) | 455 KB (photos 94 KB) |
| `/prot/752aeea4…` phone | 2813 KB (photos 2462 KB) | 410 KB (photos 48 KB) |
| `/` phone | 1595 KB | 1595 KB (not changed) |

The target "/prot under 1 MB on a phone cold load" is met: 617 KB. Locally, `next start` uses Next's own optimizer
(sharp). Vercel's optimizer produces similar sizes, but the exact bytes on the preview will differ a little.

Production photos: 5 public PROT, 13 activity photos and 11 equipment photos, all on
`nusantara-play-storage.s3.ap-southeast-2.amazonaws.com/prot/...`, none with a query string. The largest originals are a
2.18 MB PNG, a 0.94 MB PNG and a 0.88 MB PNG.

**Toast probe before and after** (390x844, the scene): before, the toast was at y 16 to 108 and covered navbar #0, #1,
#2 and the title bar. After, it is at y 229 to 321 and overlaps nothing.

## 9. Out-of-scope observations

- The landing page `/` is 1595 KB on a cold load. It renders PROT photos with plain `<img>` (featured PROT, about
  510 KB) plus its own 379 KB `nusland (1).webp`. Moving it to `ProtPhoto` would save about 400 KB.
- The source photos are large because they are uploaded as they are (up to a 2.18 MB PNG). Resizing at upload time in
  the backend (sharp) would remove the need for runtime optimization altogether.
- `npm run db:setup` and the e2e tests fail from a lower-case `d:\` working directory (`this.subQuery is not a
  function`, two copies of the entity classes). Documented in CLAUDE.md "Local machine"; a later phase could make the
  entity loading independent of the path spelling.
- On a phone the first "+25 XP" toast sits over the top of the empty-province banner for about 2.6 s (allowed by the
  current rules; the banner's "Kembali ke peta" button is reachable once the toast leaves).
- The site title is still "Nusantara Virtual" (brand rename waits for the boss).

## 10. Open questions

1. Is the Vercel project on Hobby or Pro? On Hobby, going over 5K transformations stops optimizing new photos; they
   then fall back to the originals, so nothing breaks. On Pro, overage costs about $0.05 per 1K. Should a later phase
   be allowed to set `images.minimumCacheTTL`, for example to 31 days? That would bring the worst case down to about one
   transformation per variant per month (about 74 today).
2. Is the http-photo rule (accepted only when both the photo and the page are on a loopback host) the reading you
   wanted for "only in development"? See Deviations.
3. Should the landing page `/` also use `ProtPhoto`? It is the most visited page.

## 11. Ready for next phase?

Yes. Nothing blocks. The fps numbers from your own phones (Manual checks, step 4) would help decide whether the full tier
can stay the default on mid-range Android phones.
