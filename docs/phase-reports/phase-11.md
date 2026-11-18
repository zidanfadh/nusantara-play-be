# Phase 11 (Visual track V2): the Sumatera Selatan village scene

> **Production still has 0 public PROT in Sumatera Selatan.** The scene was built to look intentional when empty: all
> 6 stands show "Segera hadir", and they fill automatically when real PROT (status ARSIP_NASIONAL, provinsi 16) are
> published. Locally the 4 labelled DEMO PROT fill stands 1 to 4.

## 1. Summary

`/jelajah/sumatera-selatan` is no longer a placeholder. It is now a small walkable riverside village. It has a river strip
in the north, three procedural raised houses ("terinspirasi rumah limas"), CC0 low-poly trees, plants, rocks and props
(Kenney Nature Kit), and a CC0 rigged player character (Kenney Mini Characters, idle and walk only). Six procedural
wooden PROT stands stand around a central plaza. You walk with an on-screen joystick on touch devices or with
WASD/arrows on desktop. The camera follows at a fixed pitch, and simple colliders keep the player out of houses and
stands. Within 2 m of a stand with a PROT, a "Lihat" button opens a side panel (a bottom sheet on phones) with the PROT
name, its first photo, a short description, cara bermain and a link to `/prot/[id]`. The scene is data-driven
(`lib/jelajah/scenes/`), so later provinces reuse the engine. The lite tier is lighter, and the 2d tier shows a header
plus PROT cards without three.js. Cold load: 0.74 to 0.97 MB (3D) and 0.39 MB (2d), against an 8 MB budget. Assets
total 195.6 KB. The dev overlay shows 43 draw calls / 17.7k triangles (full tier). The phase was interrupted by a usage
limit and resumed (see 5). **The phase is complete.** Not yet verified: the frame rate on a real phone (see 7 and 10).

## 2. Git

**Frontend** (`nusantara-play-fe`), branch `phase-11-jelajah-sumsel`, base `6a2ef8c` (main, merge of Phase 10).

| Commit | Step |
|--------|------|
| `2010e4d` | 2: CC0 assets (Kenney Nature Kit, Mini Characters), optimize and budget scripts, scene data model and layout, `@gltf-transform/cli` |
| `6476d3c` | 3 + 4: walkable scene, stands, panel, overlays, joystick, colliders, lite and 2d tiers, tests |
| `f81afd6` | 3 (follow-up, after the resume): player silhouette behind roofs and houses |
| `dba5839` | 6: CLAUDE.md (scene engine, CC0 rule, Jelajah V2, decisions, lint baseline) |

`git diff --stat main..HEAD`: 35 files changed, 4437 insertions(+), 176 deletions(-). Without `pnpm-lock.yaml`:
34 files, 3222 insertions, 170 deletions.

**Backend** (`nusantara-play-be`), branch `phase-11-jelajah-sumsel`, base `a7713a0` (main, Phase 10 report).

| Commit | Step |
|--------|------|
| `05bab63` | 1: 4 DEMO PROT in Sumatera Selatan in `db-local-setup.ts` |
| (docs commit, hash in the final message) | 6: CLAUDE.md shared sections + this report |

`git diff --stat main` before the docs commit: `src/scripts/db-local-setup.ts` (+46 −2) and `CLAUDE.md`. Nothing is pushed.

## 3. Changes

