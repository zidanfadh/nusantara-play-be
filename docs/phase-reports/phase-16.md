# Phase 16: Jelajah intro bumper

## 1. Summary
Opening `/jelajah` now plays a short animated tour of the whole site before the map: six scenes, 19 s in total (brand,
Arsip PROT, Jelajah Nusantara map, traditional games "Segera hadir", events and community, XP and Paspor with
"Mulai Jelajah"). It is built in React + CSS + the framer-motion the site already loads (no video, no sound, no
three.js). It plays once per browser session and can always be skipped ("Lewati", Esc). It can be replayed from
"Putar intro" in the hub's "Tampilan" menu, and it never appears on a province deep link. The hub mounts behind it
and loads its data and the 3D chunk meanwhile, so the map is usable about 0.4 s (the fade-out) after the bumper ends.
The bumper adds about 20 to 26 KB to the `/jelajah` cold load (budget 150 KB), not counting the reused PROT photos.
Verification found one real problem: the first-visit tier probe measured the bumper's animations. I fixed it (see 4
and 8). The phase is complete. Nothing is pushed.

## 2. Git
**Frontend** `nusantara-play-fe`, branch `phase-16-jelajah-bumper`, base `0986940` (main, Phase 15 CLAUDE.md commit).

| Commit | Message |
|---|---|
| `7d7a97d` | feat(jelajah): intro bumper component (six scenes, controller, once-per-session rule, brand constant) |
| `0d52e14` | fix(jelajah): bumper scenes only fade with reduced motion (explicit opacity-only variants) |
| `6167d5d` | feat(jelajah): show the intro bumper over the hub once per session, preload behind it, Putar intro in the menu |
| `a73846f` | test(jelajah): bumper controller, once-per-session rule, scene data fallbacks, scenes |
| `773c0e5` | fix(jelajah): start the auto-played bumper after the automatic tier is known (its fps probe must not measure the bumper) |
| `5e9a459` | docs(claude): Phase 16 intro bumper (structure, storyboard, once-per-session rule, preload), brand constant, decisions |

`git diff --stat 0986940..HEAD`: 21 files changed, 1553 insertions(+), 5 deletions(-).

**Backend** `nusantara-play-be`, branch `phase-16-jelajah-bumper`, base `875726d` (main, contains
`docs/phase-reports/phase-15.md`).

| Commit | Message |
|---|---|
| `5bc4754` | docs(claude): Phase 16 shared sections (Jelajah intro bumper, brand constant, decisions) |
| (this report) | docs(phase-16): phase report |

`git diff --stat 875726d..HEAD` before the report commit: CLAUDE.md, 1 file changed, 31 insertions(+).

## 3. Changes
Frontend, new:
- `lib/jelajah/brand.ts`: `SITE_NAME` ("Nusantara Virtual", the navbar's name) and `SITE_TAGLINE` (landing hero's first sentence); a rename is one line.
- `lib/jelajah/bumper/timeline.ts`: framework-free controller (auto-advance, next, skip, pause on hidden tab, manual mode).
- `lib/jelajah/bumper/use-bumper-timeline.ts`: React wrapper with the `visibilitychange` listener.
- `lib/jelajah/bumper/session.ts`: once-per-session rule (`sessionStorage['jelajah.bumperSeen.v1']`, try/catch, in-memory fallback).
- `lib/jelajah/bumper/scene-data.ts`: storyboard and durations, PROT/photo/map data, `GET /stats/landing` loading and parsing, all fallbacks.
- `components/jelajah/bumper/JelajahBumper.tsx`: the full-screen bumper (dots, Lewati, keys, focus trap, scroll lock, scene cross-fade, stats fetch).
- `components/jelajah/bumper/SceneLayout.tsx`: shared scene layout and motion variants, opacity-only with reduced motion.
- `components/jelajah/bumper/{Brand,Prot,Map,Game,Community,Start}Scene.tsx`: one component per scene.
- `tests/jelajah/bumper-timeline.test.ts`, `bumper-session.test.ts`, `bumper-scene-data.test.ts`, `bumper-scenes.test.tsx`: 33 tests.

