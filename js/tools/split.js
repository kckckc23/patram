import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { MIME } from "../icons.js";
import { createWorkspace, labelled, grouped } from "../workspace.js";
import { callEngine } from "../bridge.js";

export function registerSplit(ENGINES) {
  ENGINES.range = (tool, root) => {
    let pages = 0;
    let mode = "single";
    const startI = el("input", { type: "number", min: "1", value: "1", "aria-label": "First page" });
    const endI = el("input", { type: "number", min: "1", value: "1", "aria-label": "Last page" });
    const everyI = el("input", { class: "input mono", type: "number", min: "1", value: "10" });
    const rangesI = el("input", { class: "input mono", type: "text", placeholder: "e.g. 1-3, 7, 9-12" });

    const api = createWorkspace(root, {
      accept: ".pdf", dropLabel: "Drop a PDF or click to browse",
      emptyHint: "Load a PDF and choose how to split it.",
      runLabel: "Split PDF", runBusy: "Splitting…",
      onFiles: async ({ files, clearOutput, renderLeft }) => {
        pages = 0;
        try {
          const r = await callEngine("pageCount", {}, [await readBuf(files[0])]);
          pages = (r && r.data && r.data.pages) || 0;
        } catch { pages = 0; }
        clearOutput();
        renderLeft();
      },
      fields: () => {
        const modeSel = el("select", { class: "input", onchange: (e) => { mode = e.target.value; api.clearOutput(); api.renderLeft(); } },
          `<option value="single">Keep one range</option>
           <option value="every">Every N pages → zip</option>
           <option value="ranges">Several ranges → zip</option>`);
        modeSel.value = mode;
        const nodes = [labelled(`Split mode${pages ? ` · ${pages} pages total` : ""}`, modeSel)];
        if (mode === "single") {
          const row = el("div", { class: "row-inputs" });
          if (pages) { startI.max = String(pages); endI.max = String(pages); if (+endI.value < 2) endI.value = String(pages); }
          row.append(startI, el("span", {}, "to"), endI);
          nodes.push(grouped("Page range", row));
        } else if (mode === "every") {
          nodes.push(labelled("Pages per file", everyI));
        } else {
          nodes.push(labelled("Ranges — one PDF per comma-separated chunk", rangesI));
        }
        return nodes;
      },
      run: async ({ files, btn }) => {
        const file = files[0];
        if (!file) return undefined;
        let res, name, mime = MIME.pdf, stats;
        if (mode === "single") {
          const s = +startI.value, e = +endI.value;
          res = await callEngine("split", { start: s, end: e }, [await readBuf(file)]);
          name = `${stem(file.name)}_p${s}-${e}.pdf`;
          stats = [["Pages", `${s}–${e}`], ["Output", fmtBytes(res.bytes.byteLength)]];
        } else if (mode === "every") {
          res = await callEngine("splitZip", { mode: "every", n: +everyI.value }, [await readBuf(file)]);
          name = `${stem(file.name)}_split.zip`; mime = MIME.zip;
          stats = [["Chunk", everyI.value + " pages"], ["Output", fmtBytes(res.bytes.byteLength)]];
        } else {
          res = await callEngine("splitZip", { mode: "ranges", spec: rangesI.value }, [await readBuf(file)]);
          name = `${stem(file.name)}_split.zip`; mime = MIME.zip;
          stats = [["Output", fmtBytes(res.bytes.byteLength)]];
        }
        return { bytes: res.bytes, name, mime, stats };
      },
    });
    return api;
  };
}
