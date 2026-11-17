# Phase 02: Tooling and repo hygiene

## 1. Summary

This phase made the "tests and build must pass" rule checkable in both repos and cleaned up repo hygiene, without changing application behavior or fixing any of B1–B10 / F1–F5, except B9, which the prompt asked for. Both repos now have LF line endings enforced by `.gitattributes`. The renormalize changed no file content, because the index was already LF. The backend was formatted once with Prettier, so `prettier/prettier` is 0. `npm run lint` is now read-only, with a separate `lint:fix`. The app and the migration CLI share one DB connection builder (B9). `.env.example` is complete, and `.nvmrc` is 24. The frontend now passes `pnpm install --frozen-lockfile` (exit 0) on pnpm 9.15, 10.25, 10.34 and 12.14 with the lockfile still at `'9.0'`. It has Vitest (6/6 tests), a `.env.example`, and a dev server on port 3001. `.superpowers/` and `.claude/settings.local.json` are untracked and ignored. All verification passed: backend 16 suites / 144 tests and build, frontend 6 tests and build. The lint baselines are 406 errors / 30 warnings (backend) and 44 errors / 87 warnings (frontend, unchanged). **The phase is complete.** Nothing was pushed.

## 2. Git

**nusantara-play-be**, branch `phase-02-tooling`, base `d0e4695` (main, "docs(phase-01): baseline report and project context")

| Commit | Message |
|---|---|
| `529bf91` | chore: normalize line endings to LF |
| `c77a0b0` | style: apply prettier to backend |
| `f5b0b5b` | chore(be): tooling, env example, shared data source options |
| `8150865` | docs(phase-02): update CLAUDE.md for tooling changes |
| (this report) | docs(phase-02): phase report |

`git diff --stat d0e4695..8150865`: 86 files changed, 3015 insertions(+), 1855 deletions(-). Of these, 75 files (+2648/−1764) are the Prettier commit. The rest:

```
 .claude/settings.local.json            | 24 -----
 .env.example                           | 39 +++++--
 .gitattributes                         | 18 ++++
 .gitignore                             |  3 +
 .nvmrc                                 |  1 +
 CLAUDE.md                              | 32 +++---
 package.json                           |  3 +-
 src/config/data-source-options.spec.ts | 182 +++++
 src/config/data-source-options.ts      |  96 +++
 src/config/typeorm.config.ts           |  22 ++--
 src/database/database.module.ts        |  38 ++----
```

**nusantara-play-fe**, branch `phase-02-tooling`, base `9550df9` (main, "docs(phase-01): baseline report and project context")

| Commit | Message |
|---|---|
| `81bda6d` | chore: normalize line endings to LF |
| `c2d83f6` | chore(fe): pnpm builds, vitest, env example, hygiene |
| `f3f7256` | docs(phase-02): update CLAUDE.md for tooling changes |

`git diff --stat 9550df9..f3f7256`: 25 files changed, 833 insertions(+), 2610 deletions(-). That includes 15 `.superpowers/sdd/*.md` files removed from tracking (−2481 lines). The rest:

```
 .claude/settings.local.json |  11 -
 .env.example                |   8 +
 .gitattributes              |  18 +
 .gitignore                  |   7 +-
 CLAUDE.md                   |  29 +-
 package.json                |   8 +-
 pnpm-lock.yaml              | 835 +++++++++++++++++++++++++++++++++++++++-----
 pnpm-workspace.yaml         |  14 +-
 tests/api/base-url.test.ts  |  17 +-
 vitest.config.ts            |  15 +
```

## 3. Changes

