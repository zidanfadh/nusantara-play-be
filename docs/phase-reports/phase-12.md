# Phase 12: Visual track V3: polish, simulated reward HUD, and two old frontend bugs

## 1. Summary

The province scene got a framed follow camera: the player sits in the lower third of the screen, phones use a closer
camera with a wider field of view (390x844: 23.5 m, 62°; Phase 11: 34.9 m), the follow is critically damped, and a 1.5 s
entry glide runs on the full tier only. The player hidden behind a roof now shows as a silhouette in the site's primary
colour with a light edge. The plaza has a neutral open pavilion. Signs are one larger size with fitted text, and there is
light ambient motion on the full tier. A banner explains an empty province. A SIMULATED reward HUD (XP, level, Paspor, Misi,
toasts) runs on the hub and in the scene. It lives only in the tab's sessionStorage and never reaches the backend. Dark mode
survives a reload without React error #418, and the 258 KB favicon became an 11.6 KB icon set. All verification steps
passed (271 tests, production build, DEMO and production-API runs, budgets). **The phase is complete.** One warning: C:
fell to about 3 GB free during verification (section 6), mostly because Windows grew its pagefile.

## 2. Git

**nusantara-play-fe**, branch `phase-12-jelajah-polish`, base `679cb9e` (main, merge of Phase 11):

