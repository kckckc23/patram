import { el, stem, fmtBytes, readBuf } from "../dom.js";
import { MIME } from "../icons.js";
import { createWorkspace, labelled } from "../workspace.js";
import { qpdfCall } from "../bridge.js";

export function registerQpdf(ENGINES) {
  ENGINES.qpdf = (tool, root) => {
    const encrypting = tool.qpdf === "encrypt";
    const needsPw = encrypting || tool.qpdf === "decrypt";
    const pw = el("input", { class: "input mono", type: "password", placeholder: "Password", autocomplete: "new-password" });
    const pw2 = el("input", { class: "input mono", type: "password", placeholder: "Repeat password",
      "aria-label": "Repeat password", autocomplete: "new-password", style: "margin-top:8px" });

    return createWorkspace(root, {
      accept: ".pdf", dropLabel: "Drop a PDF or click to browse",
      emptyHint: `Load a PDF to ${tool.name.toLowerCase()}.`,
      runLabel: tool.name, runBusy: "Working…", free: true,
      fields: () => (needsPw
        ? labelled(encrypting ? "Set a password · AES-256" : "Current password", pw, encrypting ? pw2 : null)
        : null),
      run: async ({ files, btn, setError }) => {
        if (encrypting && !pw.value) { setError("Choose a password first."); return undefined; }
        if (encrypting && pw.value !== pw2.value) { setError("The passwords don't match."); return undefined; }
        if (tool.qpdf === "decrypt" && !pw.value) { setError("Enter the document's password."); return undefined; }
        const res = await qpdfCall(tool.qpdf, { password: pw.value }, await readBuf(files[0]),
          (msg) => btn.setBusy(true, msg));
        return { bytes: res.bytes, name: `${stem(files[0].name)}${tool.suffix || ""}.pdf`, mime: MIME.pdf,
                 stats: [["Input", fmtBytes(files[0].size)], ["Output", fmtBytes(res.bytes.byteLength)]] };
      },
    });
  };
}
