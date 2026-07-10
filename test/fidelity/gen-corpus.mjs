/*
 * Deterministic benchmark corpus generator (plan.md §7).
 * Boots Pyodide in Node (same pattern as ../verify.mjs), installs the office
 * libraries, and writes a fixed set of DOCX/XLSX/PPTX documents into corpus/.
 *
 * Every run produces byte-identical output: no randomness, fixed document
 * properties, and a zip-normalization pass that pins every OOXML zip entry
 * to a constant timestamp.
 *
 *   cd test/fidelity && npm install && node gen-corpus.mjs
 */
import { loadPyodide } from "pyodide";
import { mkdirSync, writeFileSync } from "node:fs";

const CDN = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/";
const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const step = (m) => console.log("\x1b[1m" + m + "\x1b[0m");

// ---- manifest (single source of truth for corpus/index.json) ---------------
// tier 1 = plain, tier 2 = styled/structured, tier 3 = layout-hostile.
const MANIFEST = [
  { file: "t01-plain-letter.docx",    format: "docx", tier: 1, features: ["paragraphs", "plain-text"] },
  { file: "t02-styles-headings.docx", format: "docx", tier: 2, features: ["title", "headings", "quote", "bullet-list", "numbered-list"] },
  { file: "t03-ruled-tables.docx",    format: "docx", tier: 2, features: ["tables", "ruled-borders", "merged-cells"] },
  { file: "t04-images.docx",          format: "docx", tier: 2, features: ["inline-image", "png"] },
  { file: "t05-headers-footers.docx", format: "docx", tier: 3, features: ["header", "footer", "page-number-field", "multi-page"] },
  { file: "t06-multicolumn.docx",     format: "docx", tier: 3, features: ["two-columns", "section-properties"] },
  { file: "t07-devanagari.docx",      format: "docx", tier: 3, features: ["devanagari", "complex-script", "unicode"] },
  { file: "t08-long.docx",            format: "docx", tier: 3, features: ["long-document", "40+pages", "headings", "page-breaks"] },
  { file: "s01-grid.xlsx",            format: "xlsx", tier: 1, features: ["grid", "header-row"] },
  { file: "s02-formats.xlsx",         format: "xlsx", tier: 2, features: ["currency-format", "date-format", "bold", "fills"] },
  { file: "s03-wide.xlsx",            format: "xlsx", tier: 3, features: ["30-columns", "pagination-stress"] },
  { file: "s04-multisheet.xlsx",      format: "xlsx", tier: 2, features: ["multiple-sheets"] },
  { file: "s05-merged-cells.xlsx",    format: "xlsx", tier: 2, features: ["merged-cells", "borders"] },
  { file: "p01-title-bullets.pptx",   format: "pptx", tier: 1, features: ["title-slide", "bullets", "indent-levels"] },
  { file: "p02-positioned-shapes.pptx", format: "pptx", tier: 2, features: ["absolute-positioning", "shapes", "solid-fills"] },
  { file: "p03-image-slide.pptx",     format: "pptx", tier: 2, features: ["image", "png", "caption"] },
  { file: "p04-two-content-layout.pptx", format: "pptx", tier: 2, features: ["two-content-layout", "placeholders"] },
];

step("Booting Pyodide + installing packages…");
const py = await loadPyodide();
const lock = await (await fetch(CDN + "pyodide-lock.json")).json();
const wheel = (n) => CDN + lock.packages[n.toLowerCase()].file_name;
// Pyodide-built deps come as wheels from the CDN lock:
await py.loadPackage(["micropip", "pillow", "lxml", "typing-extensions"].map(wheel));
const micropip = py.pyimport("micropip");
// pure-Python packages, from PyPI:
await micropip.install(["python-docx", "openpyxl", "python-pptx", "fpdf2"]);
ok("all packages installed in WASM");

