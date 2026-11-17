# Phase 05: Local development environment and database

## 1. Summary

The backend and frontend now run locally against a disposable PostgreSQL 15 in Docker
(`docker-compose.dev.yml`, container `nusantara-dev-db`, port bound to `127.0.0.1:5432`), with two
databases, `nusantara_play_dev` and `nusantara_play_test`. `npm run db:setup` builds the schema from the
TypeORM entities, records all 13 existing migrations as already applied (baseline), seeds the full daerah
hierarchy from the existing seeds (91,217 rows) and a small DEMO dataset. It refuses any target that is
not a local `_dev`/`_test` database. Integration tests (`npm run test:int`) and e2e tests
(`npm run test:e2e`) now run against `nusantara_play_test`, and unit tests still need no database. The
frontend at http://localhost:3001/prot renders the DEMO PROT from the local backend (checked in headless
Chrome). No application code, entity or production configuration was changed, and nothing touched
production. **The phase is complete, with one warning: C: free space fell from 7.4 GB to 3.4 GB during
the phase, below the 5 GB threshold from Step 0 (see section 6).**

## 2. Git

| Repo | Branch | Base commit | New commits |
|------|--------|-------------|-------------|
| nusantara-play-be | `phase-05-local-dev` | `f0adc1c` docs(phase-04): phase report | `6ad0257` feat(dev): local PostgreSQL in Docker and db:setup for dev/test databases; `0323bbc` test: integration setup on nusantara_play_test and runnable e2e tests; `a07dd74` docs(phase-05): document local development, test levels and decisions; plus the commit that adds this report |
| nusantara-play-fe | `phase-05-local-dev` | `792c110` Merge pull request #5 (contains Phase 04 fix `dc30ff1`) | `203ec22` docs(phase-05): local development section and local .env.example notes |

Backend `git diff --stat f0adc1c a07dd74`:

```
 .env.local.example                           |  47 +++
 CLAUDE.md                                    |  48 ++-
 README.md                                    | 102 ++----
 docker-compose.dev.yml                       |  34 ++
 docker/postgres-init/01-create-databases.sql |   6 +
 package.json                                 |  11 +-
 src/scripts/db-local-setup.ts                | 460 +++++++++++++++++++++++++++
 src/scripts/db-reset.ts                      |  33 ++
 test/app.e2e-spec.ts                         |  18 +-
 test/events.e2e-spec.ts                      |  92 +++++-
 test/global-setup-db.ts                      |  22 ++
 test/integration/daerah.int-spec.ts          |  61 ++++
 test/jest-e2e.json                           |   5 +-
 test/jest-int.json                           |  13 +
 test/setup-test-env.ts                       |   4 +
 test/test-env.ts                             |  45 +++
 16 files changed, 907 insertions(+), 94 deletions(-)
```

Frontend `git diff --stat 792c110 203ec22`:

```
 .env.example |  4 ++++
 CLAUDE.md    | 40 +++++++++++++++++++++++++++++++++++++---
 2 files changed, 41 insertions(+), 3 deletions(-)
```

Nothing pushed.

## 3. Changes

