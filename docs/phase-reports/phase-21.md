# Phase 21: Sound for the concept film and the intro bumper (music + sound effects)

## 1. Summary

The concept film (Phase 19) and the intro bumper (Phase 16) now have sound: a gamelan-inspired score and sound effects
synced to the picture. Everything is synthesized in code with the Web Audio API: no audio files, no downloaded samples,
no new dependency. A reusable engine lives in `lib/audio/`. It has the instruments (saron and bonang with ombak beating,
gong ageng, kendang, kecapi, pad, drone, and noise/FM effects), a pelog-inspired pitch set kept in one file, buses with a
gentle limiter and a shared reverb, a 24-voice pool, and a scheduler that follows the film's own clock. Every cue time
comes from `CONCEPT_SCENES`/`BEATS`. The player has a sound toggle ("Suara"), shows "Nyalakan suara" when the browser
blocks autoplay, suspends audio on a hidden tab, plays music and key hits in reduced motion, fades out on exit, and has a
voice-over hook. The bumper gets a short sting with the same engine and the same sound setting. All 778 frontend tests
pass, the build succeeds, and lint is unchanged.

**I cannot listen to audio.** Every statement about how it sounds rests on measurements: loudness, peaks, energy above
8 kHz, level per second and voice counts. The WAV files below are the material to review by ear. The phase is complete
except for two items: the mp4 files (no ffmpeg under `D:/tools/ffmpeg`; the command is given in section 5) and one
fps figure slightly over target (section 8).

## 2. Git

**nusantara-play-fe**: branch `phase-21-concept-audio`, base `c10778d` (main = origin/main, Phase 20 merged; the local
main was fast-forwarded from `ea7b4de` first). Commits:

| Hash | Message |
|---|---|
| `b2ff984` | feat(audio): Web Audio sound engine (Phase 21 step 1) |
| `ad432b5` | feat(jelajah): concept soundtrack cue sheet and clock-driven scheduler (Phase 21 step 2) |
| `cb60ae1` | feat(jelajah): concept film sound in the player (Phase 21 step 3) |
| `2aef438` | feat(jelajah): intro bumper sound sting with the shared sound setting (Phase 21 step 4) |
| `f3b37e9` | fix(audio): mix level from the offline render, music through the scene 5 dive, bumper notes, debug output-timestamp clock |
| `3697167` | perf(audio): one shared lazily loaded runtime chunk for the film and the bumper |
| `c1386a7` | fix(audio): schedule on the heard timeline (getOutputTimestamp) … |
| `627dd67` | fix(audio): refine the clock anchor continuously … |
| `6392f06` | docs(claude): Sound (Phase 21) section, shared sections |
| `865807f` | docs(claude): Phase 21 lint baseline counts 38 touched files |

`git diff --stat main...HEAD`: 39 files changed, 4611 insertions(+), 70 deletions(-) (before the last one-line docs fix).

**nusantara-play-be**: branch `phase-21-concept-audio`, base `f77b679` (main = origin/main, Phase 20 merged). Commits:
`d6be717` docs(claude): Phase 21 shared sections · `758cb9d` docs(claude): lint baseline count · this report (hash in
the final message). `git diff --stat`: CLAUDE.md only, plus this report.

Nothing was pushed.

## 3. Changes

