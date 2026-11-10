// release_audit.mjs – release-quality checks of how the page holds up for people who zoom, who use forced colours or reduced motion, or who touch a phone, in headless Chrome over the
// DevTools Protocol (Node only, no npm).   node scratch/release_audit.mjs [--allow-skip] [--verbose]   (Node 22+, Chrome or Edge; CHROME_PATH names one)
//
//   1. REFLOW at 200 % and 400 % zoom (WCAG 1.4.4 and 1.4.10): a 1280 px window zoomed to 400 % is a page 320 CSS px wide, to 200 % 640 px. The page must not need sideways scrolling, and
//      no visible element may stick out of the window (a table or a picture that scrolls inside its own box is fine).
//   2. FORCED COLOURS (Windows high contrast): every button, field and select still has a border or an outline of its own, because the system colours replace the backgrounds that made them
//      look like controls; the picture canvas keeps a border.
//   3. REDUCED MOTION: with prefers-reduced-motion the page starts no CSS animation or transition that keeps running and does not start the blink by itself.
//   4. TOUCH on a phone-sized screen (375 x 812, coarse pointer): no sideways scroll, a viewport meta, every control at least 24 x 24 px (WCAG 2.2 AA, 2.5.8); controls under 44 x 44 are COUNTED and
//      listed (the AAA size and the usual advice), not failed.
//   5. TEXT SPACING (WCAG 1.4.12): with the line height, paragraph, letter and word spacing the criterion names, no text is clipped or hidden.
// What it cannot do: be a real phone, a real screen reader, or a person with low vision. It checks what a browser can be asked. Pages: index.html (with the synthetic demo loaded) and results.html.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, findBrowser, Cdp, launch, sleep } from "./lib_cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend");
const ALLOW_SKIP = process.argv.includes("--allow-skip"), VERBOSE = process.argv.includes("--verbose");
let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  – " + detail : ""}`);
  if (!ok) failed++;
}
const info = (text) => console.log(`INFO  ${text}`);