**Frontend, new**
- `lib/jelajah/scenes/types.ts`: the `SceneDefinition` data model (assets, ground, river, plaza, paths, spawn, walkable rectangle, houses, stands, decor with colliders and `detail` flags, colours).
- `lib/jelajah/scenes/sumatera-selatan.ts`: the Sumatera Selatan layout (river north, 3 houses, 6 stands on a ring around the plaza, decor, warm late-afternoon colours).
- `lib/jelajah/scenes/index.ts`: scene registry, `findScene(slug)`.
- `lib/jelajah/engine/stands.ts`: stand assignment (empty / up to 6 / notice board when more than 6) and proximity (2 m from the stand footprint).
- `lib/jelajah/engine/collision.ts`: circle and turned-box colliders, walkable rectangle, push-out movement with sliding.
- `lib/jelajah/engine/input.ts`: joystick → direction (dead zone, clamping) and keys → direction.
- `lib/jelajah/engine/scene-prot.ts`: a province's public PROT → plain-text panel data (https photos only, shortened texts).
- `lib/jelajah/engine/help-hint.ts`: controls hint shown once (localStorage with try/catch).
- `lib/jelajah/three/village-geometry.ts`: ground, plaza, paths, banks, procedural houses and stands merged into one vertex-coloured mesh.
- `lib/jelajah/three/model-bake.ts`: Nature Kit models baked to vertex colours for instancing.
- `lib/jelajah/three/canvas-textures.ts`: stand sign sprites and the blob shadow texture (canvas).
- `components/jelajah/ProvinceExperience.tsx`: client page body (data, tiers, Demo label, back button, help hint, loading screen with progress, Lihat button, panel, screen-reader stand list); loads the 3D scene with `next/dynamic`, `ssr: false`.
- `components/jelajah/three/VillageScene3D.tsx`: the R3F scene (lights, instanced decor, water, signs, player, follow camera, collisions, proximity, silhouette pass).
- `components/jelajah/three/StatsProbe.tsx`: dev-only fps / draw calls / triangles probe and overlay, shared with the hub.
- `components/jelajah/ProvinceScene2D.tsx`: 2d tier (illustrated header + PROT card grid, same panel).
- `components/jelajah/StandPanel.tsx`: side panel / bottom sheet, Esc and close button, focus return, lazy photo.
- `components/jelajah/Joystick.tsx`: on-screen joystick (pointer events).
- `components/jelajah/WebGLBoundary.tsx`: falls back to 2d if WebGL throws (shared with the hub).
- `public/jelajah/assets/v1/nature.glb` (100 KB, 28 Nature Kit models in one file) and `player.glb` (96 KB): meshopt, WebP textures.
- `public/jelajah/assets/ASSET_LICENSES.md`: both packs with author, source, CC0 licence (checked in each pack's `License.txt`) and the files used.
- `scripts/optimize-jelajah-assets.mjs` (`pnpm jelajah:assets`): rebuilds `v1/` from the packs on D:.
- `scripts/check-jelajah-budget.mjs` (`pnpm check:jelajah`): 8 MB per scene, textures at most 1024 px (also inside .glb).
- `tests/jelajah/scene-engine.test.ts` (21 tests), `scene-prot.test.ts` (7), `budget-check.test.ts` (8).

**Frontend, modified**
- `app/jelajah/[provinsi]/page.tsx`: renders `ProvinceExperience` instead of the placeholder.
- `components/jelajah/JelajahHub.tsx`, `components/jelajah/Map3D.tsx`: use the shared `StatsProbe` / `WebGLBoundary` (no behaviour change).
- `lib/jelajah/data.ts`: `RawProt` also types `deskripsi` and `caraBermain` (read by the panel).
- `tests/jelajah/three-isolation.test.ts`: the three zone now includes `components/jelajah/three/*`; `VillageScene3D` may only be loaded with `next/dynamic` and `ssr: false`; the 2d views never import three.
- `package.json`: dev dependency `@gltf-transform/cli` 4.5.1; scripts `jelajah:assets` and `check:jelajah`.
- `pnpm-lock.yaml`: the new dev dependency (still `lockfileVersion: '9.0'`).
- `CLAUDE.md`: "Province scene engine (Phase 11)" section, isolation rule, shared sections (see below).

**Frontend, deleted**
- `components/jelajah/ProvincePlaceholder.tsx`: replaced by the scene (its role is now `ProvinceExperience` + `ProvinceScene2D`).

**Backend**
- `src/scripts/db-local-setup.ts`: 4 DEMO PROT "DEMO PROT Sumsel 1" to "4" (fixed UUIDs `…de31` to `…de34`, provinsi 16, kab/kota 16.71, 16.01, 16.10, 16.74, ARSIP_NASIONAL, text "Contoh data untuk pengembangan, bukan data budaya asli.", no photos), idempotent like the existing DEMO data.
- `CLAUDE.md`: shared sections (identical in both repos): Jelajah V2 in "Current direction", DEMO Sumsel data in "Local development", lint baseline, decisions log.
- `docs/phase-reports/phase-11.md`: this report.

## 4. Decisions

- **Packs:** Kenney Nature Kit 2.1 (trees, palms, bamboo, bushes, grass, flowers, rocks, fences, logs, pots, canoe,
  lilies) and Kenney Mini Characters 2.0 (`character-male-a`, about 690 triangles, idle and walk kept). Both are CC0
  according to the `License.txt` in each pack. Kenney Survival Kit was also downloaded for evaluation but not used, and is
  not in the repo.
- **One merged mesh for the village:** ground, plaza, paths, banks, houses and stands are generated together into one
  vertex-coloured geometry (1 draw call). Nature Kit models are baked to vertex colours, so each model type is one
  `InstancedMesh` with one material. Signs are canvas sprites, one per stand.
- **Stand order:** PROT are sorted by name, then assigned to stands 1 to 6. With more than 6, stands 1 to 5 get a PROT
  and stand 6 becomes the notice board listing the rest.
- **Interaction distance** is measured from the stand footprint, not its centre, so the 2 m feels the same from every side.
  `E` (or Enter on the canvas) also opens the panel on desktop.
- **Panel texts** are shortened (description 280, cara bermain 420 characters, at a word boundary); the full text is on
  `/prot/[id]`. Only https photo URLs are shown, lazy loaded.
- **The 3D scene keeps one warm look** in both site themes; the overlays and the panel follow the theme.
- **Player silhouette (added at the resume):** with a fixed camera that looks north, the player disappears behind a
  roof when walking north of a house. A copy of each skinned mesh draws a flat warm colour only where it is behind the
  depth buffer (`GreaterDepth`). The render order is scene 0 → silhouette 1 → player 2, so the silhouette never tints the
  player's own body (a first attempt, drawing it after the player, did). Cost: +2 draw calls.
- **Assets folder is versioned (`v1/`)**, so a later asset change can ship as `v2/` without stale caches.
- **Scene files may use only `import type`,** so the budget script can load them with Node's built-in type stripping (no
  extra tooling).

