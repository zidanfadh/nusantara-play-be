# Phase 28: Visual identity part 2, the low-poly "paper" map of Indonesia

> Draft after step 0 (preflight, reference, plan, baseline). The final report replaces this file at the end of the phase.

## 8. Findings

### 8.1 Preflight (step 0)

- Disk: C: 8.5 GB free, D: 337 GB free (limit C: 3 GB).
- Phase 27 "Visual identity refresh" is merged in both repos: FE PR #24 (`21cc5ba` on `origin/main`), BE `3375ae6`
  (`origin/main` = the phase branch). The local FE `main` was behind and was fast-forwarded.
- Phase number 28 (highest existing report `phase-27.md`). Branch `phase-28-visual-map` in both repos from
  `origin/main` (FE `21cc5ba`, BE `3375ae6`). The prompt says "visual-map" and the Phase workflow says
  `phase-XX-<slug>`; this name meets both (same as Phase 27).
- Design files (FE `docs/design/`, committed in Phase 27; the names differ from the prompt): `Referensi Peta
  Indonesia.png` (1920x1080) and `Konsep Visual.pdf` page 4 (rendered in Phase 27 to `D:/dev-cache/tmp/phase-27/pdf/page-4.png`).
- Page 4 text ("Visual Peta Indonesia"): "Visual peta bergaya 3D low-poly dipilih untuk membangun identitas visual yang
  konsisten dengan keseluruhan aset permainan Nusantara Legacy. Penggunaan bentuk pulau, elemen alam, dan kapal dengan
  gaya low-poly menghadirkan kesan playful dan eksploratif, sekaligus menjadi visual pembuka bagi pemain untuk
  menjelajahi berbagai provinsi dan mini game di dalamnya."

### 8.2 The reference (style only; the image is NOT shipped, traced or used as a texture)

- **Islands** are thick extruded slabs, like cut cardboard: the side walls are dark brown earth (sampled #443828,
  #5A4337 in the light, near-black brown in the shade), clearly thicker than a province is wide on small islands.
- **Tops** are faceted: large flat triangles in a few greens and yellow-greens next to each other (sampled #4C8832
  dark green, #6D9347 / #6BA03C mid green, #8CA751 olive, #D2C89E / #DDD093 pale yellow-green), so every island shows
  several tones; province borders are not drawn as lines, they show as subtle seams and colour changes.
- **Mountains**: grey-brown low-poly pyramids and cones with 5 to 7 faces, a lit face (#BBA894 / #CCBAA0) and a shaded
  face (#634F3E / #7B6756), clustered along the spines of Sumatra, Borneo, Sulawesi and Papua; a few **volcanoes**
  have a small grey puff of smoke.
- **Water on land**: thin blue rivers and small lakes (#5A928C), drawn as flat strips (Borneo, Sumatra, Papua).
- **Ships**: about six small low-poly sailing ships (pinisi-like: dark hull #5A4337, two masts, triangular pale sails
  #D1BEA9) on the paper between the islands.
- **No blue ocean**: the "sea" is warm cream paper (#FFEFD7 in the light to #EDDAC2 at the edges, a soft vignette),
  with a faint paper grain.
- **Shadows**: soft drop shadows fall to the lower right (light from the upper left).
- **Camera**: tilted perspective (roughly 40 degrees from straight down), the whole archipelago in frame.

### 8.3 Plan

Rules kept: three.js only in `Map3D.tsx`, `components/jelajah/three/*`, `lib/jelajah/three/*`; Map3D only through
`next/dynamic`; no new dependency, no binary assets (everything procedural); every behaviour of the current hub map kept.

1. **Geometry, colours, paper, shadows** (`lib/jelajah/paper-map.ts` pure: Douglas-Peucker simplification, tiny
   islets dropped but every province keeps its largest polygon, seeded hash, facet colours; `lib/jelajah/three/map-geometry.ts`
   rewritten: edges densified, interior edges subdivided so tops have real facets, small seeded height noise, one
   merged mesh with walls (gradient earth colours) and per-vertex kinds; lighting baked into the vertex colours, so the
   islands use the cheapest material; `lib/jelajah/three/paper.ts`: canvas paper texture with grain and vignette; the
   lite tier paints the blurred island shadow INTO the paper texture (no extra plane, no overdraw), the full tier uses
   one real shadow map that is re-rendered only when a province lifts). `lib/jelajah/palette.ts` gets the paper palette
   (light: cream paper, dark: brown paper). Tests: determinism, only Indonesian provinces, every province pickable.
2. **Nature** (`lib/jelajah/map-nature.ts`, data with sources: mountain ranges, volcanoes, rivers and lakes, ship
   loops): mountains and volcanoes merged into the province mesh (they lift with their province), smoke puffs and
   ships as one InstancedMesh each, ambient motion at about 30 Hz only on the full tier without reduced motion; lite
   has fewer mountains, no rivers, no ships, still smoke. Tests: placement on land, ship loops on the paper sea,
   reduced motion.
3. **States, markers, legend, camera**: hover = lift + amber rim, selected = terracotta tint + higher lift + rim,
   PROT = taller slab + deeper green, enterable = terracotta flag pin with ★ (DOM buttons as now), legend documents it;
   tilted camera (pure framing function, tested for 390x844, 844x390, 1440x900) framing the whole archipelago.
4. **Map2D** in the same look (side offset in earth brown, green tops, cream or brown paper, same states and legend).
5. **Concept film scenes 3 and 7, bumper map scene** in the palette; timings and BEATS untouched.
6. Verification; 7. docs and report; then the addendum fixes in a separate commit.

### 8.4 Baseline (current map, `main`, measured in step 0)

Local production build on :3101, local backend on :3002 (dev DB, 7 published DEMO/test PROT in 3 provinces), fake
Supabase; headless Chrome with SwiftShader, CPU 4x throttling, `/jelajah?debug=1` (continuous rendering), 8 s average
after 2 s at 4x, two runs each.

| Tier | Viewport | fps (run 1 / run 2) | Draw calls | Triangles |
|---|---|---|---|---|
| full | phone 390x844 dpr 2 | 17.7 / 18.7 | 3 | 39.3k |
| full | desktop 1440x900 | 15.7 / 15.4 | 3 | 39.3k |
| lite | phone 390x844 dpr 2 | 39.4 / 39.5 | 3 | 39.3k |
| lite | desktop 1440x900 | 25.0 / 24.6 | 3 | 39.3k |

Targets: full ≤ +20 % frame time (phone ≥ 15.2 fps, desktop ≥ 13.0 fps); lite ≥ the current (phone ≥ 39.5, desktop
≥ 24.8).

JS loaded by `/jelajah` (both intros seen, gzip of the build files): phone full/lite 528.5 KB, 2d 280.5 KB; desktop
full/lite 536.5 KB, 2d 288.4 KB (desktop includes the navbar's idle prefetches). Budget: +15 KB.

Before screenshots: `D:/dev-cache/screens/phase-28/before/` (full / lite / 2d × 390x844, 844x390, 1440x900 × light,
dark; plus hover/selected at 1440x900).
