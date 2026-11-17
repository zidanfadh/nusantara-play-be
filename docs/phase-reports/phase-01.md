# Phase 01: Baseline and project context

## 1. Summary
This phase recorded the real state of `nusantara-play-be` and `nusantara-play-fe` on 2026-11-17 without fixing anything. Both repos were clean, on `main`, and up to date with `origin/main`; branch `phase-01-baseline` was created in each. Backend: `npm ci`, unit tests (15 suites / 132 tests, all passing) and `nest build` succeed; ESLint (no fix) reports 2,018 errors and 30 warnings, mostly Prettier (383 of them are CRLF-only). Frontend: `pnpm install` finishes with ERR_PNPM_IGNORED_BUILDS (sharp, unrs-resolver) but `node_modules` works, lint reports 44 errors and 87 warnings, and `next build` only succeeds when the two Supabase public env vars are set (placeholder values used once). The production backend is **confirmed** to be `https://api.nusantaralegacy.org/api` (103.235.72.203, nginx on Ubuntu). It does not match the repo's `nginx/nginx.conf`, and its CORS allowlist does not include `https://nusantaralegacy.org`. All 15 known findings were checked (14 CONFIRMED, of which F4 only partly applies to the backend; 1 PARTLY; 0 NOT FOUND), both CLAUDE.md files were updated, and the phase is **complete**.

## 2. Git

| | nusantara-play-be | nusantara-play-fe |
|---|---|---|
| Branch before | `main`, clean (`git status --short` empty) | `main`, clean |
| Base commit | `5eba798cd680c935699beb2d7605a6c36c2a539e` (2026-07-07 16:23:44 +0700) "feat(stats): add landing page stats API endpoint" | `9af1e0b8d97acb448674c5dc1a86729be64c4ae7` (2026-07-08 09:50:42 +0700) "Fix formatting issues in README.md" |
| Ahead/behind origin/main after `git fetch` | `0 0` | `0 0` |
| `git pull --ff-only` | "Already up to date." | "Already up to date." |
| Remote branches | `origin/main`, `origin/feat/marketplace` (+ `origin/HEAD -> origin/main`) | `origin/main`, `origin/refactor` (+ `origin/HEAD -> origin/main`) |
| Phase branch | `phase-01-baseline` | `phase-01-baseline` |
| New commit | see the final message (a file cannot contain the hash of the commit that adds it) | see the final message |

`git diff --stat` against the base (staged changes of this phase):

```
nusantara-play-be:
 CLAUDE.md                      | 127 ++++++++++++--
 docs/phase-reports/TEMPLATE.md |  23 +++
 docs/phase-reports/phase-01.md | 389 +++++++++++++++++++++++++++++++++++++++++
 3 files changed, 520 insertions(+), 19 deletions(-)

nusantara-play-fe:
 CLAUDE.md | 90 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++------
 1 file changed, 82 insertions(+), 8 deletions(-)
```
(Measured with `git diff --cached --stat` just before committing; the stat is printed again in the final message.)

## 3. Changes

| Repo | File | Why |
|---|---|---|
| be | `CLAUDE.md` (modified) | Removed the dead `../CLAUDE.md` pointer; corrected the auth flow (JWKS + ES256, not `SUPABASE_JWT_SECRET`; Supabase admin call + `last_login_at` write on every request); noted `npm run lint` modifies files, `npm run seed` is broken, audit interceptor is not global, the two migration sources, full env var list; added the shared sections (Current direction, Deployment facts, Engineering rules, Decisions log, Phase workflow, Local machine). |
| be | `docs/phase-reports/TEMPLATE.md` (added) | Report template required by the phase workflow. |
| be | `docs/phase-reports/phase-01.md` (added) | This report. |
| fe | `CLAUDE.md` (modified) | Removed the dead `../CLAUDE.md` pointer; documented the build's Supabase env requirement, missing test runner, backend URL resolution, server-component landing page, raw `fetch` call sites, missing `.env.example`; added the same shared sections as the backend (verified identical with `diff`). |

Nothing else in either repo was changed. Scratch files were written only under `D:/dev-cache/` (logs in `D:/dev-cache/phase01/`, live frontend downloads in `D:/dev-cache/tmp/live-fe/`).

## 4. Decisions

1. **Shell:** Git Bash (`/bin/bash.exe`, bash 5.2.37). Every command was prefixed with `source D:/dev-cache/env.sh`, which only `export`s `npm_config_cache=D:/dev-cache/npm` and `TEMP`/`TMP`/`TMPDIR=D:/dev-cache/tmp` for that command.
2. **pnpm cache:** pnpm 12.14.0 has no `--cache-dir` flag. I verified with the read-only `pnpm cache path` that `--config.cache-dir=D:/dev-cache/pnpm-cache` (or env `pnpm_config_cache_dir`) moves the cache to D:, and used that.
3. **pnpm state dir:** I also passed `--state-dir D:/dev-cache/pnpm-state`, because pnpm otherwise writes machine state to the user profile on C:.
4. **Next telemetry:** `NEXT_TELEMETRY_DISABLED=1` was set for the two `pnpm build` runs only, to avoid sending telemetry from the baseline run. It does not change the build output.
5. **Lint counts:** For the per-rule counts I ran the same ESLint command again with `-f json -o D:/dev-cache/phase01/*.json` (still no `--fix`). For the frontend, `npx eslint .` gives the same total as `pnpm lint` (131).
6. **Extra CORS origins:** Because the API did not return `Access-Control-Allow-Origin` for `https://nusantaralegacy.org`, I sent a few more read-only GETs with other `Origin` values to find out which origins the allowlist contains.
7. **Second API host:** For `api.nusantaravirtual.org` I read the TLS certificate with `openssl s_client` and did a plain-HTTP GET, after `curl -k` (skip TLS check) was blocked by the environment's permission policy. I did not try to work around that block.
8. **Extra pages:** The homepage HTML has no API URL in it (stats are fetched on the server), so I also downloaded `/prot`, `/nfts` and `/marketplace` (GET only) to find the client-side bundle that contains the API URL logic.
9. **History check:** I ran one cheap `git log --diff-filter=A` check for committed `.env` files (none found; only `.env.example` files).

