# Phase 23: Egrang (stilts), the third self-hosted game

## 1. Summary

Egrang is playable at `/main/egrang` (public, listed on `/main` after Congklak and Gasing). It is a 2D canvas race against the
computer (Mudah, Sedang, Sulit) in two variants, each based on its own published archive record. In **Bambu** (Jawa Tengah) you keep a
swaying body balanced on tall stilts, and a bad step can make you fall. In **Batok** (Sulawesi Selatan) you step on a kendang beat, and
out of rhythm the coconut shell slips off. Phones tap the left / right half and desktops use ← / → (A / L); both go through one input path.
The engine is pure and deterministic and shared by both variants. The computer is calibrated against a documented typical player:
Bambu 78.0 / 47.3 / 28.3 %, Batok 76.7 / 48.0 / 29.7 % (targets 75 / 50 / 30 ± 10).
Sound is synthesized on the Phase 21 engine. Jawa Tengah and Sulawesi Selatan now have an egrang practice track instead of the
"Game segera hadir" sign. The track opens the game with the village's variant, and "Kembali ke desa" leads back.
The intro bumper shows one button per game. The landscape toast-over-panel issue from Phase 22 is fixed.
**The phase is complete**, with one caveat: headless software-rendered fps is 17–29, not 60 (section 8). Real phones have not been measured yet.

## 2. Git

