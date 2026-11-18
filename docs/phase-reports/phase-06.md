# Phase 06: Backend security fixes (and a small frontend cleanup)

## 1. Summary

All requested backend fixes are done, tested and committed on `phase-06-security-fixes`, ready to deploy
on their own once someone has server access:
- B1: PROT media ownership and status checks before any S3 call.
- B7: the kurator's submission note.
- B4: race-safe marketplace stock.
- B5: race-safe verification queue claim.
- P1: public endpoints return only the public user shape.
- P2: no personal data or passwords in logs.
- P3: rate limit per user and `TRUST_PROXY`.
- P4: `avatar_url` validation.

The phase adds one hand-written, additive migration (`verifikasi_queue.catatan_kurator`). It must run on
production **before** the new backend starts; it is listed under "Pending deployment" in CLAUDE.md. The race
fixes are proven by integration tests with truly parallel transactions on the local test database, and
these tests fail against the old code. The frontend lost the unused `ProfileCard`, `/api/proxy-image`,
its validator and tests. Migration rules, the public user shape rule, `TRUST_PROXY` and the decisions
are in the shared CLAUDE.md sections, identical in both repos. B2, B3, B6, B8 and B10 are deferred as
asked. Nothing touched production and nothing was pushed. **The phase is complete.**

## 2. Git

| Repo | Branch | Base commit | New commits |
|------|--------|-------------|-------------|
| nusantara-play-be | `phase-06-security-fixes` | `7ff6446` docs(phase-05): phase report | `4d99bdc` docs(phase-06): add migration rules to engineering rules; `fc286de` feat(common): public user shape and private-field stripping helpers; `be5281a` fix(prot): media edit checks, submission note, race-safe queue claim; `93d1193` fix(marketplace): race-safe stock on order create and cancel; `c5191db` fix(p1): public endpoints return only the public user shape; `07563f6` fix(p2): no personal data or passwords in logs; `78ebd94` fix(p4): validate avatar_url as an https URL of max 500 chars; `fe67566` fix(p3): rate limit per user, trust proxy from TRUST_PROXY; `9ac659d` docs(phase-06): public user shape rule, TRUST_PROXY, pending deployment, decisions; plus the commit that adds this report |
| nusantara-play-fe | `phase-06-security-fixes` | `b55db42` Merge pull request #6 (phase-05-local-dev) | `7280df4` docs(phase-06): add migration rules to engineering rules; `2254148` chore(fe): remove unused ProfileCard and /api/proxy-image; `2cdabd4` docs(phase-06): public user shape rule, TRUST_PROXY, pending deployment, decisions |

Step 0 was first run before the backend main contained Phase 05 (main was at `f0adc1c`); the phase
stopped as instructed. After the owner merged and pushed Phase 05, both mains were pulled again and
contained the Phase 05 commits (backend `7ff6446`, frontend `b55db42`, which includes `203ec22`).

Backend `git diff --stat 7ff6446 9ac659d`:

```
 .env.example                                       |   7 +
 .env.local.example                                 |   2 +
 CLAUDE.md                                          |  82 +++++-
 src/app.module.ts                                  |  15 +-
 src/common/filters/http-exception.filter.spec.ts   |  91 ++++++
 src/common/filters/http-exception.filter.ts        |  17 +-
 src/common/guards/user-throttler.guard.spec.ts     |  49 ++++
 src/common/guards/user-throttler.guard.ts          |  23 ++
 src/common/http/trust-proxy.spec.ts                |  27 ++
 src/common/http/trust-proxy.ts                     |  38 +++
 src/common/serializers/user-shape.spec.ts          |  87 ++++++
 src/common/serializers/user-shape.ts               |  92 ++++++
 src/main.ts                                        |   8 +-
 ...000000000-AddCatatanKuratorToVerifikasiQueue.ts |  25 ++
 src/modules/audit/audit.interceptor.spec.ts        |  83 ++++++
 src/modules/audit/audit.interceptor.ts             |   4 +-
 src/modules/audit/redact.ts                        |  24 ++
 .../calendar/__tests__/calendar-user-shape.spec.ts | 153 ++++++++++
 src/modules/calendar/calendar-invite.service.ts    |  23 +-
 src/modules/calendar/calendar.service.ts           |  37 ++-
 .../events/__tests__/events.service.spec.ts        |  94 +++++++
 src/modules/events/events.service.ts               |  50 +++-
 .../marketplace/__tests__/order.service.spec.ts    | 299 ++++++++++++++++++++
 src/modules/marketplace/order.service.ts           | 163 ++++++++---
 src/modules/notifications/email.service.spec.ts    |  50 ++++
 src/modules/notifications/email.service.ts         |  13 +-
 .../prot/entities/verifikasi-queue.entity.ts       |   5 +
 src/modules/prot/prot.controller.ts                |  38 ++-
 src/modules/prot/prot.service.spec.ts              | 308 ++++++++++++++++++++-
 src/modules/prot/prot.service.ts                   | 164 +++++++----
 src/modules/prot/verifikasi.service.spec.ts        | 210 +++++++++++---
 src/modules/prot/verifikasi.service.ts             |  78 +++++-
 src/modules/users/dto/avatar-url.validation.ts     |  29 ++
 src/modules/users/dto/create-user.dto.ts           |   4 +-
 src/modules/users/dto/update-user.dto.spec.ts      | 104 +++++++
 src/modules/users/dto/update-user.dto.ts           |   6 +-
 src/modules/users/user-views.ts                    |  25 ++
 src/modules/users/users.controller.spec.ts         |  99 +++++++
 src/modules/users/users.controller.ts              |  35 ++-
 test/integration/fixtures.ts                       | 105 +++++++
 test/integration/marketplace-order.int-spec.ts     | 158 +++++++++++
 test/integration/verifikasi-queue.int-spec.ts      | 158 +++++++++++
 test/public-user-shape.e2e-spec.ts                 | 180 ++++++++++++
 test/throttler.e2e-spec.ts                         | 111 ++++++++
 44 files changed, 3150 insertions(+), 223 deletions(-)
```

Frontend `git diff --stat b55db42 2cdabd4`:

```
 .env.example                           |   4 -
 CLAUDE.md                              |  67 ++++++-
 app/api/proxy-image/route.ts           |  39 ----
 components/dashboard/ProfileCard.tsx   | 187 ------------------
 lib/security/image-proxy.ts            | 346 ---------------------------------
 tests/middleware/matcher.test.ts       |   2 +-
 tests/middleware/public-routes.test.ts |   4 +-
 tests/security/image-proxy.test.ts     | 326 -------------------------------
 8 files changed, 66 insertions(+), 909 deletions(-)
```

Nothing pushed.

## 3. Changes

