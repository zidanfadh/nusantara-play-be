# Phase 20: Gasing (spinning top), the second self-hosted game

## 1. Summary
A 2D Gasing game is live at the public page `/main/gasing`, listed on `/main` next to Congklak. You play against the computer (Mudah, Sedang, Sulit) in two modes, both taken from the published archive record "Gasing" (Kepulauan Riau): **Uri** (the longest spin wins) and **Pangkah** (strike the opponent's spinning top; roles swap each round). Matches are best of 3.
- **Throw:** a slingshot gesture (drag back, hold until the string glows gold, release) or the keyboard. Both use one release rule, including a "perfect release" bonus.
- **Engine:** pure and deterministic (fixed 1/120 s step, seeded RNG), with tested invariants.
- **Computer:** calibrated against a documented "typical human" model. All six measured win rates are inside the ±10 % targets.
- **Same as Congklak:** public, nothing recorded, one rules file and one texts file, "Aturan dasar" awaiting curator review, the end screen, and the `?from=jelajah` back link.

The phase is complete. Two items are reported but not built, as the prompt asked: the Jelajah pavilion and bumper only support one game, and real-phone frame rates have not been measured yet.

## 2. Git
**nusantara-play-fe**: branch `phase-20-gasing`, base `ea7b4de` (main = origin/main, Phase 19 merged as PR #17). Not pushed.

| Commit | What |
|---|---|
| `f9f1f89` | Step 1: rules config, types, texts from the archive record, settings, tests |
| `4315224` | Step 2: physics engine + invariant tests (its message mentions a heavier "pangkah" striker; that was removed again in `8464a01`, see Decisions) |
| `8464a01` | Step 3: throw model, round decision, match controller, AI, calibration tests |
| `145d6db` | Step 4: canvas renderer, play view, HUD, tutorial, start screen, rules/about sheets |
| `e82dd3f` | Step 5: route, `/main` card, prefetch off, integration tests |
| `0570de4` | Step 6 fix: polish from the first browser check |
| `0b85ba5` | Step 6 perf: separate arena canvas, compositor-only shake/meters, compact landscape layout |
| `d0f393c` | Step 6 fix: default canvas without `desynchronized` (tops were not composited) |
| `7413398` | Step 6 fix: compact cards on landscape phones, HUD timers frozen at the decision |
| `105d670` | Step 7: CLAUDE.md |

`git diff --stat main...HEAD`: 31 files changed, 4460 insertions(+), 9 deletions(-). Of those, 21 are new files in `lib/games/gasing/`, `components/games/gasing/` and `app/main/gasing/`; 6 are new test files; the rest are the CLAUDE.md, registry, `/main` page and test updates.

**nusantara-play-be**: branch `phase-20-gasing`, base `2f760e2` (main = origin/main). Commits: `910153b` (CLAUDE.md shared sections) and the commit adding this report (hash in the printed final message). Diff: `CLAUDE.md` +20/−1, `docs/phase-reports/phase-20.md` new. Not pushed.

## 3. Changes
Frontend, `lib/games/gasing/` (pure, no React or DOM):
- `rules.ts`: the curator file ("Aturan dasar": `roundsToWin` 2, `maxRounds` 5, `arenaRadius` 1, `outIsLoss`).
- `texts.ts`: every Indonesian string, the rules generated from `rules.ts`, the curator note, and the archive paraphrase with its credit and link.
- `types.ts`: shared shapes. `random.ts`: mulberry32 random generator.
- `physics.ts`: the engine and the headless `simulate`.
- `throw.ts`: pointer and keyboard input turned into a throw, with one shared release rule.
- `outcome.ts`: the round decision.
- `ai.ts`: plans, level profiles, the Sulit search, and the typical-human model.
- `match.ts`: rounds, turn order, the computer's throws, and a headless `playMatch`.
- `settings.ts`: localStorage settings and the "tutorial seen" flag. `from-link.ts`: the back link (reuses congklak's allowlist). `sound.ts`: audio hook, silent for now.

Frontend, `components/games/gasing/`:
- `GasingGame.tsx`: start screen and play view, toolbar, sheets, `?from=`, `?debug=1`.
- `GasingArena.tsx`: frame loop, input, HUD, round and end overlays, haptics, debug hook.
- `render.ts`: all canvas drawing.
- `StartScreen.tsx`, `InfoSheets.tsx` (rules and about), `Tutorial.tsx`.

Frontend, pages and registry:
- `app/main/gasing/page.tsx`: the route; metadata uses `SITE_NAME`.
- `app/main/page.tsx`: game links get `prefetch={false}`.
- `lib/games/registry.ts`: Gasing entry after Congklak.

Frontend tests:
- New: `tests/games/gasing-{texts,physics,throw,match-ai,components,integration}.test.*`.
- Updated: `games-record-nothing.test.ts` (covers gasing; the gasing engine must be pure), `congklak-page-helpers.test.ts` (registry now has two games), `tests/middleware/public-routes.test.ts` (`/main/gasing` is public).

Both repos: `CLAUDE.md`. The frontend gets a new "Gasing (Phase 20)" section; the shared sections (current direction, item 11, lint baseline, decisions) are updated identically in both repos.

## 4. Decisions
- **Archive check:** a published Gasing record exists (see Findings), so the build went ahead. The rules and the "Tentang permainan ini" panel paraphrase it, credit it ("Sumber: arsip PROT "Gasing", Kabupaten Natuna, Kepulauan Riau (diringkas)"), and link to `/prot/5ed247fd-e45b-4308-bfbe-74c49fbb6557`. The text is stored statically because game files may not use the network (existing test).
- **"Same reward/HUD behaviour as congklak":** congklak today records nothing and has no reward HUD. Gasing does the same: no XP, no network, only `localStorage['games.gasing.settings.v1']` and `['games.gasing.tutorialSeen.v1']`.
- **Pangkah round rule:**
  - Out of the ring = loses at once. Otherwise the top that spun shorter, measured from its own landing, loses (the same rule as Uri).
  - Taken literally, "stops first" on the wall clock would always favour the striker, because the target was thrown earlier. Measuring from each top's own landing removes that, and a hit pays off by shortening the target's spin. The record's own wording supports this ("menghentikan putaran gasing lawan lebih cepat"; in Natuna "yang paling lama berputar").
- **Both tops identical:** I first gave the striker a heavier top, after the record's thicker *gasing pemangkah*. In simulation the striker then won 79–96 % of rounds at every level. The rules sheet states the simplification.
- **Landing scatter:** a shaky release lands off target, so the aim marker shows a clean release's landing point and release quality also means accuracy.
- **Perfect release:** after the aim has been held steady for 450 ms, a 450 ms gold window opens. Releasing in it with a steady hand gives ×1.07 spin, half the tilt penalty, a third of the scatter and "Lemparan mantap!". Holding longer lets the string slip slightly.
- **Keyboard:** ← → aim, ↑ ↓ power, hold Space to wind, release to throw. A test checks that the same aim, power and hold give exactly the same throw as the pointer.
- **No AI worker:** a Sulit decision (12 candidates × 300 steps) takes about 1.5 ms median on this desktop (test bound 7.5 ms, about 30 ms on a 4× slower phone), so it runs on the main thread.
- **Canvas:** the static arena is its own canvas, drawn on resize only. The shake is a CSS transform and the meters use `scaleX`. The browser's default 2D canvas is kept (see Findings for the CPU-backed alternative behind `?debug=1&canvas=cpu`).
- **Landscape phones** (height ≤ 500 px): the HUD moves into a side column and the round/end cards are compact.
- **Metadata:** `Gasing · ${SITE_NAME}` plus Open Graph `siteName`.

## 5. Deviations
- **60 fps:** not reached in headless Chrome. The measurements use software rendering, where even an empty page tops out at about 55–60 fps. Numbers are in Findings; real phones still need checking with `?debug=1`.
- **Sumatera Selatan village / bumper:** not linked. The mechanism supports one game only (`PavilionDef.game?: 'congklak'`, a hardcoded "Main Congklak" in `GamePrompt`/`GameCard`, and the bumper's scene 4 calls `congklakHref`). How it could be added: make `PavilionDef.game` a union (`'congklak' | 'gasing'`) with a per-game label and href map (`gameHref(game, from)`) used by `GamePrompt`, `GameCard` and `ProvinceExperience`, and key `GAME_LINK_PROVINCES` per game so `from=jelajah-<slug>` is allowlisted for both pages. The bumper could show both games side by side.
- **Step 0:** produced no repo change, so it has no commit.
- **Commit `4315224`:** its message mentions the heavier striker, which a later commit removed (explained in Decisions).

## 6. Verification
Free space before: C: 13 GB, D: 342 GB. After: C: 13 GB, D: 336 GB. Every cache, temp folder, profile and screenshot is on D:. Playwright's ffmpeg comes from `D:/dev-cache/ms-playwright` via `PLAYWRIGHT_BROWSERS_PATH`; its default location is on C:, so it was not used.

| Command | Exit | Result |
|---|---|---|
| `pnpm test` baseline (main) | 0 | 49 files, 610 tests passed |
| `pnpm test` (final) | 0 | 55 files, 705 passed, 0 failed, 0 skipped |
| `npx tsc --noEmit -p .` | 0 | no output |
| `pnpm lint` | 1 | `✖ 124 problems (44 errors, 80 warnings)`, same as the Phase 19 baseline; `eslint` on every touched `.ts/.tsx` file: 0 problems |
| `pnpm check:jelajah` | 0 | `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)` … `check:jelajah OK` |
| `pnpm build` (`NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`) | 0 | `✓ Compiled successfully in 16.7s`; `○ /main`, `○ /main/congklak`, `○ /main/gasing` (static) |
| Production read-only GET `https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&page=1&limit=100` | 200 | 5 records (Findings) |

Browser checks ran on the production build (`next start -p 3102`) in headless Chrome (installed Chrome, SwiftShader, temp profiles on D:). Requests to `/backend-api` and the API host were blocked; the page makes none anyway. Scripts are in `D:/dev-cache/tmp/phase-20/tools/`.
- **Screenshots** in `D:/dev-cache/screens/phase-20/`: start, tutorial, aiming (gold window), hit (3 frames), Uri round result, end screen; at 390x844 (dpr 3), 844x390 (dpr 3) and 1440x900; light and dark. That is 48 files, plus `phone-light-07-reduced-motion-hit.png`.
- **Recordings:** `pangkah-round-phone.webm` (390x844) and `pangkah-round-desktop.webm` (1280x800), each one Pangkah round with a real mouse slingshot.
- **Reduced motion:** with `prefers-reduced-motion: reduce` the canvas layer was never transformed during a hard hit (1 distinct value: `none`). Without it, there were 9 distinct shake offsets.

## 7. Manual checks
Checklist for the boss (Vercel preview of `phase-20-gasing`, about 10 minutes, any phone):
1. **First look.** Open `<preview>/main`. A "Gasing" card sits next to "Congklak". Tap "Main Gasing".
2. **Start screen.** It shows two modes, each with a one-line explanation, three difficulty levels, "Mulai main", "Cara bermain" and "Tentang permainan ini". "Tentang" credits the archive record (Kepulauan Riau) and "Lihat arsip lengkap" opens its page.
3. **Uri, Mudah.** Tap "Mulai main". A 3-step tutorial appears (Tarik, Arahkan, Lepas); "Lewati" closes it, and it never shows again on this phone. Press anywhere on the arena and pull back. A dashed line and circle show where the top lands, and an arc shows the power. Hold still: the string turns gold. Release while it is gold: "Lemparan mantap!". Releasing back at the starting point cancels.
4. **Feel.** The slingshot should feel good: a short, steady hold beats a quick flick, and a very strong throw slides out of the ring. Both timers count; the longer spin wins the round and a card shows both times.
5. **Pangkah.** Play Pangkah against Sedang. The computer's top spins first; throw yours onto it. A direct hit shows "Pangkah tepat!", sparks and a small shake (and a vibration on Android). In round 2 the computer strikes your top.
6. **Levels.** Play one match on each level. They should feel different: Mudah often throws crooked or weak, Sulit almost always hits in Pangkah and spins long in Uri.
7. **Rotate the phone.** In landscape the scores move to the left and the arena fills the height.
8. **Keyboard (computer).** Tab to the arena; ← → aim, ↑ ↓ power, hold Space until the gold ring, release. The throw works the same as the mouse.
9. **Reduced motion.** Turn on the system's "reduce motion" setting and reload: no shake and fewer particles, but the game plays normally.
10. **Back link.** Open `<preview>/main/gasing?from=jelajah`: "Kembali ke peta" shows top left and on the end screen.
11. **Frame rate.** On a mid-range Android phone open `<preview>/main/gasing?debug=1` and play Pangkah. The fps counter is bottom left. Please send the number (and the number with `&canvas=cpu` added).

## 8. Findings
**Archive (step 0)**, published PROT (`status=ARSIP_NASIONAL`, read-only):

| Name | Province | Short description (from the record) |
|---|---|---|
| SEPANGKAL | Aceh (Aceh Singkil) | "saling menjatuhkan atau baku jatuh" (bahasa Alas) |
| Egrang Batok | Sulawesi Selatan (Soppeng) | egrang made of coconut shells |
| Egrang Bambu | Jawa Tengah (Magelang) | bamboo stilts, played since the Dutch colonial era |
| **Gasing** | **Kepulauan Riau (Natuna)** | Malay spinning top; Gasing Uri (longest spin) and Gasing Pangkah/Tanding (strike) |
| Test Permainan Jawa Barat | Jawa Barat (Depok) | "lorem ipsum" (a test record that is published) |

**AI calibration** (300 seeded matches each; typical human = the AI's own plans with ±0.05 rad aim and ±0.06 power error, release quality 0.5 to 0.92, a perfect release one time in three):

| Mode | Mudah (target 75 %) | Sedang (50 %) | Sulit (30 %) |
|---|---|---|---|
| Uri | 75.3 % | 51.3 % | 27.0 % |
| Pangkah | 76.7 % | 55.7 % | 32.0 % |

**Performance** (production build, headless software rendering, 2.5 s right after a Pangkah strike):

| View | CPU ×1 | CPU ×4 |
|---|---|---|
| Phone 390x844, default canvas | 39.7 fps | 40.6 fps (p95 frame 50 ms) |
| Desktop 1440x900, default canvas | 21.1 fps | 21.5 fps |
| Phone, `&canvas=cpu` | 52.4 fps | 38.5 fps |
| Desktop, `&canvas=cpu` | 40.0 fps | 27.1 fps |

- A CPU profile showed the page's JavaScript almost idle (about 10 ms in 2.2 s). The cost is rasterising and compositing the large canvas in software. On desktop, hiding the foreground canvas gave 58.9 fps.
- An intermediate version used `desynchronized: true` and seemed to reach 52 fps, but its frames were not composited: the tops were missing from screenshots. It was removed and is forbidden in CLAUDE.md.
- Real GPUs should do much better; not measured yet.

**Bundle:** the game's own JS (loaded on `/main/gasing`, not on `/main/congklak`) is 2 chunks, 81.7 KB raw and **28.0 KB gzip** (budget 60 KB). All JS of `/main/gasing`: 276 KB gzip in 15 files. three.js does not load (tested).

**Spin durations:** a clean throw to the centre spins about 6–9 s, a poor one about 5 s. A direct Pangkah hit cuts the target's spin from about 7.6 s to 3.5–4 s.

## 9. Out-of-scope observations
- The production archive contains a published test record, "Test Permainan Jawa Barat" ("lorem ipsum"). It counts in the map, the landing statistics and the bumper.
- The Gasing record's equipment links to a Tokopedia product page; that is outside the game.

## 10. Open questions
1. Should Gasing get a pavilion in a Jelajah village (Kepulauan Riau is not enterable yet) or a button in the bumper? Both need the multi-game change described in Deviations.
2. Is the Pangkah rule acceptable (out = loss, otherwise the shorter spin from its own landing loses)? Or should "the striker wins only by knocking the target out or down" be the rule?
3. Real-phone fps with `?debug=1` and `?debug=1&canvas=cpu`: which canvas mode should be the default?
4. Should the published "Test Permainan Jawa Barat" record be unpublished?
5. Curator review of "Aturan dasar" and the "Tentang" text (both say they await it).

## 11. Ready for next phase?
Yes. Nothing blocks. Real-phone fps and the curator review are follow-ups, not blockers.