### Backend
| File | Why |
|---|---|
| `.gitattributes` (new) | `* text=auto eol=lf` plus `binary` for png, jpg, jpeg, gif, webp, ico, pdf, woff, woff2, ttf, otf, mp4, glb, zip. |
| 75 files in `src/`, `test/` (modified) | One `npm run format` (Prettier) pass. Formatting only. Includes `src/modules/blockchain/blockchain.service.ts` (whitespace), because the phase covers all of `src/`. |
| `package.json` | `lint` without `--fix`; new `lint:fix` with `--fix`. No other script changed. |
| `.claude/settings.local.json` (untracked, file kept) | Per-machine settings should not be in git. |
| `.gitignore` | Ignore `.claude/settings.local.json`. |
| `src/config/data-source-options.ts` (new) | `buildDataSourceOptions(getEnv, { allowLegacyDbVars, warn })`: one builder for the TypeORM PostgreSQL options with the app's existing rules (B9). |
| `src/config/data-source-options.spec.ts` (new) | 12 tests: URL form, individual params, app defaults, empty URL, SSL flag (3 values × URL/params), entity/migration globs, DB_* fallback (used, per-variable precedence, no warning when not needed, ignored unless allowed, password value never in the warning). |
| `src/config/typeorm.config.ts` | Uses the builder. Loads `.env.local` then `.env`. Enables the DB_* fallback with a `console.warn`. Keeps `migrationsTransactionMode: 'each'`. |
| `src/database/database.module.ts` | Uses the builder through `ConfigService`. Keeps `logging` for development as before. |
| `.env.example` | Added DATABASE_URL, DATABASE_SSL, SMTP_HOST/PORT/SECURE/USER/PASS/FROM, USER_CREDENTIAL_EMAIL_ENABLED, with comments. Added `https://www.nusantaralegacy.org` to FRONTEND_URLS. Removed RATE_LIMIT_TTL/MAX. Blockchain section uses Polygon Amoy (`https://rpc-amoy.polygon.technology`, `polygon-amoy`). |
| `.nvmrc` (new) | `24`. |
| `CLAUDE.md` | Commands (lint vs lint:fix, format, migration env), unified DB env docs, RATE_LIMIT note, `.nvmrc`, new "Lint baseline" section, updated Decisions log. |
| `docs/phase-reports/phase-02.md` (new) | This report. |

### Frontend
| File | Why |
|---|---|
| `.gitattributes` (new) | Same content as backend. |
| `.superpowers/` (15 files) and `.claude/settings.local.json` (untracked, files kept) | Local tool state. |
| `.gitignore` | `!.env.example` after `.env*`; ignore `/.superpowers/` and `.claude/settings.local.json`. |
| `pnpm-workspace.yaml` | Replaced `ignoredBuiltDependencies` with `allowBuilds` + `onlyBuiltDependencies` for sharp and unrs-resolver. Added `packages: ['.']` (see Findings). |
| `package.json` | `dev: next dev -p 3001`, `test: vitest run`, devDependency `vitest ^5.1.0`. |
| `pnpm-lock.yaml` | Vitest tree only (+60 package entries, still `'9.0'`; see Findings). |
| `vitest.config.ts` (new) | `@/` → project root (same as tsconfig `"@/*": ["./*"]`), node environment, `tests/**/*.test.{ts,tsx}`. |
| `tests/api/base-url.test.ts` | `node:test`/`assert` → Vitest `describe/it/expect`. Same 6 cases, `assert.equal(a, b)` → `expect(a).toBe(b)`. Imports via `@/lib/api/base-url` so the alias is exercised. |
| `.env.example` (new) | Three `NEXT_PUBLIC_*` vars with comments. |
| `CLAUDE.md` | Commands (dev port, `pnpm test`, pnpm builds note), env section, shared sections identical to the backend. |

## 4. Decisions