## 5. Deviations

- **The phase was interrupted by a usage limit and resumed.** The resume started with this checklist (Step R3), based on
  git, the databases, the scratch folder on D: and a fresh test and build run:

  | Step | State at the resume | Evidence |
  |---|---|---|
  | 0 Preconditions | DONE | both branches from current main (`6a2ef8c` / `a7713a0`), DB up and healthy |
  | 1 DEMO data | DONE | `05bab63`; the 4 rows in `nusantara_play_dev` and `nusantara_play_test` |
  | 2 Assets | DONE | `2010e4d`; `ASSET_LICENSES.md`, both scripts, lockfile 9.0 |
  | 3 Scene | DONE, one uncommitted fix | `6476d3c`; an unfinished silhouette edit in `VillageScene3D.tsx` |
  | 4 Tiers | DONE | in `6476d3c` |
  | 5 Verification | PARTLY | 5.2 and 5.3 done (measurement JSON from 18:05 and 18:08); 5.4 missing draw calls and triangles; 5.5 screenshots taken before the silhouette edit; 5.6 not done |
  | 6 Docs and report | NOT STARTED | — |

  Nothing was reset, stashed or deleted. The unfinished edit was kept, and fixed forward: its first version also tinted the
  player's own body. It was then committed (`f81afd6`). After that, Steps 5.1 to 5.6 were run again on the final code,
  and Step 6 was written.
- Steps 3 and 4 share one commit (`6476d3c`), because the tiers live in the same components.
- Allowed files: the changes stay inside the allowed paths. The only file outside "the scene page" itself that changed in
  `components/jelajah/` is the hub (`JelajahHub.tsx`, `Map3D.tsx`), to share the stats probe and WebGL boundary. That is
  inside the allowed folder.
- The DEMO PROT have no photo (the prompt allowed "no photos or one generic placeholder"), so the panel's photo slot is
  only exercised by the unit tests and the code path for real PROT.

