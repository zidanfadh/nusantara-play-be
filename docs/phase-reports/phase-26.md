# Phase 26: PROT form and review workflow fixes (from the Phase 25 findings)

(Work in progress: Step 0 only. The full report replaces this file in Step 8.)

## Step 0: preflight and production compatibility

- Phase 25 is merged into `origin/main` in both repos (frontend PR #22 `111b187`, backend `8686135`).
- Branches `phase-26-prot-form-review` created from those commits. Disk: C: 11 GB free, D: 336 GB.

Production evidence: one public, read-only GET (`/api/prot?status=ARSIP_NASIONAL&page=1&limit=100`, HTTP 200, 5
records). Only key names and value types were printed; no values. Plus git history.

| Item | Evidence | Available in production today? |
|---|---|---|
| `deskripsi` on create/update | Key present on 5/5 records (all `null`). Entity column and `CreatePROTDto.deskripsi` (`@IsString @IsOptional`, no max length) were added in the SAME commit `58db491` (2026-02-19), which is older than the Phase 01 baseline. | Yes. Free text, no server length limit. |
| `jumlahPemain` | Key present on 5/5 records (all `null`). Entity column + DTO (`@IsInt @Min(1) @IsOptional`) in the same commit `6fa3bc3` (2026-02-19). `ValidationPipe` uses `enableImplicitConversion`, but the frontend sends a JSON number. | Yes. Integer >= 1. |
| `POST /prot/:id/resubmit` | In `e39babc` (2026-02-09, the original verification workflow), present in the Phase 01 baseline controller. No `@Body()` parameter. Not probed (no non-GET request to production). | Yes, without a note. |
| `submit-kurasi` `catatan` | `SubmitKurasiDto.catatan` (`@MaxLength(500)`) since `e39babc`, so the deployed DTO accepts it; storing it on the queue entry is Phase 06 B7 (Pending deployment items 1 and 3). | Accepted, but discarded until the deploy. |
| Upload types and sizes | `StorageService.validateFile()` unchanged since `f640cac` (2026-02-06): `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `application/pdf`, `video/mp4`, `video/quicktime`, max 100 MB, on EVERY upload route (not per field). 10 files per request (`FilesInterceptor('files', 10)`). Repo nginx `client_max_body_size 50M` (production nginx unknown). | DOC/DOCX are always rejected. |
| Self-review | No check anywhere (`pickFromQueue`, `submitReview`, `publishToArsipNasional`). | Not enforced. |

Consequences for the frontend:
- `deskripsi`, `jumlahPemain` and the resubmit route are used without a flag.
- Sending a note with the resubmit, and the admin self-review override, need the new backend, so both sit behind flags that
  are off by default.
