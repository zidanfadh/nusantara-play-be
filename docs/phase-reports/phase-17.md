# Phase 17: Congklak (2D), the first self-hosted traditional game

## 1. Summary
The site now hosts its first game. Congklak in 2D is at the public page `/main/congklak` and is listed on `/main`. You
can play against the computer (Mudah, Sedang, Sulit) or with two players on one device, without logging in. The
board is a wooden board drawn in SVG + CSS (no images, no three.js). It is horizontal on landscape and desktop and
vertical on portrait phones, and it fits 360x740 without scrolling. Every rule switch of the one implemented ruleset
("Aturan dasar") lives in `lib/games/congklak/rules.ts`. The "Cara bermain" sheet is generated from that file and
says that other regional versions exist. The game records and sends nothing; only the settings are kept in
localStorage.

The Sumatera Selatan pavilion now opens the game ("Main Congklak" within 2 m, E key, 2d card), and the game links
back with "Kembali ke desa". Bumper scene 4 has a "Main Congklak" button, and the bumper now plays once per day. Both
landing-page tour links now open `/jelajah`.

Verification found one real problem: Next 16.1's Turbopack does not bundle worker files, so the AI silently ran on
the main thread. I fixed it with a Blob worker (see 4 and 5). The phase is complete. Nothing is pushed.

## 2. Git
**Frontend** `nusantara-play-fe`, branch `phase-17-congklak`, base `e8594fb` (main, merge of PR #14, contains the Phase 16
bumper).

| Commit | Message |
|---|---|
| `8dd97a5` | feat(games): congklak engine (Aturan dasar), rules config, AI levels and Web Worker, with tests |
| `d7f7a90` | feat(games): public /main and /main/congklak game page (SVG board, AI worker, animation, settings) |
| `0de7060` | feat(jelajah): pavilion opens congklak, bumper scene 4 Main Congklak, bumper once per day, landing links to /jelajah |
| `e0857fb` | fix(games): run the congklak AI in a Blob Web Worker built from one self-contained core |
| `ff73acc` | perf(games): memoize congklak pits (one sowing step re-renders only changed pits); tidy rules illustration |
| `4d57364` | docs(claude): Phase 17 games (congklak engine, AI worker, rules config, games record nothing), bumper once per day, link changes, decisions |

`git diff --stat e8594fb..HEAD`: 48 files changed, 3449 insertions(+), 95 deletions(-).

**Backend** `nusantara-play-be`, branch `phase-17-congklak`, base `2d2e8aa` (main, contains
`docs/phase-reports/phase-16.md`).

| Commit | Message |
|---|---|
| `e7bd306` | docs(claude): Phase 17 shared sections (hosted games, games record nothing, bumper once per day, decisions) |
| (this report) | docs(phase-17): phase report |

`git diff --stat 2d2e8aa..e7bd306`: CLAUDE.md, 1 file changed, 50 insertions(+), 1 deletion(-).

## 3. Changes
Frontend, new (engine, `lib/games/`):
- `lib/games/congklak/rules.ts`: THE rules config ("Aturan dasar": 7 holes, 7 seeds, `captureRequiresLap` false, `maxSowPerMove` 10,000).
- `lib/games/congklak/core.ts`: the engine and AI in one self-contained function, so the Blob worker can run it (see 4).
- `lib/games/congklak/state.ts`: board model types and default-rules wrappers (ring of 16 pits, legal moves, opposite holes).
- `lib/games/congklak/engine.ts`: `applyMove()` (new state + ordered animation events), `simulateMove()`, `IllegalMoveError`.
- `lib/games/congklak/ai.ts`: levels Mudah / Sedang / Sulit, the 300 ms limit, the options.
- `lib/games/congklak/random.ts`: seedable mulberry32 generator.
- `lib/games/congklak/replay.ts`: events → pit counts for the animation.
- `lib/games/congklak/playback.ts`: animation step timing.
- `lib/games/congklak/layout.ts`: SVG geometry of both board orientations, seed spiral.
- `lib/games/congklak/rules-text.ts`: "Cara bermain" text generated from the rules config, and the "other versions exist" note.
- `lib/games/congklak/announce.ts`: player names, aria-live move text, result headings.
- `lib/games/congklak/settings.ts`: `localStorage['games.congklak.settings.v1']` (mode, level, speed; try/catch, validated).
- `lib/games/congklak/from-link.ts`: allowlisted `from=` back link, `congklakHref()`, `GAME_LINK_PROVINCES`.
- `lib/games/congklak/ai-worker-source.ts`, `ai-client.ts`, `ai-protocol.ts`: Blob Web Worker, client with main-thread fallback, messages.
- `lib/games/registry.ts`: the games listed on `/main`.

