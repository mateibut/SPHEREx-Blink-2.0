// Tests for how the page behaves when a web service fails (features/serviceCall.js, serviceNotice.js, and the wiring in main.js).   Run: node scratch/test_servicecall.mjs
import { readFileSync } from "node:fs";
import { callService, failureKind, failureText, ageText, KINDS } from "../frontend/js/features/serviceCall.js";
import { fetchCatalogue } from "../frontend/js/features/catalogue.js";
import { fetchSkybot } from "../frontend/js/features/skybot.js";
import { fetchSurvey } from "../frontend/js/features/surveyCoverage.js";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  – " + detail : ""}`);
  if (!ok) failed++;
}
const instant = () => Promise.resolve();                      // no real waiting in the tests
const http = (status) => new Error(`SIMBAD answered HTTP ${status}.`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- what kind of failure
{
  const cases = [
    [Object.assign(new Error("x"), { name: "TimeoutError" }), "timeout"], [Object.assign(new Error("x"), { name: "AbortError" }), "cancelled"],
    [http(503), "busy"], [http(429), "busy"], [http(404), "refused"], [http(400), "refused"], [new TypeError("Failed to fetch"), "offline"],
    [new SyntaxError("Unexpected token < in JSON"), "bad-answer"], [Object.assign(new Error("any"), { kind: "timeout" }), "timeout"],
    [new Error("SkyBoT sent something that is not JSON."), "bad-answer"], [new Error("surprise"), "bad-answer"],
  ];
  check("kind: each failure is named (timeout, cancelled, busy, refused, offline, bad-answer)", cases.every(([e, k]) => failureKind(e) === k), cases.map(([e, k]) => `${k}:${failureKind(e)}`).join(" "));
  check("kind: with the browser offline a network error is 'offline' (but a timeout is still a timeout)", failureKind(new Error("boom"), { online: false }) === "offline" && failureKind(Object.assign(new Error("t"), { name: "TimeoutError" }), { online: false }) === "timeout");
  check("kind: the kinds are exactly the six the page words", KINDS.length === 6 && KINDS.every((k) => failureText("X", k).length > 10));
  check("text: every message names the service and says what to do (Retry, or that asking again is useless)", KINDS.filter((k) => k !== "cancelled").every((k) => /X/.test(failureText("X", k)) && (/Retry|needs to change/.test(failureText("X", k)))));
  check("text: a stale answer says how old it is", /Showing the last good answer from 2 min ago/.test(failureText("X", "busy", { stale: true, staleSince: 1000, now: 1000 + 120000 })) && ageText(30000) === "30 s" && ageText(7200000) === "2.0 h");
}

// ---------------------------------------------------------------- retries
{
  let calls = 0;
  const out = await callService({ name: "SIMBAD", run: async () => { calls++; if (calls < 3) throw http(503); return "rows"; }, sleep: instant });
  check("retry: a service that is busy twice and then answers gives the answer, after 3 tries", out.ok && !out.stale && out.value === "rows" && out.attempts === 3 && calls === 3);
  calls = 0;
  const waits = [];
  const bad = await callService({ name: "SIMBAD", run: async () => { calls++; throw http(503); }, retries: 2, baseDelayMs: 100, sleep: async (ms) => { waits.push(ms); }, onAttempt: () => {} });
  check("retry: it gives up after the retries, says 'busy' with the number of tries, and waited 100 then 200 ms", !bad.ok && bad.error.kind === "busy" && bad.attempts === 3 && calls === 3 && waits.join() === "100,200" && /after 3 tries/.test(bad.error.message));
  calls = 0;
  const refused = await callService({ name: "SIMBAD", run: async () => { calls++; throw http(404); }, sleep: instant });
  check("retry: a refusal (HTTP 404) is NOT retried: asking again would give the same answer", !refused.ok && refused.error.kind === "refused" && refused.error.retriable === false && calls === 1);
  const notes = [];
  await callService({ name: "SIMBAD", run: async () => { throw http(502); }, retries: 1, sleep: instant, onAttempt: (a) => notes.push(a) });
  check("retry: the page is told about each retry (attempt, of, kind, wait) so it can say 'trying again'", notes.length === 1 && notes[0].attempt === 1 && notes[0].of === 2 && notes[0].kind === "busy");
}

// ---------------------------------------------------------------- time limit
{
  const t0 = Date.now();
  const slow = await callService({ name: "SkyBoT", run: (signal) => new Promise((_, rej) => { signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))); }), timeoutMs: 30, retries: 1, baseDelayMs: 1 });
  check("timeout: a service that never answers is cut off at the limit, tried again once, and reported as a timeout (not as a cancel)", !slow.ok && slow.error.kind === "timeout" && slow.attempts === 2 && Date.now() - t0 < 1500, `${slow.error?.kind} after ${Date.now() - t0} ms`);
  let aborted = false;
  await callService({ name: "SkyBoT", run: (signal) => new Promise((_, rej) => { signal.addEventListener("abort", () => { aborted = true; rej(new Error("a")); }); }), timeoutMs: 20, retries: 0 });
  check("timeout: the request itself is aborted, so the browser stops waiting for it", aborted);
}

