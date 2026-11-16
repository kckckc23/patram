import { el, stem, fmtBytes, readBuf, escapeHtml } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, labelled, withBusy, engineHint, resultCard } from "../workspace.js";
import { callEngine, engineOk, engineMarkOk, requestPersistence, ensureJSZip, ensureMammoth } from "../bridge.js";

async function printDocxView(file) {
  const mammoth = await ensureMammoth();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const frame = el("iframe", { style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(stem(file.name))}</title><style>
    @page { margin: 2cm; }
    body { font: 12pt/1.5 "Carlito", "Calibri", "Noto Sans", sans-serif; color: #111; }
    h1, h2, h3, h4 { line-height: 1.25; page-break-after: avoid; }
    table { border-collapse: collapse; page-break-inside: avoid; }
    td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
    img { max-width: 100%; }
    p { margin: 0 0 .6em; }
  </style></head><body>${html}</body></html>`);
  doc.close();
  await new Promise((r) => setTimeout(r, 400));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 60000);
}

export function registerConvert(ENGINES) {
  ENGINES.convert = (tool, root) => {
    const rangeI = el("input", { class: "input mono", type: "text", placeholder: "e.g. 10-45 · empty = all pages" });
    const firstUse = () => tool.heavy && !engineOk(tool.id);
    const outName = (f) => stem(f.name) + (tool.suffix || "") + "." + tool.out;

    async function convertOnce(api, params) {
      const { files, btn } = api;
      const p = { ...params };
      if (tool.rangeOption) {
        const rv = rangeI.value.trim();
        if (rv) {
          const m = rv.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
          if (!m) throw new Error("Use one page or one range, e.g. 2 or 2-3. Comma-separated pages aren't supported.");
          p.start = +m[1];
          p.end = +(m[2] || m[1]);
        }
      }
      if (tool.heavy) requestPersistence();
      let out;
      if (files.length === 1) {
        if (tool.action === "wordToPdf" && !p.engine) {
          try {
            const JSZip = await ensureJSZip();
            const zip = await JSZip.loadAsync(await readBuf(files[0]));
            const docXml = await (zip.file("word/document.xml")?.async("string") || Promise.resolve(""));
            const hasTables = /<w:tbl[\s>]/.test(docXml);
            const hasImages = /<(?:w:drawing|w:pict|v:imagedata)[\s>]/.test(docXml);
            if (hasTables || hasImages) {
              const parts = [hasTables ? "tables" : null, hasImages ? "images" : null].filter(Boolean).join(" and ");
              api.right.body.appendChild(el("p", { class: "engine-hint" },
                `${I.alert} This file has ${parts} the basic converter drops. Use the print view for full formatting.`));
            }
          } catch {}
        }
        const res = await callEngine(tool.action, p, [await readBuf(files[0])], (msg) => btn.setBusy(true, msg));
        out = { bytes: res.bytes, name: outName(files[0]), mime: MIME[tool.out],
                stats: [["Output", fmtBytes(res.bytes.byteLength)]] };
      } else {
        // batch: run per file and zip
        const JSZip = await ensureJSZip();
        const zip = new JSZip();
        for (let i = 0; i < files.length; i++) {
          btn.setBusy(true, `file ${i + 1} / ${files.length} — ${files[i].name}`);
          const bytes = (await callEngine(tool.action, { ...p }, [await readBuf(files[i])],
            (msg) => btn.setBusy(true, `(${i + 1}/${files.length}) ${msg}`))).bytes;
          zip.file(outName(files[i]), bytes);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        out = { bytes: blob, name: `${tool.id}_batch.zip`, mime: MIME.zip,
                stats: [["Files", files.length], ["Output", fmtBytes(blob.size)]] };
      }
      if (tool.heavy) { engineMarkOk(tool.id); btn.baseLabel = "Convert"; }
      return out;
    }

    function fallbackButton(api) {
      const b = el("button", { class: "tbtn", type: "button", style: "margin-top:10px" },
        `${I.swap} Try basic extraction instead`);
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await withBusy(api.btn, "Retrying with basic extraction…", async () => {
            const out = await convertOnce(api, { ...tool.fallbackParams });
            api.setResult(out);
          });
        } catch (err) { api.setError(err); }
      });
      return b;
    }

    function printViewControls(api, file) {
      const pv = el("button", { class: "tbtn", type: "button", style: "margin-top:10px" },
        `${I.doc} Full formatting — print view (choose “Save as PDF”)`);
      pv.addEventListener("click", async () => {
        try { pv.disabled = true; await printDocxView(file); }
        catch (err) { api.setError(err); }
        finally { pv.disabled = false; }
      });
      return [pv, el("p", { class: "engine-hint" },
        `${I.shield} The print view keeps bold, lists, tables and images, and uses your
         browser's own print engine — pick “Save as PDF” in the dialog. Still fully on-device.`)];
    }

    let apiRef;
    apiRef = createWorkspace(root, {
      accept: tool.accept, multiple: !!tool.batch,
      dropLabel: tool.batch ? "Drop files or click to browse" : "Drop a file or click to browse",
      emptyHint: "Load a file and run the conversion.",
      runLabel: firstUse() ? `Download engine (~${tool.heavy.mb} MB) & convert` : "Convert",
      runBusy: "Converting…",
      fields: () => (tool.rangeOption ? labelled("Page range · optional — much faster for large documents", rangeI) : null),
      after: (api) => [
        tool.printView && api.files.length === 1 ? printViewControls(api, api.files[0]) : null,
        firstUse() ? engineHint(tool.heavy) : null,
        tool.heavy && navigator.deviceMemory && navigator.deviceMemory <= 2
          ? el("p", { class: "engine-hint" },
              `${I.alert} This device reports limited memory — very large files may fail here.`)
          : null,
      ],
      onErrorRender: (api) => {
        if (api.files.length === 1 && tool.fallbackParams) api.right.body.appendChild(fallbackButton(api));
      },
      run: async (api) => convertOnce(api, { ...(tool.params || {}) }),
    });
    return apiRef;
  };
}
