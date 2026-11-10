// serviceNotice.js – the page part of a failed or stale service answer: the sentence of serviceCall.js failureText, a Retry button when asking again can help, and a hint when the
// browser comes back online. The words are in serviceCall.js (tested with Node); this file only puts them in an element.
//
//   showServiceNotice(el, { text, retry })   el = a <p> (an aria-live region); text = the sentence; retry = a function, or null when asking again is useless
//   clearServiceNotice(el)

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const watchers = new WeakMap();

export function showServiceNotice(box, { text, retry = null }) {
  if (typeof document === "undefined" || !box.dataset) { box.textContent = text; return; }          // no page (a Node test): the sentence alone
  box.replaceChildren(el("span", { textContent: text + (retry ? " " : "") }));
  if (retry) {
    const button = el("button", { type: "button", className: "btn btn-small notice-retry", textContent: "Retry" });
    button.addEventListener("click", () => { button.disabled = true; retry(); });
    box.append(button);
  }
  box.dataset.notice = "failed";
  // when the network comes back, say so once (the person decides when to ask again: nothing is retried behind their back)
  if (retry && typeof window !== "undefined" && !watchers.has(box)) {
    const onOnline = () => { watchers.delete(box); if (box.dataset.notice === "failed") box.append(el("span", { className: "notice-online", textContent: " The browser is back online: press Retry." })); };
    watchers.set(box, onOnline);
    window.addEventListener("online", onOnline, { once: true });
  }
}

export function clearServiceNotice(box) {
  if (!box.dataset) return;
  delete box.dataset.notice;
  const onOnline = watchers.get(box);
  if (onOnline && typeof window !== "undefined") window.removeEventListener("online", onOnline);
  watchers.delete(box);
}