// ---------------------------------------------------------------- cancel
{
  const c = new AbortController();
  const p = callService({ name: "IRSA", run: (signal) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))), signal: c.signal, timeoutMs: 5000 });
  setTimeout(() => c.abort(), 10);
  const out = await p;
  check("cancel: pressing Cancel stops it at once, as 'cancelled', not retried, not an error to show", !out.ok && out.error.kind === "cancelled" && out.attempts === 1);
  const c2 = new AbortController(); c2.abort();
  let ran = 0;
  const pre = await callService({ name: "IRSA", run: async () => { ran++; return 1; }, signal: c2.signal });
  check("cancel: a signal already aborted starts nothing", !pre.ok && pre.error.kind === "cancelled" && ran === 0);
  const c3 = new AbortController();
  let n = 0;
  const mid = callService({ name: "IRSA", run: async () => { n++; throw http(503); }, signal: c3.signal, baseDelayMs: 5000, retries: 3 });
  await wait(20); c3.abort();
  const m = await mid;
  check("cancel: cancelling while it waits to retry ends the wait at once", !m.ok && m.error.kind === "cancelled" && n === 1);
}

// ---------------------------------------------------------------- the last good answer
{
  const cache = new Map();
  let t = 1000;
  const good = await callService({ name: "SIMBAD", key: "field-A", cache, run: async () => ["star"], now: () => t });
  t = 181000;
  const down = await callService({ name: "SIMBAD", key: "field-A", cache, run: async () => { throw new TypeError("Failed to fetch"); }, retries: 0, now: () => t, online: () => false });
  check("stale: after one good answer, a failure shows the LAST GOOD answer, marked stale, with its age and the reason", good.ok && down.ok && down.stale && down.value[0] === "star" && down.staleSince === 1000 && down.error.kind === "offline" && /3 min ago/.test(down.error.message));
  const other = await callService({ name: "SIMBAD", key: "field-B", cache, run: async () => { throw http(503); }, retries: 0, sleep: instant });
  check("stale: an answer for another field is never offered (a wrong field is worse than none)", !other.ok && other.error.kind === "busy");
  const cancelled = new AbortController(); cancelled.abort();
  const c = await callService({ name: "SIMBAD", key: "field-A", cache, run: async () => 1, signal: cancelled.signal });
  check("stale: a cancel never returns a stale answer (the person asked for nothing)", !c.ok && c.error.kind === "cancelled");
  const fresh = await callService({ name: "SIMBAD", key: "field-A", cache, run: async () => ["new"], now: () => 99000 });
  check("stale: a new good answer replaces the old one", fresh.value[0] === "new" && cache.get("field-A").value[0] === "new" && cache.get("field-A").at === 99000);
}

// ---------------------------------------------------------------- the real fetchers tag what they know
{
  const timeoutFetch = () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" }));
  const netFetch = () => Promise.reject(new TypeError("Failed to fetch"));
  const errs = [];
  for (const f of [() => fetchCatalogue(10, 10, 5, { fetchFn: timeoutFetch }), () => fetchSkybot(10, 10, 0.1, 60000, { fetchFn: netFetch }), () => fetchSurvey("http://localhost:8001", { ra: 10, dec: 10, radiusDeg: 0.1 }, { fetchFn: timeoutFetch })]) {
    try { await f(); } catch (e) { errs.push(e); }
  }
  check("fetchers: SIMBAD, SkyBoT and the survey search tag a timeout as 'timeout' and a dead network as 'offline'", errs.length === 3 && failureKind(errs[0]) === "timeout" && failureKind(errs[1]) === "offline" && failureKind(errs[2]) === "timeout", errs.map((e) => failureKind(e)).join());
  let e502 = null;
  try { await fetchSurvey("http://localhost:8001", { ra: 10, dec: 10, radiusDeg: 0.1 }, { fetchFn: async () => ({ ok: false, status: 502, json: async () => ({ detail: "IRSA is down" }) }) }); } catch (e) { e502 = e; }
  check("fetchers: a 502 from the backend (IRSA down) is 'busy', so it is retried", e502 && failureKind(e502) === "busy");
}

// ---------------------------------------------------------------- the page
{
  const MAIN = readFileSync(new URL("../frontend/js/main.js", import.meta.url), "utf8");
  check("page: SIMBAD and SkyBoT go through callService, with the cache of the last good answer", /callService\(\{ name: "SIMBAD"/.test(MAIN) && /callService\(\{ name: "SkyBoT"/.test(MAIN));
  check("page: the notice shows the failure kind's sentence and a Retry button (serviceNotice.js)", /showServiceNotice\(/.test(MAIN) && /Retry/.test(readFileSync(new URL("../frontend/js/features/serviceNotice.js", import.meta.url), "utf8")));
}

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
