# Phase 22: More Jelajah provinces — Aceh, Kepulauan Riau, Jawa Tengah, Sulawesi Selatan (+ multi-game pavilions, Gasing in Kepri)

## 1. Summary

Four more provinces are now enterable: Aceh, Kepulauan Riau, Jawa Tengah and Sulawesi Selatan. Each is a distinct
low-poly village built from one scene data file, with the existing engine and the existing shared CC0 assets (no new
asset files). Each province's published archive record sits on a stand and behaves exactly like the Sumatera Selatan
pilot: ProtPhoto panel with "cara bermain", a link to `/prot/<id>`, and simulated PROVINCE_ENTER, PROT_VIEW and
PASPOR_STAMP rewards.

Pavilions now support more than one game (`'congklak' | 'gasing'`, with the back link allowlisted per game). The
Kepulauan Riau village has a Gasing arena: "Main Gasing" opens the game, and "Kembali ke desa" brings the player back.
Aceh, Jawa Tengah and Sulawesi Selatan show a "Game segera hadir" sign instead, with no button.

All five provinces are marked on both maps, have a route behind the login gate, have their own Paspor stamp design,
and work on the full, lite and 2d tiers. Sumatera Selatan is unchanged: its geometry fingerprints, recorded on `main`
before any change, still match, and its before/after screenshots differ only in the animated player.

Every step was verified and committed, so the phase is complete. Nothing was pushed.

## 2. Git

