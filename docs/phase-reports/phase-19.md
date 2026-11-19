# Phase 19: Concept video ("Kenali Nusantara Legacy") between the intro bumper and the 3D map

## 1. Summary

`/jelajah` now plays a ≈48 s code-driven motion-graphics film between the intro bumper and the map, on the first visit
per browser only. It is built with React, framer-motion, SVG/CSS and a particle canvas on the 3D tiers: no video file,
no three.js, no audio. Its eight scenes are courtyard games at dusk; colour draining to sepia as the toys turn to dust;
the dust gathering into Indonesia as the provinces light up west to east under the wordmark; archive cards with the real
published PROT names and a curator stamp; a dive into Sumatera Selatan that becomes an isometric village; three real
congklak moves with "+10 XP" chips and a Paspor Budaya stamp; the connected map; and "Mulai Menjelajah".

Every text and timing is in one file, `lib/jelajah/concept/script.ts`. The one exception is the map button's label,
which lives in `gate.ts` (Decisions). The film is:

- **Skippable:** "Lewati" and Esc.
- **Replayable:** "Tonton pengenalan" on the map.
- **Testable:** forced with `?concept=1`.
- **Calm with reduced motion:** stills with "Lanjut".
- **Lazy-loaded:** 37.9 KB gz, requested only when it plays. `/jelajah` itself grew by 1.6 KB.

Both small fixes are done: the Jelajah login page has no guest entry, and the landing page's featured PROT are
published only. A first browser measurement showed 3–15 fps, so the scenes were restructured into compositor layers.
In headless Chrome with software rendering and 4× CPU throttling, the film now averages 40.6 fps on desktop and 47.7 on a
390×844 phone. **The phase is complete** with these limits:

- Real phones were not measured.
- No mp4 was produced: there is no ffmpeg on this machine, so the recordings are `.webm`.

## 2. Git

**nusantara-play-fe**, branch `phase-19-concept-video`, base `e5162b2` (main, Phase 18 merge):

| Commit | Step |
|---|---|
| `9fed89f` | 1: script (all texts and timings), types, tests |
| `5670411` | 2: Indonesia outline build script, generated 23 KB path module, tests |
| `824b28a` | 3: scenes 1 to 8, scene kit, pure helpers, tests |
| `24b53f4` | 4: player (clock, captions, aria-live, Lewati, keys, hold, hidden-tab pause, reduced motion, particles, debug, test hook), tests |
| `4b5a619` | 5: bumper → concept → map in the hub, `?concept=1`, replay button, lazy chunk, map prefetch, gate tests |
| `c970cc5` | 6: fixes A (Jelajah login note) and B (published-only featured PROT), tests |
| `af35f70` | 7: captions out of `/jelajah`'s initial JS (found in the build), test |
| `84a106f` | 7: polish from the browser check (caption stacking, 2 lines at 360 px, fps sampling, particle redraw, logo, card fields) |
| `f615616` | 7: performance (compositor layers, CSS camera, painted-once lit map, sustained low-fps rule) |
| `9edd199` | 7: scene 3 sweep visible on phones, scene 4 cards fit landscape phones |
| `fb18a75` | 8: CLAUDE.md (concept video section, shared sections, decisions) |

`git diff --stat main` (after `fb18a75`): 44 files changed, 4792 insertions(+), 52 deletions(-)
(`lib/jelajah/concept/indonesia-paths.ts` is 23 KB of generated path data).

**nusantara-play-be**, branch `phase-19-concept-video`, base `bdb8e9c` (main, Phase 18 report):

