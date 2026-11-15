import { I, CATICON } from "./icons.js";

export const TOOLS = [
  { group: "Assemble" },
  { id: "merge", name: "Merge PDFs", badge: "PYTHON",
    desc: "Combine several PDFs into one. Drag or use the arrows to order them.",
    engine: "merge", accept: ".pdf", multiple: true },
  { id: "split", name: "Split PDF", badge: "PYTHON",
    desc: "Keep a single range of pages as a new document.",
    engine: "range" },
  { id: "delete", name: "Delete pages", badge: "PYTHON",
    desc: "Remove pages by number or range, e.g. 2, 5-8.",
    engine: "delete" },
  { id: "organize", name: "Organize & rotate", badge: "PYTHON",
    desc: "Reorder, rotate, or drop pages, then rebuild the PDF.",
    engine: "organize" },
  { id: "stamp", name: "Stamp & page numbers", badge: "PYTHON",
    desc: "Add a watermark, header/footer text, or page numbers.",
    keys: "watermark confidential draft header footer number stamp",
    engine: "stamp" },
  { id: "imgOnPdf", name: "Add image to PDF", badge: "PYTHON",
    desc: "Drop a logo, signature or photo anywhere on a page, then save.",
    keys: "signature sign logo photo picture insert place overlay paste seal",
    engine: "imgOnPdf", accept: ".pdf" },

  { group: "Optimize" },
  { id: "compress", name: "Compress PDF", badge: "PYTHON",
    desc: "Shrink file size — lossless cleanup up to full image downsampling.",
    engine: "compress" },
  { id: "linearize", name: "Linearize PDF", badge: "QPDF",
    desc: "Optimize for fast page-by-page web viewing (qpdf).",
    engine: "qpdf", qpdf: "linearize", accept: ".pdf", suffix: "_linearized" },

  { group: "Protect & repair" },
  { id: "protect", name: "Protect PDF", badge: "QPDF",
    desc: "Encrypt with a password — AES-256, applied on your device.",
    engine: "qpdf", qpdf: "encrypt", accept: ".pdf", suffix: "_protected" },
  { id: "unlock", name: "Unlock PDF", badge: "QPDF",
    desc: "Remove a password you know from a PDF.",
    engine: "qpdf", qpdf: "decrypt", accept: ".pdf", suffix: "_unlocked" },
  { id: "repair", name: "Repair PDF", badge: "QPDF",
    desc: "Rebuild a damaged file's structure (cross-reference recovery).",
    engine: "qpdf", qpdf: "repair", accept: ".pdf", suffix: "_repaired" },
  { id: "metaStrip", name: "Strip metadata", badge: "PYTHON",
    desc: "Remove author, title, software traces and XMP data from a PDF.",
    keys: "privacy metadata author anonymize clean hidden",
    engine: "convert", action: "stripMeta", accept: ".pdf", out: "pdf", suffix: "_clean", batch: true },

  { group: "Extract" },
  { id: "pdfText", name: "PDF → Text", badge: "PYTHON",
    desc: "Pull the selectable text layer out of a PDF.",
    engine: "text" },
  { id: "ocr", name: "OCR scanned PDF", badge: "IN-BROWSER",
    desc: "Read text from scanned/image PDFs with on-device OCR.",
    engine: "ocr" },
  { id: "pdfImg", name: "PDF → Images", badge: "IN-BROWSER",
    desc: "Render each page to a JPG — save one, all of them, or a zip.",
    engine: "pdf2img" },

  { group: "Convert to PDF" },
  { id: "imgPdf", name: "Images → PDF", badge: "PYTHON",
    desc: "Place JPG/PNG images onto pages, one per image.",
    keys: "img image photo picture pictures jpeg scan",
    engine: "images" },
  { id: "txtPdf", name: "Text → PDF", badge: "PYTHON",
    desc: "Type or paste text (or load a .txt) and export a PDF.",
    engine: "compose" },
  { id: "wordPdf", name: "Word → PDF", badge: "PYTHON",
    desc: "Convert a .docx to PDF — quick re-typeset, or full formatting via your browser's print engine.",
    keys: "docx doc word document",
    engine: "convert", action: "wordToPdf", accept: ".docx", out: "pdf", suffix: "",
    batch: true, printView: true },
  { id: "xlsxPdf", name: "Excel / CSV → PDF", badge: "PYTHON",
    desc: "Render a spreadsheet as a formatted table PDF.",
    engine: "table" },
  { id: "pptPdf", name: "PowerPoint → PDF", badge: "PYTHON",
    desc: "Lay out each slide's text on a landscape PDF.",
    engine: "convert", action: "pptToPdf", accept: ".pptx", out: "pdf", suffix: "", batch: true },

  { group: "Convert from PDF" },
  { id: "pdfWord", name: "PDF → Word", badge: "PYTHON",
    desc: "Rebuild an editable .docx — flowing text, tables and images.",
    engine: "convert", action: "pdfToWord", accept: ".pdf", out: "docx", suffix: "",
    params: { engine: "hifi" }, fallbackParams: { engine: "basic" },
    rangeOption: true, batch: true,
    heavy: { mb: 33, label: "high-fidelity engine (pdf2docx)" } },
  { id: "pdfXlsx", name: "PDF → Excel", badge: "PYTHON",
    desc: "Detect real tables into an .xlsx workbook, sheet per page.",
    engine: "convert", action: "pdfToXlsx", accept: ".pdf", out: "xlsx", suffix: "",
    params: { engine: "hifi" }, fallbackParams: { engine: "basic" }, batch: true,
    heavy: { mb: 8, label: "table-detection engine (pdfplumber)" } },
  { id: "pdfPpt", name: "PDF → PowerPoint", badge: "PYTHON",
    desc: "Each page becomes a slide, pixel-faithful — or extract editable text instead.",
    keys: "pptx slides presentation",
    engine: "pdf2ppt", accept: ".pdf" },
];

export const CATS = [];
export const TOOLLIST = [];
export const TOOLMAP = new Map();

(function deriveTools() {
  let cat = null, n = 0;
  TOOLS.forEach((t) => {
    if (t.group) { cat = t.group; CATS.push(cat); return; }
    n++; t._code = String(n).padStart(2, "0"); t._cat = cat;
    TOOLLIST.push(t);
    TOOLMAP.set(t.id, t);
  });
})();
