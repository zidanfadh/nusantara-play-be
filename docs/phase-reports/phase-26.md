# Phase 26: PROT form and review workflow fixes (from the Phase 25 findings)

## 1. Summary

The content team can now fix PROT records themselves. All frontend changes work against the backend that is in
production today, so they go live with a Vercel deploy. The phase is complete. Nothing was pushed.

What changed in the form and the submission:
- **New form fields.** "Deskripsi Singkat" (with a character counter against the Jelajah stand panel) and "Jumlah
  Pemain". A badge marks the fields the guide recommends for Jelajah.
- **Uploads.** The form offers only the file types and sizes the server accepts. Refused files get a clear Indonesian
  message, and Word files are told to be saved as PDF first.
- **Submitting.** "Ajukan Verifikasi" opens a dialog with a five-point checklist and an optional note of the
  contributor's own.
- **REVISI records.** These use the resubmit route ("Ajukan Ulang") and show the reviewer's notes prominently.

The review page shows every text and every photo, video, document and purchase-link domain. It warns a reviewer who
created the record.

The backend now forbids self-review: the creator cannot claim, decide on or publish their own record. An admin may
do so only with a written reason, which is audited. The resubmit route also accepts a note. **These two backend
changes wait for a deploy** (Pending deployment item 13). Until then, two frontend flags stay off.

A bug found on the way and fixed: the edit page sent read-only API fields (`kecamatanName`, `desaName`), which the
backend rejects with 400. Create and edit now send only the DTO's keys.

## 2. Git

| Repo | Branch | Base | Commits |
|---|---|---|---|
| nusantara-play-fe | `phase-26-prot-form-review` | `111b187` (main, Phase 25 merge PR #22) | `5877685` step 1, `3232fab` step 2, `1161fac` step 3, `da8bb7e` step 4, `56e7ca8` CLAUDE.md |
| nusantara-play-be | `phase-26-prot-form-review` | `8686135` (main, Phase 25) | `b8cf586` step 0, `6bd9062` step 5, `ef7ff3d` step 6 (guide), `aedfdeb` CLAUDE.md, plus the commit that adds this report |

`git diff --stat` against the base (before this report):
- frontend: 22 files changed, 2146 insertions(+), 107 deletions(-);
- backend: 15 files changed, 927 insertions(+), 35 deletions(-).

Step 7 (verification) changed no files, so it has no commit.

## 3. Changes

Frontend, new files:
- `lib/prot/form-fields.ts`: field rules (counter, `parseJumlahPemain`, recommended fields, help texts) and
  `toProtWritePayload()`, the whitelist request body for create and update.
- `lib/prot/backend-features.ts`: the two flags `NEXT_PUBLIC_PROT_RESUBMIT_NOTE` and
  `NEXT_PUBLIC_PROT_SELF_REVIEW_RULE`, both off by default.
- `lib/prot/submission.ts`: route choice, who may submit, the note, `submitProt()`, `latestRevisionNote()`.
- `lib/prot/upload-rules.ts`: accepted types and sizes per field; `checkFiles()` with Indonesian errors.
- `lib/prot/submit-checklist.ts`: the five checklist points.
- `lib/prot/review-media.ts`: every media item for the review page, link domains, self-review state, override reason
  check.
- `components/prot/FormHints.tsx`: badge, help text, counter, upload error list.
- `components/prot/SubmitDialog.tsx`: the submission dialog, with the checklist and the note field.
- `components/prot/RevisionNotice.tsx`: the reviewer's notes on REVISI records.
- `components/prot/ReviewMediaPanel.tsx`: media panel and self-review warning.
- Tests: `tests/prot/form-fields.test.tsx`, `submission.test.tsx`, `upload-checklist.test.tsx`,
  `review-media.test.tsx` (60 tests).

Frontend, changed files:
- `components/prot/ProtForm.tsx`: new fields, badges, upload checks, accept lists and limits.
- `app/prot/create/page.tsx`, `app/prot/[id]/edit/page.tsx`: whitelist payload. The edit page also shows the REVISI
  notice.
- `app/prot/[id]/page.tsx`:
  - shows "Ringkasan" and "Jumlah Pemain";
  - the submission dialog replaces `confirm()` and the fixed note;
  - shows the REVISI notice;
  - only the creator sees the submit button;
  - publish warns about self-publishing, and asks for a reason only when the flag is on.
- `app/prot/verifikasi/[id]/review/page.tsx`: every text in full, the media panel, the self-review warning, and the
  override reason when the flag is on.
- `lib/api/prot.ts`: `resubmit(id, catatan?)`, plus `selfReviewOverrideReason` on `review` and `publish`.
- `types/prot.ts`: `deskripsi`, `jumlahPemain`, `kecamatanName`, `desaName`.
- `CLAUDE.md`: new section "PROT form and review (Phase 26)", the env flags, and the shared sections.

Backend:
- `src/modules/prot/self-review.ts` (new): `checkSelfReview()` and the audit action name.
- `src/modules/prot/self-review.spec.ts` (new): tests for the rule and the DTO fields.
- `src/modules/prot/verifikasi.service.ts`: the rule on pick and on review, with the override audit row.
- `src/modules/prot/prot.service.ts`: the rule on publish, with the override audit row. `resubmitAfterRevisi()` stores
  the note.
- `src/modules/prot/verifikasi.controller.ts`: passes the role and the override reason to publish.
- `src/modules/prot/prot.controller.ts`: optional `SubmitKurasiDto` body on resubmit.
- `src/modules/prot/dto/verifikasi-review.dto.ts`, `dto/publish-prot.dto.ts`: optional `selfReviewOverrideReason`
  (10 to 500 characters).
- `src/modules/prot/prot.module.ts`: `AuditLog` repository.
- `src/modules/prot/prot.service.spec.ts`, `verifikasi.service.spec.ts`: audit mock and the Phase 26 tests.
- `test/prot-self-review.e2e-spec.ts` (new): 4 e2e tests.
- `docs/panduan-input-prot.md`: guide update (Step 6).
- `CLAUDE.md`: architecture line and the shared sections.
- `docs/phase-reports/phase-26.md`: this report.

## 4. Decisions

- **No length limit on `deskripsi`.** The backend has none (`@IsString`, column `text`), so the counter is a guide
  (280 characters = what the stand panel shows) and never an error. I did not add a `MaxLength` to the backend: existing
  longer texts would then fail on their next edit.
- **`jumlahPemain`** is a whole number from 1 to 2147483647 (the PostgreSQL `int` range; the DTO has no maximum). On
  update an empty field is sent as `null`, which clears the value.
- **Help texts must be true, so `/prot/[id]` now shows both fields.** It showed neither before. The stand panel shows
  only `deskripsi`.
- **"Recommended for Jelajah"** = the guide's list (name, province/regency, first activity photo, how to play, moral
  values) plus `deskripsi`, which the stand panel shows.