async function main() {
  if (typeof WebSocket === "undefined") { console.log("SKIP  this Node has no built-in WebSocket (Node 22 or newer is needed)"); process.exitCode = ALLOW_SKIP ? 0 : 2; return; }
  const browserPath = findBrowser();
  if (!browserPath) { console.log("SKIP  no Chrome or Edge found (set CHROME_PATH)"); process.exitCode = ALLOW_SKIP ? 0 : 2; return; }
  const { server, port } = await startServer(ROOT);
  const base = `http://127.0.0.1:${port}`, userDir = await mkdtemp(path.join(tmpdir(), "spherex-release-"));
  let child = null;
  try {
    const launched = await launch(browserPath, userDir);
    child = launched.child;
    const ws = new WebSocket(launched.wsUrl);
    await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", () => reject(new Error("cannot connect to the browser"))); });
    const cdp = new Cdp(ws);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = (m, p) => cdp.send(m, p, sessionId);
    cdp.on("Fetch.requestPaused", async (p) => {                                   // nothing leaves this machine: the web fonts get an empty answer
      if (new URL(p.request.url).hostname === "127.0.0.1") { await cdp.send("Fetch.continueRequest", { requestId: p.requestId }, sessionId); return; }
      await cdp.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: p.resourceType === "Stylesheet" ? "text/css" : "text/plain" }], body: "" }, sessionId);
    });
    await page("Page.enable"); await page("Runtime.enable"); await page("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    const evaluate = async (expression) => {
      const r = await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`in the page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    const waitFor = async (expression, label, timeoutMs = 90000) => {
      const t0 = Date.now();
      for (;;) { let v = null; try { v = await evaluate(expression); } catch { v = null; } if (v) return v; if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for: ${label}`); await sleep(150); }
    };
    const step = async (name, fn) => { try { const d = await fn(); check(name, true, d ?? ""); } catch (err) { check(name, false, err.message); } };
    const size = (width, height, { mobile = false, scale = 1 } = {}) => page("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile });
    const media = (features) => page("Emulation.setEmulatedMedia", { features });
    const load = async (file, { demo = false } = {}) => {
      await page("Page.navigate", { url: `${base}/${file}` });
      await waitFor(`document.readyState === "complete" && document.body`, "page");
      if (demo) {
        await waitFor(`document.getElementById("planetx-demo-btn")`, "demo button");
        await evaluate(`document.getElementById("planetx-demo-btn").click()`);
        await waitFor(`!document.getElementById("find-distant-btn").disabled`, "images loaded");
        await evaluate(`document.getElementById("find-distant-btn").click()`);
        await waitFor(`document.querySelector("#mover-list .mover-item")`, "a candidate");
      } else await sleep(600);
      await sleep(500);
    };
    // elements that stick out of the window: visible, not inside a box that scrolls on its own (overflow auto/scroll/hidden up the tree), not position:fixed
    const stickOut = `(() => {
      const W = document.documentElement.clientWidth, out = [];
      const scrollsInside = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) return true; } return false; };
      for (const e of document.body.querySelectorAll("*")) {
        const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || s.position === "fixed" || e.closest("[hidden], .sr-only, svg *")) continue;
        const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        if ((r.right > W + 1 || r.left < -1) && !scrollsInside(e)) out.push(e.tagName + (e.id ? "#" + e.id : "") + "." + String(e.className?.baseVal ?? e.className).slice(0, 30) + " " + Math.round(r.left) + ".." + Math.round(r.right) + " of " + W);
      }
      return { scrollW: document.documentElement.scrollWidth, clientW: W, out: out.slice(0, 8), n: out.length };
    })()`;

    // ------------------------------------------------------------ 1. reflow at 200 % and 400 %
    for (const [file, demo] of [["index.html", true], ["results.html", false]]) {
      await load(file, { demo });
      for (const [zoom, width] of [[200, 640], [400, 320]]) {
        await size(width, 900);
        await sleep(400);
        await step(`reflow: ${file} at ${zoom} % zoom (${width} CSS px wide) needs no sideways scrolling and nothing sticks out of the window`, async () => {
          const r = await evaluate(stickOut);
          if (r.scrollW > r.clientW + 1) throw new Error(`the page is ${r.scrollW} px wide in a ${r.clientW} px window; sticking out: ${r.out.join(" | ")}`);
          if (r.n) throw new Error(`${r.n} element(s) stick out: ${r.out.join(" | ")}`);
          return `${r.scrollW} px of ${r.clientW}`;
        });
      }
    }

    // ------------------------------------------------------------ 2. forced colours
    await size(1280, 900);
    await media([{ name: "forced-colors", value: "active" }, { name: "prefers-color-scheme", value: "dark" }]);
    await load("index.html", { demo: true });
    await step("forced colours: the page is in forced-colors mode, and every button, select and text field keeps a border or an outline of its own", async () => {
      const r = await evaluate(`(() => {
        const forced = matchMedia("(forced-colors: active)").matches, bad = [];
        const vis = (e) => { const s = getComputedStyle(e); return s.visibility !== "hidden" && s.display !== "none" && !e.closest("[hidden]") && e.getBoundingClientRect().width > 0; };
        let n = 0;
        for (const e of document.querySelectorAll("button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, summary, #blink-canvas")) {
          if (!vis(e)) continue; n++;
          const s = getComputedStyle(e), border = ["Top", "Right", "Bottom", "Left"].some((d) => parseFloat(s["border" + d + "Width"]) > 0 && s["border" + d + "Style"] !== "none");
          const outline = parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== "none";
          if (!border && !outline && !e.matches("summary, .panel-toggle, .tl-point, .stage-btn")) bad.push(e.tagName + "#" + e.id + "." + String(e.className).slice(0, 26));
        }
        return { forced, bad: bad.slice(0, 10), n };
      })()`);
      if (!r.forced) throw new Error("the browser did not enter forced-colors mode, so nothing was checked");
      if (r.bad.length) throw new Error(`${r.bad.length} control(s) have no border and no outline: ${r.bad.join(", ")}`);
      return `${r.n} controls`;
    });
    await step("forced colours: the focus is still visible on a button (an outline of at least 2 px, or a border change)", async () => {
      await evaluate(`document.getElementById("find-movers-btn").focus()`);
      const r = await evaluate(`(() => { const s = getComputedStyle(document.getElementById("find-movers-btn")); return { w: parseFloat(s.outlineWidth), style: s.outlineStyle }; })()`);
      if (!(r.w >= 2 && r.style !== "none")) throw new Error(`outline ${r.w}px ${r.style}`);
      return `${r.w}px ${r.style}`;
    });
    await media([{ name: "forced-colors", value: "none" }]);

    // ------------------------------------------------------------ 3. reduced motion
    await media([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await load("index.html", { demo: true });
    await step("reduced motion: no CSS animation keeps running, and the blink does not start by itself", async () => {
      const r = await evaluate(`(() => {
        const running = document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().iterations === Infinity)).map((a) => (a.effect?.target?.tagName ?? "?") + "#" + (a.effect?.target?.id ?? "") + "." + String(a.effect?.target?.className ?? "").slice(0, 24) + " " + (a.animationName ?? a.transitionProperty ?? ""));
        const play = document.getElementById("play-btn");
        return { running, playing: Boolean(play && (play.getAttribute("aria-pressed") === "true" || /pause/i.test(play.getAttribute("aria-label") ?? play.textContent))) };
      })()`);
      if (r.running.length) throw new Error(`${r.running.length} endless animation(s) still run: ${r.running.slice(0, 4).join(" | ")}`);
      if (r.playing) throw new Error("the blink is playing by itself");
      return "none running";
    });
    await media([{ name: "prefers-reduced-motion", value: "no-preference" }]);

    // ------------------------------------------------------------ 4. touch, on a phone
    await page("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await size(375, 812, { mobile: true, scale: 2 });
    await media([{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }]);
    await load("index.html", { demo: true });
    await step("phone: a viewport meta, no sideways scrolling and nothing sticking out at 375 px (index.html)", async () => {
      const meta = await evaluate(`document.querySelector('meta[name="viewport"]')?.content ?? ""`);
      if (!/width=device-width/.test(meta)) throw new Error(`viewport meta: "${meta}"`);
      const r = await evaluate(stickOut);
      if (r.scrollW > r.clientW + 1 || r.n) throw new Error(`page ${r.scrollW} of ${r.clientW} px; ${r.n} stick out: ${r.out.join(" | ")}`);
      return `${r.scrollW} px of ${r.clientW}`;
    });
    const targets = await evaluate(`(() => {
      const vis = (e) => { const s = getComputedStyle(e); return s.visibility !== "hidden" && s.display !== "none" && !e.closest("[hidden]") && e.getBoundingClientRect().width > 0; };
      const small24 = [], small44 = []; let n = 0;
      for (const e of document.querySelectorAll("button, a[href], select, summary, input:not([type=hidden])")) {
        if (!vis(e)) continue;
        const inline = e.tagName === "A" && e.closest("p, li, td, label, small, span, h1, h2, h3, nav") && getComputedStyle(e).display === "inline";
        if (inline) continue; n++;
        // a checkbox or a radio button is pressed through its label: the target is the label's box (WCAG 2.5.8 counts the whole clickable area)
        const box = e.matches("input[type=checkbox], input[type=radio]") && e.labels?.[0] ? e.labels[0] : e;
        const r = box.getBoundingClientRect(), label = e.tagName + "#" + e.id + "." + String(e.className).slice(0, 22) + " " + Math.round(r.width) + "x" + Math.round(r.height);
        if (r.width < 24 || r.height < 24) small24.push(label); else if (r.width < 44 || r.height < 44) small44.push(label);
      }
      return { n, small24, small44 };
    })()`);
    check("phone: every control is at least 24 x 24 px (WCAG 2.2, 2.5.8)", targets.small24.length === 0, `${targets.n} controls; ${targets.small24.slice(0, 6).join(" | ")}`);
    info(`phone: ${targets.small44.length} of ${targets.n} controls are between 24 and 44 px on a side (the 44 px advice is not a requirement of AA)${VERBOSE ? ": " + targets.small44.join(" | ") : ""}`);
    await media([{ name: "pointer", value: "fine" }, { name: "hover", value: "hover" }]);
    await page("Emulation.setTouchEmulationEnabled", { enabled: false });
    await size(375, 812, { mobile: true, scale: 2 });
    await load("results.html");
    await step("phone: the results page needs no sideways scrolling at 375 px", async () => {
      const r = await evaluate(stickOut);
      if (r.scrollW > r.clientW + 1 || r.n) throw new Error(`page ${r.scrollW} of ${r.clientW} px; ${r.n} stick out: ${r.out.join(" | ")}`);
      return `${r.scrollW} px of ${r.clientW}`;
    });

    // ------------------------------------------------------------ 5. text spacing (WCAG 1.4.12)
    await size(1280, 900);
    await load("index.html", { demo: true });
    await step("text spacing: with line height 1.5, paragraph spacing 2 em, letter spacing 0.12 em and word spacing 0.16 em nothing is clipped (text in a box of fixed height keeps its text visible)", async () => {
      await evaluate(`(() => { const s = document.createElement("style"); s.id = "ts"; s.textContent = "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }"; document.head.append(s); })()`);
      await sleep(400);
      const r = await evaluate(`(() => {
        const bad = [];
        for (const e of document.body.querySelectorAll("button, label, h1, h2, h3, summary, td, th, li, p, span, a")) {
          const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || e.closest("[hidden], .sr-only")) continue;
          if (e.scrollHeight > e.clientHeight + 2 && /(hidden|clip)/.test(s.overflowY) && e.clientHeight > 0) bad.push(e.tagName + "#" + e.id + "." + String(e.className).slice(0, 24) + " " + e.scrollHeight + ">" + e.clientHeight);
          if (e.scrollWidth > e.clientWidth + 2 && /(hidden|clip)/.test(s.overflowX) && s.textOverflow !== "ellipsis" && e.clientWidth > 0) bad.push(e.tagName + "#" + e.id + "." + String(e.className).slice(0, 24) + " w " + e.scrollWidth + ">" + e.clientWidth);
        }
        document.getElementById("ts").remove();
        return bad.slice(0, 10);
      })()`);
      if (r.length) throw new Error(`${r.length} element(s) clip their text: ${r.join(" | ")}`);
      return "no clipped text";
    });

    info("not covered here: a real phone, a real screen reader (NVDA, JAWS, VoiceOver, TalkBack), a person with low vision, the public Pages site on a real network");
    ws.close();
  } catch (err) {
    check("the audit itself ran to the end", false, err.message);
  } finally {
    if (child) { child.kill(); await sleep(300); }
    server.close();
    await rm(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
}

await main();
if (process.exitCode !== 2) { console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed"); process.exitCode = failed ? 1 : 0; }
process.exit(process.exitCode ?? 0);
