import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace, labelled } from "../workspace.js";
import { callEngine } from "../bridge.js";
import { registerConvert } from "./convert.js";

export function registerToPdf(ENGINES) {
  registerConvert(ENGINES); // wordPdf, xlsxPdf? xlsxPdf uses table engine; pptPdf uses convert

  // images -> pdf
  ENGINES.images = (tool, root) => {
    let size = "letter";
    return createWorkspace(root, {
      accept: "image/*", multiple: true, reorder: true,
      dropLabel: "Drop images or click to browse",
      emptyHint: "Add images to compile a PDF.",
      runLabel: "Build PDF", runBusy: "Building…",
      fields: ({ clearOutput, renderLeft }) => {
        const sel = el("select", { class: "input", onchange: (e) => { size = e.target.value; clearOutput(); } },
          `<option value="letter">Letter</option><option value="a4">A4</option>`);
        sel.value = size;
        return labelled("Page size", sel);
      },
      run: async ({ files }) => {
        const res = await callEngine("imagesToPdf", { size }, await Promise.all(files.map(readBuf)));
        return { bytes: res.bytes, name: "images.pdf", mime: MIME.pdf,
                 stats: [["Images", files.length], ["Output", fmtBytes(res.bytes.byteLength)]] };
      },
    });
  };

  // text -> pdf (compose)
  ENGINES.compose = (tool, root) => {
    const ta = el("textarea", { class: "textarea", id: "pf-content", placeholder: "Type or paste text here…" });
    ta.value = "Untitled note\n\nStart writing. Line breaks and paragraphs are preserved.";
    const loadInput = el("input", { type: "file", accept: ".txt,.md,.csv", class: "sr", "aria-label": "Load a text file" });
    loadInput.addEventListener("change", async () => {
      if (loadInput.files[0]) ta.value = await loadInput.files[0].text();
      loadInput.value = "";
    });
    const loadBtn = el("button", { class: "tbtn", type: "button", onclick: () => loadInput.click() }, `${I.file} Load .txt`);
    return createWorkspace(root, {
      accept: null,
      emptyHint: "Type some text and export.",
      runLabel: "Export PDF", runBusy: "Rendering…",
      fields: () => {
        const field = el("div", { class: "field" });
        field.appendChild(el("label", { for: "pf-content" }, "Content"));
        const head = el("div", { class: "tool-actions", style: "margin-bottom:8px" });
        head.appendChild(loadBtn);
        field.append(head, ta, loadInput);
        return field;
      },
      run: async ({ setError }) => {
        if (!ta.value.trim()) { setError("Type some text first."); return undefined; }
        const res = await callEngine("textToPdf", { text: ta.value, name: "note.txt" }, []);
        return { bytes: res.bytes, name: "document.pdf", mime: MIME.pdf,
                 stats: [["Output", fmtBytes(res.bytes.byteLength)]] };
      },
    });
  };

  // spreadsheet -> pdf
  ENGINES.table = (tool, root) => createWorkspace(root, {
    accept: ".xlsx,.csv", dropLabel: "Drop a spreadsheet or click to browse",
    emptyHint: "Load an .xlsx or .csv.", runLabel: "Convert to PDF", runBusy: "Rendering table…",
    run: async ({ files }) => {
      const res = await callEngine("tableToPdf", { isCsv: /\.csv$/i.test(files[0].name) },
        [await readBuf(files[0])]);
      return { bytes: res.bytes, name: `${stem(files[0].name)}.pdf`, mime: MIME.pdf,
               stats: [["Output", fmtBytes(res.bytes.byteLength)]] };
    },
  });
}