Backend, application code:
- `src/modules/prot/prot.service.ts`: B1 `assertCanEditMedia(prot, user)` (owner or admin_kpoti → else 403 "Anda tidak memiliki akses untuk edit PROT ini"; DRAFT/REVISI → else 400 "PROT dengan status X tidak bisa diedit"), called first in all 8 media methods and in `update()`. Removes now save the database first and then call `deleteStoredFileAfterSave()`, which logs a failed S3 delete (error name only) and returns success. B7: `submitKurasi(protId, userId, catatan?)` stores the trimmed note, or null, as `catatan_kurator`. P2: the five `console.log` lines in `findAll` (user id, role, email) are replaced by one `Logger.debug` with the role only.
- `src/modules/prot/prot.controller.ts`: all 8 media routes pass `@CurrentUser()` and use `AuditInterceptor`; `submit-kurasi` passes `submitDto.catatan`.
- `src/modules/prot/entities/verifikasi-queue.entity.ts`: B7 column `catatan_kurator` (`text`, nullable).
- `src/migrations/1795000000000-AddCatatanKuratorToVerifikasiQueue.ts` (new): B7 `ALTER TABLE verifikasi_queue ADD COLUMN IF NOT EXISTS catatan_kurator text NULL`; down drops it `IF EXISTS`.
- `src/modules/prot/verifikasi.service.ts`: B5 `pickFromQueue` claims with one conditional UPDATE (`WHERE id = :queueId AND assigned_pakar_id IS NULL`, 0 rows → "PROT ini sudah di-claim oleh pakar lain"). `releaseFromQueue` uses one conditional UPDATE (`AND assigned_pakar_id = :pakarId`, 0 rows → the existing NotFound). P1: queue items (`prot.createdBy`) and verification history (`pakar`) without `supabase_user_id`/`last_login_at`.
- `src/modules/marketplace/order.service.ts`: B4 `mergeOrderLines()` (sum qty per produk, sort by id). `create()` runs one `UPDATE produk SET stok = stok - :qty WHERE id AND toko_id AND is_active = true AND stok >= :qty RETURNING id, nama, harga` per line inside the transaction. 0 rows → the existing NotFound (product not in this toko) or "Stok produk 'X' tidak mencukupi". `batalkan()` uses a conditional UPDATE of the order status inside the transaction and restores stock (atomic `stok = stok + :qty`, produk id order) only if that UPDATE changed a row. P1: buyer without private fields in `create`/`findOne`/`findSellerOrders`.
- `src/common/serializers/user-shape.ts` (new): `PublicUser`, `toPublicUser()`, `stripPrivateUserFields()`, `omitFields()`.
- `src/modules/events/events.service.ts`: P1 `toPublicEvent()` for `findAll` (used by `/events`, `/events/featured`, `my-events`) and `findOne` (`/events/:id`). `getRegistrations` strips registrants' private fields. `isRegistrationOpen` takes `Pick<Event, 'status' | 'tanggal_mulai'>` so it accepts the public event.
- `src/modules/calendar/calendar.service.ts`: P1 `getOne` (public `GET /calendar/:id`) returns the creator in the public shape; `getImportantDates` strips the creator's private fields.
- `src/modules/calendar/calendar-invite.service.ts`: P1 invites (`invitedByUser`, `calendarItem.creator`, `user`) without private fields.
- `src/modules/users/user-views.ts` (new), `users.controller.ts`: P1 other users' records. admin_kpoti gets them without `supabase_user_id` (keeps `last_login_at`); kurator_daerah on `GET /users/:id` gets neither field. `/users/me` is unchanged.
- `src/common/filters/http-exception.filter.ts`: P2 logs only name, method, path, message and stack through the Nest Logger, instead of `console.error` of the whole exception object.
- `src/modules/audit/redact.ts` (new), `audit.interceptor.ts`: P2 the request body stored in `audit_log.changes` has password/token/secret/api-key/authorization keys replaced by `[REDACTED]`.
- `src/modules/notifications/email.service.ts`: P2 an SMTP failure logs the error name and codes, not the message (which can quote the recipient address).
- `src/modules/users/dto/avatar-url.validation.ts` (new), `update-user.dto.ts`, `create-user.dto.ts`: P4 `@IsAvatarUrl()` (https only, protocol required, max 500, `''`/blank → null, null allowed).
- `src/common/guards/user-throttler.guard.ts` (new): P3 tracker `user:<id>` or `ip:<req.ip>`.
- `src/common/http/trust-proxy.ts` (new), `src/main.ts`: P3 `app.set('trust proxy', parseTrustProxy(TRUST_PROXY))`, default `loopback`.
- `src/app.module.ts`: P3 guard registration only. `JwtAuthGuard` and `UserThrottlerGuard` as providers plus `APP_GUARD` `useExisting`, in that order (replaces `ThrottlerGuard`).
- `.env.example`, `.env.local.example`: `TRUST_PROXY=loopback` with an explanation.