Frontend, new (pages and components):
- `app/main/page.tsx`: `/main`, the games list (only congklak).
- `app/main/congklak/page.tsx`: `/main/congklak` (static; Suspense for `useSearchParams`).
- `components/games/congklak/CongklakGame.tsx`: start → play → end, animation driver, computer turns, "Lewati animasi", aria-live, restart and settings buttons, end screen.
- `components/games/congklak/CongklakBoard.tsx`: SVG wooden board, memoized pits, seeds, counts, keyboard, hand marker, highlights.
- `components/games/congklak/StartScreen.tsx`: mode, difficulty, who starts, animation speed, "Cara bermain", the no-data note.
- `components/games/congklak/RulesSheet.tsx`: the rules dialog with a small illustration (reuses `components/jelajah/DemoDialog.tsx`).
- `components/jelajah/GamePrompt.tsx`: "Paviliun permainan" / "Main Congklak" prompt (scene) and card (2d tier).
- `lib/jelajah/engine/pavilion.ts`: `nearestTarget()` (a stand or the game pavilion, whichever is closer within 2 m).

Frontend, modified:
- `middleware.ts`: `/main` and `/main/*` are public.
- `lib/jelajah/scenes/types.ts`: `PavilionDef.game?: 'congklak'`.
- `lib/jelajah/scenes/sumatera-selatan.ts`: the centrepiece gets `game: 'congklak'`.
- `lib/jelajah/engine/collision.ts`: the pavilion collider is exported as `pavilionCollider()` (same box as before).
- `components/jelajah/three/VillageScene3D.tsx`: reports nearness to the pavilion; E also works there.
- `components/jelajah/ProvinceExperience.tsx`: game prompt, E opens the game, screen-reader list entry, 2d card.
- `components/jelajah/ProvinceScene2D.tsx`: an `extra` slot above the stands (the game card).
- `components/jelajah/bumper/GameScene.tsx`: scene 4 now has a short line and the "Main Congklak" button.
- `components/jelajah/bumper/JelajahBumper.tsx`: the button skips the bumper and opens the game; Enter presses scene action buttons.
- `lib/jelajah/bumper/session.ts`: once per day per browser (localStorage date), with the once-per-session fallback.
- `app/page.tsx`: "Mulai Tur Virtual" → `/jelajah` (Link, same tab). Link target only.
- `components/ui/HeroCarousel.tsx`: the second slide → `/jelajah` (Link, same tab). Link target only.
- `CLAUDE.md`: shared sections, the "Games (Phase 17)" section, the bumper rule, route list, module table.

Tests:
- New: `tests/games/congklak-engine.test.ts`, `congklak-ai.test.ts`, `congklak-page-helpers.test.ts`, `congklak-worker-source.test.ts`, `games-record-nothing.test.ts`, `tests/jelajah/pavilion.test.ts`, `tests/landing/landing-links.test.ts`.
- Modified: `tests/jelajah/bumper-session.test.ts` (rewritten for the daily rule), `tests/jelajah/bumper-scenes.test.tsx` (scene 4), `tests/middleware/public-routes.test.ts` (games routes).

Backend:
- `CLAUDE.md`: shared sections identical to the frontend (games bullet, item 11, lint baseline, Decisions log).
- `docs/phase-reports/phase-17.md`: this report.

