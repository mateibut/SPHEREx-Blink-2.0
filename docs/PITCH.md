# Pitch: 3-minute script, slides, questions

> **Cum îl folosești (RO):** textul de mai jos e în engleză, pentru juriu. Scenariul are ~430 de cuvinte (≈ 3 minute vorbite
> calm). Tot ce e marcat **[sintetic]** se vede pe date inventate; tot ce e marcat **[real]** a fost măsurat pe date SPHEREx
> reale (vezi [VALIDATION.md](VALIDATION.md)). Spune mereu care e care: asta e „Validity" și e ce te deosebește. Ghidul de
> predare oficial apare pe 13 nov: verifică lungimea maximă a videoclipului înainte să filmezi (nu am putut verifica pagina 2026).

## 0. Before you start

- Open **https://mateibut.github.io/SPHEREx-Blink-2.0/** (synthetic demo, no install) and keep a second tab with the Planet X demo:
  `?ra=136.5&dec=16.6&fov=30&det=D5` (press *Look for a distant body*).
- For the real-data part use screenshots or a screen recording of your own machine (backend + `?data=api`): the
  real images are **not** in the repository on purpose.
- If the network fails: the demo still runs (only the sky map and the charts need a CDN); *Take the 1-minute tour* works offline;
  `docs/img/demo.gif` shows blink and difference.

## 1. The 3-minute script

| Time | Say | On screen |
|---|---|---|
| 0:00 | "Every six months SPHEREx maps the whole sky in infrared. Between two maps, anything that moves (a brown dwarf, an asteroid, maybe a distant planet) changes place. Finding that by eye in images this size is hopeless. We built the tool that makes it obvious." | Hero, then the workspace |
| 0:20 | "Blink: the same detector on different dates. Stars stay still. WISE 0855, the coldest known brown dwarf, jumps. Difference removes the stars: orange where it is now, blue where it was." **[sintetic]** | Click *WISE 0855*, play, switch to *Difference* |
| 0:50 | "One button, *Find movers*, finds the dots, links them across survey passes and lists what moved: speed, direction, significance, and whether it is already known. SPHEREx is a spectrometer, so for each candidate we measure it where it was on every date and plot its spectrum: a colour hint tells a brown dwarf from a star." | *Find movers*, click a candidate, *Spectrum along its path* |
| 1:20 | "A planet hundreds of AU away does not move in a straight line: as the Earth goes round the Sun it swings back and forth, in a loop. A straight-line search cannot see it. Our Planet X mode asks which dots follow that swing, and reads off the distance. Here, a **simulated** body at 600 AU: recovered at 601. No planet is claimed." **[sintetic]** | Planet X demo, *Look for a distant body*, show the drawn path |
| 1:55 | "Is it real? We ran Find movers blind on real SPHEREx pixels: Barnard's Star and Epsilon Indi B, no hint. Found every time, within 0.8 arcseconds per year of the catalogue. It also showed us two failures, both written down: in one detector Barnard's Star is saturated and came out 3.7 off until we fitted it from the unflagged pixels, and one run first gave three false candidates, which made us add a false-alarm estimate: the real lines expect one chance in ten thousand, the false ones expected seventeen. And a real asteroid, Arosa: one arcsecond from where the ephemeris says, and gone from that spot nineteen hours earlier, where it was 563 arcseconds away." **[real]** | Slide with the table of [VALIDATION.md](VALIDATION.md) §2 |
| 2:35 | "Everything is open, runs in a browser with no install, and every export says whether its data is real or synthetic. Over three hundred automated checks. The demo you saw is synthetic; the validation was real." | Export CSV, the data badge |
| 2:55 | "SPHEREx Blink: find what moves." | Title |

## 2. Slides (7)

