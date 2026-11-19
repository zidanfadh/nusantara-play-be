# Rewards: manual check against the local backend (Phase 15)

A short curl sequence that logs in as a local user, enters Sumatera Selatan, views the 4 DEMO PROT and
shows `GET /api/rewards/me`, the ledger and the Paspor stamp. It runs against **your local backend**
and the local dev database only; it never touches production.

## Before you start

1. Database running and seeded: `npm run db:up`, `npm run db:setup` (the DEMO data includes
   `DEMO PROT Sumsel 1` to `4`, provinsi 16, ARSIP_NASIONAL, ids `…de31` to `…de34`).
2. `.env.local` has a dev key pair (`npm run auth:generate-keys`, see CLAUDE.md "Local development"),
   so the self-hosted login works. The auth walk-through is in `docs/auth-local-testing.md`.
3. Backend running: `npm run start:dev` (http://localhost:3000/api). Another port works too
   (`PORT=3002 node dist/main` after `npm run build`); then change `API` below.

## The sequence (Git Bash or any POSIX shell)

No jq needed: `node` pretty-prints the JSON. Every new email gets its own account, so the sequence
can be repeated; the first run per account earns the rewards, a second identical call is a duplicate.

```bash
API=http://localhost:3000/api
EMAIL="rewards-$(date +%s)@example.test"
PASSWORD='a long local test password'
SUMSEL=16
PROTS="00000000-0000-4000-8000-00000000de31 00000000-0000-4000-8000-00000000de32 00000000-0000-4000-8000-00000000de33 00000000-0000-4000-8000-00000000de34"
pretty() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.stringify(JSON.parse(s),null,2)))'; }

# 1. Register and log in (local endpoints); keep the access token.
curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Rewards Manual\"}"; echo
ACCESS=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
AUTH=(-H "Authorization: Bearer $ACCESS" -H 'Content-Type: application/json')

# 2. Enter Sumatera Selatan: +25 XP. The same call again: duplicate, +0.
curl -s "${AUTH[@]}" -X POST "$API/rewards/activities" -d "{\"type\":\"PROVINCE_ENTER\",\"refId\":\"$SUMSEL\"}" | pretty
curl -s "${AUTH[@]}" -X POST "$API/rewards/activities" -d "{\"type\":\"PROVINCE_ENTER\",\"refId\":\"$SUMSEL\"}" | pretty

# 3. View the 4 DEMO PROT: +10 XP each; the 3rd view earns the Paspor stamp (+50 XP, level 2).
for id in $PROTS; do
  curl -s "${AUTH[@]}" -X POST "$API/rewards/activities" -d "{\"type\":\"PROT_VIEW\",\"refId\":\"$id\"}" | pretty
done

# 4. Balance, ledger (newest first), Paspor (only Sumatera Selatan shown here).
curl -s "${AUTH[@]}" "$API/rewards/me" | pretty
curl -s "${AUTH[@]}" "$API/rewards/me/ledger?limit=10" | pretty
curl -s "${AUTH[@]}" "$API/rewards/me/paspor" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(JSON.stringify({total_provinces:p.total_provinces,stamped_count:p.stamped_count,sumsel:p.provinces.find(x=>x.provinsi_kode==="16")},null,2))})'

# 5. Refused: an unknown type (400) and no token (401).
curl -s -o /dev/null -w '%{http_code}\n' "${AUTH[@]}" -X POST "$API/rewards/activities" -d '{"type":"PASPOR_STAMP","refId":"16"}'
curl -s -o /dev/null -w '%{http_code}\n' "$API/rewards/me"

# 6. Optional: the ledger and the balances agree.
npm run rewards:reconcile
```

## What you should see

| Step | Result |
|------|--------|
| 2 first PROVINCE_ENTER | `granted.xp` 25, `balance.xp` 25, `level` 1, `duplicate` false |
| 2 repeated | `granted.xp` 0, `duplicate` true, balance unchanged |
| 3 views | `granted.xp` 10, 10, **60** (stamp: `stamp.provinsiKode` "16", `levelUp` true, level 2), 10 |
| 4 /me | `xp` 115, `level` 2, `xpForCurrentLevel` 100, `xpForNextLevel` 300, all Points 0 |
| 4 ledger | 6 rows, newest first: PROT_VIEW, PASPOR_STAMP, PROT_VIEW × 3, PROVINCE_ENTER |
| 4 paspor | 34 provinces, `stamped_count` 1; Sumatera Selatan `stamped` true, `prot_viewed` 4, `prot_count` 4 |
| 5 | `400`, `401` |
| 6 | `0 differences` |

Points stay at 0: browser-reported actions only ever give XP (CLAUDE.md "Rewards"). The leaderboard is
`GET /api/rewards/leaderboard` (national) or `?scope=province&provinsiKode=16`.

Clean up (optional, dev database only): deleting the user also deletes its ledger rows, balance, views
and stamps (the append-only trigger allows only this cascaded delete):

```bash
docker exec nusantara-dev-db psql -U postgres -d nusantara_play_dev \
  -c "DELETE FROM users WHERE email LIKE 'rewards-%@example.test'"
```
