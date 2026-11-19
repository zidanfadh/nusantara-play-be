# Phase 14: Image weight on the landing page and other public pages

## 1. Summary

The landing page `/` now uses the same optimized photo approach as `/prot`. The featured PROT go through `ProtPhoto`, and
the hero carousel, which is shown only on desktop, goes through next/image and is never downloaded on phones. A phone cold
load of `/` dropped from **1597 KB to 666 KB**, under the 800 KB target; desktop went from 1594 KB to 754 KB.
Optimized images are now cached for 31 days. Before raising the TTL, the backend was checked: every upload gets a new
UUID object key, so a replaced photo always has a new URL. `/events`, the event detail page, `/nfts` and the NFT detail
page load no remote images in production (their only event and NFT have no images), so `ProtPhoto` was not generalized
and `remotePatterns` was not widened. The site now really displays Plus Jakarta Sans and Geist Mono. That change is in
its own commit, which can be reverted alone; it also includes one small navbar fix for a 1 px overflow the wider font
caused. **The phase is complete.** Tests, lint, the build, the Jelajah checks and all measurements passed.

## 2. Git

Step 0 checks passed. Frontend `main` was at `f74dfe1`, the merge of PR #12 with the Phase 13 commits (`ProtPhoto` in
`8264e44`). Backend `main` was at `77eaf70` and contains `docs/phase-reports/phase-13.md`. Both repos were on a clean
`main`, pulled (fast-forward) before branching. Nothing was pushed.

**nusantara-play-fe**, branch `phase-14-public-images`, base `f74dfe1`:

| Commit | Step |
|---|---|
| `d61e6e2` | Step 1: `images.minimumCacheTTL` 31 days |
| `c2c3f00` | Step 2: landing page featured PROT through `ProtPhoto`, carousel through next/image, file rename |
| (none) | Step 3: no code change needed (see 8.3) |
| `dae39b4` | Step 3b: fonts displayed (`@theme inline`), landing navbar spacing below `sm` (own commit, revertible) |
| `efd3b69` | Step 5: CLAUDE.md |

`git diff --stat f74dfe1..efd3b69`: 9 files changed, 239 insertions(+), 40 deletions(-)

```
 CLAUDE.md                                          |  68 ++++++++++++++-
 app/globals.css                                    |  16 +++-
 app/page.tsx                                       |  16 ++--
 components/ui/HeroCarousel.tsx                     |  95 +++++++++++++++------
 next.config.ts                                     |   9 ++
 .../landing/{nusland (1).webp => nusland.webp}     | Bin
 tests/config/fonts.test.ts                         |  10 +++
 tests/landing/landing-images.test.tsx              |  60 +++++++++++++
 tests/prot/prot-photo.test.tsx                     |   5 +-
```

**nusantara-play-be**, branch `phase-14-public-images`, base `77eaf70`:

| Commit | Step |
|---|---|
| `b97d857` | Step 5: CLAUDE.md |
| (this report) | Step 5: `docs/phase-reports/phase-14.md`, committed separately (hash in the final message) |

`git diff --stat 77eaf70..b97d857`: 1 file changed, 36 insertions(+), 1 deletion(-) (`CLAUDE.md`). Nothing in `src/` changed.

## 3. Changes

Frontend:
- `next.config.ts`: `images.minimumCacheTTL: 2_678_400` (exported `IMAGE_MINIMUM_CACHE_TTL_SECONDS`), with a comment
  explaining that it depends on the backend never reusing an S3 key.
- `tests/prot/prot-photo.test.tsx`: the image config may now contain exactly `remotePatterns` and `minimumCacheTTL`
  (31 days); `remotePatterns` is still checked against `isOptimizableProtPhoto()`.
- `app/page.tsx`: featured PROT photo through `ProtPhoto size="cover"` (lazy) instead of a plain `<img>`. In the
  Step 3b commit: the navbar's right-hand group uses `space-x-2`, "Masuk" `px-3` and "Daftar" `px-4` below `sm`
  (unchanged from `sm` up).
- `components/ui/HeroCarousel.tsx`: slides are static imports passed through `getImageProps` into `<picture>`. The
  optimized srcset sits on a `<source media="(min-width: 1024px)">`; below that the `<img>` shows a 1x1 data URI.
  The first slide is eager with `fetchPriority="high"`, the second is lazy. `sizes` follows the box and the
  object-cover crop (`heroSlideSizes`). New exports: `HeroSlideImage`, `heroSlideSizes`, `HERO_CAROUSEL_MEDIA`,
  `EMPTY_IMAGE`.