Frontend, new:
- `lib/audio/core.ts`: self-contained synthesis core (seeded RNG, damped resonators, biquads, Karplus–Strong, every instrument and effect, impulse response); stringified into the Worker.
- `lib/audio/render-worker-source.ts`: Blob Web Worker source that renders sounds off the main thread.
- `lib/audio/buffers.ts`: renders each sound once, in first-use order (Worker; main-thread fallback; synchronous for offline).
- `lib/audio/engine.ts`: buses, lowpass, duck, bend, shared convolver reverb, compressor and trim, the 24-voice pool with stealing, group fades.
- `lib/audio/scheduler.ts`: cue sheet on the player's clock with lookahead, heard-time anchoring, seek, resync, automation and `scheduleAll`.
- `lib/audio/session.ts`: autoplay, blocked, mute, hidden tab, close and hand-off, UI tick.
- `lib/audio/context.ts`: the one shared AudioContext, start/unlock/suspend, output timing, iOS `audioSession`.
- `lib/audio/mute.ts`: `np_sound_muted_v1` with try/catch and a memory fallback.
- `lib/audio/pitch.ts`: the pelog-inspired pitch set with a documented frequency table.
- `lib/audio/rng.ts`: seeded RNG for the cue sheets.
- `lib/audio/support.ts`: Web Audio detection.
- `lib/audio/runtime.ts`: the single dynamically imported runtime that both players share.
- `lib/audio/voice-over.ts`: explicit-list voice-over loader and duck ramps.
- `lib/audio/offline.ts`: OfflineAudioContext render to a 16-bit WAV (debug only).
- `lib/jelajah/concept/sound-cues.ts`: the film's cue sheet, the reduced-motion sheet, automation, render order, voice-over plan.
- `lib/jelajah/bumper/sound-cues.ts`: the bumper sting and scene notes.
- `components/audio/SoundControls.tsx`: the "Suara" toggle and the "Nyalakan suara" button.
- `components/jelajah/concept/use-concept-sound.ts`: the film's sound hook plus the debug hook `__nlConceptAudio`.
- `components/jelajah/bumper/BumperSound.tsx`: the bumper's sound, lazy via `next/dynamic`, plus the debug hook `__nlBumperAudio`.
- Tests: `tests/audio/{fake-audio.ts, sound-core, engine, scheduler, session, sound-controls}.test.*`, `tests/jelajah/{concept-sound-cues, bumper-sound}.test.ts`.

Frontend, modified:
- `components/jelajah/concept/ConceptVideo.tsx`: sound hook; controls next to Lewati; exit fades; test-hook pause/resume suspends audio; UI tick on "Mulai Menjelajah"; header comment.
- `components/jelajah/bumper/JelajahBumper.tsx`: `next/dynamic` BumperSound; end callback for the fade; Enter on the sound buttons no longer advances the scene.
- `lib/jelajah/concept/script.ts`: `BEATS` gains seed roll, ring pulse, stamp drop, arc travel and count; `CONCEPT_VOICEOVER` and `VOICEOVER_DUCK_DB` replace the Phase 19 `CONCEPT_MUSIC` TODO.
- `components/jelajah/concept/art/Courtyard.tsx`, `art/Village.tsx`, `scenes/ArsipScene.tsx`, `scenes/MainScene.tsx`, `scenes/BersamaScene.tsx`: read those timings from `BEATS`, so picture and sound use the same numbers.
- `lib/jelajah/concept/congklak-demo.ts`: records each frame's engine event (`kinds`).
- `tests/jelajah/concept-script.test.ts`, `tests/jelajah/concept-player.test.tsx`: voice-over hook; no controls without Web Audio.
- `CLAUDE.md`: new "Sound (Phase 21)" section; concept-video lines updated; shared sections.

Backend: `CLAUDE.md` (shared sections, identical to the frontend), `docs/phase-reports/phase-21.md`.

## 4. Decisions

- **Instruments rendered in plain JS, not with OfflineAudioContext.** The prompt suggested OfflineAudioContext for the buffers. Plain JS is deterministic across browsers and runs in Node tests, which have no Web Audio. Rendering happens in a Web Worker, so the film's frames are never blocked; this follows the congklak-AI Blob-worker pattern, because Turbopack does not bundle `new Worker(new URL(...))`. The full-soundtrack WAV render does use OfflineAudioContext, with the same engine and scheduler.
- **One shared ConvolverNode reverb** with a seeded impulse response, instead of reverb baked into each buffer. Baking it per buffer cost about 10× the render time.
- **Dark sounds render at 12 kHz** (pad, drone, gong, wind, gust, swell, gasing) and the rest at 24 kHz. A browser that rejects 12 kHz buffers (old Safari) gets 24 kHz throughout.
- **Lucide speaker icons** instead of the 🔊/🔇 emoji, for consistent rendering. The label "Nyalakan suara" is spelled out.
- **Scheduler anchoring**: the scheduler anchors on the audio that will be heard when the current frame reaches the screen (`getOutputTimestamp`), with a smoothed correction. The first version (currentTime minus a latency guess) measured a 15–30 ms bias.
- **Timing constants moved into `BEATS`**: the stamp drop, seed period and phase, ring pulse period and stagger, and arc travel used to be literals inside the scene components. The passport stamp's drop went from 160 to 150 ms, so the slam lands exactly on the visual shake, which already started at +150 ms.
- **Village pad starts with the dive**: in scene 5 the village pad starts at the dive rather than at the village fade. The first render showed a near-silence at 27 s.
- **The bumper's sting runs on the bumper's own elapsed time**, paused while hidden. Each scene change plays its note at once, so taps and auto-advance both work.
- **Sound before render completes**: a sound that is not rendered yet when its cue is due is skipped if short, or started part-way with a fade if it is a long bed.
- **Shared runtime chunk**: both players load the engine through one `import('@/lib/audio/runtime')`. The first build had bundled a copy into each player's chunk, so a first visit downloaded it twice.

