# Phase 28: Visual identity part 2, the low-poly "paper" map of Indonesia

## 1. Summary

The Jelajah map is now a low-poly "paper" map of Indonesia, built from the design team's reference (`Referensi Peta
Indonesia.png`, Konsep Visual page 4). The image was used as a style reference only. It is not shipped, traced or used as
a texture.

- **The look.** Green faceted islands on thick dark-brown earth slabs, on a cream paper "sea" (brown paper in the dark
  theme), with soft drop shadows and a tilted camera.
- **Nature.** Low-poly mountains along the real ranges, and smoking volcanoes at real coordinates (sources in the data
  file). Thin rivers and lakes, and six small pinisi-like ships sailing loops between the islands.
- **States without colour alone.** Provinces with PROT stand taller. Hover lifts the province with an amber rim.
  Selected lifts it higher, with a terracotta tint. Enterable provinces carry a terracotta ★ flag.
- **Behaviour.** Every existing behaviour is kept: cards, markers, tiers, fallback, `?debug=1`, intros, login gate.
- **Framing.** The camera frames the whole archipelago on portrait phones, landscape phones and desktop.
- **Other maps.** The 2d tier map, the concept film's scenes 3 and 7 and the bumper's map scene use the same look.
  Their timings and sound are unchanged.

Performance was compared against `main` in the same session, interleaved:

- **Frame time.** The full tier costs +2 to 4 % (budget +20 %). The lite tier is about 9 % faster than `main`.
- **Size.** Triangles fell from 39.3k to 12k. `/jelajah` JS grew by 11.6 KB gzip (budget 15 KB).
- **Assets.** No new dependency and no binary asset; everything is procedural.

The addendum fixed the five Phase 27 items. axe-core now finds 0 violations on the 17 pages (Phase 27: 46
`button-name` / `select-name` findings).

All checks pass: 1180 tests, `tsc`, `check:jelajah`, the production build, and lint with no new problems. The phase is
complete. Nothing was pushed.

## 2. Git

| Repo | Branch | Base | Commits |
|---|---|---|---|
| nusantara-play-fe | `phase-28-visual-map` | `21cc5ba` (origin/main, PR #24 merge) | `fda3b89` step 1 · `e10cd64` step 2 · `a67bfe9` step 3 · `30a573a` step 4 · `ab91875` step 5 · `bca1527` step 6 (tsc fix in a test) · `b4f3ed5` addendum · `f92422d` step 7 CLAUDE.md |
| nusantara-play-be | `phase-28-visual-map` | `3375ae6` (origin/main) | `8aedb2c` step 0 report draft · `c78d8b0` step 7 CLAUDE.md · the commit that adds this report |

`git diff --stat main...HEAD`:

- **FE:** 65 files changed, 3237 insertions(+), 448 deletions(-).
- **BE:** 2 files (CLAUDE.md +33/−6, this report).

**Branch name.** The prompt says "visual-map" and CLAUDE.md's Phase workflow says `phase-XX-<slug>`; this name meets both.

Nothing was pushed.

## 3. Changes

**Frontend, map (steps 1 to 4)**

- `lib/jelajah/paper-map.ts` (new, pure): topology-preserving low-poly simplification (`lowPolyShapes`), seeded hashing,
  facet patches (`patchVariant`) and height noise.
- `lib/jelajah/map-nature.ts` (new, pure, the data file with sources):
  - 13 mountain ranges, 18 volcanoes, Puncak Jaya as a peak, 7 rivers, 5 lakes and 6 ship routes;
  - seeded placement (`placeNature`), the motion rules (`ambientMode`), and the ship loops and smoke puffs.
- `lib/jelajah/paper-camera.ts` (new, pure): the 40° tilt, whole-archipelago framing, zoom limits and a projection the
  tests use.
- `lib/jelajah/three/map-geometry.ts`:
  - the paper slabs: densified outlines, subdivided facets, baked lighting;
  - mountains, volcanoes, rivers and lakes in each province's vertex range;
  - `paintShape`, `liftShape`, `buildRim`. `PLAIN_SLAB` keeps the old extrusion as the default.
- `lib/jelajah/three/paper.ts` (new): canvas paper texture, baked lite shadow, `shadowMode`.
- `lib/jelajah/three/ships.ts` (new): procedural pinisi-like ship and smoke puff geometries.
- `components/jelajah/three/MapLife.tsx` (new): ships and smoke (one InstancedMesh each) and the ~30 fps ambient ticker.
- `components/jelajah/Map3D.tsx`:
  - the paper map: islands, paper, key light with the shadow map rendered only on change;
  - states (lift, rim), flag markers, the new camera, and the `?debug=1` hook `window.__nlMap`.
- `components/jelajah/Map2D.tsx`:
  - the same look in SVG: CSS paper, shadow and edge layers, mountains, flags;
  - stable button order, so hover never breaks a click;
  - whole-archipelago framing.
- `components/jelajah/JelajahHub.tsx`: paper background, and a legend with slab swatches documenting every state.
- `lib/jelajah/palette.ts`: the paper-map palette for light and dark (same `provinceFill` semantics), `facetColours`,
  `rgba`.
- `lib/jelajah/map-model.ts`: `provinceCues` and `LIFT`, shared by both maps.
- `lib/jelajah/geo.ts`: `initialFrame` removed (portrait phones now see the whole archipelago).

**Frontend, intros (step 5)**

- `components/jelajah/concept/art/MapArt.tsx`: `PaperIslands` (earth edge + green tops).
- `components/jelajah/concept/scenes/NusantaraScene.tsx` (scene 3) and `BersamaScene.tsx` (scene 7) use it.
- `components/jelajah/concept/scene-kit.tsx`: new `cv-island-fill` gradient; the unused `cv-glow-fill` was removed.
- `components/jelajah/bumper/MapScene.tsx`: paper islands from the theme palette; provinces with PROT rise with the
  amber rim.

**Frontend, addendum**

- `components/prot/ProtForm.tsx`: the province hint has its own row. The shared `inputCls` uses `border-input`, and the
  Jenis / Target Usia selects are tied to their labels.
- Auth:
  - `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`: the English `<h1>` is removed;
  - `components/auth/LoginForm.tsx`, `SignupForm.tsx`: the Indonesian heading becomes the `<h1>`;
  - `components/auth/SocialAuthButtons.tsx`: a `label` prop ("Masuk dengan Google" / "Daftar dengan Google").
- `components/ui/UserNav.tsx`: "Menu akun" name with `aria-expanded` / `aria-haspopup`; the avatar image `alt=""`.
- `components/ui/HeroCarousel.tsx`: named arrows and dots, `aria-current`, arrows visible on keyboard focus.
- Selects named on `/prot`, `/events`, `/calendar`: `app/prot/page.tsx`, `components/prot/ProtFilter.tsx`,
  `components/events/EventFilter.tsx`, `components/calendar/CalendarFilter.tsx`.
- `border-input` on every text input, select and textarea, `bg-input` → `bg-background`, borderless fields bordered.
  The files:
  - auth and users: `components/auth/ChangePasswordForm.tsx`, `components/users/EditProfileForm.tsx`,
    `components/users/UsersTable.tsx`;
  - admin pages: the 7 files under `app/(protected)/admin/` and `app/(protected)/marketplace/orders/[id]/page.tsx`;
  - other pages: `app/nfts/page.tsx`, `app/prot/verifikasi/[id]/review/page.tsx`;
  - audit and calendar: `components/audit/AuditLogFilters.tsx`, and `CalendarAgenda`, `CalendarInviteModal`,
    `CalendarItemDetail`, `CalendarItemForm` in `components/calendar/`;
  - `components/daerah/ProvinceSelect.tsx`, `KabupatenKotaSelect.tsx`, `components/events/EventForm.tsx`;
  - marketplace: `CheckoutForm`, `ProdukFilter`, `ProdukForm`, `TokoForm` in `components/marketplace/`.
- `components/games/egrang/StartScreen.tsx`: "Mulai main" on its own row, the other two side by side, `whitespace-nowrap`.

**Frontend, tests**

- New:
  - `tests/jelajah/paper-map.test.ts`, `paper-geometry.test.ts`, `map-nature.test.ts`, `paper-camera.test.ts`,
    `paper-map2d.test.tsx`, `paper-intros.test.tsx`;
  - `tests/theme/phase-28-cleanup.test.tsx`.
- Changed: `tests/jelajah/geo.test.ts` (the two `initialFrame` tests removed; see Deviations).

**Docs**

- FE `CLAUDE.md`: new "Paper map (Phase 28)" section, updated Jelajah lines, shared sections.
- BE `CLAUDE.md`: the shared sections, identical to the FE copy (checked with `diff`).
- This report.

## 4. Decisions

- **Whole archipelago on load, 40° tilt.** The prompt asks for it on portrait phones too. The map is then small on a
  390 px screen (about 8 px per degree), so the flag labels are smaller below `sm`. Pinch zoom is unchanged
  (`MIN_DISTANCE` 6, out to 1.2 × the framing).
- **Simplification by shared border.** A border shared by two provinces is simplified once, in a canonical direction.
  Simplifying each province separately produced overlaps (z-fighting) and gaps. Picking uses the same low-poly outline,
  so what is drawn is what is clicked.
- **Baked lighting on the islands.** The camera never rotates, so N·L is baked into the vertex colours, and the islands
  use MeshBasicMaterial (the cheapest). Only the paper (full tier), the ships and the smoke are lit.
- **One shadow per tier.**
  - Full tier: a 2048 px PCF shadow map with `autoUpdate` off, rendered only when a province lifts or the geometry
    changes.
  - Lite tier: the shadow is painted into the paper canvas with `shadowBlur`, not `ctx.filter`, which Safari lacks. That
    costs no extra plane, no overdraw and no draw call.
- **Nature in the province mesh.** Mountains, volcanoes, rivers and lakes are merged into the slab mesh, in their
  province's vertex range. They lift and recolour with it at 0 draw calls. The prompt suggested instancing for mountains;
  merging is cheaper here and keeps them on lifted slabs. Ships and smoke move, so those are instanced.
- **Motion budget.** The hub renders on demand. Ships and smoke move only on the full tier without reduced motion, at
  about 30 rendered frames per second (`AmbientTicker`, paused in a hidden tab). Reduced motion leaves the ships docked
  at the start of their route and the smoke still. Lite has still smoke and no ships.
- **Palette.**
  - Light: paper #FDF0DC → #F0DDC3 at the edge; greens sampled from the reference (#4C8832, #6D9347, #8CA751, #C9C772);
    earth sides #6B4B31 → #2A1A0E.
  - Dark: paper #3A281B → #2A1A0E; earth sides #9A7048 → #4A3524, so the slabs read on brown.
  - States: muted provinces are green too (#9DB668), because most provinces have no PROT and the map must read as
    green. PROT provinces are deeper green (#6A9E38 → #2C6820) and taller. Hover is amber #F4AE52, selected terracotta
    #D4621A at 68 %.
- **Flags.** #B4500F with cream text (4.67:1, AA) and a cream border, so they read on both papers. They are not #D4621A,
  which fails AA for small text (Phase 27).
- **Volcanoes.** Coordinates come from the Smithsonian GVP database. A volcano too close to a narrow coast is nudged
  inland by up to 0.32° (decoration). Small-island volcanoes are left out when the outline drops their island:
  Krakatau, Karangetang, Gamalama and Banda Api. Seven smoke: Sinabung, Marapi, Kerinci, Merapi, Semeru, Lewotobi, Ibu.
- **Puncak Jaya.** It is not a volcano; it is a limestone peak of the Sudirman Range. It is shown as the tallest
  mountain, without smoke, and the data file says so.
- **Map2D stable order.** Lifted provinces are drawn again on top as aria-hidden copies, and the buttons never move. The
  first version reordered DOM nodes on hover, which retargeted a quick click to the `<svg>` and deselected (found in
  the browser check). The copy shows the focus ring colour when its province has keyboard focus.
- **Performance judged A/B.** On the second day the machine carried about 50 % background CPU load (remote desktop,
  Steam, Docker; the owner's processes, not touched). The same unchanged map then measured less than half of day one's
  fps, so the budget is judged on `main` vs branch interleaved in one session, from a `main` worktree build on D:.
- **`bg-input` → `bg-background` on form controls.** Since Phase 27 `--color-input` is the 3:1 border colour (#8F6B4C),
  so 26 controls were painted solid brown with low-contrast text, and their new border would have been invisible.
- **Review page textareas.** They now use `border-input` instead of yellow-300 / red-300 (below 3:1 on cream). The
  tinted panel around them still carries the state.

## 5. Deviations

- **`initialFrame` and its two tests removed** (`lib/jelajah/geo.ts`, `tests/jelajah/geo.test.ts`). The prompt says the
  existing map tests stay green, but it also asks to frame the whole archipelago on portrait phones. `initialFrame`
  existed only to show the western part there, and its tests asserted exactly that. The new framing is tested in
  `tests/jelajah/paper-camera.test.ts`. Every other existing map test is unchanged and green.
- **File names.** The prompt's `referensi-peta.png` is `docs/design/Referensi Peta Indonesia.png`. `Konsep_Visual.pdf`
  is `Konsep Visual.pdf`.
- **Order of the last steps.** The addendum commit (`b4f3ed5`) was made before the step 7 CLAUDE.md commit, so that the
  CLAUDE.md cleanup list and this report could include it. The prompt lists step 7 first.
- **No `.mp4`.** `D:/tools/ffmpeg` does not exist, so only `.webm` recordings were made, as the prompt allows.
- **The fps "before" is the same-session `main` build.** The step 0 baseline (day one) is reported too, but day two's
  machine load made absolute numbers incomparable (see Decisions).
- **Mountains are merged, not instanced** (see Decisions).

## 6. Verification

Disk: C: 8.5 GB free at the start, 5.8 GB at the end (Windows page file growth while builds and headless Chrome ran;
never below 3 GB). D: 337 GB.

| Command | Result |
|---|---|
| `pnpm test` (FE, final) | exit 0 · Test Files 90 passed · Tests 1180 passed (Phase 27: 83 files / 1120 tests; new: paper-map 7, paper-geometry 14, map-nature 11, paper-camera 11, paper-map2d 7, paper-intros 5, phase-28-cleanup 7; geo.test −2) |
| `pnpm exec tsc --noEmit -p .` | exit 0 (an earlier run failed on an incomplete test fixture; fixed in `bca1527`) |
| `pnpm lint` | exit 1 as before: 43 errors, 64 warnings = the Phase 27 baseline. 64 new and touched files; every new file is clean; the 16 touched files with old problems have exactly the counts they had on `main` (per-file comparison through `git show main:<file>` + `eslint --stdin`) |
| `pnpm check:jelajah` | exit 0 (`check:jelajah OK`, 195.6 KB per scene; no new assets) |
| `pnpm build` (local; env pointing at the local backend and fake Supabase) | exit 0, `✓ Compiled successfully` (after steps 3, 5 and the addendum) |
| axe-core 4.11.1 (17 pages × light/dark × 390x844/1440x900 = 68 runs) | **0 violations of any kind**. Phase 27, same script: 0 contrast, 30 `button-name`, 16 `select-name`. 154 "incomplete" contrast nodes (text over canvases, photos, translucent overlays) |
| Overflow (scrollWidth − clientWidth) | 0 px on every page at 360x740, 390x844, 844x390 and 1440x900; 0 px on all 18 map screenshots |

**Local setup for the browser checks.** As in Phases 26 and 27:

- the local backend on :3002 (`node dist/main`, dev DB in Docker; 7 published local PROT in 3 provinces);
- the Phase 19 fake Supabase on :54329, with a real local access token of the Phase 26 seed admin (cached for 12 min
  to stay under the 10-logins-per-15-minutes limit);
- `next start` on :3101, and a `main` worktree build on :3102 for the A/B;
- requests to `api.nusantaralegacy.org` aborted.

Production was not contacted, and the production database was never touched. All processes were stopped and
`npm run db:down` was run at the end.

**Scratch and output.**

- Scripts: `D:/dev-cache/tmp/phase-28/scripts/` (harness, perf, perf-ab, film-ab, shots, states, intros, record, page,
  axe, codemods).
- Results: `D:/dev-cache/tmp/phase-28/perf/*.json`, `D:/dev-cache/tmp/phase-28/axe-results.json`.
- Logs: `D:/dev-cache/tmp/phase-28/*.log`.
- Leftover: the removed `main` worktree's folder `D:/dev-cache/tmp/phase-28/main-wt` (a locked file in its
  `node_modules`; git no longer tracks it; safe to delete).

Tools: nothing installed. Pillow (Phase 27's copy on D:) was used for colour sampling and contact sheets, and the
Phase 19 `playwright-core` with Playwright's own ffmpeg (`D:/dev-cache/ms-playwright/ffmpeg-1010`) for the `.webm`.

## 7. Manual checks (for the boss)

1. Open the Vercel preview of `phase-28-visual-map`, on a phone and on a laptop, logged in.
2. **`/jelajah` on a laptop.** You see the whole archipelago, tilted, on cream paper. You see:
   - green faceted islands standing on dark-brown sides, with a soft shadow to the lower right;
   - grey-brown mountains, smoke rising from a few volcanoes (Sumatra, Java, Flores, Halmahera), blue rivers in Borneo,
     Sumatra and Papua;
   - six small sailing ships moving slowly between the islands;
   - next to the reference picture (`D:/dev-cache/screens/phase-28/side-by-side-reference.png`), the same family of
     look.
3. **States.**
   - Move the mouse over Sumatera Selatan: it lifts and gets an amber outline.
   - Click it: it lifts higher, turns terracotta, and the card opens. "Masuk" enters the village.
   - The five terracotta flags (★ Pilot, ★ Desa) are clickable. Provinces without PROT are lower than those with PROT.
4. **Legend** (bottom right): it explains every state.
5. **Theme toggle.** Dark gives brown paper with lighter earth sides; the map recolours at once.
6. **Phone (portrait).** The whole archipelago is visible in the middle; pinch to zoom, drag to pan; tap a province or a
   flag.
7. **Tampilan → Ringan (lite).** Same map, fewer mountains, no rivers or ships. **Tampilan → Peta 2D**: the same look as
   a flat picture (green tops on brown edges, mountains, flags); provinces lift with an amber outline.
8. **Reduced motion** (phone setting, or OS "reduce motion"): ships stand still, smoke does not move.
9. **Real phone with `?debug=1`** (`/jelajah?debug=1`): the box on the right shows fps, draw calls (5 on Penuh, 4 on
   Ringan) and triangles (about 12k). Please send a screenshot of it from a mid-range Android phone, on the full and the
   lite tier.
10. **Intros.** Tampilan → "Putar intro": scene 3 (the map) shows green islands, and the provinces with PROT rise with an
    amber outline. "Tonton pengenalan": the moment Indonesia lights up shows green islands on brown; the community scene
    also has green islands. Timings and sound as before.
11. **Addendum.**
    - `/prot/create`: the line "Provinsi dan kabupaten/kota" sits above "PROVINSI", no overlap.
    - `/login`, `/signup`: only "Masuk" / "Daftar" as headings, and "Masuk dengan Google" / "Daftar dengan Google".
    - Form fields on admin pages are cream with a visible brown border (no solid brown fields).
    - `/main/egrang` on a laptop: "Mulai main" is a full-width row, the other two buttons are side by side, and no label
      wraps.

## 8. Findings

### 8.1 Preflight (step 0)

- Disk: C: 8.5 GB free, D: 337 GB free (limit C: 3 GB).
- Phase 27 "Visual identity refresh" is merged in both repos: FE PR #24 (`21cc5ba` on `origin/main`), BE `3375ae6`. The
  local FE `main` was behind and was fast-forwarded.
- Phase number 28 (highest existing report `phase-27.md`).
- Page 4 text ("Visual Peta Indonesia"): "Visual peta bergaya 3D low-poly dipilih untuk membangun identitas visual yang
  konsisten dengan keseluruhan aset permainan Nusantara Legacy. Penggunaan bentuk pulau, elemen alam, dan kapal dengan
  gaya low-poly menghadirkan kesan playful dan eksploratif, sekaligus menjadi visual pembuka bagi pemain untuk
  menjelajahi berbagai provinsi dan mini game di dalamnya."

### 8.2 The reference (style only; not shipped, traced or used as a texture)

Colours were sampled with Pillow from `Referensi Peta Indonesia.png` (1920x1080).

- **Islands.** Thick extruded slabs, like cut cardboard. The sides are dark-brown earth (#443828, #5A4337 in the light,
  near-black in the shade), clearly thicker than small islands are wide.
- **Tops.** Faceted: large flat triangles in a few greens and yellow-greens next to each other (#4C8832, #6D9347 /
  #6BA03C, #8CA751, #D2C89E / #DDD093). Borders are not lines; they show as seams and colour changes.
- **Mountains.** Grey-brown low-poly pyramids and cones with 5 to 7 faces: a lit face #BBA894 / #CCBAA0 and a shaded
  face #634F3E / #7B6756. They cluster along the spines of Sumatra, Borneo, Sulawesi and Papua, and a few volcanoes
  smoke.
- **Water on land.** Thin blue rivers and lakes (#5A928C) as flat strips.
- **Ships.** About six small pinisi-like ships with dark hulls (#5A4337), two masts and pale triangular sails
  (#D1BEA9).
- **No blue ocean.** Warm cream paper, #FFEFD7 at the centre to #EDDAC2 at the edges, with faint grain.
- **Light and camera.** Soft drop shadows to the lower right (light from the upper left); tilted perspective, about
  40° from straight down.

### 8.3 Comparison with the reference

Side by side: `D:/dev-cache/screens/phase-28/side-by-side-reference.png`.

**Matches:**

- the paper sea without blue;
- green faceted tops in several greens with dark earth sides;
- grey-brown two-tone mountains along the ranges, smoking volcanoes, blue rivers in Borneo, Sumatra and Papua;
- pinisi-like ships with pale sails;
- soft lower-right shadows and a tilted camera.

**Differences:**

- **Scale.** The reference is an art shot: closer, larger mountains, much thicker slabs, deeper shadows. Ours frames the
  whole archipelago so every province stays reachable, which makes the slabs look thinner.
- **Facets.** Ours are smaller, mixed with seam lines between provinces (the map needs province borders; the reference
  has almost none).
- **Overlays.** Markers, title, HUD and legend sit on top of the map.
- **Islands.** Ours are the real 2019 province outlines, not stylised island shapes.

### 8.4 Performance

**Baseline (step 0, day one, `main`, local production build, headless Chrome with SwiftShader, CPU 4x, `?debug=1`, 8 s
after 2 s at 4x):**

| Tier | Viewport | fps (runs) | Draw calls | Triangles |
|---|---|---|---|---|
| full | phone 390x844 dpr 2 | 17.7 / 18.7 | 3 | 39.3k |
| full | desktop 1440x900 | 15.7 / 15.4 | 3 | 39.3k |
| lite | phone 390x844 dpr 2 | 39.4 / 39.5 | 3 | 39.3k |
| lite | desktop 1440x900 | 25.0 / 24.6 | 3 | 39.3k |

**After step 3 (day one, same conditions as the baseline):** full phone 17.8 / 17.9, desktop 13.9 / 13.9; lite phone
49.4 / 48.8, desktop 29.9 / 29.5. Draw calls full 5 / lite 4; triangles 12.4k / 11.9k.

**Final, A/B (day two, about 50 % background CPU load).** `main` (worktree build) and this branch were measured
interleaved, three rounds each, same settings:

| Tier | Viewport | `main` fps | branch fps | Frame time | Target |
|---|---|---|---|---|---|
| full | phone 390x844 dpr 2 | 7.9 (7.8 / 7.7 / 8.1) | 7.6 (7.6 / 7.6 / 7.6) | +3.5 % | ≤ +20 % ✓ |
| full | desktop 1440x900 | 5.8 (5.7 / 5.9 / 5.8) | 5.7 (5.8 / 5.6 / 5.6) | +2.4 % | ≤ +20 % ✓ |
| lite | phone 390x844 dpr 2 | 12.7 (12.7 / 12.7 / 12.8) | 13.9 (13.9 / 14.0 / 13.8) | −8.4 % | ≥ `main` ✓ |
| lite | desktop 1440x900 | 7.6 (7.7 / 7.5 / 7.7) | 8.4 (8.5 / 8.4 / 8.4) | −9.5 % | ≥ `main` ✓ |

| | `main` | Phase 28 |
|---|---|---|
| Draw calls (full / lite) | 3 / 3 | 5 / 4 (paper, islands, seams, smoke, ships; + rim 1 to 2 while hovering/selecting; the shadow pass only when islands change) |
| Triangles (full / lite) | 39.3k / 39.3k | 12.4k / 11.9k (islands with mountains and rivers 11.7k; vertices of the outline 13,228 → 3,089) |
| `/jelajah` JS, phone (full / lite / 2d) | 528.5 / 528.5 / 280.5 KB gz | 540.1 / 540.1 / 286.5 KB gz (+11.6 / +11.6 / +6.0) |
| `/jelajah` JS, desktop (full / lite / 2d) | 536.5 / 536.5 / 288.4 KB gz | 548.0 / 548.0 / 294.5 KB gz (+11.5 / +11.5 / +6.1) |
| three.js on the 2d tier | never fetched | never fetched (tested) |

JS was measured as all scripts the page loads with both intros seen, gzip of each build's own files.

**Concept film, restyled scenes (desktop 1440x900, full tier, CPU 4x, A/B).** Round 1: scene 3 `main` 10.4 vs branch
10.7 fps; scene 7 `main` 11.8 vs branch 11.6 fps. Round 0 was a first-launch warm-up outlier for `main` (5.3 / 6.3 fps).
Both scenes are still painted once.

**Why lite got faster.** The islands now use an unlit material with baked lighting, there are about 3x fewer triangles,
and the lite shadow lives in the paper texture (no extra plane). Full pays for the shadow lookups on the paper and for
the ships and smoke, and stays within 4 %.

### 8.5 Nature placed (deterministic)

| | Full | Lite |
|---|---|---|
| Range mountains | 37 | 18 |
| Volcanoes | 14 of 18 (7 smoking) | 14 (smoke still) |
| Peaks | Puncak Jaya | Puncak Jaya |
| River runs / lakes | 9 / 5 | none |
| Ships | 6 | none |

Volcanoes left out are on small islands the outline drops or shrinks: Krakatau, Karangetang, Gamalama, Banda Api.

### 8.6 Screenshots and recordings

- **Before** (the old map): `D:/dev-cache/screens/phase-28/before/`, full / lite / 2d × 390x844, 844x390, 1440x900 ×
  light / dark, plus hover/selected at 1440x900.
- **After:** `D:/dev-cache/screens/phase-28/after/`, the same 18 shots, plus `states-*-1440x900.png` (hover Jawa Barat +
  selected Sumatera Selatan, every tier and theme), plus `contact-sheet.png`.
- **Reference side by side:** `D:/dev-cache/screens/phase-28/side-by-side-reference.png`.
- **Intros:** `D:/dev-cache/screens/phase-28/wip-intros/` (film scenes 3 and 7, light/dark; bumper map scene).
- **Addendum:** `D:/dev-cache/screens/phase-28/addendum/` (PROT form, egrang start, admin users, events).
- **Recordings** (load → hover → select through the flag → "Masuk" into Sumatera Selatan):
  `D:/dev-cache/screens/phase-28/video/paper-map-1440x900.webm` (3.0 MB) and `paper-map-390x844.webm` (1.2 MB). No
  `.mp4`: no ffmpeg under `D:/tools/ffmpeg`.

### 8.7 Addendum (Phase 27 cleanup items)

| Item | Fix | Check |
|---|---|---|
| Province hint overlaps "PROVINSI" (`/prot/create`, edit) | hint in its own row above the selects | screenshot; test |
| English auth headings, "Continue with Google" | removed; Indonesian form heading is the `<h1>`; "Masuk/Daftar dengan Google" | test |
| Accessible names (navbar account button, carousel buttons, selects on `/prot`, `/events`, `/calendar`, PROT form) | `aria-label` / `htmlFor`+`id` | axe: `button-name` 30 → 0, `select-name` 16 → 0; test |
| Inputs on the `border-input` token | two codemod passes (79 + 25 class values) + the 2 review textareas + 3 shared class constants; `bg-input` → `bg-background`; borderless fields bordered; old landing drafts skipped | test scans every text control (all have `border-input`, none `bg-input`) |
| Egrang start buttons wrap on desktop | "Mulai main" full row, two buttons side by side, `whitespace-nowrap` | screenshot; test |

The two Cleanup list entries are removed from CLAUDE.md (both repos). Two new entries were added (see section 9).

## 9. Out-of-scope observations

- **Concept film scene 5** ("jelajah") still shows cream provinces on a blue sea, the old map style. The prompt named
  only scenes 3 and 7. Added to the Cleanup list.
- **Landscape phones (844x390).** The title card and reward HUD cover part of Sumatra, and the map section is taller
  than the viewport (`min-h-[440px]`); this layout predates this phase. Added to the Cleanup list.
- **The bumper's auto-advance** sometimes ran a scene ahead of my scripted key presses (only noticed in automation; with
  reduced motion it waits). No change.
- **Machine load on day two** (remote desktop, Steam, Docker) more than halved the headless fps of the unchanged map.
  Future phases should measure A/B in one session, or note the load.
- **`app/landing-page/1` and `/2`** were again skipped (old drafts, removal waits for the cleanup phase).

## 10. Open questions

1. **Thickness and zoom.** The reference is an art shot with thicker slabs and bigger mountains. Should the slabs be
   thicker (and the mountains larger) even though the whole-archipelago view then looks heavier? Or should the first
   view zoom in a little and leave part of Papua for a pan, especially on portrait phones?
2. **Seams.** Province borders are drawn as subtle dark-green seams. Should they be fainter, so the islands look more
   like the reference, or stronger, so the provinces are easier to tell apart?
3. **Concept film scene 5.** Restyle it to the paper look in a later pass (Cleanup list)?
4. **Volcanoes on small islands.** Krakatau, Karangetang, Gamalama and Banda Api are not shown, because their islands
   are too small in the simplified outline. Should they get their own small islets?
5. **Real phones.** Please check `/jelajah?debug=1` on a mid-range Android (full and lite) and send the overlay numbers.

## 11. Ready for next phase?

Yes. Every step is committed on `phase-28-visual-map` in both repos (not pushed). The boss's review on the Vercel preview
(section 7) and a real-phone `?debug=1` check are the next steps before merging.
