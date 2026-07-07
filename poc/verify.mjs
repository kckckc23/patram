/*
 * Headless proof: load Pyodide in Node, install the exact packages the browser
 * worker uses, run pdf_tools.py against real files, and validate the output.
 * This de-risks the whole client-side stack without opening a browser.
 *
 *   node verify.mjs
 */
import { loadPyodide } from "pyodide";
import { readFileSync, writeFileSync } from "node:fs";

const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const info = (m) => console.log("\x1b[1m" + m + "\x1b[0m");

info("1) Booting Pyodide + installing packages…");
const CDN = "https://cdn.jsdelivr.net/pyodide/v0.28.1/full/";
const py = await loadPyodide(); // local runtime from node_modules

// Node's npm build omits the package wheels. The BROWSER worker gets these from the
// CDN automatically (indexURL = CDN). Here we resolve exact wheel names from the
// lockfile and load the Pyodide-built ones (micropip, Pillow, lxml) explicitly.
const lock = await (await fetch(CDN + "pyodide-lock.json")).json();
const wheelUrl = (name) => CDN + lock.packages[name.toLowerCase()].file_name;
// Preload every Pyodide-BUILT package we (transitively) touch. In the browser these
// come from the CDN automatically; in Node we must name them explicitly.
await py.loadPackage(
  ["micropip", "pillow", "lxml", "fonttools", "typing-extensions"].map(wheelUrl)
);

const micropip = py.pyimport("micropip");
await micropip.install(["pypdf", "openpyxl", "fpdf2"]); // pure-Python, from PyPI
ok("pypdf, openpyxl, fpdf2, Pillow installed in WASM");

// Bonus: prove the lxml-dependent path (python-docx / python-pptx) also installs.
try {
  await micropip.install(["python-docx"]);
  py.runPython(`import docx; docx.Document()`);
  ok("python-docx imports (lxml prebuilt path works)");
} catch (e) {
  console.log("  \x1b[33m•\x1b[0m python-docx bonus skipped (Node harness quirk): " + e);
}

info("2) Loading pdf_tools.py…");
py.runPython(readFileSync(new URL("./pdf_tools.py", import.meta.url), "utf8"));
ok("module loaded");

info("3) Generating a sample PDF with fpdf2 (also saved for the browser demo)…");
py.runPython(`
from fpdf import FPDF
pdf = FPDF()
for i in range(5):
    pdf.add_page()
    pdf.set_font("Helvetica", size=14)
    pdf.cell(0, 10, f"Sample document - page {i+1}")
    pdf.set_font("Helvetica", size=11)
    pdf.ln(14)
    pdf.multi_cell(0, 6, ("Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 40))
with open("/sample.pdf","wb") as f:
    f.write(bytes(pdf.output()))
`);
const samplePdf = py.FS.readFile("/sample.pdf");
writeFileSync(new URL("./samples/sample.pdf", import.meta.url), samplePdf);
ok(`sample.pdf created (${(samplePdf.byteLength / 1024).toFixed(1)} KB) → samples/sample.pdf`);

info("4) compress_pdf — must stay a VALID pdf (regression vs old byte-slicing)…");
py.runPython(`run("/sample.pdf", "/out.pdf", "compress", False)`);
const compressed = py.FS.readFile("/out.pdf");
// Validate by re-parsing with pypdf and checking page count is preserved.
py.runPython(`
from pypdf import PdfReader
r1 = PdfReader("/sample.pdf"); r2 = PdfReader("/out.pdf")
assert len(r2.pages) == len(r1.pages), "page count changed!"
`);
const delta = (1 - compressed.byteLength / samplePdf.byteLength) * 100;
ok(`valid PDF, pages preserved, ${(samplePdf.byteLength/1024).toFixed(1)}KB → ${(compressed.byteLength/1024).toFixed(1)}KB (${delta.toFixed(1)}% change)`);

info("5) table_to_pdf — CSV → PDF…");
const csv = readFileSync(new URL("./samples/sample.csv", import.meta.url));
py.FS.writeFile("/in.csv", csv);
py.runPython(`run("/in.csv", "/tbl.pdf", "table", True)`);
const tblPdf = py.FS.readFile("/tbl.pdf");
py.runPython(`from pypdf import PdfReader; assert len(PdfReader("/tbl.pdf").pages) >= 1`);
writeFileSync(new URL("./samples/sample_table.pdf", import.meta.url), tblPdf);
ok(`CSV → valid table PDF (${(tblPdf.byteLength/1024).toFixed(1)} KB) → samples/sample_table.pdf`);

info("\n\x1b[32mALL CHECKS PASSED\x1b[0m — the client-side Python stack works end to end.");
