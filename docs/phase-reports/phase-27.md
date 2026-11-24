# Phase 27: Visual identity refresh (logotype, palette, typography, batik ornaments)

## 1. Summary

The site now follows the design team's "Konsep Visual" (`nusantara-play-fe/docs/design/`).
- **Palette.** Warm cream, amber, terracotta and dark brown in both themes, with darker shades derived where the
  brand colours fail WCAG AA. Every token pair is tested.
- **Fonts.** Poppins for body and UI. Cinzel Decorative for the logotype and a few large headings. Both are
  self-hosted.
- **Logotype.** "Nusantara Legacy" as live text, with the PDF's vertical terracotta-to-amber gradient on dark
  backgrounds.
- **Batik ornaments.** An original ceplok/kawung-like lattice for corners, bands, empty states, loading screens and
  the Paspor.
- **Icons and OG image.** A provisional "NL" monogram for the icons and a cover-like Open Graph image.
- **Coverage.** The landing page (its hero is the PDF cover), navbars, footer, auth pages, every app page, the game
  and Jelajah chrome, the intro bumper and the concept film use it. The maps were not touched.

All checks pass:
- 1120 tests, `tsc` and `check:jelajah` green; production build OK.
- Lint has no new problems.
- axe-core finds 0 colour-contrast violations on 17 pages, in light and dark, at 390x844 and 1440x900.
- No horizontal overflow at 360x740, 390x844, 844x390 or 1440x900.

The phase is complete. Nothing was pushed.

## 2. Git