Frontend, modified:
- `components/jelajah/JelajahHub.tsx`: cover and bumper over the hub, `inert` hub behind it, waits for the automatic tier, focus to "Tampilan" afterwards, replay.
- `components/jelajah/TierMenu.tsx`: optional "Putar intro" button (`onReplayIntro`), `data-jelajah-menu` on the trigger.
- `components/jelajah/ProvinceExperience.tsx`: marks the bumper as seen (deep links never lead to it).
- `CLAUDE.md`: new "Intro bumper (Phase 16)" section; shared sections (direction, lint baseline, Decisions log).

Backend: `CLAUDE.md` (shared sections, identical to the frontend), `docs/phase-reports/phase-16.md` (this report).

## 4. Decisions
- **Logo**: the site icon `app/apple-icon.png` (the mascot, 180 px, 6 KB, served at `/apple-icon.png`), next to the navbar's accent diamond. No new image file.
- **Where "Putar intro" lives**: the hub's only menu is "Tampilan" (`TierMenu`), so the button sits at the bottom of that panel. It is shown only on the hub.
- **"The map's first control"**: focus goes to the "Tampilan" button. It is the first control in the map overlay and it exists whatever the tier or loading state (on the 2d tier the first focusable element would otherwise be a province, and on 3D the Pilot marker).
- **Enter**: Enter always means "next scene", even while "Lewati" has focus (focus starts there, so a plain Enter would otherwise skip the whole intro). "Lewati" is pressed with Space, a click or Esc.
- **Session**: `sessionStorage`, so a "session" is the browser tab; a new tab plays it again. The bumper is marked as seen when it mounts. If storage throws, an in-memory flag limits it to once per page load.
- **Deep links**: opening a province page also marks the intro as seen. Otherwise a visitor who arrived at `/jelajah/sumatera-selatan` would get the 19 s intro when pressing "Kembali ke peta".
- **First visit and the tier probe**: the auto-played bumper waits on a plain cover until the automatic tier is known (at most 3 s; the probe normally takes 0.7 s). See 8 for why.
- **Server render / hydration**: `/jelajah` is static and the session flag can only be read after mount. The server HTML therefore shows a plain cover in the bumper's background colour, which fades out on later visits. A first visit never flashes the hub before the bumper.
- **Numbers**: a number that is not known yet (data loading, error) is left out of the text. Scene 2 with 0 PROT shows "PROT publik akan tampil di sini setelah selesai dikurasi." without photos. Scene 5 shows a tile only for a number above 0 (a 0 says nothing); on failure it shows no tiles.
- **Photos**: `ProtPhoto` `cover` (400 px, the `/prot` and stand-panel variants), up to 4, one per province first, then the rest, in name order.
- **Scene texts** (neutral, no facts): titles such as "Bertemu sesama pelestari" and "Main langsung di browser" and the short sentences are UI text only. The scene 4 sentence is exactly the one in the prompt.
- **Last scene**: it stays 4 s and then the bumper ends by itself; "Mulai Jelajah" ends it at once.

## 5. Deviations
- The prompt's storyboard says the bumper "plays automatically". On the first visit in a browser it now starts after the automatic tier is known, at most 3 s after hydration (0.7 s probe on real devices; in the headless runs the bumper appeared 0.3 to 4.1 s after navigation). Without this the bumper's own animations made the probe pick lower tiers (see 8).
- `ProvinceExperience.tsx` was changed (one effect). It is inside the allowed `components/jelajah/`, but the prompt did not list it explicitly (rule 4, deep links).
- The navbar (`components/ui/AppNavbar.tsx`) and the landing page still hold their own copies of "Nusantara Virtual". They are outside the allowed files, so `SITE_NAME` is used by the bumper only.

## 6. Verification
Free space at the start: C: 13 GB, D: 346 GB. At the end: C: 13 GB, D: 345 GB.