## 5. Deviations

1. **pnpm `--cache-dir`:** The prompt's command `pnpm install --frozen-lockfile --store-dir D:/.pnpm-store --cache-dir D:/dev-cache/pnpm-cache` fails immediately on pnpm 12.14.0 (exit 2, `error: unexpected argument '--frozen-lockfile' found ... Usage: pnpm add`; the real cause is the unknown `--cache-dir` flag). I used `--config.cache-dir=D:/dev-cache/pnpm-cache` instead (see Decisions 2–3). CLAUDE.md "Local machine" documents the working form.
2. **`api.nusantaravirtual.org` health and `/api`:** These HTTPS GETs could not be completed. TLS fails because the server presents a certificate for `api.nusantaralegacy.org` only, and the insecure retry was blocked. Status, Server header and body are therefore not available for that host over HTTPS.
3. **Step 4 disk report:** The PowerShell command that also measured `%LOCALAPPDATA%\npm-cache` timed out in the foreground; the free-space numbers in it had already been printed and are reported below.

Everything else was done as written. `blockchain/` was skipped entirely; `npm run test:e2e` was not run.

## 6. Verification

### Disk space

| When | C: free | D: free |
|---|---|---|
| Start | 7.54 GB (119 GB disk, 94 % used) | 361.81 GB |
| After Step 4 | 7.54 GB | 360.62 GB |

D: grew by about 1.2 GB (`D:/.pnpm-store` 0.77 GB, `D:/dev-cache` 0.30 GB at that point, plus `node_modules` in both repos). C: did not change. `C:\Users\DELL\AppData\Local\pnpm-cache` exists, but its last write time is 2026-10-21, before this session.

### Toolchain (Step 2)

```
OS          Microsoft Windows [Version 10.0.26200.9974] (Windows 11 Pro)
node        v24.22.0
npm         11.19.1
pnpm        12.14.0   (C:/Users/DELL/AppData/Roaming/npm/pnpm)
git         2.51.0.windows.1
docker      Docker version 29.7.2, build a7dcaa6
compose     Docker Compose version v5.5.1
core.autocrlf   true (set at system level; nothing at global level)
```
- `engines` / `packageManager`: not set in `nusantara-play-be/package.json`, `nusantara-play-fe/package.json` or `blockchain/package.json`. No `.nvmrc`, `.node-version` or `.tool-versions` in either repo.
- Lockfiles: backend `package-lock.json` (lockfileVersion 3); frontend `pnpm-lock.yaml` (lockfileVersion '9.0') plus `pnpm-workspace.yaml` containing `ignoredBuiltDependencies: [sharp, unrs-resolver]`.
- The backend `Dockerfile` uses `node:23-alpine`; the local machine runs Node 24.

### Local services (Step 2.3)

- Port 5432: nothing is listening (`Get-NetTCPConnection -LocalPort 5432 -State Listen` returned nothing).
- PostgreSQL Windows service: none installed (no service matching `postgres|pgsql`).
- `psql`: not on PATH.
- `docker ps`: no running containers. WSL distro `docker-desktop` is Stopped.
- Docker Desktop disk image is on **C:**: `C:\Users\DELL\AppData\Local\Docker\wsl\disk\docker_data.vhdx` (1.53 GB) and `...\wsl\main\ext4.vhdx` (0.09 GB).

### Backend (Step 3)

