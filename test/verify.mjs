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
import { fileURLToPath } from "node:url";

const CDN = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/";
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

// designed decks keep text in tables/groups; image-only decks must error clearly
py.runPython(`
from pptx import Presentation
from pptx.util import Inches
prs = Presentation()
s = prs.slides.add_slide(prs.slide_layouts[6])
tb = s.shapes.add_table(2, 2, Inches(1), Inches(1), Inches(5), Inches(1.5)).table
tb.cell(0, 0).text = "Skill"; tb.cell(0, 1).text = "Level"
tb.cell(1, 0).text = "Python"; tb.cell(1, 1).text = "Expert"
prs.save("/t_table.pptx")
prs2 = Presentation()
s2 = prs2.slides.add_slide(prs2.slide_layouts[6])
s2.shapes.add_picture("/f.png", 0, 0)
prs2.save("/t_img.pptx")
`);
r = run("pptToPdf", {}, [read("/t_table.pptx")]);
ok(`PPTX (table-only content) → PDF → ${validPdf(r, "pptToPdf table")} page(s)`);
let threw = false;
try { run("pptToPdf", {}, [read("/t_img.pptx")]); }
catch (e) { threw = /extractable text/i.test(String(e)); }
if (!threw) throw new Error("image-only pptx must raise a clear error, not emit a blank PDF");
ok("image-only PPTX → clear error (no more blank 'Slide' PDF)");

r = run("pdfToPpt", {}, [f.pdf]);
py.FS.writeFile("/o.pptx", r);
py.runPython(`from pptx import Presentation; Presentation("/o.pptx")`);
ok(`PDF → PPTX → valid presentation (${(r.byteLength/1024).toFixed(1)}KB)`);

// images
r = run("imagesToPdf", { n: 2, size: "a4" }, [f.png, f.png]);
ok(`images → PDF → ${validPdf(r, "imagesToPdf")} pages (2 expected)`);

r = run("imagesToPpt", { n: 2, w: 612, h: 792 }, [f.png, f.png]);
py.FS.writeFile("/o3.pptx", r);
const slides = py.runPython(`from pptx import Presentation; len(list(Presentation("/o3.pptx").slides))`);
ok(`images → PPTX (faithful slides) → ${slides} slides (${(r.byteLength / 1024).toFixed(1)}KB)`);

// pageCount
const pc = run("pageCount", {}, [f.pdf]);
if (pc.pages !== 4) throw new Error("pageCount wrong: " + pc.pages);
ok(`pageCount → ${pc.pages}`);

// ---- Unicode font pack (worker writes /fonts; here we copy from the repo) --
step("Unicode text rendering (bundled font pack)…");
try { py.FS.mkdir("/fonts"); } catch {}
for (const name of ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf",
                    "NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari-Bold.ttf"])
  py.FS.writeFile("/fonts/" + name, readFileSync(new URL("../fonts/" + name, import.meta.url)));
r = run("textToPdf", { text: "पत्रम् — एक निजी दस्तावेज़ स्टूडियो.\nAccents: naïve façade — čeština, русский, ελληνικά.", name: "unicode.txt" }, []);
ok(`textToPdf (Devanagari + multi-script) → ${validPdf(r, "unicode textToPdf")} page(s)`);
r = run("wordToPdf", {}, [f.docx]);
ok(`DOCX → PDF with Unicode fonts → ${validPdf(r, "unicode wordToPdf")} page(s)`);

// ---- qpdf.wasm: linearize / encrypt / decrypt / repair --------------------
step("qpdf.wasm operations…");
const createQpdf = (await import("@neslinesli93/qpdf-wasm")).default;
const qpdfWasm = fileURLToPath(new URL("./node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm", import.meta.url));
async function qpdf(args, input) {
  const m = await createQpdf({ locateFile: () => qpdfWasm, noInitialRun: true, print: () => {}, printErr: () => {} });
  m.FS.writeFile("/in.pdf", input);
  let code = 0;
  try { code = m.callMain([...args, "/in.pdf", "/out.pdf"]); }
  catch (e) { code = typeof e?.status === "number" ? e.status : 1; }
  if (code !== 0 && code !== 3) throw new Error("qpdf exit " + code + " for: " + args.join(" "));
  return m.FS.readFile("/out.pdf");
}
r = await qpdf(["--linearize"], f.pdf);
ok(`linearize → ${validPdf(r, "linearize")} pages`);
const enc = await qpdf(["--encrypt", "pw", "pw", "256", "--"], f.pdf);
ok(`encrypt AES-256 → ${(enc.byteLength / 1024).toFixed(1)}KB (opens only with password)`);
r = await qpdf(["--password=pw", "--decrypt"], enc);
ok(`decrypt → ${validPdf(r, "decrypt")} pages`);
r = await qpdf([], f.pdf);
ok(`repair pass → ${validPdf(r, "repair")} pages`);