| Commit | Step |
|---|---|
| `1632713` | Step 1 camera (+ the first part of step 2 that lives in the same files) |
| `01a6d60` | Step 2 tests (sign text fitting, centrepiece collider) |
| `bd95833` | Step 3 simulated reward HUD (+ step 2's empty-province banner, same component) |
| `e56b773` | Step 4 theme fix and icon set |
| `f39548c` | Step 5 fixes found during verification |
| `7051510` | Step 6 CLAUDE.md |

`git diff --stat 679cb9e..HEAD`: 29 files changed, 2060 insertions(+), 184 deletions(-)

```
 CLAUDE.md                                   |  86 ++++++++-
 app/apple-icon.png                          | Bin 0 -> 6054 bytes
 app/favicon.ico                             | Bin 257697 -> 0 bytes
 app/icon.png                                | Bin 0 -> 2756 bytes
 app/layout.tsx                              |  28 ++-
 components/jelajah/DemoDialog.tsx           |  89 +++++++++
 components/jelajah/JelajahHub.tsx           |  25 ++-
 components/jelajah/MisiPanel.tsx            |  82 +++++++++
 components/jelajah/PasporModal.tsx          |  80 ++++++++
 components/jelajah/ProvinceExperience.tsx   | 128 ++++++++++---
 components/jelajah/RewardHud.tsx            | 119 ++++++++++++
 components/jelajah/StandPanel.tsx           |   3 +-
 components/jelajah/three/VillageScene3D.tsx | 253 ++++++++++++++++++++-----
 components/ui/AnimatedThemeToggler.tsx      |  58 +++---
 lib/jelajah/demo-rewards.ts                 | 275 ++++++++++++++++++++++++++++
 lib/jelajah/engine/camera.ts                | 188 +++++++++++++++++++
 lib/jelajah/engine/collision.ts             |   5 +
 lib/jelajah/engine/sign-text.ts             |  98 ++++++++++
 lib/jelajah/scenes/sumatera-selatan.ts      |   1 +
 lib/jelajah/scenes/types.ts                 |  16 ++
 lib/jelajah/three/canvas-textures.ts        |  76 ++++----
 lib/jelajah/three/village-geometry.ts       |  53 +++++-
 lib/jelajah/use-demo-rewards.ts             |   9 +
 lib/jelajah/use-reduced-motion.ts           |  19 ++
 public/favicon.ico                          | Bin 0 -> 2786 bytes
 tests/jelajah/camera.test.ts                | 194 ++++++++++++++++++++
 tests/jelajah/demo-rewards.test.ts          | 248 +++++++++++++++++++++++++
 tests/jelajah/scene-engine.test.ts          |  18 +-
 tests/jelajah/sign-text.test.ts             |  93 ++++++++++
```

**nusantara-play-be**, branch `phase-12-jelajah-polish`, base `8aca8e8` (main): `f725a2b` (CLAUDE.md) and the commit that adds
this report (hash printed with the final message; a file cannot contain its own commit hash).
`git diff --stat 8aca8e8..f725a2b`: `CLAUDE.md | 46 ++++++++++++++++++++++++++++++++++++++++++++--`, plus this report.

Nothing was pushed.

## 3. Changes

Frontend, new:
- `lib/jelajah/engine/camera.ts`: pure framing math (field of view per aspect ratio, smallest fitting distance, lower-third
  offset, NDC projection, spawn frame points, entry glide pose, critically damped `smoothDamp`).
- `lib/jelajah/engine/sign-text.ts`: sign size constants and pure text fitting (largest font that fits in two lines,
  otherwise "…").
- `lib/jelajah/use-reduced-motion.ts`: `prefers-reduced-motion` through `useSyncExternalStore` (server: false).
- `lib/jelajah/demo-rewards.ts`: simulated reward rules, levels, quest progress, sessionStorage persistence (versioned key,
  validated, try/catch), a store without React. Imports nothing.
- `lib/jelajah/use-demo-rewards.ts`: hook over the store (server snapshot: empty).
- `components/jelajah/RewardHud.tsx`: level badge, XP bar, "Simulasi · tidak disimpan", Paspor and Misi buttons; toasts.
- `components/jelajah/PasporModal.tsx`: 35 provinces, stamped ones highlighted and listed first; "Atur ulang simulasi".
- `components/jelajah/MisiPanel.tsx`: one quest per province scene with progress.
- `components/jelajah/DemoDialog.tsx`: shared native `<dialog>` (focus trap, Esc, backdrop click, focus return).
- `app/icon.png`, `app/apple-icon.png`, `public/favicon.ico`: the small icon set.
- `tests/jelajah/camera.test.ts`, `tests/jelajah/sign-text.test.ts`, `tests/jelajah/demo-rewards.test.ts`: new unit tests
  (framing for 7 aspect ratios, sign fitting, reward rules, persistence, store, no-backend rule).

Frontend, modified:
- `components/jelajah/three/VillageScene3D.tsx`: framed camera and intro glide, silhouette fill and edge (stencil), ambient
  motion, larger signs, pavilion shadow, stencil buffer requested.
- `lib/jelajah/three/village-geometry.ts`: procedural pavilion merged into the village mesh; `STAND_ROOF_TOP` moved to the engine.
- `lib/jelajah/three/canvas-textures.ts`: signs drawn with the fitting helper; same size for every sign kind.
- `lib/jelajah/engine/collision.ts`: `STAND_ROOF_TOP`; the centrepiece's box collider.
- `lib/jelajah/scenes/types.ts`, `lib/jelajah/scenes/sumatera-selatan.ts`: optional `centrepiece` (`PavilionDef`).
- `components/jelajah/ProvinceExperience.tsx`: rewards (enter, open PROT), HUD, empty-province banner, message stack under
  the HUD, movement paused while Paspor or Misi is open, reduced motion passed to the scene, phone stand prompt beside the joystick.
- `components/jelajah/JelajahHub.tsx`: HUD on the hub; status messages moved below it on narrow screens.
- `components/jelajah/StandPanel.tsx`: Esc is left to an open `<dialog>`.
- `tests/jelajah/scene-engine.test.ts`: collider count includes the centrepiece; new centrepiece test.
- `app/layout.tsx`: inline theme script only sets the class on `<html>`, inside try/catch.
- `components/ui/AnimatedThemeToggler.tsx`: reads the theme after mount (`useSyncExternalStore`, light server snapshot).
- `CLAUDE.md`: Phase 12 section, shared sections, decisions, lint baseline.

Frontend, deleted:
- `app/favicon.ico` (258 KB): replaced by the icon set (see Deviations).

Backend:
- `CLAUDE.md`: shared sections (identical to the frontend), decisions log, lint baseline.
- `docs/phase-reports/phase-12.md`: this report.

## 4. Decisions

- **Camera numbers**: fixed 40° pitch; the player's chest at NDC y = -0.4 (lower third); field of view 62° at 390x844, falling
  linearly to 44° from aspect 1.3; the distance is the smallest (0.25 m steps, 11 to 40 m) at which the player, the 4
  footprint corners and the sign of the two stands nearest to the spawn point, and the top edge of every other sign fit
  inside 92 % of the screen. Results: 390x844 62° / 23.5 m, 768x1024 55.8° / 15.75 m, 1440x900 44° / 22 m. Laptops end up
  1.5 m farther than in Phase 11 (20.6 m) because the far signs must not be cut off.
- **Smooth follow**: a critically damped spring (`smoothDamp`, 0.16 s), frame-rate independent and monotonic (tested at 60,
  20 and 10 fps), replacing the exponential lerp; no allocations per frame (the old code created a `Vector3` every frame).
- **Entry glide**: 1.5 s, ease-out from 24° steeper and 1.9× farther; skipped by keydown, pointerdown, wheel, touchstart
  or joystick movement; off on the lite tier and with reduced motion.
- **Silhouette**: primary #9E3C24 (the light-theme token, because the 3D scene keeps one look in both themes) at 0.82
  opacity. It is blended inside the opaque pass through `CustomBlending`, which keeps Phase 11's render order (scene →
  silhouette → player, so the body never ghosts over itself), and a stencil makes every pixel blend once. The light edge
  (#FFF1DC) is the same skinned mesh pushed out 5.5 cm along its normals in view space, drawn only outside the fill. Both
  ignore tone mapping so the colour is the real primary.
- **Centrepiece**: an open pavilion (two-tier pyramid roof on four posts, platform 3.6 m) in the house colours, merged into
  the village mesh (0 draw calls) with a box collider 0.2 m larger than the platform. No name or text anywhere.
- **Signs**: 3.8 m wide (Phase 11: 2.9 m), canvas 512x200, 64/56/48 px bold, at most two lines; the notice board uses the
  same size (heading + first name + "+N lagi").
- **Ambient motion**: water colour shimmer (±5 %) and a slow drift of the water mesh, so the streaks move; palm sway and
  canoe bob through instance matrices with reused scratch objects. No new textures, no new draw calls.
- **Empty-province banner**: shown once per visit after entering (closeable); the "Segera hadir" stands stay. Also shown in
  the 2d tier.
- **Level curve**: read literally, level 0 at 0 XP and level n at 50 n (n + 1) XP. The DEMO walk (25 + 3 × 10 + 50 = 105 XP)
  therefore shows exactly one level-up.
- **When rewards fire**: "enter" when the scene is shown (3D ready or 2d tier), not on page load, so the toast is not hidden
  by the loading screen; "open PROT" also for a PROT chosen from the notice board and for 2d cards (same panel).
- **Rule guard**: `openProt` uses max(province PROT count, PROT opened) for the stamp target, so a stale count can never
  block the stamp.
- **Store**: one store per tab shared by the hub and the scene (`useSyncExternalStore`), loaded lazily, saved only when a
  rule changed something.
- **Dialogs**: native `<dialog>` + `showModal()` for Paspor and Misi (browser focus trap and inert background, Esc,
  backdrop click), explicit focus return.
- **Toasts**: top centre for reward toasts (the global Toaster is top right and covered the stand panel's close button).
- **HUD placement**: under the title bar on the left; the scene's messages and the hub's status messages moved below it on
  screens narrower than `lg`.
- **Icons**: the source is the 256 px PNG already inside the old favicon (same design); 48 px `icon.png`, 180 px
  `apple-icon.png` (flattened on white, 128-colour palette: 15.4 KB → 6.1 KB without visible change), favicon.ico with 16
  and 32 px PNG entries. The generator was a scratch script (`D:/dev-cache/tmp/phase-12/make-icons.cjs`, sharp 0.34.5 from
  `node_modules/.pnpm`); `scripts/` was outside the allowed files.
- **Theme script**: keeps writing the default `light` to localStorage (as before), now inside try/catch; uses
  `classList.toggle`.

## 5. Deviations

- **Commits per step**: steps 1 and 2 share `VillageScene3D.tsx` and the scene geometry, and steps 2 and 3 share
  `ProvinceExperience.tsx`. Commit `1632713` (step 1) therefore also contains step 2's silhouette, pavilion, signs and
  ambient motion, and `bd95833` (step 3) contains step 2's empty-province banner. Each commit message says so.
- **`app/favicon.ico` deleted**: not in the allowed list, but the icon change cannot work without it (Next.js serves
  `app/favicon.ico` at `/favicon.ico` and it was the 258 KB file). It was replaced by the allowed `public/favicon.ico`.
- **Small changes beyond the prompt, all inside `components/jelajah/`** (found while verifying):
  - on phones the stand prompt ("… Lihat") sat under the joystick (Phase 11 layout); it now sits to the right of it;
  - the hub's status messages moved below the HUD on narrow screens;
  - `StandPanel` ignores Esc while a dialog is open;
  - `DemoDialog.tsx` is an extra shared file.
- **Verification method**: the "walk to 3 stands" run used keyboard input in headless Chrome (CDP), not a touch joystick.
  Headless Chrome renders in software at about 8 to 9 fps, so the walk script converts metres to key-hold time with the
  measured frame rate. The joystick itself was not changed.
- **Local backend**: a backend started before this phase (`dist/main`, PID 27188, serving the DEMO data) was used. I also
  started a second `npm run start:dev` by mistake; it failed with EADDRINUSE, and its watcher process (PIDs 1156/27116)
  is still idle because stopping it was not permitted in this session. It holds no port.
- **C: free space**: C: dropped from 7.8 GB to 2.9 GiB (3.06 GB) during step 5 (see section 6). By then all heavy work
  (builds, browser runs, measurements) was done; only the docs and this report were written afterwards, on D:.

## 6. Verification

| Command | Exit | Result |
|---|---|---|
| `pnpm test` (final code) | 0 | 20 files, **271 passed**, 0 failed, 0 skipped (Phase 11: 213); Jelajah 12 files, 159 tests |
| `npx eslint app/layout.tsx app/jelajah components/jelajah components/ui/AnimatedThemeToggler.tsx lib/jelajah tests/jelajah` | 0 | no problems |
| `pnpm lint` | 1 | `✖ 131 problems (44 errors, 87 warnings)` = baseline, unchanged |
| `npx tsc --noEmit -p .` | 0 | no output |
| `pnpm check:jelajah` | 0 | `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)`; `player.glb → colormap 512x512`; `check:jelajah OK` |
| `pnpm build` (placeholder Supabase, `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000/api`, `BACKEND_ORIGIN=http://localhost:3000`) | 0 | `✓ Compiled successfully in 14.5s`; `○ /apple-icon.png`, `○ /icon.png`, `● /jelajah/[provinsi]` → `/jelajah/sumatera-selatan` |
| `pnpm build` (placeholder Supabase, `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api`, default origin) | 0 | `✓ Compiled successfully in 13.2s` |
| `head -1 pnpm-lock.yaml` | 0 | `lockfileVersion: '9.0'` (no dependency changes) |
| `curl http://localhost:3001/` (icon links) | 0 | `<link rel="icon" href="/icon.png?…" sizes="48x48" type="image/png"/>`, `<link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="180x180" …/>`; `/favicon.ico` 200, 2786 bytes |

Placeholder Supabase values: `NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`.

**5.2 Local backend (DEMO data) + production build on :3001**, headless Chrome via CDP (`D:/dev-cache/tmp/phase-12/tools/`):

```
desktop spawn HUD: Lv 0 25 / 100 XP Simulasi · tidak disimpan Paspor 0/35 Misi
desktop toasts after enter: +25 XP Masuk desa Sumatera Selatan (Simulasi · tidak disimpan)
near after SE stand route (fps 8.7): DEMO PROT Sumsel 4 Lihat
  panel: DEMO PROT Sumsel 4 | HUD: Lv 0 35 / 100 XP …
  toasts: +10 XP Membuka stan PROT (Simulasi · tidak disimpan)
  after Esc: panel=null focus=BUTTON:Lihat
near after E stand route (fps 8.9): DEMO PROT Sumsel 3 Lihat
  panel: DEMO PROT Sumsel 3 | HUD: Lv 0 45 / 100 XP …
near after NE stand route (fps 9.0): DEMO PROT Sumsel 2 Lihat
  panel: DEMO PROT Sumsel 2 | HUD: Lv 1 105 / 300 XP Simulasi · tidak disimpan Paspor 1/35 Misi
  toasts: Naik ke Level 1! Simulasi · tidak disimpan | +60 XP Membuka stan PROT · Stempel Paspor Sumatera Selatan (Simulasi · tidak disimpan)
session after 3 stands: {"version":1,"xp":105,"entered":["16"],"opened":{"16":["…de34","…de33","…de32"]},"stamps":["16"]}
paspor subtitle: 1 dari 35 provinsi distempel · Simulasi, tidak disimpan
paspor stamped: [ 'Sumatera Selatan: sudah distempel' ]   paspor items: 35   paspor focus: Tutup
paspor closed: true focus back on: Paspor1/35
misi: Misi Simulasi, tidak disimpan Buka 3 stan PROT di Sumatera Selatan Hadiah: Stempel Paspor Sumatera Selatan dan +50 XP Selesai
after reload HUD: Lv 1 105 / 300 XP … | new toasts: none
desktop console: clean
new tab hub HUD: Lv 0 0 / 100 XP … | session: null
phone HUD rect: [12, 133, 244, 221]  joystick rect: [24, 693, 152, 821]  back link rect: [21, 84, 53, 108]
phone panel rect: [0, 538, 390, 845]
phone console: clean
```

The HUD, the back link, the joystick and the bottom sheet do not overlap on the phone (rectangles in CSS px). Movement keys
pressed while the Paspor was open did not move the player.

**5.3 Production API (read-only) + production build on :3001:**

```
scene desktop: banner="PROT Sumatera Selatan sedang dalam proses kurasi. Sementara itu, jelajahi PROT dari provinsi lain di peta. Kembali ke peta"
  | HUD="Lv 0 25 / 100 XP Simulasi · tidak disimpan Paspor 0/35 Misi" | stands: Stand 1–6: segera hadir
  misi: … 0 / 3 stan dibuka PROT Sumatera Selatan sedang dalam proses kurasi, jadi misi ini belum bisa diselesaikan.
  after "Kembali ke peta": /jelajah HUD="Lv 0 25 / 100 XP …"
  console: clean
scene phone: (same banner, HUD and stands)  console: clean
```

Only GET requests went to the production API (page data); the simulation sent nothing.

**Dark mode** (localStorage `theme = dark`, reload, 4 s wait), both builds, desktop and phone:

```
dark reload / desktop: html.dark=true toggler=sun console=clean
dark reload / phone: html.dark=true toggler=sun console=clean
dark reload /prot desktop: html.dark=true toggler=sun console=clean
dark reload /prot phone: html.dark=true toggler=sun console=clean
dark reload /jelajah desktop: html.dark=true toggler=sun console=clean
dark reload /jelajah phone: html.dark=true toggler=sun console=clean
```

**Intro and reduced motion**: screenshots right after loading show the glide in progress on the full tier
(`prod-intro-full-0s.png`, higher view) and the final view at once with reduced motion (`prod-intro-full-reduced-0s.png`)
and on the lite tier (`prod-intro-lite-0s.png`).

**Disk space**: before C: 7.8G free, D: 356G free (`df -h`, GiB). During step 5 C: fell to 2.9G. `pagefile.sys` was 11.01 GB
(last written 21:09, during the builds and browser runs; allocated base 8708 MB); other new files on C: since 20:40: 280 MB
in `%LOCALAPPDATA%\Temp` (276 MB of it a VS Code update installer, not from this phase), 112 MB under
`%LOCALAPPDATA%\Google` (Chrome), 20 MB under `.claude`. After the last server was stopped: C: 3.06 GB (2.9 GiB), D: 356G.
At the end: see the final message.

## 7. Manual checks

Use the Vercel preview of `phase-12-jelajah-polish` (production data: 0 PROT in Sumatera Selatan), or run locally with the
DEMO data (CLAUDE.md "Local development") to see filled stands, XP for stands, the stamp and the level-up.

**Boss demo, phone (iPhone 11 or a 4 GB Android, Chrome):**
1. Open `/jelajah`. Top left: "Jelajah Nusantara · Demo" and under it the HUD: "Lv 0", an XP bar, "0 / 100 XP",
   "Simulasi · tidak disimpan", "Paspor 0/35", "Misi".
2. Tap the Pilot province, then "Masuk". After loading, the camera glides down for about 1.5 s (any tap skips it) and stops
   with the player in the lower third, both nearest stands fully visible, and a "+25 XP" toast at the top.
3. Production data: a banner says "PROT Sumatera Selatan sedang dalam proses kurasi. …" with "Kembali ke peta". Close it
   with ×. All stands say "Segera hadir" on a large, readable sign.
4. Walk with the joystick to a stand: the prompt appears to the right of the joystick. Walk behind a house or a stand: the
   player shows as a red-brown shape with a light outline.
5. Watch the river shimmer, the palms sway and the canoe bob (not on "Ringan" (lite) and not with reduced motion).
6. Tap "Misi": "Buka 3 stan PROT di Sumatera Selatan", 0 / 3, with a note that the PROT are being curated. Tap "Paspor": 35
   provinces, none stamped. Close both; the joystick works again.
7. Reload: still 25 XP and no new toast. Open the page in a new tab: it starts at 0 XP.
8. Locally with the DEMO data: open 3 stands ("Lihat") → +10 XP each; the third gives "+60 XP … Stempel Paspor Sumatera
   Selatan" and "Naik ke Level 1!"; the HUD shows "Lv 1, 105 / 300 XP, Paspor 1/35"; the Paspor shows Sumatera Selatan
   first and highlighted; Misi shows "Selesai". "Atur ulang simulasi" in the Paspor resets everything.

**Boss demo, laptop (Chrome):**
1. Same flow with WASD / arrows and `E`; Esc closes the panel and the focus returns to "Lihat"; reward toasts appear at
   the top centre, not over the panel.
2. Paspor and Misi work with the keyboard only (Tab to the button, Enter, Esc closes, focus returns to the button).
3. Switch the site to dark mode, reload `/`, `/prot` and `/jelajah`: the page stays dark, the toggle shows the sun, and
   DevTools → Console shows no error.
4. DevTools → Network on `/` and `/prot`: no three.js chunk; the tab icon is the logo (`icon.png`, 2.7 KB).

## 8. Findings

**Draw calls and triangles** (dev overlay, `pnpm dev`, DEMO data; budget 100 draw calls, 100k triangles):

| Tier, view | Phase 11 | Phase 12 |
|---|---|---|
| full, spawn, 1440x900 | 43 / 17.7k | **45 / 18.7k** |
| full, spawn, 390x844 | – | 42 / 18.4k |
| full, behind the west house | 40–42 / 17.3k–17.6k | 36 / 18.0k |
| lite, spawn, 1440x900 | 34 / 9.2k | **37 / 10.3k** |
| lite, spawn, 390x844 | – | 34 / 10.1k |
| lite, behind the west house | – | 27 / 9.7k |

The +2 draw calls are the silhouette edge copies; the pavilion adds about 0.8k triangles and no draw call. The fps values
(9 to 28) come from headless Chrome with SwiftShader software rendering and say nothing about phones.

**Cold-load transfer** (cache disabled, fresh tab; budget 5 MB for `/jelajah`, 8 MB per province):

| Route | DEMO (local API) | Production API | three.js chunk |
|---|---|---|---|
| `/jelajah` desktop | 679 KB, 31 requests | 684 KB, 31 requests | loaded (241 KB) |
| `/jelajah` phone | 660 KB, 25 requests | 664 KB, 24 requests | loaded |
| `/jelajah/sumatera-selatan` desktop | 735 KB, 45 requests | 742 KB, 42 requests | loaded |
| `/jelajah/sumatera-selatan` phone | 715 KB, 32 requests | 717 KB, 39 requests | loaded |
| `/` desktop / phone | 1085 KB / 1085 KB | 1597 KB / 1595 KB | **not loaded** |
| `/prot` desktop / phone | 375 KB / 343 KB | 3015 KB / 2991 KB | **not loaded** |

`/` and `/prot` are larger with the production API because of production PROT photos (largest: a 2.1 MB PNG on `/prot`). The
icons are no longer among the largest files (old favicon 258 KB, now 11.6 KB for all three icon files).

**Screenshots** (`D:/dev-cache/screens/phase-12/`; phone 390x844 at DPR 2, desktop 1440x900):
- Spawn view: `demo-phone-spawn.png`, `demo-desktop-spawn.png`
- HUD with XP gained: `demo-desktop-xp-gained.png` (+10 XP), `demo-phone-panel-hud.png` (phone, panel + toast),
  `demo-desktop-stamp-levelup.png` (Lv 1, Paspor 1/35, level-up toast)
- Paspor and Misi: `demo-desktop-paspor.png`, `demo-desktop-misi.png`
- Hub HUD: `demo-desktop-hub-hud.png` (new tab, 0 XP), `prod-desktop-hub-hud.png` (after "Kembali ke peta", 25 XP)
- Silhouette: `demo-phone-silhouette-house.png` (behind a house), `demo-phone-silhouette-stand.png` (behind a stand roof),
  `dev-full-behind-house-stats.png`, `dev-lite-behind-house-stats.png`
- Empty-province banner: `prod-phone-banner.png`, `prod-desktop-banner.png` (`local-desktop-banner.png`: DEMO data, no banner)
- Dark mode after reload: `prod-dark-home-phone.png`, `prod-dark-home-desktop.png`, `prod-dark-prot-phone.png`,
  `prod-dark-prot-desktop.png`, `prod-dark-jelajah-desktop.png` (and the same with the `local-` prefix)
- Intro: `prod-intro-full-0s.png` / `-end.png`, `prod-intro-full-reduced-0s.png` / `-end.png`, `prod-intro-lite-0s.png` / `-end.png`

## 9. Out-of-scope observations

- The production `/prot` page loads a 2.1 MB PNG PROT photo on a cold load (no resizing; `@next/next/no-img-element` warnings
  exist in the baseline).
- The site title is still "Nusantara Virtual" in `app/layout.tsx` metadata and the navbar, while the product domain is
  nusantaralegacy.org.
- On phones the sonner toasts (top of the screen) briefly cover the navbar and the scene's title bar; the global Toaster
  lives in `app/layout.tsx`, which was in scope only for the theme fix.
- The empty-stand message in the phone prompt ("Segera hadir. Stand ini menunggu PROT dari Sumatera Selatan.") wraps to
  three lines in the narrower slot beside the joystick.
- Next.js 16 still warns that the `middleware` file convention is deprecated in favour of `proxy` (known).

## 10. Open questions

1. Level curve: should the simulation (and later the backend) start at level 1 instead of level 0? Today 0 XP shows "Lv 0"
   and level 1 needs 100 XP.
2. Should the global sonner Toaster move to the top centre for the whole site, so toasts never cover the navbar's right side?
3. The HUD is visible on the hub as well; should it stay there for the boss demo, or only appear inside a province scene?
4. C: is near its 3 GB limit, mainly because of an 11 GB system-managed pagefile. Should the pagefile get a fixed size or
   move to D:, or should C: be cleaned before the next phase?
5. Push the branches and open the Vercel preview for the boss review?

## 11. Ready for next phase?

Yes for the code: every step is done and verified. Before the next heavy phase, C: needs more free space (question 4).