| Command | Exit | Duration | Result |
|---|---|---|---|
| `npm ci` | 0 | 122 s | added 917 packages; `54 vulnerabilities (1 low, 30 moderate, 20 high, 3 critical)`; npm warns 3 install scripts are not covered by allowScripts (`@nestjs/core`, `@scarf/scarf`, `unrs-resolver`). Lockfile unchanged. |
| `npx eslint "{src,apps,libs,test}/**/*.ts"` | 1 | 16 s | 164 files, 91 with problems, **2,018 errors, 30 warnings** |
| `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | 14 s | **Test Suites: 15 passed, 15 total; Tests: 132 passed, 132 total**; 0 failed, 0 skipped |
| `npm run build` | 0 | 10 s | `nest build` produced `dist/` (gitignored) |
| `npm run test:e2e` | not run | – | see below |

Backend lint per rule:

| Count | Rule | Severity |
|---|---|---|
| 1612 | prettier/prettier | error (383 of them are only "Delete `␍`", i.e. CRLF line endings from `core.autocrlf=true`; 1,229 are real formatting differences) |
| 174 | @typescript-eslint/no-unsafe-member-access | error |
| 88 | @typescript-eslint/no-unsafe-call | error |
| 84 | @typescript-eslint/no-unsafe-assignment | error |
| 29 | @typescript-eslint/no-unused-vars | error |
| 27 | @typescript-eslint/no-unsafe-argument | warn |
| 13 | @typescript-eslint/unbound-method | error |
| 10 | @typescript-eslint/no-unsafe-return | error |
| 4 | @typescript-eslint/require-await | error |
| 3 | @typescript-eslint/no-floating-promises | warn |
| 2 | @typescript-eslint/no-unsafe-enum-comparison | error |
| 2 | @typescript-eslint/no-unnecessary-type-assertion | error |

Test output tail:
```
PASS src/modules/marketplace/__tests__/toko.service.spec.ts
PASS src/modules/marketplace/__tests__/kategori-produk.service.spec.ts
PASS src/config/app.config.spec.ts
PASS src/modules/marketplace/__tests__/produk.service.spec.ts
PASS src/app.controller.spec.ts
PASS src/modules/nfts/__tests__/nfts.controller.spec.ts

Test Suites: 15 passed, 15 total
Tests:       132 passed, 132 total
Snapshots:   0 total
Time:        10.843 s
Ran all test suites.
```
Suites: users.service, verifikasi.service, prot.service, nfts.service, nfts.controller, toko.service, produk.service, order.service, kategori-produk.service, events.service, event-registrations.service, blockchain.service, blockchain.controller, app.config, app.controller. (The log contains `console.log` output from `PROTService.findAll`, but no errors.)

**What `test:e2e` would need:** `test/jest-e2e.json` runs `test/app.e2e-spec.ts` and `test/events.e2e-spec.ts`. `app.e2e-spec.ts` boots the full `AppModule`, so it needs a reachable PostgreSQL with the schema (`DATABASE_*` or `DATABASE_URL`), `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (JwtStrategy and SupabaseService throw on startup without them), and the AWS/SMTP settings for the modules that use them. It also expects `GET /` to return `Hello World!` without the `/api` prefix (that prefix is only set in `main.ts`). `events.e2e-spec.ts` imports `EventsModule` and logs in to get an `access_token`, so it needs a working auth backend and a test user. A local database comes in a later phase.

### Frontend (Step 3)

| Command | Exit | Duration | Result |
|---|---|---|---|
| `pnpm install --frozen-lockfile --store-dir D:/.pnpm-store --cache-dir D:/dev-cache/pnpm-cache` | 2 | 1 s | `error: unexpected argument '--frozen-lockfile' found` (pnpm 12 has no `--cache-dir`) |
| `pnpm install --frozen-lockfile --store-dir D:/.pnpm-store --config.cache-dir=D:/dev-cache/pnpm-cache --state-dir D:/dev-cache/pnpm-state` | 1 | 146 s | all dependencies installed, then `Error: ERR_PNPM_IGNORED_BUILDS ... Ignored build scripts: sharp@0.34.5, unrs-resolver@1.11.1`. Builds were **not** approved. `node_modules` is usable (lint and build run). Lockfile unchanged. |
| `pnpm lint` | 1 | 14 s | `✖ 131 problems (44 errors, 87 warnings)` (166 files, 56 with problems) |
| `pnpm build` (no env) | 1 | 18 s | fails during prerendering, see below |
| `pnpm build` with placeholder `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-not-a-key` (inline, this command only) | 0 | 21 s | `✓ Compiled successfully`, `✓ Generating static pages using 5 workers (45/45)` |
| Frontend tests | – | – | **No runner configured.** `tests/api/base-url.test.ts` exists, but there is no test runner dependency and no `test` script. Nothing was installed. |

Install output (trimmed):
```
dependencies:
+ @heroicons/react 2.2.0
+ @supabase/ssr 0.8.0
+ @supabase/supabase-js 2.93.3
+ next 16.1.6
+ react 19.2.3
...
devDependencies:
+ eslint 9.39.2
+ eslint-config-next 16.1.6
+ typescript 5.9.3
...
Error: ERR_PNPM_IGNORED_BUILDS
  × installing dependencies
  ╰─▶ Ignored build scripts: sharp@0.34.5, unrs-resolver@1.11.1
  help: Run "pnpm approve-builds" to pick which dependencies should be allowed
        to run scripts.
```

Frontend lint per rule:

| Count | Rule | Severity |
|---|---|---|
| 47 | @typescript-eslint/no-unused-vars | warn |
| 39 | @typescript-eslint/no-explicit-any | error |
| 26 | @next/next/no-img-element | warn |
| 14 | react-hooks/exhaustive-deps | warn |
| 4 | @typescript-eslint/no-empty-object-type | error |
| 1 | react-hooks/set-state-in-effect | error |

Build without env (trimmed):
```
▲ Next.js 16.1.6 (Turbopack)
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
✓ Compiled successfully in 6.0s
  Running TypeScript ...
  Generating static pages using 5 workers (0/45) ...
Error occurred prerendering page "/admin/audit".
Error: @supabase/ssr: Your project's URL and API key are required to create a Supabase client!
Export encountered an error on /(protected)/admin/audit/page: /admin/audit, exiting the build.
Error occurred prerendering page "/marketplace/seller-orders".
⨯ Next.js build worker exited with code: 1 and signal: null
```
Build with placeholders: exit 0, 45/45 static pages, route list ends with `ƒ Proxy (Middleware)`. TypeScript passed in both runs. `git status --short` was empty after every command in both repos.