- **Whitelist payload.** The DTO keys are copied into the request body instead of stripping known read-only keys. This
  fixes the edit page, which sent `kecamatanName` / `desaName` (proven in e2e: such a PATCH gets 400).
- **Only the creator sees the submit button.** The server always refused an admin who is not the creator, so the
  button only produced an error for them.
- **Upload limits below the server's 100 MB**: photos 10 MB, videos 50 MB, PDF 20 MB, 10 files per save. These are the
  limits the form already showed. Uploads above 4.5 MB through the Vercel rewrite, and the production nginx limit, are
  unverified. Each field accepts only its own types (a PDF is not an activity photo), although the server accepts any
  allowed type on every route.
- **Dialog instead of `confirm()`.** The checklist must be complete before "Ajukan" is enabled. It is never stored
  (the backend has no field).
- **The resubmit note is disabled** (with an explanation) while `NEXT_PUBLIC_PROT_RESUBMIT_NOTE` is off. The deployed
  route has no body, so a typed note would be silently lost.
- **Self-review rule**, at three steps: claiming from the queue ("curate"), the decision ("verify") and the publish.
  An admin creator may claim, so the queue is never stuck, but must give a reason to decide or publish. The audit row is
  written BEFORE the decision (fail closed): if the audit write fails, nothing is decided.
- **No minimum review time.** The prompt listed it as a gap, but no step asked for it. The guide says so.
- **Denylisted files on the review page** appear as a "Disembunyikan" box (never shown). The reviewer knows a file
  exists and must not approve until it is replaced.