1. **DB_* fallback only in the migration CLI.** The prompt asked for the fallback and also for no change to the app's runtime behavior. If the app also accepted DB_*, a server with `DB_SSL=true` but no `DATABASE_SSL` would silently start using SSL. So the builder only falls back when `allowLegacyDbVars: true`, which only `typeorm.config.ts` passes. With DATABASE_* set, app and CLI build identical options.
2. **The fallback works per variable.** Each DATABASE_X falls back to its own DB_* name (HOST→DB_HOST, PORT→DB_PORT, USER→DB_USERNAME, PASSWORD→DB_PASSWORD, NAME→DB_DATABASE, SSL→DB_SSL). `DATABASE_URL` has no legacy name; it was shared before. One warning lists the names used, never values.
3. **The app reads env through `ConfigService.get(key)`** instead of the `database.*` namespace. ConfigService returns the same `process.env` values that `database.config.ts` read. Empty strings are handled like before (`||` defaults; an empty `DATABASE_URL` means "not set").
4. **CLI env loading**: `dotenv.config({ path: ['.env.local', '.env'], quiet: true })`. The earlier file wins, and shell variables are never overridden, which matches `@nestjs/config`. `quiet` hides dotenv 17's banner. Checked in a scratch dir: `.env.local` beat `.env`, a `DB_DATABASE` fallback was used, and one warning was printed.
5. **pnpm build settings: both keys.** pnpm docs (pnpm.io/settings/build): `allowBuilds` replaced `onlyBuiltDependencies`/`ignoredBuiltDependencies`, which were removed in v11. `allowBuilds` exists since 10.26 (pnpm.io/blog/releases/10.26). Vercel docs (vercel.com/docs/package-managers): `lockfileVersion: 9.0` → "pnpm 9 or 10". So `allowBuilds` covers pnpm ≥ 10.26/11/12, `onlyBuiltDependencies` covers pnpm 10.0–10.25, and pnpm 9 runs dependency builds by default. pnpm 12 printed no warning for the legacy key.
6. **`packages: ['.']` in pnpm-workspace.yaml.** pnpm 9 rejects a `pnpm-workspace.yaml` without `packages` (`ERROR packages field missing or empty`). This was already true for the file on `main`. Adding it is the "keep it valid for older pnpm" part. It did not change the lockfile on any version.
7. **Vitest 5.1.0** (latest; it pulled vite 8 / rolldown, no esbuild). It added no new build-script packages, so no other allowlist entries were needed.
8. **`.env*` + `!.env.example`** instead of listing `.env` and `.env*.local` separately, so `.env.production` etc. stay ignored as before.
9. **"Lint baseline" is a shared CLAUDE.md section** with both repos' counts, so the shared part stays identical.
10. Decisions log: rewrote the Phase-01 "will do in Phase 02" entries as done entries, and replaced the outdated "pin pnpm with packageManager" entry because the prompt says not to add it in this phase.

## 5. Deviations

1. **Lockfile contains more than new entries.** pnpm 12 added a `(supports-color@7.2.0)` peer suffix to existing snapshot keys (`debug`, `@babel/core`, `eslint`, `next`, …), and that is what the 98 "deleted" lines are. No existing package was removed and no version changed: a key-by-key comparison of the `packages:` section shows 0 removed and 60 added, all from the vitest tree. `supports-color@7.2.0` was already in the lockfile. Frozen installs with pnpm 9.15.9, 10.25.0, 10.34.9 and 12.14.0 accept it unchanged.
2. **The RATE_LIMIT note is in the docs commit**, not in the Step 3 commit (CLAUDE.md, Env Vars section).
3. **Scratch folders left on D:**: `D:/.pnpm-store-compat` and `D:/dev-cache/pnpm-cache-compat`. I created them to test pnpm 9/10 without mixing stores. Claude Code's safety check blocked `rm -rf` on them, so please delete them by hand. They are not used by anything.
4. Test counts changed from Phase 01 (15/132 → 16/144) only because of the new spec. The Prettier step itself was verified at exactly 15 suites / 132 tests.

## 6. Verification

Disk before (Step 0): C: 7.5 GB free, D: 361 GB free. Disk after (Step 5): C: 7.5 GB free, D: 360 GB free.

Session env for every command: `npm_config_cache=D:/dev-cache/npm`, `TEMP/TMP/TMPDIR=D:/dev-cache/tmp`.

**Step 0**: `git checkout main && git pull` in both: "Already up to date". `d0e4695` and `9550df9` are the Phase 01 commits. Trees clean.

**Step 1**: `git ls-files --eol` before: backend 241 × `i/lf w/crlf`; frontend 206 × `i/lf w/crlf`, 14 × `-text` (ico/webp), 4 × `none` (single-line svg). `git add --renormalize .` staged nothing but `.gitattributes`. Commit stat in both repos: `.gitattributes | 18 ++++++++++++++++++, 1 file changed`. After `git rm --cached -r . && git reset --hard`: backend 242 × `i/lf w/lf`, frontend 207 × `i/lf w/lf`.