step("Generating corpus documents…");
py.runPython(`
import io, re, zipfile
from datetime import datetime

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from openpyxl import Workbook
from openpyxl.styles import Border, Font, PatternFill, Side

from pptx import Presentation
from pptx.dml.color import RGBColor as PRGB
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Emu, Inches as PInches, Pt as PPt

from PIL import Image, ImageDraw

import os
os.makedirs("/corpus", exist_ok=True)

EPOCH = datetime(2026, 1, 1)          # fixed doc-property timestamp
ZIP_DT = (1980, 1, 1, 0, 0, 0)        # fixed zip-entry timestamp

# ---------------------------------------------------------------- helpers ---
def normalize_zip(path):
    """Rewrite an OOXML zip byte-stable: constant entry timestamps, and pin
    docProps/core.xml dates (openpyxl stamps 'modified' with now() at save)."""
    with zipfile.ZipFile(path) as src:
        items = [(i.filename, src.read(i.filename)) for i in src.infolist()]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as out:
        for name, data in items:
            if name == "docProps/core.xml":
                data = re.sub(
                    rb"(<dcterms:(created|modified)[^>]*>)[^<]*(</dcterms:\\2>)",
                    rb"\\g<1>2026-01-01T00:00:00Z\\g<3>", data)
            zi = zipfile.ZipInfo(name, date_time=ZIP_DT)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o600 << 16
            out.writestr(zi, data)
    open(path, "wb").write(buf.getvalue())

def save_docx(d, name):
    cp = d.core_properties
    cp.created = cp.modified = EPOCH
    cp.last_modified_by = ""
    cp.revision = 1
    d.save("/corpus/" + name); normalize_zip("/corpus/" + name)

def save_xlsx(wb, name):
    wb.properties.created = wb.properties.modified = EPOCH
    wb.properties.lastModifiedBy = ""
    wb.save("/corpus/" + name); normalize_zip("/corpus/" + name)

def save_pptx(prs, name):
    cp = prs.core_properties
    cp.created = cp.modified = EPOCH
    cp.last_modified_by = ""
    cp.revision = 1
    prs.save("/corpus/" + name); normalize_zip("/corpus/" + name)

def make_png(path, w, h, blocks):
    """Deterministic Pillow image: white canvas + colored rectangles + rules."""
    img = Image.new("RGB", (w, h), (250, 250, 248))
    dr = ImageDraw.Draw(img)
    for (x0, y0, x1, y1, color) in blocks:
        dr.rectangle([x0, y0, x1, y1], fill=color)
    for gx in range(0, w, 40):
        dr.line([(gx, 0), (gx, h)], fill=(220, 220, 220))
    dr.rectangle([0, 0, w - 1, h - 1], outline=(30, 30, 30), width=3)
    img.save(path, format="PNG")

LOREM = ("The quick brown fox jumps over the lazy dog while the diligent "
         "archivist files every page in its proper drawer. ")

# ================================================================== DOCX ====
# t01 — plain letter
d = docx.Document()
d.add_paragraph("Patram Studio")
d.add_paragraph("14 Marigold Lane")
d.add_paragraph("New Delhi 110001")
d.add_paragraph("")
d.add_paragraph("1 January 2026")
d.add_paragraph("")
d.add_paragraph("Dear Reviewer,")
d.add_paragraph("")
d.add_paragraph("This letter exists to measure the plainest possible case: "
                "unstyled body paragraphs in the default template font. "
                + LOREM * 3)
d.add_paragraph("A second paragraph follows to confirm inter-paragraph "
                "spacing survives conversion. " + LOREM * 2)
d.add_paragraph("")
d.add_paragraph("Yours faithfully,")
d.add_paragraph("The Benchmark Harness")
save_docx(d, "t01-plain-letter.docx")

# t02 — built-in styles
d = docx.Document()
d.add_heading("Fidelity Style Sampler", 0)                     # Title
d.add_heading("Chapter One: Headings", level=1)
d.add_paragraph(LOREM * 2)
d.add_heading("Section 1.1: Sub-headings", level=2)
d.add_paragraph(LOREM)
d.add_paragraph("Fidelity is measured, not promised.", style="Intense Quote")
d.add_heading("Section 1.2: Lists", level=2)
for item in ["First bullet", "Second bullet", "Third bullet with a longer tail: " + LOREM]:
    d.add_paragraph(item, style="List Bullet")
for item in ["Step one", "Step two", "Step three"]:
    d.add_paragraph(item, style="List Number")
p = d.add_paragraph("Mixed inline runs: ")
p.add_run("bold, ").bold = True
p.add_run("italic, ").italic = True
r = p.add_run("and colored.")
r.font.color.rgb = RGBColor(0x8B, 0x1A, 0x1A)
save_docx(d, "t02-styles-headings.docx")

# t03 — two ruled tables with merged cells
d = docx.Document()
d.add_heading("Ruled Tables", level=1)
t = d.add_table(rows=4, cols=4)
t.style = "Table Grid"
t.cell(0, 0).merge(t.cell(0, 3)).text = "Quarterly Summary (merged header row)"
for c, label in enumerate(["Region", "Units", "Revenue", "Margin"]):
    t.cell(1, c).text = label
for r, row in enumerate([["North", "120", "1,400", "12%"], ["South", "98", "1,100", "9%"]]):
    for c, v in enumerate(row):
        t.cell(2 + r, c).text = v
d.add_paragraph("")
t2 = d.add_table(rows=3, cols=3)
t2.style = "Table Grid"
t2.cell(0, 0).merge(t2.cell(2, 0)).text = "Merged column"
t2.cell(0, 1).text = "A1"; t2.cell(0, 2).text = "B1"
t2.cell(1, 1).merge(t2.cell(1, 2)).text = "Merged row cell"
t2.cell(2, 1).text = "A3"; t2.cell(2, 2).text = "B3"
save_docx(d, "t03-ruled-tables.docx")

# t04 — inline image
make_png("/img-doc.png", 480, 320, [
    (40, 40, 200, 160, (196, 30, 58)),
    (240, 80, 440, 280, (20, 60, 120)),
    (80, 200, 180, 300, (240, 180, 20)),
])
d = docx.Document()
d.add_heading("Embedded Image", level=1)
d.add_paragraph("Below is a deterministic Pillow-generated PNG, inline, 4.0 inches wide:")
d.add_picture("/img-doc.png", width=Inches(4.0))
d.add_paragraph("Text after the image confirms flow resumes correctly. " + LOREM)
save_docx(d, "t04-images.docx")

# t05 — headers/footers with a PAGE field
def add_page_number_field(paragraph):
    run = paragraph.add_run("Page ")
    r = paragraph.add_run()._r
    fld_b = OxmlElement("w:fldChar"); fld_b.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve"); instr.text = " PAGE "
    fld_e = OxmlElement("w:fldChar"); fld_e.set(qn("w:fldCharType"), "end")
    r.append(fld_b); r.append(instr); r.append(fld_e)

d = docx.Document()
sec = d.sections[0]
hp = sec.header.paragraphs[0]
hp.text = "Patram Fidelity Benchmark — t05"
hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
add_page_number_field(fp)
d.add_heading("Headers, Footers, Fields", level=1)
for i in range(3):
    d.add_heading(f"Part {i + 1}", level=2)
    for _ in range(6):
        d.add_paragraph(LOREM * 4)
save_docx(d, "t05-headers-footers.docx")

# t06 — two-column section via w:cols
d = docx.Document()
d.add_heading("Two-Column Layout", level=1)
for i in range(8):
    d.add_paragraph(f"Column paragraph {i + 1}. " + LOREM * 2)
sectPr = d.sections[0]._sectPr
cols = sectPr.xpath("./w:cols")[0]
cols.set(qn("w:num"), "2")
cols.set(qn("w:space"), "432")   # 0.3" gutter
save_docx(d, "t06-multicolumn.docx")

# t07 — Devanagari
d = docx.Document()
d.add_heading("Devanagari Rendering", level=1)
d.add_paragraph("पत्रम् एक निजी दस्तावेज़ स्टूडियो है। "
                "आपकी फ़ाइलें कभी आपके उपकरण से बाहर नहीं जातीं। "
                "यह अनुच्छेद जटिल लिपि आकार-निर्धारण की परीक्षा है: "
                "क्ष त्र ज्ञ श्र द्ध ट्ठ क्त्र स्त्री कृष्ण।")
d.add_paragraph("Mixed script line: Patram (पत्रम्) means 'document' in Sanskrit.")
save_docx(d, "t07-devanagari.docx")

# t08 — long document, 40+ pages guaranteed via explicit page breaks
d = docx.Document()
d.add_heading("The Long Document", 0)
d.add_paragraph("Forty chapters, one per page minimum — a pagination "
                "endurance test with styled, repeated content.")
d.add_page_break()
for ch in range(1, 41):
    d.add_heading(f"Chapter {ch}: Repetition as Instrument", level=1)
    d.add_paragraph(f"Opening remarks for chapter {ch}.", style="Intense Quote")
    for para in range(4):
        d.add_paragraph(f"[{ch}.{para + 1}] " + LOREM * 5)
    d.add_paragraph(f"Checklist for chapter {ch}:", style="Heading 2")
    for item in ["Margins hold", "Headings styled", "Body flows"]:
        d.add_paragraph(item, style="List Bullet")
    if ch < 40:
        d.add_page_break()
save_docx(d, "t08-long.docx")

# ================================================================== XLSX ====
# s01 — simple grid
wb = Workbook(); ws = wb.active; ws.title = "Grid"
ws.append(["ID", "Item", "Qty", "Unit"])
items = ["Paper", "Ink", "Staples", "Folders", "Labels", "Clips", "Tape", "Pens"]
for i, name in enumerate(items, start=1):
    ws.append([i, name, i * 7, "box"])
save_xlsx(wb, "s01-grid.xlsx")

# s02 — number formats, bold, fills
wb = Workbook(); ws = wb.active; ws.title = "Formats"
head = ["Ledger Entry", "Date", "Amount", "Status"]
ws.append(head)
for c in range(1, 5):
    cell = ws.cell(row=1, column=c)
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="1F3864")
rows = [
    ("Office rent",  datetime(2026, 1, 5),  42500.00, "paid"),
    ("Type foundry", datetime(2026, 1, 12),  8999.50, "paid"),
    ("CDN egress",   datetime(2026, 2, 1),   1240.75, "due"),
    ("Font licences", datetime(2026, 2, 14), 15000.00, "due"),
]
for r, (label, dt, amt, status) in enumerate(rows, start=2):
    ws.cell(row=r, column=1, value=label)
    dc = ws.cell(row=r, column=2, value=dt); dc.number_format = "DD-MMM-YYYY"
    ac = ws.cell(row=r, column=3, value=amt); ac.number_format = '"₹"#,##0.00'
    sc = ws.cell(row=r, column=4, value=status)
    if status == "due":
        sc.fill = PatternFill("solid", fgColor="FCE4D6")
        sc.font = Font(bold=True, color="9C0006")
ws.column_dimensions["A"].width = 18
ws.column_dimensions["B"].width = 14
ws.column_dimensions["C"].width = 14
save_xlsx(wb, "s02-formats.xlsx")

# s03 — 30 columns wide (pagination stress)
wb = Workbook(); ws = wb.active; ws.title = "Wide"
ws.append([f"C{c:02d}" for c in range(1, 31)])
for r in range(1, 21):
    ws.append([r * 100 + c for c in range(1, 31)])
save_xlsx(wb, "s03-wide.xlsx")

# s04 — multiple sheets
wb = Workbook()
for i, sheet in enumerate(["Summary", "North", "South"]):
    ws = wb.active if i == 0 else wb.create_sheet(sheet)
    ws.title = sheet
    ws.append([f"{sheet} report", "", ""])
    ws.append(["Metric", "Plan", "Actual"])
    for m in range(1, 6):
        ws.append([f"{sheet} metric {m}", m * 10, m * 11])
save_xlsx(wb, "s04-multisheet.xlsx")

# s05 — merged cells + borders
wb = Workbook(); ws = wb.active; ws.title = "Merged"
thin = Side(style="thin", color="333333")
box = Border(left=thin, right=thin, top=thin, bottom=thin)
ws.merge_cells("A1:D1"); ws["A1"] = "Merged Banner (A1:D1)"
ws["A1"].font = Font(bold=True, size=14)
ws.merge_cells("A2:A5"); ws["A2"] = "Merged\\ncolumn"
for row in ws["A1:D5"]:
    for cell in row:
        cell.border = box
ws["B2"] = "b2"; ws["C2"] = "c2"; ws["D2"] = "d2"
ws.merge_cells("B3:C4"); ws["B3"] = "merged block B3:C4"
ws["D3"] = "d3"; ws["D4"] = "d4"
ws["B5"] = "b5"; ws["C5"] = "c5"; ws["D5"] = "d5"
save_xlsx(wb, "s05-merged-cells.xlsx")

# ================================================================== PPTX ====
# p01 — title + bullets
prs = Presentation()
s = prs.slides.add_slide(prs.slide_layouts[0])
s.shapes.title.text = "Patram Fidelity Benchmark"
s.placeholders[1].text = "Deterministic corpus, slide one"
s = prs.slides.add_slide(prs.slide_layouts[1])
s.shapes.title.text = "Why measure?"
tf = s.placeholders[1].text_frame
tf.text = "No vendor publishes fidelity numbers"
for txt, lvl in [("We will", 0), ("SSIM per page", 1), ("Pixel diff per page", 1), ("Scorecard in CI", 2)]:
    p = tf.add_paragraph(); p.text = txt; p.level = lvl
save_pptx(prs, "p01-title-bullets.pptx")

# p02 — absolutely positioned shapes
prs = Presentation()
s = prs.slides.add_slide(prs.slide_layouts[6])   # blank
spec = [
    (MSO_SHAPE.RECTANGLE,      0.5, 0.5, 3.0, 1.2, (196, 30, 58),  "Crimson box"),
    (MSO_SHAPE.OVAL,           4.5, 0.8, 2.2, 2.2, (20, 60, 120),  "Oval"),
    (MSO_SHAPE.ROUNDED_RECTANGLE, 1.0, 3.0, 4.0, 1.5, (240, 180, 20), "Rounded"),
    (MSO_SHAPE.RIGHT_ARROW,    5.8, 4.2, 3.0, 1.0, (30, 120, 60),  "Arrow"),
]
for shape_type, x, y, w, h, rgb, label in spec:
    sh = s.shapes.add_shape(shape_type, PInches(x), PInches(y), PInches(w), PInches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = PRGB(*rgb)
    sh.line.color.rgb = PRGB(20, 20, 20)
    sh.text_frame.text = label
tb = s.shapes.add_textbox(PInches(0.5), PInches(6.2), PInches(9.0), PInches(0.8))
tb.text_frame.text = "Absolute positions: any drift shows immediately."
tb.text_frame.paragraphs[0].font.size = PPt(14)
save_pptx(prs, "p02-positioned-shapes.pptx")

# p03 — image slide
make_png("/img-slide.png", 800, 500, [
    (60, 60, 380, 240, (20, 60, 120)),
    (420, 120, 740, 440, (196, 30, 58)),
    (120, 300, 340, 440, (30, 120, 60)),
])
prs = Presentation()
s = prs.slides.add_slide(prs.slide_layouts[6])
s.shapes.add_picture("/img-slide.png", PInches(1.0), PInches(0.8), width=PInches(8.0))
tb = s.shapes.add_textbox(PInches(1.0), PInches(6.2), PInches(8.0), PInches(0.8))
tb.text_frame.text = "Deterministic Pillow PNG placed at (1.0in, 0.8in), 8in wide"
save_pptx(prs, "p03-image-slide.pptx")

# p04 — Two Content layout
prs = Presentation()
s = prs.slides.add_slide(prs.slide_layouts[3])   # Two Content
s.shapes.title.text = "Two Content Layout"
bodies = [ph for ph in s.placeholders if ph.placeholder_format.idx != 0]
left, right = bodies[0], bodies[1]
ltf = left.text_frame; ltf.text = "Left column"
for t in ["engines", "fonts", "metrics"]:
    p = ltf.add_paragraph(); p.text = t; p.level = 1
rtf = right.text_frame; rtf.text = "Right column"
for t in ["corpus", "references", "scorecard"]:
    p = rtf.add_paragraph(); p.text = t; p.level = 1
save_pptx(prs, "p04-two-content-layout.pptx")

print("generated", len(os.listdir("/corpus")), "files")
`);
ok("documents generated in WASM FS");

// ---- copy out + index.json --------------------------------------------------
step("Writing corpus/ + index.json…");
const outDir = new URL("./corpus/", import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const entry of MANIFEST) {
  const bytes = py.FS.readFile("/corpus/" + entry.file);
  if (!bytes.length) throw new Error(entry.file + ": zero bytes");
  writeFileSync(new URL(entry.file, outDir), bytes);
  ok(`${entry.file} (${(bytes.length / 1024).toFixed(1)} KB, tier ${entry.tier})`);
}
writeFileSync(new URL("index.json", outDir), JSON.stringify(MANIFEST, null, 2) + "\n");
ok("index.json (" + MANIFEST.length + " documents)");

step("\n\x1b[32mCORPUS READY\x1b[0m — " + MANIFEST.length + " deterministic documents in test/fidelity/corpus/");
