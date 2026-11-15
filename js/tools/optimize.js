import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { MIME } from "../icons.js";
import { createWorkspace, labelled, grouped, engineHint } from "../workspace.js";
import { callEngine, engineOk, engineMarkOk, requestPersistence, ensureJSZip } from "../bridge.js";
import { registerQpdf } from "./qpdf-tools.js";

export function registerOptimize(ENGINES) {
  // linearize uses qpdf engine (shared)
  registerQpdf(ENGINES);

  ENGINES.compress = (tool, root) => {
    let quality = 65;
    const levels = [
      { t: "Level 4", n: "Maximum", d: "Downsample images to ~110 DPI (engine ~17 MB, first use)", v: "max" },
      { t: "Level 3", n: "Strong", d: "Smaller, lighter images", v: 40 },
      { t: "Level 2", n: "Balanced", d: "Recommended", v: 65 },
      { t: "Level 1", n: "Light", d: "Best quality", v: 85 },
    ];
    const needsEngine = () => quality === "max" && !engineOk("compress-max");
    return createWorkspace(root, {
      accept: ".pdf", multiple: true, dropLabel: "Drop PDFs or click to browse",
      emptyHint: "Load a PDF and pick a level.",
      runLabel: "Compress", runBusy: "Compressing…",
      fields: ({ btn, renderLeft, clearOutput }) => {
        const opts = el("div", { class: "options" });
        levels.forEach((lv) => opts.appendChild(el("button", {
          class: "opt", type: "button", "aria-pressed": String(lv.v === quality),
          onclick: () => { quality = lv.v; clearOutput(); renderLeft(); } },
          `<div class="ot">${lv.t}</div><div class="on">${lv.n}</div><div class="od">${lv.d}</div>`)));
        btn.baseLabel = needsEngine() ? "Download engine (~17 MB) & compress" : "Compress";
        btn.setBusy(false);
        return grouped("Optimization level", opts);
      },
      after: () => (needsEngine() ? engineHint({ mb: 17, label: "downsampling engine (PyMuPDF)" }) : null),
      run: async ({ files, btn }) => {
        const params = quality === "max" ? { mode: "max", dpi: 110, quality: 60 } : { quality };
        if (quality === "max") requestPersistence();
        const savedLabel = (before, after) => {
          const pct = (1 - after / before) * 100;
          if (pct >= 1) return Math.round(pct) + "%";
          if (pct > 0) return "<1%";
          return "0%";
        };
        if (files.length === 1) {
          const res = await callEngine("compress", params, [await readBuf(files[0])], (msg) => btn.setBusy(true, msg));
          const out = res.bytes, before = files[0].size, after = out.byteLength;
          const name = `${stem(files[0].name)}_compressed.pdf`;
          if (quality === "max") { engineMarkOk("compress-max"); btn.baseLabel = "Compress"; }
          if (after >= before) {
            return { bytes: out, name, mime: MIME.pdf,
                     message: "This file can't be compressed further at this level. Original kept.",
                     stats: [["Before", fmtBytes(before)], ["After", fmtBytes(after)]] };
          }
          return { bytes: out, name, mime: MIME.pdf,
                   stats: [["Before", fmtBytes(before)], ["Saved", savedLabel(before, after), true], ["After", fmtBytes(after)]] };
        } else {
          const JSZip = await ensureJSZip();
          const zip = new JSZip();
          let before = 0, pdfBytes = 0, unchanged = 0;
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const label = f.name.length > 34 ? "…" + f.name.slice(-32) : f.name;
            const note = (m) => btn.setBusy(true, files.length > 1 ? `[${i + 1}/${files.length}] ${label} — ${m}` : m);
            note("starting…");
            const bytes = (await callEngine("compress", { ...params }, [await readBuf(f)], note)).bytes;
            before += f.size;
            pdfBytes += bytes.byteLength || bytes.size || 0;
            if ((bytes.byteLength || bytes.size || 0) >= f.size) unchanged++;
            zip.file(`${stem(f.name)}_compressed.pdf`, bytes);
          }
          const out = await zip.generateAsync({ type: "blob" });
          if (quality === "max") { engineMarkOk("compress-max"); btn.baseLabel = "Compress"; }
          const stats = [["Files", files.length], ["Before", fmtBytes(before)]];
          if (unchanged) stats.push(["Unchanged", unchanged]);
          if (pdfBytes < before) stats.push(["Saved", savedLabel(before, pdfBytes), true]);
          stats.push(["After", fmtBytes(pdfBytes)]);
          const res = { bytes: out, name: "compressed_batch.zip", mime: MIME.zip, stats };
          if (unchanged === files.length) res.message = "This file can't be compressed further at this level. Original kept.";
          return res;
        }
      },
    });
  };
}
