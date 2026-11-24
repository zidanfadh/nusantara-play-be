# Phase 27: Visual identity refresh (logotype, palette, typography, batik ornaments)

> DRAFT (step 0). Sections 1 to 7 and 9 to 11 are filled in at the end of the phase.

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
  a scalloped quatrefoil outline (an ogee "kawung-like" frame) whose lobes touch the neighbouring frames; the cells sit on
  a square grid turned 45°. In the middle: "KONSEP VISUAL" in Poppins Light Italic, widely tracked, cream; below it the
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
