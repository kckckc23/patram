/*
 * Headless verification of the entire client-side Python engine.
 * Loads Pyodide in Node, installs the exact packages the browser worker uses,
 * then drives every dispatch() action against generated fixtures and validates
 * each result. No browser required.
 *
 *   cd test && npm install && node verify.mjs
 */
import { loadPyodide } from "pyodide";
import { readFileSync, writeFileSync } from "node:fs";

const CDN = "https://cdn.jsdelivr.net/pyodide/v0.28.1/full/";
const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const step = (m) => console.log("\x1b[1m" + m + "\x1b[0m");

step("Booting Pyodide + installing packages…");
const py = await loadPyodide();
const lock = await (await fetch(CDN + "pyodide-lock.json")).json();
const wheel = (n) => CDN + lock.packages[n.toLowerCase()].file_name;
// Pyodide-built deps (browser gets these from the CDN automatically):
await py.loadPackage(["micropip", "pillow", "lxml", "fonttools", "typing-extensions"].map(wheel));
const micropip = py.pyimport("micropip");
// pure-Python packages, from PyPI:
await micropip.install(["pypdf", "openpyxl", "fpdf2", "python-docx", "python-pptx"]);
ok("all packages installed in WASM");

step("Loading pdf_tools.py…");
py.runPython(readFileSync(new URL("../pdf_tools.py", import.meta.url), "utf8"));
ok("module loaded");

// ---- fixtures -------------------------------------------------------------
step("Generating fixtures (PDF, DOCX, XLSX, PPTX, PNG)…");
py.runPython(`
from fpdf import FPDF
import docx
from openpyxl import Workbook
from pptx import Presentation
from pptx.util import Inches
from PIL import Image

# multi-page PDF
pdf = FPDF()
for i in range(4):
    pdf.add_page(); pdf.set_font("Helvetica", size=12)
    pdf.multi_cell(0, 8, (f"Heading {i+1}\\n" + "The quick brown fox jumps over the lazy dog. " * 20))
open("/f.pdf","wb").write(bytes(pdf.output()))

# docx
d = docx.Document(); d.add_heading("Report", 0)
for i in range(3): d.add_paragraph(f"Paragraph {i+1}. " * 8)
d.save("/f.docx")

# xlsx
wb = Workbook(); ws = wb.active
ws.append(["Region","Units","Revenue"])
for r in [["North",120,"$1,400"],["South",98,"$1,100"]]: ws.append(r)
wb.save("/f.xlsx")

# pptx
prs = Presentation(); lay = prs.slide_layouts[1]
for t in ["Intro","Details"]:
    s = prs.slides.add_slide(lay); s.shapes.title.text = t
    s.placeholders[1].text = "Bullet one\\nBullet two"
prs.save("/f.pptx")

# png
Image.new("RGB",(400,300),(40,80,200)).save("/f.png")
`);
ok("fixtures created");

// ---- driver ---------------------------------------------------------------
function run(action, params, inputs) {
  (inputs || []).forEach((buf, i) => py.FS.writeFile("/in" + i, buf));
  const res = JSON.parse(py.runPython(`dispatch(${JSON.stringify(action)}, ${JSON.stringify(JSON.stringify(params || {}))})`));
  if (res.kind === "file") return py.FS.readFile("/out");
  return res;
}
const read = (p) => py.FS.readFile(p);
const pageCount = (buf) => { py.FS.writeFile("/chk", buf); return py.runPython(`get_page_count(open("/chk","rb").read())`); };
const validPdf = (buf, label) => { const n = pageCount(buf); if (n < 1) throw new Error(label + ": invalid PDF"); return n; };

const f = { pdf: read("/f.pdf"), docx: read("/f.docx"), xlsx: read("/f.xlsx"), pptx: read("/f.pptx"), png: read("/f.png"),
            csv: readFileSync(new URL("../samples/sample.csv", import.meta.url)) };

step("Exercising every operation…");