| Repo | Branch | Base | Commits |
|---|---|---|---|
| nusantara-play-fe | `phase-27-visual-identity` | `ac890d5` (origin/main, PR #23 merge) | `7d7222c` step 0 design files · `23f0c3f` step 1 · `ab9af25` step 2 · `755dc8e` step 3 · `5cd0c54` step 4 · `1e781c2` step 5 · `f79121c` step 6 · `51936f1` step 7 fixes · `2a33b20` step 8 CLAUDE.md · `f3928bd` step 8 measured ornament size |
| nusantara-play-be | `phase-27-visual-identity` | `7f19521` (origin/main) | `8be5fc8` step 0 report draft · `12ec469` step 8 CLAUDE.md · `7d1f3d1` report · the commit after it: report corrections |

`git diff --stat main...HEAD`: FE 128 files changed, 2146 insertions(+), 939 deletions(-); BE 2 files (CLAUDE.md +34,
this report).

Branch name: `phase-27-visual-identity`. The prompt said "visual-identity" and CLAUDE.md's Phase workflow says
`phase-XX-<slug>`; this name meets both.

## 3. Changes

Frontend, new:
- `docs/design/` (3 files): the design team's source files, committed as the source of truth.
- `app/fonts/Poppins-{Regular,Medium,SemiBold,Bold}-latin.woff2`, `CinzelDecorative-Bold.woff2`, `OFL-Poppins.txt`,
  `OFL-CinzelDecorative.txt`: the self-hosted fonts and their licences.
- `lib/theme/tokens.ts`: the token values mirrored for tests, the contrast pairs, and the WCAG luminance and contrast
  functions.
- `lib/brand/batik.ts`: the ornament geometry (tile, corner lattice, data URI).
- `components/brand/Logotype.tsx`, `components/brand/Batik.tsx`: the logotype and the ornaments.
- `scripts/build-brand-assets.mjs` (`pnpm brand:assets`), `scripts/brand/outlines.json`: the icon and OG generator,
  with glyph outlines.
- `app/opengraph-image.png`, `app/opengraph-image.alt.txt`: the OG image.
- `tests/theme/tokens.test.ts`, `tests/brand/brand-identity.test.tsx`: the tests.

Frontend, modified:
- `app/globals.css`: tokens for light and dark, `@theme inline`, the remapped Tailwind ramps, logotype, band and
  texture CSS, focus colour and selection.
- `app/layout.tsx`: the fonts, `metadataBase`, the Twitter card.
- `app/fonts/README.md`: sources, SHA-256 hashes and build commands.
- `tests/config/fonts.test.ts`: the new fonts, and the display font never on controls or small paragraphs.
- `app/icon.png`, `app/apple-icon.png`, `public/favicon.ico`: the provisional NL monogram.
- `package.json`: the `brand:assets` script.
- `app/page.tsx`: cover-like hero, display section titles, batik dividers, brand-brown blockchain band, CTA corners,
  shared footer, AA fixes.
- `components/ui/AppNavbar.tsx`, `AppFooter.tsx` and `app/(auth)/layout.tsx`: logotype, batik band and brown brand
  panel. Also removed the request for the missing `/grid.svg`.
- About 100 page and component files under `app/` and `components/` (menu, PROT, events, calendar, profile, admin,
  marketplace, NFT, users, audit, daerah, auth, games, Jelajah chrome):
  - 509 old-palette hex classes replaced with semantic tokens.
  - AA-safe text tokens.
  - Display headings and batik in empty and loading states.
  - Admin header in brand brown.
- `components/jelajah/bumper/BrandScene.tsx`: the logotype, and the icon on a batik motif.
- `components/jelajah/concept/**`: fixed colours mapped to the palette; scene 3 and 8 wordmarks.
- `CLAUDE.md`: the "Visual identity (Phase 27)" section, the brand and font notes, and the shared sections.

Frontend, deleted: `app/fonts/PlusJakartaSans-latin.woff2`, `app/fonts/OFL-PlusJakartaSans.txt`.

Backend: `CLAUDE.md` (shared sections), `docs/phase-reports/phase-27.md` (this report).

## 4. Decisions

- **Gradient logotype only on dark backgrounds.** The PDF's page 2 also shows it on cream, where its amber end has
  only 1.74:1. On cream the site uses the solid brown version. The `auto` variant switches by theme.
- **Light `primary` is #B4500F, not #D4621A.** #D4621A passes with no text colour: white 3.78:1, cream 3.44:1,
  brown 4.44:1. #B4500F with cream text gives 4.67:1. #D4621A stays exact for decoration, the logotype gradient and
  large fills.
- **Tailwind ramps remapped instead of ~870 classes edited by hand.** `gray/stone/slate/zinc/neutral` became a warm
  ramp and `blue/indigo` a terracotta ramp, each at the same OKLCH lightness, so contrast is preserved (tested).
  red/green/yellow/amber/purple keep their meaning.
- **The landing hero is dark brown in both themes**, like the PDF cover. The light theme keeps a cream page below it.
- **Cinzel Decorative is not subsetted.** Its OFL reserves the name "Cinzel", and a subset could count as a renamed
  Modified Version. A plain woff2 conversion costs 22.5 KB. Only the Bold weight is shipped.
- **Icons and OG image built from glyph outlines** (fontTools + uharfbuzz), so rendering needs no fonts. The
  committed generator uses the `sharp` that Next.js already depends on.
- **Old hex classes replaced by codemod.** Every hex has an explicit mapping (old terracotta, old teal secondary,
  greys, dark surfaces, gold, error). `text-white` on primary or secondary fills became the matching foreground.
  Duplicate `dark:` classes were removed.
- **The congklak status keeps two player colours** (`primary-text` / `foreground`, matching the player dots).
- **The film's scene 8 icon loads unoptimized**, like the bumper. A cached optimizer variant of the old icon showed
  locally, and on Vercel the 31-day image cache could do the same.
- **Event placeholders use the brand gradient** with a brown initial (white on amber is 1.9:1).

## 5. Deviations

- **Design file names** differ from the prompt: `Konsep Visual.pdf`, `Palet Warna Nusantara Legacy.png`,
  `Referensi Peta Indonesia.png`.
- **The OG image is a static PNG** built from outlines, not a rendered `<Logotype>` (an image cannot use live text).
  The logotype data comes from the same font and `SITE_NAME`.
- **Hero corner ornaments are smaller than on the cover** (`w-24` phones to `w-52` at xl), so they never sit behind
  the eyebrow or the logotype. At full cover size they overlapped the text at 1440 px.
- **Fonts preloaded:** Poppins (4 files), Cinzel and Geist Mono are all preloaded by `next/font` (as before for its
  fonts). Geist Mono could be set to `preload: false` to save 23 KB on most pages; not changed (not asked).
- **Before/after shots:** the extra pages (`/prot/create`, review, events, calendar, admin, signup, film scenes 1,
  7, 8) have only "after" shots (working sets wip4/wip6); the 13 required pages have both.

## 6. Verification

Disk: C: 9.9 GB free at the start, 8.4 GB at the end (Windows page file growth during builds and headless Chrome;
never below 3 GB); D: 337 GB.

| Command | Result |
|---|---|
| `pnpm test` (FE, final) | exit 0 · Test Files 83 passed · Tests 1120 passed (new: `tests/theme/tokens.test.ts` 77 incl. 35 pairs × 2 themes, `tests/brand/brand-identity.test.tsx` 12; `tests/config/fonts.test.ts` rewritten, 4) |
| `pnpm exec tsc --noEmit -p .` | exit 0 |
| `pnpm lint` | exit 1 as before: 43 errors, 64 warnings = the Phase 26 baseline; 106 touched source files, no new problem, every new file clean |
| `pnpm check:jelajah` | exit 0 (`check:jelajah OK`, 195.6 KB per scene) |
| `pnpm build` (local, env pointing at the local backend and fake Supabase) | exit 0 (`✓ Compiled successfully`) |
| axe-core 4.11.1 (already in node_modules) | 17 pages × light/dark × 390x844/1440x900 = 68 runs: **0 colour-contrast violations** (first run: 37 nodes on 7 pages, fixed in `51936f1`); 148 "incomplete" (text over the map canvas, photos, translucent HUD) |
| Overflow (scrollWidth − clientWidth) | 0 px on every page at 360x740, 390x844, 844x390 and 1440x900 (both themes at 390 and 1440) |
| Screenshots | 52 before + 52 after (13 pages × light/dark × 390x844/1440x900) |

Static build output (`.next/static`, gzip; before = `main` built at the start of the phase):

| Kind | Before | After | Δ |
|---|---|---|---|
| JS (93 files) | 1095.8 KB | 1100.1 KB | +4.3 KB |
| CSS (2 files) | 23.4 KB | 24.3 KB | +0.9 KB |
| Fonts (woff2) | 49.3 KB (Jakarta 27.3 + Geist 23.1) | 78.5 KB (Poppins 4 × 8.5–8.9, Cinzel 22.5, Geist 23.1) | +29.2 KB |
| PNG | 8.6 KB | 29.0 KB (icons 3.2 KB; OG 27.5 KB is not loaded by pages) | +20.4 KB |

Ornament assets: 3.1 KB gzip in total (corner 735 B, motif 377 B, band 83 B, tile 631 B, ornament CSS 1319 B; budget 15 KB, tested).

Tools installed for this phase, all to D: only (pip `--target D:/dev-cache/tmp/phase-27/py`, cache
`D:/dev-cache/pip`): pypdfium2 4.30.0 and Pillow 11.0.0 (render the PDF, crop screenshots), fontTools 4.55.0 + brotli
1.1.0 (woff2), uharfbuzz 0.42.0 (glyph shaping for the outlines). Browser: the system Chrome through the Phase 19/26
`playwright-core` harness, profile/cache on D:. Nothing was installed into the repos.

Local setup for the browser checks: local backend on port 3002 (`node dist/main`, dev DB in Docker), the Phase 19 fake
Supabase on 54329 with a real local access token of the Phase 26 seed admin, `next start` on 3101; requests to
`api.nusantaralegacy.org` aborted. Production was not contacted, and the production database was never touched.
All processes were stopped and `npm run db:down` was run afterwards.

Scratch: `D:/dev-cache/tmp/phase-27/` (scripts: `shots.mjs`, `axe.mjs`, codemods, `measure.mjs`, `sheet.py`;
`axe-results.json`; build logs). Screenshots: `D:/dev-cache/screens/phase-27/before/`, `after/`, `wip3..6/`,
`hero-vs-cover.png` (landing hero next to the PDF cover).

## 7. Manual checks (for the boss)

1. Open the Vercel preview of `phase-27-visual-identity`, on a phone and on a laptop.
2. **Landing `/`.** A dark brown hero with amber batik in the top-left and bottom-right corners. "NUSANTARA LEGACY"
   in the decorative font, orange at the top of the letters and gold at the bottom. A gold batik band under the hero.
   Section titles in the same decorative font. The footer starts with a terracotta batik band.
3. **Theme toggle (moon/sun).** Light = cream pages, dark-brown text, terracotta buttons. Dark = dark-brown pages,
   cream text, gold buttons. The logotype in the navbar is dark brown in light mode and the orange-gold gradient in
   dark mode.
4. **`/login` on a laptop.** A brown panel on the left with the gradient logotype and batik on the right edge. On a
   phone: the logotype above the form and a batik band at the top.
5. **`/menu`, `/prot`, a PROT detail, `/profile`, `/events`, `/calendar`, an admin page.** Same colours, no blue or
   grey-blue left, headings in the decorative font only for big titles; empty lists show a small batik flower.
6. **`/main` and the three games.** Titles in the decorative font, terracotta/gold buttons. The board/canvas art is
   unchanged.
7. **`/jelajah` (logged in) and "Putar intro".** The first intro screen shows the "NL" icon on a batik flower and the
   logotype. "Tonton pengenalan": the night scenes are dark brown instead of navy, and the last scene shows the
   gradient logotype. The map itself is unchanged (next phase).
8. **Sharing a link** (WhatsApp, Slack) after deploy: the preview image is dark brown with the logotype, batik corners
   and the tagline.
9. **The browser tab icon** is the gold "NL" on dark brown. It is **provisional**.

## 8. Findings

### 8.1 Preflight (step 0)

- Disk: C: 9.9 GB free, D: 337 GB free (limit C: 3 GB).
- Branches: every phase branch is merged into `origin/main` in both repos (FE `phase-26-prot-form-review` = PR #23,
  merged as `ac890d5`; only the local `main` was behind and was fast-forwarded). Branch `phase-27-visual-identity`
  created in both repos from `origin/main` (FE `ac890d5`, BE `7f19521`).
- Design files (untracked in FE `docs/design/`; the names differ from the prompt): `Konsep Visual.pdf` (4 pages,
  1440x810 pt), `Palet Warna Nusantara Legacy.png` (400x400, four bands), `Referensi Peta Indonesia.png` (1920x1080).
  Rendered with pypdfium2 4.30.0 + Pillow 11.0.0, installed only to `D:/dev-cache/tmp/phase-27/py` (pip cache on D:),
  pages in `D:/dev-cache/tmp/phase-27/pdf/page-1..4.png`.

### 8.2 What the design files show

- **Page 1, cover.** Background solid #2A1A0E. Top left and bottom right: a diagonal band of ornament, cut along a
  45° line, in solid #F4AE52 (sampled: #F3AE52 / #F4AE52; nothing else). The ornament is a ceplok lattice: each cell
  is a four-petal flower (pointed, lens-shaped petals on the diagonals and the axes) with a small round centre, framed by
  a scalloped quatrefoil outline (an ogee "kawung-like" frame) whose lobes touch the neighbouring frames tip to tip; the cells sit on
  an axis-aligned square grid with smaller flowers where four frames meet, and only the band edge runs at 45°. In the middle: "KONSEP VISUAL" in Poppins Light Italic, widely tracked, cream; below it the
  logotype "NUSANTARA LEGACY" in Cinzel Decorative (the decorative swash N and L), about 3x larger.
- **Logotype gradient.** Sampled row by row across the cover logotype: #D2681F at the top of the caps → #DE8030 in the
  middle → #EDA149 at the baseline swash, i.e. a **vertical linear gradient, #D4621A at the top to #F4AE52 at the
  bottom** (no angle). Page 2 shows the same.
- **Page 2, "Logotype".** Heading in Poppins Bold on an amber (#F4AE52) block, body in Poppins Regular, dark brown text
  on cream. Font: Cinzel Decorative, designer Natanael Gama, SIL OFL. Three versions: gradient on cream (!), solid
  black/dark brown on cream, white on a black bar.
  Note: page 2 places the gradient version on cream; the prompt says "on dark". On cream the gradient's top colour
  (#D4621A) reaches only 3.44:1 (enough for large text, 3:1), the amber bottom only 1.74:1. The site therefore uses the
  gradient only on dark backgrounds (dark theme, cover-like hero, bumper, film, OG image) and the solid #2A1A0E version
  on light backgrounds.
- **Page 3, "Palet Warna".** #FEF3E2, #F4AE52, #D4621A, #2A1A0E. Text: warm colours matching the game assets,
  especially rumah adat in wood and brown.
- **Page 4, "Visual Peta Indonesia".** A 3D low-poly map (green islands with brown earth sides, volcanoes, pinisi-like
  boats) on a cream paper background. Not part of this phase (next phase), noted only.
- `Referensi Peta Indonesia.png` = the page 4 picture at full size. `Palet Warna...png` = the four colours as bands.

### 8.3 Token plan

One place: `app/globals.css` (plain CSS variables `--nl-*` on `:root` and `:root.dark`, exposed to Tailwind through
`@theme inline`), mirrored in `lib/theme/tokens.ts` for the contrast test (a test keeps both equal).

Brand colours (exact, both themes; fills, large text, decoration): `brand-cream` #FEF3E2, `brand-amber` #F4AE52,
`brand-terracotta` #D4621A, `brand-brown` #2A1A0E.

Derived shades (because the brand colours fail for small text):

| Token | Value | Why |
|---|---|---|
| `terracotta-600` | #B4500F | interactive fill (buttons) with cream text: 4.67:1 (#D4621A only 3.44 cream / 3.78 white / 4.44 brown) |
| `terracotta-700` | #9A4310 | terracotta text and links on cream (6.01:1), button hover |
| `amber-700` | #A3600C | amber focus ring / UI marks on cream (4.52:1; #F4AE52 only 1.74:1) |

Semantic tokens:

| Token | Light | Dark |
|---|---|---|
| background | #FEF3E2 cream | #2A1A0E brown |
| surface (cards) | #FFFAF2 | #36241A |
| surface-raised (popovers, inputs) | #FFFFFF | #42301F |
| muted (sunken, chips) | #F6E4C6 | #4A3524 |
| text (foreground) | #2A1A0E | #FEF3E2 |
| text-muted | #6B4E36 | #D9C3A5 |
| primary (interactive fill) | #B4500F | #F4AE52 |
| primary-foreground | #FEF3E2 | #2A1A0E |
| primary-hover | #9A4310 | #F7C27A |
| primary-text (links, small accent text) | #9A4310 | #F4AE52 |
| primary-soft / -foreground | #FBE0CC / #7A3410 | #5A2E12 / #FBD9B8 |
| secondary / -foreground | #2A1A0E / #FEF3E2 | #FEF3E2 / #2A1A0E |
| accent / -foreground | #F4AE52 / #2A1A0E | #F4AE52 / #2A1A0E |
| border (decorative) | #E8CFAB | #5A4430 |
| input (control border, 3:1) | #8F6B4C | #A08060 |
| focus-ring | #A3600C | #F4AE52 |
| ornament | #F4AE52 (on dark) / #D4621A (on cream) | #F4AE52 |
| success / soft | #2F6B2F / #E3F0D8 | #9CD49C / #22351C (text #B4E0B0) |
| warning / soft | #8A5A00 / #FCEBC4 | #F6C873 / #3F2E10 |
| danger / soft | #B42318 / #FBE3DA | #FF9C7A / #4A2218 (text #FFB4A0) |

The older token names keep working and point at these (`card` = surface, `foreground` = text, `muted-foreground` =
text-muted, `ring` = focus-ring, `surface-container-*`, `primary-fixed`, `on-surface`, `outline-variant`, `warm-*`).
Tailwind's neutral ramps (gray, stone, slate, zinc, neutral) are redefined as a warm brown ramp, and blue / indigo
(used as "primary" buttons and links on older pages) as a terracotta ramp, each step keeping Tailwind's own OKLCH
lightness, so contrast stays where it was. red / green / yellow / amber / emerald / purple stay Tailwind's (they carry
meaning: errors, success, statuses).

### 8.4 Contrast table (computed, WCAG 2.x relative luminance)

| Pair | Light | Dark | Needed |
|---|---|---|---|
| text on background | 15.27 | 15.27 | 4.5 |
| text on surface | 16.13 | 13.43 | 4.5 |
| text on muted | 13.44 | 10.48 | 4.5 |
| text-muted on background | 6.91 | 9.82 | 4.5 |
| text-muted on surface | 7.30 | 8.64 | 4.5 |
| text-muted on muted | 6.08 | 6.74 | 4.5 |
| primary-foreground on primary | 4.67 | 8.80 | 4.5 |
| primary-foreground on primary-hover | 6.01 | 10.34 | 4.5 |
| primary-text on background | 6.01 | 8.80 | 4.5 |
| primary-text on surface | 6.35 | 7.74 | 4.5 |
| primary-text on muted | 5.29 | 6.04 | 4.5 |
| primary-soft-foreground on primary-soft | 7.15 | 8.57 | 4.5 |
| accent-foreground on accent | 8.80 | 8.80 | 4.5 |
| focus-ring on background | 4.52 | 8.80 | 3 |
| focus-ring on muted | 3.97 | 6.04 | 3 |
| input on background / surface | 4.37 / 4.62 | — / 3.44 (raised) | 3 |
| danger on background, on soft | 5.99, 5.35 | 8.21, 8.01 | 4.5 |
| success on background, on soft | 5.86, 5.43 | 9.83, 8.93 | 4.5 |
| warning on background, on soft | 5.40, 5.03 | 10.72, 8.34 | 4.5 |
| logotype gradient top #D4621A on #2A1A0E (large) | — | 4.44 | 3 |
| logotype dark #2A1A0E on cream | 15.27 | — | 3 |
| brand terracotta #D4621A on cream (large text / decoration only) | 3.44 | — | 3 |

Not allowed (documented in CLAUDE.md): #D4621A or #F4AE52 as small text on cream; white or cream body text on
#D4621A; amber focus rings on cream.

### 8.5 What changed per area

| Area | Change |
|---|---|
| Landing | Cover-like hero in both themes (amber corners, gradient logotype as `<h1>`, italic tracked eyebrow like "KONSEP VISUAL", amber and cream-outline buttons, carousel with an amber ring); batik band under the hero; display section titles; batik band instead of the underline bar; stats in the display font; blockchain band in brand brown (amber icons and pill); Cara Kerja circles in soft terracotta / amber / brown; featured badges in `primary-soft`; empty state with the motif; CTA with batik corners and full-strength text; the shared `AppFooter` |
| Navbars, footer | Logotype (auto) in the app and landing navbars (one size smaller on phones, "Main Menu" no longer wraps); active link `primary-text`; footer with a batik band, logotype, `text-muted-foreground`, labelled newsletter input and button |
| Auth | Brand-brown panel with gradient logotype and corners on the right edge (clear of text), amber quote rule; on phones the logotype above the form and a band on top; links `primary-text`, errors `danger` |
| Menu, PROT, events, calendar | Display page titles (menu, PROT list, events, calendar), band on the menu; motif in empty states; PROT type badges with their fill's foreground; review page statuses on success/warning/danger, decision buttons green-700 / amber-700 / red-600 |
| Profile, admin/kurator | Tokens only (no redesign); faded labels → `text-muted-foreground`; admin header brand brown with cream text and amber accents, its icon buttons labelled; sidebar logotype; event placeholder in the brand gradient |
| Games | Start screens and `/main` with display titles and `primary-text`; flash badges over the canvases amber/brown and a darker red; congklak keeps two player colours. Boards, canvases and their art colours unchanged |
| Jelajah chrome | HUD, panels, legend, cards, Paspor, buttons via tokens; batik motif on loading screens; batik band in the Paspor. Map3D, Map2D, `three/`, `lib/jelajah/palette.ts` untouched |
| Bumper | Tokens (unchanged colours code-wise, new palette through them); brand scene: NL icon on a batik motif and the logotype |
| Concept film | Fixed colours mapped: night #120F2A → #2A1A0E (and its glows/skies to browns), golds → #F4AE52, old terracotta → #D4621A / #B4500F, creams → #FEF3E2, the old teal pattern → #7A3410; scene 3 letters in Cinzel Decorative with the logotype gradient (portrait size 1.8rem so it fits 360 px); scene 8 wordmark = `<Logotype variant="gradient">`. Timings, beats, cue sheets, sound and layouts unchanged (tests pass); river/sea art colours kept |

Hard-coded colours changed outside the UI chrome (art): only the concept film's (listed above) and the game flash
badges' gold #FFD24A → #F4AE52 with #2A1A0E text, red #E0412F → #B42318 (white text 4.23 → 6.57:1). Not changed: the
congklak board wood, gasing/egrang canvases, the 3D villages, map colours, the Paspor stamp designs, the film's
river/sea.

### 8.6 Fonts (sources and licences)

| File | Source | Licence |
|---|---|---|
| Poppins 400/500/600/700 (latin subset, 8.5–8.9 KB each) | `https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-{Regular,Medium,SemiBold,Bold}.ttf` (google/fonts commit `8b0a1d0f`) | SIL OFL 1.1, "Copyright 2020 The Poppins Project Authors" |
| Cinzel Decorative Bold (all glyphs, 22.5 KB) | `.../ofl/cinzeldecorative/CinzelDecorative-Bold.ttf` (commit `3dd78844`) | SIL OFL 1.1, "Copyright (c) 2012 Natanael Gama, with Reserved Font Name 'Cinzel'" |

SHA-256 of every source file and the exact build commands: `nusantara-play-fe/app/fonts/README.md`.

### 8.7 Screenshots

`D:/dev-cache/screens/phase-27/before/` and `after/`: landing, menu, prot-list, prot-detail, login, profile, main,
congklak, gasing, egrang, jelajah-hub, bumper-brand, concept-scene3, each `-light|dark-390x844|1440x900.png`.
`hero-vs-cover.png`: the landing hero (1440x900) next to the PDF cover. Working sets with extra pages:
`wip4/` (PROT create, review, events, calendar, admin, signup), `wip6/` (film scenes 1, 7, 8).

## 9. Out-of-scope observations

- `/prot/create` and the edit page: the "Provinsi dan kabupaten/kota" hint line overlaps the "PROVINSI" label (same
  in the Phase 26 screenshots). Added to the Cleanup list.
- axe-core (not colour): the account button of the app navbar on phones has no accessible name; three unlabeled
  buttons on the landing page at 1440 px (carousel); `<select>` elements without labels on `/prot`, `/events`,
  `/calendar` and the PROT form. Added to the Cleanup list.
- No `<input>` uses the new `border-input` token (3:1) yet; inputs keep their own border classes, which resolve to the
  decorative `border` token (1.4:1) where they use one. WCAG 1.4.11 asks 3:1 for input boundaries. Most inputs have a
  filled background that makes them visible, but a cleanup could move every input to `border-input`.
- The login page still has an English heading "Sign In" above "Masuk", and "Continue with Google" (unchanged).
- `app/landing-page/1` and `/2` (old drafts) only got the colour codemods.
- The Egrang start screen's three buttons wrap their labels on desktop ("Mulai / main"), as before this phase.

## 10. Open questions

1. **Icon.** The "NL" monogram is provisional. Will the design team deliver an icon (SVG, at least 512 px, plus a
   simplified 16/32 px version)?
2. **Gradient direction and use.** The PDF's gradient is vertical (sampled: #D2681F at the top of the caps, #EDA149 at
   the baseline). Is that right? And may it appear on cream? The PDF shows it there, but its amber half is not
   readable on cream.
3. **Source files wanted from the design team:** the batik/ornament artwork as SVG (if they have one we should use
   instead of our original drawing), the PDF's exact cover layout (sizes of the corners), the logotype as an outlined
   SVG, and the 3D map source for the next phase.
4. **Hero in the light theme.** It stays dark brown, like the cover. Is that wanted, or should the light theme show a
   cream hero with terracotta corners?
5. **Corner size.** On the site the corners are smaller than on the cover, to keep them off the text. Bigger on
   very wide screens only?

## 11. Ready for next phase?

Yes. The next phase (3D low-poly map, PDF page 4) can start from this branch once it is merged. Nothing blocks it.
Before then, a decision on open questions 1 and 2 would be good, so the map's UI uses the final icon and gradient.