| Repo | Branch | Base | New commits |
|---|---|---|---|
| nusantara-play-fe | `phase-22-more-provinces` | `6df8fe7` (origin/main, merge of PR #19 Phase 21) | `49a8745` engine + multi-game pavilions · `7b611e0` Kepulauan Riau · `45e3f97` Aceh · `1933c0c` Jawa Tengah · `aaeab57` Sulawesi Selatan · `6820bae` map, routes, stamps · `7807f3b` CLAUDE.md |
| nusantara-play-be | `phase-22-more-provinces` | `309317d` (main = origin/main, contains Phase 21) | `5a622c7` Step 0 plan · `b8e7823` CLAUDE.md · this report (hash in the final message) |

`git diff --stat`:

- **Frontend:** 42 files changed, 2978 insertions(+), 241 deletions(-).
- **Backend:** `CLAUDE.md` +27, `docs/phase-reports/phase-22.md` (new).

## 3. Changes

Frontend, new files:

| File | Why |
|---|---|
| `lib/games/links.ts` | The multi-game list (`JelajahGame`), with per-game path, texts, `gameHref`, per-game `GAME_LINK_PROVINCES`, `backLinkFor(from, game)` and the "Game segera hadir" texts. |
| `lib/jelajah/scenes/kepulauan-riau.ts`, `aceh.ts`, `jawa-tengah.ts`, `sulawesi-selatan.ts` | One scene data file per new province. |
| `lib/jelajah/three/mesh-builder.ts` | The merged-mesh builder, moved unchanged out of `village-geometry.ts` so other modules can share it. |
| `lib/jelajah/three/house-roofs.ts` | Gable roof builder and its presets: `malay`, `aceh`, `bugis`. |
| `lib/jelajah/three/structures.ts` | Landmarks merged into the village mesh: `jetty`, `mountain`, `terraces`, `boat`. |
| `lib/jelajah/three/water-level.ts` | `WATER_Y`, in its own module to avoid an import cycle. |
| `lib/jelajah/engine/game-soon.ts` | Board size, canvas size and collider of the "Game segera hadir" sign. |
| `lib/jelajah/engine/illustration.ts` | Derives the 2d header picture from the scene data. |
| `lib/jelajah/stamps.ts`, `components/jelajah/ProvinceStamp.tsx` | Per-province Paspor stamp designs and the SVG that draws them. |
| `tests/jelajah/sumatera-selatan-identity.test.ts` | Sumatera Selatan fingerprints, recorded on `main`. |
| `tests/jelajah/scene-variants.test.ts` | The new engine options. |
| `tests/jelajah/province-scenes.test.ts` | Invariants for every scene, plus per-province checks. |
| `tests/jelajah/enterable-provinces.test.tsx` | Registry, routes, gate, map, card, stamps, Paspor and 2d game cards. |
| `tests/games/game-links.test.ts` | The per-game links and allowlist. |

Frontend, modified files:

| File | Why |
|---|---|
| `lib/jelajah/scenes/types.ts` | New optional fields: `waterStyle`, house `style`/`stiltDepth`/`stairs`, pavilion `style`, `game: JelajahGame`, `structures`, `gameSoon`, `fog`. |
| `lib/jelajah/scenes/index.ts` | Registers the 4 new scenes. |
| `lib/jelajah/three/village-geometry.ts` | Sea and no-water ground, stilts into the water, optional stairs, roof style switch, pavilion styles (`arena`, `meunasah`, `joglo`), the sign post, structures, sea water. |
| `lib/jelajah/three/canvas-textures.ts` | `createNoticeTexture` for the sign text. |
| `lib/jelajah/engine/collision.ts` | Pavilion colliders per style, sign and structure colliders, appended after the existing ones. |
| `components/jelajah/three/VillageScene3D.tsx` | Per-scene fog and far plane, optional water mesh, the sign's text plane. |
| `components/jelajah/GamePrompt.tsx` | Takes the game (label, icon, href); adds `GameSoonCard`. |
| `components/jelajah/ProvinceExperience.tsx` | Game from the pavilion, the "soon" card on 2d, the screen-reader list. |
| `components/jelajah/ProvinceScene2D.tsx` | Illustration drawn from the scene's look. |
| `lib/games/congklak/from-link.ts`, `lib/games/gasing/from-link.ts` | Thin wrappers over `links.ts`; each game page allowlists only its own provinces. |
| `lib/jelajah/provinces.ts` | Five `ENTERABLE_PROVINCES`, plus `enterableByKode` and `markerLabel`. |
| `lib/jelajah/map-model.ts`, `lib/jelajah/palette.ts` | Every enterable province is clickable and gets the soft colour while it has no PROT. |
| `components/jelajah/Map3D.tsx`, `Map2D.tsx` | One marker per enterable province ("★ Pilot" / "★ Desa"). |
| `components/jelajah/ProvinceCard.tsx` | "Masuk" for every enterable province, with a "Desa virtual" badge. |
| `components/jelajah/JelajahHub.tsx` | List badges and a legend line for the markers. |
| `components/jelajah/PasporModal.tsx` | Shows a stamped province's own stamp. |
| `components/jelajah/RewardHud.tsx` | The stamp design as the icon of the simulated stamp toast. |
| `tests/jelajah/pavilion.test.ts` | Per-game allowlist equals the scene data; every scene has a pavilion game or a sign. |
| `tests/jelajah/map-model.test.ts` | Aceh is clickable now; uses a non-enterable code for the negative case. |
| `tests/games/gasing-components.test.tsx` | The gasing back link is allowlisted for Kepulauan Riau, not Sumatera Selatan. |
| `CLAUDE.md` | New section "More provinces (Phase 22)", updated Jelajah, Games and Gasing text, shared sections. |

Backend: `CLAUDE.md` (shared sections), `docs/phase-reports/phase-22.md` (this report).

## 4. Decisions

- **Engine extensions are all optional.** Each new field defaults to the Phase 11–17 behaviour, and the existing code
  paths stay as they were. A fingerprint test (sha256 of the merged mesh, water for both tiers, colliders, camera frame
  points and the scene object, recorded on `main` before any change) guards Sumatera Selatan.
- **Three stands per new province.** The published PROT goes on stand 1, the stand nearest the spawn point. The other
  two say "Segera hadir" and fill automatically when more PROT are published, as in the pilot.
- **No new assets.** Coconut palms, bamboo, rocks, canoes (sampans) and the rest come from the existing Nature Kit
  `nature.glb`. All buildings and landmarks are procedural code. Every province loads the same two asset URLs.
- **Scene files are self-contained.** Each keeps its own ~20 lines of helpers (`facing`, `round`, `ringStand`, `seeded`).
  The budget script loads scene files with Node type stripping, so a shared value import would need `.ts` import
  extensions and a tsconfig change.
- **Distant landmarks are placed within view.** The fixed 40° camera never shows the horizon: from the spawn point,
  portrait phones see about 95 m ahead and desktop/landscape about 45 m (computed with `frameCamera`). So the islands,
  hills and the Jawa Tengah volcano stand 50–95 m from the camera, inside the fog's middle range. They show at the top of
  portrait views and when walking to the north edge.
- **Gasing arena layout.** The shade is a lean-to shelter with a bench north of the ring, not a roof over it, so the
  ring stays visible from the camera. The collider covers the ring and the shelter.
- **The "Game segera hadir" board leans back 0.35 rad** so it reads from the 40° camera. It sits next to stand 1, on the
  side of the entrance path.
- **Markers:** "★ Pilot" stays for Sumatera Selatan; the new provinces get "★ Desa". The card badge says "Desa virtual".
- **Hall roof turned.** The Aceh open hall's gable roof is turned so the decorated gable faces the camera. With the
  ridge across, it looked like a block.
- **Stamp toast duration.** The simulated stamp toast stays 3.6 s instead of 2.6 s, so the stamp icon can be seen.

## 5. Deviations

- **Volcano visibility.** The volcano is not a full "distant silhouette" on desktop. The camera never shows the horizon,
  so on desktop and landscape views it appears only when the player walks to the north edge. Portrait phones show its
  slopes at the top of the view.
- **No `.mp4` recording.** There is no ffmpeg under `D:/tools/ffmpeg`, so only the `.webm` was made, with Playwright's
  own VP8 recorder.
- **Two pavilion shots re-taken.** The scripted walk in Sumatera Selatan (844x390 and 1440x900) stopped just short of
  the pavilion. The route was lengthened and all Sumatera Selatan shots were re-taken; all three views now show "Main
  Congklak".
- **The Step 1 screenshot comparison is not pixel-identical** in the player's box, because the idle animation is at a
  different phase in each run. Two runs of the same build differ in the same box by the same amount. The 2d tier is
  identical (0 px).

## 6. Verification

Commands, run with `TEMP/TMP/TMPDIR=D:/dev-cache/tmp`. The builds used placeholder Supabase values, with
`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329`.

| Command | Result |
|---|---|
| `pnpm test` | exit 0: **67 files, 858 tests passed**, 0 failed, 0 skipped. Before the phase: 64 files, 785 tests. |
| `pnpm exec tsc --noEmit -p .` | exit 0, no output |
| `pnpm lint` | exit 1 as before: **44 errors, 80 warnings**, the unchanged baseline |
| `pnpm exec eslint <41 new and touched .ts/.tsx>` | exit 0, no problems |
| `pnpm check:jelajah` | exit 0. aceh, jawa-tengah, kepulauan-riau, sulawesi-selatan and sumatera-selatan each: 2 asset files, 195.6 KB (limit 8 MB); 1 texture 512x512 |
| `pnpm build` | exit 0, compiled in 20.1 s; `/jelajah/[provinsi]` prerendered for all five slugs |
| Archive re-check `GET https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&limit=100&page=1` | 200, `total` 5 (table in Section 8) |

Browser checks ran against a local production build (`next start -p 3101`). They used the scratch login harness from
earlier phases: a fake Supabase auth endpoint on localhost and a session cookie, files on D: only. The Authorization
header was removed on `/backend-api`, so production saw only public read-only GETs (the published PROT list, the
provinces, and the public S3 photos through the image optimizer).

- **Screenshots:** 90 PNGs in `D:/dev-cache/screens/phase-22/<slug>/<tier>-<WxH>-<shot>.png`. That is 5 provinces ×
  (overview, PROT popup, pavilion or sign) × 390x844, 844x390, 1440x900 × full and 2d. Every shot is "ok" with no page
  errors.
  - PROT panel opened in all 24 cases (4 provinces × 3 viewports × 2 tiers). Sumatera Selatan has 0 published PROT, so
    there it shows the "Segera hadir" stand prompt.
  - "Main Gasing" prompt in all 3 Kepulauan Riau views; "Main Congklak" in all 3 Sumatera Selatan views; the sign in
    the other three provinces.
- **Recording:** `D:/dev-cache/screens/phase-22/map-kepri-gasing-back.webm` (2.3 MB, 1280x720, ~23 s). Timeline: map 5.4
  s → Kepulauan Riau card 6.9 s → village 11.2 s → at the arena 14.8 s → gasing page 19.1 s → back in the village 22.9 s.
- **Sumatera Selatan identity:** the fingerprint test passes. Screenshot diffs (pixels differing by more than 24, before
  vs after Step 1):

  | View | Pixels | Where |
  |---|---|---|
  | full 390x844 | 685 | the player's box |
  | full 1440x900 | 890 | the player's box |
  | lite 1440x900 | 123 | the player's box |
  | 2d 390x844 | 0 | — |
  | same build twice, full 390x844 | 695 | the same box |

**Disk:** before, C: 13 GB free and D: 336 GB free; after, C: 13 GB and D: 336 GB. Every cache, build, profile,
screenshot and video is on D:.

## 7. Manual checks

On the Vercel preview of the frontend branch, logged in:

1. **Map.** Open `/jelajah`. Five provinces carry a marker: "★ Pilot" on Sumatera Selatan, "★ Desa" on Aceh, Kepulauan
   Riau, Jawa Tengah and Sulawesi Selatan. The legend has a "Desa virtual: bisa dimasuki" line. Jawa Barat has PROT
   colour but no marker, and its card has no "Masuk".
2. **Aceh.** Tap the Aceh marker, then "Masuk". You should see a warm, dry village: dark timber long houses on tall
   stilts, red decorated gables, palms, and a raised open hall in the plaza.
   - Walk to the stand labelled "SEPANGKAL" (right of the entrance path) and press "Lihat" (or E). The panel shows the
     photo, "Cara bermain" and the link to the archive page. Toasts show +10 XP and the Aceh stamp (a palm) for +50 XP,
     labelled "Simulasi · tidak disimpan".
   - The "Game segera hadir" board stands next to that stand. Nothing is clickable on it.
3. **Kepulauan Riau.**
   - Enter from its marker. You should see the sea, a beach, a jetty with stilt houses in the water and sampans.
   - Walk straight north to the ring in the plaza: "Paviliun permainan · Main Gasing" appears. Tap it: `/main/gasing`
     opens, with "Kembali ke desa". Play a round if you like, then tap "Kembali ke desa": you are back in the Kepulauan
     Riau village.
   - The "Gasing" stand (right) opens the Gasing archive record. The stamp shows a spinning top above waves.
4. **Jawa Tengah.** You should see a pendopo with a stepped roof, white houses with terracotta roofs, bamboo groves, and
   rice terraces behind. On a phone held upright, the volcano shows at the top of the view; on a computer, walk north to
   see it. Open "Egrang Bambu". The board says "Game segera hadir".
5. **Sulawesi Selatan.** You should see a large sailing boat on the beach, raised houses with tiered gables and crossed
   timbers, and palms. Open "Egrang Batok". The board says "Game segera hadir".
6. **Sumatera Selatan.** It looks exactly as before. The pavilion still says "Main Congklak", and the game's "Kembali
   ke desa" returns there.
7. **Paspor.** After visiting, the Paspor lists the stamped provinces first, each with its own coloured stamp.
8. **2d view.** Switch "Tampilan" to "Peta 2D" in each village. You should see a province-specific picture at the top,
   "Main Gasing" (Kepulauan Riau) or "Game segera hadir" (the others, no button), and the PROT card that opens the same
   panel.
9. **Real devices.** On a phone, add `?debug=1` to a village URL and note the fps for each province.

## 8. Findings

**Published archive, re-checked on 2026-11-20** (unchanged since Phase 20):

| Province | Record | Photos | id |
|---|---|---|---|
| Aceh (11) | SEPANGKAL (Aceh Singkil) | 2 | `752aeea4-…` |
| Kepulauan Riau (21) | Gasing (Natuna) | 3 | `5ed247fd-…` |
| Jawa Tengah (33) | Egrang Bambu (Magelang) | 4 | `e32ed727-…` |
| Sulawesi Selatan (73) | Egrang Batok (Soppeng) | 3 | `a6ce0739-…` |
| Jawa Barat (32) | Test Permainan Jawa Barat | 1 | no scene, as instructed |

`deskripsi` is null on all five records. Sumatera Selatan still has 0 published PROT.

**Frame rate.** Measured in headless Chrome with software rendering (SwiftShader) and 4x CPU throttling, over 4 s
standing plus 4 s walking. These are comparisons between provinces, not real-device values.

| Province | Full, phone 390x844 dpr 2 | Full, desktop 1440x900 | Lite, phone | Lite, desktop | Draw calls / triangles (full, desktop) |
|---|---|---|---|---|---|
| Sumatera Selatan (reference) | 15.5 | 13.7 | 32.2 | 20.5 | 45 / 18.7k |
| Kepulauan Riau | 16.4 | 13.2 | 33.9 | 20.0 | 34 / 16.0k |
| Aceh | 16.0 | 13.5 | 34.2 | 20.6 | 33 / 17.4k |
| Jawa Tengah | 13.1 | 12.1 | 27.4 | 18.3 | 30 / 17.3k |
| Sulawesi Selatan | 17.5 | 13.0 | 34.9 | 18.8 | 33 / 13.6k |

Every new province uses fewer draw calls and triangles than the pilot. The frame rates are within about ±10 % of the
pilot, except Jawa Tengah, which is about 15 % slower on the lite phone run. Its volcano and terraces cover a large part
of the screen, which software rendering pays for.

**Cold load** (production build, cache off, after the scene is ready):

| Page | Phone 390x844 dpr 3, full | Desktop 1440x900, full | Phone, 2d |
|---|---|---|---|
| Sumatera Selatan | 757.7 KB | 770.0 KB | 434.3 KB |
| Kepulauan Riau | 759.2 KB | 771.6 KB | 451.9 KB |
| Aceh | 758.6 KB | 770.9 KB | 417.9 KB |
| Jawa Tengah | 758.8 KB | 771.2 KB | 423.7 KB |
| Sulawesi Selatan | 759.1 KB | 771.4 KB | 420.4 KB |
| `/jelajah` (map) | — | 706.0 KB | — |

The 2d numbers include the PROT thumbnails. The two `.glb` files transfer as 74.2 KB compressed (195.6 KB on disk).
The PROT photo in the panel loads only when the panel opens. three.js loads only on the two `/jelajah` routes and never
on the 2d tier.

**Assets per province:** 195.6 KB, the same shared files; the budget is 8 MB.

## 9. Out-of-scope observations

- **Toast overlaps the panel on landscape phones.** At 844x390, the reward toast covers the top of the PROT panel
  (title and close button) for its 2.6–3.6 s. The Phase 13 toast clearance measures the overlays before the panel
  opens. This existed before Phase 22.
- **Local dev server errors.** The dev server on another port calls a backend on `localhost:3000` that answered 500
  and CORS errors in this session. This is local setup only; production builds use `/backend-api`.

## 10. Open questions

1. **Building hints.** Are the loose hints (Rumoh Aceh-style houses, a meunasah-like hall, a joglo-style pendopo,
   timpa laja tiers, a pinisi-like boat) acceptable as "terinspirasi" shapes? Should a curator look at them before
   production?
2. **Bumper.** Should the bumper show both games? The suggested way is one button per game, side by side, as described
   in CLAUDE.md "More provinces (Phase 22)".
3. **Volcano on desktop.** A real silhouette would need a camera change (a flatter pitch or a backdrop layer), which
   affects every province. Is that wanted?
4. **Jawa Barat.** It will get a scene once a real record is published there. Should the test record be unpublished
   meanwhile? It still colours the map and counts in the statistics.

## 11. Ready for next phase?

Yes. Every step is committed on `phase-22-more-provinces` in both repos (not pushed). The boss can review it on the
Vercel preview with the checklist in Section 7.
