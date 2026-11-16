import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, dropzone, fileChip, runButton, resultCard, showError, withBusy, alertBox, placeholder } from "../workspace.js";
import { callEngine, ensurePdfjs } from "../bridge.js";

export function registerOrganize(ENGINES) {
  ENGINES.organize = (tool, root) => {
    const api = createWorkspace(root, { custom: true });
    const wrap = el("div");
    const left = el("div");
    let file = null, thumbs = [], pdfDoc = null;

    const dz = dropzone({ accept: ".pdf", label: "Drop a PDF to organize its pages",
      onFiles: (f) => loadDoc(f[0]) });
    left.appendChild(dz);
    wrap.appendChild(left);
    root.appendChild(wrap);

    async function loadDoc(f) {
      api.clearOutput();
      file = f; thumbs = []; pdfDoc = null;
      left.innerHTML = "";
      left.appendChild(el("div", { class: "progress" }, `<div class="plog"><span class="dim">rendering thumbnails…</span></div><div class="bar indeterminate"><i></i></div>`));
      try {
        const pdfjs = await ensurePdfjs();
        const data = new Uint8Array(await readBuf(f));
        pdfDoc = await pdfjs.getDocument({ data }).promise;
        thumbs = Array.from({ length: pdfDoc.numPages }, (_, i) => ({ src: i, rot: 0 }));
        await renderBoard();
      } catch (err) {
        left.innerHTML = ""; left.appendChild(dz); left.appendChild(alertBox("Couldn't open this PDF: " + err.message));
      }
    }

    async function renderBoard() {
      left.innerHTML = "";
      const bar = el("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap" });
      bar.appendChild(el("div", { class: "eyebrow" }, `${thumbs.length} page${thumbs.length === 1 ? "" : "s"} · drag to reorder`));
      const btn = runButton("Save PDF", { free: false });
      btn.style.marginTop = "0"; btn.style.width = "auto";
      btn.setBusy(true, "Rendering pages…");
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
        const shift = (to) => { api.clearOutput(); const [m] = thumbs.splice(i, 1); thumbs.splice(to, 0, m); renderBoard(); };
        ctl.appendChild(el("button", { type: "button", title: "Move earlier", "aria-label": `Move page ${i + 1} earlier`,
          ...(i > 0 ? {} : { disabled: "" }), onclick: () => shift(i - 1) }, "◀"));
        ctl.appendChild(el("button", { type: "button", title: "Move later", "aria-label": `Move page ${i + 1} later`,
          ...(i < thumbs.length - 1 ? {} : { disabled: "" }), onclick: () => shift(i + 1) }, "▶"));
        ctl.appendChild(el("button", { type: "button", title: "Rotate", "aria-label": `Rotate page ${i + 1}`, onclick: () => { api.clearOutput(); t.rot = (t.rot + 90) % 360; paint(cell.querySelector("canvas"), t.rot); } }, I.rot));
        ctl.appendChild(el("button", { class: "del", type: "button", title: "Remove", "aria-label": `Remove page ${i + 1}`, onclick: () => { api.clearOutput(); thumbs.splice(i, 1); renderBoard(); } }, I.trash));
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
        cell.addEventListener("drop", (e) => {
          e.preventDefault(); if (dragIdx === null || dragIdx === i) return;
          api.clearOutput();
          const [m] = thumbs.splice(dragIdx, 1); thumbs.splice(i, 0, m); dragIdx = null; renderBoard();
        });
      }

      btn.setBusy(false);
      btn.addEventListener("click", async () => {
        if (!thumbs.length) { api.setError("Keep at least one page."); left.appendChild(alertBox("Keep at least one page.")); return; }
        api.setRunning(true, "Saving…");
        try {
          const order = thumbs.map((t) => ({ src: t.src, rot: t.rot }));
          const res = await callEngine("organize", { order }, [await readBuf(file)]);
          const result = { bytes: res.bytes, name: `${stem(file.name)}_organized.pdf`, mime: MIME.pdf,
            stats: [["Pages", thumbs.length], ["Output", fmtBytes(res.bytes.byteLength)]] };
          api.setResult(result);
          const dl = el("div", { style: "margin-top:16px" });
          dl.appendChild(resultCard(result));
          left.appendChild(dl); dl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (err) {
          api.setError(err);
          const container = el("div", { style: "margin-top:16px" });
          showError(container, err);
          left.appendChild(container);
        }
      });
    }

    function paint(canvas, rot) { canvas.style.transform = `rotate(${rot}deg)`; }
    return api;
  };
}