## 4. Decisions
- **Board model**: one ring of 16 pits (0..6 player 0, 7 their store, 8..14 player 1, 15 their store). Sowing always goes to the next index, which is anticlockwise for both players on screen (tested with the shoelace sign for both layouts). The opposite hole of i is 14 − i.
- **Safety limit**: checked before each relay pickup, so a move sows at most 10,000 seeds and no seed is lost. In development it logs a `console.warn`.
- **The capture switch counts "passed the own store"** as "sowed at least one seed into the own store during this move, relays included".
- **AI levels**:
  - Sedang scores each move by store gain, +3 for an extra turn, +1 for a capture, and ±1000 when the move ends the game; ties are broken randomly.
  - Sulit uses alpha-beta with iterative deepening up to depth 12 or 300 ms. An extra turn keeps the same side to move; positions are evaluated by the store difference.
  - The tests use Sulit at a fixed depth 4 with no time limit, so they are deterministic.
- **Blob worker instead of a worker file**: Next 16.1.6's Turbopack copied `new Worker(new URL('./ai.worker.ts', import.meta.url))` (with and without options, inside or outside a function) as a raw `.ts` file into `/_next/static/media`, so the worker never ran.
  - I could not touch `next.config.ts` or the build script (outside the allowed files), so the engine and AI moved into one self-contained function, `core.ts`. The worker is started from a Blob of its source plus a handler.
  - The main thread and the tests use the same function, so there is still one implementation, and `rules.ts` is still the one rules config.
  - A test runs the worker source in isolation, so any outside reference would fail it.
- **Main-thread fallback**: without Blob workers (old browser, strict CSP) or after a worker error, the move is computed on the main thread with a 40 ms limit.
- **Reduced motion and "Tanpa animasi"** show the whole move at once with a 0.7 s highlight of the changed pits (no hand, no movement). The visible message line says what happened.
- **The computer waits at least 550 / 300 / 250 ms** (Normal / Cepat / Tanpa animasi) before playing, so its moves are readable.
- **Vertical board** below 768 px in portrait: "Kamu" / "Pemain 1" in the right column with their store at the top, the opponent on the left with their store at the bottom. The score chips follow the same left/right order.
- **"Who starts" is not saved**: the brief lists only difficulty, speed and last mode as saved settings, so "Yang mulai" resets to the first player.
- **Note under the start screen**: "Permainan ini tidak menyimpan data apa pun. Pilihan di atas hanya diingat di perangkat ini." The second sentence is honest about the saved settings.
- **`from=` values are allowlisted**:
  - `jelajah-<slug>` only for provinces in `GAME_LINK_PROVINCES` (tested to equal the scenes with a game pavilion) → "Kembali ke desa".
  - `jelajah` → "Kembali ke peta". I added this for the bumper's button, so a visitor can return to the map.
  - Anything else gives no link (no open redirect).
- **Pavilion wording**: "Paviliun permainan" + "Main Congklak"; the 2d card says "Main congklak langsung di browser, lawan komputer atau berdua." No claim about where congklak comes from.
  - On phones the prompt is one full-width "Main Congklak" button; the title is read by screen readers. The two-part layout overlapped at about 180 px wide.
  - When the player is within 2 m of both a stand and the pavilion, the closer one wins. With today's layout they never overlap.
- **Bumper "Main Congklak"** calls `skip()` and then navigates to `/main/congklak?from=jelajah`. The button carries `data-bumper-action`, so Enter presses it instead of advancing the bumper.
- **The daily bumper rule uses the local calendar date** (`YYYY-MM-DD`).
  - When localStorage can be read but not written (for example full), the session flag is written instead; a session flag always counts as "seen". This can only make the bumper rarer, never more frequent.
  - The in-memory flag still stops repeats within one page load.
- **Landing links use `next/link`** (same tab). A plain `<a href="/jelajah">` would add a `no-html-link-for-pages` lint error.
- **Pit memoization**: one sowing step re-renders only the pits whose count or highlight changed. I added this after the 4x-throttled run showed render gaps during long relay chains.

