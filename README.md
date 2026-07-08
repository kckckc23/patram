# Patram — पत्रम् · a private, on-device PDF studio

> *Patram* (पत्रम्) is Sanskrit for "leaf, page" — the palm leaf that Indian scribes
> wrote on for centuries. Your documents stay just as private.

Merge, split, delete, organize, compress, OCR and convert PDFs — **entirely in the
browser**. The processing engine is **Python (pypdf, fpdf2, openpyxl, python-docx,
python-pptx) compiled to WebAssembly via [Pyodide](https://pyodide.org)** and run in
a Web Worker on the user's own machine. Files are never uploaded; there is no server,
no account, and it works offline once loaded.

## How it works

```
index.html + styles.css + app.js        ← static UI (no framework, no build)
        │  postMessage (file bytes)
        ▼
worker.js  → Pyodide (Python/WASM)  → pdf_tools.py   ← all document processing
        │
        └ pdf.js + tesseract.js (also WASM, also local) → PDF→Images and OCR
```

- **Python tools** (`pdf_tools.py`, run in `worker.js`): merge, split, delete,
  organize & rotate, compress, PDF↔Text, images→PDF, Word↔PDF, Excel/CSV↔PDF,
  PowerPoint↔PDF.
- **In-browser JS tools**: PDF→Images (pdf.js) and OCR (tesseract.js) — both need
  page rasterization, so they use WASM libraries loaded from a CDN and run locally.

## Interface

A single screen with a persistent, sticky **identity panel** on the left (the mandala
seal, the thesis, and a live boot readout of the Python engine starting up) and an
**illuminated tool index** on the right — every tool as a card, filtered by category
pills or full-text search (`⌘K`). Picking a tool opens its workbench in place; *Back to
all tools* returns to the index. The layout is fully responsive: the sidebar folds into
a banner on tablets and stacks on phones.

The visual language is a digital palm-leaf scriptorium — a palette named for the
pigments of Indian manuscripts (haldi/turmeric, sindoor/vermilion, neel/indigo,
mehendi/henna) on an aged palm-leaf ground, set in Rozha One, Mukta and JetBrains Mono.

Design explorations live in `poc/` (`layouts.html` for layout studies, `fonts.html`
for body-font comparisons) — reference only, not shipped.

## Run locally

It's static — any web server works (a server is needed so the Web Worker can load;
`file://` won't work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

First load downloads the Pyodide runtime and packages (a few MB, then cached by the
browser). After that it runs offline.

## Deploy

Static hosting, zero build. On **Vercel**, import the repo — `vercel.json` sets it to
serve the root with no build step. Any static host (Netlify, GitHub Pages, S3) works too.

## Tests

Two harnesses, both dev-only (`test/node_modules` is never deployed):

**`verify.mjs`** — boots Pyodide in Node and drives every operation in `pdf_tools.py`
against generated fixtures. A fast, browserless end-to-end check of the engine:

```bash
cd test && npm install && node verify.mjs
```

**`smoke.mjs`** — launches headless Chromium (Puppeteer) against the running site,
boots the real engine in the browser, and drives the UI for two tools (Compress and
PDF→Text). Serve the site on port `8231` first:

```bash
python3 -m http.server 8231        # in one terminal
cd test && npm install && node smoke.mjs   # in another
```

## Limitations (honest)

- Office conversions preserve **text, headings, tables and structure**, not
  pixel-perfect layout — that needs a native engine (LibreOffice) and a server.
- Compression is lossless streams + optional image recompression; Ghostscript-grade
  compression isn't possible in-browser.
- Generated PDFs currently use latin-1 core fonts (non-latin text is transliterated);
  bundling a Unicode TTF is a planned enhancement.