// core
let r = run("merge", { n: 2 }, [f.pdf, f.pdf]);
ok(`merge → ${validPdf(r, "merge")} pages (2×4=8 expected)`);

r = run("split", { start: 2, end: 3 }, [f.pdf]);
ok(`split 2–3 → ${validPdf(r, "split")} pages (2 expected)`);

r = run("delete", { ranges: "1,4" }, [f.pdf]);
ok(`delete 1,4 → ${validPdf(r, "delete")} pages (2 expected)`);

r = run("organize", { order: [{ src: 3, rot: 90 }, { src: 0, rot: 0 }] }, [f.pdf]);
ok(`organize/rotate → ${validPdf(r, "organize")} pages (2 expected)`);

const before = f.pdf.byteLength;
r = run("compress", { quality: 50 }, [f.pdf]);
ok(`compress → VALID pdf, ${validPdf(r, "compress")} pages, ${(before/1024).toFixed(1)}KB → ${(r.byteLength/1024).toFixed(1)}KB`);

// text
const t = run("pdfToText", {}, [f.pdf]);
if (t.kind !== "text" || t.text.length < 20) throw new Error("pdfToText produced nothing");
ok(`pdfToText → ${t.text.length} chars`);

const longText = "Line one\nLine two\n\n" + "And a longer paragraph that must wrap across the page. ".repeat(12)
  + "\nhttps://example.com/" + "x".repeat(300); // unbreakable token → exercises char-wrap fallback
r = run("textToPdf", { text: longText, name: "note.txt" }, []);
ok(`textToPdf (+long unbreakable token) → ${validPdf(r, "textToPdf")} page(s)`);

// spreadsheets
r = run("tableToPdf", { isCsv: true }, [f.csv]);
ok(`CSV → PDF → ${validPdf(r, "tableToPdf")} page(s)`);

r = run("tableToPdf", { isCsv: false }, [f.xlsx]);
ok(`XLSX → PDF → ${validPdf(r, "xlsx tableToPdf")} page(s)`);

r = run("pdfToXlsx", {}, [f.pdf]);
py.FS.writeFile("/o.xlsx", r);
py.runPython(`from openpyxl import load_workbook; load_workbook("/o.xlsx")`);
ok(`PDF → XLSX → valid workbook (${(r.byteLength/1024).toFixed(1)}KB)`);

// word
r = run("wordToPdf", {}, [f.docx]);
ok(`DOCX → PDF → ${validPdf(r, "wordToPdf")} page(s)`);

r = run("pdfToWord", {}, [f.pdf]);
py.FS.writeFile("/o.docx", r);
py.runPython(`import docx; docx.Document("/o.docx")`);
ok(`PDF → DOCX → valid document (${(r.byteLength/1024).toFixed(1)}KB)`);

// powerpoint
r = run("pptToPdf", {}, [f.pptx]);
ok(`PPTX → PDF → ${validPdf(r, "pptToPdf")} page(s)`);

r = run("pdfToPpt", {}, [f.pdf]);
py.FS.writeFile("/o.pptx", r);
py.runPython(`from pptx import Presentation; Presentation("/o.pptx")`);
ok(`PDF → PPTX → valid presentation (${(r.byteLength/1024).toFixed(1)}KB)`);

// images
r = run("imagesToPdf", { n: 2, size: "a4" }, [f.png, f.png]);
ok(`images → PDF → ${validPdf(r, "imagesToPdf")} pages (2 expected)`);

// pageCount
const pc = run("pageCount", {}, [f.pdf]);
if (pc.pages !== 4) throw new Error("pageCount wrong: " + pc.pages);
ok(`pageCount → ${pc.pages}`);

// stash a couple of browsable samples
writeFileSync(new URL("../samples/sample.pdf", import.meta.url), f.pdf);
step("\n\x1b[32mALL OPERATIONS VERIFIED\x1b[0m — the client-side Python engine is fully working.");