**Step 2** (backend):
| Command | Exit | Output |
|---|---|---|
| `npm run format` | 0 | 75 files rewritten; `git diff --shortstat`: 75 files changed, 2648 insertions(+), 1764 deletions(-) |
| `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | Test Suites: 15 passed, 15 total; Tests: 132 passed, 132 total |
| `npm run build` | 0 | `nest build` |
| `npx eslint "{src,apps,libs,test}/**/*.ts"` (JSON) | 1 | 406 errors, 30 warnings, prettier/prettier 0 |

**Step 3**: `npx eslint` on the 4 touched/new files: exit 0. The first run found 2 `no-unsafe-member-access` errors in the new spec, fixed by typing the mocks. `npm test`: 16 suites / 144 tests passed. `npm run build`: 0.

**Step 4** (frontend):
| Command | Exit | Output |
|---|---|---|
| `pnpm install --frozen-lockfile` (pnpm 12.14.0, D: flags, new workspace file, old lockfile) | 0 | `sharp install: Done`, `unrs-resolver postinstall: Done`; lockfile unchanged |
| scratch copy, `npx pnpm@9.15.9 install --frozen-lockfile` with the **original** `main` workspace file | 1 | `ERROR packages field missing or empty` (pre-existing) |
| scratch copy, `npx pnpm@10.34.9 …` with the **original** workspace file, side-effects cache off | 0 | no build scripts ran (control) |
| scratch copies with the new workspace file + new lockfile, `--config.side-effects-cache=false`: pnpm 9.15.9 / 10.25.0 / 10.34.9 | 0 / 0 / 0 | each: `sharp install: Done`, `unrs-resolver postinstall: Done`, lockfile byte-identical afterwards, `vitest` bin present |
| `pnpm add -D vitest` (pnpm 12) | 0 | `+ vitest 5.1.0`; `lockfileVersion: '9.0'` kept; `[WARN] Issues with peer dependencies found` (see §9) |
| `pnpm test` | 0 | Test Files 1 passed (1); Tests 6 passed (6) |
| `npx eslint vitest.config.ts tests/api/base-url.test.ts` | 0 | — |
| `git check-ignore -v .env .env.local .env.production.local .env.example` | 0 | the first three match `.env*`; `.env.example` matches `!.env.example` (not ignored) |

**Step 5**: `git status --porcelain` was empty after every command below.
| Repo | Command | Exit | Output |
|---|---|---|---|
| be | `npm ci` | 0 | installed; npm 11.19 warns that install scripts of `@scarf/scarf`, `unrs-resolver` are not approved (see §9) |
| be | `npm run lint` | 1 | `✖ 436 problems (406 errors, 30 warnings)`; prettier/prettier 0 |
| be | `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | Test Suites: 16 passed, 16 total; Tests: 144 passed, 144 total; 0 skipped |
| be | `npm run build` | 0 | `nest build` |
| fe | `rm -rf node_modules`; `pnpm install --frozen-lockfile --store-dir D:/.pnpm-store --config.cache-dir=D:/dev-cache/pnpm-cache --state-dir D:/dev-cache/pnpm-state` | 0 | `sharp install: Done`, `unrs-resolver postinstall: Done`, `+ vitest 5.1.0`, `Done in 1m 24.4s using pnpm v12.14.0`; lockfile `'9.0'` |
| fe | `pnpm test` | 0 | Tests 6 passed (6) |
| fe | `pnpm lint` | 1 | `✖ 131 problems (44 errors, 87 warnings)` (same as Phase 01) |
| fe | `NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-not-a-key pnpm build` | 0 | `✓ Compiled successfully in 21.0s`, `✓ Generating static pages using 5 workers (45/45)` |

## 7. Manual checks

1. In each repo: `git checkout phase-02-tooling`, then `git ls-files --eol | awk '{print $1,$2}' | sort | uniq -c`. Text files should show `i/lf w/lf`.
2. Backend: `npm run lint` should exit 1, list no `prettier/prettier` problems, and leave `git status` clean. `npm run lint:fix` is the fixing variant.
3. Backend: `npm test -- --cacheDirectory D:/dev-cache/jest --testPathPattern=data-source-options`. You should see 12 tests pass.
4. Backend migration CLI, without a DB: create a scratch folder with a `.env` containing `DB_HOST=x`. From that folder, require `src/config/typeorm.config.ts` via ts-node and print `dataSourceOptions.host`. You should see one `[typeorm.config] Deprecated database env vars used: DB_HOST …` line and `x`.
5. Frontend: delete `node_modules` and run the pnpm install command from CLAUDE.md. It should exit 0 and print `sharp … install: Done` and `unrs-resolver … postinstall: Done`. `head -1 pnpm-lock.yaml` should still be `lockfileVersion: '9.0'`.
6. Frontend: `pnpm test` → 6 passed. `pnpm dev` → Next.js listens on http://localhost:3001.
7. Before merging: open a Vercel preview deployment of the frontend branch. In the build log, check the pnpm version and that the install step passes.

