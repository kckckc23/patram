# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Patram is a privacy-first, fully client-side document toolkit: a **static, no-build,
no-framework** website. Every file in the repo root is a deployed file — no bundler, no
transpiler, no npm at runtime. All processing runs in the user's browser via WASM
engines; files never leave the device, and every user-visible string about processing
must stay literally true about that. `plan.md` is the living roadmap (engine tiers
toward pixel-perfect Office↔PDF; next milestone is Phase 2, x2t.wasm) — read it before
architectural decisions.

## Working agreements

- **Plan → validate → implement.** Non-trivial work starts from plan.md (or a short
  written plan), claims marked uncertain get a spike or probe before being built on,
  and changes are proven by execution (the test harnesses below, or a temporary
  Puppeteer probe for UI claims) before committing.
- **Commit feature-wise**: one focused commit per feature/fix, message style as in
  `git log` (`feat(engine): …`, `fix(ui): …`, body explains the why). Do **not** add
  a Co-Authored-By or any AI-attribution trailer.
- **The user's editor churns CRLF line endings across the tree.** Judge real changes
  with `git diff --ignore-cr-at-eol`, stage only files you intentionally changed, and
  never commit churn-only files. Churn also updates mtimes, which invalidates the Edit
  tool's read state on files you read earlier — re-read, or apply anchored patches via
  a python script for large files (see the scratchpad patch-script pattern).

## Commands

```bash
# serve locally (workers won't load from file://)
python3 -m http.server 8000

# engine verification — the main gate; run before committing engine changes
cd test && npm install
node verify.mjs            # core engine + qpdf.wasm + fonts + overlays + split-zip
node verify.mjs --full     # also PyMuPDF / pdf2docx / pdfplumber (~40 MB, cached in node_modules)

# browser tests (serve on :8231 first: python3 -m http.server 8231)
node smoke.mjs             # boots real engine in Chromium, drives 3 tools
node offline.mjs           # loads once, cuts network, reloads — engines must still work
node ui.mjs                # UI matrix: every registered tool, light engine paths
node ui.mjs --full         # + OCR / PDF→Word / PDF→Excel / Compress max
node ui.mjs --only=merge   # a subset while iterating

# fidelity benchmark (see test/fidelity/README.md)
cd test/fidelity && node gen-corpus.mjs && node compare.mjs --self
# references need LibreOffice or Word (render-references.ps1 on the Windows side)

# patch notes — regenerate after tagging a release (writes patchnotes.json)
git tag v0.4.0 && node tools/gen-patchnotes.mjs

# no lint step; syntax-check with:
node --check <file>.js
python3 -c "import ast; ast.parse(open('pdf_tools.py').read())"
```

WSL note: Puppeteer needs `libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2
libgbm1 libasound2` installed (already done on this machine).

## Architecture

```
app.js (UI controller, single file, no framework)
  ├─ worker.js       → Pyodide MODULE worker → pdf_tools.py   (most tools)
  ├─ qpdf-worker.js  → qpdf.wasm (classic worker)             (protect/unlock/repair/linearize)
  ├─ pdf.js / tesseract.js / jszip / mammoth — lazy <script> on main thread
  └─ sw.js           → offline caching (shell network-first, engines cache-first)
```

- **Worker protocol** (both workers): `postMessage({id, action|op, params, files|file})`
  → messages of type `status` (progress text routed onto the run button), `result`,
  `error`. `pending` Maps in app.js correlate by id.
- **Python dispatch contract** (`pdf_tools.py`): inputs at `/in0…/inN` in the Pyodide
  FS, `dispatch(action, params_json)` writes `/out` (`{"kind":"file"}`) or returns
  JSON (`kind: text|json`). Raise `ValueError` with a human sentence for user-facing
  errors — `humanize()` in worker.js surfaces only that line. Long-running engines
  stream progress via `set_progress()` (a logging handler; ANSI codes are stripped).
- **Lazy engines** (`worker.js requiredEngine()`): `pdfToWord {engine:"hifi"}`→pdf2docx
  (~33 MB), `pdfToXlsx {engine:"hifi"}`→pdfplumber (~8 MB), `compress {mode:"max"}`→
  PyMuPDF (~17 MB). pdf2docx/pdfplumber must install with `deps=False` (their pins
  have no wasm wheels); real deps install explicitly first. The Unicode font pack is
  fetched into FS `/fonts` on the first text-rendering action.
- **Overlay mechanism**: `_overlay_merge()` (fpdf2 canvas merged onto original pages
  via pypdf) powers stamp/watermark/page-numbers, the searchable-OCR text layer
  (fpdf2 INVISIBLE text mode), AND `placeImages` (user-positioned images; the UI
  sends x/y/w/h as fractions of the page box, origin top-left, so a placement is
  page-size independent). Reuse it for anything drawn "onto" existing pages.