| Command | Result |
|---|---|
| `git pull` (both repos, main) | Already up to date; backend main has `phase-15.md`, frontend main has `0986940` (Phase 15 CLAUDE.md) |
| `npx tsc --noEmit -p .` | exit 0 |
| `pnpm test` | exit 0: 30 files, **360 passed**, 0 failed, 0 skipped (main: 327; +33 new) |
| `pnpm lint` | exit 1 (baseline): `126 problems (44 errors, 82 warnings)`, unchanged from Phase 15 |
| `npx eslint components/jelajah lib/jelajah tests/jelajah` | exit 0, 0 problems |
| `pnpm check:jelajah` | exit 0: `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)` … `check:jelajah OK` |
| `pnpm build` (inline `NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder-anon-key`, `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api`) | exit 0, `✓ Compiled successfully in 9.8s`; `/jelajah` static, `/jelajah/sumatera-selatan` SSG |
| `pnpm build` on `main` (same env, for the weight baseline) | exit 0 |

New tests: `bumper-timeline` (12: storyboard 15 to 20 s and every scene at least 2.5 s, timing, nothing before start, next, next on the last scene, skip once, pause and resume with the remaining time, start in a hidden tab, reduced motion manual mode, switching auto-advance, dispose, empty storyboard); `bumper-session` (6: first visit, new session, exact value, storage that throws, no storage, a throwing `sessionStorage` getter); `bumper-scene-data` (9: photo picking, PROT count, 0 PROT, loading/error, map highlight and count, map without number, stats parsing, failing stats endpoint, tiles); `bumper-scenes` (6: brand constant, 0-PROT scene, game sentence, community with and without stats, simulation label and Mulai Jelajah, no three.js and no `fetch` in any bumper file).

Browser checks (production build with `next start`, production API read-only, GET only: `/prot`, `/daerah/provinces`,
`/stats/landing` through the `/backend-api` rewrite; headless Chrome, fresh profiles on D:, cache disabled), final run:

| Check | Result |
|---|---|
| Phone 390x844 (light, dark), phone 360x740, desktop 1440x900 | 6 scenes in order, about 3 s each (brand → mulai 15.0 to 15.1 s), no horizontal overflow, focus on "Lewati" at start |
| Map behind the bumper | rendered 1.5 to 5.4 s after navigation (long before the end) |
| "Mulai Jelajah" → map usable (not inert, no bumper, canvas/SVG present, no loading text) | 371 to 391 ms (the 0.35 s fade-out) |
| Focus after the bumper | "Tampilan" (`data-jelajah-menu`) in every run; page scroll lock removed |
| Reload in the same tab | no bumper |
| Reduced motion | still on scene 1 after 6.5 s; 0 elements with a movement transform in all 6 scenes; Enter advances; Enter on the last scene closes |
| Keys | 4 × Tab stays inside the bumper; Esc skips, focus "Tampilan"; tap anywhere → next scene; "Lewati" closes |
| Putar intro | replays from scene 1 |
| Deep link `/jelajah/sumatera-selatan` | no bumper; `/jelajah` afterwards in the same tab: no bumper |
| `/stats/landing` blocked | community scene without number tiles, text shown |
| Tier 2d (`jelajah.tier=2d`) | SVG map, three.js chunk not loaded |
| three.js chunk `c77ae571dc1f29f9.js` | loaded on `/jelajah` (full tier); not on `/`, `/prot` |
| Console | only the existing `THREE.Clock … deprecated` warning (also on main) |

Screenshots (`D:/dev-cache/screens/phase-16/`):
- Phone 390x844, light: `phone-1-brand.png`, `phone-2-prot.png`, `phone-3-peta.png`, `phone-4-game.png`, `phone-5-komunitas.png`, `phone-6-mulai.png`, `phone-7-map-after-mulai.png`
- Phone 390x844, dark: `phone-dark-1-brand.png` … `phone-dark-6-mulai.png`, `phone-dark-7-map-after-mulai.png`
- Phone 360x740: `phone360-1-brand.png` … `phone360-6-mulai.png`, `phone360-7-map-after-mulai.png`
- Desktop 1440x900: `desktop-1-brand.png` … `desktop-6-mulai.png`, `desktop-7-map-after-mulai.png`, `desktop-menu-putar-intro.png`
- Reduced motion, phone: `reduced-phone-1-brand.png` … `reduced-phone-6-mulai.png`
- Stats endpoint failing: `phone-5-komunitas-stats-failed.png`