## 6. Verification

Free space at the resume: C: 7.8 GB, D: 356 GB. At the end: C: 7.8 GB, D: 356 GB.

| Command | Exit | Result |
|---|---|---|
| `pnpm test` (frontend, final code) | 0 | 17 files, **213 passed**, 0 failed, 0 skipped (Jelajah: 101) |
| `npx eslint app/jelajah components/jelajah lib/jelajah scripts/*jelajah* tests/jelajah` | 0 | no problems |
| `pnpm lint` (frontend) | 1 | 131 problems (44 errors, 87 warnings) = baseline, unchanged |
| `npm run lint` (backend) | 1 | 249 problems (220 errors, 29 warnings) = baseline; `db-local-setup.ts` clean |
| `pnpm check:jelajah` | 0 | `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)`; `player.glb → colormap 512x512`; `check:jelajah OK` |
| `pnpm build` (placeholder Supabase values, `BACKEND_ORIGIN=http://localhost:3000`) | 0 | `✓ Compiled successfully`; `● /jelajah/[provinsi]` → `/jelajah/sumatera-selatan` |
| `pnpm build` (placeholder Supabase values, default production API origin) | 0 | same |
| `npm run db:setup` dev and test (before the interruption) | 0 | 4 Sumsel rows in both databases (checked again with `psql` at the resume) |
| `npm run test:e2e` (backend, before the interruption) | 0 | 7 suites, 53 passed, 2 skipped (the known events skips) |
| `head -1 pnpm-lock.yaml` | 0 | `lockfileVersion: '9.0'`; no new build-script approvals |

Build env: `NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key`.

**Local backend + production build on :3001 (DEMO data),** headless Chrome via CDP:
- Stands: `DEMO PROT Sumsel 1`, `2`, `3`, `4`, `segera hadir`, `segera hadir`.
- After walking to stand 4: `DEMO PROT Sumsel 4 · Lihat`. The panel shows `STAND PROT | DEMO PROT Sumsel 4 | Deskripsi | Contoh data untuk pengembangan, bukan data budaya asli. | Cara bermain | … | Lihat detail PROT`.
- Console clean on desktop, phone, 2d and the automatic tier (auto tier chose `full`).
- Keyboard check: a script for the help hint, `E` / Esc, focus return, keys ignored while the panel is open, and stand collision ran before the interruption. Its screenshots exist (`D:/dev-cache/tmp/phase-11/int-near.png`, `int-panel.png`, `int-collide.png`), but its console output was not kept, so it is **not counted as verified here**. The resume re-verified the walk → "Lihat" → panel path (above). The rest is covered by the unit tests and the manual checks in 7.

**Production API (read-only) + production build on :3001:** all 6 stands `segera hadir`. Near a stand: "Segera hadir.
Stand ini menunggu PROT dari Sumatera Selatan." Console clean.

**Cold-load transfer** (cache disabled, `/jelajah/sumatera-selatan`, budget 8 MB per province):

| Run | DEMO (local API) | Production API |
|---|---|---|
| desktop 3D (full) | 740 KB, 38 requests | 739 KB, 38 requests |
| phone 3D (full) | 775 KB, 41 requests | 972 KB, 37 requests |
| phone 3D (auto tier → full) | 727 KB | 743 KB |
| desktop 2d | 390 KB, three chunk not loaded | 391 KB, three chunk not loaded |
| phone 2d | 394 KB, three chunk not loaded | 373 KB, three chunk not loaded |

Largest files: three chunk 247 KB, `nature.glb` 43 KB and `player.glb` 33 KB transferred (gzip).

**Dev overlay** (`pnpm dev`, desktop 1440x900, DEMO data):

| Tier | Draw calls | Triangles |
|---|---|---|
| full, at spawn | 43 | 17.7k |
| full, beside a house | 40–42 | 17.3k–17.6k |
| lite, at spawn | 34 | 9.2k |

Budget: 100 draw calls, 100k triangles. The fps shown (6 to 21) comes from headless Chrome with SwiftShader software
rendering and says nothing about phones.