Backend:
- `docker-compose.dev.yml` (new): one `postgres` service, `postgres:15-alpine`, container `nusantara-dev-db`, `127.0.0.1:5432:5432`, named volume `nusantara-dev-db-data`, `pg_isready` healthcheck, init folder mounted, password `localdev` with a "never use anywhere else" comment.
- `docker/postgres-init/01-create-databases.sql` (new): creates `nusantara_play_dev` and `nusantara_play_test` on the first start of an empty volume.
- `src/scripts/db-local-setup.ts` (new): guard, extensions, `synchronize()`, migration baseline, daerah seed, DEMO seed; exported for the Jest global setup.
- `src/scripts/db-reset.ts` (new): `db:reset`, which refuses without `--yes`, then runs `docker compose down --volumes` and `up -d --wait`.
- `package.json`: scripts `db:up`, `db:down`, `db:reset`, `db:logs`, `db:setup`, `test:int`; `seed` now runs `db:setup`; removed the broken `seed:daerah` (same missing file); `test:e2e` gets `--runInBand` (both suites share one database). No dependencies added.
- `.env.local.example` (new): all variable names with fake values (`.invalid` hosts, blockchain empty).
- `test/test-env.ts`, `test/setup-test-env.ts`, `test/global-setup-db.ts` (new): forced test env and the global setup on `nusantara_play_test`.
- `test/jest-int.json` (new), `test/jest-e2e.json` (global setup, setup file, 30 s timeout).
- `test/integration/daerah.int-spec.ts` (new): the example integration test.
- `test/app.e2e-spec.ts`: expects the current `GET /` JSON object instead of `'Hello World!'`; closes the app.
- `test/events.e2e-spec.ts`: boots `AppModule` like `main.ts`; 5 runnable no-login tests; login tests in `describe.skip` with a TODO; fixed two compile errors (see 4).
- `CLAUDE.md`, `README.md`: local development docs (see Step 6).
- `.gitignore`: unchanged. It already ignores `.env.local`, and `.env.local.example` is not ignored (`git check-ignore` exit 1).

Frontend:
- `CLAUDE.md`: shared sections updated (identical to the backend; verified by string comparison).
- `.env.example`: comment lines only, describing local placeholder values.
- `.env.local` (git-ignored, not committed): `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000/api` plus placeholder Supabase values.

## 4. Decisions

