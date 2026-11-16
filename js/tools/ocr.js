import { el, stem, readBuf, escapeHtml } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, dropzone, fileChip, runButton, outColumn, placeholder, showError, labelled } from "../workspace.js";
import { ensurePdfjs, ensureTesseract, callEngine, setRuntime, isEngineReady } from "../bridge.js";

export function registerOcr(ENGINES) {
  ENGINES.ocr = (tool, root) => {
    const api = createWorkspace(root, { custom: true });
    const grid = el("div", { class: "grid2" });
    const left = el("div");
    const actions = el("div", { class: "tool-actions" });
    const right = outColumn("Recognized text", actions);
    right.body.appendChild(placeholder("No text yet", "Load a scanned PDF and run OCR."));
    let file = null, lang = "eng", text = "", pagesData = [];

    const copyBtn = el("button", { class: "tbtn", type: "button", onclick: () => { navigator.clipboard.writeText(text); } }, `${I.copy} Copy`);
    const dlBtn = el("button", { class: "tbtn", type: "button", onclick: () => {
      const blob = new Blob([text], { type: MIME.txt });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = (file ? stem(file.name) : "ocr") + ".txt";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    } }, `${I.dl} .txt`);

    const dz = dropzone({ accept: ".pdf", label: "Drop a scanned PDF or click to browse",
      onFiles: (f) => { file = f[0]; text = ""; pagesData = []; actions.innerHTML = ""; api.clearOutput(); right.body.innerHTML = ""; right.body.appendChild(placeholder("No text yet", "Load a scanned PDF and run OCR.")); renderLeft(); } });
    const btn = runButton("Run OCR");
    const prog = el("div", { class: "progress", style: "display:none" }, `<div class="plog"></div><div class="bar"><i></i></div>`);

    btn.addEventListener("click", async () => {
      if (!file) return;
      prog.style.display = ""; const log = prog.querySelector(".plog"), bar = prog.querySelector(".bar > i");
      log.innerHTML = "";
      const put = (m) => { log.appendChild(el("div", {}, "› " + m)); log.scrollTop = log.scrollHeight; };
      btn.setBusy(true, "Reading…"); setRuntime("busy", "running OCR on-device…");
      text = ""; pagesData = []; actions.innerHTML = ""; right.body.innerHTML = "";
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
          const { data: rec } = await Tesseract.recognize(c, lang, {
            logger: (mm) => { if (mm.status === "recognizing text") bar.style.width = Math.round(mm.progress * 100) + "%"; },
          });
          const t = rec.text;
          pagesData.push({ scale: 2, words: (rec.words || []).filter((w) => w.text && w.text.trim()).map((w) => ({
            t: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })) });
          text += `--- Page ${i} ---\n${(t || "").trim()}\n\n`;
          right.body.innerHTML = ""; right.body.appendChild(el("div", { class: "text-out" }, escapeHtml(text)));
          actions.innerHTML = ""; actions.append(copyBtn, dlBtn);
        }
        put("done.");
        const sBtn = el("button", { class: "tbtn", type: "button", onclick: async () => {
          try {
            sBtn.disabled = true;
            const res = await callEngine("ocrOverlay", { pages: pagesData }, [await readBuf(file)]);
            const blob = new Blob([res.bytes], { type: MIME.pdf });
            const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = stem(file.name) + "_searchable.pdf";
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
          } catch (err) { showError(right.body, err); }
          finally { sBtn.disabled = false; }
        } }, `${I.dl} Searchable PDF`);
        actions.appendChild(sBtn);
      } catch (err) { showError(right.body, err); }
      finally { btn.setBusy(false); prog.style.display = "none"; if (isEngineReady()) setRuntime("ready", "ready · on-device"); }
    });

    function renderLeft() {
      left.innerHTML = ""; left.appendChild(dz);
      if (file) {
        const files = el("div", { class: "files" });
        files.appendChild(fileChip(file, { onRemove: () => { file = null; text = ""; pagesData = []; actions.innerHTML = ""; api.clearOutput(); right.body.innerHTML = ""; right.body.appendChild(placeholder("No text yet", "Load a scanned PDF and run OCR.")); renderLeft(); } }));
        left.appendChild(files);
        const sel = el("select", { class: "input", onchange: (e) => { lang = e.target.value; api.clearOutput(); } },
          `<option value="eng">English</option><option value="hin" lang="hi">हिन्दी Hindi</option><option value="eng+hin">English + Hindi</option><option value="spa">Spanish</option><option value="fra">French</option><option value="deu">German</option><option value="ita">Italian</option><option value="por">Portuguese</option>`);
        sel.value = lang;
        left.appendChild(labelled("Document language", sel));
        left.appendChild(btn); left.appendChild(prog);
      }
    }
    renderLeft();
    grid.append(left, right); root.appendChild(grid);
    return api;
  };
    }
