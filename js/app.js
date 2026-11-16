import { $, el } from "./dom.js";
import { I, CATICON } from "./icons.js";
import { renderBoot, renderServices, isEngineReady, pushBoot, setRuntime } from "./bridge.js";
import { renderToolHead } from "./workspace.js";
import { CATS, TOOLLIST, TOOLMAP } from "./registry.js";
import { getRoute, navigateToTool, navigateHome, navigatePatchnotes } from "./router.js";
import { initNotes, openNotes, hideNotes } from "./notes.js";

import { registerAssemble } from "./tools/assemble.js";
import { registerOptimize } from "./tools/optimize.js";
import { registerProtect } from "./tools/protect.js";
import { registerExtract } from "./tools/extract.js";
import { registerToPdf } from "./tools/to-pdf.js";
import { registerFromPdf } from "./tools/from-pdf.js";

const ENGINES = {};
registerAssemble(ENGINES);
registerOptimize(ENGINES);
registerProtect(ENGINES);
registerExtract(ENGINES);
registerToPdf(ENGINES);
registerFromPdf(ENGINES);

/* ---- index (tool discovery) + workbench --------------------------------- */
const stage = $("#stage");
const gridEl = $("#grid"), pillsEl = $("#pills"), searchEl = $("#toolSearch"),
      emptyEl = $("#empty"), indexEl = $("#index"), workbenchEl = $("#workbench"),
      backEl = $("#back"), notesBtn = $("#notesBtn");
let activeId = null, activeCat = "All";

function buildIndex() {
  ["All", ...CATS].forEach((c, i) => {
    const b = el("button", { class: "pill", type: "button",
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
      "data-cat": t._cat, "data-search": (t.name + " " + t._cat + " " + t.desc + " " + (t.keys || "")).toLowerCase(),
      onclick: () => navigateToTool(t.id) },
      `<span class="fol">${t._code}</span>
       <span class="ico" aria-hidden="true">${CATICON[t._cat] || I.doc}</span>
       <span class="nm">${t.name}</span>
       <span class="sr">${t._cat}</span>
       <span class="ds">${t.desc}</span>`);
    gridEl.appendChild(card);
  });
  searchEl.addEventListener("input", applyFilter);
  if (backEl) backEl.addEventListener("click", () => navigateHome());
  if (notesBtn) notesBtn.addEventListener("click", () => {
    const r = getRoute();
    if (r.view === "patchnotes") navigateHome(); else navigatePatchnotes();
  });
  initNotes({ onBack: () => navigateHome() });
}

function applyFilter() {
  const q = (searchEl.value || "").trim().toLowerCase();
  let vis = 0;
  gridEl.querySelectorAll(".tool-card").forEach((c) => {
    const on = (activeCat === "All" || c.dataset.cat === activeCat) && c.dataset.search.includes(q);
    c.style.display = on ? "" : "none";
    if (on) vis++;
  });
  if (emptyEl) emptyEl.hidden = vis > 0;
}

function showHome() {
  activeId = null;
  if (workbenchEl) workbenchEl.hidden = true;
  hideNotes();
  if (indexEl) indexEl.hidden = false;
}

function showTool(id) {
  const tool = TOOLMAP.get(id);
  if (!tool) { showHome(); return; }
  activeId = id;
  hideNotes();
  if (indexEl) indexEl.hidden = true;
  if (workbenchEl) workbenchEl.hidden = false;
  if (stage) {
    stage.innerHTML = "";
    stage.appendChild(renderToolHead(tool));
    const engineFn = ENGINES[tool.engine];
    if (engineFn) engineFn(tool, stage);
    else stage.appendChild(el("div", { class: "alert" }, `<div>Unknown engine: ${tool.engine}</div>`));
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showPatchnotes() {
  activeId = null;
  if (indexEl) indexEl.hidden = true;
  if (workbenchEl) workbenchEl.hidden = true;
  openNotes({ fromRoute: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyRoute() {
  const route = getRoute();
  if (route.view === "patchnotes") { showPatchnotes(); return; }
  if (route.view === "tool") { showTool(route.id); return; }
  showHome();
}

/* ---- welcome / boot readout --------------------------------------------- */
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
  const seal = $("#seal");
  if (seal) seal.innerHTML = sealSVG();
  const pledges = $("#pledges");
  if (pledges) {
    ["No file upload", "Files never leave this device", "Engines download once, then run offline"].forEach((t) =>
      pledges.appendChild(el("span", { class: "pledge" }, `${I.shield}${t}`)));
  }
  const boot = $("#bootReadout");
  if (boot) renderBoot(boot);
  renderServices();
}

/* ---- boot --------------------------------------------------------------- */
buildIndex();
renderHero();
applyRoute();
window.addEventListener("hashchange", applyRoute);

/* offline: cache the shell + engines so "works offline once loaded" holds */
if ("serviceWorker" in navigator &&
    (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

/* ⌘K / Ctrl-K jumps to the tool search (returning from the workbench first) */
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    const route = getRoute();
    if (route.view !== "home") navigateHome();
    if (searchEl) searchEl.focus();
  }
});
