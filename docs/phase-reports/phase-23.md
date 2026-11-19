# Phase 23: Egrang (stilts), the third self-hosted game

> Working draft. Step 0 is recorded below; the full report replaces this file in step 8.

## Step 0: preflight and archive check

- Disk: C: 13 GB free, D: 336 GB free (limits 3 GB / 10 GB).
- Phase 22 merged: backend `main` = `origin/main` = `b2eacb1` (phase-22 branch is an ancestor); frontend `origin/main` =
  `efbfbb0` "Merge pull request #20 from zidanfadh/phase-22-more-provinces" (local `main` fast-forwarded from `6df8fe7`).
- Branches: `phase-23-egrang` in both repos (frontend from `efbfbb0`, backend from `b2eacb1`).
- Archive: `GET https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&page=1&limit=100` (read-only, no auth)
  → 5 records (`pagination.total` 5): SEPANGKAL, Egrang Batok, Egrang Bambu, Gasing, Test Permainan Jawa Barat.

| Record | Province / place | id | Text fields |
|---|---|---|---|
| Egrang Bambu | Jawa Tengah (33), Kabupaten Magelang (33.08) | `e32ed727-4455-434e-b1b1-b984413e9f24` | statusAsalUsul, caraBermain (5 numbered steps), nilaiMoral, peralatan (1: "Egrang Bambu", description = the asal-usul text, price 37000) ; deskripsi null, jumlahPemain null, targetUsia SEMUA_USIA |
| Egrang Batok | Sulawesi Selatan (73), Kabupaten Soppeng (73.12) | `a6ce0739-bcb5-43ae-9e13-0ea74d7b8f3f` | statusAsalUsul (3 paragraphs), caraBermain (1 paragraph, mentions races to a finish line "tanpa jatuh"), nilaiMoral (3 values), peralatan (1: "Egrang Batok", price 13000) ; deskripsi null, jumlahPemain null, targetUsia SEMUA_USIA |

What each record says that the game uses (paraphrased in `lib/games/egrang/texts.ts`, credited, linked to `/prot/<id>`):

- **Egrang Bambu**: known since Dutch colonial times, recorded in the Dutch children's games book "Javanese Kinder
  Spellen"; the name "egrang" comes from Lampung ("terompah pancung", tall sandal); popular in Javanese villages, widely
  known in Karawang (Jawa Barat) around the 1960s. Play: put both stilts on the ground in parallel, climb onto the foot
  rests (one foot each), hold the top of the bamboo, keep your balance, lift one foot with its stilt and move it forward
  alternately, like walking but high up; look straight ahead, stay relaxed. Values: balance, coordination, leg
  strength, concentration, courage, patience, self-control; philosophy "keeping life in balance" (buana atas, tengah,
  bawah).
- **Egrang Batok**: two coconut-shell halves with a hole on top for a string; stand on the shells, hold the strings,
  walk while pulling the strings to keep balance; consistently said to come from Sulawesi Selatan, born from the
  creativity of rural (especially Bugis) communities using the plentiful coconut shells. Play: put the shells on the
  ground, step on their middle, clamp the string between the toes, hold the strings with both hands and pull them up so
  the shells stay on the feet; walk lifting one foot at a time while pulling the strings; flat ground or short grass;
  for balance practice or races where the fastest to the finish line without falling wins. Values: patience and
  concentration (easy to fall), cooperation and creativity (making your own), adapting to the environment.

Observations (not changed; data only): Egrang Bambu's `alamatLengkap` says "Kota Magelang" while its `kabkotaName` is
"Kabupaten Magelang" (the game credits the `kabkotaName`, like gasing). Neither record states a number of players.

Result: both records are present and published, so the phase continues.