| Commit | Step |
|---|---|
| `e964826` | 8: CLAUDE.md shared sections (concept video, lint baseline, decisions) |
| (this report's commit) | docs(phase-19): phase report |

`git diff --stat main` (before the report commit): 1 file changed, 32 insertions(+) (`CLAUDE.md`).

Nothing was pushed.

## 3. Changes

Frontend, new:
- `lib/jelajah/concept/script.ts`: THE script. Eight scenes (id, start, duration, caption, subcaption, fade-in, still
  frame), `BEATS` (moments inside scenes), `CONCEPT_TEXT`, the live `archiveSubcaption`, final hold 3 s, reduced-motion
  step 5 s, `CONCEPT_MUSIC` TODO hook.
- `lib/jelajah/concept/types.ts`: scene and end-reason types.
- `lib/jelajah/concept/timeline.ts`: scene at a time, mounted scenes around a cross-fade, opacity, reduced-motion mapping,
  easing.
- `lib/jelajah/concept/clock.ts`: the one rAF clock (pause, hidden, seek, hold, skip, finish; 250 ms cap per frame).
- `lib/jelajah/concept/seen.ts`: `np_concept_seen_v1` with the sessionStorage and in-memory fallbacks (reuses the
  bumper's storage helpers).
- `lib/jelajah/concept/gate.ts`: `planIntro`, `nextIntroStep`, `isConceptForced`, `CONCEPT_REPLAY_LABEL`.
- `lib/jelajah/concept/live.ts`: published counts, the live subcaption, archive cards (real names or neutral).
- `lib/jelajah/concept/congklak-demo.ts`: three legal moves from the real congklak engine, frame by frame.
- `lib/jelajah/concept/particles.ts`: tier budget (300 / 120 / 0), seeded particles, outline points.
- `lib/jelajah/concept/layout.ts`: portrait / landscape / desktop and the art boards.
- `lib/jelajah/concept/indonesia-paths.ts`: GENERATED outline (34 provinces, path + centroid, 23 KB).
- `scripts/build-concept-map.mjs`: generates it (mapshaper; names → codes with the hub's own matcher; 60 KB limit).
- `components/jelajah/concept/ConceptVideo.tsx`: the player (dialog, layers, captions, live region, Lewati, keys, hold,
  reduced-motion stills, particles, fps sampler and fallback, debug overlay, test hook).
- `components/jelajah/concept/use-concept-clock.ts`: React wrapper of the clock (MotionValue, visibility).
- `components/jelajah/concept/ParticleField.tsx`: canvas dust (scene 2) and gathering (scene 3), deterministic.
- `components/jelajah/concept/scene-kit.tsx`: scene props, attribute/style writers, `Stage` (static or live layer),
  `cameraCss`, batik/kawung/parang/truntum defs.
- `components/jelajah/concept/art/Courtyard.tsx`, `MapArt.tsx`, `Village.tsx`, `MiniBoard.tsx`: the artwork.
- `components/jelajah/concept/scenes/*.tsx`: the eight scenes.
- `components/landing/featured-prot.ts`: featured PROT query with `status=ARSIP_NASIONAL` and a published-only filter.
- Tests: `tests/jelajah/concept-script.test.ts`, `concept-map.test.ts`, `concept-scenes.test.tsx`,
  `concept-clock.test.ts`, `concept-player.test.tsx`, `concept-gate.test.ts`, `tests/landing/featured-prot.test.ts`.

Frontend, modified:
- `components/jelajah/JelajahHub.tsx`: intro stage machine (pending → bumper → concept → done) in the existing gate code,
  lazy `ConceptVideo`, cover in the film's colour, "Tonton pengenalan" button, Map3D prefetch and late mount during the
  film, hub `invisible` under the film, focus return.
- `components/jelajah/bumper/JelajahBumper.tsx`: optional `onLeave` before "Main Congklak" navigates.
- `components/auth/LoginForm.tsx`, `components/auth/login-redirect.ts`: fix A.
- `app/page.tsx`: fix B.
- `package.json`: `concept:map` script (no new dependency).
- `tests/middleware/login-gate.test.tsx`: fix A test.
- `CLAUDE.md`: commands, Jelajah file list, "Concept video (Phase 19)", bumper and login/landing notes, shared sections.

Backend: `CLAUDE.md` (shared sections), this report.

## 4. Decisions

- **Gate details:**
  - The bumper's daily rule is unchanged, and the concept follows it in the same stage machine (no second gating code).
  - `?concept=1` forces the concept only. The bumper still follows its own daily rule.
  - The film counts as seen after 1 s of playing, or when it ends or is skipped. So the bumper's "Main Congklak" (which
    leaves the page) does not use it up.
  - Province pages do not mark it as seen (see Open questions).
- **Replay label in `gate.ts`:** the hub imported it from `script.ts` at first, and the build showed every caption in
  `/jelajah`'s initial JS. `script.ts` now re-exports it, so it is still listed with the other texts.
- **Live data:**
  - The archive cards use the hub's own published-PROT data (the same code as the landing statistics), one per province
    first. Missing slots are neutral cards without names.
  - The subcaption is left out for 0 or unknown counts.
  - Scene 6's stamp is the pilot province (`PILOT_PROVINCE`).
  - The card motifs are abstract batik patterns, not game icons, so no PROT gets a misleading picture.
- **"Asal · Cara main · Cerita" chips on the archive cards** (texts in the script): the record's real fields, matching the
  caption.
- **Theme:** the film has fixed colours from the site palette. Light and dark screenshots of the same frame are
  pixel-identical outside the caption fade, so one set of theme screenshots is enough.
- **Particles fallback:** the particles are dropped only after 3 s of a low frame rate (below 30 fps on the 2 s average).
  Like the hub's own fallback, this ignores one-off stalls.
- **Performance restructuring:**
  - Static backgrounds and moving parts sit on separate compositor layers.
  - Camera moves are CSS transforms.
  - The lit map is painted once and revealed by a transform-only wipe. It still sweeps west to east and passes the
    provinces one after another, but as a soft-edged band instead of 34 separate fades.
  - The dive into Sumatera Selatan stops at 6× zoom (a layer keeps its first raster scale), and the village fades in from
    2.4 s.
- **The 3D map during the film:** if no bumper played before the film (for example `?concept=1`), the 3D map is mounted
  only from the last scene on. Its chunk, data and geometry still load immediately. This keeps the map build from
  competing with the film's frames.
- **Captions:** 18 px minimum, bold, `clamp(1.125rem, 3vmin + 0.4rem, 2.5rem)`. The extra-bold 22 px first version
  needed 3 lines for the scene 6 caption at 390 px.
- **Local verification harness (scratch only):**
  - A fake Supabase auth endpoint on localhost plus a session cookie, so `/jelajah` could be opened in a local
    production build.
  - `/backend-api` requests had their Authorization header removed, so production received only plain public GETs:
    `/prot?status=ARSIP_NASIONAL`, `/daerah/provinces`, `/stats/landing`.
  - In development mode the browser would call the API origin directly, so the harness blocked
    `api.nusantaralegacy.org` there.

## 5. Deviations

- **No mp4:** there is no ffmpeg on this machine (`which ffmpeg` finds nothing). As instructed, the `.webm` recordings
  were kept. Playwright's own bundled ffmpeg encodes only VP8, so it cannot make H.264. The conversion command is in
  CLAUDE.md.
- **Recordings run longer than 48 s:** about 56 s on screen. Screen capture slows the frames, the clock caps each step at
  250 ms, and the 3 s final hold and the chunk load are included.
- **fps measured in headless Chrome only**, with software rendering and 4× CPU throttling; no iPhone 11-class device was
  available. That environment reaches only about 51–58 fps even for an empty page, so the 60 fps desktop target cannot be
  shown there. Numbers are in Findings; a real-device check with `?debug=1` is on the manual checklist.
- **Scene 3's province lighting is a sweep**, not 34 separate fades (see Decisions). It is still west to east, one
  province after another.
- **"Diperiksa kurator" timing:** the stamp lands at 4.7 s into scene 4, so the scene's midpoint screenshot (3.5 s) does
  not show it yet. The reduced-motion still shows it.

## 6. Verification

Frontend (`nusantara-play-fe`, Git Bash, TEMP/TMP/npm cache on D:):

| Command | Result |
|---|---|
| `pnpm test` (preflight, main) | 42 files, 546 passed |
| `pnpm test` (final) | exit 0, 49 files, **610 passed**, 0 failed, 0 skipped (64 new) |
| `npx tsc --noEmit -p .` | exit 0, no output |
| `pnpm lint` | exit 1 (baseline): 124 problems (44 errors, 80 warnings), unchanged from Phase 18 |
| `npx eslint <42 new and touched .ts/.tsx/.mjs files>` | exit 0, no problems |
| `pnpm check:jelajah` | `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)`, `check:jelajah OK` |
| `pnpm concept:map` | `34 provinces, 5096 points, 23211 bytes (budget < 61440)` |
| `pnpm build` (placeholder Supabase values) | exit 0 (`build-final.log`); repeated after every code change |

Backend (`nusantara-play-be`): `npm test -- --cacheDirectory D:/dev-cache/jest` exit 0, 46 suites, **587 passed** (preflight
and final; only CLAUDE.md and this report changed, so no build or lint run was needed).

Browser checks, production build, logged in through the local harness, production API read-only
(`D:/dev-cache/tmp/phase-19/checks.txt`):

```
A first visit: bumper shown → Esc → concept shown, focus on the dialog | role=dialog aria-modal=true aria-label="Pengenalan Nusantara Legacy"
A Lewati box 107x44 px; np_concept_seen_v1 after 1.6 s = 1; Esc → closed, focus on the map's "Tampilan" menu
B second visit: bumper = false, concept = false, map shown; concept chunks requested: 0
C "Tonton pengenalan" (aria-label the same) → plays; chunks loaded: 27.9 KB + 7.5 KB + 2.5 KB = 37.9 KB gz
C live caption region: "Dulu, kita bermain di halaman."; Lewati → focus back on the replay button
D Enter on the last scene closes; untouched it closes 3 s after the end; touched it stays (t = 48000 after 6 s);
  "Mulai Menjelajah" closes; Enter on scene 4 keeps playing
E hidden tab: t 5350 → 5350 while hidden; visible again → 6345
F reduced motion: data-reduced=1, no canvas; "Lanjut" halaman → terlupa; 5 s later → nusantara
G 2d tier: no canvas, SVG dust fallback, 0 particles; three.js never requested
H bumper "Main Congklak" → /main/congklak?from=jelajah; np_concept_seen_v1 still unset
I logged out /jelajah → /login?redirectTo=%2Fjelajah&reason=jelajah; "Masuk sebagai Tamu" 0 times; note
  "Peta Jelajah memerlukan akun. Game di menu Game tetap bisa dimainkan tanpa akun.", link /main; plain /login keeps the guest button
scene 4 live subcaption: "5 permainan dari 5 provinsi sudah terbit di arsip."
```

Caption line counts (unclamped, every scene; `caption-lines-dev.txt`): at most 2 lines at 18 px on 360x740, 390x844 and
844x390 (scene 7's subcaption 2 lines on phones, 1 on landscape).

Free space: before C: 13 GB, D: 342 GB; after C: 13 GB, D: 342 GB. Everything (builds, Chrome profiles and cache,
Playwright and its ffmpeg, videos, screenshots) was written to D:.

## 7. Manual checks

For the boss, on the Vercel preview of `phase-19-concept-video` (logged in):

1. **First visit:** use a fresh browser profile or a private window, then open `/jelajah`. The intro bumper plays, then
   the concept film starts by itself, then the map appears. The film shows the dusk courtyard, the sepia dust, Indonesia
   lighting up with "Nusantara Legacy", the archive cards with real PROT names and the curator stamp, the dive into the
   Sumatera Selatan village, the congklak board playing three moves with "+10 XP" and the Paspor stamp, the connected
   map, and "Mulai Menjelajah".
2. **Second visit:** open `/jelajah` again. The bumper does not play if it already played today, the film does not play,
   and the map appears directly.
3. **Lewati:** "Lewati" is visible at the top right from the first second. Pressing it (or Esc) closes the film at once
   and opens the map.
4. **Replay:** "Tonton pengenalan" (bottom left of the map; on phones only the clapperboard icon) replays the film. After
   "Lewati", the keyboard focus is back on that button.
5. **Last scene:** leave it untouched and the map opens by itself about 3 s after the scene ends. Tap the scene once and
   it stays; press "Mulai Menjelajah" or Enter to continue.
6. **Phone:** hold it upright, then sideways. The picture re-composes (it is not just scaled), captions stay at most two
   lines, and nothing is cut off.
7. **Reduced motion:** turn on "Reduce motion" (iOS Settings → Accessibility → Motion, or Android "Remove animations"),
   then open `/jelajah?concept=1`. The same eight scenes appear as calm still pictures with a "Lanjut" button; they also
   advance every 5 s.
8. **Frame rate:** `/jelajah?concept=1&debug=1` on a real phone shows the frame rate on the right during the film. Please
   note the lowest number you see per scene (target: 45 fps or more on an iPhone 11-class phone).
9. **Fix A:** log out and open `/jelajah`. The login page has no "Masuk sebagai Tamu", but the line "Peta Jelajah
   memerlukan akun. Game di menu Game tetap bisa dimainkan tanpa akun.", where "menu Game" opens `/main`.
10. **Fix B:** as a curator or admin, open `/`. The featured PROT cards show published PROT only.

Recordings and screenshots (`D:/dev-cache/screens/phase-19/`):
- **Recordings:** `concept-1080p.webm` (1920x1080, 8.6 MB) and `concept-portrait.webm` (1080x1920, 8.7 MB). Both run
  from page load through the film to the map. No mp4: there is no ffmpeg on this machine.
- **Scene midpoints:** `01-halaman-…` to `08-mulai-…` in `-portrait` (390x844), `-landscape` (844x390) and `-desktop`
  (1440x900); `-desktop-dark` for the theme comparison; `-portrait-reduced` for the reduced-motion stills.
- **Login:** `login-jelajah-390.png`.

## 8. Findings

Bundle (production build, headless Chrome, cache off, tier pinned, both intros already seen, two runs each, identical):

| `/jelajah` JS transfer | main | Phase 19 |
|---|---|---|
| tier 2d, desktop | 283.0 KB (14 files) | 284.6 KB (15) |
| tier 2d, phone | 275.1 KB (13) | 276.8 KB (14) |
| tier full, desktop | 531.1 KB (16) | 532.8 KB (17) |
| tier full, phone | 523.3 KB (15) | 524.9 KB (16) |

Concept chunk, requested only when the film plays: 37.9 KB gz transfer in total.

- Film: 27.9 KB, including captions and the map paths; 28.2 KB with `gzip -9`.
- `next/image` runtime: 7.5 KB.
- Congklak core: 2.5 KB.

That is under the 60 KB gz target; framer-motion was already loaded. With both intros seen, none of these files is
requested. Neither is any caption: the build's initial `/jelajah` chunks contain only the seen key and the button label.

Frame rate: the whole film in real time; production build; headless Chrome with SwiftShader software rendering. An empty
page measures 51 fps there, and a composited animation 58.

| Run | Average | Worst scene | Particles |
|---|---|---|---|
| desktop 1440x900, full tier, CPU 1x | 45.6 fps | terlupa 33 | 300 throughout |
| desktop 1440x900, full tier, CPU 4x | 40.6 fps | terlupa 27 (one 1.6 s first-paint stall) | 300 throughout |
| phone 390x844 dpr 3, full tier, CPU 4x | 47.7 fps | terlupa 37 | 300 throughout |
| phone 390x844 dpr 3, lite tier, CPU 4x | 46.6 fps | terlupa 35 | 120 throughout |
| phone 390x844 dpr 3, 2d tier, CPU 4x | 50.7 fps | terlupa 41 | none (SVG fallback) |
| first version, desktop CPU 4x / phone CPU 4x | 6.3 / 14.6 fps | nusantara 3 / 4.5 | dropped early |

Per scene (desktop, 4x): halaman 43, terlupa 27, nusantara 31, arsip 51, jelajah 46, main 48, bersama 33, mulai 43. The
largest single frames (0.4 to 1.6 s) are first paints when a scene mounts; the worst is the lit map of scene 3, mounted
during scene 2. Software rendering exaggerates these; a real GPU should be much faster, but that is not measured yet.

## 9. Out-of-scope observations

- **Test record in the archive:** production has a published PROT named "Test Permainan Jawa Barat" (status
  ARSIP_NASIONAL). The film shows real names, so it appears as an archive card, as it already does on the map and the
  landing page.
- **Next 16 deprecation:** the build still warns that the `middleware` file convention is deprecated in favour of
  `proxy`.
- **Profile call 401:** in the local harness, the app's own `GET /backend-api/users/me` (navbar profile) answered 401,
  because the harness sends no token. This is expected locally and unrelated to the film.
- **Concept chunk not prefetched during the bumper:** it is requested only when the concept stage starts. A dark cover
  (the film's colour) shows for the fraction of a second the chunk needs. Prefetching it during the bumper would remove
  that, at the cost of fetching it for visitors who then skip.

## 10. Open questions

1. **Province deep links:** should opening a province page first (for example `/jelajah/sumatera-selatan`) also mark the
   concept film as seen, as it already does for the bumper? Today a visitor who starts on a province page sees the film
   on their first visit to the map.
2. **Archive test record:** may the published PROT "Test Permainan Jawa Barat" be unpublished or renamed? It shows up in
   the film's archive cards.
3. **Music:** is there a licensed track for the later music hook (`CONCEPT_MUSIC` in the script)? It would start only
   after a tap, muted by default.
4. **mp4 files:** should ffmpeg be installed on this machine (on D:) to produce the H.264 `.mp4` versions of the
   recordings, or is the `.webm` enough for now?
5. **Real-device measurement:** can someone run `/jelajah?concept=1&debug=1` on an iPhone 11-class phone and a mid-range
   Android phone and send the lowest fps per scene?

## 11. Ready for next phase?

Yes. The film, the gating and the two fixes are done and tested. The remaining checks (real-device frame rate, mp4
conversion) need a device or a tool owner decision; they do not block the next phase.
