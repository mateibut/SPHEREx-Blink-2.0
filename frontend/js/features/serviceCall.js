// serviceCall.js – what happens when a web service does not answer: say WHICH kind of failure it was, try again when trying again can help, give up after a
// time, and keep the last good answer so the page still shows something true (pure: the fetch, the clock and the pause are injected, so Node tests it).
//
//   const out = await callService({ name: "SIMBAD", key, run: (signal) => fetchCatalogue(...), cache, signal, retries: 2 });
//   out.ok === true,  out.stale === false   a fresh answer (out.attempts tells how many tries it took)
//   out.ok === true,  out.stale === true    the service failed, this is the LAST GOOD answer from out.staleSince (out.error says why it failed now)
//   out.ok === false                        nothing to show; out.error = { kind, message, retriable }
//
// The kinds of failure (failureKind):  "offline" (the browser has no network, or the request never left),  "timeout" (no answer in time),  "cancelled" (the person pressed Cancel
// or a newer request replaced this one: never retried, never an error to show),  "busy" (HTTP 429 or 5xx: the service is overloaded or down; retried),  "refused" (another
// HTTP error: asking again will not change it),  "bad-answer" (an answer that could not be read; asking again may help once).
// Nothing here invents an answer: a stale answer is marked stale with its age, and a fresh failure is never turned into an empty success.

export const KINDS = ["offline", "timeout", "cancelled", "busy", "refused", "bad-answer"];

/** Work out the kind of a failure from the error a fetch (or a feature built on it) threw. */
export function failureKind(err, { online = true } = {}) {
  if (KINDS.includes(err?.kind)) return err.kind;                                  // the fetcher already knew (catalogue.js, skybot.js)
  const name = err?.name ?? "", msg = String(err?.message ?? err ?? "");
  if (name === "AbortError") return "cancelled";                                   // user cancel / replaced request (AbortSignal.timeout gives TimeoutError, below)
  if (name === "TimeoutError" || /timed? ?out|timeout/i.test(msg)) return "timeout";
  if (!online) return "offline";
  const status = Number(err?.status ?? /\bHTTP (\d{3})\b/.exec(msg)?.[1]);
  if (Number.isFinite(status) && status > 0) return status === 429 || status >= 500 ? "busy" : "refused";
  if (name === "SyntaxError" || /JSON|unexpected token|parse|unreadable|not a valid|unexpected (reply|answer|response)/i.test(msg)) return "bad-answer";
  if (name === "TypeError" || /failed to fetch|networkerror|network request|load failed|ERR_/i.test(msg)) return "offline";
  return "bad-answer";
}

const RETRIABLE = { offline: true, timeout: true, busy: true, "bad-answer": true, refused: false, cancelled: false };

/** One sentence for the person: what failed, in which service, and what can be done. */
export function failureText(name, kind, { attempts = 1, stale = false, staleSince = null, now = Date.now() } = {}) {
  const tried = attempts > 1 ? ` after ${attempts} tries` : "";
  const what = {
    offline: `${name} could not be reached${tried}: the browser seems to be offline, or the address is blocked. Check the connection, then press Retry.`,
    timeout: `${name} did not answer in time${tried}. It may be slow or busy; press Retry to ask again.`,
    cancelled: `The request to ${name} was cancelled.`,
    busy: `${name} is busy or down right now${tried}. This is on their side; press Retry in a minute.`,
    refused: `${name} refused the request. Asking again will give the same answer; the request itself needs to change.`,
    "bad-answer": `${name} answered, but the answer could not be read${tried}. Press Retry; if it happens again the service may have changed.`,
  }[kind] ?? `${name} failed.`;
  if (!stale) return what;
  const age = staleSince ? ` from ${ageText(now - staleSince)} ago` : "";
  return `${what} Showing the last good answer${age} instead.`;
}

/** The sentence plus the service's own words ("SIMBAD answered HTTP 503."), which say more than the kind alone. */
export const withDetail = (error) => (error.cause && error.kind !== "cancelled" && !error.message.includes(error.cause) ? `${error.message} (${error.cause})` : error.message);

export function ageText(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
}

/**
 * Call a service with retries, a time limit and a memory of the last good answer.
 *   name        what the person calls it ("SIMBAD", "SkyBoT", "IRSA survey search")
 *   run(signal) the call: must reject on failure and honour the AbortSignal
 *   key         what the answer is for (the field, the date...): a stale answer is only offered for the SAME key
 *   cache       a Map shared between calls: key -> { value, at }
 *   signal      the person's AbortSignal (Cancel, or a newer request): aborting stops at once and gives kind "cancelled"
 *   retries     extra tries after the first, for failures that can change (offline, timeout, busy, bad-answer); default 2
 *   timeoutMs   limit of ONE try (default 20000); the try is aborted and counts as a timeout
 *   baseDelayMs wait before the first retry, doubled each time (default 800)
 *   online()    () => boolean (navigator.onLine); sleep(ms, signal), now(), onAttempt({ attempt, of, kind, waitMs }) are injectable
 */
export async function callService({
  name, run, key = "", cache = null, signal = null, retries = 2, timeoutMs = 20000, baseDelayMs = 800,
  online = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false), sleep = defaultSleep, now = () => Date.now(), onAttempt = null,
}) {
  const of = retries + 1;
  let lastKind = "bad-answer", lastErr = null, attempts = 0;
  for (let attempt = 1; attempt <= of; attempt++) {
    if (signal?.aborted) return fail("cancelled", new Error("cancelled"), attempts);
    attempts = attempt;
    const own = new AbortController();
    const onAbort = () => own.abort(signal.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    let timer = null, timedOut = false;
    const limit = new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; own.abort(); reject(Object.assign(new Error(`${name} did not answer within ${timeoutMs / 1000} s`), { name: "TimeoutError" })); }, timeoutMs); });
    try {
      const value = await Promise.race([run(own.signal), limit]);
      if (cache) cache.set(key, { value, at: now() });
      return { ok: true, stale: false, value, attempts, name };
    } catch (err) {
      lastErr = err;
      lastKind = signal?.aborted ? "cancelled" : timedOut ? "timeout" : failureKind(err, { online: online() });
      if (lastKind === "cancelled" || !RETRIABLE[lastKind] || attempt === of) break;
      const waitMs = baseDelayMs * 2 ** (attempt - 1);
      onAttempt?.({ attempt, of, kind: lastKind, waitMs });
      try { await sleep(waitMs, signal); } catch { lastKind = "cancelled"; break; }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  return fail(lastKind, lastErr, attempts);

  function fail(kind, err, tries) {
    const error = { kind, message: failureText(name, kind, { attempts: tries }), retriable: RETRIABLE[kind] ?? false, cause: String(err?.message ?? err ?? "") };
    const kept = cache?.get(key);
    if (kind !== "cancelled" && kept) {
      error.message = failureText(name, kind, { attempts: tries, stale: true, staleSince: kept.at, now: now() });
      return { ok: true, stale: true, value: kept.value, staleSince: kept.at, error, attempts: tries, name };
    }
    return { ok: false, stale: false, error, attempts: tries, name };
  }
}

function defaultSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("cancelled")); return; }
    const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    function onAbort() { clearTimeout(t); reject(new Error("cancelled")); }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