## 7. Manual checks
For the boss, on a phone (Vercel preview of `phase-16-jelajah-bumper`):
1. Open `/jelajah` in a new tab. After a short plain screen the intro starts: logo, "Nusantara Virtual", "Menjaga warisan, memainkan masa depan."
2. Watch without touching. About every 3 seconds a new scene appears: PROT photos with the number of public PROT; the Indonesia map with the provinces that have PROT in red-brown; "Segera hadir: mainkan permainan tradisional langsung di sini."; the number of events and members; XP and Paspor marked "Simulasi · tidak disimpan" with a large "Mulai Jelajah" button. The bars at the top fill up scene by scene.
3. Tap "Mulai Jelajah" (or wait about 4 seconds). The intro fades out and the map can be used at once.
4. Reload the page: no intro this time.
5. Tap "Tampilan" (top right) → "Putar intro": the intro plays again. Tap anywhere on the screen: the next scene appears at once. Tap "Lewati": back to the map.
6. Switch the site to dark mode (moon icon), then "Tampilan" → "Putar intro": every scene is readable in dark.
7. Open `/jelajah/sumatera-selatan` in a new tab: the village opens directly, no intro; "Kembali ke peta" shows the map without an intro.
8. Optional: with "Reduce motion" on in the phone's accessibility settings, the intro does not move and waits on each scene until you tap.

On a computer: Esc skips the intro, Enter goes to the next scene, and Tab stays inside the intro.

## 8. Findings

**Weight** (production build, cache off; "without photos" = the total minus the bumper's PROT photos, which are the
shared `ProtPhoto` `cover` variants):

| Build | Phone 390x844 dpr 3 | Desktop 1440x900 |
|---|---|---|
| `main` (`0986940`) `/jelajah` | 666 to 672 KB, 23 to 24 requests | 692 KB, 31 requests |
| Phase 16 `/jelajah`, bumper played to the end, without photos | 692 KB (2 runs) | 712 KB (2 runs) |
| Phase 16 added by the bumper | **+20 to 26 KB** | **+20 KB** |
| Bumper PROT photos (4) | 220 KB | 156 KB |

framer-motion was already in the shared bundle (navbar theme toggle), so the bumper adds only its own code (the
`/jelajah` page chunk is 33 KB raw / 11 KB gzip with hub + bumper), `/apple-icon.png` (6 KB) and the stats JSON.

**Tier probe** (fresh profile per run; cached automatic tier after the first `/jelajah` visit):

| Version | With the bumper | Without the bumper (session flag preset) |
|---|---|---|
| Before the fix | 2d, 2d, lite, 2d, lite, lite | lite, full, full, lite, full, full |
| After the fix (`773c0e5`) | full × 6 | lite, lite, full × 4 |

Headless SwiftShader exaggerates the effect, but a real phone would see the same direction, and the result is cached
in localStorage. After the fix the probe runs while only a static cover is on screen.

**Real data seen in production** (2026-11-19): 5 public PROT, 5 provinces with PROT (one has no own shape in the 2019
boundary data, so 4 are highlighted on the map), 1 event, 53 members.

## 9. Out-of-scope observations
- The navbar and the landing page hard-code "Nusantara Virtual" in several places (`AppNavbar.tsx`, `app/page.tsx` hero, quote, footer). A brand rename needs those too, or they could import `SITE_NAME` in a later phase.
- `THREE.Clock: This module has been deprecated` console warning on the 3D routes (from drei/fiber; also on main).
- The first request after `next start` took about 3 s (server warm-up); not related to the bumper.

## 10. Open questions
1. Should a new browser tab play the intro again (current behaviour, sessionStorage), or should it be once per browser (localStorage) or once per day?
2. Is 19 s the right length after seeing it on a phone, or should scenes be shorter (for example 2.5 s)?
3. The community scene hides a number that is 0. Is that the wanted behaviour, or should "0 Event" be shown?
4. When the brand is renamed, should the navbar and the landing page switch to the same `SITE_NAME` constant?

## 11. Ready for next phase?
Yes. The branch is ready for a Vercel preview and the boss's phone check (section 7). Nothing is pushed.