Backend, tests (all new or extended):
- `src/modules/prot/prot.service.spec.ts`: B1 matrix (8 methods × owner DRAFT/REVISI, admin, other kurator 403, owner 400 for 3 statuses, admin 400). Also: storage not called on failure, save before S3 delete, no delete if the save fails, success if the S3 delete fails. Plus B7 (note stored, null, blank) and P2 (no id/email printed).
- `src/modules/prot/verifikasi.service.spec.ts`: B5 claim/lost race/release, P1 queue and history.
- `src/modules/marketplace/__tests__/order.service.spec.ts`: B4 merge/sort/atomic decrement/errors/cancel paths, P1 buyer.
- `src/modules/events/__tests__/events.service.spec.ts`, `src/modules/calendar/__tests__/calendar-user-shape.spec.ts`, `src/modules/users/users.controller.spec.ts`, `src/common/serializers/user-shape.spec.ts`: P1.
- `src/common/filters/http-exception.filter.spec.ts`, `src/modules/audit/audit.interceptor.spec.ts`, `src/modules/notifications/email.service.spec.ts`: P2.
- `src/modules/users/dto/update-user.dto.spec.ts`: P4.
- `src/common/guards/user-throttler.guard.spec.ts`, `src/common/http/trust-proxy.spec.ts`: P3 unit.
- `test/integration/fixtures.ts` (new): random-suffix rows with exact cleanup.
- `test/integration/marketplace-order.int-spec.ts` (new): B4 on the real test DB.
- `test/integration/verifikasi-queue.int-spec.ts` (new): B5 + B7 on the real test DB.
- `test/public-user-shape.e2e-spec.ts` (new): P1 on the full AppModule, every fixed public endpoint.
- `test/throttler.e2e-spec.ts` (new): P3 on the full AppModule, both tracker paths and guard order.

Backend, docs: `CLAUDE.md`. Migration rules (Step 1) were committed first. Then: the public user shape rule, the personal-data logging rule, `TRUST_PROXY`, guards/serializers/audit notes, the Pending deployment list, Risks, the lint baseline and Decisions log entries.

Frontend:
- Deleted `components/dashboard/ProfileCard.tsx` (unused) and `app/api/proxy-image/route.ts` (its only caller was ProfileCard).
- Deleted `lib/security/image-proxy.ts` (only used by the route) and `tests/security/image-proxy.test.ts` (tests of the deleted module).
- `tests/middleware/matcher.test.ts`, `tests/middleware/public-routes.test.ts`: `/api/proxy-image` used only as a sample path → `/api/some-route` (same rule: API routes stay behind login).
- `.env.example`: removed `PROXY_IMAGE_ALLOWED_HOSTS` and its comment.
- `CLAUDE.md`: removed `PROXY_IMAGE_ALLOWED_HOSTS` from Env Vars, rewrote the Phase 04 decision entry to record the removal, and synced the shared sections.

## 4. Decisions

- **Users module and `last_login_at`** (asked the owner during the phase): admin_kpoti user management keeps `last_login_at` (the admin UsersTable shows it) but never gets `supabase_user_id`; kurator_daerah on `GET /users/:id` gets neither.
- **B1 helper also used by `update()`**: one rule set instead of two. It is written as "owner or admin_kpoti", which equals today's `update()` rule for every role that can reach these routes (`@Roles(KURATOR_DAERAH, ADMIN_KPOTI)`).
- **B1 index checks run after the permission check**, so an unauthorized user cannot probe array sizes.
- **B7 column**: no existing column fit. `verifikasi.catatan` is the pakar's review note, and PROT has no note column. So the new column is `verifikasi_queue.catatan_kurator`. The note is trimmed; empty/blank → NULL. `resubmitAfterRevisi` was not changed (no DTO, not asked).
- **B4 errors**: when the conditional UPDATE changes no row, a read inside the same transaction decides between the existing NotFound ("Produk ... tidak ditemukan di toko ini") and the existing "Stok produk 'X' tidak mencukupi". Both messages are unchanged.
- **B4 cancel**: the conditional UPDATE allows `menunggu` for the buyer and `menunggu`/`dikonfirmasi` for the seller (the old rules). Restores use the same merge + produk id order as `create()`, so both lock rows in one order.
- **B5 `assigned_at`**: written as a JS `Date` parameter (the app clock, as before), not SQL `now()`. The column is `timestamp without time zone`, and `now()` would follow the DB session time zone while the other timestamps follow the app.
- **B5 early "already claimed" check kept**: it avoids a pointless UPDATE. The conditional UPDATE is still what decides.
- **P1 public shape** = `{ id, full_name, avatar_url, institution }`, mapped in the services: events `toPublicEvent()`, calendar `getOne()`.
- **P2 audit_log** (found during the phase): `POST /auth/change-password` is audited, and `AuditInterceptor` stored the raw body, i.e. all three passwords in plain text. It now redacts secret-looking keys. Covered by "any other log line that prints … tokens" and CLAUDE.md "Never log secrets".
- **P2 email / exception filter**: SMTP error messages can quote the recipient, and a `QueryFailedError` carries query parameters and driver details. Both are now logged without those.
- **P3 registration** uses `APP_GUARD` with `useExisting` (same order as before), so an e2e test can replace `JwtAuthGuard` with `overrideProvider()` and prove the order on the real AppModule. A reversed order makes 2 of the 3 throttler e2e tests fail (checked).
- **P3 `TRUST_PROXY` parsing**: `"true"`/`"false"` → boolean, digits → hop count, anything else → passed to Express (names, addresses, CIDR lists). Empty → `loopback`.
- **P4**: also applied to `CreateUserDto`, whose TS type stays `string`, so the users entity is not touched (entities outside B7 are not in the allowed list). `''`/blank becomes null through a transform, so clearing always stores NULL.
- **Migration timestamp** `1795000000000` (2026-11-18), later than every existing migration.