## 8. Findings

### Backend lint baseline after Phase 02 (`npm run lint`, no fix): 406 errors, 30 warnings

| Count | Rule | Severity |
|---|---|---|
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
| 0 | prettier/prettier | — |

Phase 01 had 2,018 errors. The difference (1,612) was all `prettier/prettier`, and the non-Prettier counts are identical to Phase 01.

### Frontend lint (`pnpm lint`): 44 errors, 87 warnings (unchanged from Phase 01)

| Count | Rule | Severity |
|---|---|---|
| 47 | @typescript-eslint/no-unused-vars | warn |
| 39 | @typescript-eslint/no-explicit-any | error |
| 26 | @next/next/no-img-element | warn |
| 14 | react-hooks/exhaustive-deps | warn |
| 4 | @typescript-eslint/no-empty-object-type | error |
| 1 | react-hooks/set-state-in-effect | error |

### pnpm build-script compatibility matrix (frozen install, new files)

| pnpm | Key it reads | Exit | sharp / unrs-resolver scripts | Lockfile |
|---|---|---|---|---|
| 9.15.9 | none needed (runs dep builds by default); needs `packages` | 0 | ran | unchanged |
| 10.25.0 | `onlyBuiltDependencies` (`allowBuilds` added in 10.26) | 0 | ran | unchanged |
| 10.34.9 | `onlyBuiltDependencies` / `allowBuilds` | 0 | ran | unchanged |
| 12.14.0 (local) | `allowBuilds` (legacy key ignored, no warning) | 0 | ran | unchanged |

Production today: with the old file, pnpm 9 fails (`packages field missing or empty`). So Vercel must be on pnpm 10, where `ignoredBuiltDependencies` silently skipped both builds. After this change those two scripts will run on Vercel. sharp's script is `node install/check.js || npm run build` (checks for a prebuilt binary). unrs-resolver's is `napi-postinstall … check`.

### B9 (migration CLI env names): fixed in this phase as requested

App and CLI now use `buildDataSourceOptions`. The CLI loads `.env.local` then `.env` and reads DATABASE_*. DB_* is a CLI-only deprecated fallback with one warning.

## 9. Out-of-scope observations

1. `src/config/database.config.ts` still registers `database.*`, but nothing reads it any more. It could be removed or made to call the shared builder in a later phase (not in this phase's allowed files).
2. Vitest 5.1.0 declares a peer `@types/node "^22.0.0 || >=24.0.0"`, while the frontend has `@types/node ^20`. pnpm prints `Issues with peer dependencies found`. This is type-only and does not fail installs. Bumping `@types/node` to `^24` would match `.nvmrc`/Node 24.
3. Vite prints a notice that `vitest.config.ts` (ESM syntax in a CJS package) will need `.mts` or `"type": "module"` once Vite's native config loader becomes the default in a future major. Harmless today.
4. Backend `npm ci` with npm 11.19 warns that the install scripts of `@scarf/scarf` (telemetry) and `unrs-resolver` are not approved (`npm install-scripts approve <pkg>`). Tests, lint and build pass anyway. I did not check which backend dependency pulls in `unrs-resolver`.
5. Global `core.autocrlf=true` on this machine. `.gitattributes` now overrides it for both repos, but other repos on the machine still get CRLF.
6. The frontend `pnpm-lock.yaml` will get more `supports-color` peer-suffix churn whenever pnpm 12 re-resolves. Pinning a pnpm version (`packageManager`) later would stop the local and Vercel pnpm majors from drifting.
7. `.env.example` (backend) still says `SUPABASE_JWT_SECRET`, which Phase 01 found unused for token validation. Left as is.

## 10. Open questions

1. Is the CLI-only DB_* fallback (Decision 1) what you wanted? Or should the app also accept DB_*? That would be a runtime behavior change on servers that set DB_* but not DATABASE_*.
2. Which pnpm major does the Vercel project actually use (build log)? If it is 10.x, should a later phase pin it with `packageManager` (and which version)?
3. OK to bump the frontend `@types/node` to `^24` in a later phase (see §9.2)?
4. May I delete `D:/.pnpm-store-compat` and `D:/dev-cache/pnpm-cache-compat`, or will you remove them yourself?

## 11. Ready for next phase?

Yes. Both branches are committed locally and not pushed. The one recommended check before merging the frontend branch is a Vercel preview deploy (Manual check 7).