### Step 5 commands
DNS with `Resolve-DnsName -DnsOnly`; HTTP with `curl -sS -D -` (GET only); certificates with `openssl s_client` + `openssl x509 -noout`. All results are in section 8.2.

## 7. Manual checks

1. `git -C nusantara-play-be log --oneline -2` and `git -C nusantara-play-fe log --oneline -2` show the commit "docs(phase-01): baseline report and project context" on top of `5eba798` / `9af1e0b`, on branch `phase-01-baseline`.
2. `git -C nusantara-play-be diff --stat main` lists only `CLAUDE.md`, `docs/phase-reports/TEMPLATE.md`, `docs/phase-reports/phase-01.md`; the frontend lists only `CLAUDE.md`.
3. Compare the shared sections: `diff <(sed -n '/^## Current direction$/,$p' nusantara-play-be/CLAUDE.md) <(sed -n '/^## Current direction$/,$p' nusantara-play-fe/CLAUDE.md)` prints nothing.
4. In a browser, open https://nusantaralegacy.org/prot, open DevTools → Network/Console, and check whether requests to `https://api.nusantaralegacy.org/api/...` are blocked by CORS (see Open question 1). The homepage stats come from the server, so the homepage alone does not prove that browser calls work.
5. `curl -s https://api.nusantaralegacy.org/api/health` should return `{"status":"ok","message":"Nusantara Play API is running",...}`.

## 8. Findings

### 8.1 Environment variables (Step 4.1, names only)

No `.env` or `.env.local` exists in either repo, and no real env file was ever committed (git history only has `.env.example` files). The backend `ConfigModule` loads `.env.local`, then `.env` (`src/config/config.module.ts`). The migration CLI data source `src/config/typeorm.config.ts` calls `dotenv.config()`, so it loads **only `.env`** and reads `DB_*` names, while the app reads `DATABASE_*` names (`src/config/database.config.ts`). Both read `DATABASE_URL`.

| Backend name | Used in code | In `.env.example` |
|---|---|---|
| NODE_ENV, PORT, APP_NAME, FRONTEND_URLS | yes | yes |
| FRONTEND_URL | yes (fallback) | only as a comment |
| DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME | yes (app) | yes |
| DATABASE_URL, DATABASE_SSL | yes (app; `DATABASE_URL` also in the CLI) | **missing** |
| DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_SSL | yes (migration CLI only) | **missing** |
| SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | yes | yes |
| SUPABASE_JWT_SECRET | read into config, only feeds an unused `JwtModule` | yes |
| SUPABASE_JWT_PUBLIC_KEY_JWK | read into config, never used | **missing** |
| AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET | yes | yes |
| SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, USER_CREDENTIAL_EMAIL_ENABLED | yes (`email.service.ts`) | **missing** |
| BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY, BLOCKCHAIN_CONTRACT_ADDRESS, BLOCKCHAIN_NETWORK | yes | yes (Mumbai values) |
| RATE_LIMIT_TTL, RATE_LIMIT_MAX | **not used** (throttler is hard-coded to 100 req / 60 s in `app.module.ts`) | yes |

`blockchain/` (skipped) reads `PRIVATE_KEY` and `AMOY_RPC_URL` and has its own `.env.example`.

| Frontend name | Used in code | Example file |
|---|---|---|
| NEXT_PUBLIC_BACKEND_API_URL | `lib/api/base-url.ts` | no `.env.example` exists |
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | `lib/supabase/client.ts`, `server.ts`, `middleware.ts` | no `.env.example` exists |
| NODE_ENV | `lib/api/base-url.ts` | – |

### 8.2 Production backend (Step 5)

**5.1 What the browser calls.** In `lib/api/base-url.ts`, `getBackendApiUrl()` passes `NODE_ENV`, `NEXT_PUBLIC_BACKEND_API_URL` and `window.location.hostname`. In production with a hostname, it strips `www.` and returns `https://api.<hostname>/api` (lines 33–37). On https://nusantaralegacy.org (or www.) the browser therefore calls **`https://api.nusantaralegacy.org/api`**. On the server (no `window`) it returns `NEXT_PUBLIC_BACKEND_API_URL`. The live client bundle contains `envBackendApiUrl:"https://api.nusantaralegacy.org/api"`, so server-side calls go to the same host.

**5.2 DNS**

| Host | Result |
|---|---|
| nusantaralegacy.org | A 216.198.79.1 |
| www.nusantaralegacy.org | CNAME → nusantaralegacy.org → A 216.198.79.1 |
| api.nusantaralegacy.org | A 103.235.72.203 |
| nusantaravirtual.org | A 216.198.79.1 |
| api.nusantaravirtual.org | A 103.235.72.203 |
| nusantaraplay.kpoti.id | NXDOMAIN ("DNS name does not exist") |
| api.nusantaraplay.kpoti.id | NXDOMAIN |
| api-nusantaraplay.kpoti.id | NXDOMAIN |

No PTR records exist for 103.235.72.203 or 216.198.79.1.

