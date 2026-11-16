import { el, fmtBytes, stem, download, escapeHtml, escapeAttr, readBuf } from "./dom.js";
import { I, MIME } from "./icons.js";
import { isEngineReady, setRuntime, ensureJSZip } from "./bridge.js";

/* ---- shared UI helpers --------------------------------------------------- */
export function engineHint(heavy) {
  return el("p", { class: "engine-hint" },
    `${I.shield} First use downloads the ${heavy.label} (~${heavy.mb} MB) from the CDN — cached on this device,
     works offline afterwards. Your file still never leaves this device.`);
}

let fieldSeq = 0;
export function labelled(labelHtml, target, ...rest) {
  const f = el("div", { class: "field" });
  const id = `pf-${++fieldSeq}`;
  if (target) target.id = id;
  f.appendChild(el("label", { for: id }, labelHtml));
  if (target) f.appendChild(target);
  rest.forEach((x) => x && f.appendChild(x));
  return f;
}
export function grouped(labelHtml, groupNode) {
  const f = el("div", { class: "field" });
  f.appendChild(el("span", { class: "cap" }, labelHtml));
  groupNode.setAttribute("role", "group");
  groupNode.setAttribute("aria-label", String(labelHtml).replace(/<[^>]*>/g, "").trim());
  f.appendChild(groupNode);
  return f;
}

