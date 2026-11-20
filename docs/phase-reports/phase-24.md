# Phase 24: Sepangkal (Aceh), stopped at Step 0

## 1. Summary

Phase 24 stopped at Step 0, as the prompt's STOP rule requires. The published record "SEPANGKAL" (Aceh, Kabupaten Aceh Singkil)
exists. Its "cara bermain" is one paragraph that explains the word, and it breaks off in the middle of a sentence. It gives the
idea of the game: two people standing, each trying to make the other fall while not falling themselves. It gives no rules: no
grip, no allowed moves, no definition of a fall, no area, no rounds and no winner. The record's media do not show sepangkal:
- an equipment photo is a football trophy;
- the "Lapangan" photos show a coconut-shell game;
- the activity photos show seated children;
- the "dokumen kurikulum" PDF is an unrelated set of certification task letters. It contains real names and national ID (KTP)
  numbers and is publicly linked from `/prot/<id>` (section 9, urgent).

A faithful game cannot be built from this, so nothing was built and Parts B and C were not started. **The phase is not complete.**
It can resume once the curator has completed the record (section 10).

## 2. Git

| Repo | Branch | Base | Commits |
|---|---|---|---|
| nusantara-play-be | `phase-24-sepangkal` | `2794e36` (Phase 23 report, = `origin/main`) | this report (Step 0) |
| nusantara-play-fe | `phase-24-sepangkal` | `8b4021f` (Merge PR #21, Phase 23, = `origin/main`) | none |

Preflight:
- Phase 23 is merged into `origin/main` in both repos (`git merge-base --is-ancestor`).
- The frontend's local `main` was fast-forwarded `efbfbb0` → `8b4021f` before branching.
- Nothing pushed.

## 3. Changes

- `nusantara-play-be/docs/phase-reports/phase-24.md`: this Step 0 report (added).

## 4. Decisions

- **STOP rather than invent rules.** The record gives an objective but no way to play, win or lose.
  - Gasing (Phase 20) and Egrang (Phase 23) were built from records with real step-by-step "cara bermain".
  - A pushing game built from one sentence would present invented rules as the archive's.
- **The PDF was read as text, not rendered.** No PDF renderer is installed, so a small Node script (scratchpad only) inflated its
  streams and printed the text. No personal data from it is repeated in this report.

## 5. Deviations

- Steps 1 to 8 (the game, the integration, the Aceh pavilion, the bumper button) were not done: STOP rule of Step 0.
- Part C (`docs/panduan-input-prot.md`) was not written. The STOP rule says "commit nothing else", and Part C is part of this
  phase. It does not depend on the record, so it can be done on its own if the owner wants it now (section 10).
- The Phase 23 review addendum (pavilion labels, dense bumper on every scene, the gasing-timeout cleanup note) was not done, for
  the same reason.

## 6. Verification

Disk before: C: 11 GB free, D: 336 GB free (C: above the 3 GB limit). Downloads went to `D:/dev-cache/tmp/phase-24/archive/`.

| Command | Result |
|---|---|
| `GET https://api.nusantaralegacy.org/api/prot?status=ARSIP_NASIONAL&page=1&limit=100` (no auth) | 200, 5 records: SEPANGKAL, Egrang Batok, Egrang Bambu, Gasing, Test Permainan Jawa Barat |
| `GET https://api.nusantaralegacy.org/api/prot/752aeea4-a9c4-455b-a216-71f508bcfe3c` (no auth) | 200, status `ARSIP_NASIONAL` |
| `GET` of the record's 5 PNG files and 1 PDF from the public S3 bucket | 200 each |

No credentials were used. Only read-only GETs reached production. No code changed, so no tests or build were run.

## 7. Manual checks

1. Open `/prot/752aeea4-a9c4-455b-a216-71f508bcfe3c` on the live site. "Cara bermain" ends with "…maka keadaan seperti ini dalam
   bahasa" (cut off).
2. On the same page, open the equipment "Biji Pinang": its photo is a football trophy. Its purchase link goes to a cake product
   ("kue biji ketapang") on a marketplace.
3. Open the "dokumen kurikulum" link: it is not about the game, and it shows names and KTP numbers. **Please have an admin remove it**
   (section 9).

## 8. Findings

### Step 0: the record

| Field | Value |
|---|---|
| id | `752aeea4-a9c4-455b-a216-71f508bcfe3c` |
| nama | SEPANGKAL (`PERMAINAN_RAKYAT`) |
| Place | Aceh (11), Kabupaten Aceh Singkil (11.10), alamat "Aceh Singkil Barat"; kecamatan and desa null |
| deskripsi | null |
| jumlahPemain | null |
| targetUsia | SEMUA_USIA |
| statusAsalUsul | the same paragraph as below, 204 characters, cut off after "selain menjaga" |
| nilaiMoral | the same 204 characters as statusAsalUsul (no moral value stated) |
| caraBermain | 306 characters, cut off (quoted below) |
| peralatan | "Lapangan": "lapangan terbuka", Rp 5000, 2 photos. "Biji Pinang": "biji kelapa pinang", Rp 2000, 1 photo, 1 purchase link |
| fotoKegiatan | 2 photos |
| videoKegiatan | null |
| dokumenKurikulum | 1 PDF (20 pages) |

The whole "cara bermain", verbatim:

> "Perkataan sepangkal adalah bahasa Alas yang artinya saling menjatuhkan atau baku jatuh. Bila seseorang berusaha menjatuhkan
> seseorang lawannya dari keadaan berdiri, sedangkan lawannya tadi selain menjaga diri agar jangan jatuh juga berusaha pula
> menjatuhkan lawannya, maka keadaan seperti ini dalam bahasa "

The text ends there. Nothing in the code cuts it: all three fields are `text` columns, and the DTO has only `@IsString()` and
`@IsOptional()`. The text was entered like this.

**What the record says, in my own words:**
- "Sepangkal" is a word in the Alas language meaning "saling menjatuhkan" / "baku jatuh" (making each other fall).
- It describes a situation, not a procedure. Someone tries to bring an opponent down from a standing position. The opponent
  protects themselves from falling and tries to bring the first person down too.

Against the questions in Step 0.2:

| Question | What the record says |
|---|---|
| Players | Implied two ("seseorang" and "lawannya"); `jumlahPemain` is null |
| Objective | To make the opponent fall while not falling yourself |
| How one wins or loses | Not stated. Implied: whoever falls loses. What counts as a fall is not said |
| Positions and moves | Only "dari keadaan berdiri" (from standing). How the players hold or push each other is not said |
| Area | "lapangan terbuka" (equipment entry). No size and no boundary |
| Equipment | "Biji Pinang" is listed, but nothing says what it is for |

**The media do not show sepangkal:**

| File | What it shows |
|---|---|
| Activity photo 1 (399x294) | Children sitting in a circle on a mat indoors, one leaning forward to the floor |
| Activity photo 2 (980x723) | Children in masks kneeling on a tiled floor, picking up small stones |
| "Lapangan" photo 1 | Scanned book photo captioned "Tempurung dijepit." (children walking with coconut shells on a path) |
| "Lapangan" photo 2 | Scanned book photo captioned "Tempurung dijepit dengan paha." (a coconut shell held between the thighs) |
| "Biji Pinang" photo | A football (FIFA World Cup) trophy on a transparent background |
| "Biji Pinang" purchase link | A marketplace listing for a cake product ("kue biji ketapang kelapa parut") |
| "dokumen kurikulum" PDF | 20 pages of "Surat Tugas" / "Surat Perintah Tugas" of a publishing certification body (August 2024): officers' names and KTP numbers. No mention of sepangkal, a game or Aceh |

### Step 0.3: design proposal (provisional, not built)

This sketch is for discussion with the curator. It is not a design taken from the record. It would only become one if the curator
confirms or replaces the rules in brackets.

- **Core action.** Two friendly code-drawn players stand face to face on a flat earth ring in an Aceh village.
  - Each keeps a balance meter steady while pushing or pulling at the right moment. [grip and allowed moves: curator]
  - A player is pushed off balance when their meter tips over. They tumble cartoon-style (no injury, they get straight back up).
- **Controls.** Phone: two large touch zones, "Dorong" (push) and "Tahan" (brace). Keyboard: the same two keys, through one input
  path, as in Egrang.
- **Win.** The first to make the other fall [N] times, or [the first fall decides the round; best of 3: curator]. Possibly also
  stepping out of the ring [only if the curator confirms a boundary].
- **Computer.** Mudah, Sedang, Sulit: the typical-player model with noise per level, calibrated to 75 / 50 / 30 %.
- **Simplified.** Real wrestling-style holds become two buttons and a balance meter. Biji pinang is left out until its role is known.
- **All ages.** Possible with cartoon tumbles and neutral wording ("jatuh", "terduduk", never hitting). This is not the blocker; the
  missing rules are.

### Step 0.4: STOP

Decision: STOP. The "cara bermain" is too thin to derive real rules. The game must be faithful to the record and be described in
the game as "Aturan dasar" from the record. Here every rule would be invented.

## 9. Out-of-scope observations

1. **Personal data in a public record (urgent).**
   - SEPANGKAL's "dokumen kurikulum" is a PDF with names and national ID (KTP) numbers of real people.
   - It is in the public S3 bucket and linked from the public page `/prot/<id>` (`app/prot/[id]/page.tsx` renders every
     `dokumenKurikulum` URL).
   - It should be removed from the record and from S3 as soon as possible.
   - The media remove routes accept only status DRAFT or REVISI (`PROTService.assertCanEditMedia()`, Phase 06). For a published
     record this may need an admin action outside the normal UI (to be confirmed in Part C).
2. **Wrong media.**
   - The "Biji Pinang" photo (a trophy) and its purchase link (a cake) look like placeholders.
   - The "Lapangan" photos are from a coconut-shell game.
   - The activity photos show other games.
   - The record shows all of these on `/prot/<id>`, in its Jelajah stand panel in Aceh and in the intro bumper's photo strip.
3. **Repeated text.** `statusAsalUsul` and `nilaiMoral` contain the same cut-off paragraph as `caraBermain`.
4. **No verification step caught any of this.** `submitted_at` 10:33:33 and `verified_at` 10:34:17 on 2026-02-20 are 44 seconds
   apart. Part C's guide and checklist should address that.

## 10. Open questions

For the curator, to complete the SEPANGKAL record (needed before the game can be built):
1. **"Cara bermain" in full:** the rest of the cut-off sentence, then the steps of a match in order.
2. **Players:** how many take part at once (one against one? teams? a ring of players?), and `jumlahPemain`.
3. **Grip and moves:** how the players hold each other (hands, shoulders, waist, a cloth or belt?); what is allowed (pushing,
   pulling, tripping with the foot?) and what is forbidden.
4. **Fall:** what counts as a fall (any knee, a hand, the back or the whole body touching the ground?); does stepping out of the
   area count?
5. **Winning:** one fall decides, or best of several? Is there a time limit? What happens in a draw?
6. **Area:** size and shape of the "lapangan", any marked circle or line; soft ground (sand, grass)?
7. **Referee and start:** who starts the match, and how (a signal, a count)?
8. **Biji pinang:** what it is used for in the game (drawing who starts? a prize? a marker?), or remove it if it is not part of
   sepangkal.
9. **Who plays and when:** age group and occasions (festivals, harvest, evenings); for "Tentang permainan ini".
10. **Media:** correct photos of sepangkal being played (landscape, consent for children's faces); remove the trophy, the
    coconut-shell photos and the cake purchase link; **remove the PDF** (section 9.1).
11. **statusAsalUsul and nilaiMoral:** their own texts instead of the copied paragraph.

For the owner:
1. Should someone with admin access remove the PDF now, before the curator completes the record?
2. Should Part C (the PROT input guide) and the Phase 23 review addendum go ahead as a separate small phase while the record is
   being completed? Neither depends on the record.

## 11. Ready for next phase?

No. Phase 24 waits for a completed SEPANGKAL record (section 10). Part C and the Phase 23 addendum can start independently if the
owner agrees.