- **Daerah source.** I used `src/database/migrations/002_replace_daerah_data.sql` (34 provinsi + 514 kab/kota, Kemendagri codes), not `src/migrations/1738826000000-SeedDaerahBPS.ts`. The TS migration only has kab/kota for 12 provinces, and its codes do not match the kecamatan CSV (TS `11.01` = Kab. Simeulue; SQL/CSV `11.01` = Kab. Aceh Selatan, whose kecamatan `11.01.01` is Bakongan). Only the two `INSERT` statements are executed, each with `ON CONFLICT (kode) DO NOTHING`. Its `TRUNCATE … CASCADE`, `BEGIN`/`COMMIT` and verification block are not executed.
- **Kecamatan/desa.** The script calls the `up()` of the existing `1740500100000-SeedKecamatanKelurahanDesa` migration directly, so the logic is exactly the same (prefixes, name cleanup). It skips the step when kecamatan rows already exist; the whole daerah seed runs in one transaction.
- **Prefix backfill.** Same five `UPDATE`s as `1740500000000-AddKecamatanKelurahanDesa` (that migration's `ALTER TYPE daerah_level` cannot run on the synchronized schema, because the type there is called `daerah_level_enum`).
- **Migration baseline** creates the `migrations` table with TypeORM's own layout and inserts `(timestamp, name)` for each loaded migration if missing, then checks with `DataSource.showMigrations()`.
- **DEMO data** uses fixed UUIDs (`…de01`, `…de11–13`, `…de21`) and `INSERT … orIgnore()`, so it is idempotent. Contents: user `DEMO Kurator` / `demo-kurator@example.test` (role `kurator_daerah`, fake `supabase_user_id`); PROT `DEMO Gobak Sodor` (32 / 32.73), `DEMO Egrang` (34 / 34.04) and `DEMO Congklak` (34 / 34.71), all `ARSIP_NASIONAL`; event `DEMO Teras Bermain` (published, Jawa Barat, 30 days after seeding). The test database gets the DEMO data too, because the e2e tests use the DEMO event.
- **Placeholders** use the reserved `.invalid` TLD, so nothing ever resolves or gets contacted. Blockchain variables are left **empty** rather than fake: with fake non-empty values, `new ethers.Wallet(<invalid key>)` would throw in `onModuleInit`, while empty values are the code's own "inactive" path.
- **Test env is forced, not defaulted** (`test/test-env.ts`). Values from the shell or from `.env.local` never reach the tests, and `DATABASE_URL` is deleted.
- **events.e2e compile fixes.** ts-jest type-checks skipped tests too, so the file did not compile. The skipped "published event visible to all" test used `createResponse` without declaring it, and `import * as request` is not callable. I added the missing `const` and switched to the default import. The skipped tests are otherwise unchanged.
- **e2e app setup.** `app.e2e-spec` keeps no global prefix, so `GET /` is tested as written. `events.e2e-spec` adds the `api` prefix and the `ValidationPipe` from `main.ts`, because its routes are written with `/api`.
- **Frontend check.** Chrome headless (`--dump-dom`) with a temporary profile on D:, because `/prot` is a client component and plain curl only sees the loading shell.

## 5. Deviations

- `seed:daerah` was removed along with `seed`'s broken target, since it pointed to the same missing file. `seed` itself is kept as an alias of `db:setup`.
- `test:e2e` now runs with `--runInBand` (the only change to an existing script besides `seed`).
- Otherwise none.

## 6. Verification

All commands ran in Git Bash with `npm_config_cache=D:/dev-cache/npm` and `TEMP/TMP/TMPDIR=D:/dev-cache/tmp`.

| Command | Exit | Result |
|---|---|---|
| `git log` on both mains after pull | 0 | BE `f0adc1c docs(phase-04): phase report`; FE `792c110` merge containing `dc30ff1 fix(fe): harden image proxy…` |
| `docker version` / `docker info` | 0 | Docker 29.7.2, Docker Desktop (containerized) |
| `npm run db:up` (first time: pulled `postgres:15-alpine`, 417 MB) | 0 | `Container nusantara-dev-db Healthy` |
| `psql … select version(); datname` | 0 | `PostgreSQL 15.20`; `nusantara_play_dev`, `nusantara_play_test`; `docker port` → `5432/tcp -> 127.0.0.1:5432` |
| `npm run db:setup` (1st run) | 0 | baseline `13 migrations recorded as applied (13 new). Pending: none`; `Kecamatan inserted: 7230`; `Kelurahan/Desa inserted: 83439, skipped: 1`; `provinsi=34, kabupaten=416, kota=98, kecamatan=7230, desa=74952, kelurahan=8487`; DEMO present; ~16 s |
| `npm run db:setup` (2nd run) | 0 | `(0 new)`, `already seeded, skipping the CSV import`, same counts; ~10 s |
| `select count(*), count(distinct kode) from daerah` | 0 | `91217|91217` (no duplicates); users 1, prot 3, events 1, migrations 13 |
| guard: `--database=nusantara_play` | 1 | `Refusing to run: database "nusantara_play" does not end with _dev or _test.` |
| guard: `DATABASE_HOST=db.example.com` | 1 | `Refusing to run: host "db.example.com" is not localhost or 127.0.0.1.` |
| guard: `DATABASE_URL=postgres://…@remote.example.com/x_dev` | 1 | `Refusing to run: host "remote.example.com" …` (prints host and DB name only) |
| `npm run migration:run` (dev DB) | 0 | `No migrations are pending` |
| `npm run start:dev` | — | `Found 0 errors`; only warning: `[BlockchainService] Blockchain env vars not configured. BlockchainService will be inactive.`; `Nest application successfully started` |
| `GET /api/health` | 200 | `{"status":"ok","message":"Nusantara Play API is running",…,"version":"1.0.0"}` |
| `GET /api/daerah/provinces` | 200 | `{"data":[{"nama":"Aceh","kode":"11","level":"provinsi","prefix":"Provinsi",…},{"nama":"Bali","kode":"51",…` |
| `GET /api/prot` | 200 | `{"data":[{"id":"…de11","nama":"DEMO Gobak Sodor","status":"ARSIP_NASIONAL",…` |
| `GET /api/events` | 200 | `{"data":[{"nama":"DEMO Teras Bermain","status":"published",…` |
| `GET /api/stats/landing` | 200 | `{"totalProt":3,"totalProvinsi":2,"totalEvents":1,"totalUsers":1}` |
| `GET /api/users/me` (no token / fake token) | 401 | `Authentication required`; log: `getaddrinfo ENOTFOUND supabase-placeholder.invalid` |
| `npm test -- --cacheDirectory D:/dev-cache/jest` (DB running) | 0 | 16 suites, **144 passed**, 0 failed, 0 skipped |
| same, **with the DB container stopped** (`npm run db:down`) | 0 | 16 suites, **144 passed** (proves unit tests need no DB) |
| `npm run test:int` | 0 | global setup seeded `nusantara_play_test`; **3 passed**, 0 failed |
| `npm run test:e2e` | 0 | 2 suites; **7 passed, 11 skipped**, 0 failed |
| `npm run db:reset` (no flag) | 1 | `Re-run with the confirmation flag: npm run db:reset -- --yes` |
| `npm run db:reset -- --yes`, then `db:setup`, `test:int`, `test:e2e` | 0 | both DBs recreated empty; setup 13 new baseline rows, same counts; int 3 passed; e2e 7 passed / 11 skipped |
| `npx eslint src/scripts test/integration test/*.ts` (new files) | 0 | 0 problems in every new file |
| `npx eslint "{src,apps,libs,test}/**/*.ts"` | 1 | **240 errors, 30 warnings** (baseline 406 / 30). `test/events.e2e-spec.ts` 214 → 48 errors, `test/app.e2e-spec.ts` 0 → 0 |
| `npm run build` | 0 | `nest build` OK |
| FE `pnpm test` | 0 | 6 files, **120 passed** |
| FE `pnpm dev` + Chrome headless `--dump-dom http://localhost:3001/prot` | 0 | see section 7/8 |

Disk space and Docker:

| | Before (Step 0) | After |
|---|---|---|
| C: free | **7.4 GB** | **3.4 GB** |
| D: free | 360 GB | 360 GB |
| `docker_data.vhdx` (`C:\Users\DELL\AppData\Local\Docker\wsl\disk\`) | 1.64 GB | 2.28 GB |
| Docker volume `nusantara-dev-db-data` | — | 168.4 MB |
| Image `postgres:15-alpine` | — | 417 MB |

**C: warning.** C: lost about 4 GB, but only about 0.8 GB of it is attributable to this phase's files: the
Docker disk image grew 0.64 GB, `%LOCALAPPDATA%\Google\Chrome` grew 0.15 GB (headless Chrome used a D:
profile, but Chrome still wrote about 146 MB under its default local folder), and `%LOCALAPPDATA%\Temp`
grew 0.04 GB. npm, pnpm, Jest and temp files all went to D:. The rest is most likely the system-managed
`C:\pagefile.sys`, which is now 9.5 GB allocated after Docker, Next.js dev and Chrome ran together. Its
earlier size is unknown, so this is unverified. A reboot usually shrinks it. C: is now below the 5 GB
threshold from Step 0. Nothing was deleted to recover space.

## 7. Manual checks

1. `cd nusantara-play-be`, then `npm run db:up`. Expect `Container nusantara-dev-db Healthy`.
2. `cp .env.local.example .env.local` (skip if it exists), then `npm run db:setup`. Expect the target line
   `host=127.0.0.1 database=nusantara_play_dev`, the daerah counts `provinsi=34 … kelurahan=8487`, and
   `DEMO data present`. Run it again: `(0 new)` and no errors.
3. `npm run start:dev`, then open http://localhost:3000/api/prot. Expect three `DEMO …` PROT.
   http://localhost:3000/api/daerah/provinces should return 200 with provinces.
4. `cd ../nusantara-play-fe`, create `.env.local` as described in `.env.example`, `pnpm dev`, then open
   http://localhost:3001/prot. Expect cards for DEMO Gobak Sodor, DEMO Egrang and DEMO Congklak.
   Logging in will not work (expected).
5. Stop both servers. In the backend: `npm test`, `npm run test:int`, `npm run test:e2e`. Expect
   144 passed; 3 passed; 7 passed / 11 skipped.
6. Optional: `npm run db:reset -- --yes`, then `npm run db:setup`, to get a fresh database.

## 8. Findings

### Daerah seed (rows per level)

| Level | Rows | Source |
|---|---|---|
| provinsi | 34 | `002_replace_daerah_data.sql` |
| kabupaten | 416 | `002_replace_daerah_data.sql` |
| kota | 98 | `002_replace_daerah_data.sql` |
| kecamatan | 7,230 | `docs/kecamatan_kelurahan_desa.csv` via `SeedKecamatanKelurahanDesa.up()` |
| desa | 74,952 | same |
| kelurahan | 8,487 | same |
| **total** | **91,217** | |

Data-quality notes from the existing seed:
- 1 kelurahan is skipped by the existing migration: `13.02.02.1036 Ikua Koto Dibalai`, because its parent `13.02.02` is not in the CSV.
- 1 CSV row is silently dropped by the migration's naive `split(',')` (a name containing a comma shifts the columns; its `provinsi` column reads `Kelurahan/Desa`). The CSV has 90,671 data rows, but 7,230 + 83,440 = 90,670 rows are classified.
- Province names follow the SQL/CSV spelling: `Dki Jakarta`, `Daerah Istimewa Yogyakarta` (the TS seed and `initial-data.sql` use `DKI Jakarta`, `DI Yogyakarta`).

### synchronize()

- All 18 entities were created; no entity failed.
- After `synchronize()`, TypeORM still reports 8 statements, every time: drop and recreate both FKs and both indexes of the ManyToMany junction table `produk_prot` (`FK_31069e54…`, `FK_ff211c1e…`, `IDX_31069e54…`, `IDX_ff211c1e…`). The table in the database already matches (PK on `(produk_id, prot_id)`, both indexes, both FKs). This looks like a TypeORM diff quirk for this junction table; each `db:setup` run harmlessly re-applies them. The script prints the statements as a NOTE.

### Entities vs. the old SQL schema and the TS migrations (for the later production-dump phase)

| Area | Entities (local schema) | Old SQL (`001_initial_schema.sql`) / TS migrations |
|---|---|---|
| Enum type names | TypeORM defaults `<table>_<column>_enum`: `prot_status_enum`, `prot_targetusia_enum`, `daerah_level_enum`, `users_role_enum`, `users_status_enum`, `verifikasi_status_enum`, `events_jenis_enum`, `events_status_enum`, `event_registrations_status_enum`, `marketplace_order_status_enum`, `calendar_items_type_enum`, `calendar_items_visibility_enum`, `calendar_invites_status_enum`; only `nft_catalog_status` (explicit `enumName`) and `prot_jenis_enum` match | Migrations: `prot_status`, `target_usia_enum`, `verifikasi_status`, `order_status`, `calendar_item_type`, `calendar_item_visibility`, `calendar_invite_status`; SQL: `user_role`, `user_status`, `daerah_level`, `event_status`, `permainan_status`. **If production used the migrations, running synchronize against it would try to create or rename types: never do that.** |
| Enum values | `verifikasi_status_enum` = `PENDING, APPROVED, …` | SQL: lowercase `pending, approved, …` |
| Tables only in old SQL | — | `permainan`, `communities`, `community_members`, `certificates`, `notifications`, `settings` (the RLS migration also lists them, so production may have them) |
| `verifikasi` / `verifikasi_queue` FK column | `prot_id` | SQL: `permainan_id` |
| `events.jenis`, `event_registrations.status` | Postgres enums | SQL: `varchar` |
| `events.galeri_foto` | `jsonb` | SQL: `TEXT[]` |
| `daerah.kode` | `varchar(15)` | SQL `varchar(10)`, widened by migration `1740500000000` |
| FK delete rules | default `NO ACTION` for `prot.created_by/verified_by/published_by`, `events.*`, `verifikasi.pakar_id`, etc. | Migrations/SQL: `RESTRICT` / `SET NULL` |
| `users.daerah_id`, `daerah.parent_id` FKs | none (no relation in the entities) | SQL: FKs (`SET NULL`, `CASCADE`) |
| Named/special indexes | 35 indexes total, TypeORM names; none of the `idx_*` ones, no GIN on `prot.peralatan`, no `to_tsvector('simple', nama)` index, no `idx_daerah_prefix` | Present in migrations/SQL |
| Triggers | none | SQL: `update_*_updated_at` triggers, `permainan` search-vector trigger |
| Row-level security | not enabled (migration `1776051967117` is only recorded) | enabled on all public tables by that migration |
| Settings seed | not seeded (no entity) | `initial-data.sql` inserts 5 `settings` rows; its provinces use 2-letter codes (`AC`, `SU`, …) that the later seeds replaced |

### Startup with placeholder values

- Supabase: `SupabaseService` and `JwtStrategy` only need non-empty values at boot, and boot fine. Any request with a Bearer token fails JWKS resolution (`ENOTFOUND supabase-placeholder.invalid`) and returns 401.
- AWS: `StorageService` only checks that values are non-empty; uploads will fail locally (not tested).
- SMTP: `USER_CREDENTIAL_EMAIL_ENABLED=false`, so nothing is sent.
- Blockchain: empty, so a WARN and the service stays inactive; the 5-minute retry cron still runs `retryPendingProofs` (no proofs exist).

### Frontend check (Step 5)

- `curl http://localhost:3001/prot` returned 200 (33,957 bytes), with no DEMO text: the page is `'use client'` and fetches in the browser.
- Chrome headless (`--headless=new --virtual-time-budget=20000 --dump-dom`, profile `D:/dev-cache/tmp/chrome-profile`): the DOM contains `DEMO Gobak Sodor`, `DEMO Egrang`, `DEMO Congklak`. The backend log shows `[PROT findAll] User: No user … PUBLIC filter`, i.e. the request came from the browser to `http://localhost:3000/api/prot`.
- CORS: `GET /api/prot` with `Origin: http://localhost:3001` returned `Access-Control-Allow-Origin: http://localhost:3001`.

## 9. Out-of-scope observations

- `nest build` compiles `src/scripts/` into `dist/scripts/` (`tsconfig.build.json` does not exclude it). The scripts are harmless there: they are never imported by the app, and they keep their guard. `dist/scripts/db-local-setup.js` would not find `002_replace_daerah_data.sql`, which is not copied to `dist`. Consider excluding `src/scripts` from the build.
- `SeedKecamatanKelurahanDesa` parses the CSV with `split(',')` (drops 1 row) and builds SQL by string concatenation (escaped, but fragile).
- `SeedDaerahBPS` (12 provinces, different kab/kota codes) and `002_replace_daerah_data.sql` disagree on kab/kota codes. Which one production used is unknown.
- `PROTService.findAll` logs `console.log('[PROT findAll] User: …')` with user id and email on every request.
- `JwtAuthGuard` logs every failed auth in non-production (`[JwtAuthGuard] handleRequest …`).
- Next.js 16 warns that `middleware.ts` is deprecated in favour of `proxy` (already noted in CLAUDE.md).
- `README.md` still documents Supabase and S3/MinIO setup (sections 5 and 6) and a numbered "Start Development Server" step; they are left as-is and marked as not needed locally.

## 10. Open questions

1. C: is at 3.4 GB free. Should a later phase move Docker's data to D: after all, or will the owner free more space or reboot (pagefile)?
2. Which PostgreSQL major version does production run? The local DB is pinned to 15 until known.
3. When can a production schema dump (`pg_dump --schema-only`) be obtained? The entity/migration differences above (enum type names, FK rules, missing tables and triggers, RLS) can only be settled against it.

## 11. Ready for next phase?

Yes. Local dev and test databases, the three test levels and the local frontend all work. The C: free
space (3.4 GB, below the 5 GB threshold) should be resolved before any phase that pulls more Docker
images or grows the database.