## 5. Deviations

- **No mp4 files.** `D:/tools` does not exist, so there is no ffmpeg under `D:/tools/ffmpeg`. An `ffmpeg.exe` exists at `D:/program/Server/ffmpeg.exe`; it is outside the agreed location and of unknown origin, so it was not used. The recordings are `.webm`; mux them with the measured offsets:
  ```
  ffmpeg -i D:/dev-cache/screens/phase-21/concept-1080p.webm -itsoffset 4.29 -i D:/dev-cache/screens/phase-21/concept-soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k D:/dev-cache/screens/phase-21/concept-1080p.mp4
  ffmpeg -i D:/dev-cache/screens/phase-21/concept-portrait.webm -itsoffset 4.27 -i D:/dev-cache/screens/phase-21/concept-soundtrack.wav -map 0:v -map 1:a -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k D:/dev-cache/screens/phase-21/concept-portrait.mp4
  ```
  The offset is the moment the recorded film was reset to t=0 and resumed, measured from the video's start (±50 ms).
- **Playwright's own video encoder had to be downloaded.** Playwright's recorder needs its bundled ffmpeg component, which was missing from its default cache on C:. It was downloaded with `PLAYWRIGHT_BROWSERS_PATH=D:/dev-cache/ms-playwright` (on D:, about 1 MB). Nothing was written to C:.
- **Buffer rendering exceeds 300 ms**, so it is progressive, as the prompt allows. All 74 sounds take 0.6–0.73 s in the Worker. The gong is ready in about 0.1–0.18 s, and gong + scene 1 in about 0.18–0.24 s. Chrome's CPU throttling applies to the page's main thread, not to Web Workers, so the "4×" render numbers are effectively unthrottled. On a 4× slower phone, expect about 0.8–1 s for scene 1 and about 2.5 s for everything.
- **Phone fps, scene 2 ("terlupa")**: sound costs 2.4–4.8 fps in that scene, slightly over the ~3 fps target in one of two runs. The film-wide average cost is within target (section 8).

## 6. Verification

Free space: C: 13 GB, D: 336 GB at the start and at the end (C: unchanged).

