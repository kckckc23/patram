import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, dropzone, fileChip, runButton, placeholder, showError, outColumn } from "../workspace.js";
import { ensurePdfjs, ensureJSZip, setRuntime, engineReady } from "../bridge.js";

export function registerPdfImages(ENGINES) {
  ENGINES.pdf2img = (tool, root) => {
    const api = createWorkspace(root, { custom: true });
    const grid = el("div", { class: "grid2" });
    const left = el("div"), right = outColumn("Pages");
    right.body.appendChild(placeholder("No images yet", "Load a PDF to render each page."));
    let file = null, pages = []; // {blob,name,url}
    const dz = dropzone({ accept: ".pdf", label: "Drop a PDF or click to browse",
      onFiles: (f) => { file = f[0]; releasePages(); api.clearOutput(); right.body.innerHTML = ""; right.body.appendChild(placeholder("No images yet", "Load a PDF to render each page.")); renderLeft(); } });
    const btn = runButton("Render pages");
    const prog = el("div", { class: "progress", style: "display:none" }, `<div class="plog"></div><div class="bar"><i></i></div>`);

    const releasePages = () => { pages.forEach((p) => URL.revokeObjectURL(p.url)); pages = []; };

    btn.addEventListener("click", async () => {
      if (!file) return;
      api.clearOutput();
      prog.style.display = ""; const log = prog.querySelector(".plog"), bar = prog.querySelector(".bar > i");
      log.innerHTML = "";
      const put = (m) => { log.appendChild(el("div", {}, "› " + m)); log.scrollTop = log.scrollHeight; };
      btn.setBusy(true, "Rendering…"); setRuntime("busy", "rendering pages…");
      releasePages();
      try {
        const pdfjs = await ensurePdfjs();
        put("opening document…");
        const data = new Uint8Array(await readBuf(file));
        const doc = await pdfjs.getDocument({ data }).promise;
        for (let i = 1; i <= doc.numPages; i++) {
          put(`page ${i} / ${doc.numPages}`); bar.style.width = Math.round((i / doc.numPages) * 100) + "%";
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const c = el("canvas"); c.width = vp.width; c.height = vp.height;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
          pages.push({ blob, name: `${stem(file.name)}_page_${String(i).padStart(3, "0")}.jpg`, url: URL.createObjectURL(blob) });
          c.width = 0; c.height = 0;
        }
        put("done.");
        renderResult();
      } catch (err) {
        right.body.innerHTML = "";
        showError(right.body, err);
      }
      finally { btn.setBusy(false); prog.style.display = "none"; if (engineReady) setRuntime("ready", "ready · on-device"); }
    });

    function renderResult() {
      right.body.innerHTML = "";
      const total = pages.reduce((n, p) => n + p.blob.size, 0);
      right.body.appendChild(el("p", { class: "engine-hint" },
        `${I.check} ${pages.length} page${pages.length === 1 ? "" : "s"} rendered · ${fmtBytes(total)} — download the whole set, or just the pages you want.`));

      const zipBtn = el("button", { class: "btn-dl", type: "button", style: "margin-top:12px" },
        `${I.dl} Download all as zip`);
      zipBtn.addEventListener("click", async () => {
        const label = zipBtn.innerHTML;
        zipBtn.disabled = true; zipBtn.innerHTML = `<span class="spin">${I.spin}</span>packing zip…`;
        try {
          const JSZip = await ensureJSZip();
          const zip = new JSZip();
          pages.forEach((p) => zip.file(p.name, p.blob));
          const blob = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `${stem(file.name)}_images.zip`;
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch (err) { showError(right.body, err); }
        finally { zipBtn.disabled = false; zipBtn.innerHTML = label; }
      });
      right.body.appendChild(zipBtn);

      const eachBtn = el("button", { class: "btn-dl", type: "button", style: "margin-top:8px" },
        `${I.dl} Save all ${pages.length} separately`);
      eachBtn.addEventListener("click", async () => {
        eachBtn.disabled = true;
        for (const p of pages) {
          const url = URL.createObjectURL(p.blob);
          const a = document.createElement("a"); a.href = url; a.download = p.name;
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
          await new Promise((r) => setTimeout(r, 150));
        }
        eachBtn.disabled = false;
      });
      right.body.appendChild(eachBtn);
      if (pages.length > 5)
        right.body.appendChild(el("p", { class: "engine-hint" },
          `${I.alert} Saving ${pages.length} files separately — your browser will ask once to allow multiple downloads.`));

      const gal = el("div", { class: "gallery", style: "margin-top:14px" });
      pages.forEach((p, i) => {
        const fig = el("figure", {}, `<img src="${p.url}" alt="Page ${i + 1}" loading="lazy">`);
        fig.appendChild(el("button", { class: "gdl", type: "button", title: `Download page ${i + 1}`,
          "aria-label": `Download page ${i + 1}`, onclick: () => {
            const url = URL.createObjectURL(p.blob); const a = document.createElement("a"); a.href = url; a.download = p.name;
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
          } }, I.dl));
        fig.appendChild(el("figcaption", {}, `page ${i + 1} · ${fmtBytes(p.blob.size)}`));
        gal.appendChild(fig);
      });
      right.body.appendChild(gal);
    }

    function renderLeft() {
      left.innerHTML = ""; left.appendChild(dz);
      if (file) {
        const files = el("div", { class: "files" });
        files.appendChild(fileChip(file, { onRemove: () => { file = null; releasePages(); api.clearOutput(); right.body.innerHTML = ""; right.body.appendChild(placeholder("No images yet", "Load a PDF to render each page.")); renderLeft(); } }));
        left.appendChild(files); left.appendChild(btn); left.appendChild(prog);
      }
    }
    renderLeft();
    grid.append(left, right); root.appendChild(grid);
    return api;
  };
}
