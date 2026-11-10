// chanceBaseline.js – how often does CHANCE ALONE give a candidate, measured on real images (pure: constants and one lookup, no DOM, no network).
//
// A candidate on its own says little: the question is how many like it an EMPTY field gives. These are the answers that were measured, with the command that makes each again. Nothing
// here is estimated or invented, and a number is offered only for the situation it was measured in; anything else says "not measured". Changing a value needs a new measurement
// (scratch/test_chancebaseline.mjs checks the numbers against docs/VALIDATION.md).
//
//   Find movers: scratch/validate_uncertainty_real.mjs --field "<field>" --nulls 300 (VALIDATION 20; the same method as calibrate_real.mjs --mode null, VALIDATION 10): every image of a real
//   field is rotated or mirrored and moved at random, independently, so no correspondence is left and any candidate is false by construction. The share of such copies that list at least
//   one candidate with the app's default rule, by the number of survey passes of the field.
//   Planet X search: scratch/blind_planet_x.mjs (VALIDATION 12): 8 scrambled copies of 11 real D1 images of 30 arcmin, searched with the LOOSENED options of scratch/real_parallax.mjs.

export const MOVERS_NULLS = [
  { field: "Barnard D2", images: 15, passes: 4, withCandidate: 0, copies: 300 },
  { field: "Barnard D6", images: 6, passes: 3, withCandidate: 34, copies: 300 },
  { field: "Epsilon Indi B D2", images: 11, passes: 5, withCandidate: 0, copies: 300 },
  { field: "Epsilon Indi B D6", images: 6, passes: 4, withCandidate: 4, copies: 300 },
  { field: "WISE 0855 D2", images: 6, passes: 4, withCandidate: 6, copies: 300 },
  { field: "WISE 0855 D6", images: 6, passes: 3, withCandidate: 40, copies: 300 },
];

export const DISTANT_NULLS = {
  options: "loosened (1 dot per pass, 50 % of the dates, rms up to 1.5 px, 4 σ)",
  controls: 8, images: 11, fieldArcmin: 30,
  low: 27, high: 41, mean: 33,                 // candidates in an EMPTY copy
  realRun: 38,                                 // candidates in the real images (the body, Makemake, was one of them)
  rmsBody: 0.46, rmsChanceLow: 0.85, rmsChanceHigh: 1.04,      // fit rms (px) of the body against the 8-dot chance candidates of the controls: a hint from 8 controls, not a rule
};

/**
 * What was measured for a field with `passes` survey passes (and, for a Planet X candidate, for the distant search).
 * -> { movers: { passes, fields, copies, lowPercent, highPercent } | null, distant: DISTANT_NULLS | null }
 * `movers` is null when no measured field has that number of passes: the caller says "not measured", it does not borrow another field's number.
 */
export function baselineFor({ passes, distant = false }) {
  const same = MOVERS_NULLS.filter((r) => r.passes === passes);
  const pct = (r) => (100 * r.withCandidate) / r.copies;
  const movers = same.length ? {
    passes, fields: same.length, copies: same[0].copies,
    lowPercent: Number(Math.min(...same.map(pct)).toFixed(1)), highPercent: Number(Math.max(...same.map(pct)).toFixed(1)),
    names: same.map((r) => `${r.field} (${r.images} images)`).join(", "),
  } : null;
  return { movers, distant: distant ? DISTANT_NULLS : null };
}