| Repo | Branch | Base | Commits | Diff |
|---|---|---|---|---|
| nusantara-play-fe | `phase-23-egrang` | `efbfbb0` (Merge PR #20, Phase 22) | `d51373c`, `645c09c`, `0282f6f`, `4b575e4`, `6f9dd1a`, `76e1a4d`, `7ee6dc1`, `2c250ab` | 50 files changed, 5318 insertions(+), 83 deletions(-) |
| nusantara-play-be | `phase-23-egrang` | `b2eacb1` (Phase 22 report) | `da1d58e`, `e1b1b20`, + this report's commit | `CLAUDE.md`, `docs/phase-reports/phase-23.md` |

Frontend commits, in order:
1. `d51373c` Step 1: rules, types, texts, settings and tests.
2. `645c09c` Step 2: engine and invariant tests.
3. `0282f6f` Step 3: input model, AI and calibration.
4. `4b575e4` Step 4: renderer, HUD, controls, tutorial, screens and sound.
5. `6f9dd1a` Step 5: integration (route, card, links, pavilions, bumper, fingerprints).
6. `76e1a4d` Step 6: toast fix.
7. `7ee6dc1` Step 7: bumper fits landscape phones (found during verification).
8. `2c250ab` Step 8: CLAUDE.md.

Nothing pushed. The frontend's local `main` was fast-forwarded to `origin/main` (`6df8fe7` → `efbfbb0`) before branching.

## 3. Changes

Frontend, new files:
- `lib/games/egrang/rules.ts`: the curator file, "Aturan dasar":
  - one race and a 3 s countdown;
  - a gentle slope and a 180 s safety time limit;
  - per variant: track length (Bambu 64 m, Batok 52 m), penalty (fall 1.7 s, slip 0.8 s) and 4 obstacles.
- `lib/games/egrang/types.ts`: shared shapes (World, RacerState, Track, RaceEvent, RaceResult).
- `lib/games/egrang/texts.ts`: every Indonesian string:
  - variant and level labels;
  - a 3-step tutorial per variant;
  - the rules, generated from the config;
  - result lines;
  - the per-record "Tentang" panels and credits.
- `lib/games/egrang/settings.ts`: `games.egrang.settings.v1` (variant, level), `games.egrang.tutorialSeen.v1` (per variant) and the
  `?varian=` parser, all with try/catch.
- `lib/games/egrang/engine.ts`: the pure engine (fixed step, seeded track, Bambu sway, Batok beat, shared race, `simulate`,
  `playRace`).
- `lib/games/egrang/input.ts`: keys and taps → foot → one timestamped queue drained per fixed step, plus the simulation clock.
- `lib/games/egrang/ai.ts`: the computer and the documented `TYPICAL_HUMAN`, with the level scaling.
- `lib/games/egrang/sound.ts`: the cue map (events, pulse, countdown, gong, end phrase) and the offline cue sheet.
- `lib/games/egrang/random.ts`: re-exports gasing's mulberry32.
- `lib/games/egrang/from-link.ts`: the back link through the shared allowlist.
- `components/games/egrang/EgrangGame.tsx`: shell with start / race, toolbar with `SoundControls`, sheets, `?from=`, `?varian=` and `?debug=1`.
- `components/games/egrang/EgrangRace.tsx`: the canvas loop, input, AI, HUD, countdown, flashes, end screen, sound scheduling and
  the debug hook.
- `components/games/egrang/render.ts`: all drawing (backdrops, parallax tile, lane caches, racers, effects, balance arc, rhythm ring).
- `components/games/egrang/use-egrang-sound.ts`: a sound session on the Phase 21 engine (dynamic import).
- `components/games/egrang/StartScreen.tsx`, `InfoSheets.tsx`, `Tutorial.tsx`: the UI pieces.
- `app/main/egrang/page.tsx`: the public static route.
- Tests:
  - `tests/games/egrang-texts.test.ts`, `egrang-engine.test.ts`, `egrang-input.test.ts`, `egrang-ai.test.ts`,
    `egrang-components.test.tsx`;
  - `tests/jelajah/province-identity.test.ts` (fingerprints of Kepulauan Riau, Aceh, Jawa Tengah, Sulawesi Selatan);
  - `tests/jelajah/stand-panel-toast.test.tsx`.

Frontend, modified files:
- `lib/audio/core.ts`: three new synthesized sounds: `bamboo` (hollow knock), `batok` (coconut-shell tok), `thud` (fall / slip).
- `lib/games/links.ts`:
  - `egrang` added to `JelajahGame`, plus `GameVariant`;
  - `gameHref(game, from, variant)` adds `?varian=`;
  - egrang provinces are Jawa Tengah and Sulawesi Selatan.
- `lib/games/registry.ts`: the `/main` card.
- `lib/jelajah/scenes/types.ts`: `PavilionStyle` `egrang`, `PavilionDef.variant`, `SceneDefinition.gamePavilion`.
- `lib/jelajah/engine/pavilion.ts`: `gamePavilion()` prefers `gamePavilion` over the centrepiece.
- `lib/jelajah/engine/collision.ts`: practice-track collider, appended last.
- `lib/jelajah/three/village-geometry.ts`: `addEgrangTrack` (bamboo rails and stilts / rope rails and coconut shells), appended last.
- `lib/jelajah/scenes/jawa-tengah.ts`, `sulawesi-selatan.ts`: the practice track replaces the "Game segera hadir" sign. Jawa Tengah
  also moved one stump that would have touched the track. Grass details avoid the track.
- `components/jelajah/ProvinceExperience.tsx`: passes the pavilion's variant to the link.
- `components/jelajah/GamePrompt.tsx`: egrang icon (Footprints).
- `components/jelajah/bumper/GameScene.tsx`, `JelajahBumper.tsx`: one button per game.
- `components/jelajah/bumper/SceneLayout.tsx`: opt-in `dense` layout for screens at most 500 px high.
- `components/jelajah/StandPanel.tsx`: the whole header is `data-toast-avoid`, and it re-measures when opening, one frame later
  and on close.
- Tests updated for the new state: `sound-core`, `game-links`, `congklak-page-helpers`, `bumper-scenes`, `concept-gate`,
  `enterable-provinces`, `pavilion`, `province-scenes`, `toast-clearance`.
- `CLAUDE.md`:
  - new "Egrang (Phase 23)" section;
  - routes, games table, pavilions and bumper updated;
  - shared sections.

Backend: `CLAUDE.md` (shared sections) and this report.

## 4. Decisions

- **Stacked lanes.** With side-by-side perspective lanes, the computer was hidden behind the player whenever they were level.
  The computer's path is now drawn further back, higher and smaller (scale 0.56), with its feet above the player's head. Both racers
  are always visible, and their relative positions stay true.
- **Bambu model.** The sway is `tilt = amp · sin(phase)`, with a fixed 1.0 s swing that grows by itself while walking.
  - The left foot's ideal moment is the needle at the left extreme; the right foot's is the right extreme.
  - Good steps settle the swing and pull its phase toward the ideal. Bad or same-foot steps kick it.
  - The first step after the start or a fall can be either foot, and it starts the swing on that foot.
  - Standing still before the first step never falls, so there is no punishment for waiting at the start line.
  - The balance arc sits at the bottom centre, next to the thumbs, instead of above the head, where it collided with the
    stacked computer lane.
- **Batok model.** Each beat (0.42 s) carries one step, within ±130 ms (±75 ms on a stone or puddle). Missing a beat only costs
  time; it is not a slip.
- **Forgiving windows.** With the first tuning the typical player fell about 10 times per Bambu race. The windows were widened
  until they get about 3 falls (Bambu) or 4 slips (Batok) per race, and a race takes about 43–44 s.
- **AI levels.** Each level is the typical-player model with its errors scaled by one factor per level and variant.
  Race outcomes average over about 70 steps, so the win rate is very sensitive. Small factors (1.15 / 1 / 0.92) already span
  75 → 30 %. The "Sulit" computer is therefore only slightly steadier than an average player.
- **Separate game pavilion.** Jawa Tengah's plaza centrepiece is the pendopo landmark, and Sulawesi Selatan has none. The
  egrang "pavilion" is therefore a new optional `gamePavilion` next to stand 1, exactly where the sign was.
  - It is a short practice track with a start line and a finish banner.
  - Bambu: bamboo rails and leaning stilts. Batok: rope rails on stakes and coconut shells on sand.
  - The other scenes' meshes and colliders are byte-identical; fingerprint tests confirm it.
- **Fingerprints.** Kepulauan Riau and Aceh had no fingerprint test, so I recorded theirs before the engine change and Jawa Tengah's and
  Sulawesi Selatan's after it. Sumatera Selatan's Phase 22 test is unchanged and still passes.
- **Sound.**
  - The Bambu pulse follows the player's needle: a soft dang at each sway extreme. A fixed metronome would contradict the needle
    after a nudge.
  - The Batok kendang plays every beat, scheduled at most 200 ms ahead from the simulation clock.
  - "Mulai main" and a tap on the track also unlock audio when the browser blocked it, unless the visitor muted it.
- **Performance work.**
  - Removed `backdrop-blur` from the HUD and pads, which made the scene re-blur every frame.
  - Batched the sarong patterns (`CanvasPattern`), pole nodes and particles.
  - The lane surfaces are pre-rendered strips, at most 8192 device px wide.
  - A "skip parts" debug switch used during the investigation was removed again.
- **Bumper layout.** At 844×390 the three buttons fell below the fold. `SceneLayout` got an opt-in `dense` mode (no visual, tighter
  type at ≤ 500 px height) that only the game scene uses, and the buttons never wrap.
- **Bambu archive place.** The game credits "Kabupaten Magelang" (`kabkotaName`), like gasing does.

## 5. Deviations

- **60 fps is not reached in the headless measurement.** The measured range is 17–29 fps (section 8). The evidence points to the environment:
  - the main thread is about 70 % idle;
  - ×1 and ×4 CPU give the same result;
  - an empty canvas reaches 54 fps;
  - dpr 1 vs 2 and a CPU-backed canvas make no difference;
  - Phase 22's 3D scenes measured 13–17 fps on the same setup.

  Real-phone numbers are still open; `?debug=1` shows fps on the device.
- **Videos.** `.webm` only, without sound. There is no ffmpeg under `D:/tools/ffmpeg`, and Playwright's recorder has no audio
  track. The race WAVs are separate files of the same races.
- **Bumper fix.** The `dense` bumper layout (`7ee6dc1`) was not requested explicitly. It was needed to keep "the bumper's behaviour"
  on landscape phones once it had three buttons.

## 6. Verification

Disk: before C: 13 GB / D: 336 GB free; after C: 11 GB / D: 336 GB. The loss on C: did not come from this phase's tools:
- npm/pnpm caches, Playwright browsers and the temp folders all point to D:;
- in the last 5 h only about 260 MB went into the owner's normal Chrome profile under `%LOCALAPPDATA%`, plus small Edge and
  Claude logs.

Still well above 3 GB.

| Command | Exit | Result |
|---|---|---|
| `npx vitest run` (frontend) | 0 | 74 files, 944 tests passed, 0 failed, 0 skipped. In one full run a gasing integration test hit its 5 s timeout under load; it passes alone and in every later full run |
| `npx tsc --noEmit -p .` | 0 | clean |
| `npx eslint .` | 1 | 124 problems (44 errors, 80 warnings), same as the baseline |
| `npx eslint <49 new and touched .ts/.tsx>` | 0 | clean |
| `node scripts/check-jelajah-budget.mjs` (`pnpm check:jelajah`) | 0 | every province 195.6 KB (limit 8 MB); textures OK |
| `npx next build` (normal env) | 0 | `✓ Compiled successfully`, `○ /main/egrang` static |
| AI calibration (`tests/games/egrang-ai.test.ts`, 300 races × 3 levels × 2 variants) | 0 | see section 8 |

Browser checks: production build on `localhost:3101`, headless Chrome through Playwright with profiles and caches on D:.
- The Jelajah shots used a separate build with `NEXT_PUBLIC_SUPABASE_URL` pointing to the local fake auth endpoint
  (Phase 19 harness, scratch only).
- The production API saw only plain public GETs.
- The `.next` build left on disk is the normal one.

## 7. Manual checks

For the boss:
1. **Phone, Bambu.** Open `/main/egrang` and choose "Bambu (tinggi)", Sedang, "Mulai main". The tutorial appears; read or skip it.
   After "3, 2, 1, Mulai!", tap the left and right halves alternately as the needle reaches the gold mark on that side. You should
   hear a hollow bamboo knock per step and a soft drum at each needle turn, and you should move forward. Tap the same side twice or
   too early: the needle swings further. When it reaches red you fall ("Jatuh! Naik lagi…") and climb back up after about 2 s.
   Finish: gong, then the end screen with your time and the computer's, and "Main lagi".
2. **Phone, Batok.** Choose "Batok (irama)". Tap alternately on each kendang beat as the gold ring closes on the feet; you hear a
   coconut-shell "tok". A tap off the beat, or the same side twice, shows "Lepas!" and a short stumble. There is no falling.
3. **Levels.** Play each variant on Mudah, Sedang and Sulit. Mudah should be easy to beat and Sulit hard. Sulit's computer stumbles
   less often but is still human-like.
4. **Landscape and desktop.** Rotate the phone: the HUD gets slimmer and the pads smaller, and the game stays playable. On desktop
   use ← / → (or A / L).
5. **Sound.** If the 🔇 / "Nyalakan suara" button shows, tap it: sound starts. The choice is remembered, shared with the Jelajah intros.
6. **Jawa Tengah.** From `/jelajah`, enter Jawa Tengah and walk a few steps right (east) from the start. A short bamboo practice track
   with stilts stands next to the first stand, and "Main Egrang" appears. It opens Egrang with Bambu preselected; "Kembali ke desa"
   leads back to the village.
7. **Sulawesi Selatan.** The same as step 6: a track on the sand with coconut shells, which opens Egrang with Batok preselected.
   Aceh still shows "Game segera hadir".
8. **Bumper.** Open `/jelajah` on a new day, or use "Putar intro". The "Main game tradisional" scene shows three buttons ("Main
   Congklak", "Main Gasing", "Main Egrang"): stacked on a phone, in one row in landscape and on desktop. Each opens its game with
   "Kembali ke peta".
9. **Toast fix.** On a landscape phone in a province, open a PROT stand. The "+10 XP" toast appears below the panel's title and
   close button, not over them.
10. **Curator.** "Cara bermain" and "Tentang permainan ini" in each variant should match the archive records. The ruleset awaits
    curator review.

Review material in `D:/dev-cache/screens/phase-23/`:
- `game/`: 84 shots. Both variants at 390x844, 844x390 and 1440x900, light and dark; each with start, tutorial, countdown, mid-race,
  fall or slip, finish and end screen.
- `jelajah/`:
  - both pavilions (desktop, phone, 2d card);
  - pavilion → game → back;
  - bumper at three sizes;
  - the toast checks.
- `media/`:
  - `egrang-bambu.wav`, `egrang-batok.wav` (one race each, 48 kHz);
  - `egrang-bambu-1280x720.webm`, `egrang-batok-1280x720.webm`.

## 8. Findings

### Step 0: archive check

Command: `GET https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&page=1&limit=100` (read-only, no auth). It returned 5
records: SEPANGKAL, Egrang Batok, Egrang Bambu, Gasing, Test Permainan Jawa Barat.

| Record | Province / place | id |
|---|---|---|
| Egrang Bambu | Jawa Tengah (33), Kabupaten Magelang (33.08) | `e32ed727-4455-434e-b1b1-b984413e9f24` |
| Egrang Batok | Sulawesi Selatan (73), Kabupaten Soppeng (73.12) | `a6ce0739-bcb5-43ae-9e13-0ea74d7b8f3f` |

Text fields of both records:
- Present: statusAsalUsul, caraBermain, nilaiMoral, peralatan (1 item each).
- `deskripsi` and `jumlahPemain`: null. `targetUsia`: SEMUA_USIA.
- Bambu's `caraBermain` has 5 numbered steps.
- Batok's `caraBermain` mentions races to a finish line "tanpa jatuh".

Both records are present and published.

### AI calibration

The documented typical player races the computer 300 times per level:

| Variant | Mudah | Sedang | Sulit | Typical player |
|---|---|---|---|---|
| Bambu | 78.0 % | 47.3 % | 28.3 % | median 42.7–44.2 s, ~3.2 falls / race |
| Batok | 76.7 % | 48.0 % | 29.7 % | median 43.2–44.3 s, ~4.0 slips / race |

A perfect player finishes in about 30 s.

### Frame rate

Mid-race with autoplay, production build, headless Chrome with software rendering:

| Viewport | Bambu ×4 CPU | Batok ×4 CPU |
|---|---|---|
| 390x844 dpr 2 | 18.2 fps (×1: 17.6) | 29.2 fps (×1: 27.6) |
| 844x390 dpr 2 | 23.9 | 22.7 |
| 1440x900 dpr 1 | 17.4 | 17.9 |

During the investigation:
- an empty canvas gave 54 fps;
- a CPU-backed canvas changed nothing (21 vs 20);
- dpr 1 vs 2 changed nothing;
- removing the blur and adding the lane caches gave about +1 to +4 fps.

### Size

| Item | gzip |
|---|---|
| The game's own chunk | 24.8 KB (69.9 KB raw; budget 60 KB) |
| Everything only `/main/egrang` loads, compared with `/main/gasing` | 46.1 KB, including the shared audio runtime (10.3 KB) and a shared UI chunk (11.0 KB) |
| `/main/egrang` all JS | 291 KB (`/main/gasing` 274 KB) |

No three.js on `/main/*`. No audio code on other pages: the hook uses a dynamic import, which is tested.

### Sound

Offline WAV of one race each, from the same engine as live playback:

| Variant | Length | Cues | Voices | Peak | RMS |
|---|---|---|---|---|---|
| Bambu | 53.0 s | 279 | ≤ 8 | −3.2 dBFS | −22.5 dBFS |
| Batok | 53.2 s | 353 | ≤ 8 | −4.4 dBFS | −23.0 dBFS |

No clipping. I cannot listen to them myself; please judge the bamboo knock and the coconut tok in particular.

### Integration

| Check | Result |
|---|---|
| Jawa Tengah pavilion → `/main/egrang?varian=bambu&from=jelajah-jawa-tengah` | variant `bambu`, "Kembali ke desa" → `/jelajah/jawa-tengah`, no page errors (desktop and phone) |
| Sulawesi Selatan pavilion → `?varian=batok&from=jelajah-sulawesi-selatan` | variant `batok`, back to the village, no page errors (desktop and phone) |
| 2d tier game cards | the same links |
| Bumper | 3 buttons; 3 rows at 390x844, 1 row at 844x390 and 1440x900 (48 px high). "Main Egrang" → `/main/egrang?from=jelajah`, "Kembali ke peta" |
| Toast at 844x390 | panel header 449–831 × 13–79, toast 244–600 × 87–179: no overlap |
| Fingerprints | Sumatera Selatan, Kepulauan Riau and Aceh identical to before Phase 23 |

## 9. Out-of-scope observations

- **Archive address mismatch.** "Egrang Bambu" has `alamatLengkap` "Kota Magelang" but `kabkotaName` "Kabupaten Magelang".
- **Fall direction.** The side view shows the Bambu sway as a slight forward/back rock of the figure, while the arc shows left/right.
  The figure falls toward the side of its lean.
- **Other bumper scenes.** On very short landscape screens the other bumper scenes may still be taller than the screen. Only the
  game scene was made `dense`.
- **Rotated decor.** Jawa Tengah's random grass and flower details are re-rolled because of the new exclusion zone, so a few small
  decor items moved in that province.

## 10. Open questions

1. **Real phones.** Please play both variants on a real phone with `?debug=1` and tell me the fps shown. If it is low on a 4 GB
   Android, I can lower the canvas resolution or simplify the backdrops.
2. **Difficulty.** Is the Bambu balance too hard or too easy? The typical-player model falls about 3 times per race; the timing window
   and the sway growth are in `TUNING` in `engine.ts`.
3. **Curator review.** Should a curator confirm the race framing for Egrang Bambu? The archive record describes walking on bamboo
   stilts but no race; Egrang Batok's record does mention races.
4. **Pavilion labels.** Should the pavilions say "Main Egrang Bambu" / "Main Egrang Batok" instead of "Main Egrang"? The stand sign
   already names the record.

## 11. Ready for next phase?

Yes, after the boss's manual check on a phone (section 7). Nothing blocks the code. The branches are not pushed.