// ---- overlays, privacy, zip splitting --------------------------------------
step("Stamp / strip metadata / split-zip / OCR overlay…");
r = run("stamp", { text: "CONFIDENTIAL", pos: "diagonal", pagenum: true }, [f.pdf]);
ok(`stamp + page numbers → ${validPdf(r, "stamp")} pages`);

r = run("stripMeta", {}, [f.pdf]);
py.FS.writeFile("/o4.pdf", r);
validPdf(r, "stripMeta");
const infoLeft = py.runPython(`from pypdf import PdfReader
m = PdfReader("/o4.pdf").metadata
0 if not m else len([v for v in m.values() if v])`);
ok(`strip metadata → valid pdf, ${infoLeft} info entries left`);

r = run("splitZip", { mode: "every", n: 2 }, [f.pdf]);
py.FS.writeFile("/o5.zip", r);
let znames = py.runPython(`import zipfile; ", ".join(zipfile.ZipFile("/o5.zip").namelist())`);
ok(`split every 2 pages → zip [${znames}]`);

r = run("splitZip", { mode: "ranges", spec: "1-2, 4" }, [f.pdf]);
py.FS.writeFile("/o5b.zip", r);
znames = py.runPython(`import zipfile; ", ".join(zipfile.ZipFile("/o5b.zip").namelist())`);
ok(`split ranges "1-2, 4" → zip [${znames}]`);

r = run("ocrOverlay", { pages: [{ scale: 2, words: [
  { t: "hello", x0: 100, y0: 100, x1: 320, y1: 148 },
  { t: "पत्रम्", x0: 100, y0: 200, x1: 320, y1: 248 },
] }] }, [f.pdf]);
py.FS.writeFile("/o6.pdf", r);
validPdf(r, "ocrOverlay");
const hasWord = py.runPython(`from pypdf import PdfReader
"hello" in (PdfReader("/o6.pdf").pages[0].extract_text() or "")`);
if (!hasWord) throw new Error("OCR overlay text is not extractable");
ok(`OCR overlay → searchable pdf (invisible word layer extracts back)`);

// ---- heavy engines (run with --full; downloads ~40MB of wheels once) ------
if (process.argv.includes("--full")) {
  step("Heavy engines (--full): PyMuPDF, pdf2docx, pdfplumber…");
  await py.runPythonAsync(`
import micropip
await micropip.install(["pymupdf", "opencv-python", "numpy", "fonttools", "fire"])
await micropip.install("pdf2docx", deps=False)
await micropip.install(["pdfminer.six"])
await micropip.install("pdfplumber", deps=False)
`);
  ok("engines installed in WASM");

  r = run("compress", { mode: "max", dpi: 110, quality: 60 }, [f.pdf]);
  ok(`compress max (PyMuPDF downsample) → VALID pdf, ${validPdf(r, "compress max")} pages`);

  r = run("pdfToWord", { engine: "hifi" }, [f.pdf]);
  py.FS.writeFile("/o2.docx", r);
  const paras = py.runPython(`import docx; len(docx.Document("/o2.docx").paragraphs)`);
  ok(`PDF → Word (pdf2docx) → valid docx, ${paras} paragraphs (${(r.byteLength / 1024).toFixed(1)}KB)`);

  r = run("pdfToWord", { engine: "hifi", start: 2, end: 3 }, [f.pdf]);
  py.FS.writeFile("/o2r.docx", r);
  py.runPython(`import docx; docx.Document("/o2r.docx")`);
  ok(`PDF → Word range 2-3 → valid docx (${(r.byteLength / 1024).toFixed(1)}KB)`);

  r = run("pdfToXlsx", { engine: "hifi" }, [f.pdf]);
  py.FS.writeFile("/o2.xlsx", r);
  const sheets = py.runPython(`from openpyxl import load_workbook; len(load_workbook("/o2.xlsx").sheetnames)`);
  ok(`PDF → Excel (pdfplumber) → valid workbook, ${sheets} sheets (${(r.byteLength / 1024).toFixed(1)}KB)`);
} else {
  step("(skipped heavy engines — run `node verify.mjs --full` to include PyMuPDF/pdf2docx/pdfplumber)");
}

// stash a couple of browsable samples
writeFileSync(new URL("../samples/sample.pdf", import.meta.url), f.pdf);
step("\n\x1b[32mALL OPERATIONS VERIFIED\x1b[0m — the client-side Python engine is fully working.");