**Screenshots** (`D:/dev-cache/screens/phase-11/`; phone 390x844 at DPR 2, desktop 1440x900, all retaken on the final code):
- DEMO scene: `demo-phone-scene.png`, `demo-desktop-scene.png`
- Open panel: `demo-phone-panel.png` (bottom sheet; the player's silhouette shows behind stand 4's roof), `demo-phone-panel-dark.png` (dark site theme), `demo-desktop-panel.png` (side panel)
- Empty production state: `prod-empty-phone-scene.png`, `prod-empty-desktop-scene.png`, `prod-empty-phone-near-empty.png`, `prod-empty-desktop-near-empty.png`
- 2d tier: `demo-phone-2d.png`, `demo-desktop-2d.png`, `demo-phone-2d-panel.png`, `prod-empty-phone-2d.png`, `prod-empty-desktop-2d.png`, `prod-empty-phone-2d-panel.png`
- Silhouette behind a roof (dev): `dev-silhouette-behind-roof.png`
- Measurements: `demo-measure.json`, `prod-empty-measure.json`

## 7. Manual checks

Open the Vercel preview of `phase-11-jelajah-sumsel` at `/jelajah/sumatera-selatan`. On the preview it shows production
data, so every stand says "Segera hadir". To see filled stands, run it locally with the DEMO data (CLAUDE.md "Local development").

**Phone (iPhone 11 and a 4 GB Android, Chrome):**
1. Open the page. A loading screen with progress appears, then the village: river at the top, houses, palms, 6 stands
   around a sandy plaza, the player in front. The "Demo" label and a back arrow are at the top left.
2. A controls hint appears once. Tap "Mengerti". Reload: it does not appear again.
3. Drag the joystick at the bottom left. The player walks and turns, and stops at houses, stands and the edges.
4. Walk to a stand. You see "Segera hadir. Stand ini menunggu PROT dari Sumatera Selatan." (locally with DEMO data: a
   "Lihat" button, then a bottom sheet with name, description, cara bermain and "Lihat detail PROT").
5. Walk north behind a house. The player stays visible as a light silhouette.
6. Check that movement stays smooth (no stutter for 1 to 2 minutes of walking). Switch the site to dark mode: the panel follows.
7. "Tampilan" → 2D: a header with a grid of stand cards; tap a card to get the same panel. Switch back to automatic.

**Laptop (Chrome):**
1. Walk with WASD or the arrow keys. The page does not scroll.
2. Near a stand with a PROT, press `E` (or click "Lihat"). The side panel opens on the right; Esc closes it and focus goes back.
3. The back arrow returns to the `/jelajah` map. Other routes (`/`, `/prot`) load no three.js. In DevTools → Network,
   there is no large `_next/static/chunks/*.js` of about 250 KB on those routes.

## 8. Findings

- Asset budget: 195.6 KB of 8 MB (2.4 %). The whole 3D page cold-loads in under 1 MB, and three.js is the largest part.
- Draw calls and triangles stay far below budget (43 / 100 and 17.7k / 100k on the full tier). There is room for more
  decor or a second scene object later.
- Production data at test time: 0 public PROT in Sumatera Selatan, so the empty state is what the boss will see on the preview.

## 9. Out-of-scope observations

- Next.js 16 still warns that the `middleware` file convention is deprecated in favour of `proxy` (unchanged since Phase 10).
- The TLS certificate for `www.` hosts is still missing (Phase 10 finding, Vercel domain settings).
- Two dev servers from the interrupted session were still running at the resume (:3000 backend, :3001 frontend). They were stopped at the end.

## 10. Open questions

1. Frame rate on real devices: please confirm on the iPhone 11 and on a 4 GB Android phone that the scene feels smooth
   (target at least 30 fps). Headless measurements cannot show this.
2. Content: who will publish the first real PROT for Sumatera Selatan (provinsi 16), so the stands fill on the preview
   and in production?
3. Is the warm silhouette colour for the hidden player acceptable, or should it be the site's primary colour?

## 11. Ready for next phase?

Yes. The scene is complete and verified locally and against the production API. The only open item is the boss's review
on a real phone (Vercel preview), which does not block the next phase.
