# Phase 25: Privacy hotfix — hidden PROT documents and media, media audit, admin media removal (pending deploy), PROT input guide, Phase 23 addendum

## 1. Summary

The public site no longer shows any PROT document, nor any file on a new shared denylist. **Merge first: frontend commit
`5b28a7e`** (Step 1, works on its own); `1bd0567` (Step 2) only adds denylist entries and is safe to merge with it.

- **Documents.** Hidden on public pages by default. A build-time flag can turn them back on, and reviewer roles still
  see them.
- **Denylist.** `lib/prot/hidden-media.ts` is applied by every page that shows PROT media. It holds the SEPANGKAL PDF,
  trophy photo and cake link.
- **Audit.** Every media file of the 5 published records was checked: 28 files downloaded, plus metadata for 3 videos.
  10 more files went on the denylist (children's faces with unknown consent, unrelated photos, a private house).
- **Backend.** Two new admin-only routes are ready but **not deployed**: remove one media item from a record in any
  status, and move a published record back to REVISI. Both are audited and tested.
- **Docs and Phase 23 addendum.** The staff guide `docs/panduan-input-prot.md` is written. The egrang pavilion labels
  now name their variant. Every bumper scene fits 844x390 and 740x360.

The phase is complete. Nothing was pushed. The files are still in the public S3 bucket and in the API response until an
admin runs the Step 3 routes after a backend deploy.

## 2. Git

| Repo | Branch | Base | Commits |
|---|---|---|---|
| nusantara-play-fe | `phase-25-privacy-hotfix` | `8b4021f` (main) | `5b28a7e` **MERGE FIRST** (Step 1 hotfix), `1bd0567` (Step 2 audit entries), `ae7a110` (Step 3 docs), `6f050ad` (Step 5), `b586ff7` (CLAUDE.md) |
| nusantara-play-be | `phase-25-privacy-hotfix` | `62671a5` (main, contains the Phase 24 report) | `94448a0` (Step 3 admin routes), `b562d73` (Step 4 guide), `8a38da7` (Step 5 cleanup list), plus the commit that adds this report and the CLAUDE.md updates |

`git diff --stat main...HEAD`:
- frontend: 23 files changed, 685 insertions(+), 39 deletions(-) (before the CLAUDE.md commit `b586ff7`);
- backend: 8 files changed, 1256 insertions(+), 2 deletions(-) (before the report commit).

## 3. Changes

Frontend:
- `lib/prot/hidden-media.ts` (new): the denylist and the shared helpers (`visibleMedia`, `publicProtMedia`,
  `firstVisiblePhoto`, `isHiddenMediaUrl`, `canSeeProtDocuments`), plus the `NEXT_PUBLIC_SHOW_PROT_DOCUMENTS` flag.
- `app/prot/[id]/page.tsx`: every media field goes through `publicProtMedia`. Documents are shown only with the flag or
  to reviewer roles.
- `components/prot/ProtCard.tsx`, `app/page.tsx` (featured cards): first visible photo.
- `components/prot/ProtPhoto.tsx`: renders nothing for a hidden URL (last guard).
- `lib/jelajah/data.ts`, `lib/jelajah/engine/scene-prot.ts`, `lib/jelajah/bumper/scene-data.ts`: hidden photos are
  skipped (hub card, stand panel, 2d cards, bumper strip).
- `.env.example`: the new flag.
- `lib/games/links.ts`, `components/jelajah/GamePrompt.tsx`, `components/jelajah/ProvinceExperience.tsx`: variant
  labels through `gamePlayLabel`.
- `components/jelajah/bumper/{Brand,Prot,Map,Community,Start}Scene.tsx`, `SceneLayout.tsx` (comment): `dense` on every
  scene.
- Tests: `tests/prot/hidden-media.test.tsx` (new), `tests/jelajah/pavilion-labels.test.tsx` (new),
  `tests/jelajah/bumper-dense.test.ts` (new). `tests/landing/landing-images.test.tsx` was updated for the new photo
  variable.
- `CLAUDE.md`:
  - new section "Hidden media and documents (Phase 25)" and the env var;
  - shared sections: Pending deployment item 12, Cleanup list, Current direction, lint baseline, Decisions log.

Backend:
- `src/modules/prot/prot-admin.service.ts` (new): `removeMedia` and `moveToRevisi`, plus pure helpers.
- `src/modules/prot/admin-prot.controller.ts` (new): `POST /api/admin/prot/:id/media/remove` and `POST /api/admin/prot/:id/revisi`.
- `src/modules/prot/dto/admin-prot.dto.ts` (new): the two request bodies.
- `src/modules/prot/prot.module.ts`: registers the new controller and service.
- `src/modules/prot/prot-admin.service.spec.ts` (new, 14 unit tests).
- `test/admin-prot.e2e-spec.ts` (new, 5 e2e tests).
- `docs/panduan-input-prot.md` (new): the staff guide.
- `docs/phase-reports/phase-25.md`: this report.
- `CLAUDE.md`: architecture line, plus the same shared sections as the frontend.

## 4. Decisions

- **Display filter in the frontend.** The denylist filters the data that each page shows; no data is changed. It
  compares URLs without query string or fragment, with the host case-insensitive.
- **Exact URL and field rule.** The cake link is hidden both ways: its exact URL, and a field rule ("every purchase
  link of SEPANGKAL's Biji Pinang").
- **Documents for reviewers.** `/prot/[id]` is public, but the review page links to it. So reviewer roles
  (`kurator_daerah`, `pakar`, `admin_kpoti`, the existing role check) still see documents that are not on the denylist.
  Denylisted documents are hidden from everyone.
- **Edit form unchanged.** `ProtForm` still shows every file. It is only reachable by the owner or an admin in
  DRAFT/REVISI, and it is where a file gets removed.
- **Children's faces count as personal data** (the prompt lists them). A photo with a clearly recognisable child's face
  was hidden even when it matches the game, because consent is unknown. Each such entry says "remove once the curator
  confirms consent". Photos where faces are too small to recognise (thumbnails, distant crowds) were not hidden.
- **Admin removal by exact URL, not by index.** An index shifts after each removal; a URL does not. A repeat finds
  nothing, changes nothing (`removed: false`) and still writes an audit row.
- **S3 delete rule.** Our S3 object is deleted only when all three hold:
  - it is under `prot/`;
  - its field is not `urlPembelian`;
  - nothing else in the record still points to it.
- **Own audit row.** The service writes its own audit row inside the transaction instead of using `AuditInterceptor`.
  The row holds who, the record, the field, the URL and the reason, and never the file contents.
- **Move to REVISI.** Allowed from ARSIP_NASIONAL and DIVERIFIKASI; a record already in REVISI gives `changed: false`.
  `published_at` / `published_by` are kept as history.
- **No migration.** `audit_logs` and `prot` already had everything needed.
- **Bumper.** `dense` was applied to every scene, because all five others overflowed at both sizes. On landscape phones
  of at most 500 px height the scenes therefore lose their visual: the logo, the PROT photos, the map and the icons.

## 5. Deviations

- **Videos were not watched.** The prompt asked for metadata only, so I took size and type with a HEAD request. Whether
  they show children's faces is unknown (section 10).
- **Personal-data scan of documents.** The scan looks for patterns only. Names cannot be detected that way.
- **Screen-reader list in 2D.** The browser check found no screen-reader stand list in the 2d tier. That list is
  rendered by the 3D tiers; the unit test covers its label.
- **Tests run.** Backend: unit tests and only the new e2e file. The full e2e and integration suites were not run.
- **Pending deployment item 12.** It was written in Step 3 and committed in the frontend as its own commit (`ae7a110`).

## 6. Verification

Disk: before C: 11 GB free, D: 336 GB; after C: 11 GB, D: 336 GB.

| Command | Exit | Result |
|---|---|---|
| FE `pnpm test` | 0 | 77 files, **975 passed**, 0 failed (main: 960 after Step 1 adjustments) |
| FE `npx tsc --noEmit` | 0 | clean |
| FE `pnpm lint` | 1 | 44 errors, 80 warnings = baseline unchanged; `eslint` on all 21 touched source files: 0 problems |
| FE `pnpm check:jelajah` | 0 | `check:jelajah OK` (195.6 KB per scene) |
| FE `npx next build` (normal env) | 0 | `✓ Compiled successfully` |
| BE `npx jest` (unit) | 0 | 47 suites, **601 passed** (14 new) |
| BE `jest --config test/jest-e2e.json test/admin-prot` | 0 | **5 passed** (local `nusantara_play_test`, real row lock) |
| BE `npm run build` | 0 | clean |
| BE `npm run lint` | 1 | 220 errors, 29 warnings = baseline unchanged; new and touched files: 0 problems |
| `GET https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&page=1&limit=100` (no auth) | 200 | 5 records |
| `GET` / `HEAD` of every media URL of those records | 200 | 28 files downloaded, 3 videos HEAD only |
| `GET https://api.nusantaralegacy.org/api/stats/landing` | 200 | `totalProt` 12, `totalProvinsi` 7 (see section 9) |

No credentials were used. Only read-only GETs/HEADs reached production, and the production database was never touched.

**Browser check.** Setup:
- a local production build at `localhost:3101`, with the Phase 19/23 scratch login harness (a fake local auth endpoint;
  the Authorization header is removed on `/backend-api`, so production saw only public GETs);
- headless Chrome; the `/prot` pages were checked as a logged-out visitor.

The script decoded every `img`/`srcset`/`video`/link URL on the page and searched it for the 13 hidden object ids and
the cake path.

| Page | Hidden found | Photos | Doc links | Purchase links |
|---|---|---|---|---|
| `/prot/752aeea4-…` SEPANGKAL | 0 | 0 | 0 (no "Dokumen" section) | 0 (no cake link) |
| `/prot/<id>` Egrang Batok | 0 | 4 (expected 4) | 0 | 1 |
| `/prot/<id>` Egrang Bambu | 0 | 7 (expected 7) | 0 | 1 |
| `/prot/<id>` Gasing | 0 | 5 (expected 5) | 0 | 1 |
| `/prot/<id>` Test Permainan Jawa Barat | 0 | 0 | 0 | 0 |
| `/` (scrolled) and `/prot` | 0 | 3 each | 0 | 0 |
| `/jelajah/aceh` 2d grid and SEPANGKAL stand panel | 0 | 0 | 0 | 0 |
| bumper "Arsip PROT" scene, 390x844 | 0 | 3 (Egrang Bambu, Gasing, Egrang Batok) | – | – |
| `/jelajah/jawa-tengah` / `sulawesi-selatan` game card | – | – | – | "Main Egrang Bambu" / "Main Egrang Batok" |

Bumper fit: the area height compared with its scroll height, every scene, reduced motion.

| Size | Before (main) | After |
|---|---|---|
| 844x390 | brand, prot, peta, komunitas, mulai OVERFLOW; game fits | all 6 fit |
| 740x360 | brand, prot, peta, komunitas, mulai OVERFLOW; game fits | all 6 fit |

Screenshots: `D:/dev-cache/screens/phase-25/`. Every remote photo was blurred by injected CSS before capture, so no face
or personal data is visible.
- `prot-sepangkal-1280.png`, `prot-gasing-1280.png`;
- `jelajah-aceh-sepangkal-panel-1280.png`;
- `bumper-prot-strip-390x844.png`;
- `pavilion-card-jawa-tengah.png`, `pavilion-card-sulawesi-selatan.png`;
- `bumper/bumper-<scene>-844x390.png` and `-740x360.png` (12 files).

Downloaded audit files (`D:/dev-cache/tmp/phase-25/audit/`) were **deleted** at the end of the phase.

## 7. Manual checks

1. After merging `5b28a7e` (and `1bd0567`), open `https://nusantaralegacy.org/prot/752aeea4-a9c4-455b-a216-71f508bcfe3c`.
   You should see:
   - "Tidak ada foto" in the gallery;
   - no "Dokumen Kurikulum / Panduan" section;
   - "Biji Pinang" with the plain gear icon and no "Beli di:" link.
2. Open `/prot` and `/`: no card shows a trophy, a house or a scanned book page.
3. `/jelajah/aceh` (logged in): the SEPANGKAL stand panel has no photo. In the intro bumper ("Putar intro" in
   "Tampilan"), the "Arsip PROT" photos are Egrang Bambu, Gasing and Egrang Batok.
4. Landscape phone (or a 844x390 window): replay the intro. No scene needs scrolling; the title and text are centred.
5. `/jelajah/jawa-tengah`: the egrang track button reads "Main Egrang Bambu". In `/jelajah/sulawesi-selatan` it reads
   "Main Egrang Batok". The bumper button still reads "Main Egrang".
6. As a kurator/pakar/admin, a record that has a document (for example Gasing) still shows its document link.
7. After the backend deploy: follow CLAUDE.md "Pending deployment" item 12 to remove the SEPANGKAL files from S3.

## 8. Findings

### Audit of every published media file

5 records, 31 files: 28 downloaded, 3 videos as metadata only. Descriptions contain no personal data. "Faces" means
recognisable children's faces, counted roughly.

| # | Record | Field | Type, size | What it shows | Matches the game? | Action |
|---|---|---|---|---|---|---|
| 1 | SEPANGKAL | fotoKegiatan[0] | PNG 216 KB | Children seated in a circle indoors (about 8 faces) | No | **Hidden** |
| 2 | SEPANGKAL | fotoKegiatan[1] | PNG 855 KB | Children (partly masked) kneeling, picking up stones | No | **Hidden** |
| 3 | SEPANGKAL | dokumenKurikulum[0] | PDF 151 KB, 20 pp. | Certification task letters | No | **Hidden** (Step 1) |
| 4 | SEPANGKAL | "Lapangan" fotoAlat[0] | PNG 243 KB | Scanned book photo, coconut-shell walking ("Tempurung dijepit") | No | **Hidden** |
| 5 | SEPANGKAL | "Lapangan" fotoAlat[1] | PNG 228 KB | Scanned book photo, shell held between the thighs | No | **Hidden** |
| 6 | SEPANGKAL | "Biji Pinang" fotoAlat[0] | PNG 918 KB | Football trophy | No | **Hidden** (Step 1) |
| 7 | Egrang Batok | fotoKegiatan[0] | WEBP 70 KB | Coconut-shell stilt race at a school event (about 5 faces) | Yes | **Hidden** (faces) |
| 8 | Egrang Batok | fotoKegiatan[1] | JPEG 13 KB, small | One child on coconut-shell stilts in a park; face tiny | Yes | Kept; low quality (curator) |
| 9 | Egrang Batok | fotoKegiatan[2] | JPEG 115 KB | Boys in striped shirts on coconut-shell stilts (about 8 faces) | Yes | **Hidden** (faces) |
| 10 | Egrang Batok | videoKegiatan[0] | MP4 4.7 MB | Not watched | ? | Curator to watch |
| 11 | Egrang Batok | dokumenKurikulum[0] | PDF 233 KB, 2 pp. | Text about egrang batok | Yes | Kept (hidden from public by default) |
| 12 | Egrang Batok | fotoAlat[0] | JPEG 92 KB | Two coconut shells with cords | Yes | Kept |
| 13 | Egrang Batok | fotoAlat[1] | JPEG 7 KB, small | Two coconut shells with cords | Yes | Kept; low quality |
| 14 | Egrang Bambu | fotoKegiatan[0] | JPEG 213 KB | Boys on bamboo stilts in a schoolyard (4 faces) | Yes | **Hidden** (faces) |
| 15 | Egrang Bambu | fotoKegiatan[1] | JPEG 12 KB, 275 px | Group in costume on bamboo stilts, spectators; faces tiny | Yes | Kept; low quality, likely a web thumbnail |
| 16 | Egrang Bambu | fotoKegiatan[2] | JPEG 14 KB, 275 px | Bamboo stilt parade; faces tiny | Yes | Kept; low quality, likely a web thumbnail |
| 17 | Egrang Bambu | fotoKegiatan[3] | JPEG 10 KB, 275 px | Students on bamboo stilts on a field; faces tiny | Yes | Kept; low quality, likely a web thumbnail |
| 18 | Egrang Bambu | videoKegiatan[0] | MP4 5.7 MB | Not watched | ? | Curator to watch |
| 19 | Egrang Bambu | dokumenKurikulum[0] | PDF 209 KB, 2 pp. | Text about egrang bambu | Yes | Kept (hidden from public by default) |
| 20 | Egrang Bambu | fotoAlat[0] | JPEG 9 KB | Shop advert graphic ("SPESIAL PROMO", "COD", "GRATIS ONGKIR") with stilts | Partly | Kept; replace (advert text) |
| 21 | Egrang Bambu | fotoAlat[1] | JPEG 24 KB | Two bamboo stilts, catalogue photo | Yes | Kept |
| 22 | Egrang Bambu | fotoAlat[2] | JPEG 488 KB | Many bamboo stilts against a tiled wall | Yes | Kept |
| 23 | Gasing | fotoKegiatan[0] | JPEG 9 KB, small | An adult demonstrating a top at an exhibition | Yes | Kept; low quality |
| 24 | Gasing | fotoKegiatan[1] | JPEG 7 KB, small | Two tops in the air over red earth | Yes | Kept; low quality |
| 25 | Gasing | fotoKegiatan[2] | PNG 593 KB | Adult player throwing a top; crowd with children behind a fence | Yes | **Hidden** (faces in crowd) |
| 26 | Gasing | videoKegiatan[0] | MP4 19 MB | Not watched | ? | Curator to watch |
| 27 | Gasing | dokumenKurikulum[0] | PDF 237 KB, 2 pp. | Text about gasing | Yes | Kept (hidden from public by default) |
| 28 | Gasing | fotoAlat[0] | JPEG 139 KB | Varnished wooden top | Yes | Kept |
| 29 | Gasing | fotoAlat[1] | JPEG 56 KB | Striped top spinning on sand | Yes | Kept |
| 30 | Test Permainan Jawa Barat | fotoKegiatan[0] | PNG 2.1 MB | Front of a residential house with laundry; door sign and meter visible | No | **Hidden** |
| 31 | Test Permainan Jawa Barat | "Gasing" fotoAlat[0] | PNG 2.1 MB (same image as #30) | Same | No | **Hidden** |

Personal-data scan of documents and record texts: counts only, values never printed. The pattern scan used pdf.js text
extraction (installed on D: in scratch).

| File | Pages | 16-digit NIK pattern | Phone | Email | "NIK/KTP" labels | Address hints | Embedded images |
|---|---|---|---|---|---|---|---|
| #3 SEPANGKAL PDF | 20 | 25 | 8 | 8 | 7 | 24 | 34 (not rendered; may include stamps or signatures) |
| #11 Egrang Batok PDF | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| #19 Egrang Bambu PDF | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| #27 Gasing PDF | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| Record text fields (all 5) | – | 0 | 0 | 0 | – | – | – |

Purchase links (domain and product name only):

| Record / equipment | Domain | Product (from the URL) | Plausible? |
|---|---|---|---|
| SEPANGKAL / Biji Pinang | lazada.co.id | "kue biji ketapang kelapa parut" (a cake) | No → hidden |
| Egrang Batok / Egrang Batok | shopee.co.id | not in the URL (numeric product id); the URL carries an ad-tracking signature | Unknown; curator to open |
| Egrang Bambu / Egrang Bambu | tokopedia.com | "egrang bambu mainan tradisional 120 cm…160 cm" | Yes |
| Gasing / Gasing | tokopedia.com | "mainan panggal kayu gasing … bentuk ufo super jumbo" | Yes (a modern wooden top) |

For the curator (low quality, not hidden):
- #8, #13, #15, #16, #17, #23, #24 are small (≤ 275 px) and several look like web thumbnails (source and rights unknown);
- #20 is a shop advert;
- the three videos (#10, #18, #26) should be watched for children's faces;
- the 4 hidden "faces" photos (#7, #9, #14, #25) can return once consent is confirmed.

### Denylist entries (`nusantara-play-fe/lib/prot/hidden-media.ts`)

| # above | Field | Reason in the file |
|---|---|---|
| 3 | SEPANGKAL dokumenKurikulum | Personal data: names and national ID (KTP) numbers of real people; unrelated to the game |
| 6 | SEPANGKAL "Biji Pinang" fotoAlat | Unrelated and embarrassing: a football trophy, not the equipment |
| – | SEPANGKAL "Biji Pinang" urlPembelian (exact URL + field rule) | Unrelated purchase link: a cake product |
| 1, 2 | SEPANGKAL fotoKegiatan | Children's faces (consent unknown); shows another game |
| 4, 5 | SEPANGKAL "Lapangan" fotoAlat | Unrelated: scanned book photo of a coconut-shell game (source and rights unknown) |
| 7, 9 | Egrang Batok fotoKegiatan | Children's faces clearly recognisable (consent unknown); remove once confirmed |
| 14 | Egrang Bambu fotoKegiatan | Same |
| 25 | Gasing fotoKegiatan | Children's faces among the spectators (consent unknown) |
| 30, 31 | Test record fotoKegiatan, fotoAlat | Unrelated and possibly a private home: front of a residential house |

### Where PROT documents and media were rendered (Step 1.1)

| Place | Before | Now |
|---|---|---|
| `/prot/[id]` | Every document link, every photo, video, purchase link | Through `publicProtMedia`; documents only with the flag or for reviewer roles |
| `/prot` cards (`ProtCard`) | First activity photo | `firstVisiblePhoto` |
| Landing featured cards (`app/page.tsx`) | First activity photo | `firstVisiblePhoto` |
| Jelajah hub card, bumper strip (`lib/jelajah/data.ts`) | `firstPhoto(fotoKegiatan)` | `visibleMedia` + `firstPhoto` skips hidden URLs; `pickProtPhotos` filters again |
| Stand panel, 2d cards (`scene-prot.ts`) | `firstPhoto(fotoKegiatan)` | `visibleMedia` |
| Concept film (`lib/jelajah/concept/live.ts`) | Names only | Unchanged (no media) |
| Open Graph | No PROT images | Unchanged |
| Review page `/prot/verifikasi/[id]/review` | No media; links to `/prot/[id]` | Unchanged (reviewers see documents on `/prot/[id]`) |
| History page | Pakar's own `dokumen_pendukung` (not PROT media) | Unchanged |
| Edit form `ProtForm` (owner/admin, DRAFT/REVISI) | All files | Unchanged, so files can be removed there |

### Backend (Step 3)

Before this phase, nothing could move a published record back to REVISI. Only a pakar's review moves DIKURASI to REVISI.

The two new routes, steps and expected answers are in CLAUDE.md "Pending deployment" item 12, which also has the exact
steps to remove the SEPANGKAL PDF:
1. Get an admin token.
2. `POST /api/admin/prot/752aeea4-…/media/remove` with `{"field":"dokumenKurikulum","url":"<PDF URL>","reason":"…"}`.
3. Check that `curl -I <PDF URL>` answers 403 or 404 (if `s3Deleted` was false, someone with AWS access deletes it by hand).
4. The same for the trophy photo and the cake link.
5. Optionally `POST …/revisi`.

### Counts per status (Step 4)

No public endpoint gives counts per status; an admin account is needed. The only public total, production
`GET /api/stats/landing`, answered `totalProt` 12 / `totalProvinsi` 7. The deployed backend still counts every status
there (Pending deployment item 11 is not deployed). Compared with the 5 published records, that suggests **7
unpublished records** exist.

## 9. Out-of-scope observations

1. **The files are still public.** The PDF and the other hidden files stay in the public S3 bucket, and their URLs stay in
   the public API JSON, until the backend routes are deployed and used. Uploads are public even while a record is DRAFT.
2. **Resubmitting after REVISI fails in the UI.** "Ajukan Verifikasi" calls the first-submission route, which the server
   refuses for REVISI. The resubmit route exists, but the site does not use it.
3. **Missing form fields.**
   - The form has no field for `deskripsi` (shown in Jelajah stand panels) or `jumlahPemain`.
   - It always sends the submission note "Diajukan oleh pengguna".
   - It offers DOC/DOCX uploads, which the server rejects.
4. **Reviewers can verify their own records.** Nothing stops a reviewer from verifying a record they created
   (`kurator_daerah` in their province), and there is no minimum review time. This matches the 44-second SEPANGKAL
   review seen in Phase 24.
5. **Unknown photo sources.** Several published photos look like web thumbnails (rights unknown).
6. **Tracking parameter.** The Shopee link carries an ad-tracking signature.
7. **Audit entity type (not verified).** `AuditInterceptor` derives `entity_type` from the first URL segment, which looks
   like it would be `api` for every audited route.
8. **SEPANGKAL has no photos left.** Its page and stand now show no photo at all.

## 10. Open questions

1. Merge `5b28a7e` and `1bd0567` to main now (Vercel)? Both are independent of the backend.
2. **Children's faces:** keep the 4 matching-game photos (#7, #9, #14, #25) hidden until the curator confirms consent,
   or restore any now?
3. Who can deploy the backend, and which admin account will run the removal steps (Pending deployment item 12)?
4. The 7 unpublished records: should they get the same media audit (needs an admin account) before anyone publishes them?
5. Should SEPANGKAL stay published with no photos, or be moved to REVISI after the deploy until the curator completes
   it (Phase 24 open questions)?
6. A small phase for the UI gaps in section 9 (resubmit after REVISI, the deskripsi / jumlahPemain fields, the submission
   note, DOC uploads), and a rule against reviewing one's own record?
7. Curator: watch the three videos, replace the low-quality photos and the advert graphic, open the Shopee link.

## 11. Ready for next phase?

Yes for the frontend: merge `5b28a7e` first, then the rest of the branch. The backend part waits for server access
(Pending deployment items 1 to 12). After the deploy, an admin must remove the SEPANGKAL files from S3; until then they
remain reachable by URL.