1. **The problem**: SPHEREx maps the sky every ~6 months; things that move are the signal; by eye it does not scale.
2. **Blink and Difference**: the GIF (`docs/img/demo.gif`, labelled synthetic).
3. **Find movers + spectrum along the path**: one candidate list, known objects labelled, colour hint.
4. **Planet X mode**: a drawing of the Earth's orbit and the loop a distant body makes; "straight line vs loop".
5. **Validation on real data**: the table of §2 of [VALIDATION.md](VALIDATION.md), including the failure.
6. **What we do not claim**: the blind Planet X search has found a real body only once (Makemake, in a fair test, with loosened options, as one of 38 candidates when an empty field gives about 33; with the app's default options it found nothing); WISE 0855 is a suggestive stack, not a detection; the colour hint gave "neutral" for a real brown dwarf and cannot separate an M dwarf from an early T dwarf; one test run was tuned after it failed, and the Barnard D2 fix was made after seeing the error.
7. **Credits and honesty**: sources ([CREDITS.md](../CREDITS.md)), built with Claude Code, repository started 2026-11-05, links.

## 3. The five judging criteria

| Criterion | Evidence to point at |
|---|---|
| **Impact** | Turns "stare at 2,000-pixel images" into one button and a ranked list; runs in any browser; exports for follow-up (CSV/JSON, each row says what the data is and links back). |
| **Creativity** | Planet X mode: distance from the Earth-parallax swing, searched as triples of dots from three passes; spectrum measured along the moving object's path. |
| **Validity** | Blind test on real data (6 of 6 runs recovered, 4 single-detector and 2 with both detectors, 0 false with the final rule after one run showed 3; chance count 1e-4 or less for the real lines against ~17 for the false ones); Jansky scale checked against 2MASS/AllWISE stars (3-10 %); a real asteroid found where predicted and shown to move; a negative result on the blind Planet X search kept in the open; 397 automated checks; every claim labelled real or synthetic. |
| **Relevance** | The challenge is "Planet X and SPHEREx": moving objects in SPHEREx images, and what separates a nearby mover from a distant planet. |
| **Presentation** | A 1-minute guided tour that works offline, a labelled GIF, this script, a README that starts with what is real and what is not. |

## 4. Numbers you can say (and where they come from)

| Number | Source |
|---|---|
| Fast movers recovered blind in 6 of 6 real runs (4 single-detector, 2 with both detectors); 0 false candidates with the final rule (the first run on Epsilon Indi B D6 had 3, which changed the rule) | [VALIDATION.md](VALIDATION.md) §2 (`scratch/validate_real.mjs`) |
| Motion within 0.20-0.80 ″/yr of the catalogue; both detectors together: Barnard 0.20 (21 of 21 images), Epsilon Indi B 0.53 (17 of 17) | same |
| Chance lines expected: at most 1e-4 for the six real candidates, about 17 for each of the three false ones of the original rule | same (`--relaxed 1`) |
| Jansky scale: measured / catalogue flux of isolated stars 0.97 (D2) and 0.90 (D6) in the Barnard field | [VALIDATION.md](VALIDATION.md) §3 (`scratch/validate_photometry.py`) |
| Real asteroid Arosa (V 14.6) seen at 107 σ, 1.0″ from its predicted position; 8.67 mJy where SkyBoT puts it at 00:10 UTC and 0.02 ± 0.84 mJy at the later position, then 8.56 mJy there at 19:42 UTC: it moved 563″ in 19.5 hours; no 2MASS star there | [VALIDATION.md](VALIDATION.md) §6 |
| WISE 0855 stacked along its path in D6: 0.415 ± 0.076 mJy, 4.3 × the control scatter (suggestive, not a detection); the 1-2 µm excess is a neighbouring J = 15.4 star | [VALIDATION.md](VALIDATION.md) §7 (`scratch/stack_wise0855.py`) |
| Makemake: Earth-parallax fit 52.65 AU against 52.62 AU from JPL Horizons (told where to look); the blind search did NOT find it in the first, biased test | [VALIDATION.md](VALIDATION.md) §5 (`scratch/real_parallax.mjs`) |
| Fair blind test on 11 off-centre 30′ cutouts of Makemake: default options 0 candidates; loosened options 38, one of them Makemake (53.3 AU, truth 52-53); an empty field gives 27-41 chance candidates | [VALIDATION.md](VALIDATION.md) §12 (`scratch/blind_planet_x.mjs`) |
| One image reaches V about 17 (clean field); a Planet-Nine-like body is 3-5 magnitudes fainter | [VALIDATION.md](VALIDATION.md) §10-§11 |
| Colour ratio of Epsilon Indi B (real brown-dwarf pair): 0.65, "neutral" | [VALIDATION.md](VALIDATION.md) §3 |
| Barnard D2: 3.72 ″/yr off before, 0.31 after fitting from the unflagged pixels (a fix made after seeing the error) | [VALIDATION.md](VALIDATION.md) §2, "Barnard in D2" |
| Simulated body at 600 AU recovered at 600-601 AU | [VALIDATION.md](VALIDATION.md) §5 (`scratch/test_parallax.mjs`) |
| 112 backend tests + 359 browser-side checks (7 Nov 2026) | `pytest backend`, `node scratch/test_*.mjs` |
| A public page with only derived numbers and charts of the real-data runs (no pixel), failures next to successes | `frontend/results.html`; [VALIDATION.md](VALIDATION.md) §9 |
| The sky map shows, in brackets, the country a sky point is straight above right now (46 of 46 interior test points right; borders are 110 m scale, so tens of km off near a border) | [VALIDATION.md](VALIDATION.md) §9 (`scratch/test_skygeo.mjs`) |
| SkyBoT answers 15 image dates in 9 s | [VALIDATION.md](VALIDATION.md) §6 |

## 5. Do **not** say

- "We found a planet" / "a new object". Candidates are not discoveries (the exports say so).
- "Planet X mode works on real data". The distance fit recovered Makemake (52.65 against 52.62 AU) only when told where to look; the blind search did not find it in the same real dots, and in the later fair test only loosened options found it, as one of 38 candidates. The simulated body at 600 AU is the only clean blind recovery.
- "We detected WISE 0855". A stack along its path gives 0.4 mJy at 4.5-5 µm, 4.3 times the control scatter, from 4 usable images: suggestive.
- "Calibrated SPHEREx spectra". The fluxes are quick aperture sums in Jansky, uncalibrated by us.
- "It works for any field". It was tested on a handful of real fields (two fast movers, one asteroid, one dwarf planet, one brown dwarf).
- "The colour classification is validated". On the one real object where both bands exist (a brown-dwarf pair) it said "neutral", and it cannot separate an M dwarf from an early T dwarf.
- "No false candidates, ever". One run had three before we tightened a rule; that run is no longer an independent test.
- "Calibrated to better than 3 %". The Jansky scale agrees with catalogue stars to 2-10 % with aperture sums and zero points written from memory.

## 6. Questions you may get

**Is this really finding Planet X?** No. It is a tool that could: it separates a nearby straight-line mover from a body whose path is dominated by Earth's parallax, and gives a distance. The body in the demo is simulated; no real candidate exists.

**Why not machine learning?** The signal is geometry (a dot in different places on different dates), which is explainable and needs no training set. A judge can read why a candidate was listed.

**How do you know the real-data result is not just tuned?** The thresholds were first fixed on synthetic data and on Barnard's Star; Epsilon Indi B was downloaded after that and was found in both detectors. But its D6 run first produced three false candidates, and we then tightened a rule (60 % of the images instead of half). That run is no longer an independent test, and it is still only two objects.

**What does "saturated" mean here?** Barnard's Star is so bright that the FLAGS bits for overflow and transient are set in much of its core. Its position in one detector was 3.7 ″/yr off; fitting it from the pixels that are not flagged brought that to 0.3 ″/yr. We designed that fix after seeing the error, and say so.

**Do you detect real asteroids?** The overlay and the matching work (SkyBoT, per image date; for the one body in our Barnard field our projection puts it 231.6″ from the centre and the service says 231.571″), and in one real image it found the asteroid Arosa (V 14.6) at 107 σ, 1.0″ from where SkyBoT predicts it, with no 2MASS star there. That is one image: the proof it moves would be a second image where the spot is empty.

**How precise is the distance?** On synthetic data, within about 1 % statistically. On real data we cannot say; systematics (ephemeris, a straight own motion) are not in the quoted range.

**Does it scale to the whole sky?** No. It works on field cutouts up to 30′. A survey pipeline would link across many fields.

**Why three survey passes?** Two dots always make a line; a third pass proves it. For the parallax search, three passes also give the one constraint that makes the distance testable.

**What about the data licence?** Not checked yet. That is why real images and FITS files are not in the repository.

**What did the AI do?** The project was built with Claude Code (Anthropic) and says so in the README and [CREDITS.md](../CREDITS.md). *Add, in your own words, what you decided and what you ran and checked yourself.*

**What is next?** The second image of the same asteroid (about 5 MB), to show its spot empty on the other date; using the pixel flags as a mask for saturated stars; a colour test on more real objects, including a cooler one; a new field to test the tightened rule independently; linking across several fields for Planet X.

## 7. If something breaks live

| Problem | Do this |
|---|---|
| No network | Use the demo as is; skip the sky map and charts (CDN). Run the tour. Show the GIF. |
| The backend is not running | Say the real-data part is shown from a recording; show the table in VALIDATION.md. |
| *Look for a distant body* finds nothing | The field must be the Planet X demo field, 30′, detector D5 (use the *Planet X (simulated)* button). |
| A question you cannot answer | "We did not test that; here is what we did test." Then the table. |

## 8. Filming plan (screen recording, about 2:30 of picture for the 3-minute script)

**Before you press record**
- Window 1280 × 720 or 1920 × 1080, browser zoom 100 %, bookmarks bar hidden, other tabs closed, notifications off (no private names or faces on screen: the rules say no people under 18).
- Two browser tabs ready: **A** the public synthetic demo, **B** the local app on real data (backend running, restarted after code changes).
  - A: `https://mateibut.github.io/SPHEREx-Blink-2.0/`, and the Planet X field `?ra=136.5&dec=16.6&fov=30&det=D5`.
  - B: `?data=api&api=http://localhost:8001&ra=331.0965&dec=-56.8006&fov=5&det=D6` (Epsilon Indi B) and `...&ra=296.40882&dec=-24.04831&fov=5&det=D2` (the asteroid Arosa).
- Recording tool: your own screen recorder (the app's **Record video** button only records the blink image). Check the audio and that the cursor is visible.
- Run the whole sequence once without recording; the SkyBoT and SIMBAD calls need the network.
- Keep the data badge in view in every shot, and add a caption "SYNTHETIC DATA" on the shots from tab A.

**Shot list**

| Time | Tab | Do | Caption |
|---|---|---|---|
| 0:00 | A | The banner, then *Start exploring* (3 s) | "SPHEREx Blink" |
| 0:03 | A | Chip *WISE 0855*, Blink playing (8 s) | "Stars stay. The brown dwarf jumps. (synthetic data)" |
| 0:25 | A | *Difference* (6 s) | "Orange: now. Blue: before." |
| 0:35 | A | *Find movers*, click the candidate, point at "chance: ..." and "on its path in 5/5" (15 s) | "One button. A number that says how likely chance is." |
| 0:55 | A | *Spectrum along its path* (8 s) | "Its colour, measured where it was on each date" |
| 1:10 | A | Chip *Planet X (simulated)*, *Look for a distant body*, the drawn loop and the 601 AU line (15 s) | "SIMULATED body at 600 AU: recovered at 601. No planet is claimed." |
| 1:30 | B | Epsilon Indi B: *Find movers*, "seen in 17 of 17 images", "chance: far below 1 in a million" (12 s) | "REAL SPHEREx data, found blind" |
| 1:45 | B | Arosa: tick *Known asteroids*; the amber diamond on the dot (10 s) | "A real asteroid, 1.0 arcsec from where the ephemeris says. One image." |
| 1:58 | A or B | *Save list (CSV)*, then the `data` column of the file (5 s) | "Every export says what its data is" |
| 2:05 | A or B | Section 4, *Show sky map*, move the cursor: the box in the corner gives the sky coordinates and, in brackets, the country that spot is straight above right now (6 s) | "Sky coordinates, and the country they are above right now (not where SPHEREx is)" |
| 2:11 | - | The results page (`results.html`), scrolling past the charts to "The blind search failed" (8 s), then a still card: what is real, what is synthetic, what is not claimed (10 s) | "Numbers only, no images. The failures are on the page." and the "do not claim" list |

**Subtitles:** English. The 2025 rules asked for them; whether 2026 does is not confirmed (check the guide on 13 Nov), and the video length limit too.
**After filming:** play it once with the sound off (the captions must carry the meaning), check that no tab, path or username shows, and that every real-data shot says "real" and every demo shot says "synthetic".