**5.3 Health and API root**

| URL | Status | Server | Body (trimmed) |
|---|---|---|---|
| https://api.nusantaralegacy.org/api/health | 200 | `nginx` | `{"status":"ok","message":"Nusantara Play API is running","timestamp":"2026-11-17T10:27:44.432Z","version":"1.0.0"}` |
| https://api.nusantaralegacy.org/api | 200 | `nginx` | `{"name":"Nusantara Play API","description":"Platform Digital Arsip Permainan Rakyat Indonesia","version":"1.0.0","endpoints":{...},"status":"Foundation MVP Complete - Ready for Phase 2"}` |
| https://api.nusantaravirtual.org/api/health and /api | – | – | TLS failure: `schannel: SEC_E_WRONG_PRINCIPAL`. The server presents `CN=api.nusantaralegacy.org` (SAN only `api.nusantaralegacy.org`, Let's Encrypt YE2, expires 2026-12-17). |
| http://api.nusantaravirtual.org/api/health | 404 | `nginx/1.24.0 (Ubuntu)` | – |
| http://api.nusantaralegacy.org/api/health | 301 → https://api.nusantaralegacy.org/api/health | `nginx/1.24.0 (Ubuntu)` | – |

The HTTPS responses carry Helmet headers (`X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`, `X-XSS-Protection: 0`) and NestJS Throttler headers (`X-RateLimit-Limit: 100`, `X-RateLimit-Reset: 60`). This matches `main.ts` and `app.module.ts`.

**5.4 CORS (GET /api/health on api.nusantaralegacy.org)**

| Origin sent | Access-Control-Allow-Origin | Access-Control-Allow-Credentials |
|---|---|---|
| https://nusantaralegacy.org | **(absent)** | true |
| https://www.nusantaralegacy.org | (absent) | true |
| https://evil.example | (absent) | true |
| https://nusantaravirtual.org | `https://nusantaravirtual.org` | true |
| https://www.nusantaravirtual.org, http://localhost:3001, http://localhost:3000, https://nusantara-play-fe.vercel.app | (absent) | – |

The production `FRONTEND_URLS` appears to contain `https://nusantaravirtual.org` but not `https://nusantaralegacy.org`. Browser (client-side) API calls from nusantaralegacy.org are therefore probably blocked by CORS. The homepage still shows stats because `app/page.tsx` fetches them on the Vercel server. I did not verify this in a browser (see Manual check 4).

**5.5 Live frontend**
- `GET https://nusantaralegacy.org` → 200 from 216.198.79.1; headers `Server: Vercel`, `X-Vercel-Id: sin1::iad1::...`, `X-Vercel-Cache: MISS`, `X-Matched-Path: /`.
- Live stats in the HTML: 12 Permainan, 7 Provinsi, 1 Events, 52 Anggota.
- 13 `/_next/static/**.js` chunks from the homepage, plus chunks from `/prot` (200), `/nfts` (200) and `/marketplace` (307), saved to `D:/dev-cache/tmp/live-fe/chunks/` (17 files).
- Hostnames found: `https://api.nusantaralegacy.org/api` (the baked-in `NEXT_PUBLIC_BACKEND_API_URL`), the template `https://api.${hostname}/api`, Supabase host `gaxqjymjpsevhmgbdiwh.supabase.co`, `https://nusantaraplay.kpoti.id/` (a "Nusantara Virtual Tour Preview" link on the landing page; that hostname does not resolve), `nusantara-play-storage.s3.ap-southeast-2.amazonaws.com` (images), `multimedia-demo.wellmagicteam.com`, `vercel.live`. No other `api.` hosts were found and no `kpoti` API host.

**5.6 Conclusion.** The live site uses **`https://api.nusantaralegacy.org/api`**, served from **103.235.72.203** by **nginx/1.24.0 on Ubuntu** in front of the NestJS app. Confidence is **high**: DNS, a healthy `/api/health` with Nest/Helmet/Throttler headers, a matching Let's Encrypt certificate, and the URL baked into the live bundle all agree. It does **not** match `nginx/nginx.conf` (`server_name api-nusantaraplay.kpoti.id`; that name has no DNS record), so the production nginx config has drifted from the repo. Unknown: who hosts the server, and whether it runs the app with `docker-compose.prod.yml`, pm2 or something else.

### 8.3 Database hints (Step 4.2)
- **Two migration locations:**
  - `src/migrations/*.ts` (13 TypeORM migrations, 1738825200000 … 1776051967117). Run with `npm run migration:run`, which uses `src/config/typeorm.config.ts` (`DB_*` names, `.env` only, `migrationsTransactionMode: 'each'`). `database.module.ts` also registers the same folder but does not set `migrationsRun`, so the app never runs them automatically.
  - `src/database/migrations/001_initial_schema.sql`, `002_replace_daerah_data.sql` and `src/database/seeds/initial-data.sql`. The README says to run these manually with `psql -f`.
