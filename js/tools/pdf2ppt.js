import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, dropzone, fileChip, runButton, outColumn, placeholder, showError, resultCard } from "../workspace.js";
import { ensurePdfjs, callEngine, setRuntime, engineReady } from "../bridge.js";

export function registerPdf2Ppt(ENGINES) {
  ENGINES.pdf2ppt = (tool, root) => {
    const api = createWorkspace(root, { custom: true });
    const grid = el("div", { class: "grid2" });
    const left = el("div"), right = outColumn("Result");
    right.body.appendChild(placeholder("Nothing yet", "Load a PDF to turn its pages into slides."));
    let file = null;
    const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
      onFiles: (f) => { file = f[0]; api.clearOutput(); right.body.innerHTML = ""; right.body.appendChild(placeholder("Nothing yet", "Load a PDF to turn its pages into slides.")); renderLeft(); } });
    const btn = runButton("Convert to slides");
    const prog = el("div", { class: "progress", style: "display:none" }, `<div class="plog"></div><div class="bar"><i></i></div>`);

    btn.addEventListener("click", async () => {
      if (!file) return;
      api.clearOutput();
      prog.style.display = ""; const log = prog.querySelector(".plog"), bar = prog.querySelector(".bar > i");
      log.innerHTML = "";
      const put = (m) => { log.appendChild(el("div", {}, "› " + m)); log.scrollTop = log.scrollHeight; };
      try {
        btn.setBusy(true, "Rendering pages…"); setRuntime("busy", "Rendering pages…");
        const pdfjs = await ensurePdfjs();
        const data = new Uint8Array(await readBuf(file));
        const doc = await pdfjs.getDocument({ data }).promise;
        const one = (await doc.getPage(1)).getViewport({ scale: 1 });
        const scale = Math.min(2, 1600 / Math.max(one.width, one.height));
        const bufs = [];
        for (let i = 1; i <= doc.numPages; i++) {
          put(`page ${i} / ${doc.numPages}`); bar.style.width = Math.round((i / doc.numPages) * 100) + "%";
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale });
          const c = el("canvas"); c.width = vp.width; c.height = vp.height;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
          bufs.push(await blob.arrayBuffer());
          c.width = 0; c.height = 0;
        }
        put("building presentation…");
        const res = await callEngine("imagesToPpt", { w: one.width, h: one.height }, bufs,
          (msg) => btn.setBusy(true, msg));
        const result = { bytes: res.bytes, name: `${stem(file.name)}.pptx`, mime: MIME.pptx,
          stats: [["Slides", doc.numPages], ["Output", fmtBytes(res.bytes.byteLength)]] };
        right.body.innerHTML = "";
        right.body.appendChild(resultCard(result));
      } catch (err) { right.body.innerHTML = ""; showError(right.body, err); }
      finally { btn.setBusy(false); prog.style.display = "none"; if (engineReady) setRuntime("ready", "ready · on-device"); }
    });

    const alt = el("button", { class: "tbtn", type: "button", style: "margin-top:10px" },
      `${I.doc} Editable text instead (loses layout)`);
    alt.addEventListener("click", async () => {
      if (!file) return;
      api.clearOutput();
      try {
        btn.setBusy(true, "Extracting text…"); setRuntime("busy", "Extracting text…");
        const res = await callEngine("pdfToPpt", {}, [await readBuf(file)]);
        const result = { bytes: res.bytes, name: `${stem(file.name)}_text.pptx`, mime: MIME.pptx,
          stats: [["Output", fmtBytes(res.bytes.byteLength)]] };
        right.body.innerHTML = "";
        right.body.appendChild(resultCard(result));
      } catch (err) { right.body.innerHTML = ""; showError(right.body, err); }
      finally { btn.setBusy(false); if (engineReady) setRuntime("ready", "ready · on-device"); }
    });

    function renderLeft() {
      left.innerHTML = ""; left.appendChild(dz);
      if (file) {
        const files = el("div", { class: "files" });
        files.appendChild(fileChip(file, { onRemove: () => { file = null; api.clearOutput(); right.body.innerHTML = ""; right.body.appendChild(placeholder("Nothing yet", "Load a PDF to turn its pages into slides.")); renderLeft(); } }));
        left.appendChild(files);
        left.appendChild(btn); left.appendChild(alt); left.appendChild(prog);
      }
    }
    renderLeft();
    grid.append(left, right); root.appendChild(grid);
    return api;
  };
}