- **Batch mode** is a UI-side loop: tools with `batch: true` accept many files, call
  the engine per file, and zip results with JSZip. Single file = unchanged behavior.
- **Every registered tool needs a case in `test/ui.mjs`** — the matrix reads the
  ids out of `TOOLS` and fails if one is uncovered (or if a case names a tool that
  no longer exists), so a new tool cannot ship untested. Fixtures are built once
  into `test/fixtures/` by `ui-fixtures.mjs` (gitignored).
- **UI registry**: `TOOLS` entries → renderer from `ENGINES` keyed by `tool.engine`.
  Optional flags: `heavy {mb,label}` (size-consent + localStorage
  `patram-engine-ok:<id>`), `batch`, `rangeOption`, `printView`, `keys` (extra search
  terms). `runButton(label, {free:true})` for tools that don't need the Python engine.

## Cross-file contracts (easy to break)

- **worker.js MUST stay a module worker** (`{type:"module"}` in app.js + dynamic
  import of `pyodide.mjs`). Pyodide ≥314 is ESM-only; a classic worker fails with an
  error that cross-origin muting turns into a bare NetworkError that looks like a
  CDN/SW failure. This was a production outage — don't regress it.
- **Pyodide version is pinned in three places** that move together: `worker.js`
  (`PYODIDE_VERSION`), `test/verify.mjs` (`CDN`), `test/package.json` (npm `pyodide`).
- **Boot package lists must match** between `worker.js boot()` and verify.mjs's
  install block; heavy-engine recipes must match `ENGINE_SETUP` ↔ verify's `--full`.
- **Package versions are pinned and must stay in step**: `worker.js BOOT_PACKAGES`
  ↔ verify.mjs's `micropip.install`. Unpinned, micropip resolves latest from
  `pypi.org/simple/`, which the SW once cached cache-first — every browser froze
  the versions it first saw, so a code push could meet months-old wheels and throw
  only for returning users. `pypi.org` is network-first for that reason; wheel URLs
  on files.pythonhosted.org are content-addressed and stay cache-first.
- **Service worker rules**: never `respondWith()` for cross-origin non-cors requests
  (Chrome rejects SW-served responses for them — bricks engine boot). Instead make
  every engine load cors-capable at the source: `<script crossorigin>`, qpdf glue via
  cors fetch + indirect eval, pdf.js worker via cors fetch + blob URL. New CDN hosts
  must be added to `ENGINE_HOSTS` or they silently skip offline caching; new shell
  files go in `CORE`; bump `VERSION` on SW changes. `test/offline.mjs` is the gate.
- **Font filenames are load-bearing**: `pdf_tools._register_fonts()` and
  `worker.js FONT_FILES` expect exactly `NotoSans-{Regular,Bold}.ttf` and
  `NotoSansDevanagari-{Regular,Bold}.ttf` in `fonts/` (see manifest `textEngine`).
- **`patchnotes.json` is generated, never hand-edited**: `tools/gen-patchnotes.mjs`
  turns tags + conventional-commit subjects into it, so commit subjects are
  user-facing copy. Release history starts after the "node to py migration"
  commit (the React-era commits describe software that no longer exists) and the
  file is precached in `sw.js CORE`, so bump `VERSION` when it changes shape.
- **Licensing is AGPL-3.0 by design** (unlocks PyMuPDF now, x2t/sdkjs next — plan.md
  §6). Any new runtime component must be AGPL-compatible and listed in `NOTICE` with
  a source link; bundled fonts stay OFL/Apache with texts in `fonts/licenses/`.
- **Do not add COOP/COEP headers** (`vercel.json`) until a SharedArrayBuffer engine
  lands (plan.md §5). The canonical domain is `https://patrampdf.karanchauhan.me/`
  (vercel.app 308-redirects there; canonical/OG tags in index.html must keep it).

## Gotchas

- fpdf2 rejects CFF/'OTTO' fonts; the bundled family has no italic face (italic maps
  to regular); without the pack, text falls back to latin-1 transliteration.
- qpdf exit code 3 = "succeeded with warnings" — treated as success (expected for Repair).
- A CSS transform on a canvas paints it above absolutely-positioned siblings (organize
  thumbnails need their z-index); grid children need `min-width: 0` or long filenames
  blow the column past the viewport on phones.
- `test/verify.mjs` regenerates `samples/sample.pdf`; a dirty samples file after tests
  is normal.
- OCR requires network (tesseract's internal loader defeats SW caching); a hard
  refresh (Ctrl+Shift+R) bypasses caches by browser design.