- These two sources overlap. `001_initial_schema.sql` creates `verifikasi_status` (lowercase values) and tables `verifikasi` / `verifikasi_queue`. `1738827000000-AddPROTVerifikasi.ts` creates `verifikasi_status` (uppercase values) and `verifikasi` without `IF NOT EXISTS`. The TS migrations also reference `users(id)`, which only the SQL file creates. So on a fresh database neither order works as-is (static reading, not executed).
- **Supabase-specific:** `1776051967117-EnableRlsOnPublicTables.ts` runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on 25 tables (including `users` and `migrations`) without creating any policy. This is typical for silencing Supabase's "RLS disabled" advisor; with no policies, the PostgREST `anon`/`authenticated` roles cannot read these tables, while the backend's owner connection is unaffected. Nothing references the `auth` schema (`auth.users`, `auth.uid()`). The SQL schema only has a `supabase_user_id UUID UNIQUE NOT NULL` column on `users` (plus an index), and the seed comments say to create the admin in Supabase first.

### 8.4 Deployment files (Step 4.3)
| Item | Backend | Frontend |
|---|---|---|
| vercel.json / netlify.toml | none | none (Vercel uses the defaults; `next.config.ts` is empty) |
| Dockerfile | 2-stage `node:23-alpine`; `npm ci` + `npm run build`, then `npm ci --omit=dev`, copies only `dist/`, runs as `nestjs` user with `dumb-init`, `CMD node dist/main.js`, port 3000 | none |
| docker-compose | `docker-compose.prod.yml`: one `backend` service built from the Dockerfile (the GHCR `image:` line is commented out), `127.0.0.1:3000:3000`, `env_file: .env`, healthcheck `curl -f http://localhost:3000/api/health` | none |
| nginx | `nginx/nginx.conf`: TLS for `api-nusantaraplay.kpoti.id` (Certbot paths), HSTS and other headers, `limit_req` 10 r/s burst 20, `client_max_body_size 50M`, proxy to `localhost:3000`, port 80 redirects to HTTPS | – |
| CI (.github/workflows) | none | none |
| Other docs | `docs/deployment-vps.md` | – |

How each app ships: the **frontend** is built by Vercel from the repo with Vercel's defaults (no config file in the repo; project settings were not visible from here). The **backend** is presumably built on a VPS with Docker Compose behind host nginx and Certbot. The live host name differs from the repo config, and there is no CI. The production image has no `src/` or `ts-node`, so `npm run migration:run` cannot run inside it.

### 8.5 Supabase inventory (Step 4.4; tracked files, excluding node_modules, lockfiles and build output)

| Purpose | Backend | Frontend |
|---|---|---|
| Token validation | `src/modules/auth/strategies/jwt.strategy.ts` (JWKS, ES256), `src/common/interfaces/jwt-payload.interface.ts`, `src/modules/auth/auth.service.ts` (`auth.getUser(token)`) | `middleware.ts`, `lib/supabase/middleware.ts` (`getUser` for route protection), `app/(protected)/layout.tsx` |
| User sync | `src/modules/supabase/supabase.service.ts` (admin `getUserById`, `createUser`), `src/modules/users/users.service.ts`, `users.module.ts`, `users/dto/create-user.dto.ts`, `users/entities/user.entity.ts` (`supabase_user_id`), `users.service.spec.ts`, `auth/auth.controller.ts` + `auth.service.ts` (change password via `signInWithPassword` + `admin.updateUserById`) | `hooks/useCurrentUser.ts`, `types/user.ts`, `types/auth.ts` |
| OAuth | – | `components/auth/SocialAuthButtons.tsx` (`signInWithOAuth`), `app/auth/callback/route.ts` (`exchangeCodeForSession`) |
| Client session | – | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `contexts/AuthContext.tsx` (sign in/up/out, session), `lib/api/client.ts`, `lib/api/nfts.ts`, `lib/api/prot.ts` (read access token), `app/page.tsx`, `app/menu/page.tsx`, `app/landing-page/1/page.tsx`, `app/landing-page/2/page.tsx`, `components/admin/AdminHeader.tsx` (signOut) |
| Config | `src/config/supabase.config.ts`, `src/config/config.module.ts`, `src/config/database.config.ts` (comment about Supabase SSL), `src/app.module.ts`, `src/modules/supabase/supabase.module.ts`, `src/modules/supabase/index.ts`, `src/modules/auth/auth.module.ts`, `.env.example`, `package.json`, `src/database/migrations/001_initial_schema.sql`, `src/database/seeds/initial-data.sql` | `package.json` (`@supabase/ssr`, `@supabase/supabase-js`) |
| Docs / tooling | `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/deployment-vps.md`, `docs/blockchain-next-steps.md`, `docs/frontend/{auth,blockchain,users}_module.md`, `docs/plans/2025-02-05-sync-user-from-supabase{,-design}.md`, `docs/plans/2026-02-11-events-feature-{design,implementation}.md`, `docs/plans/2026-03-17-blockchain-verification.md`, `docs/postman/Nusantara_Play_Blockchain_API.postman_collection.json`, `.claude/settings.local.json` | `CLAUDE.md`, `PAGES.md`, `docs/oauth.md`, `docs/admin-panel.md`, `docs/calendar_implementation.md`, `docs/plans/2026-03-18-frontend-refactor.md`, `docs/plans/2026-03-19-landing-page-refactor.md`, `docs/superpowers/{plans,specs}/2026-07-07-guest-public-access*.md`, `.superpowers/sdd/task-2-*.md` (4 files) |

### 8.6 Known findings (Step 6)

