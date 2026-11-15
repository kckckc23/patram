import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { I, MIME } from "../icons.js";
import { createWorkspace } from "../workspace.js";
import { callEngine } from "../bridge.js";
import { registerPdfImages } from "./pdf-images.js";
import { registerOcr } from "./ocr.js";

export function registerExtract(ENGINES) {
  registerPdfImages(ENGINES);
  registerOcr(ENGINES);

  // pdf -> text
  ENGINES.text = (tool, root) => {
    let text = "";
    let api;
    const copyBtn = el("button", { class: "tbtn", type: "button", onclick: () => {
      navigator.clipboard.writeText(text);
      copyBtn.innerHTML = `${I.check} Copied`;
      setTimeout(() => copyBtn.innerHTML = `${I.copy} Copy`, 1500);
    } }, `${I.copy} Copy`);
    const dlText = (name) => {
      const blob = new Blob([text], { type: MIME.txt });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    };
    const dlBtn = el("button", { class: "tbtn", type: "button", onclick: () =>
      dlText(api.files[0] ? stem(api.files[0].name) + ".txt" : "text.txt") }, `${I.dl} .txt`);

    api = createWorkspace(root, {
      accept: ".pdf", dropLabel: "Drop a PDF or click to browse", withActions: true,
      resultTitle: "Extracted text", emptyTitle: "No text yet",
      emptyHint: "Load a PDF to pull out its text layer.",
      runLabel: "Extract text", runBusy: "Reading…",
      run: async ({ files, actions }) => {
        const res = await callEngine("pdfToText", {}, [await readBuf(files[0])]);
        text = res.text;
        actions.innerHTML = ""; actions.append(copyBtn, dlBtn);
        return { text };
      },
    });
    return api;
  };
}
