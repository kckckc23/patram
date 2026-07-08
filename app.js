/* ============================================================================
   PDF Tools — UI controller
   Talks to the Pyodide worker (Python engine) and to a couple of in-browser JS
   engines (pdf.js for rasterizing, tesseract.js for OCR). Nothing is uploaded.
   ========================================================================== */
"use strict";

/* ---- tiny helpers -------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, html) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const fmtBytes = (b) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
};
const stem = (name) => name.replace(/\.[^.]+$/, "") || name;
function download(bytes, filename, mime) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const I = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  run: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>',
  spin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9" opacity="1"/></svg>',
  rot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2 18a1.7 1.7 0 0 0 1.5 2.6h17A1.7 1.7 0 0 0 22 18L13.7 3.9a1.7 1.7 0 0 0-3 0z"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  min: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9L4 4M9 9V5M9 9H5M15 15l5 5M15 15v4M15 15h4"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5"/><path d="M6 2h9l5 5v13H6z"/><path d="M9 13h6M9 17h4"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
};
const CATICON = {
  "Assemble": I.layers,
  "Optimize": I.min,
  "Extract": I.doc,
  "Convert to PDF": I.swap,
  "Convert from PDF": I.swap,
};
const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  zip: "application/zip",
};

/* ---- worker (Python engine) --------------------------------------------- */
const runtimeEl = $("#runtime"), rtMsg = $("#rtMsg");
let engineReady = false;
const bootLog = [];
function setRuntime(state, msg) {
  runtimeEl.dataset.state = state;
  if (msg) rtMsg.textContent = msg;
}
function pushBoot(msg, done) {
  bootLog.push({ msg, done });
  const box = $("#bootReadout");
  if (box) renderBoot(box);
}

const worker = new Worker("./worker.js");
let reqId = 0;
const pending = new Map();
worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === "boot") { setRuntime("booting", m.msg); pushBoot(m.msg, false); }
  else if (m.type === "ready") {
    engineReady = true; setRuntime("ready", "ready · on-device");
    pushBoot("engine ready — nothing left this device", true);
    document.querySelectorAll(".run[data-needs-engine]").forEach((b) => (b.disabled = false));
  }
  else if (m.type === "result") { const p = pending.get(m.id); if (p) { pending.delete(m.id); p.resolve(m); } }
  else if (m.type === "error") {
    if (m.id != null) { const p = pending.get(m.id); if (p) { pending.delete(m.id); p.reject(new Error(m.msg)); } }
    else { setRuntime("error", "engine failed"); pushBoot("ERROR: " + m.msg, true); }
  }
};
function callEngine(action, params, buffers) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, action, params: params || {}, files: buffers || [] }, buffers || []);
  });
}

