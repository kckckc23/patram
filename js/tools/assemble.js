import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { MIME } from "../icons.js";
import { createWorkspace, labelled } from "../workspace.js";
import { callEngine } from "../bridge.js";
import { registerSplit } from "./split.js";
import { registerOrganize } from "./organize.js";
import { registerImagePlace } from "./image-place.js";

export function registerAssemble(ENGINES) {
  registerSplit(ENGINES);
  registerOrganize(ENGINES);
  registerImagePlace(ENGINES);

  // merge
  ENGINES.merge = (tool, root) => createWorkspace(root, {
    accept: ".pdf", multiple: true, reorder: true,
    dropLabel: "Drop PDFs or click to browse",
    emptyHint: "Add two or more PDFs to merge.",
    min: 2, minMsg: "Add at least two PDFs.",
    runLabel: "Merge PDFs", runBusy: "Merging…",
    run: async ({ files }) => {
      const res = await callEngine("merge", {}, await Promise.all(files.map(readBuf)));
      return { bytes: res.bytes, name: "merged.pdf", mime: MIME.pdf,
               stats: [["Files", files.length], ["Output", fmtBytes(res.bytes.byteLength)]] };
    },
  });

  // delete
  ENGINES.delete = (tool, root) => {
    const inp = el("input", { class: "input mono", type: "text", placeholder: "e.g. 1, 3, 8-10" });
    let pages = 0;
    return createWorkspace(root, {
      accept: ".pdf", dropLabel: "Drop a PDF or click to browse",
      emptyHint: "Load a PDF and list pages to remove.",
      runLabel: "Delete pages", runBusy: "Rebuilding…",
      onFiles: async ({ files, renderLeft }) => {
        pages = 0;
        try { pages = (await callEngine("pageCount", {}, [await readBuf(files[0])])).data.pages; } catch {}
        renderLeft();
      },
      fields: () => labelled(`Pages to remove${pages ? ` · ${pages} total` : ""}`, inp),
      run: async ({ files }) => {
        const res = await callEngine("delete", { ranges: inp.value }, [await readBuf(files[0])]);
        return { bytes: res.bytes, name: `${stem(files[0].name)}_edited.pdf`, mime: MIME.pdf,
                 stats: [["Output", fmtBytes(res.bytes.byteLength)]] };
      },
    });
  };

  // stamp
  ENGINES.stamp = (tool, root) => {
    const textI = el("input", { class: "input", type: "text", placeholder: "e.g. CONFIDENTIAL · empty = numbers only" });
    const numC = el("input", { type: "checkbox", id: "pgnum" });
    let pos = "diagonal";
    return createWorkspace(root, {
      accept: ".pdf", dropLabel: "Drop a PDF or click to browse",
      emptyHint: "Load a PDF, choose a stamp, and apply.",
      runLabel: "Apply stamp", runBusy: "Stamping…",
      fields: ({ clearOutput }) => {
        const sel = el("select", { class: "input", onchange: (e) => { pos = e.target.value; clearOutput(); } },
          `<option value="diagonal">Diagonal watermark</option>
           <option value="header">Header (top, small)</option>
           <option value="footer">Footer (bottom, small)</option>`);
        sel.value = pos;
        const check = el("label", { class: "engine-hint", for: "pgnum", style: "cursor:pointer" });
        check.appendChild(numC);
        check.appendChild(document.createTextNode(" Add “Page x of y” to every page"));
        return [labelled("Stamp text", textI), labelled("Placement", sel), check];
      },
      run: async ({ files, btn }) => {
        const res = await callEngine("stamp", { text: textI.value, pos, pagenum: numC.checked },
          [await readBuf(files[0])], (msg) => btn.setBusy(true, msg));
        return { bytes: res.bytes, name: `${stem(files[0].name)}_stamped.pdf`, mime: MIME.pdf,
                 stats: [["Output", fmtBytes(res.bytes.byteLength)]] };
      },
    });
  };
}