| Command | Result |
|---|---|
| `pnpm test` (frontend) | exit 0, **62 files, 778 passed**, 0 failed, 0 skipped (baseline: 55 files, 705) |
| `npx tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 1 as before: 124 problems (44 errors, 80 warnings), unchanged; `eslint` on all 38 new and touched TS/TSX files: exit 0, no problems |
| `pnpm check:jelajah` | exit 0: `sumatera-selatan: 2 asset files, 195.6 KB (limit 8 MB)`, `check:jelajah OK` |
| `pnpm build` (placeholder Supabase values: `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329`, a placeholder key) | exit 0 (`D:/dev-cache/tmp/phase-21/build-final.log`); `main` built the same way for comparison |
| backend `npm test -- --cacheDirectory D:/dev-cache/jest` | exit 0, 46 suites, **587 passed** |

**Bundle sizes** (gzip level 9):

| | Size |
|---|---|
| `/jelajah` initial JS, from the prerendered HTML's scripts | `main` 314.2 KB → branch 314.5 KB (+0.3 KB: the `next/dynamic` stub and one selector); 15 files on both |
| Audio code on a first visit (bumper, then film), measured in the browser | shared runtime 9.3 KB + bumper cues 2.6 KB + film chunk growth 4.6 KB (32.4 vs 27.8 KB) = **16.5 KB gz**, budget 25 KB |
| Offline WAV renderer | 0.9 KB, loaded only by the debug hooks |
| With both intros seen | 0 audio chunks requested (browser check A) |

**Browser checks**: production build, Phase 19 login harness (fake Supabase on localhost; the Authorization header is
stripped from `/backend-api` calls, so production only saw public read-only GETs). Log: `D:/dev-cache/tmp/phase-21/checks.txt`.

```
A intros seen: 15 JS files; audio chunks requested: 0; bumper/concept dialogs: 0
B bumper: sound on; toggle {"pressed":"true","label":"Suara","w":44,"h":44}
B Enter on the toggle: scene brand → brand; muted stored = 1
B film after the bumper: sound on; audio chunks loaded: 519fc7e0…js 2.6 KB gz, d589bc47…js 9.3 KB gz, 839a03ba…js 32.4 KB gz
C muted choice: status muted; AudioContexts created 0; toggle aria-pressed=false
C tap the toggle: status on; stored 0; voices so far 6
C hidden tab: context suspended, film t 3410 → 3410 after 1 s hidden; visible again: context running
D reduced motion: status on; after Lanjut: music bed@5000, low drone@5000, wind gust@5400
E no Web Audio: film t 2508 ms; sound controls 0; page errors 0
F storage throwing: status on → after toggle muted; page errors 0
sync script: context after Lewati: 150 ms running, 850 ms suspended (300 ms fade, then suspend)
blocked autoplay (emulated, see below): starting → blocked; "Nyalakan suara" shown; tap → on; scheduling resumes in sync
```

The blocked-autoplay case had to be emulated in an init script. Headless Chrome lets Web Audio start without a gesture,
and Playwright's `evaluate` grants user activation itself. In the emulation, a context created without a real (trusted)
pointer or key event starts suspended, and `resume()` only works during one. The only console error on every page is
`401 /backend-api/users/me`, a harness artifact (the stripped auth header) unrelated to this phase.

## 7. Manual checks

1. Open the site, log in, then click the navbar's "Jelajah" link (an in-app click, so the browser allows sound). If the bumper is due, it plays with a soft swell and a gong as the logo appears, and a soft note on each new scene. The film then starts with dusk sounds. The speaker button "Suara" sits left of "Lewati".
2. Type `/jelajah?concept=1` into the address bar and press Enter (a direct load). The film plays without sound, and "Nyalakan suara" appears next to "Lewati". Tap it: the sound starts at the current point, in sync.
3. Tap the speaker button: the sound fades out and the icon shows a crossed speaker. Reload: the film starts silent with the crossed icon (the choice is remembered, also for the bumper). Tap again to turn sound back on.
4. Switch to another tab for a few seconds and back: both the picture and the sound pause and continue together.
5. Press Esc or "Lewati": the sound fades out within about 0.3 s. Let the film end, or press "Mulai Menjelajah" (you hear a small tick): the sound fades out over about 0.6 s and the map has no sound.
6. With the system's "reduce motion" setting on: the stills show with a soft music bed and one or two key sounds each. "Lanjut" plays the next still's sounds at once.
7. On an iPhone with the silent switch on: with sound on, the film should still be audible (`audioSession` 'playback'). Not tested on a device.
8. With `?debug=1`, the console offers `__nlConceptAudio.stats()` (status, render time, voices) and `__nlConceptAudio.log()` (every scheduled cue).

### Listening checklist for the boss

File `D:/dev-cache/screens/phase-21/concept-soundtrack.wav` (55 s; film time 0 = 0:00). Times are when you should hear each sound.

| Time | Scene | What you should hear |
|---|---|---|
| 0:00–0:06 | 1 halaman (dusk courtyard) | Soft wind and a warm low chord fading in. Crickets here and there, left and right; a distant bird at 0:01.7 (left) and 0:04.2 (right). A slow saron melody from 0:00.8, one note every 0.7 s (pelog 3 5 6 5 3 2 1), with a gentle shimmer from the two slightly detuned voices. Small wooden clicks, about 3 per second, each time a rolling seed drops into a hole (0:00.6–0:05.2). A quiet humming whirr (the spinning top) throughout. |
| 0:06–0:11 | 2 terlupa (fading) | The music turns muffled (a lowpass sweeping down) and sags slightly in pitch, "tape slowing". A low drone underneath, the saron slower and quieter. The seed clicks fade out. A wind gust at 0:06.9 and a fine dust crackle drifting from left to right as the toys dissolve (0:07.2–0:10.6). The top's whirr slows down and dies out around 0:08.7. |
| 0:11–0:18 | 3 nusantara (Indonesia lights up) | A rising swell as the music opens up again. From 0:13.2, 12 bonang notes climb step by step and move from left to right with the light sweeping west to east (to 0:16.6). **At 0:15.2 the GONG**, the hero hit, as the wordmark lands, with a soft high shimmer and a warm chord ringing on. |
| 0:18–0:25 | 4 arsip (archive) | Kendang drum pattern at a moderate tempo (low "dang", high "tak"), a saron line on the beat. A paper swish per flying card (alternately left and right, 0:18.2–0:19.5), each followed by a soft tap as it lands. **The "Diperiksa kurator" stamp thump at 0:22.85.** |
| 0:25–0:32 | 5 jelajah (dive into Sumatera Selatan) | A descending whoosh from 0:25.3 to 0:28 as the camera dives; the music continues underneath. Then village ambience: light wind and birds (0:27.7–0:31). Soft bell chimes on the glows' pulses. |
| 0:32–0:39 | 6 main (congklak) | Wooden clicks for every seed sown in the three demo moves (0:32.4–0:33.8, 0:34.0–0:35.4, 0:35.6–0:37.0), each slightly different in pitch and following the hand across the board. A bright little arpeggio for each "+10 XP" at 0:33.8, 0:35.4 and 0:37.0. **The Paspor Budaya stamp slam at 0:37.55**, as the passport shakes. |
| 0:39–0:44 | 7 bersama (community) | A full warm pad, the saron climbing. Kecapi (plucked string) notes as each arc connects (0:41.6–0:43.6). Bonang chords; the ensemble swells; a short kendang roll leads into the last scene. |
| 0:44–0:48 (+3 s hold) | 8 mulai | **Final gong at 0:44.0** with a resolving chord and a saron chord, a shimmer as the logo appears, and a soft chime as the button appears (0:44.7). The music rings out until about 0:51. |

Also review `concept-soundtrack-reduced.wav` (reduced motion: one still every 5 s, music bed and key hits) and
`bumper-sting.wav` (the bumper untouched: swell, gong at 0:00.65, chord and tail; soft notes at 0:03, 0:06, 0:09 and
0:12, a chime at 0:15).

## 8. Findings

**Loudness and peaks** of the offline renders (OfflineAudioContext, same engine; analysis in `D:/dev-cache/tmp/phase-21/wav-analysis.txt`):

| File | Integrated (BS.1770, gated) | Short-term max | Sample peak | ~True peak | Clipped | Energy > 8 kHz |
|---|---|---|---|---|---|---|
| concept-soundtrack.wav | **−15.6 LUFS** (target −16 ±2) | −12.8 LUFS | −3.47 dBFS | −3.43 dBTP | 0 | −36.2 dB |
| concept-soundtrack-reduced.wav | −17.4 LUFS | −14.0 LUFS | −3.56 dBFS | −3.56 dBTP | 0 | −42.2 dB |
| bumper-sting.wav | −19.1 LUFS (quiet scene notes over 24 s; the sting itself −13 to −16 momentary) | −14.1 LUFS | −4.59 dBFS | −4.59 dBTP | 0 | −48.9 dB |

The film uses 210 cues and 74 distinct sounds, with at most 22 voices at once (cap 24). The first render measured −14.7
LUFS, so the master was lowered by 1.2 dB.

**Sync**: for each cue, when it is heard (from `getOutputTimestamp`) versus the moment its beat is on screen
(interpolated from the film clock, plus one frame to reach the display). Whole film, desktop 1440×900, full tier, two
runs each. Log: `D:/dev-cache/tmp/phase-21/sync.txt`.

| CPU | Cues | Mean | Median \|offset\| | p95 | Key hits (gong, curator stamp, dive, passport stamp, final gong) |
|---|---|---|---|---|---|
| 1× | 194 / 194 | −11 / −13 ms | 10.3 / 10.8 ms | 27.0 / 27.5 ms | −5…+3, −13, −9…−5, −11…−10, −28…−27 ms |
| 4× | 196 / 201 | −8.0 / −8.5 ms | 8.9 / 8.4 ms | 25.2 / 25.0 ms | −0…+2, −9…−6, −10…−3, −11…−9, −25…−20 ms |

The target (≤ 30 ms) is met for 95 % of cues. Cues right after a stalled frame (> 50 ms, 6–13 per run) and the largest
outliers (up to −90 to −490 ms, mostly at scene changes 31.8 s and 44 s) are frames shown late: the sound stays on time
and the picture arrives late, the Phase 19 first-paint stalls. Before the output-timestamp anchoring, the mean bias was
+14 to +22 ms.

**CPU**: whole film with 4× CPU throttling, same build, sound on versus muted. Log: `D:/dev-cache/tmp/phase-21/fps.txt`.

| | Sound on | Muted | Cost |
|---|---|---|---|
| Desktop 1440×900 full, average | 44.7 / 45.1 fps | 46.5 / 46.5 | 1.4–1.8 fps |
| Desktop, worst scene (terlupa) | 28.8 / 33.2 | 34.3 / 34.8 | 1.6–5.5 fps |
| Phone 390×844 dpr 3 full, average | 50.4 / 49.5 | 51.1 / 51.5 | 0.7–2.0 fps |
| Phone, worst scene (terlupa) | 37.8 / 37.5 | 40.2 / 42.3 | 2.4–4.8 fps |

Phase 19 measured 40.6 fps (desktop full, 4×) on that day. Today's runs are faster overall, so the fair comparison is
on/off on the same build. Scene 2 is the heaviest for both picture and sound: dust, drone, gust and the lowpass sweep.

**Render time** (`D:/dev-cache/tmp/phase-21/render-time.txt`): gong ready about 80–180 ms after the hook; gong + scene 1
(20 sounds) about 180–240 ms; all 74 sounds 595–730 ms wall time (Worker CPU about 550–620 ms). The main thread only
wraps the finished arrays into AudioBuffers.

**Review files** (`D:/dev-cache/screens/phase-21/`): `concept-soundtrack.wav`, `concept-soundtrack-reduced.wav`,
`bumper-sting.wav`, `concept-1080p.webm` (film time 0 at 4.29 s), `concept-portrait.webm` (4.27 s). No mp4 (section 5).

## 9. Out-of-scope observations

- `GET /backend-api/users/me` answers 401 in the local harness, because it strips the auth header. This is expected locally; noted so it is not mistaken for a Phase 21 error.
- The film's first-paint stalls at scene changes (Phase 19) are what produce the largest audio/visual offsets. Fixing the stalls would also tighten the sync.
- `D:/program/Server/ffmpeg.exe` exists outside `D:/tools`. If it is a trusted install, moving or copying it to `D:/tools/ffmpeg` would let the next phase produce the mp4s.

## 10. Open questions

1. **Does it sound right?** Please listen to the three WAV files with the checklist in section 7. Possible things to tune by ear: overall character, gong weight, kendang tempo, whether the stamp hits feel strong enough.
2. Should the sound be **on by default** when autoplay is allowed (as now), or should the first visit always start muted with the toggle visible?
3. **Voice-over**: do you want spoken narration later? The hook is ready: list a file per scene in `CONCEPT_VOICEOVER`.
4. Is a **real-device check** possible (an iPhone with the silent switch on, and a mid-range Android) to confirm the `audioSession` behaviour and the render time on a slow CPU?
5. Should ffmpeg be installed at `D:/tools/ffmpeg`, so future phases can produce the mp4 files directly?

## 11. Ready for next phase?

Yes. Nothing blocks. The mp4 muxing is one command once ffmpeg is available, and the listening review is the owner's.