export function dropzone({ accept, multiple, label, onFiles }) {
  const input = el("input", { type: "file", accept, class: "sr", ...(multiple ? { multiple: "" } : {}) });
  input.addEventListener("change", () => { if (input.files.length) onFiles([...input.files]); input.value = ""; });
  const dz = el("label", { class: "drop" },
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

export function fileChip(file, { onRemove, draggable, onUp, onDown } = {}) {
  const chip = el("div", { class: "file", ...(draggable ? { draggable: "true" } : {}) },
    `${draggable ? `<span class="drag-h">${I.grip}</span>` : ""}
     <span class="fi">${I.file}</span>
     <span class="meta"><span class="name" title="${escapeAttr(file.name)}">${file.name}</span><span class="sub">${fmtBytes(file.size)}</span></span>`);
  if (onUp || onDown) {
    const nav = el("div", { class: "chip-nav" });
    nav.appendChild(el("button", { class: "cx", type: "button", "aria-label": `Move ${file.name} up`,
      ...(onUp ? {} : { disabled: "" }), onclick: onUp || (() => {}) }, "▲"));
    nav.appendChild(el("button", { class: "cx", type: "button", "aria-label": `Move ${file.name} down`,
      ...(onDown ? {} : { disabled: "" }), onclick: onDown || (() => {}) }, "▼"));
    chip.appendChild(nav);
  }
  if (onRemove) {
    const x = el("button", { class: "x", type: "button", "aria-label": "Remove", onclick: onRemove }, I.x);
    chip.appendChild(x);
  }
  return chip;
}

export function runButton(label, opts) {
  const free = !!(opts && opts.free);
  const b = el("button", { class: "run", type: "button", ...(free ? {} : { "data-needs-engine": "1" }) },
    `${I.run}<span>${label}</span>`);
  b.baseLabel = label;
  if (!free && !isEngineReady()) b.disabled = true;
  b.setBusy = (busy, text) => {
    b.disabled = busy || (!free && !isEngineReady());
    b.innerHTML = busy ? `<span class="spin">${I.spin}</span><span>${text || "Working…"}</span>`
                       : `${I.run}<span>${b.baseLabel}</span>`;
  };
  b.setIdle = () => b.setBusy(false);
  return b;
}

export function alertBox(msg) { return el("div", { class: "alert" }, `${I.alert}<div>${escapeHtml(msg)}</div>`); }
export function placeholder(text, sub) {
  return el("div", { class: "placeholder" }, `${I.empty}<span class="pt">${escapeHtml(text || "")}</span><span class="ps">${escapeHtml(sub || "")}</span>`);
}
export function outColumn(title, actions) {
  const col = el("div");
  const head = el("div", { class: "panel-title" }, `<span>${escapeHtml(title || "Result")}</span>`);
  if (actions) head.appendChild(actions);
  col.appendChild(head);
  const body = el("div"); col.appendChild(body);
  col.body = body;
  return col;
}

export function withBusy(btn, msg, fn) {
  if (btn && btn.setBusy) btn.setBusy(true, msg);
  setRuntime("busy", msg);
  return Promise.resolve().then(fn).finally(() => {
    if (btn && btn.setBusy) btn.setBusy(false);
    if (isEngineReady()) setRuntime("ready", "ready · on-device");
  });
}

export async function runBatch({ files, btn, each, nameOf }) {
  const JSZip = await ensureJSZip();
  const zip = new JSZip();
  let bytesTotal = 0;
  for (let i = 0; i < files.length; i++) {
    if (btn && btn.setBusy) btn.setBusy(true, `file ${i + 1} / ${files.length} — ${files[i].name}`);
    const bytes = await each(files[i], (msg) => btn && btn.setBusy && btn.setBusy(true, `(${i + 1}/${files.length}) ${msg}`));
    bytesTotal += bytes.byteLength || bytes.size || 0;
    zip.file(nameOf(files[i]), bytes);
  }
  return { blob: await zip.generateAsync({ type: "blob" }), bytesTotal };
}

export function resultCard({ bytes, name, mime, stats, message }) {
  const card = el("div", { class: "result" });
  card.appendChild(el("div", { class: "ok-ring" }, I.check));
  card.appendChild(el("h4", {}, "Done — on your machine"));
  if (message) card.appendChild(el("p", { class: "engine-hint", style: "margin:10px 0 0" }, escapeHtml(message)));
  if (stats && stats.length) {
    const row = el("div", { class: "stat-row" });
    stats.forEach(([k, v, hi]) => row.appendChild(el("div", { class: "stat" + (hi ? " hi" : "") }, `<div class="k">${escapeHtml(String(k))}</div><div class="v">${escapeHtml(String(v))}</div>`)));
    card.appendChild(row);
  }
  card.appendChild(el("button", { class: "btn-dl", type: "button", onclick: () => download(bytes, name, mime) }, `${I.dl} Download ${escapeHtml(name)}`));
  return card;
}

export function showError(container, err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (container && container.querySelector) {
    const existing = container.querySelector(".alert"); if (existing) existing.remove();
  }
  if (container) container.appendChild(alertBox(msg));
}

export function renderToolHead(t) {
  const local = t.badge === "PYTHON" || t.badge === "IN-BROWSER" || t.badge === "QPDF";
  return el("div", { class: "tool-head" },
    `<div><h2>${escapeHtml(t.name)}</h2><p>${escapeHtml(t.desc)}</p></div>
     <span class="badge ${local ? "local" : ""}">${escapeHtml(t.badge)}</span>`);
}

/* ---- createWorkspace: single owner of state + reset rules --------------- */
export function createWorkspace(root, spec = {}) {
  const s = {
    multiple: false, reorder: false, min: null, resultTitle: "Result",
    emptyTitle: "Nothing yet", emptyHint: "Load a file and run it.",
    runLabel: "Run", runBusy: "Working…", free: false, withActions: false,
    custom: false, // if true, caller builds UI; workspace still owns state/reset
    ...spec,
  };

  const state = { files: [], options: {}, running: false, result: null, error: null };
  let grid, left, right, actions, btn;

  // Reset rules live in exactly one place.
  function clearOutput() {
    state.result = null;
    state.error = null;
    if (!s.custom) renderResultPanel();
  }

  function setFiles(next, { rerender = true } = {}) {
    state.files = Array.isArray(next) ? next.slice() : [];
    clearOutput();
    if (rerender && !s.custom) renderLeft();
  }
  function addFiles(picked) {
    state.files = s.multiple ? state.files.concat(picked) : [picked[0]];
    clearOutput();
    if (!s.custom) renderLeft();
  }
  function removeFile(idx) {
    state.files.splice(idx, 1);
    clearOutput();
    if (!s.custom) renderLeft();
  }
  function moveFile(from, to) {
    const [m] = state.files.splice(from, 1);
    state.files.splice(to, 0, m);
    clearOutput();
    if (!s.custom) renderLeft();
  }
  function setOption(key, value) {
    state.options[key] = value;
    // options changes don't auto-clear by mandate except via run; callers may clear explicitly if needed
  }
  function setRunning(running, msg) {
    state.running = !!running;
    if (state.running) {
      // starting a run clears the previous result (mandated)
      state.result = null;
      state.error = null;
      if (!s.custom) renderResultPanel();
      if (btn) btn.setBusy(true, msg || s.runBusy);
      setRuntime("busy", msg || s.runBusy);
    } else {
      if (btn) btn.setBusy(false);
      if (isEngineReady()) setRuntime("ready", "ready · on-device");
    }
  }
  function setResult(result) {
    state.running = false;
    state.error = null; // never leave stale error with success
    state.result = result;
    if (btn) btn.setBusy(false);
    if (isEngineReady()) setRuntime("ready", "ready · on-device");
    if (!s.custom) renderResultPanel();
  }
  function setError(err) {
    state.running = false;
    state.result = null; // validation/runtime errors never leave stale success visible
    state.error = err instanceof Error ? err.message : String(err || "Something went wrong.");
    if (btn) btn.setBusy(false);
    if (isEngineReady()) setRuntime("ready", "ready · on-device");
    if (!s.custom) renderResultPanel();
  }

  function renderResultPanel() {
    if (!right) return;
    if (actions) actions.innerHTML = "";
    right.body.innerHTML = "";
    if (state.error) {
      showError(right.body, state.error);
      if (s.onErrorRender) s.onErrorRender(api);
      return;
    }
    if (state.result !== null && state.result !== undefined) {
      const res = state.result;
      if (res instanceof Node) right.body.appendChild(res);
      else if (typeof res === "object" && typeof res.text === "string" && !res.bytes && !res.blob) {
        right.body.appendChild(el("div", { class: "text-out" }, escapeHtml(res.text)));
      } else if (typeof res === "object" && (res.bytes || res.blob)) {
        right.body.appendChild(resultCard(res));
      } else if (s.renderResult) {
        s.renderResult(api, res);
      }
      return;
    }
    right.body.appendChild(placeholder(s.emptyTitle, s.emptyHint));
  }

  function renderFileList() {
    if (!state.files.length) return null;
    const list = el("div", { class: "files" });
    let dragIdx = null;
    state.files.forEach((f, i) => {
      const chip = fileChip(f, {
        draggable: s.reorder,
        onRemove: () => removeFile(i),
        onUp: s.reorder && i > 0 ? () => moveFile(i, i - 1) : null,
        onDown: s.reorder && i < state.files.length - 1 ? () => moveFile(i, i + 1) : null,
      });
      if (s.reorder) {
        chip.addEventListener("dragstart", () => { dragIdx = i; chip.classList.add("dragging"); });
        chip.addEventListener("dragend", () => chip.classList.remove("dragging"));
        chip.addEventListener("dragover", (e) => e.preventDefault());
        chip.addEventListener("drop", (e) => {
          e.preventDefault();
          if (dragIdx === null || dragIdx === i) return;
          const from = dragIdx; dragIdx = null; moveFile(from, i);
        });
      }
      list.appendChild(chip);
    });
    return list;
  }

  let dz = null;
  function renderLeft() {
    if (s.custom || !left) return;
    left.innerHTML = "";
    if (dz) left.appendChild(dz);
    const list = renderFileList();
    if (list) left.appendChild(list);
    const hasFileOrNoInput = !dz || state.files.length > 0;
    if (!hasFileOrNoInput) { return; } // nothing to configure until a file is in
    if (s.fields) {
      [].concat(s.fields(api) || []).flat().filter(Boolean).forEach((nd) => left.appendChild(nd));
    }
    left.appendChild(btn);
    if (s.after) {
      [].concat(s.after(api) || []).flat().filter(Boolean).forEach((nd) => left.appendChild(nd));
    }
  }

  const api = {
    root, state, get files() { return state.files; }, get options() { return state.options; },
    left, right, actions, btn,
    clearOutput, setFiles, addFiles, removeFile, moveFile, setOption,
    setRunning, setResult, setError,
    renderLeft, renderResultPanel, renderFileList,
    dropzone, fileChip, runButton, alertBox, placeholder, outColumn, resultCard, showError, withBusy, runBatch, engineHint,
    readBuf, stem, fmtBytes, download, el,
  };

  if (s.custom) {
    api.reset = () => { clearOutput(); setFiles([], { rerender: false }); };
    return api;
  }

  grid = el("div", { class: "grid2" });
  left = el("div");
  actions = s.withActions ? el("div", { class: "tool-actions" }) : null;
  right = outColumn(s.resultTitle, actions);
  btn = runButton(s.runLabel, { free: s.free });
  api.left = left; api.right = right; api.actions = actions; api.btn = btn;

  if (s.accept !== null && s.accept !== undefined) {
    dz = dropzone({
      accept: s.accept, multiple: s.multiple, label: s.dropLabel,
      onFiles: (picked) => {
        addFiles(picked);
        if (s.onFiles) Promise.resolve(s.onFiles(api)).then(() => { if (!s.custom) renderLeft(); }).catch(() => {});
        else if (!s.custom) renderLeft();
      },
    });
  } else {
    dz = null;
  }

  btn.addEventListener("click", async () => {
    const need = s.min == null ? (dz ? 1 : 0) : s.min;
    if (state.files.length < need) {
      if (need > 1) setError(s.minMsg || `Add at least ${need} files.`);
      return;
    }
    setRunning(true, s.runBusy);
    try {
      const out = await s.run(api);
      if (out !== undefined) setResult(out);
      else {
        // renderer painted itself; still end running and clear stale success if none set
        state.running = false;
        if (btn) btn.setBusy(false);
        if (isEngineReady()) setRuntime("ready", "ready · on-device");
      }
    } catch (err) {
      setError(err);
    }
  });

  renderResultPanel();
  renderLeft();
  grid.append(left, right);
  root.appendChild(grid);
  return api;
}