## 5. Deviations

- **Step 0** was first run while the backend main lacked Phase 05: stopped and reported, resumed after the owner merged it.
- **Files outside the listed modules, all under the brief's "other modules ONLY where … a personal-data log is found"**:
  - `src/modules/calendar/` (P1 public leak)
  - `src/modules/users/users.controller.ts` + `user-views.ts` (P1 other users' data)
  - `src/modules/audit/` (passwords in audit_log)
  - `src/modules/notifications/email.service.ts` (recipient address in logs)
  - `src/modules/events/event-registrations.service.ts` was not changed; `events.service.ts`'s `isRegistrationOpen` signature was widened instead.
- **`src/common/filters/`** is under `src/common/`, which is allowed.
- **Frontend `.next/dev/types/`** (generated, git-ignored) was deleted locally once: a stale `validator.ts` from an earlier `next dev` run still imported the deleted route and broke `pnpm build`. Nothing tracked was affected. Vercel builds from a clean checkout.
- **Migration test order**: `db:setup` records new migrations as applied (Phase 05 baseline) and `synchronize()` creates the column. So "run then revert" was done as revert → run → revert → run, with the column checked after each step. The Migration rules in CLAUDE.md say so.
- Otherwise none.

## 6. Verification

Free space: before C: 6.4 GB, D: 360 GB (Step 0, after the resume); after C: 6.4 GB, D: 360 GB.

Step 0 (backend, after resume): `git checkout main && git pull --ff-only` → "Already up to date", HEAD `7ff6446 docs(phase-05): phase report`. Frontend HEAD `b55db42 Merge pull request #6`. `npm run db:up` → exit 0, "Container nusantara-dev-db Healthy". `npm run db:setup` (dev) and `npm run db:setup -- --database=nusantara_play_test` → exit 0, "Migration baseline: 13 migrations recorded as applied", "DEMO data present … Done.".

Backend (final run on `fe67566`; `9ac659d` only changes CLAUDE.md):

| Command | Exit | Result |
|---------|------|--------|
| `npm run lint` | 1 (baseline is not 0) | 237 errors, 30 warnings (before: 240 errors, 30 warnings). No file gained errors; every new file is clean. Changed rules: no-unsafe-assignment 72 → 70, no-unused-vars 29 → 28 (`prot.controller.ts` lost its unused-var error) |
| `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | 25 suites, **292 passed**, 0 failed, 0 skipped (before: 16 suites, 144) |
| `npm run test:int` | 0 | 3 suites, **11 passed**, 0 failed (before: 3) |
| `npm run test:e2e` | 0 | 4 suites, **14 passed, 11 skipped** (login-dependent, as before), 0 failed (before: 7 passed, 11 skipped) |
| `npm run build` | 0 | `nest build` |
| `npx tsc --noEmit -p tsconfig.build.json` | 0 | no output |

Old-code checks (temporary, restored afterwards; `git diff --stat` confirmed the new files were back):
- B4/B5 integration tests with the old `order.service.ts` + `verifikasi.service.ts`: 3 failed. 10/10 orders succeeded on a stock of 3; both parallel picks succeeded; both parallel cancels succeeded.
- P1 e2e with the old `events.service.ts` + `calendar.service.ts`: 4 failed, 4 total.
- P3 e2e with the APP_GUARD order reversed: 2 failed, 1 passed.
- P2 email test with the old `email.service.ts`: 1 failed.

Migration on `nusantara_play_dev` (after `npm run db:setup`, which reported "14 migrations recorded as applied" and still only the 8 known `produk_prot` statements, so the entity and the migration agree):

```
after db:setup: text nullable=YES | recorded=1
npm run migration:revert → "Migration AddCatatanKuratorToVerifikasiQueue1795000000000 has been reverted successfully."  → ABSENT | recorded=0
npm run migration:run    → "… has been executed successfully."                                                         → text nullable=YES | recorded=1
npm run migration:revert → reverted successfully → ABSENT | recorded=0
npm run migration:run    → executed successfully → text nullable=YES | recorded=1
npm run migration:run    → "No migrations are pending"
```

Live check: `npm run start:dev` with the local `.env.local` (127.0.0.1, `nusantara_play_dev`, placeholder Supabase):

```
GET /api/health                 200
GET /api/events                 200  organizer: {"id":"00000000-0000-4000-8000-00000000de01","full_name":"DEMO Kurator","avatar_url":null,"institution":null}
GET /api/events/featured        200  same organizer shape
GET /api/events/<DEMO id>       200  same organizer shape
email/phone/supabase_user_id/last_login_at in organizer: false; "supabase_user_id" anywhere: false; demo email anywhere: false
```

Server log: only the expected "BlockchainService will be inactive" warning. The server was stopped, all processes ended and port 3000 is free.

Frontend:

| Command | Exit | Result |
|---------|------|--------|
| reference search (`ProfileCard`, `proxy-image`, `image-proxy`, `PROXY_IMAGE`, `proxyImage`; excluding node_modules/.next/.git) | – | only `UserProfileCard` (a different component) and the CLAUDE.md history entry that records the removal |
| `pnpm test` | 0 | 5 files, **53 passed** |
| `pnpm lint` | 1 (baseline) | 44 errors, 87 warnings, same as the baseline, no new errors |
| `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key pnpm build` | 1, then 0 | first run: stale `.next/dev/types/validator.ts` imported the deleted route; after deleting `.next/dev/types`: "Compiled successfully", 44 static pages, no `/api/proxy-image` in the output |

## 7. Manual checks

1. `cd nusantara-play-be && npm run db:up && npm run db:setup && npm run start:dev`, then
   `curl -s http://localhost:3000/api/events | jq '.data[0].organizer'`. You should see only `id`, `full_name`, `avatar_url`, `institution`. Same for `/api/events/featured` and `/api/events/00000000-0000-4000-8000-00000000de21`.
2. `npm run test:int`: 11 passed. The tests "10 parallel orders … exactly 3 succeed", "2 parallel cancels … restore the stock once" and "2 parallel picks … exactly one succeeds" are the race proofs.
3. `npm run test:e2e`: 14 passed, 11 skipped. "Rate limiting per user" shows user A getting 429 after 100 requests while user B and anonymous requests from the same IP still get 200.
4. Migration: `npm run migration:revert`, then `docker exec nusantara-dev-db psql -U postgres -d nusantara_play_dev -c '\d verifikasi_queue'` shows no `catatan_kurator`. After `npm run migration:run` the column is back (`text`).
5. Frontend: `pnpm test` (53 passed) and the build command above (with `.next/dev/types` removed if a dev server ran before).
6. After login works (auth phase): as a kurator, try to upload a photo to a PROT that is DIKURASI → 400 "PROT dengan status DIKURASI tidak bisa diedit"; to another kurator's PROT → 403.

## 8. Findings

### P1: public endpoints checked

| Endpoint (`@Public()`) | Returns user objects? | Result |
|---|---|---|
| `GET /api`, `GET /api/health` | no | OK |
| `GET /api/auth/health` | no | OK |
| `GET /api/events` | `organizer` (full user) | **fixed** |
| `GET /api/events/featured` | `organizer` (full user) | **fixed** |
| `GET /api/events/:id` | `organizer` (full user) | **fixed** |
| `GET /api/calendar` | no (entries without creator) | OK |
| `GET /api/calendar/agenda` | no | OK |
| `GET /api/calendar/:id` | `creator` (full user) | **fixed** |
| `GET /api/prot`, `GET /api/prot/:id` | no (createdBy/verifiedBy/publishedBy not loaded; only id columns) | OK |
| `GET /api/prot/:id/blockchain-proof` | no | OK |
| `GET /api/nfts`, `/api/nfts/slug/:slug`, `/api/nfts/:id` | no (only `prot` loaded; `createdBy` not loaded) | OK |
| `GET /api/marketplace/toko`, `/toko/:id` | no (`user` not loaded) | OK |
| `GET /api/marketplace/produk`, `/produk/:id` | no (`toko` without `user`) | OK |
| `GET /api/marketplace/kategori`, `/kategori/:id` | no | OK |
| `GET /api/stats/landing` | no (counts only) | OK |
| `GET /api/daerah` (10 routes) | no | OK |

### P1: logged-in endpoints that return other users

| Endpoint | What they return | Result |
|---|---|---|
| `GET /api/events/:id/registrations` (organizer/admin) | full registrant `user` | stripped `supabase_user_id`, `last_login_at` (email/phone kept: the organizer needs them) |
| `GET /api/verifikasi/queue`, `/my-queue` | `prot.createdBy` full user | stripped |
| `GET /api/verifikasi/:protId/history` | `pakar` full user | stripped |
| `POST /api/marketplace/order`, `GET /order/:id`, `GET /order/seller` | `buyer` full user | stripped |
| `GET /api/calendar/important-dates` | `creator` | stripped |
| `GET /api/calendar/invites/my` | `invitedByUser`, `calendarItem.creator` | stripped |
| `GET /api/calendar/:id/invites` | invitee `user` | stripped |
| `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/role`, `/status` (admin) | full users | `supabase_user_id` removed; `last_login_at` kept (owner decision) |
| `GET /api/users/:id` | full user | admin: without `supabase_user_id`; kurator_daerah: without both |
| `GET /api/events/my-registrations`, `/api/marketplace/order` (own) | own data, events without organizer | unchanged |

### P3: what `req.ip` is in production

Browser → Vercel (`/backend-api` rewrite) → nginx on 103.235.72.203 → NestJS.
- Vercel sets `X-Forwarded-For` to the visitor's IP. nginx (repo config: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`) appends the address it sees, a **Vercel egress IP**: `XFF: <visitor>, <vercel-ip>`.
- With `TRUST_PROXY=loopback` and Nest running directly on the host (peer 127.0.0.1), Express trusts only the loopback hop. So **`req.ip` = the Vercel egress IP** for browser traffic, and the real client IP for anything that calls `api.nusantaralegacy.org` directly. The visitor IP written by Vercel is NOT used: trusting it would require trusting Vercel's IPs, which are not a stable published list, and anyone reaching nginx directly could then forge `X-Forwarded-For`.
- If production runs `docker-compose.prod.yml` (Nest in Docker, port published on `127.0.0.1:3000`), the peer Nest sees is the Docker bridge gateway (172.x), not 127.0.0.1. With `loopback` nothing would be trusted and `req.ip` would be that gateway for every request. In that case `TRUST_PROXY` must be `loopback, uniquelocal`.

What the fix gives: logged-in users are limited per user id (100/60 s each), so one user can no longer use up a shared Vercel IP's budget for everyone.

What remains a limitation without server access:
1. Anonymous requests are still limited per Vercel egress IP, shared by many visitors.
2. The production nginx config is unknown. If it has the repo's `limit_req` 10 r/s burst 20 per `$binary_remote_addr`, that limit applies per Vercel IP before Nest is reached, and Phase 06 cannot change it.
3. Whether Nest runs on the host or in Docker, and so which `TRUST_PROXY` value is right, cannot be checked.
4. The env var must be set on the server at deploy time.

### B4/B5: race proofs (integration, real PostgreSQL 15)

| Test | Old code | New code |
|---|---|---|
| 10 parallel orders, stock 3 | 10 succeeded (stock went negative) | 3 succeeded, 7 "tidak mencukupi", stock 0, 3 order items |
| 2 parallel cancels | both succeeded (stock restored twice) | 1 succeeded, 1 400, stock back to 3 once |
| 2 parallel queue picks | both succeeded (last writer wins) | 1 succeeded, 1 "sudah di-claim", row holds the winner |

### Deferred

| Finding | Status |
|---|---|
| B2, B3, B8 | deferred (blockchain is deprioritized) |
| B6, B10 | deferred (replaced in the self-hosted auth phase) |

## 9. Out-of-scope observations

1. **Production `audit_log` may already contain plain-text passwords** from every successful `POST /auth/change-password` (`entity_type = 'auth'`, `changes` = the request body). The code is fixed; existing rows need a cleanup once there is database access, for example `UPDATE audit_log SET changes = NULL WHERE entity_type = 'auth' AND changes ? 'newPassword'` (check first).
2. Frontend `components/calendar/CalendarItemDetail.tsx:230` renders `{item.creator.full_name} ({item.creator.email})`. After deployment `GET /calendar/:id` no longer sends the email, so it shows "Name ()". It needs a small frontend change.
3. `GET /api/calendar/:id` for PUBLIC items still returns `invites` (invitee `user_id`s and statuses, no user objects). They are needed for the private-item access check, but are visible for public items.
4. Events expose `contact_person`, `contact_phone`, `contact_email` publicly. These are event fields the organizer types in, not the user record, so they were left as they are (see open question 1).
5. Order `konfirmasi`, `kirim` and `selesai` still read the status and then save (not race-safe), as does `submitReview` (a double submit can create two `verifikasi` rows). Same pattern as B4/B5, not in scope.
6. `CreateOrderDto.items` accepts an empty array, which creates an order with total 0. Suggest `@ArrayMinSize(1)`.
7. `GET /api/events/my-events` filters the current page after pagination, so `pagination.total` and pages are wrong (pre-existing).
8. `JwtAuthGuard.handleRequest` `console.log`s user id and role on failed auth outside production, and `jwt.strategy.ts` `console.error`s the Supabase error message. No email or token; both are replaced in the auth phase.
9. `npx tsc --noEmit -p tsconfig.json` (with spec files and `blockchain/`) reports pre-existing type errors in specs and Hardhat files; the build config excludes them.
10. Frontend: after deleting a route, a stale `.next/dev/types/validator.ts` from a previous `next dev` breaks `pnpm build` locally until `.next/dev/types` is removed. Next.js also warns that the `middleware` file convention is deprecated in favor of `proxy`.

## 10. Open questions

1. Should events keep showing `contact_phone`/`contact_email` publicly (organizer-entered contact data), or should they be logged-in only?
2. Who fixes the frontend calendar detail (`({item.creator.email})`, observation 2), and in which phase? It should be done before or with the backend deployment.
3. When server access exists: is NestJS on the host (`TRUST_PROXY=loopback`) or in Docker (`loopback, uniquelocal`), and what does the production nginx `limit_req` look like?
4. When database access exists: clean up passwords already stored in `audit_log` (observation 1)?

## 11. Ready for next phase?

Yes. The branches are ready for review and merge in both repos (not pushed). The backend changes are
deployable on their own and wait for server access: migration first, then `TRUST_PROXY`, then the new
backend (CLAUDE.md "Pending deployment").