- `public/images/landing/nusland (1).webp` → `public/images/landing/nusland.webp`, renamed (`git mv`, same bytes).
  Its only reference was `components/ui/HeroCarousel.tsx` (now a static import); no other file, CSS or doc
  referenced it.
- `tests/landing/landing-images.test.tsx` (new, 5 tests): the slide's `<source>` has the media query and an
  `/_next/image` srcset, the `<img>` has neither (no download below `lg`); first slide eager/high, second lazy; `sizes`
  for square and 3:2 images; `app/page.tsx` renders featured photos with `ProtPhoto` and no `<img>`; landing image file
  names use only `a-z0-9.-`.
- `app/globals.css` (Step 3b): `--font-sans` / `--font-mono` moved from the plain `@theme` block to a new
  `@theme inline` block; the `body` rule uses `var(--font-jakarta-sans), Arial, Helvetica, sans-serif`.
- `tests/config/fonts.test.ts`: the font lines are in `@theme inline` and in no plain `@theme` block, and `body` uses
  the next/font variable.
- `CLAUDE.md`: Key Conventions, the Phase 13 photo section, a new section "Public page images (Phase 14)", the shared
  sections (Current direction, lint baseline, Decisions log).

Backend:
- `CLAUDE.md`: a note on the `storage/` module (keys are never reused, because the frontend relies on that) and the
  shared sections (identical to the frontend's, checked with `diff`).
- `docs/phase-reports/phase-14.md`: this report.

## 4. Decisions

- **Shared cache entries.** The featured PROT on `/` use the existing `cover` size (400 px box, 640 / 828), so they
  reuse the exact variants `/prot` already creates and add no new transformations. The cards are square
  (about 342 px on a phone), so at dpr 3 an 828 px photo is drawn slightly upscaled. A third size would add
  transformations for little visible gain.
- **No carousel download on phones.** The carousel sits in `hidden lg:block`, and browsers still download an eager
  `<img>` inside `display: none` (the before measurement: 379 KB + 46 KB on the phone). The `<picture>`/`<source media>`
  pattern from the Next.js art-direction docs avoids that without delaying the desktop image until hydration.
- **No `<link rel=preload>` for the hero.** React's and Next's preload cannot be limited to a media query, so a preload
  would download the photo on phones again. Instead the first slide is eager with `fetchpriority="high"` in the
  server-rendered HTML, where the preload scanner finds it.
- **`sizes`**: about 510 px from 1280 px up (lg:col-span-5 of max-w-7xl, scaled 105 %) and 44vw between 1024 and
  1279 px; multiplied by the aspect ratio for the 3:2 `nusland.webp`, because object-cover draws it 1.5 times as wide
  as the box. Measured on desktop: `hero` w=640, `nusland` w=828.
- **The body font rule** references `var(--font-jakarta-sans)` directly. With `@theme inline` alone, the `font-sans`
  utility works, but the `body` rule (`var(--font-sans)`) and Tailwind's `html` default would still resolve on
  `:root` and stay on the system font. Most pages do not set `font-sans` themselves.
- **Font "before" screenshots** were taken on the Step 2 build, so the before/after pair differs only in the font.

## 5. Deviations

- The hero image is at `public/images/landing/nusland (1).webp`, not `public/nusland (1).webp` as the prompt says. It
  was handled there.
- **Priority went to the first slide, not to `nusland`.** `nusland.webp` is the *second* slide of the carousel
  (`hero.webp`, 46 KB, is the one visible on load), so it is lazy, and `hero.webp` is eager with high fetch priority.
  Giving the off-screen slide priority would compete with the visible image. On desktop both still load right away
  (Chrome loads lazy images near the visible part of the scroller).
- `app/globals.css` is not in the "Allowed changes" list, but Step 3b requires changing it. The navbar spacing fix in
  `app/page.tsx` is part of the font commit so it reverts together with it.
- Step 3 changed no code (no `RemotePhoto`, no new `remotePatterns`), because its condition did not hold (8.3), so there
  is no Step 3 commit.
- The font screenshots also include `/jelajah/sumatera-selatan` (the scene's overlays), in addition to the four pages
  asked for.

## 6. Verification

Session env for every command: `TEMP`/`TMP`/`TMPDIR=D:/dev-cache/tmp`, `npm_config_cache=D:/dev-cache/npm`,
`NEXT_TELEMETRY_DISABLED=1`. Free space before: **C: 13 GB, D: 347 GB**. After: **C: 13 GB, D: 346 GB** (checked after
every build and browser run; C: never changed).

- `pnpm exec vitest run tests/prot tests/config` (after Step 1): exit 0, 4 files, 48 passed.
- `pnpm exec vitest run tests/landing` (Step 2): exit 0, 5 passed.
- `pnpm exec vitest run tests/config/fonts.test.ts` (Step 3b): exit 0, 3 passed.
- `pnpm test`: exit 0, **26 files, 327 passed, 0 failed, 0 skipped**.
- `pnpm exec eslint -f json .`: **44 errors, 82 warnings**, the same as after Phase 13 (no-explicit-any 39,
  no-unused-vars 47, no-img-element 21, exhaustive-deps 14, no-empty-object-type 4, set-state-in-effect 1). Touched
  files: `components/ui/HeroCarousel.tsx`, `next.config.ts` and the three test files have 0 problems. `app/page.tsx` has
  one warning, `'LandingStats' is defined but never used`, which is also on `main`
  (`git show main:app/page.tsx | eslint --stdin` → same warning). The old `no-img-element` warnings were already
  silenced with disable comments, which are now gone together with the `<img>` elements.
- `NEXT_PUBLIC_SUPABASE_URL=https://supabase-placeholder.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
  NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api pnpm build`: exit 0, `✓ Compiled successfully in
  13.8s`. (Earlier builds for the measurements: before, after Step 2, and twice for Step 3b, all exit 0.)
- Jelajah and three.js checks (production build, production API, read-only; the Phase 13 check script):

```
dark reload / , /prot, /jelajah (desktop and phone): html.dark=true toggler=sun console=clean
cold / desktop: 754 KB; three chunk not loaded          cold / phone: 666 KB; three chunk not loaded
cold /prot desktop: 572 KB; three chunk not loaded      cold /prot phone: 628 KB; three chunk not loaded
cold /jelajah desktop: 694 KB; three chunk LOADED (c77ae571dc1f29f9.js 241 KB)   phone: 669 KB; LOADED
cold /jelajah/sumatera-selatan desktop: 761 KB; LOADED                         phone: 729 KB; LOADED
scene desktop/phone: banner="PROT Sumatera Selatan sedang dalam proses kurasi. … Kembali ke peta"
  HUD="Lv 1 25 / 100 XP Simulasi · tidak disimpan Paspor 0/35 Misi"; stands 1–6: segera hadir
  misi: 0 / 3 stan dibuka … misi ini belum bisa diselesaikan.
  after "Kembali ke peta": /jelajah HUD="Lv 1 25 / 100 XP …"; console: clean
intro check (full, full + reduced motion, lite): screenshots taken
```

  These are the same results as in Phase 13 (`/jelajah` 670 to 690 KB, the scene 727 to 745 KB then). The three.js chunk
  loads only on the two /jelajah routes.
- Screenshots (`D:/dev-cache/screens/phase-14/`), phone, before and after:
  `before-home-phone.png`, `after-home-phone.png` (+ `after-home-desktop.png`, `step2-home-phone.png`),
  `before-events-phone.png`, `after-events-phone.png`, `before-event-detail-phone.png`, `after-event-detail-phone.png`,
  `before-nfts-phone.png`, `after-nfts-phone.png`, `before-nft-detail-phone.png`, `after-nft-detail-phone.png`,
  `before-prot-phone.png`, `after-prot-phone.png`; Jelajah/dark checks: `check-*.png` (15 files).
- Font screenshots (`D:/dev-cache/screens/phase-14-font/`), `before-` and `after-` × `home`, `prot`, `prot-detail`,
  `jelajah`, `jelajah-sumsel` × `phone`, `desktop` (20 files).

## 7. Manual checks

1. Check out `phase-14-public-images` in the frontend, then run `pnpm build` and `pnpm start` with
   `NEXT_PUBLIC_BACKEND_API_URL=https://api.nusantaralegacy.org/api`.
2. Open `/` in Chrome DevTools, device "iPhone 12 Pro", with Network → Disable cache, and reload. You should see no
   request for `hero` or `nusland`. The featured PROT photos load only when you scroll to "Permainan Unggulan", as
   `/_next/image?url=…&w=828`. The total is about 650 to 700 KB before scrolling.
3. Switch to a desktop viewport and reload. The carousel shows the village image (`/_next/image?url=…hero…&w=640`,
   with `fetchpriority=high` on its `<img>`). Swiping to the second slide shows the Virtual Tour image (`…nusland…`).
4. Check the font. The text should be in Plus Jakarta Sans (geometric, single-storey "a"); the computed `font-family` of
   `<body>` starts with the Jakarta family. Compare `before-*.png` and `after-*.png` in
   `D:/dev-cache/screens/phase-14-font/`.
5. Open `/jelajah/sumatera-selatan` on a phone viewport. The title bar, HUD, banner, help hint and joystick should look
   as in Phase 13, only in the new font, with no cut-off text.
6. To go back to the old look, revert only `dae39b4`.

## 8. Findings

### 8.1 Cache TTL (Step 1)

Every S3 write goes through `StorageService.uploadFile(file, folder)`, which builds
`key = <folder>/<randomUUID()>.<extension of originalname>`. That is unchanged since the repo's first commit `2c79d16`.
Callers:

| Path | Folder |
|---|---|
| `POST /prot/:id/foto-kegiatan` (`addFotoKegiatan`) | `prot/foto-kegiatan` |
| `POST /prot/:id/video-kegiatan` | `prot/video-kegiatan` |
| `POST /prot/:id/dokumen-kurikulum` | `prot/dokumen-kurikulum` |
| `POST /prot/:id/peralatan/:i/foto` (`addFotoAlat`) | `prot/peralatan` |
| `POST /nfts/upload/image` (`NftsService.uploadImage`) | `images/nfts` |
| `POST /upload/image`, `/upload/avatar`, `/upload/document`, `/upload/video` | `images`, `images/avatars`, `documents`, `videos` |

- The same file name uploaded twice gives two different UUID keys. "Replacing" a photo means removing it (S3 delete
  after the DB save) and adding a new upload, which gets a new key and a new URL.
- `getPresignedUrl(key)` would accept a caller-chosen key, but nothing calls it. No other code in `src/` uses
  `PutObjectCommand` or `S3Client`.
- Events have no upload of their own: `banner_url` is a free-text URL field in the event form.
- Conclusion: no path overwrites a key, so `minimumCacheTTL` = 2678400 was set.

**Effect on Vercel transformations.** Vercel bills a transformation when a variant (source URL × width × quality ×
format) is not in its cache. The cache lifetime is the larger of `minimumCacheTTL` and the upstream `max-age`; S3 sends
none. Before, every requested variant could be transformed again every 4 hours (up to about 180 times a month). Now it is
about once per 31 days. Today that means about 24 PROT photos × at most 4 variants, plus the 2 carousel images × a
few widths: on the order of 100 transformations a month in the worst case, far below the Hobby limit of 5K. Cache
reads and writes drop the same way.

### 8.2 Landing page (Step 2)

Production API, read-only GET; production build with `next start`; headless Chrome, cache disabled, no throttling;
phone 390x844 dpr 3, desktop 1440x900. "Cold" = load without scrolling.

| `/` | Before | After |
|---|---|---|
| Phone, cold | **1597 KB** (45 requests, images 1233 KB) | **666 KB** (38 requests, images 296 KB) |
| Phone, scrolled to the bottom | — | 893 KB |
| Desktop, cold | 1594 KB | 754 KB (images 384 KB) |
| Desktop, scrolled to the bottom | — | 926 KB |

10 largest files before (phone): `nusland%20(1).webp` 379 KB, PROT `345613bf….png` 217 KB, PROT `25cc34fc….jpg` 213 KB,
`nusantara-legacy.webp` 126 KB, `sertifikasi.webp` 85 KB, PROT `5b992115….webp` 71 KB, JS chunks 69, 53, 47 KB,
`hero.webp` 46 KB.

10 largest after (phone): `nusantara-legacy.webp` 126 KB, `sertifikasi.webp` 85 KB, JS 69, 53, 47 KB, `arsip.webp` 39 KB,
`komunitas.webp` 31 KB, JS 30 KB, the document `/` 27 KB, `PlusJakartaSans_latin….woff2` 27 KB.

Target met (666 KB < 800 KB). What remains: the five other landing images, still plain `<img>` and outside this step's
scope (about 296 KB on a phone, see section 9), and about 330 KB of JS, CSS and fonts shared by every page.

### 8.3 Other public pages (Step 3)

Production data, read-only GET: `/api/events` has 1 event (`65dda91f…`, `banner_url: null`, `galeri_foto: null`;
`status=published` returns 0). `/api/nfts` has 1 NFT (`gasing-heritage`, `image_url: null`, `gallery_urls: null`,
no linked PROT). So none of these pages loads a remote image, and the condition for `RemotePhoto` and a wider
`remotePatterns` does not hold.

| Page (phone, cold) | Before | After |
|---|---|---|
| `/events` | 334 KB, 0 images | 334 KB, 0 images |
| `/events/65dda91f-…` | 348 KB, 0 images | 348 KB, 0 images |
| `/nfts` | 334 KB, 0 images | 334 KB, 0 images |
| `/nfts/gasing-heritage` | 370 KB, 0 images | 370 KB, 0 images |
| `/prot` (reference) | 616 KB | 616 KB |

Desktop: `/events` 356 → 356, event detail 366 → 366, `/nfts` 360 → 394 (37 → 48 requests: route prefetches, no images),
NFT detail 399 → 399 KB.

### 8.4 Fonts (Step 3b)

| | Before | After |
|---|---|---|
| `getComputedStyle(body).fontFamily` | `ui-sans-serif, system-ui, sans-serif, …` | `jakartaSans, "jakartaSans Fallback", Arial, Helvetica, sans-serif` |
| Fonts in use (`document.fonts` loaded) | none (both woff2 still downloaded via preload) | jakartaSans everywhere; geistMono on the PROT detail page (blockchain proof) |

The overflow probe checked elements wider than the viewport and text clipped by its box, on `/`, `/prot`, the
`752aeea4` detail page, `/jelajah` and `/jelajah/sumatera-selatan`, at 390x844 and 1440x900. It found no horizontal
page overflow before or after; the only hit is the intended `sr-only` label. Visual comparison:
- **Landing navbar, phone (fixed):** with Jakarta, "Daftar" ended at x 391 in a 390 px viewport, touching the screen
  edge; before, it ended at 383. The probe skips `position: fixed`, so this was found by eye and measured. After the
  fix: 390 px "Daftar" 285 to 366 (= 390 − 24 px padding); 360 px 262 to 343.
- The landing hero badge now wraps to two lines on phones (no overflow; the pill grows).
- Jelajah scene, phone: title bar, HUD, Paspor and Misi buttons, banner, help hint and "Mengerti" keep their sizes;
  text is slightly wider and wraps differently in the banner and hint, with nothing cut off. The canvas stand signs use
  their own font constant and are unchanged.
- `/prot` cards and the detail page: same layout, nothing clipped.

## 9. Out-of-scope observations

- The other landing images are still plain `<img>`: `nusantara-legacy.webp` (126 KB, 1920x1080 for a box 320 px high
  on phones), `sertifikasi.webp` 85 KB, `arsip.webp` 39 KB, `komunitas.webp` 31 KB and `blockchain.webp` 15 KB. The
  blockchain image is in `hidden lg:block` but still downloads on phones. The same `<picture>` or next/image approach
  would save roughly another 200 KB on a phone.
- The landing navbar still overflows at 320 px (content 343 px; before this phase 391 px). It would need a smaller logo
  or hiding "Masuk" on very small screens.
- `/events/[id]`, `/nfts` and `/nfts/[slug]` would render remote images with plain `<img>` once data has them. NFT
  uploads land under `/images/nfts/`. Event banners are a free-text URL that can point anywhere, so they can only be
  optimized if the form switches to an upload.
- The landing page and the HeroCarousel link still say "Nusantara Virtual" and point to `nusantaraplay.kpoti.id` and a
  `wellmagicteam.com` demo (brand rename waits for the boss).
- `THREE.Clock` deprecation warning in the console on the Jelajah pages (also before this phase; filtered by the check
  script).
- Unused `LandingStats` type import in `app/page.tsx` (lint warning, also on `main`).

## 10. Open questions

1. Should the remaining landing images (section 9) get the same treatment in a later phase? About 200 KB more on a
   phone.
2. The font change is visible across the whole site (in its own commit, `dae39b4`). Does the boss prefer it, or should
   that commit be reverted before merging?
3. Is the Vercel project on Hobby or Pro? (Still open from Phase 13; with the 31-day TTL the worst case is now far
   below the Hobby limit either way.)

## 11. Ready for next phase?

Yes. Nothing blocks. The branch is ready for a Vercel preview, so the boss can look at the font change (decide on
open question 2 before merging).
