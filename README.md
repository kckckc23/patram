# Patram — पत्रम् · a private, on-device PDF studio

> *Patram* (पत्रम्) is Sanskrit for "leaf, page" — the palm leaf that Indian scribes
> wrote on for centuries. Your documents stay just as private.

Merge, split, delete, organize, compress, protect, repair, OCR and convert PDFs —
**entirely in the browser**. The processing engines are real native libraries compiled
to WebAssembly — **Python (pypdf, fpdf2, openpyxl, python-docx, python-pptx) via
[Pyodide](https://pyodide.org)**, plus **qpdf** for encryption/repair and, on demand,
**PyMuPDF / pdf2docx / pdfplumber** for the high-fidelity tools — all running in Web
Workers on the user's own machine. Files are never uploaded; there is no server, no
account, and it works offline once loaded (a service worker caches the shell and every
engine).

## How it works

```
index.html + styles.css + app.js            ← static UI (no framework, no build)
        │  postMessage (file bytes)
        ├────────────────────────────────────────────────┐
        ▼                                                ▼
worker.js → Pyodide (Python/WASM) → pdf_tools.py    qpdf-worker.js → qpdf.wasm
        │     ├ core: pypdf, fpdf2, openpyxl,            (AES-256 encrypt/decrypt,
        │     │       python-docx, python-pptx            repair, linearize)
        │     └ on demand: PyMuPDF (compression),
        │                  pdf2docx (PDF→Word),
        │                  pdfplumber (PDF→Excel),
        │                  /fonts (Unicode rendering)
        └ pdf.js + tesseract.js (also WASM, also local) → PDF→Images and OCR

sw.js  ← service worker: shell network-first, engines cache-first → real offline
```

- **Core Python tools** (`pdf_tools.py`, run in `worker.js`): merge, split, delete,
  organize & rotate, compress, PDF↔Text, images→PDF, Word↔PDF, Excel/CSV↔PDF,
  PowerPoint↔PDF.
- **High-fidelity tools** (engines fetched on first use, with a size disclosure, then
  cached for offline): PDF→Word rebuilds flowing text/tables/images via **pdf2docx**
  (~33 MB); PDF→Excel detects real tables via **pdfplumber** (~8 MB); Compress
  "Maximum" downsamples images Ghostscript-style via **PyMuPDF** (~17 MB).
- **qpdf tools** (`qpdf-worker.js`, ~1.3 MB): Protect (AES-256), Unlock, Repair
  (xref recovery), Linearize (fast web view).
- **In-browser JS tools**: PDF→Images (pdf.js) and OCR (tesseract.js).
- **Fonts** (`fonts/`): an OFL-licensed pack — Noto Sans + Noto Sans Devanagari for
  Unicode PDF generation (loaded into the engine on first text-rendering job), plus
  metric-compatible substitutes for common Office fonts (Carlito↔Calibri,
  Caladea↔Cambria, Arimo↔Arial, Tinos↔Times New Roman, Cousine↔Courier New) staged
  for the conversion-fidelity roadmap in `plan.md`.

## Interface

A single screen with a persistent, sticky **identity panel** on the left (the mandala
seal, the thesis, and a live boot readout of the Python engine starting up) and an
**illuminated tool index** on the right — every tool as a card, filtered by category
pills or full-text search (`⌘K`). Picking a tool opens its workbench in place; *Back to
all tools* returns to the index. Heavy tools state their one-time engine download size
before the first run. The layout is fully responsive: the sidebar folds into a banner
on tablets and stacks on phones.

The visual language is a digital palm-leaf scriptorium — a palette named for the
pigments of Indian manuscripts (haldi/turmeric, sindoor/vermilion, neel/indigo,
mehendi/henna) on an aged palm-leaf ground, set in Rozha One, Mukta and JetBrains Mono.

Design explorations live in `poc/` (`layouts.html` for layout studies, `fonts.html`
for body-font comparisons) — reference only, not shipped.

## Run locally

It's static — any web server works (a server is needed so the Web Workers can load;
`file://` won't work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

First load downloads the Pyodide runtime and packages (a few MB, then cached). Heavy
engines download only when their tool is first used. After that it runs offline.

## Deploy

Static hosting, zero build. On **Vercel**, import the repo — `vercel.json` sets it to
serve the root with no build step. Any static host (Netlify, GitHub Pages, S3) works too.

## Tests

Two harnesses plus a fidelity benchmark, all dev-only (`test/node_modules` is never
deployed):

**`verify.mjs`** — boots Pyodide in Node and drives every operation in `pdf_tools.py`
against generated fixtures, plus the qpdf.wasm operations and the Unicode font paths.
A fast, browserless end-to-end check of the engines:

```bash
cd test && npm install
node verify.mjs          # core engine + qpdf + fonts
node verify.mjs --full   # also PyMuPDF, pdf2docx, pdfplumber (~40 MB download, once)
```

**`smoke.mjs`** — launches headless Chromium (Puppeteer) against the running site,
boots the real engine in the browser, and drives the UI for two tools. Serve the site
on port `8231` first:

```bash
python3 -m http.server 8231        # in one terminal
cd test && npm install && node smoke.mjs   # in another
```

**`test/fidelity/`** — the conversion-fidelity benchmark (corpus of Office documents,
reference renders from LibreOffice/Word, SSIM scorecards). See `test/fidelity/README.md`
and `plan.md` §7.

## Roadmap

`plan.md` is the living plan for near-pixel-perfect, fully on-device Office↔PDF
conversion: the x2t.wasm fidelity engine, the sdkjs print pipeline, local-font capture
(`queryLocalFonts`) for exact layout, and the optional Patram Bridge native helper.

## Limitations (honest)

- Office→PDF conversions currently preserve **text, headings, tables and structure**,
  not pixel-perfect layout — the fidelity-engine tiers in `plan.md` are how that
  changes. Word→PDF additionally offers a **print view** (docx→HTML via mammoth →
  your browser's own print engine) that keeps bold/lists/tables/images; choose
  "Save as PDF" in the dialog.
- PDF→PowerPoint's default mode renders each page as a full-slide image —
  pixel-faithful but not editable; an editable text-extraction mode is offered
  alongside.
- PDF→Word is layout-aware (pdf2docx tier): flowing paragraphs, ruled tables and
  images reconstruct well; borderless tables, dense multi-column layouts and scanned
  pages (run OCR first) do not.
- Complex-script *shaping* (Devanagari conjuncts, Arabic) in generated PDFs is
  approximate until a HarfBuzz-class shaper lands; characters are correct, ligature
  forms may not be.
- Offline is real but has edges: a **hard refresh** (Ctrl+Shift+R) deliberately
  bypasses the cache and re-downloads; OCR still needs the network (tesseract's
  internal loader defeats caching); heavy engines are cached only after their
  first use. On Safari, cached engines are purged after ~7 days without a visit
  (WebKit storage policy) — the affected tool simply re-downloads on next use.
- Heavy tools are desktop-grade: PDF→Word needs several hundred MB of memory and is
  gated accordingly on low-memory devices.

## License

Patram is free software under the **GNU AGPL-3.0** (see `LICENSE`). Bundled fonts are
OFL/Apache (see `fonts/licenses/`), and runtime engines remain under their own
licenses with sources linked in `NOTICE` — including the AGPL-licensed PyMuPDF, whose
adoption is why the repo is AGPL.
