/*
 * Fixtures for the UI matrix (test/ui.mjs). Built once into test/fixtures/ and
 * reused: Pyodide writes the documents, qpdf.wasm produces the encrypted PDF.
 * No dependency the repo does not already carry.
 *
 *   node ui-fixtures.mjs          # build if missing
 *   node ui-fixtures.mjs --force  # rebuild
 */
import { loadPyodide } from "pyodide";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
export const FIXTURES = {
  multi: "multi.pdf",      // 4 pages of text — the general-purpose input
  one: "one.pdf",          // single page, for merges
  locked: "locked.pdf",    // AES-256, password "patram"
  doc: "doc.docx",
  book: "book.xlsx",
  deck: "deck.pptx",
  photo: "photo.png",
  notes: "notes.txt",
  table: "table.csv",
};
export const PASSWORD = "patram";

const path = (name) => DIR + name;
export const fixture = (key) => path(FIXTURES[key]);

export async function ensureFixtures({ force = false, log = () => {} } = {}) {
  mkdirSync(DIR, { recursive: true });
  const missing = Object.values(FIXTURES).filter((f) => !existsSync(path(f)));
  if (!force && !missing.length) { log("fixtures present"); return; }
  log(`building fixtures (${force ? "forced" : missing.join(", ")})…`);

  const py = await loadPyodide();
  await py.loadPackage(["micropip", "pillow"], { messageCallback: () => {} });
  const micropip = py.pyimport("micropip");
  // same pins as worker.js BOOT_PACKAGES, so fixtures match what the app parses
  await micropip.install(["pypdf==6.15.0", "openpyxl==3.1.5", "fpdf2==2.8.7",
                          "python-docx==1.2.0", "python-pptx==1.0.2"]);
  py.runPython(`
from fpdf import FPDF
import docx
from openpyxl import Workbook
from pptx import Presentation
from PIL import Image

def _pdf(pages):
    pdf = FPDF()
    for i in range(pages):
        pdf.add_page(); pdf.set_font("Helvetica", size=12)
        pdf.multi_cell(0, 8, f"Heading {i+1}\\n" + "The quick brown fox jumps over the lazy dog. " * 18)
    return bytes(pdf.output())

open("/multi.pdf","wb").write(_pdf(4))
open("/one.pdf","wb").write(_pdf(1))

d = docx.Document(); d.add_heading("Quarterly report", 0)
for i in range(3): d.add_paragraph(f"Paragraph {i+1}. " * 8)
d.save("/doc.docx")

wb = Workbook(); ws = wb.active; ws.title = "Sales"
ws.append(["Region","Units","Revenue"])
for r in [["North",120,1400],["South",98,1100],["East",143,1720]]: ws.append(r)
wb.save("/book.xlsx")

prs = Presentation(); lay = prs.slide_layouts[1]
for t in ["Intro","Details"]:
    s = prs.slides.add_slide(lay); s.shapes.title.text = t
    s.placeholders[1].text = "Bullet one\\nBullet two"
prs.save("/deck.pptx")

im = Image.new("RGB",(480,320),(38,74,120))
for x in range(480):
    for y in range(0, 320, 40): im.putpixel((x, y), (231,147,16))
im.save("/photo.png")
`);
  for (const [key, name] of Object.entries(FIXTURES)) {
    if (["locked", "notes", "table"].includes(key)) continue;
    writeFileSync(path(name), py.FS.readFile("/" + name));
  }
  writeFileSync(path(FIXTURES.notes),
    "Patram UI test\n\nThis text becomes a PDF entirely in the browser.\nसब कुछ आपके डिवाइस पर।\n");
  writeFileSync(path(FIXTURES.table),
    "Region,Units,Revenue\nNorth,120,1400\nSouth,98,1100\nEast,143,1720\n");

  // encrypted PDF for the Unlock tool
  const createQpdf = (await import("@neslinesli93/qpdf-wasm")).default;
  const wasm = fileURLToPath(new URL("./node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm", import.meta.url));
  const m = await createQpdf({ locateFile: () => wasm, noInitialRun: true, print: () => {}, printErr: () => {} });
  m.FS.writeFile("/in.pdf", py.FS.readFile("/multi.pdf"));
  const code = m.callMain(["--encrypt", PASSWORD, PASSWORD, "256", "--", "/in.pdf", "/out.pdf"]);
  if (code !== 0 && code !== 3) throw new Error("qpdf encrypt failed, exit " + code);
  writeFileSync(path(FIXTURES.locked), m.FS.readFile("/out.pdf"));
  log(`fixtures written to ${DIR}`);
}

// compare real paths: import.meta.url percent-encodes spaces in the repo path
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await ensureFixtures({ force: process.argv.includes("--force"), log: (m) => console.log("  " + m) });
}
