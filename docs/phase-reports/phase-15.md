# Phase 15: Real rewards, part 1 (XP and Points ledger, province visits, PROT views, Paspor stamps)

## 1. Summary

The backend has a new rewards module (`src/modules/rewards/`). Its `RewardsService` is the only code that changes XP and
Points. Every grant is one transaction: a per-user `pg_advisory_xact_lock`, an idempotency key built on the server, rows
in the append-only `reward_ledger` (a database trigger refuses UPDATE, DELETE and TRUNCATE), and atomic balance and level
updates. The first rules match the Jelajah simulation: PROVINCE_ENTER +25 XP, PROT_VIEW +10 XP (ARSIP_NASIONAL only), and
PASPOR_STAMP +50 XP, granted automatically after min(3, the province's PROT count) views. Browser-reported actions give
XP only. The Points path (verified email required, `POINTS_HOLD_DAYS` hold) exists and is unit-tested, but no rule grants
Points except an admin adjustment. Seven endpoints, a reconciliation script and unit, integration and e2e tests were
added. The frontend received only CLAUDE.md. The phase was interrupted by a usage limit during Step 6 and resumed (see 5).
**The phase is complete.** All test suites, the build and the lint baseline check pass, and the manual curl run matched
the expected results.

## 2. Git

Step 0: backend `main` was at `a739009` ("docs(phase-14): phase report") and contains `docs/phase-reports/phase-14.md`.
Frontend `main` was at `7e18785`. Branch `phase-15-rewards-ledger` was created in both repos. Nothing was pushed.

**nusantara-play-be**, branch `phase-15-rewards-ledger`, base `a739009`:

| Commit | Step |
|---|---|
| `a5c7295` | Step 1: migration `1795300000000-CreateRewardsLedger`, four entities, `db:setup` installs the trigger |
| `83a1141` | Step 2: `RewardsService`, rules file, `levelForXp()`, keys, reconciliation script, env examples |
| `361c6c8` | Step 3: rewards and admin adjust endpoints |
| `14ced98` | Step 4: unit, integration and e2e tests |
| `5d1e22f` | Step 5: `docs/rewards-local-testing.md` (manual curl check) |
| `e0eb733` | Step 6: CLAUDE.md (shared sections + backend-only rewards documentation) |
| (this report) | Step 6: `docs/phase-reports/phase-15.md`, committed separately (hash in the final message) |

`git diff --stat a739009..e0eb733`: 31 files changed, 3991 insertions(+), 3 deletions(-)

```
 .env.example                                       |   4 +
 .env.local.example                                 |   4 +
 CLAUDE.md                                          | 114 ++++-
 docs/rewards-local-testing.md                      |  80 +++
 package.json                                       |   3 +-
 src/app.module.ts                                  |   2 +
 .../1795300000000-CreateRewardsLedger.ts           | 165 +++++++
 src/modules/rewards/__tests__/rewards-pure.spec.ts | 336 +++++++++++++
 .../__tests__/rewards-query.service.spec.ts        |  88 ++++
 src/modules/rewards/__tests__/rewards.dto.spec.ts  | 144 ++++++
 .../rewards/__tests__/rewards.service.spec.ts      | 396 +++++++++++++++
 src/modules/rewards/admin-rewards.controller.ts    |  35 ++
 src/modules/rewards/dto/rewards.dto.ts             |  95 ++++
 .../rewards/entities/reward-balance.entity.ts      |  43 ++
 .../rewards/entities/reward-ledger-entry.entity.ts |  78 +++
 .../rewards/entities/user-prot-view.entity.ts      |  48 ++
 .../rewards/entities/user-province-stamp.entity.ts |  31 ++
 src/modules/rewards/grant-plan.ts                  | 113 +++++
 src/modules/rewards/level.ts                       |  27 +
 src/modules/rewards/reward-keys.ts                 |  46 ++
 src/modules/rewards/reward-reconcile.ts            | 167 +++++++
 src/modules/rewards/rewards-query.service.ts       | 343 +++++++++++++
 src/modules/rewards/rewards.controller.ts          |  75 +++
 src/modules/rewards/rewards.module.ts              |  36 ++
 src/modules/rewards/rewards.rules.ts               | 136 ++++++
 src/modules/rewards/rewards.service.ts             | 542 +++++++++++++++++++++
 src/modules/rewards/scripts/reconcile.ts           |  66 +++
 src/scripts/db-local-setup.ts                      |   3 +
 test/integration/rewards.int-spec.ts               | 406 +++++++++++++++
 test/rewards.e2e-spec.ts                           | 366 ++++++++++++++
 test/test-env.ts                                   |   2 +
```

**nusantara-play-fe**, branch `phase-15-rewards-ledger`, base `7e18785`:

| Commit | Step |
|---|---|
| `0986940` | Step 6: CLAUDE.md shared sections |

`git diff --stat 7e18785..0986940`: 1 file changed, 84 insertions(+) (`CLAUDE.md`). No code changed.

## 3. Changes

Backend:
- `src/migrations/1795300000000-CreateRewardsLedger.ts`: hand-written, additive migration (`IF NOT EXISTS`, explicit
  names). It creates `reward_ledger`, `reward_balances`, `user_prot_views` and `user_province_stamps`, the function
  `reward_ledger_append_only()`, and the triggers `TRG_reward_ledger_append_only` and `TRG_reward_ledger_no_truncate`.
  `down()` drops all of them. The static `installDbObjects()` installs the trigger and the DESC index, and is idempotent.
- `src/modules/rewards/entities/*.entity.ts` (4): entities with the same explicit table, index and constraint names.
- `src/scripts/db-local-setup.ts`: calls `installDbObjects()` after `synchronize()`, so local databases get the trigger.
- `src/modules/rewards/rewards.rules.ts`: every rule code, amount, threshold and limit, plus `POINTS_HOLD_DAYS` parsing.
  `assertRuleIsSafe()` makes sure browser-triggered rules can never grant Points.
- `src/modules/rewards/level.ts`: `levelForXp()` / `xpForLevel()` (pure; level L needs 50 × (L − 1) × L XP).
- `src/modules/rewards/reward-keys.ts`: server-built idempotency keys (`{RULE}:{userId}:{ref}`, `{base}:POINTS`,
  `ADMIN_ADJUST:{userId}:{uuid}`).
- `src/modules/rewards/grant-plan.ts`: pure planning of the ledger rows for a rule (Points withheld without a verified
  email, `available_at`), and the Paspor threshold.
- `src/modules/rewards/rewards.service.ts`: `grant()` (advisory lock, duplicates, ledger + balances, PROT views, automatic
  Paspor stamp) and `adjust()` (admin compensating rows, never below 0).
- `src/modules/rewards/rewards-query.service.ts`: `/me`, the ledger, the Paspor and the leaderboard (with a 60 s cache).
- `src/modules/rewards/rewards.controller.ts`, `admin-rewards.controller.ts`, `dto/rewards.dto.ts`: the endpoints
  and the validation.
- `src/modules/rewards/rewards.module.ts`; `src/app.module.ts`: module registration (2 lines).
- `src/modules/rewards/reward-reconcile.ts`, `scripts/reconcile.ts`; `package.json`: `npm run rewards:reconcile [-- --fix]`.
- `.env.example`, `.env.local.example`: `POINTS_HOLD_DAYS=7`. `test/test-env.ts`: the same value for the test environment.
- `src/modules/rewards/__tests__/*.spec.ts` (4), `test/integration/rewards.int-spec.ts`, `test/rewards.e2e-spec.ts`: tests.
- `docs/rewards-local-testing.md`: the manual curl walk-through.
- `CLAUDE.md`:
  - Shared sections: Current direction item 10, Pending deployment item 10, the Local development note about
    `db:setup`, a Risks entry, an Engineering rule, lint baseline lines, and the 2026-11-19 Decisions log entries.
  - Backend-only sections: the `rewards:reconcile` command, a "Rewards" architecture section, the module list, the
    AuditInterceptor list, and the `POINTS_HOLD_DAYS` env var.

Frontend: `CLAUDE.md` only (shared sections, identical to the backend; checked with `diff`).

## 4. Decisions

All of these are recorded in the CLAUDE.md Decisions log (2026-11-19 entries):
- **`db:setup` installs the trigger.** `synchronize()` cannot create triggers or DESC indexes, so `db:setup` calls the
  migration's static `installDbObjects()`. It is a static method, not an exported function, because TypeORM loads every
  exported function of a migration file as a migration. The migrated and the synchronized schemas were compared with
  `pg_dump` and are identical.
- **Province leaderboard** = XP earned IN that province (ledger rows tagged with its `provinsi_kode`). National = `xp_total`.
  Only active users with XP > 0. `RANK()` with ties. Only the top 50 is cached; the caller's own rank is computed live.
- **Ledger details**:
  - The Points row of a grant uses the key `{base}:POINTS`. A grant counts as a duplicate when any of its keys exists, so
    Points withheld for an unverified email are not granted later by repeating the action.
  - `created_at` = `clock_timestamp()`, so rows in one transaction keep their order.
  - The trigger allows exactly one kind of DELETE: the cascade from a deleted `users` row. Otherwise accounts could never
    be deleted.
  - `user_prot_views` has no foreign key to `prot`.
  - A repeated PROT_VIEW re-checks the stamp.
- **Grant response**: `{granted, balance, level, levelUp, stamp, duplicate, pointsWithheld}`. `granted` is what this
  request added. A duplicate answers 200 with `granted` 0. Every invalid reference answers 400 with the same message per
  type, so drafts cannot be probed.
- **Admin adjust**: one row per request, refused if the balance would go below 0. Added Points need a verified email and
  are held. The response carries the row `id`, which is stored as the audit `entity_id`. Reconciliation reports a stale
  `points_available_cache` separately and does not count it as a difference.
- `POINTS_HOLD_DAYS` accepts integers from 0 to 365. Any other value falls back to 7.

## 5. Deviations

- **The phase was interrupted by a usage limit during Step 6 and resumed in a new session.** Steps 0 to 5 had been
  committed (`a5c7295` to `5d1e22f`). Both repos had uncommitted CLAUDE.md shared-section edits (84 lines each, already
  identical). These were kept unchanged: nothing was reset, stashed or discarded. The resumed session checked them,
  found every required Phase 15 addition present, added the backend-only parts, committed CLAUDE.md in both repos
  (`e0eb733`, `0986940`), re-ran the full verification on the final code, re-ran the manual curl check and wrote this
  report.
- The free disk space measured in Step 0 was not preserved through the interruption. Section 6 reports the values
  measured after resuming.
- The ledger trigger also refuses TRUNCATE, and allows the cascaded delete of a deleted user (see 4). The prompt asked
  only for UPDATE and DELETE.

## 6. Verification

All commands were run on the final code (`e0eb733`) after resuming, against the local Docker databases
(`nusantara-dev-db`, healthy).

| Command | Exit | Result |
|---|---|---|
| `npm test -- --cacheDirectory D:/dev-cache/jest` | 0 | 45 suites, **584 passed**, 0 failed, 0 skipped |
| `npm run test:int` | 0 | 7 suites, **48 passed**, 0 failed |
| `npm run test:e2e` | 0 | 8 suites, **57 passed**, 0 failed, 2 skipped (the `it.skip` already in `test/events.e2e-spec.ts`) |
| `npm run build` | 0 | `nest build`, no errors |
| `npm run lint` | 1 | `✖ 249 problems (220 errors, 29 warnings)`: the same as the baseline (exit 1 while the baseline is not 0) |
| `npx eslint src/modules/rewards test/rewards.e2e-spec.ts test/integration/rewards.int-spec.ts src/migrations/1795300000000-CreateRewardsLedger.ts src/app.module.ts` | 0 | no output (new and touched files are clean) |
| `npm run rewards:reconcile` (dev DB, after the manual run) | 0 | `2 users checked, 0 differences, 0 stale points_available_cache (not an error).` |

Rewards tests alone: unit 4 suites / 77 tests, integration 1 suite / 12 tests, e2e 1 suite / 4 tests, all passed.

In this run, the known intermittent failure in `test/email-flows.e2e-spec.ts` (see 9) did not occur.

Free disk space after resuming (before and after verification, rounded): **C: 12.9 GB, D: 345.4 GB**. This is above the
3 GB limit, and all caches are on D:.

## 7. Manual checks

The walk-through in `docs/rewards-local-testing.md` (commit `5d1e22f`) was run once against the freshly built backend
(`PORT=3002 node dist/main`; port 3000 was already in use by another local process) and the dev database. Trimmed output:

```
## register
{"success":true,"message":"Registration received. If this email can be used, you can now sign in. ..."}
## login token length 686
## PROVINCE_ENTER x2
{"granted":{"xp":25,"points":0},"balance":{"xp":25,"points":0,"pointsAvailable":0},"level":1,"levelUp":false,"stamp":null,"duplicate":false,"pointsWithheld":0}
{"granted":{"xp":0,"points":0},"balance":{"xp":25,"points":0,"pointsAvailable":0},"level":1,"levelUp":false,"stamp":null,"duplicate":true,"pointsWithheld":0}
## PROT_VIEW x4
{"granted":{"xp":10,"points":0},"balance":{"xp":35,...},"level":1,"levelUp":false,"stamp":null,"duplicate":false,...}
{"granted":{"xp":10,"points":0},"balance":{"xp":45,...},"level":1,"levelUp":false,"stamp":null,"duplicate":false,...}
{"granted":{"xp":60,"points":0},"balance":{"xp":105,...},"level":2,"levelUp":true,"stamp":{"provinsiKode":"16","xp":50,"stampedAt":"2026-11-19T06:00:02.867Z"},...}
{"granted":{"xp":10,"points":0},"balance":{"xp":115,...},"level":2,"levelUp":false,"stamp":null,"duplicate":false,...}
## /me
{"xp":115,"level":2,"xpForCurrentLevel":100,"xpForNextLevel":300,"pointsTotal":0,"pointsAvailable":0,"pointsOnHold":0}
## /me/ledger  (rule_code currency amount provinsi_kode, newest first)
PROT_VIEW XP 10 16
PASPOR_STAMP XP 50 16
PROT_VIEW XP 10 16
PROT_VIEW XP 10 16
PROT_VIEW XP 10 16
PROVINCE_ENTER XP 25 16
## /me/paspor
{"total_provinces":34,"stamped_count":1,"sumsel":{"provinsi_kode":"16","nama":"Sumatera Selatan","stamped":true,"stamped_at":"2026-11-19T06:00:02.867Z","prot_viewed":4,"prot_count":4}}
## refused
400   (type PASPOR_STAMP)
401   (no token)
## reconcile
[rewards:reconcile] 2 users checked, 0 differences, 0 stale points_available_cache (not an error).
```

Every line matches the "What you should see" table in the doc. To repeat it, follow `docs/rewards-local-testing.md`: run
`npm run db:up`, `npm run db:setup`, set the dev keys in `.env.local` and start the backend, then paste the bash
sequence. Each run uses a new email.

## 8. Findings

| Requirement | Where it is checked |
|---|---|
| Ledger trigger blocks UPDATE / DELETE (and TRUNCATE) | integration |
| Same PROT_VIEW twice → one row | integration, e2e, manual |
| 20 parallel PROT_VIEW (different PROT, one user) → exact totals, exactly one PASPOR_STAMP | integration |
| 20 parallel PROVINCE_ENTER (same province) → exactly one row | integration |
| Reconciliation clean after the races; detects (and with `--fix` repairs) a manually broken balance | integration |
| `levelForXp` boundaries 0, 99, 100, 299, 300 | unit |
| Points path: verified vs unverified email, hold period (test-only rule) | unit |
| Stamp threshold for provinces with 1, 2, 3 and 10 PROT | unit |
| Unknown type / non-ARSIP_NASIONAL PROT → 400; no token → 401; adjust as non-admin → 403 | unit, e2e, manual |
| Leaderboard without private fields | e2e |

Rules (in `rewards.rules.ts`): PROVINCE_ENTER +25 XP, PROT_VIEW +10 XP, PASPOR_STAMP +50 XP. The Paspor threshold is
`PASPOR_STAMP_MIN_PROT` = 3, the activity limit is 60 / min, the leaderboard shows 50 users with a 60 s cache, the ledger
page limit is 50, and the admin reason must be 5 to 500 characters.

## 9. Out-of-scope observations

- `test/email-flows.e2e-spec.ts` "registering an existing email" expects the emails in a fixed order, but the background
  queue sometimes delivers them in the reverse order. It failed in some earlier full runs, on main and on this branch;
  it passed in the final run. It was not changed (recorded in the Decisions log).
- A local process was already listening on port 3000 during the resumed session (probably a dev server left from before
  the interruption). It was not touched; the manual check used port 3002.

## 10. Open questions

- When the frontend switches to the self-hosted login, should the Jelajah HUD keep its local simulation as an offline
  fallback, or rely only on these endpoints?
- Should a home province be added later for the province leaderboard? Today it ranks by XP earned in that province.

## 11. Ready for next phase?

Yes. Before production, Pending deployment item 10 must be done: run migration `1795300000000-CreateRewardsLedger`
before deploying the new code, optionally set `POINTS_HOLD_DAYS`, and then run `npm run rewards:reconcile`.