| ID | Verdict | Location | Note |
|---|---|---|---|
| B1 | **CONFIRMED** | `src/modules/prot/prot.service.ts:302-448` (vs `update()` at 259-279); routes `prot.controller.ts:90-177` | `addFotoKegiatan`, `addVideoKegiatan`, `removeFotoKegiatan`, `removeVideoKegiatan`, `addDokumenKurikulum`, `removeDokumenKurikulum`, `addFotoAlat`, `removeFotoAlat` only call `findOne(id)`, with no `created_by` or status check, so any `kurator_daerah` can change media on any PROT in any status. The remove methods **do** delete the S3 object (`storageService.deleteFile` at 346, 364, 397, 444), before the DB save. |
| B2 | **CONFIRMED** | `blockchain/contracts/ProtVerification.sol:26-40` | `recordVerification()` is `external` with no `onlyOwner`/role check; anyone can write records. |
| B3 | **CONFIRMED** | `src/modules/blockchain/blockchain.service.ts:112-122` vs `ProtVerification.sol:30-31` | The DB version is `proofRepository.count(...) + 1`, while the contract uses its own `latestVersion[protId] + 1`. The two can drift after failed or retried transactions. |
| B4 | **CONFIRMED** | `src/modules/marketplace/order.service.ts:47-57` (create), `173-208` (cancel) | `create()` uses a transaction but reads `produk.stok`, checks it, and saves `stok -= qty` without a lock or conditional UPDATE, so concurrent orders can oversell. `batalkan()` checks the order status **outside** the transaction and restocks with the same read-modify-write, so two concurrent cancels can restock twice. |
| B5 | **CONFIRMED** | `src/modules/prot/verifikasi.service.ts:122-147` | `pickFromQueue()` reads the queue row, checks `assigned_pakar_id` is null, then saves. No lock or conditional UPDATE, so two pakar can both claim the same item. |
| B6 | **CONFIRMED** | `src/modules/auth/strategies/jwt.strategy.ts:37-67`; `src/modules/supabase/supabase.service.ts:42`; `users.service.ts:218-222` | On every authenticated request `validate()` calls the Supabase admin API (`fetchUserById`), runs `syncFromSupabase` (a DB write) and `updateLastLogin`. The global `JwtAuthGuard` runs before the `ThrottlerGuard`. |
| B7 | **CONFIRMED** | `src/modules/prot/prot.controller.ts:180-189`; `dto/submit-kurasi.dto.ts:3-8`; `prot.service.ts:450` | `submitDto.catatan` is validated but never passed on; `submitKurasi(protId, userId)` has no parameter for it. |
| B8 | **CONFIRMED** | `.env.example:35-43` | The comment says "Polygon Mumbai", `BLOCKCHAIN_RPC_URL` is the Mumbai RPC, `BLOCKCHAIN_NETWORK=polygon-mumbai`, and it refers to `deploy:mumbai`. The code default is `polygon-amoy` (`blockchain.service.ts:125`), and `blockchain/` uses `AMOY_RPC_URL`. |
| B9 | **CONFIRMED** | `src/config/typeorm.config.ts:5-19` vs `src/config/database.config.ts:5-13` | The CLI reads `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE/DB_SSL` and loads only `.env`; the app reads `DATABASE_*` and loads `.env.local` and `.env`. Only `DATABASE_URL` is shared. |
| B10 | **CONFIRMED** | `src/modules/notifications/email.service.ts:84-106`; `src/modules/users/users.service.ts:171-207` | When an admin creates a user with `send_email: true` and `USER_CREDENTIAL_EMAIL_ENABLED=true`, the admin-chosen password (`dto.password`) is emailed in plaintext (text and HTML). The email asks the user to change it, but nothing enforces that. |
| F1 | **PARTLY** | `app/api/proxy-image/route.ts:3-30` | Confirmed: it fetches any `url` query parameter (any scheme/host, follows redirects) and returns the remote `Content-Type`. Partly mitigated: `/api/proxy-image` is not in the public list in `middleware.ts`, so it needs a Supabase session, but anyone can sign up. Used by `components/dashboard/ProfileCard.tsx:16`. |
| F2 | **CONFIRMED** | `app/nfts/[slug]/page.tsx:130`; backend `src/modules/nfts/dto/create-nft.dto.ts:28-30` | `nft.about` is rendered with `dangerouslySetInnerHTML`, only `\n`→`<br/>`. The backend validates it only as `@IsString()`; there is no sanitizer in either repo. Writes are limited to `admin_kpoti` (`nfts.controller.ts:77-96`), so this is stored XSS by an admin or a compromised admin account. |
| F3 | **CONFIRMED** | `lib/api/base-url.ts:33-37` | It always builds `https://api.<hostname>/api`. On `nusantaravirtual.org` that becomes `api.nusantaravirtual.org`, which serves the wrong certificate. On Vercel preview domains (`*.vercel.app`) the host does not exist. |
| F4 | **CONFIRMED** (backend PARTLY) | be: `.claude/settings.local.json`; fe: `.claude/settings.local.json` + 15 files in `.superpowers/sdd/` | Backend has only `.claude/settings.local.json` committed (18 allow rules) and no `.superpowers/`. Frontend has both. Neither `.gitignore` mentions them. A pattern scan found nothing that looks like a secret. |
| F5 | **CONFIRMED** | `middleware.ts:9` | `/about` is in `publicExactRoutes`, but no `about` route exists anywhere under `app/`. |