## 5. Deviations
- **Web Worker mechanism**: the brief asked for a Web Worker. It is a real worker, but started from a Blob URL instead of a bundled worker file, because this Next.js version's Turbopack does not bundle worker files (see 4). The same function runs in the worker, on the main thread and in the tests.
- **Cold load target (350 KB)**: met on phones (344.5 KB). On desktop the measured total is 364.3 KB, because the shared navbar's desktop links (Menu, Kalender) prefetch the `/calendar` and `/menu` route code at idle (about 20 KB, visible request by request). The page's own load is about 344 KB on both viewports. I did not change the navbar (outside the allowed files). See 8 and 10.
- **Long tasks at 4x CPU throttling**: with 4x throttling there were two long tasks per game: mounting the board after "Mulai main" (58 to 102 ms) and showing the end screen (54 to 64 ms). Neither is AI work, and none happened during AI turns. Without throttling there were none.
- **`lib/jelajah/engine/collision.ts`**: changed to export `pavilionCollider()` for the pavilion proximity. It is in an allowed folder (`lib/jelajah/`, pavilion interaction), and the collider box is unchanged (tested).

## 6. Verification
Commands (frontend unless noted; caches and temp on D:, see CLAUDE.md "Local machine"):

| Command | Exit | Result |
|---|---|---|
| `git checkout main && git pull --ff-only` (both repos) | 0 | fe `e8594fb` (contains the Phase 16 bumper), be `2d2e8aa` (contains `phase-16.md`) |
| `pnpm test` (`vitest run`) | 0 | 37 files, **455 passed**, 0 failed, 0 skipped |
| `pnpm lint` | 1 (as on main) | `✖ 126 problems (44 errors, 82 warnings)`, same as the baseline; `npx eslint` on every new and touched file: 0 errors, 1 warning (the existing unused `LandingStats` import in `app/page.tsx`) |
| `npx tsc --noEmit -p .` | 0 | no output |
| `pnpm check:jelajah` | 0 | `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)` … `check:jelajah OK` |
| `pnpm build` (`NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`) | 0 | `✓ Compiled successfully in 12.3s`; `○ /main`, `○ /main/congklak` (static); no `*worker*` file in `.next/static` |

Unit test highlights (engine and AI):
- Seeds equal 98 after every move in 2,000 random games, and every game ends. Replaying each move's events gives exactly the new state.
- No safety-limit hit in 1,000 random games; the longest move sowed 272 seeds.
- Each rule has its own test: relay sowing, skipping the opponent's store (both players), extra turn, capture and no capture, the `captureRequiresLap` switch both ways, both game-end paths with the sweep, draw, illegal moves, and the safety limit with a small limit.
- Only legal moves at every level (300 positions); Sulit with the real 300 ms limit stays within 450 ms in Node.
- **Sulit beat Mudah in 50 of 50 seeded games** (0 lost, 0 drawn); Sedang beat Mudah in 50 of 50.

Headless Chrome on the production build (`next start -p 3001`, fresh profiles on D:, cache off; scripts in
`D:/dev-cache/tmp/phase-17/tools/`). Free disk space: before C: 13 GB / D: 345 GB; after C: 13 GB / D: 338 GB.

## 7. Manual checks
On a computer (Vercel preview of the branch):
1. Open `/main/congklak`. The start screen shows Mode, Tingkat kesulitan, Yang mulai and Kecepatan animasi, the "Mulai main" and "Cara bermain" buttons, and the note "Permainan ini tidak menyimpan data apa pun."
2. Open "Cara bermain". It shows a small board picture, 7 numbered rules and a grey note that rules differ by region.
3. Play against "Sedang". Click a dashed-ring hole on your (bottom) row: the hand carries the seeds hole by hole, and the count next to each hole updates. During a long move press "Lewati animasi". The scores at the top always add up with the board to 98.
4. Use the keyboard: Tab to the board, arrows to choose, Enter to play.
5. Finish a game: the end screen shows the result and "Main lagi".

