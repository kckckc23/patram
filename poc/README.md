# PDF Tools — Pyodide POC

Proof that the app can run **Python in the browser** (Pyodide/WebAssembly) with
**zero file upload** — the whole USP. Static HTML + a Pyodide Web Worker; no React,
no build step, no backend.

## What it proves
- Pyodide loads in a Web Worker and installs the real PDF libraries client-side:
  `pypdf`, `openpyxl`, `fpdf2` (via `micropip` from PyPI), plus `Pillow` + `lxml`
  (Pyodide-built). `python-docx` also imports (the lxml-dependent path works).
- **Compress PDF** (`pypdf` + `Pillow`) returns a *valid* PDF — fixing the old
  client that sliced bytes and produced corrupt files.
- **Excel/CSV → PDF** (`openpyxl` / stdlib `csv` + `fpdf2`) renders a real table PDF.

## Files
| File | Role |
|------|------|
| `index.html` | Static UI (plain HTML/CSS/JS) |
| `worker.js` | Loads Pyodide from CDN, installs packages, runs Python off the UI thread |
| `pdf_tools.py` | The processing logic that runs in the browser |
| `verify.mjs` | Headless proof via Node + Pyodide (no browser needed) |
| `samples/` | `sample.pdf`, `sample.csv` to try in the browser |

## Run in a browser
```bash
cd poc
python3 -m http.server 8123
# open http://localhost:8123  (must be http://, not file://, for the worker)
```
First load downloads the Pyodide runtime (~a few MB, cached after). Try
`samples/sample.pdf` (Compress) and `samples/sample.csv` (Excel/CSV → PDF).

## Headless verification (CI-friendly, no browser)
```bash
cd poc
npm install          # installs the `pyodide` node package (dev-only; browser uses CDN)
node verify.mjs      # installs packages in WASM, runs both tools, validates output
```
`node_modules/` is only for this test — the deployed static site never needs it.

## Notes / known limits (by design, not bugs)
- fpdf2 core fonts are latin-1; `pdf_tools.py` sanitizes text. Full Unicode needs a
  bundled TTF (`pdf.add_font(...)`) — a later step.
- Real *image-heavy* compression is modest (lossless streams + Pillow re-encode);
  Ghostscript-grade compression is impossible in-browser (would need a server + upload).
- OCR will stay on `tesseract.js` (also WASM, also local) — no clean Python OCR in Pyodide.