/* ---- lazy JS engines (CDN) ---------------------------------------------- */
const loaded = {};
function loadScript(url) {
  if (loaded[url]) return loaded[url];
  loaded[url] = new Promise((res, rej) => {
    const s = el("script", { src: url });
    s.onload = res; s.onerror = () => rej(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
  return loaded[url];
}
async function ensurePdfjs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  return window.pdfjsLib;
}
const ensureJSZip = () => window.JSZip ? Promise.resolve(window.JSZip) : loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js").then(() => window.JSZip);
const ensureTesseract = () => window.Tesseract ? Promise.resolve(window.Tesseract) : loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js").then(() => window.Tesseract);

/* ---- tool registry ------------------------------------------------------ */
const TOOLS = [
  { group: "Assemble" },
  { id: "merge", name: "Merge PDFs", badge: "PYTHON",
    desc: "Combine several PDFs into one. Drag to set the order.",
    engine: "merge", accept: ".pdf", multiple: true },
  { id: "split", name: "Split PDF", badge: "PYTHON",
    desc: "Keep a single range of pages as a new document.",
    engine: "range" },
  { id: "delete", name: "Delete pages", badge: "PYTHON",
    desc: "Remove pages by number or range, e.g. 2, 5-8.",
    engine: "delete" },
  { id: "organize", name: "Organize & rotate", badge: "PYTHON",
    desc: "Reorder, rotate, or drop pages, then rebuild the PDF.",
    engine: "organize" },

  { group: "Optimize" },
  { id: "compress", name: "Compress PDF", badge: "PYTHON",
    desc: "Shrink file size losslessly, plus optional image recompression.",
    engine: "compress" },

  { group: "Extract" },
  { id: "pdfText", name: "PDF → Text", badge: "PYTHON",
    desc: "Pull the selectable text layer out of a PDF.",
    engine: "text" },
  { id: "ocr", name: "OCR scanned PDF", badge: "IN-BROWSER",
    desc: "Read text from scanned/image PDFs with on-device OCR.",
    engine: "ocr" },
  { id: "pdfImg", name: "PDF → Images", badge: "IN-BROWSER",
    desc: "Render each page to a JPG and download them as a zip.",
    engine: "pdf2img" },

  { group: "Convert to PDF" },
  { id: "imgPdf", name: "Images → PDF", badge: "PYTHON",
    desc: "Place JPG/PNG images onto pages, one per image.",
    engine: "images" },
  { id: "txtPdf", name: "Text → PDF", badge: "PYTHON",
    desc: "Type or paste text (or load a .txt) and export a PDF.",
    engine: "compose" },
  { id: "wordPdf", name: "Word → PDF", badge: "PYTHON",
    desc: "Convert a .docx document to PDF (text & headings).",
    engine: "convert", action: "wordToPdf", accept: ".docx", out: "pdf", suffix: "" },
  { id: "xlsxPdf", name: "Excel / CSV → PDF", badge: "PYTHON",
    desc: "Render a spreadsheet as a formatted table PDF.",
    engine: "table" },
  { id: "pptPdf", name: "PowerPoint → PDF", badge: "PYTHON",
    desc: "Lay out each slide's text on a landscape PDF.",
    engine: "convert", action: "pptToPdf", accept: ".pptx", out: "pdf", suffix: "" },

  { group: "Convert from PDF" },
  { id: "pdfWord", name: "PDF → Word", badge: "PYTHON",
    desc: "Extract text into an editable .docx document.",
    engine: "convert", action: "pdfToWord", accept: ".pdf", out: "docx", suffix: "" },
  { id: "pdfXlsx", name: "PDF → Excel", badge: "PYTHON",
    desc: "Detect rows and columns into an .xlsx workbook.",
    engine: "convert", action: "pdfToXlsx", accept: ".pdf", out: "xlsx", suffix: "" },
  { id: "pdfPpt", name: "PDF → PowerPoint", badge: "PYTHON",
    desc: "Turn each page's text into a .pptx slide.",
    engine: "convert", action: "pdfToPpt", accept: ".pdf", out: "pptx", suffix: "" },
];

/* ---- index (tool discovery) + workbench --------------------------------- */
const stage = $("#stage");
const gridEl = $("#grid"), pillsEl = $("#pills"), searchEl = $("#toolSearch"),
      emptyEl = $("#empty"), indexEl = $("#index"), workbenchEl = $("#workbench"),
      backEl = $("#back");
let activeId = null, activeCat = "All";

/* derive ordered categories + a numbered, flat list of tools */
const CATS = [];
const TOOLLIST = [];
(function deriveTools() {
  let cat = null, n = 0;
  TOOLS.forEach((t) => {
    if (t.group) { cat = t.group; CATS.push(cat); return; }
    n++; t._code = String(n).padStart(2, "0"); t._cat = cat;
    TOOLLIST.push(t);
  });
})();

function buildIndex() {
  ["All", ...CATS].forEach((c, i) => {
    const b = el("button", { class: "pill", type: "button", role: "tab",
      "data-cat": c, "aria-current": i === 0 ? "true" : "false",
      onclick: () => {
        activeCat = c;
        pillsEl.querySelectorAll(".pill").forEach((x) => x.setAttribute("aria-current", x === b ? "true" : "false"));
        applyFilter();
      } }, c);
    pillsEl.appendChild(b);
  });
  TOOLLIST.forEach((t) => {
    const card = el("button", { class: "tool-card", type: "button", "data-id": t.id,
      "data-cat": t._cat, "data-search": (t.name + " " + t._cat + " " + t.desc).toLowerCase(),
      onclick: () => selectTool(t.id) },
      `<span class="fol">${t._code}</span>
       <span class="ico">${CATICON[t._cat] || I.doc}</span>
       <span class="nm">${t.name}</span>
       <span class="ds">${t.desc}</span>`);
    gridEl.appendChild(card);
  });
  searchEl.addEventListener("input", applyFilter);
  backEl.addEventListener("click", backToIndex);
}
function applyFilter() {
  const q = searchEl.value.trim().toLowerCase();
  let vis = 0;
  gridEl.querySelectorAll(".tool-card").forEach((c) => {
    const on = (activeCat === "All" || c.dataset.cat === activeCat) && c.dataset.search.includes(q);
    c.style.display = on ? "" : "none";
    if (on) vis++;
  });
  emptyEl.hidden = vis > 0;
}
function selectTool(id) {
  const tool = TOOLLIST.find((t) => t.id === id);
  if (!tool) return;
  activeId = id;
  stage.innerHTML = "";
  stage.appendChild(renderToolHead(tool));
  ENGINES[tool.engine](tool, stage);
  indexEl.hidden = true;
  workbenchEl.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function backToIndex() {
  workbenchEl.hidden = true;
  indexEl.hidden = false;
  activeId = null;
}

/* ---- shared UI bits ------------------------------------------------------ */
function renderToolHead(t) {
  const local = t.badge === "PYTHON" || t.badge === "IN-BROWSER";
  return el("div", { class: "tool-head" },
    `<div><h2>${t.name}</h2><p>${t.desc}</p></div>
     <span class="badge ${local ? "local" : ""}">${t.badge}</span>`);
}
function dropzone({ accept, multiple, label, onFiles }) {
  const input = el("input", { type: "file", accept, class: "sr", ...(multiple ? { multiple: "" } : {}) });
  input.addEventListener("change", () => { if (input.files.length) onFiles([...input.files]); input.value = ""; });
  const dz = el("div", { class: "drop", role: "button", tabindex: "0",
    onclick: () => input.click(),
    onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } } },
    `<span class="di">${I.up}</span><strong>${label || "Drop a file or click to browse"}</strong>
     <span class="hint">${(accept || "any").replace(/\./g, "").toUpperCase()} · stays on your device</span>`);
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("drag");
    const files = [...(e.dataTransfer.files || [])];
    if (files.length) onFiles(multiple ? files : [files[0]]);
  });
  dz.appendChild(input);
  return dz;
}
function fileChip(file, { onRemove, draggable } = {}) {
  const chip = el("div", { class: "file", ...(draggable ? { draggable: "true" } : {}) },
    `${draggable ? `<span class="drag-h">${I.grip}</span>` : ""}
     <span class="fi">${I.file}</span>
     <span class="meta"><span class="name">${file.name}</span><span class="sub">${fmtBytes(file.size)}</span></span>`);
  if (onRemove) {
    const x = el("button", { class: "x", type: "button", "aria-label": "Remove", onclick: onRemove }, I.x);
    chip.appendChild(x);
  }
  return chip;
}
function runButton(label) {
  const b = el("button", { class: "run", type: "button", "data-needs-engine": "1" },
    `${I.run}<span>${label}</span>`);
  if (!engineReady) b.disabled = true;
  b.setBusy = (busy, text) => {
    b.disabled = busy || !engineReady;
    b.innerHTML = busy ? `<span class="spin">${I.spin}</span><span>${text || "Working…"}</span>`
                       : `${I.run}<span>${label}</span>`;
  };
  return b;
}
function alertBox(msg) { return el("div", { class: "alert" }, `${I.alert}<div>${msg}</div>`); }
function placeholder(text, sub) {
  return el("div", { class: "placeholder" }, `${I.empty}<span class="pt">${text}</span><span class="ps">${sub || ""}</span>`);
}
function outColumn(title, actions) {
  const col = el("div");
  const head = el("div", { class: "panel-title" }, `<span>${title}</span>`);
  if (actions) head.appendChild(actions);
  col.appendChild(head);
  const body = el("div"); col.appendChild(body);
  col.body = body;
  return col;
}
function withBusy(btn, msg, fn) {
  btn.setBusy(true, msg); setRuntime("busy", msg);
  return Promise.resolve().then(fn).finally(() => {
    btn.setBusy(false); if (engineReady) setRuntime("ready", "ready · on-device");
  });
}
const readBuf = (file) => file.arrayBuffer();