Phone checklist for the boss (about 5 minutes, any phone):
1. Open `<preview>/main/congklak` holding the phone upright. The board stands vertically with no scrolling: your holes on the right, your store ("Kamu") at the top.
2. Tap "Mulai main" and tap one of your holes with a dashed ring. Seeds move one by one; "Lewati animasi" jumps to the end.
3. Turn the phone sideways: the board turns horizontal.
4. Play a full game against "Mudah" (a few minutes with "Cepat"): an end screen shows who won and the two store totals.
5. Choose "2 pemain di satu perangkat": the top line always says whose turn it is ("Giliran Pemain 1/2"), and that player's row is highlighted.
6. Open `<preview>/jelajah/sumatera-selatan`, walk to the pavilion in the middle of the plaza, and tap "Main Congklak". The game opens, and "Kembali ke desa" (top left) brings you back.
7. Open `<preview>/jelajah` in a private window. The intro plays; on the 4th scene tap "Main Congklak" and the game opens. Open `/jelajah` again the same day: no intro (it plays again tomorrow, or anytime via "Tampilan" → "Putar intro").
8. On the home page, "Mulai Tur Virtual" opens our own Jelajah map in the same tab.

## 8. Findings

**Scripted games** (production build, desktop 1440x900, random human moves, speed Cepat; seeds total read from the
board after the end):

| Game | Result | Final stores (Kamu / Pemain 1 – opponent) | Seeds total | Long tasks | Longest main-thread gap | AI ran in |
|---|---|---|---|---|---|---|
| vs Mudah | Komputer menang | 44 – 54 | 98 | 0 | 40 ms | Blob worker |
| vs Sedang | Komputer menang | 35 – 63 | 98 | 0 | 36 ms | Blob worker |
| vs Sulit | Komputer menang | 13 – 85 | 98 | 0 | 37 ms | Blob worker |
| 2 pemain | Pemain 1 menang! | 56 – 42 | 98 | 0 | 33 ms | (no AI) |
| vs Sulit, CPU throttled 4x | Komputer menang | 14 – 84 | 98 | 2 (58 ms at start, 64 ms at the end screen) | 108 ms | Blob worker |

- The worker was confirmed through CDP auto-attach (a `worker` target with a `blob:http://localhost:3001/...` URL).
- Each run started with a sanity check: a deliberate 80 ms page task, caught by the long-task observer (`[80]`) and by the heartbeat (81 to 83 ms).
- No console errors.
- After each game, focus moved to the result heading.

**Cold load** (production build, cache off, 2 runs each, identical):

| Route | Phone 390x844 | Desktop 1440x900 | three.js |
|---|---|---|---|
| `/main/congklak` | 344.5 KB (JS 265.1 KB, 20 requests) | 364.3 KB (JS 279.8 KB, 27 requests) | not loaded |
| `/main` | 358.1 KB | 376.3 KB | not loaded |

- Starting a game adds 0 KB (the worker is a Blob).
- The game's own chunk is about 20 KB gzipped (59 KB raw). The rest is shared by every page: react-dom 69 KB, Supabase 53 KB (root `AuthProvider`), framer-motion 52 KB (navbar theme toggle), fonts 50 KB, CSS 21 KB.
- Desktop extra: the navbar's Menu/Kalender links prefetch `/calendar` and `/menu` (route data and two chunks).
- The only non-static requests on `/main/congklak` were the page itself and those prefetches: no backend call.

**Fit and accessibility** (production, `screens-results.txt`):

| Viewport | Page scroll | Board (w × h) | Hole size |
|---|---|---|---|
| 390x844 | none (844/844) | 366 × 591 px | 55 px |
| 360x740 | none (740/740) | 336 × 487 px | 46 px |
| 1440x900 | none | 992 × 643 px | 79 px |

- The start screen also fits all three viewports.
- Reduced motion: no hand, no animation, no skip button; the counts and the message update at once.
- Keyboard: focus starts on hole 1; two ArrowRight move it to hole 3; Enter played it.
- The dark theme is readable (screenshot).