- **The 10-character minimum** for the override reason is my choice (Phase 25's admin routes use 5). It asks for a
  real sentence.
- **Browser check.** I put a real LOCAL backend access token into the fake Supabase session, so the local backend
  authenticated the browser's calls.

## 5. Deviations

- **Port 3000 was taken.** A local backend started on 2026-11-19 from `dist/main` (not by this session) held port 3000.
  I did not stop it; this phase's backend ran on port 3002 for the browser check and was stopped afterwards.
- **`jumlahPemain` = 0 in the browser** is stopped first by the browser's own `min="1"` check, with its native message.
  The Indonesian message of the form is the fallback for anything the browser lets through. Both are tested.
- **Frontend test suite.** The full run is not green while other heavy jobs run (see section 6). The suite run alone
  with only the backend build in parallel had 4 timeouts, and those 3 files pass alone. Noted in the Cleanup list; not
  fixed (the CLAUDE.md rule says do not fix in passing).
- **Backend tests.** Unit tests and the two PROT e2e files ran; the full e2e and integration suites did not.
- **No migration.** None was needed: `deskripsi`, `jumlahPemain`, the resubmit route, `audit_logs` and
  `verifikasi_queue.catatan_kurator` all exist.

## 6. Verification

Disk: before C: 11 GB free, D: 336 GB; after C: 9.8 GB, D: 329 GB. Everything this phase wrote went to D: (logs,
Chrome cache, screenshots); the cause of the C: decrease is unknown.

| Command | Exit | Result |
|---|---|---|
| FE `npx vitest run tests/prot` | 0 | 6 files, 86 passed (60 new) |
| FE `pnpm test`, with the backend unit suite and a dev server compiling at the same time | 1 | 1021 passed, 9 failed: 8 × "Test timed out in 5000ms" and 1 timing assertion (10.3 ms vs 7.5 ms), none in a touched file |
| FE `pnpm test` again, with only the backend build in parallel | 1 | 1026 passed, 4 failed (timeouts in `gasing-integration`, `concept-scenes`, `three-isolation`) |
| FE those 3 files alone | 0 | 18 passed |
| FE `npx tsc --noEmit` | 0 | clean |
| FE `pnpm lint` | 1 | 43 errors, 64 warnings (baseline 44 / 80). New files: 0 problems. Touched files equal to or better than main (edit page 4e/17w → 4e/2w, review page 1e/1w → 0, `ProtForm` 1e/7w unchanged) |
| FE `npx next build` (normal env) | 0 | `✓ Compiled successfully in 56s` |
| BE `npx jest` (unit) | 0 | 48 suites, **621 passed** (20 new) |
| BE `jest --config test/jest-e2e.json test/prot-self-review test/admin-prot` | 0 | 2 suites, 9 passed (4 new) |
| BE `npm run build` | 0 | clean |
| BE `npm run lint` | 1 | 219 errors, 29 warnings (baseline 220 / 29). New files: 0 problems; touched files unchanged versus main |
| `GET https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&page=1&limit=100` (Step 0, no auth) | 200 | 5 records; key names and types only |

Production: one public read-only GET, nothing else. The production database was never touched. No credentials were
used.

Browser check, against the LOCAL backend and the LOCAL dev DB only:
- **Setup:** a local production build on `localhost:3101`, `BACKEND_ORIGIN=http://localhost:3002`, the fake Supabase
  session, headless Chrome. Every request to `api.nusantaralegacy.org` was aborted.
- **Seeded data:** created through the real local endpoints: one REVISI record (a pakar asked for a revision), one
  DIKURASI record of the admin that the admin claimed, and one DRAFT. Media URLs are the local placeholder image.

| Check | 390x844 | 1440x900 |
|---|---|---|
| Create form: badges | 6 | 6 |
| 300-character deskripsi counter | "300 karakter · panel stan Jelajah hanya menampilkan sekitar 280 karakter pertama" (highlighted) | same |
| A `.gif` photo and a `.docx` document | both refused with Indonesian errors; the `.png` accepted | same |
| Horizontal overflow (all pages) | 0 px | 0 px |
| Edit page of the REVISI record | notice with saran perbaikan, catatan, reviewer and date; deskripsi and jumlah (6) filled | – |
| Detail page of the REVISI record | "Ajukan Ulang", "Ringkasan", "6 orang"; confirm disabled until all 5 ticked; note disabled (flag off) | same |
| Real resubmit through the dialog | – | status REVISI → **DIKURASI** |
| Real first submission with own note | – | DIKURASI, `catatan_kurator` = the typed note |
| Review page of own record | warning (`warn`), 3 photos, `panduan-gasing.pdf` with "Buka / unduh", domains `tokopedia.com` and `toko.example` (flagged "tanpa https") | same |

Screenshots in `D:/dev-cache/screens/phase-26/`:
- `form-create-390x844.png`, `form-create-1440x900.png`;
- `edit-revisi-390x844.png`;
- `submit-dialog-resubmit-390x844.png`, `submit-dialog-resubmit-1440x900.png`, `submit-dialog-draft-1440x900.png`;
- `review-390x844.png`, `review-1440x900.png`.

Scratch scripts: `D:/dev-cache/tmp/phase-26/pw/` (seed, verify, fake Supabase) and `D:/dev-cache/tmp/phase-26/claude_md.py`.

## 7. Manual checks

### Works in production today (after the frontend is merged and Vercel deploys)

| Change | Works now? |
|---|---|
| Deskripsi Singkat and Jumlah Pemain in the form, saved and shown on `/prot/[id]` (deskripsi also in Jelajah) | Yes |
| Edit page saving (the `kecamatanName` / `desaName` bug) | Yes |
| Jelajah badges, help texts | Yes |
| Upload types and limits, Indonesian errors | Yes |
| Submission dialog with checklist | Yes |
| Contributor note on a FIRST submission | Sent and accepted; **stored and visible to the reviewer only after the backend deploy** (Pending deployment items 1 and 3) |
| "Ajukan Ulang" for REVISI records (resubmit route) | Yes |
| Note on a resubmit | After the deploy + `NEXT_PUBLIC_PROT_RESUBMIT_NOTE=true` |
| Reviewer notes shown on REVISI records | Yes |
| Review page: every text and media item | Yes |
| Self-review warning (review page, publish) | Yes (warning only) |
| Self-review blocked by the server, admin reason audited | After the deploy (item 13) + `NEXT_PUBLIC_PROT_SELF_REVIEW_RULE=true` |

### Checklist for the content team (on the live site after the merge)

1. Log in as a kurator daerah. Open "Tambah PROT".
   - You should see "Deskripsi Singkat" with a character counter and "Jumlah Pemain".
   - Six fields carry the badge "Disarankan untuk Jelajah".
2. Type more than 280 characters in Deskripsi Singkat. The counter turns amber and says the Jelajah panel shows only
   the first ~280.
3. Try to add a Word file under "Dokumen". The file is not added and the message says to save it as PDF. A GIF photo is
   refused too.
4. Save a test record (a DRAFT, not published). Open it.
   - You see "Ringkasan" and "Jumlah Pemain".
   - "Ajukan Verifikasi" opens a window with five checkboxes and a note field; the button is off until all are ticked.
5. Ask a pakar to choose "Perlu revisi" with a saran perbaikan. Then, as the creator, open the record:
   - a yellow box "Perlu revisi: catatan kurator" shows the saran (also on the Edit page);
   - the button now reads "Ajukan Ulang"; after ticking the checklist it sends the record back to the queue (status
     DIKURASI).
6. As a pakar, open a record from "Tugas Saya". The review page lists every photo (click for full size), every video,
   every document (with "Buka / unduh") and every purchase link with its domain.
7. Open a review page of a record you created yourself. A red box says "Anda adalah pembuat PROT ini". Today this is
   only a warning: ask someone else to review it.
8. After a backend deploy only: follow CLAUDE.md "Pending deployment" item 13 (turn on the two flags), then repeat step 7
   as a pakar: the form is disabled, and the server answers 403.
9. Delete the test record afterwards (admin, "Hapus").

## 8. Findings

### Production compatibility (Step 0)

The deployed backend already has `deskripsi`, `jumlahPemain` and the resubmit route.

| Item | Evidence | Available in production today? |
|---|---|---|
| `deskripsi` on create/update | Key present on 5/5 published records (all `null`). Entity column and `CreatePROTDto.deskripsi` (`@IsString @IsOptional`, no max length) were added in the SAME commit `58db491` (2026-02-19), older than the Phase 01 baseline. | Yes. Free text, no server length limit. |
| `jumlahPemain` | Key present on 5/5 records (all `null`). Entity column + DTO (`@IsInt @Min(1) @IsOptional`) in the same commit `6fa3bc3` (2026-02-19). | Yes. Integer >= 1. |
| `POST /prot/:id/resubmit` | In `e39babc` (2026-02-09, the original verification workflow), present in the Phase 01 baseline controller, no `@Body()`. Not probed (no non-GET request to production). | Yes, without a note. |
| `submit-kurasi` `catatan` | `SubmitKurasiDto.catatan` (`@MaxLength(500)`) since `e39babc`; storing it is Phase 06 B7 (Pending deployment items 1 and 3). | Accepted, but discarded until the deploy. |
| Upload types and sizes | `StorageService.validateFile()` unchanged since `f640cac` (2026-02-06): JPEG/JPG/PNG/WEBP/PDF/MP4/MOV, max 100 MB, on every upload route; 10 files per request; repo nginx 50 MB. | DOC/DOCX are always rejected. |
| Self-review | No check in pick, review or publish. | Not enforced. |

### Edit page bug

`GET /prot/:id` returns `kecamatanName` and `desaName`. The edit page passed them on in its PATCH, and the DTO
forbids unknown keys, so the e2e test shows 400 for such a body. Saving an edit therefore failed whenever these keys
were present. Records without kecamatan/desa probably still saved, but this is not verified (the frontend cannot log
in to production). Fixed by `toProtWritePayload()`.

### Should uploads be scanned for personal data? (Backend 2: not implemented)

| Option | How | Pros | Cons |
|---|---|---|---|
| A. None (today) + human checklist | Contributor checklist, reviewer opens every document (Phase 26 review page) | No cost, no false alarms | Depends on people; Phase 24/25 showed it fails |
| B. Text pattern scan of PDFs at upload | Extract text (e.g. pdf.js on the server), look for 16-digit NIK, phone numbers, emails, "NIK/KTP" labels; refuse or flag | Catches the SEPANGKAL case (25 NIK patterns); cheap; deterministic | Misses scanned PDFs (images) and names; false positives (long numbers in tables); CPU and memory on the API server for every upload; a refused upload frustrates honest users |
| C. Flag instead of refuse | Same scan, but store a warning that the review page shows | No lost uploads; the reviewer decides | Needs a new column/table (migration); a flag can be ignored |
| D. OCR / image analysis (faces, documents in photos) | External or self-hosted OCR/vision service | Covers photos and scans | Cost, latency, sends files to a third party (itself a privacy question), many false results |
| E. Private uploads until approval | Upload to a non-public bucket prefix; make public on publish | Removes the root cause (files are public from the first upload, even in DRAFT) | Larger change: storage paths, signed URLs for reviewers, migrating existing files |

My recommendation for a later phase: E (the root cause) with C as a light first step. B alone would block the obvious
case but give a false sense of safety.

## 9. Out-of-scope observations

1. **Uploads are public immediately**, also for DRAFT records (S3 `public-read`). See option E above.
2. **A pakar can create records but cannot submit them.** The submit routes allow only kurator_daerah and admin_kpoti.
   The form lets a pakar create a record that then cannot be submitted.
3. **The review page shows the creator as a user id.** `GET /prot/:id` does not include the creator's name.
4. **Publish ignores its `catatan`.** `PublishProtDto.catatan` is accepted and dropped (unchanged).
5. **The queue lists a reviewer's own records.** After the deploy, picking one gives 403; the queue page could hide them
   or mark them "Buatan Anda".
6. **An old local backend** (started 2026-11-19 from `dist/main`) is still running on port 3000 on this machine.
7. **C: free space** dropped from 11 GB to 9.8 GB during the phase, although everything this phase wrote went to D:.

## 10. Open questions

1. Merge the frontend branch now? Everything in it works with the deployed backend (section 7 table).
2. Who deploys the backend (Pending deployment items 1 to 13), and who turns on the two Vercel flags afterwards?
3. Self-review override: is "an admin may claim their own record and decide or publish with a reason" acceptable, or
   should admins be blocked too? Is the 10-character minimum for the reason right?
4. Should a minimum review time be enforced (the Phase 25 finding of a 44-second review)? It was not requested.
5. Personal-data protection of uploads: go for option E (private until approved), C (flag), or stay with the
   checklist?
6. Should pakar be allowed to submit the records they create (observation 2)?
7. Raise the frontend test timeouts (Cleanup list), so the full suite stays green under load?

## 11. Ready for next phase?

Yes. The frontend branch is ready to merge. The backend part (item 13) waits for server access, like items 1 to 12.
After that deploy, set the two flags in Vercel.
