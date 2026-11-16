import { $, el, escapeHtml } from "./dom.js";
import { I } from "./icons.js";

/* ---- worker (Python engine) --------------------------------------------- */
const runtimeEl = $("#runtime");
const rtMsg = $("#rtMsg");
export const engineState = { ready: false };
export function isEngineReady() { return engineState.ready; }
const bootLog = [];

export function setRuntime(state, msg) {
  if (runtimeEl) runtimeEl.dataset.state = state;
  if (msg && rtMsg) rtMsg.textContent = msg;
  if (state === "ready") $("#bootReadout")?.classList.add("done");
}

export function pushBoot(msg, done) {
  bootLog.push({ msg, done });
  const box = $("#bootReadout");
  if (box) renderBoot(box);
}

export function renderBoot(box) {
  const lines = bootLog.map((l) =>
    `<span class="l"><span class="${l.done ? "ok" : "dim"}">${l.done ? "✓" : "›"}</span> ${escapeHtml(l.msg)}</span>`
  ).join("") + (engineState.ready ? "" : `<span class="l"><span class="caret">▍</span></span>`);
  if (box.classList.contains("done")) {
    box.innerHTML = `<details class="boot-details"><summary>engine ready · on-device</summary><div class="boot-log">${lines}</div></details>`;
  } else {
    box.innerHTML = lines;
    box.scrollTop = box.scrollHeight;
  }
}

export function getBootLog() { return bootLog; }

const worker = new Worker("./worker.js", { type: "module" }); // Pyodide 314 is ESM-only
let reqId = 0;
const pending = new Map();
worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === "boot") { setRuntime("booting", m.msg); pushBoot(m.msg, false); }
  else if (m.type === "ready") {
    engineState.ready = true; setRuntime("ready", "ready · on-device");
    pushBoot("engine ready — nothing left this device", true);
    document.querySelectorAll(".run[data-needs-engine]").forEach((b) => (b.disabled = false));
    onIdle(prefetchEngines); // quietly warm the lazy engines so first use is instant
  }
  else if (m.type === "result") { const p = pending.get(m.id); if (p) { pending.delete(m.id); p.resolve(m); } }
  else if (m.type === "status") { const p = pending.get(m.id); if (p && p.onStatus) p.onStatus(m.msg); if (!(p && p.bg)) setRuntime("busy", m.msg); }
  else if (m.type === "error") {
    if (m.id != null) { const p = pending.get(m.id); if (p) { pending.delete(m.id); p.reject(new Error(m.msg)); } }
    else { setRuntime("error", "engine failed"); pushBoot("ERROR: " + m.msg, true); }
  }
};

let foreground = 0; // count of real (non-prefetch) jobs in flight
export function callEngine(action, params, buffers, onStatus, bg) {
  if (!bg) foreground++;
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject, onStatus, bg });
    worker.postMessage({ id, action, params: params || {}, files: buffers || [] }, buffers || []);
  }).finally(() => { if (!bg) foreground--; });
}

/* ---- qpdf worker (native PDF plumbing, lazy) ----------------------------- */
let qpdfWorker = null, qpdfId = 0;
const qpdfPending = new Map();
export function qpdfCall(op, params, buffer, onStatus) {
  if (!qpdfWorker) {
    qpdfWorker = new Worker("./qpdf-worker.js");
    qpdfWorker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "status") { const p = qpdfPending.get(m.id); if (p && p.onStatus) p.onStatus(m.msg); return; }
      const p = qpdfPending.get(m.id);
      if (!p) return;
      qpdfPending.delete(m.id);
      if (m.type === "result") p.resolve(m); else p.reject(new Error(m.msg));
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++qpdfId;
    qpdfPending.set(id, { resolve, reject, onStatus });
    qpdfWorker.postMessage({ id, op, params: params || {}, file: buffer }, [buffer]);
  });
}

/* ---- engine download consent (heavy tools disclose size first) ----------- */
export const engineOk = (id) => { try { return !!localStorage.getItem("patram-engine-ok:" + id); } catch { return false; } };
export const engineMarkOk = (id) => { try { localStorage.setItem("patram-engine-ok:" + id, "1"); } catch {} };
export function requestPersistence() {
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
}