**Site links** (production, `final-results.txt`):
- Pavilion, desktop: walking north from the spawn shows "Paviliun permainan / Main Congklak". E opens `/main/congklak?from=jelajah-sumatera-selatan`, the game shows "Kembali ke desa → /jelajah/sumatera-selatan", and the link goes back.
- Pavilion, phone: a single "Main Congklak" button with the same href. 2d tier: a "Main Congklak" card with the same href. No horizontal overflow.
- Bumper scene 4 (phone and desktop): "Main Congklak" is present and "Segera hadir" is gone.
- Bumper button: it opens `/main/congklak?from=jelajah` (back link "Kembali ke peta"). The stored date was `2026-11-19`.
- Daily rule: the same day in a new tab the bumper does not play; with a stored date in the past it plays.
- Landing: "Mulai Tur Virtual" → `/jelajah`, no `target`, same tab (page count unchanged); carousel slide → `/jelajah`. No external links are left on `/`.

**External game or tour links found on public pages:**

| Where | Link | Change |
|---|---|---|
| `/` "Mulai Tur Virtual" (`app/page.tsx`) | `https://multimedia-demo.wellmagicteam.com/nusalega/` (new tab) | → `/jelajah`, same tab |
| `/` hero carousel, slide 2 (`components/ui/HeroCarousel.tsx`) | `https://nusantaraplay.kpoti.id/` (dead, new tab) | → `/jelajah`, same tab |

Not changed (not game or tour links):
- `https://amoy.polygonscan.com` blockchain proof links on PROT detail.
- `https://tokopedia.com` and `https://example.com` placeholders in forms behind login.
- `https://wa.me` on a marketplace shop page behind login.
- Image URLs in `app/landing-page/2` (behind login).

**Screenshots** (`D:/dev-cache/screens/phase-17/`):
- Start screen: `start-phone-390x844.png`, `start-phone-360x740.png`, `start-desktop-1440x900.png`, `start-phone-390x844-dark.png`.
- Rules sheet: `rules-sheet-phone-390x844.png`.
- Board mid-game: `board-midgame-phone-390x844.png`, `board-midgame-phone-360x740.png`, `board-midgame-desktop-1440x900.png`, `board-midgame-phone-390x844-dark.png`; reduced motion: `board-reduced-motion-phone-390x844.png`.
- Capture moment: `final-sedang-capture.png` (also `final-mudah-capture.png`, `final-sulit-capture.png`, `final-dua-capture.png`).
- End screen: `final-mudah-end.png`, `final-sedang-end.png`, `final-sulit-end.png`, `final-dua-end.png`.
- Pavilion prompt in the scene: `final-pavilion-desktop.png`, `final-pavilion-phone.png`; 2d card: `final-pavilion-2d-phone.png`.
- Bumper scene 4: `final-bumper-scene4-phone.png`, `final-bumper-scene4-desktop.png`.
- Logs: `final-results.txt`, `screens-results.txt`; weights in `D:/dev-cache/tmp/phase-17/weights.txt`.

## 9. Out-of-scope observations
- **Turbopack worker files**: Next 16.1.6's Turbopack copies `new Worker(new URL('./x.ts', import.meta.url))` as a raw asset. Any future worker in this repo has the same problem until Next is upgraded (then the Blob worker can become a plain worker file).
- **Shared bundle**: every page ships Supabase (53 KB gzip, root `AuthProvider`) and framer-motion (52 KB, navbar theme toggle). These dominate the game page's weight, and the desktop navbar prefetches `/calendar` and `/menu` on every page.
- **Site-wide `<html lang="en">`** (`app/layout.tsx`): the content is Indonesian, so screen readers read the aria-live game text with English pronunciation.
- **`app/landing-page/2`** is an old landing page behind login, with remote Google images.

## 10. Open questions
1. **Desktop cold load**: is 364 KB acceptable against the 350 KB target, given that about 20 KB is the shared navbar prefetching `/calendar` and `/menu`? Options: accept; set `prefetch={false}` on the navbar's desktop links (a navbar change); or move Supabase out of the root layout once the self-hosted login replaces it.
2. **Ruleset**: should the curator review "Aturan dasar"? Common variants are a capture only after one full lap (the existing switch), each player's first turn played at the same time, and holes that become "burned" in later rounds (not implemented).
3. **Navbar link** to `/main` and `/jelajah`: still waiting for the boss's review of the preview.

## 11. Ready for next phase?
Yes. Nothing blocks. The open questions are product decisions.