Summary: 14 CONFIRMED (F4 only partly for the backend), 1 PARTLY (F1), 0 NOT FOUND.

## 9. Out-of-scope observations
1. **CORS mismatch in production:** `Access-Control-Allow-Origin` is returned for `https://nusantaravirtual.org` but not for `https://nusantaralegacy.org` (section 8.2). Client-side features on the live site may be broken.
2. **Rate limiting behind nginx (plausible, not verified):** `main.ts` does not set Express `trust proxy`, and `ThrottlerGuard` keys on `req.ip`. Behind nginx every request may come from the proxy address, so all users would share one 100 req/min bucket.
3. **`npm run seed` is broken:** it points to `src/seeds/index.ts`, which does not exist.
4. **Schema bootstrap conflict** between `001_initial_schema.sql` and the TS migrations (section 8.3).
5. **`npm audit`:** 54 vulnerabilities in the backend (3 critical, 20 high). Not investigated.
6. **CRLF:** `core.autocrlf=true` (system level) with no `.gitattributes` means a Windows checkout gets CRLF, which accounts for 383 Prettier errors locally. Relevant for the Phase 02 Prettier pass.
7. **Dockerfile** uses `node:23-alpine` (odd-numbered, non-LTS line); local dev is Node 24. No `engines` field anywhere.
8. **Production nginx on port 80** reveals `nginx/1.24.0 (Ubuntu)` (the repo config only sets `server_tokens off` in the 443 block).
9. **Dead link on the live landing page:** "Nusantara Virtual Tour Preview" → `https://nusantaraplay.kpoti.id/` (NXDOMAIN).
10. `prot.service.ts remove()` (admin delete) does not delete the PROT's S3 objects. The media remove methods delete from S3 before saving the DB row, so a failed save leaves a dangling URL.
11. `jwt.strategy.ts:54` calls `payload.email.split('@')` in the fallback path; a token without `email` would throw.
12. `audit/` is described as global in the old CLAUDE.md, but `AuditInterceptor` is only applied in 4 controllers (auth, nfts, prot, verifikasi). Mutations elsewhere (marketplace, events, calendar, users) may not be audited.
13. `RATE_LIMIT_TTL`/`RATE_LIMIT_MAX` in `.env.example` are ignored by the code.
14. Next.js 16 warns that `middleware.ts` should be renamed to `proxy`.
15. No CI workflows in either repo.

## 10. Open questions
1. **CORS:** Is the production `FRONTEND_URLS` meant to include `https://nusantaralegacy.org` (and `www.`)? Today only `https://nusantaravirtual.org` is allowed. Can someone check the browser console on https://nusantaralegacy.org/prot?
2. **nusantaravirtual.org:** Is it still meant to serve the app? `api.nusantaravirtual.org` resolves to the API server but has no matching certificate.
3. **Backend hosting:** Who hosts 103.235.72.203, how is the backend deployed there (Docker Compose? pm2?), and who has access? The repo `nginx/nginx.conf` is out of date. Should it be updated to `api.nusantaralegacy.org` in a later phase?
4. **Production database:** Please confirm it is the Supabase project `gaxqjymjpsevhmgbdiwh` (the same project used for auth).
5. **Local DB bootstrap:** For the local database phase, which schema source is authoritative: the TS migrations, the SQL files, or SQL first and then a subset of the migrations? As written they conflict.
6. **pnpm version to pin (Phase 02):** This machine has pnpm 12.14.0 (lockfile v9.0). Should `packageManager` pin 12.14.0, or a version matching what Vercel uses?
7. **Line endings (Phase 02):** Add a `.gitattributes` with `* text=auto eol=lf` (or set Prettier `endOfLine: auto`) before the one-time Prettier pass?
8. **Fix `npm run seed`:** should a later phase fix it or remove it?
9. **Making the D: settings permanent:** The owner can run these commands (they change user-level settings, so I did not run them):
   ```powershell
   # npm / npx cache
   npm config set cache "D:/dev-cache/npm" --location=user
   # pnpm store, metadata cache and state (check afterwards with: pnpm config get cache-dir)
   pnpm config set store-dir "D:/.pnpm-store" --location=global
   pnpm config set cache-dir "D:/dev-cache/pnpm-cache" --location=global
   pnpm config set state-dir "D:/dev-cache/pnpm-state" --location=global
   # Temp folder for your user account (affects every program; new terminals only)
   setx TEMP "D:\dev-cache\tmp"
   setx TMP "D:\dev-cache\tmp"
   # Optional alternative to the pnpm config commands:
   setx pnpm_config_cache_dir "D:\dev-cache\pnpm-cache"
   ```
   Jest has no env var for its cache folder. Keep passing `--cacheDirectory D:/dev-cache/jest`, or add `cacheDirectory` to the Jest config in a later phase. Docker Desktop's disk image can be moved to D: in Docker Desktop → Settings → Resources → Advanced → "Disk image location".

## 11. Ready for next phase?
**Yes.** Nothing blocks Phase 02 (Vitest, pnpm build approval and pin, ignoring the tool folders, Prettier pass). Open questions 6 and 7 should be answered before or at the start of Phase 02. Open question 1 (CORS) may affect the live site and should be checked soon, independent of the phase plan.