/* ---- lazy JS engines (CDN) ---------------------------------------------- */
const loaded = {};
export function loadScript(url) {
  if (loaded[url]) return loaded[url];
  loaded[url] = new Promise((res, rej) => {
    const s = el("script", { src: url });
    s.crossOrigin = "anonymous";
    s.onload = res; s.onerror = () => rej(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
  return loaded[url];
}
export async function ensurePdfjs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
  const src = await (await fetch("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js", { mode: "cors" })).blob();
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(src);
  return window.pdfjsLib;
}
export const ensureMammoth = () => window.mammoth ? Promise.resolve(window.mammoth) : loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js").then(() => window.mammoth);
export const ensureJSZip = () => window.JSZip ? Promise.resolve(window.JSZip) : loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js").then(() => window.JSZip);
export const ensureTesseract = () => window.Tesseract ? Promise.resolve(window.Tesseract) : loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js").then(() => window.Tesseract);

/* ---- background prefetch: warm lazy engines so first use is instant ------- */
const SERVICES = {
  pdfjs:      { label: "Page renderer",      light: true, warm: () => ensurePdfjs() },
  jszip:      { label: "Zip packer",         light: true, warm: () => ensureJSZip() },
  mammoth:    { label: "Word reader",        light: true, warm: () => ensureMammoth() },
  fonts:      { label: "Unicode fonts",      warm: () => callEngine("warm", { fonts: true }, [], null, true) },
  pymupdf:    { label: "Compression engine", consent: "compress-max", warm: () => callEngine("warm", { engine: "pymupdf" }, [], null, true) },
  pdfplumber: { label: "Table engine",       consent: "pdfXlsx",      warm: () => callEngine("warm", { engine: "pdfplumber" }, [], null, true) },
  pdf2docx:   { label: "PDF→Word engine",   consent: "pdfWord",      warm: () => callEngine("warm", { engine: "pdf2docx" }, [], null, true) },
};
const svcState = {};
function warmService(key) {
  const svc = SERVICES[key];
  if (!svc) return Promise.resolve();
  if (svc._p) return svc._p;
  svcState[key] = "loading"; renderServices();
  svc._p = Promise.resolve().then(svc.warm).then(() => {
    svcState[key] = "ready";
    if (svc.consent) engineMarkOk(svc.consent);
  }).catch(() => { svcState[key] = "error"; svc._p = null; })
    .finally(renderServices);
  return svc._p;
}
function unmetered() {
  const c = navigator.connection;
  return !!c && !c.saveData && c.effectiveType === "4g";
}
export function onIdle(fn) {
  (window.requestIdleCallback || ((f) => setTimeout(() => f(), 800)))(fn, { timeout: 4000 });
}
let prefetchStarted = false;
export function prefetchEngines() {
  if (prefetchStarted) return; prefetchStarted = true;
  const light = ["pdfjs", "jszip", "mammoth"];
  const heavy = ["fonts", "pymupdf", "pdfplumber", "pdf2docx"];
  const queue = unmetered() ? light.concat(heavy) : light;
  (async () => {
    for (const k of queue) {
      if (!SERVICES[k].light) while (foreground > 0) await new Promise((r) => setTimeout(r, 400));
      await warmService(k);
    }
  })();
}
export function renderServices() {
  const box = $("#svcReadout");
  if (!box) return;
  const rows = Object.keys(SERVICES)
    .filter((k) => svcState[k] === "loading" || svcState[k] === "ready")
    .map((k) => {
      const ready = svcState[k] === "ready";
      const mark = ready ? '<span class="ok">\u2713</span>' : `<span class="spin">${I.spin}</span>`;
      return `<span class="l">${mark} ${escapeHtml(SERVICES[k].label)}${ready ? " ready" : " \u2014 preparing\u2026"}</span>`;
    });
  box.innerHTML = rows.join("");
  box.hidden = rows.length === 0;
}
