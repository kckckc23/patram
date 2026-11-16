import { $, el, escapeHtml } from "./dom.js";

const notesEl = $("#notes");
const notesStage = $("#notesStage");
const notesBtn = $("#notesBtn");
const notesBackEl = $("#notesBack");

let notesData = null, notesLoading = null;

export function initNotes({ onBack }) {
  if (notesBackEl) notesBackEl.addEventListener("click", onBack);
}

export function openNotes({ fromRoute = false } = {}) {
  if (!notesEl || !notesStage) return;
  const indexEl = $("#index");
  const workbenchEl = $("#workbench");
  if (indexEl) indexEl.hidden = true;
  if (workbenchEl) workbenchEl.hidden = true;
  notesEl.hidden = false;
  if (notesBtn) notesBtn.setAttribute("aria-expanded", "true");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (notesData) { renderNotes(notesData); return; }
  notesStage.innerHTML = "";
  notesStage.appendChild(el("div", { class: "progress" },
    `<div class="plog"><span class="dim">loading patch notes…</span></div><div class="bar indeterminate"><i></i></div>`));
  notesLoading = notesLoading || fetch("./patchnotes.json").then((r) => {
    if (!r.ok) throw new Error(`patchnotes.json returned ${r.status}`);
    return r.json();
  });
  notesLoading.then((d) => { notesData = d; renderNotes(d); })
    .catch((err) => {
      notesLoading = null;
      notesStage.innerHTML = "";
      notesStage.appendChild(el("div", { class: "tool-head" },
        `<div><h2>Patch notes</h2><p>What changed in each release.</p></div>`));
      const alert = el("div", { class: "alert" }, `<div>Couldn't load the patch notes: ${escapeHtml(err.message)}</div>`);
      notesStage.appendChild(alert);
    });
}

export function hideNotes() {
  if (notesEl) notesEl.hidden = true;
  if (notesBtn) notesBtn.setAttribute("aria-expanded", "false");
}

export function isNotesOpen() { return notesEl && !notesEl.hidden; }

function renderNotes(data) {
  if (!notesStage) return;
  notesStage.innerHTML = "";
  const releases = (data && data.releases) || [];
  notesStage.appendChild(el("div", { class: "tool-head" },
    `<div><h2>Patch notes</h2><p>What changed in each release — generated from the project's own commit history.</p></div>
     <span class="badge local">${releases.length} RELEASE${releases.length === 1 ? "" : "S"}</span>`));
  if (!releases.length) {
    notesStage.appendChild(el("div", { class: "placeholder" }, `<span class="pt">Nothing published yet</span><span class="ps">The first release will appear here.</span>`));
    return;
  }
  const tl = el("div", { class: "timeline" });
  releases.forEach((r, i) => {
    const version = String(r.version);
    const rel = el("article", { class: "tl-release" });
    const head = el("div", { class: "tl-head" });
    head.appendChild(el("h3", { class: "tl-version" }, escapeHtml(version)));
    if (r.date) head.appendChild(el("time", { class: "tl-date", datetime: r.date }, fmtReleaseDate(r.date)));
    if (version.toLowerCase() === "unreleased") head.appendChild(el("span", { class: "rel-tag" }, "in progress"));
    else if (i === 0) head.appendChild(el("span", { class: "rel-tag" }, "newest"));
    rel.appendChild(head);
    (r.groups || []).forEach((g) => {
      rel.appendChild(el("h4", { class: "tl-grp", "data-grp": g.title }, escapeHtml(g.title)));
      const ul = el("ul", { class: "tl-list" });
      (g.entries || []).forEach((e) => {
        const li = el("li", { class: "tl-row", "data-grp": g.title });
        li.appendChild(el("span", { class: "tl-tag" }, escapeHtml(e.scope || g.title.toLowerCase())));
        li.appendChild(el("span", { class: "tl-text" }, escapeHtml(e.text || "")));
        ul.appendChild(li);
      });
      rel.appendChild(ul);
    });
    tl.appendChild(rel);
  });
  notesStage.appendChild(tl);
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
function fmtReleaseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return String(iso);
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}