/* ---- engine renderers ---------------------------------------------------- */
const ENGINES = {};

/* generic single-file → downloadable file */
ENGINES.convert = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Load a file and run the conversion."));
  let file = null;
  const dz = dropzone({ accept: tool.accept, label: "Drop a file or click to browse",
    onFiles: (f) => { file = f[0]; renderLeft(); } });
  const btn = runButton("Convert");
  btn.addEventListener("click", async () => {
    if (!file) return;
    try {
      await withBusy(btn, "Converting…", async () => {
        const res = await callEngine(tool.action, {}, [await readBuf(file)]);
        const name = stem(file.name) + (tool.suffix || "") + "." + tool.out;
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({
          bytes: res.bytes, name, mime: MIME[tool.out],
          stats: [["Output", fmtBytes(res.bytes.byteLength)]],
        }));
      });
    } catch (err) { showError(right.body, err); }
  });
  function renderLeft() {
    left.innerHTML = "";
    left.appendChild(dz);
    if (file) { const files = el("div", { class: "files" }); files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } })); left.appendChild(files); }
    left.appendChild(btn);
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* merge: multi-file, reorderable */
ENGINES.merge = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Add two or more PDFs to merge."));
  let files = [];
  const dz = dropzone({ accept: ".pdf", multiple: true, label: "Drop PDFs or click to browse",
    onFiles: (f) => { files = files.concat(f); renderLeft(); } });
  const btn = runButton("Merge PDFs");
  btn.addEventListener("click", async () => {
    if (files.length < 2) { showError(right.body, "Add at least two PDFs."); return; }
    try {
      await withBusy(btn, "Merging…", async () => {
        const bufs = await Promise.all(files.map(readBuf));
        const res = await callEngine("merge", {}, bufs);
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: "merged.pdf", mime: MIME.pdf,
          stats: [["Files", files.length], ["Output", fmtBytes(res.bytes.byteLength)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  let dragIdx = null;
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (files.length) {
      const list = el("div", { class: "files" });
      files.forEach((f, i) => {
        const chip = fileChip(f, { draggable: true, onRemove: () => { files.splice(i, 1); renderLeft(); } });
        chip.addEventListener("dragstart", () => { dragIdx = i; chip.classList.add("dragging"); });
        chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
        chip.addEventListener("dragover", (e) => e.preventDefault());
        chip.addEventListener("drop", (e) => { e.preventDefault(); if (dragIdx === null || dragIdx === i) return;
          const [m] = files.splice(dragIdx, 1); files.splice(i, 0, m); dragIdx = null; renderLeft(); });
        list.appendChild(chip);
      });
      left.appendChild(list);
    }
    left.appendChild(btn);
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* split: range with page count */
ENGINES.range = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Load a PDF and choose a page range."));
  let file = null, pages = 0;
  const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
    onFiles: async (f) => { file = f[0]; pages = 0; renderLeft();
      try { const r = await callEngine("pageCount", {}, [await readBuf(file)]); pages = r.data.pages; renderLeft(); } catch {} } });
  const startI = el("input", { type: "number", min: "1", value: "1" });
  const endI = el("input", { type: "number", min: "1", value: "1" });
  const btn = runButton("Extract range");
  btn.addEventListener("click", async () => {
    if (!file) return;
    const s = +startI.value, e = +endI.value;
    try {
      await withBusy(btn, "Extracting…", async () => {
        const res = await callEngine("split", { start: s, end: e }, [await readBuf(file)]);
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: `${stem(file.name)}_p${s}-${e}.pdf`, mime: MIME.pdf,
          stats: [["Pages", `${s}–${e}`], ["Output", fmtBytes(res.bytes.byteLength)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) {
      const files = el("div", { class: "files" });
      files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } }));
      left.appendChild(files);
      const field = el("div", { class: "field" }, `<label>Page range${pages ? ` · ${pages} pages total` : ""}</label>`);
      const row = el("div", { class: "row-inputs" });
      if (pages) { startI.max = pages; endI.max = pages; if (+endI.value < 2) endI.value = pages; }
      row.append(startI, el("span", {}, "to"), endI); field.appendChild(row); left.appendChild(field);
      left.appendChild(btn);
    }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* delete pages */
ENGINES.delete = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Load a PDF and list pages to remove."));
  let file = null, pages = 0;
  const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
    onFiles: async (f) => { file = f[0]; pages = 0; renderLeft();
      try { const r = await callEngine("pageCount", {}, [await readBuf(file)]); pages = r.data.pages; renderLeft(); } catch {} } });
  const inp = el("input", { class: "input mono", type: "text", placeholder: "e.g. 1, 3, 8-10" });
  const btn = runButton("Delete pages");
  btn.addEventListener("click", async () => {
    if (!file) return;
    try {
      await withBusy(btn, "Rebuilding…", async () => {
        const res = await callEngine("delete", { ranges: inp.value }, [await readBuf(file)]);
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: `${stem(file.name)}_edited.pdf`, mime: MIME.pdf,
          stats: [["Output", fmtBytes(res.bytes.byteLength)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) {
      const files = el("div", { class: "files" });
      files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } }));
      left.appendChild(files);
      const field = el("div", { class: "field" }, `<label>Pages to remove${pages ? ` · ${pages} total` : ""}</label>`);
      field.appendChild(inp); left.appendChild(field); left.appendChild(btn);
    }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* compress */
ENGINES.compress = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Load a PDF and pick a level."));
  let file = null, quality = 65;
  const levels = [
    { t: "Level 3", n: "Strong", d: "Smaller, lighter images", v: 40 },
    { t: "Level 2", n: "Balanced", d: "Recommended", v: 65 },
    { t: "Level 1", n: "Light", d: "Best quality", v: 85 },
  ];
  const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
    onFiles: (f) => { file = f[0]; renderLeft(); } });
  const btn = runButton("Compress");
  btn.addEventListener("click", async () => {
    if (!file) return;
    const before = file.size;
    try {
      await withBusy(btn, "Compressing…", async () => {
        const res = await callEngine("compress", { quality }, [await readBuf(file)]);
        const after = res.bytes.byteLength;
        const saved = Math.max(0, Math.round((1 - after / before) * 100));
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: `${stem(file.name)}_compressed.pdf`, mime: MIME.pdf,
          stats: [["Before", fmtBytes(before)], ["Saved", saved + "%", true], ["After", fmtBytes(after)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) {
      const files = el("div", { class: "files" });
      files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } }));
      left.appendChild(files);
      const field = el("div", { class: "field" }, `<label>Optimization level</label>`);
      const opts = el("div", { class: "options" });
      levels.forEach((lv) => {
        const o = el("button", { class: "opt", type: "button", "aria-pressed": String(lv.v === quality),
          onclick: () => { quality = lv.v; renderLeft(); } },
          `<div class="ot">${lv.t}</div><div class="on">${lv.n}</div><div class="od">${lv.d}</div>`);
        opts.appendChild(o);
      });
      field.appendChild(opts); left.appendChild(field); left.appendChild(btn);
    }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* pdf -> text */
ENGINES.text = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div");
  const actions = el("div", { class: "tool-actions" });
  const right = outColumn("Extracted text", actions);
  right.body.appendChild(placeholder("No text yet", "Load a PDF to pull out its text layer."));
  let file = null, text = "";
  const copyBtn = el("button", { class: "tbtn", type: "button", onclick: () => { navigator.clipboard.writeText(text); copyBtn.innerHTML = `${I.check} Copied`; setTimeout(() => copyBtn.innerHTML = `${I.copy} Copy`, 1500); } }, `${I.copy} Copy`);
  const dlBtn = el("button", { class: "tbtn", type: "button", onclick: () => download(text, file ? stem(file.name) + ".txt" : "text.txt", MIME.txt) }, `${I.dl} .txt`);
  const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
    onFiles: (f) => { file = f[0]; renderLeft(); } });
  const btn = runButton("Extract text");
  btn.addEventListener("click", async () => {
    if (!file) return;
    try {
      await withBusy(btn, "Reading…", async () => {
        const res = await callEngine("pdfToText", {}, [await readBuf(file)]);
        text = res.text; actions.innerHTML = ""; actions.append(copyBtn, dlBtn);
        right.body.innerHTML = ""; right.body.appendChild(el("div", { class: "text-out" }, escapeHtml(text)));
      });
    } catch (err) { showError(right.body, err); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) { const files = el("div", { class: "files" }); files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } })); left.appendChild(files); left.appendChild(btn); }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* text -> pdf (compose) */
ENGINES.compose = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Type some text and export."));
  const ta = el("textarea", { class: "textarea", placeholder: "Type or paste text here…" });
  ta.value = "Untitled note\n\nStart writing. Line breaks and paragraphs are preserved.";
  const loadInput = el("input", { type: "file", accept: ".txt,.md,.csv", class: "sr" });
  loadInput.addEventListener("change", async () => { if (loadInput.files[0]) { ta.value = await loadInput.files[0].text(); } loadInput.value = ""; });
  const loadBtn = el("button", { class: "tbtn", type: "button", onclick: () => loadInput.click() }, `${I.file} Load .txt`);
  const btn = runButton("Export PDF");
  btn.addEventListener("click", async () => {
    if (!ta.value.trim()) return;
    try {
      await withBusy(btn, "Rendering…", async () => {
        const res = await callEngine("textToPdf", { text: ta.value, name: "note.txt" }, []);
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: "document.pdf", mime: MIME.pdf,
          stats: [["Output", fmtBytes(res.bytes.byteLength)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  const field = el("div", { class: "field" });
  const lbl = el("label", {}, "Content"); field.appendChild(lbl);
  const head = el("div", { class: "tool-actions", style: "margin-bottom:8px" }); head.appendChild(loadBtn);
  field.append(head, ta, loadInput);
  left.append(field, btn);
  grid.append(left, right); root.appendChild(grid);
};

/* spreadsheet -> pdf */
ENGINES.table = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Load an .xlsx or .csv."));
  let file = null;
  const dz = dropzone({ accept: ".xlsx,.csv", label: "Drop a spreadsheet or click to browse",
    onFiles: (f) => { file = f[0]; renderLeft(); } });
  const btn = runButton("Convert to PDF");
  btn.addEventListener("click", async () => {
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    try {
      await withBusy(btn, "Rendering table…", async () => {
        const res = await callEngine("tableToPdf", { isCsv }, [await readBuf(file)]);
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: `${stem(file.name)}.pdf`, mime: MIME.pdf,
          stats: [["Output", fmtBytes(res.bytes.byteLength)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) { const files = el("div", { class: "files" }); files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } })); left.appendChild(files); left.appendChild(btn); }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* images -> pdf */
ENGINES.images = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Result");
  right.body.appendChild(placeholder("Nothing yet", "Add images to compile a PDF."));
  let files = [], size = "letter";
  const dz = dropzone({ accept: "image/*", multiple: true, label: "Drop images or click to browse",
    onFiles: (f) => { files = files.concat(f); renderLeft(); } });
  const btn = runButton("Build PDF");
  btn.addEventListener("click", async () => {
    if (!files.length) return;
    try {
      await withBusy(btn, "Building…", async () => {
        const bufs = await Promise.all(files.map(readBuf));
        const res = await callEngine("imagesToPdf", { size }, bufs);
        right.body.innerHTML = "";
        right.body.appendChild(resultCard({ bytes: res.bytes, name: "images.pdf", mime: MIME.pdf,
          stats: [["Images", files.length], ["Output", fmtBytes(res.bytes.byteLength)]] }));
      });
    } catch (err) { showError(right.body, err); }
  });
  let dragIdx = null;
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (files.length) {
      const list = el("div", { class: "files" });
      files.forEach((f, i) => {
        const chip = fileChip(f, { draggable: true, onRemove: () => { files.splice(i, 1); renderLeft(); } });
        chip.addEventListener("dragstart", () => dragIdx = i);
        chip.addEventListener("dragover", (e) => e.preventDefault());
        chip.addEventListener("drop", (e) => { e.preventDefault(); if (dragIdx === null || dragIdx === i) return; const [m] = files.splice(dragIdx, 1); files.splice(i, 0, m); dragIdx = null; renderLeft(); });
        list.appendChild(chip);
      });
      left.appendChild(list);
      const field = el("div", { class: "field" }, `<label>Page size</label>`);
      const sel = el("select", { class: "input", onchange: (e) => size = e.target.value },
        `<option value="letter">Letter</option><option value="a4">A4</option>`);
      field.appendChild(sel); left.appendChild(field); left.appendChild(btn);
    }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* organize & rotate (pdf.js thumbnails) */
ENGINES.organize = (tool, root) => {
  const wrap = el("div");
  const left = el("div");
  const dz = dropzone({ accept: ".pdf", label: "Drop a PDF to organize its pages",
    onFiles: (f) => loadDoc(f[0]) });
  left.appendChild(dz);
  wrap.appendChild(left);
  root.appendChild(wrap);
  let file = null, thumbs = [], pdfDoc = null;

  async function loadDoc(f) {
    file = f; left.innerHTML = "";
    left.appendChild(el("div", { class: "progress" }, `<div class="plog"><span class="dim">rendering thumbnails…</span></div><div class="bar indeterminate"><i></i></div>`));
    try {
      const pdfjs = await ensurePdfjs();
      const data = new Uint8Array(await readBuf(f));
      pdfDoc = await pdfjs.getDocument({ data }).promise;
      thumbs = Array.from({ length: pdfDoc.numPages }, (_, i) => ({ src: i, rot: 0 }));
      await renderBoard();
    } catch (err) { left.innerHTML = ""; left.appendChild(dz); left.appendChild(alertBox("Couldn't open this PDF: " + err.message)); }
  }

  async function renderBoard() {
    left.innerHTML = "";
    const bar = el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap" });
    bar.appendChild(el("div", { class: "eyebrow" }, `${thumbs.length} page${thumbs.length === 1 ? "" : "s"} · drag to reorder`));
    const btn = runButton("Save PDF");
    btn.style.marginTop = "0"; btn.style.width = "auto";
    bar.appendChild(btn);
    left.appendChild(bar);
    const board = el("div", { class: "thumbs" });
    left.appendChild(board);

    let dragIdx = null;
    for (let i = 0; i < thumbs.length; i++) {
      const t = thumbs[i];
      const cell = el("div", { class: "thumb", draggable: "true" });
      cell.appendChild(el("span", { class: "tnum" }, String(i + 1)));
      const ctl = el("div", { class: "tctl" });
      ctl.appendChild(el("button", { type: "button", title: "Rotate", onclick: () => { t.rot = (t.rot + 90) % 360; paint(cell.querySelector("canvas"), t.rot); } }, I.rot));
      ctl.appendChild(el("button", { class: "del", type: "button", title: "Remove", onclick: () => { thumbs.splice(i, 1); renderBoard(); } }, I.trash));
      cell.appendChild(ctl);
      const canvas = el("canvas");
      cell.appendChild(canvas);
      board.appendChild(cell);
      const page = await pdfDoc.getPage(t.src + 1);
      const vp = page.getViewport({ scale: 0.3 });
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      paint(canvas, t.rot);

      cell.addEventListener("dragstart", () => { dragIdx = i; cell.classList.add("dragging"); });
      cell.addEventListener("dragend", () => cell.classList.remove("dragging"));
      cell.addEventListener("dragover", (e) => e.preventDefault());
      cell.addEventListener("drop", (e) => { e.preventDefault(); if (dragIdx === null || dragIdx === i) return; const [m] = thumbs.splice(dragIdx, 1); thumbs.splice(i, 0, m); dragIdx = null; renderBoard(); });
    }

    btn.addEventListener("click", async () => {
      if (!thumbs.length) { showError(left, "Keep at least one page."); return; }
      try {
        await withBusy(btn, "Saving…", async () => {
          const order = thumbs.map((t) => ({ src: t.src, rot: t.rot }));
          const res = await callEngine("organize", { order }, [await readBuf(file)]);
          const dl = el("div", { style: "margin-top:16px" });
          dl.appendChild(resultCard({ bytes: res.bytes, name: `${stem(file.name)}_organized.pdf`, mime: MIME.pdf,
            stats: [["Pages", thumbs.length], ["Output", fmtBytes(res.bytes.byteLength)]] }));
          left.appendChild(dl); dl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      } catch (err) { showError(left, err); }
    });
  }
  function paint(canvas, rot) { canvas.style.transform = `rotate(${rot}deg)`; }
};

/* pdf -> images (pdf.js + zip) */
ENGINES.pdf2img = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div"), right = outColumn("Pages");
  right.body.appendChild(placeholder("No images yet", "Load a PDF to render each page."));
  let file = null;
  const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
    onFiles: (f) => { file = f[0]; renderLeft(); } });
  const btn = runButton("Render pages");
  const prog = el("div", { class: "progress", style: "display:none" }, `<div class="plog"></div><div class="bar"><i></i></div>`);
  btn.addEventListener("click", async () => {
    if (!file) return;
    prog.style.display = ""; const log = prog.querySelector(".plog"), bar = prog.querySelector(".bar > i");
    const put = (m) => { log.appendChild(el("div", {}, "› " + m)); log.scrollTop = log.scrollHeight; };
    btn.setBusy(true, "Rendering…"); setRuntime("busy", "rendering pages…");
    try {
      const [pdfjs, JSZip] = await Promise.all([ensurePdfjs(), ensureJSZip()]);
      put("opening document…");
      const data = new Uint8Array(await readBuf(file));
      const doc = await pdfjs.getDocument({ data }).promise;
      const zip = new JSZip(); const thumbs = [];
      for (let i = 1; i <= doc.numPages; i++) {
        put(`page ${i} / ${doc.numPages}`); bar.style.width = Math.round((i / doc.numPages) * 100) + "%";
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const c = el("canvas"); c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
        zip.file(`page_${String(i).padStart(3, "0")}.jpg`, blob);
        thumbs.push(c.toDataURL("image/jpeg", 0.7));
      }
      put("packing zip…");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      right.body.innerHTML = "";
      const dlBtn = el("button", { class: "btn-dl", type: "button", style: "margin-bottom:14px", onclick: () => download(zipBlob, `${stem(file.name)}_images.zip`, MIME.zip) }, `${I.dl} Download ${doc.numPages} images (zip)`);
      right.body.appendChild(dlBtn);
      const gal = el("div", { class: "gallery" });
      thumbs.forEach((src, i) => gal.appendChild(el("figure", {}, `<img src="${src}" alt="Page ${i + 1}"><figcaption>page ${i + 1}</figcaption>`)));
      right.body.appendChild(gal);
    } catch (err) { showError(right.body, err); }
    finally { btn.setBusy(false); prog.style.display = "none"; if (engineReady) setRuntime("ready", "ready · on-device"); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) { const files = el("div", { class: "files" }); files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } })); left.appendChild(files); left.appendChild(btn); left.appendChild(prog); }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* OCR (tesseract.js + pdf.js) */
ENGINES.ocr = (tool, root) => {
  const grid = el("div", { class: "grid2" });
  const left = el("div");
  const actions = el("div", { class: "tool-actions" });
  const right = outColumn("Recognized text", actions);
  right.body.appendChild(placeholder("No text yet", "Load a scanned PDF and run OCR."));
  let file = null, lang = "eng", text = "";
  const copyBtn = el("button", { class: "tbtn", type: "button", onclick: () => { navigator.clipboard.writeText(text); } }, `${I.copy} Copy`);
  const dlBtn = el("button", { class: "tbtn", type: "button", onclick: () => download(text, (file ? stem(file.name) : "ocr") + ".txt", MIME.txt) }, `${I.dl} .txt`);
  const dz = dropzone({ accept: ".pdf", label: "Drop a scanned PDF or click to browse",
    onFiles: (f) => { file = f[0]; renderLeft(); } });
  const btn = runButton("Run OCR");
  const prog = el("div", { class: "progress", style: "display:none" }, `<div class="plog"></div><div class="bar"><i></i></div>`);
  btn.addEventListener("click", async () => {
    if (!file) return;
    prog.style.display = ""; const log = prog.querySelector(".plog"), bar = prog.querySelector(".bar > i");
    const put = (m) => { log.appendChild(el("div", {}, "› " + m)); log.scrollTop = log.scrollHeight; };
    btn.setBusy(true, "Reading…"); setRuntime("busy", "running OCR on-device…");
    text = "";
    try {
      const [pdfjs, Tesseract] = await Promise.all([ensurePdfjs(), ensureTesseract()]);
      put("opening document…");
      const data = new Uint8Array(await readBuf(file));
      const doc = await pdfjs.getDocument({ data }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        put(`page ${i} / ${doc.numPages} — rasterizing…`);
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const c = el("canvas"); c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        put(`page ${i} — recognizing…`);
        const { data: { text: t } } = await Tesseract.recognize(c, lang, {
          logger: (mm) => { if (mm.status === "recognizing text") bar.style.width = Math.round(mm.progress * 100) + "%"; },
        });
        text += `--- Page ${i} ---\n${(t || "").trim()}\n\n`;
        right.body.innerHTML = ""; right.body.appendChild(el("div", { class: "text-out" }, escapeHtml(text)));
        actions.innerHTML = ""; actions.append(copyBtn, dlBtn);
      }
      put("done.");
    } catch (err) { showError(right.body, err); }
    finally { btn.setBusy(false); prog.style.display = "none"; if (engineReady) setRuntime("ready", "ready · on-device"); }
  });
  function renderLeft() {
    left.innerHTML = ""; left.appendChild(dz);
    if (file) {
      const files = el("div", { class: "files" });
      files.appendChild(fileChip(file, { onRemove: () => { file = null; renderLeft(); } }));
      left.appendChild(files);
      const field = el("div", { class: "field" }, `<label>Document language</label>`);
      const sel = el("select", { class: "input", onchange: (e) => lang = e.target.value },
        `<option value="eng">English</option><option value="spa">Spanish</option><option value="fra">French</option><option value="deu">German</option><option value="ita">Italian</option><option value="por">Portuguese</option>`);
      field.appendChild(sel); left.appendChild(field); left.appendChild(btn); left.appendChild(prog);
    }
  }
  renderLeft();
  grid.append(left, right); root.appendChild(grid);
};

/* ---- result card + errors ------------------------------------------------ */
function resultCard({ bytes, name, mime, stats }) {
  const card = el("div", { class: "result" });
  card.appendChild(el("div", { class: "ok-ring" }, I.check));
  card.appendChild(el("h4", {}, "Done — on your machine"));
  if (stats && stats.length) {
    const row = el("div", { class: "stat-row" });
    stats.forEach(([k, v, hi]) => row.appendChild(el("div", { class: "stat" + (hi ? " hi" : "") }, `<div class="k">${k}</div><div class="v">${v}</div>`)));
    card.appendChild(row);
  }
  card.appendChild(el("button", { class: "btn-dl", type: "button", onclick: () => download(bytes, name, mime) }, `${I.dl} Download ${name}`));
  return card;
}
function showError(container, err) {
  const msg = err instanceof Error ? err.message : String(err);
  const existing = container.querySelector(".alert"); if (existing) existing.remove();
  container.appendChild(alertBox(msg));
}
function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

/* ---- welcome / boot readout --------------------------------------------- */
function renderBoot(box) {
  box.innerHTML = bootLog.map((l) =>
    `<span class="l"><span class="${l.done ? "ok" : "dim"}">${l.done ? "✓" : "›"}</span> ${escapeHtml(l.msg)}</span>`
  ).join("") + (engineReady ? "" : `<span class="l"><span class="caret">▍</span></span>`);
  box.scrollTop = box.scrollHeight;
}
/* the mandala seal — hand-built lotus, the page's signature ornament */
function sealSVG() {
  const petals = [];
  for (let i = 0; i < 8; i++)
    petals.push(`<path d="M100 100 C116 60 116 38 100 20 C84 38 84 60 100 100 Z" transform="rotate(${i * 45} 100 100)"/>`);
  const inner = [];
  for (let i = 0; i < 8; i++)
    inner.push(`<path d="M100 100 C110 74 110 58 100 46 C90 58 90 74 100 100 Z" transform="rotate(${i * 45 + 22.5} 100 100)"/>`);
  const dots = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5 * Math.PI) / 180;
    dots.push(`<circle cx="${(100 + 92 * Math.cos(a)).toFixed(1)}" cy="${(100 + 92 * Math.sin(a)).toFixed(1)}" r="2.4"/>`);
  }
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Patram seal">
    <circle cx="100" cy="100" r="97" fill="none" stroke="#b6862c" stroke-width="1.5"/>
    <g class="rot">
      <g fill="#e79310" opacity=".92">${petals.join("")}</g>
      <g fill="#c0261d" opacity=".9">${inner.join("")}</g>
      <g fill="#b6862c">${dots.join("")}</g>
    </g>
    <circle cx="100" cy="100" r="82" fill="none" stroke="#1d3a63" stroke-width="1.2" opacity=".55"/>
    <circle cx="100" cy="100" r="17" fill="#c0261d" stroke="#b6862c" stroke-width="1.5"/>
    <circle cx="100" cy="100" r="6" fill="#e79310"/>
  </svg>`;
}
function renderHero() {
  $("#seal").innerHTML = sealSVG();
  const pledges = $("#pledges");
  ["No file upload", "Runs offline once loaded", "Open the network tab — it stays quiet"].forEach((t) =>
    pledges.appendChild(el("span", { class: "pledge" }, `${I.shield}${t}`)));
  renderBoot($("#bootReadout"));
}

/* ---- boot --------------------------------------------------------------- */
buildIndex();
renderHero();

/* ⌘K / Ctrl-K jumps to the tool search (returning from the workbench first) */
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (!workbenchEl.hidden) backToIndex();
    searchEl.focus();
  }
});
