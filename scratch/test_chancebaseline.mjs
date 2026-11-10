// Tests for the chance baselines (features/chanceBaseline.js) and the explainer's question "How often does chance do this?" (assistant.js).   Run: node scratch/test_chancebaseline.mjs
import { readFileSync } from "node:fs";
import { MOVERS_NULLS, DISTANT_NULLS, baselineFor } from "../frontend/js/features/chanceBaseline.js";
import { evidenceFromCandidate, explain, validateSentences, CAUTIONS } from "../frontend/js/features/assistant.js";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  – " + detail : ""}`);
  if (!ok) failed++;
}
const VALIDATION = readFileSync(new URL("../docs/VALIDATION.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ---------------------------------------------------------------- the numbers are the ones in VALIDATION.md
{
  const sec20 = VALIDATION.slice(VALIDATION.indexOf("## 20."));
  const rows = MOVERS_NULLS.map((r) => {
    const line = sec20.split("\n").find((l) => l.startsWith(`| ${r.field} |`));
    const m = line && /\| (\*\*)?(\d+) %(\*\*)?(?: \((\d+)\/(\d+)\))? \|$/.exec(line.trim());
    return { r, line, ok: Boolean(line) && line.includes(`${r.images} (${r.passes})`) && (r.withCandidate === 0 ? / 0 % \(0\/300\) \|$/.test(line.trim()) : new RegExp(`${r.withCandidate}/${r.copies}\\)`).test(line)) };
  });
  check("movers: each field's images, passes and number of empty copies that listed a candidate are the ones of the table in VALIDATION 20", rows.every((x) => x.ok), rows.filter((x) => !x.ok).map((x) => x.r.field).join(", "));
  const sec12 = VALIDATION.slice(VALIDATION.indexOf("## 12."), VALIDATION.indexOf("## 13."));
  const d = DISTANT_NULLS;
  check("distant: 8 empty copies, 27-41 chance candidates, mean 33, 38 in the real run, rms 0.46 against 0.85-1.04 are the numbers of VALIDATION 12",
    sec12.includes("empty field gives 27-41 chance candidates (mean 33)") && sec12.includes("| candidates | 31 | 41 | 31 | 33 | 29 | 27 | 32 | 37 | **38**") && sec12.includes("0.46") && sec12.includes("0.85-1.04")
    && d.controls === 8 && d.low === 27 && d.high === 41 && d.mean === 33 && d.realRun === 38 && d.rmsBody === 0.46 && d.rmsChanceLow === 0.85 && d.rmsChanceHigh === 1.04 && d.images === 11);
}

// ---------------------------------------------------------------- the lookup
{
  const p3 = baselineFor({ passes: 3 }), p4 = baselineFor({ passes: 4 }), p5 = baselineFor({ passes: 5 }), p6 = baselineFor({ passes: 6 });
  check("lookup: 3 passes gives 11.3 to 13.3 % in 2 fields; 4 passes 0 to 2 % in 3 fields; 5 passes 0 % in 1 field", p3.movers.lowPercent === 11.3 && p3.movers.highPercent === 13.3 && p3.movers.fields === 2
    && p4.movers.lowPercent === 0 && p4.movers.highPercent === 2 && p4.movers.fields === 3 && p5.movers.lowPercent === 0 && p5.movers.highPercent === 0 && p5.movers.fields === 1);
  check("lookup: a number of passes that was never measured gives nothing (no number borrowed from another field)", p6.movers === null && baselineFor({ passes: 2 }).movers === null && baselineFor({ passes: NaN }).movers === null);
  check("lookup: the Planet X baseline is offered only for a Planet X candidate", baselineFor({ passes: 4 }).distant === null && baselineFor({ passes: 4, distant: true }).distant === DISTANT_NULLS);
}

// ---------------------------------------------------------------- the question, written and checked
const CTX = (passes, realData = true) => ({ scaleArcsec: 6.14, fieldRa: 269.4, fieldDec: 4.7, fovArcmin: 5, images: 6, passes, runVersion: "movers-2", ranAt: "2026-11-10T10:00:00.000Z", realData, catalogues: "not consulted" });
const mover = { label: "#1", speedArcsecPerYear: 5, vErrPx: 0.01, positionAngleDeg: 10, compass: "N", nDet: 6, nFrames: 6, significance: 12, falseAlarm: 0.3, rms: 0.2, support: null };
{
  const e = evidenceFromCandidate(mover, CTX(3));
  const sentences = explain("chance", e), check1 = validateSentences(sentences, e), text = sentences.map((s) => s.text).join(" ");
  check("question: 3 passes: the sentence gives the measured share (11.3 to 13.3 %), the number of fields and copies, the candidate's own chance number, and every number is cited", check1.ok && /2 fields, 300 copies each\), 11\.3 to 13\.3 %/.test(text) && /0\.3/.test(text) && check1.problems.length === 0, text.slice(0, 240));
  check("question: it ends with the caution that the baselines come from a few real fields, and for a non-Planet-X candidate says nothing about Planet X", sentences.some((s) => s.text === CAUTIONS.baseline && s.fixed) && !/Planet X/.test(text));
  const none = explain("chance", evidenceFromCandidate(mover, CTX(6)));
  check("question: a field with a number of passes that was never measured says that no baseline is offered", none.some((s) => s.text === CAUTIONS.noBaseline) && none.every((s) => !/%/.test(s.text)));
  const same = explain("chance", evidenceFromCandidate({ ...mover }, CTX(5))), t5 = same.map((s) => s.text).join(" ");
  check("question: when the low and the high share are equal it says it once (0 %), not '0 to 0 %'", /0 %/.test(t5) && !/0 to 0/.test(t5) && validateSentences(same, evidenceFromCandidate(mover, CTX(5))).ok);
}
{
  const cand = { ...mover, label: "#1", distant: { rangeText: "595–607 AU" }, distanceAU: 601, rms: 0.7 };
  const e = evidenceFromCandidate(cand, CTX(4));
  const sentences = explain("chance", e), ok = validateSentences(sentences, e), text = sentences.map((s) => s.text).join(" ");
  check("question: a Planet X candidate gets the measured empty-copy counts (27 to 41, mean 33, 38 in the real run), the rms hint (0.46 against 0.85 to 1.04), its own rms, and that no control was run with the app's own options",
    ok.ok && /8 empty copies of 11 real images gave 27 to 41 chance candidates each \(mean 33\); the real images gave 38/.test(text) && /0\.46 px/.test(text) && /0\.70 px/.test(text) && sentences.some((s) => s.text === CAUTIONS.noDefaultControl), ok.problems.map((p) => p.problem).join("; "));
  check("question: a made-up number is refused by the validator (the baseline cannot be changed in the sentence)", !validateSentences([{ text: "Chance gave 99 to 100 chance candidates each.", cites: ["baseline.distant.low", "baseline.distant.high"] }], e).ok);
  const synth = explain("chance", evidenceFromCandidate(mover, CTX(3, false)));
  check("question: on synthetic images the synthetic caution is added (the baselines are about real fields)", synth.some((s) => s.text === CAUTIONS.synthetic));
}

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
