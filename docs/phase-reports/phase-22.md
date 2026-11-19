# Phase 22: More Jelajah provinces — Aceh, Kepulauan Riau, Jawa Tengah, Sulawesi Selatan (+ multi-game pavilions, Gasing in Kepri)

> Draft written in Step 0 (plan only). The sections below are completed at the end of the phase.

## Step 0 — Preflight, reading, archive re-check and plan

### Preflight

- Phase 21 is merged in both repos: backend `main` = `origin/main` = `309317d` (contains `phase-21-concept-audio`),
  frontend `origin/main` = `6df8fe7` (merge of PR #19, `phase-21-concept-audio`). The local frontend `main` was
  fast-forwarded to it.
- Branches `phase-22-more-provinces` created in both repos from those commits.
- Disk: C: 13 GB free, D: 336 GB free.
- No `D:/tools/ffmpeg` on this machine: the Step 7 recording will be `.webm` only.

### How it works today (read)

- **Scene engine**: a province is one data file in `lib/jelajah/scenes/` (`SceneDefinition`: ground, river, plaza,
  paths, spawn, walkable rectangle, houses, stands, decor, colours, optional `centrepiece`), registered in
  `scenes/index.ts`. `lib/jelajah/three/village-geometry.ts` merges ground, plaza, paths, river banks, the procedural
  houses ("terinspirasi rumah limas"), the stands and the centrepiece into ONE vertex-coloured mesh; water is a second
  mesh; Nature Kit models are instanced. Scene files may only use `import type` (the budget script imports them with
  Node type stripping).
- **Enterability**: `ENTERABLE_PROVINCES = [PILOT_PROVINCE]` (`lib/jelajah/provinces.ts`) drives
  `generateStaticParams` of `/jelajah/[provinsi]` (`dynamicParams = false`), the hub's Misi list and nothing else; the map
  (`map-model.ts isClickable`, `palette.ts`, `Map3D`/`Map2D` "★ Pilot" marker, `ProvinceCard` "Masuk") only knows
  `PILOT_PROVINCE`. `KNOWN_PROVINCES` has all 35 codes.
- **PROT objects**: `assignStands` puts the province's ARSIP_NASIONAL PROT (name order) on the stands; `StandPrompt`
  → `StandPanel` (ProtPhoto, "cara bermain" text, link to `/prot/<id>`); simulated rewards `enterProvince`
  (PROVINCE_ENTER +25), `openProt` (PROT_VIEW +10, PASPOR_STAMP +50 at min(3, count) opened).
- **Pavilion**: `PavilionDef.game?: 'congklak'`; `engine/pavilion.ts nearestTarget()`; `GamePrompt` / `GameCard`
  hard-code "Main Congklak"; `ProvinceExperience` builds `congklakHref('jelajah-<slug>')`;
  `GAME_LINK_PROVINCES = ['sumatera-selatan']` in `lib/games/congklak/from-link.ts`, which the gasing page re-exports
  (so `from=jelajah-<slug>` is allowlisted for both games alike).
- **Budget**: `pnpm check:jelajah` sums each scene's `assets` (8 MB limit) and checks every texture (≤ 1024 px). Today:
  `nature.glb` 100.1 KB + `player.glb` 95.5 KB = 195.6 KB.

### Archive re-check (production, read-only GET `/api/prot?status=ARSIP_NASIONAL&limit=100&page=1`, 2026-11-20)

`total` 5, one page. Every record has `deskripsi: null` (the panel shows `caraBermain`).

| Province (kode) | Record | Kabupaten | id | Photos (https, S3 `/prot/`) |
|---|---|---|---|---|
| Aceh (11) | SEPANGKAL | Aceh Singkil | `752aeea4-a9c4-455b-a216-71f508bcfe3c` | 2 |
| Kepulauan Riau (21) | Gasing | Natuna | `5ed247fd-e45b-4308-bfbe-74c49fbb6557` | 3 |
| Jawa Barat (32) | Test Permainan Jawa Barat | — | `202e5330-08ec-4b12-b34a-be5a8a1428cf` | 1 (no scene, as instructed) |
| Jawa Tengah (33) | Egrang Bambu | Magelang | `e32ed727-4455-434e-b1b1-b984413e9f24` | 4 |
| Sulawesi Selatan (73) | Egrang Batok | Soppeng | `a6ce0739-bcb5-43ae-9e13-0ea74d7b8f3f` | 3 |

Same five records as Phase 20. Sumatera Selatan still has 0 published PROT (its stands stay "Segera hadir").

### Plan

**Engine (Step 1), all additions optional so the Sumatera Selatan data and output do not change** (proved by a
fingerprint test recorded on `main` before any change: merged mesh, water, colliders, camera framing points and scene
data hashes; plus before/after screenshots):

- `SceneDefinition.waterStyle?: 'river' | 'sea' | 'none'` (default `river`). `sea`: water from the shore to the
  horizon, a sand beach, no far bank. `none`: one ground plane, no water mesh (one draw call less).
- `HouseDef.style?: 'limas' | 'aceh' | 'malay' | 'bugis'` (default `limas`, today's roof), `stiltDepth?` (posts reach
  into the water) and `stairs?` (default true).
- `PavilionDef.style?: 'pavilion' | 'arena' | 'joglo' | 'meunasah'` (default `pavilion`, today's).
- `PavilionDef.game?: JelajahGame` with `JelajahGame = 'congklak' | 'gasing'`; one map of label + `gameHref(game, from)`
  in `lib/games/links.ts`, icons in `GamePrompt`; `GAME_LINK_PROVINCES` keyed per game, and each game page allowlists
  only its own provinces (`backLinkFor(from, game)`).
- `SceneDefinition.structures?`: procedural landmarks merged into the village mesh (0 extra draw calls): `jetty`,
  `pinisi` (boat), `volcano` (distant cone), `terraces` (stepped rice fields).
- `SceneDefinition.gameSoon?`: a small sign board "Game segera hadir" next to the PROT stand (post in the merged mesh,
  text as one canvas sprite like the stand signs). A test: every scene has either a game pavilion or this sign.
- `SceneDefinition.fog?` (default today's 34–80 m) so a distant silhouette can show through the haze.
- Every new scene file stays self-contained (`import type` only), so `check:jelajah` keeps loading it.

**Per province** (metres; camera looks north from the spawn point at z ≈ 15; 3 stands each: the province's one PROT on
stand 1, the stand nearest to the spawn point, the other two "Segera hadir" until more PROT are published):

| | Kepulauan Riau (Step 2) | Aceh (Step 3) | Jawa Tengah (Step 4) | Sulawesi Selatan (Step 5) |
|---|---|---|---|---|
| Layout | Malay coastal kampung: beach along the north, the sea to the horizon; a jetty from the beach north with walkways to 3 stilt houses standing in the water; 1 house on land | Dry-season village: 3 long timber houses on tall stilts around a packed-earth plaza, no water | Pendopo in a large plaza, rice terraces stepping up behind it (north), a volcano silhouette in the haze, bamboo groves at the sides | Coastal Bugis village: wide beach, sea to the north, a pinisi-like boat drawn up on the sand (west), 3 rumah panggung |
| Landmarks | jetty, sampans (Kenney canoe), Gasing arena | meunasah-like open hall (raised, steep gable roof, no walls) | joglo-style pendopo (stepped three-tier roof on 16 posts), terraces, volcano | pinisi (hull, two masts, sails), crossed-gable "timpa laja" hints on the houses |
| Houses | `malay` (gable roof, crossed ridge ends, pastel walls, white trim), 3 with `stiltDepth` over the water | `aceh` (steep gable, decorated gable panels, dark timber) | `limas` roof on a low plinth (white plaster walls, terracotta roof) | `bugis` (gable facing the front with stacked tiers, crossed timbers at the apex) |
| Centre | Gasing pavilion `arena`: packed-earth ring with a low log rim under an open shade roof, `game: 'gasing'` | meunasah (no game) | pendopo (no game) | none (open plaza) |
| PROT object | "Gasing" on stand 1 (east of the arena) | "SEPANGKAL" on stand 1 | "Egrang Bambu" on stand 1 | "Egrang Batok" on stand 1 |
| Game | "Main Gasing" at the arena → `/main/gasing?from=jelajah-kepulauan-riau` | "Game segera hadir" sign beside stand 1 | same | same |
| Palette | bright sky `#CFE8F0`, turquoise sea, pale sand, green grass | warm haze `#EED9B4`, dry olive grass, dark timber, thatch brown | soft haze, lush green, white walls, terracotta | warm coast `#F3DCB8`, deep blue sea, dark timber, cream sails |
| Decor (Kenney, already in `nature.glb`) | palms on the beach, canoes, rocks, bushes | many coconut palms, dry grass, log stacks, fences, rocks | bamboo clumps, oak/default trees, bushes, flowers | coconut palms, canoes on the sand, rocks, log stacks |

**Assets**: no new files. Every province uses the existing CC0 `v1/nature.glb` and `v1/player.glb` (shared URLs, so
the browser cache serves them for every province after the first); everything new is procedural code. Estimated
per province: 195.6 KB of assets (budget 8 MB), cold load like Sumatera Selatan (≈ 0.73–0.76 MB) plus a few KB of
code and scene data.

**Map and pages (Step 6)**: `ENTERABLE_PROVINCES` = the five scenes (a test keeps it equal to the scene registry);
every enterable province is clickable and marked on both maps ("★ Pilot" for Sumatera Selatan, "★ Desa" for the
others), its card has "Masuk"; the hub list badges them. `/jelajah/<slug>` for the four new slugs comes from
`generateStaticParams` (still login-gated by `middleware.ts`; province pages never play the concept film or the
bumper). Passport stamps: one code-drawn SVG design per enterable province (`lib/jelajah/stamps.ts` +
`components/jelajah/ProvinceStamp.tsx`), shown in the Paspor and in the stamp toast. 2d tier: a per-province
illustration header, the PROT cards, and the game card ("Main Gasing") or a "Game segera hadir" card without a button.
