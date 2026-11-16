import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, dropzone, runButton, resultCard, showError, alertBox } from "../workspace.js";
import { callEngine, ensurePdfjs } from "../bridge.js";

export function registerImagePlace(ENGINES) {
  ENGINES.imgOnPdf = (tool, root) => {
    const api = createWorkspace(root, { custom: true });
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const wrap = el("div");
    root.appendChild(wrap);

    let file = null, pdfDoc = null, pageIdx = 0, numPages = 0;
    const imgs = [];      // {file, url, natW, natH}
    let placements = [];   // {img, page, x, y, w, h}

    const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
      onFiles: (f) => loadDoc(f[0]) });
    wrap.appendChild(dz);

    const imgInput = el("input", { type: "file", accept: "image/*", multiple: "", class: "sr", "aria-label": "Choose an image to place on the page" });
    imgInput.addEventListener("change", async () => {
      const picked = [...imgInput.files]; imgInput.value = "";
      for (const f of picked) {
        try { placeAt(await addImage(f), 0.5, 0.5); }
        catch (err) { if (stageWrap) showError(stageWrap, err); }
      }
    });

    let stageWrap = null, stageEl = null, canvasEl = null, pageLabel = null, resultSlot = null;

    async function loadDoc(f) {
      api.clearOutput();
      file = f;
      wrap.innerHTML = "";
      wrap.appendChild(el("div", { class: "progress" },
        `<div class="plog"><span class="dim">opening document…</span></div><div class="bar indeterminate"><i></i></div>`));
      try {
        const pdfjs = await ensurePdfjs();
        const data = new Uint8Array(await readBuf(f));
        pdfDoc = await pdfjs.getDocument({ data }).promise;
        numPages = pdfDoc.numPages; pageIdx = 0; placements = [];
        buildEditor();
        await renderPage();
      } catch (err) {
        wrap.innerHTML = ""; wrap.appendChild(dz);
        wrap.appendChild(alertBox("Couldn't open this PDF: " + err.message));
      }
    }

    function buildEditor() {
      wrap.innerHTML = "";
      wrap.appendChild(imgInput);
      const bar = el("div", { class: "editor-bar" });

      const pager = el("div", { class: "pager" });
      const prev = el("button", { class: "tbtn", type: "button", title: "Previous page",
        onclick: () => { if (pageIdx > 0) { pageIdx--; renderPage(); } } }, "‹ Prev");
      const next = el("button", { class: "tbtn", type: "button", title: "Next page",
        onclick: () => { if (pageIdx < numPages - 1) { pageIdx++; renderPage(); } } }, "Next ›");
      pageLabel = el("span", { class: "pager-lbl" }, "");
      pager.append(prev, pageLabel, next);
      bar.appendChild(pager);

      const actions = el("div", { class: "editor-actions" });
      actions.appendChild(el("button", { class: "tbtn", type: "button", onclick: () => imgInput.click() },
        `${I.up} Add image`));
      const saveBtn = runButton("Save PDF");
      saveBtn.style.marginTop = "0"; saveBtn.style.width = "auto";
      actions.appendChild(saveBtn);
      bar.appendChild(actions);
      wrap.appendChild(bar);

      stageWrap = el("div");
      stageEl = el("div", { class: "page-stage" });
      canvasEl = el("canvas");
      stageEl.appendChild(canvasEl);
      stageWrap.appendChild(stageEl);
      wrap.appendChild(stageWrap);

      stageEl.addEventListener("dragover", (e) => { e.preventDefault(); stageEl.classList.add("drag"); });
      stageEl.addEventListener("dragleave", () => stageEl.classList.remove("drag"));
      stageEl.addEventListener("drop", async (e) => {
        e.preventDefault(); stageEl.classList.remove("drag");
        const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length) return;
        const r = stageEl.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width, cy = (e.clientY - r.top) / r.height;
        for (const f of files) {
          try { placeAt(await addImage(f), cx, cy); }
          catch (err) { showError(stageWrap, err); }
        }
      });

      wrap.appendChild(el("p", { class: "engine-hint" },
        `${I.shield} Drag to move, pull the corner to resize (the image keeps its proportions),
         arrow keys nudge a selected image. Add as many as you like, on any page — then Save.`));
      resultSlot = el("div");
      wrap.appendChild(resultSlot);

      saveBtn.addEventListener("click", async () => {
        if (!placements.length) { api.setError("Add an image and place it on a page first."); showError(resultSlot, "Add an image and place it on a page first."); return; }
        api.setRunning(true, "Saving…");
        try {
          const used = [...new Set(placements.map((p) => p.img))];
          const remap = new Map(used.map((old, i) => [old, i]));
          const bufs = [await readBuf(file), ...(await Promise.all(used.map((i) => readBuf(imgs[i].file))))];
          const params = { placements: placements.map((p) => ({ ...p, img: remap.get(p.img) })) };
          const res = await callEngine("placeImages", params, bufs, (msg) => saveBtn.setBusy(true, msg));
          const result = {
            bytes: res.bytes, name: `${stem(file.name)}_image.pdf`, mime: MIME.pdf,
            stats: [["Images", placements.length], ["Output", fmtBytes(res.bytes.byteLength)]],
          };
          api.setResult(result);
          resultSlot.innerHTML = "";
          resultSlot.appendChild(resultCard(result));
          resultSlot.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (err) {
          api.setError(err);
          resultSlot.innerHTML = "";
          showError(resultSlot, err);
        }
      });
    }

    async function renderPage() {
      const page = await pdfDoc.getPage(pageIdx + 1);
      const vp = page.getViewport({ scale: 1.6 });
      canvasEl.width = vp.width; canvasEl.height = vp.height;
      const ctx = canvasEl.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pageLabel.textContent = `page ${pageIdx + 1} / ${numPages}`;
      renderOverlays();
    }

    function addImage(f) {
      const url = URL.createObjectURL(f);
      return new Promise((res, rej) => {
        const probe = new Image();
        probe.onload = () => { imgs.push({ file: f, url, natW: probe.naturalWidth, natH: probe.naturalHeight }); res(imgs.length - 1); };
        probe.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`Couldn't read ${f.name} — try a JPG or PNG.`)); };
        probe.src = url;
      });
    }

    function placeAt(imgIdx, cx, cy) {
      const im = imgs[imgIdx];
      let w = 0.3, h = (w * canvasEl.width) * (im.natH / im.natW) / canvasEl.height;
      if (h > 0.9) { const k = 0.9 / h; w *= k; h *= k; }
      api.clearOutput();
      placements.push({ img: imgIdx, page: pageIdx, w, h,
        x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) });
      renderOverlays();
    }

    function renderOverlays() {
      stageEl.querySelectorAll(".pl").forEach((n) => n.remove());
      placements.forEach((pl) => { if (pl.page === pageIdx) stageEl.appendChild(plNode(pl)); });
    }

    function box(node, pl) {
      node.style.left = pl.x * 100 + "%"; node.style.top = pl.y * 100 + "%";
      node.style.width = pl.w * 100 + "%"; node.style.height = pl.h * 100 + "%";
    }

    function plNode(pl) {
      const node = el("div", { class: "pl", tabindex: "0", role: "group",
        "aria-label": "Placed image — arrow keys to move" },
        `<img src="${imgs[pl.img].url}" alt="">`);
      box(node, pl);
      node.appendChild(el("button", { class: "pl-x", type: "button", title: "Remove",
        "aria-label": "Remove this image",
        onclick: (e) => { e.stopPropagation(); api.clearOutput(); placements.splice(placements.indexOf(pl), 1); renderOverlays(); } }, I.x));
      const handle = el("span", { class: "pl-h", title: "Drag to resize" });
      node.appendChild(handle);

      const grab = (target, mode) => target.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        node.focus();
        const r = stageEl.getBoundingClientRect();
        const s = { mx: e.clientX, my: e.clientY, x: pl.x, y: pl.y, w: pl.w, h: pl.h };
        const ratio = s.h / s.w;
        node.classList.add("active");
        target.setPointerCapture(e.pointerId);
        const onMove = (ev) => {
          const dx = (ev.clientX - s.mx) / r.width, dy = (ev.clientY - s.my) / r.height;
          if (mode === "move") {
            pl.x = clamp(s.x + dx, 0, 1 - pl.w);
            pl.y = clamp(s.y + dy, 0, 1 - pl.h);
          } else {
            let w = clamp(s.w + dx, 0.02, 1 - pl.x), h = w * ratio;
            if (pl.y + h > 1) { h = 1 - pl.y; w = h / ratio; }
            pl.w = w; pl.h = h;
          }
          box(node, pl);
        };
        const onUp = () => {
          target.removeEventListener("pointermove", onMove);
          target.removeEventListener("pointerup", onUp);
          target.removeEventListener("pointercancel", onUp);
          node.classList.remove("active");
          api.clearOutput(); // placement changed
        };
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onUp);
        target.addEventListener("pointercancel", onUp);
      });
      grab(node, "move");
      grab(handle, "size");

      node.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 0.05 : 0.01;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (d) {
          e.preventDefault();
          pl.x = clamp(pl.x + d[0], 0, 1 - pl.w); pl.y = clamp(pl.y + d[1], 0, 1 - pl.h);
          box(node, pl);
          api.clearOutput();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault(); api.clearOutput(); placements.splice(placements.indexOf(pl), 1); renderOverlays();
        }
      });
      return node;
    }

    return api;
  };
}
