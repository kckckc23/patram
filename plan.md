# Patram — the Pixel-Fidelity Plan

*Drafted 2026-07-10 from a seven-area research sweep (web sources current to July 2026; one
finding verified by actually executing the code under Pyodide). Sources cited inline.
Claims marked ⚠ still need a hands-on spike before we bet the roadmap on them.*

---

## 0. The verdict first

**"A website that does the processing in the client's own browser and gives pixel-perfect
conversion" is buildable — with two honest asterisks.**

It is *commercially proven*: Apryse WebViewer converts DOCX/XLSX/PPTX→PDF entirely
in-browser with a **3.8 MB** (brotli) WASM office worker; Nutrient (PSPDFKit) and
e-iceblue Spire do the same with .NET-compiled-to-WASM engines (12–66 MB). Nobody
reimplemented Office layout in JS — every one of them **compiled a mature native layout
engine to WASM**. That is the route, and it's open to us via open-source engines.
(Licensing any commercial engine is out: no free tiers; ~$25k/yr median for Apryse.)

It is *open-source proven*: CryptPad has shipped client-side, ONLYOFFICE-fidelity
DOCX→PDF since ~2021 using `x2t.wasm` + the sdkjs layout engine — no server, no upload.
ZIZIYI Office (Jan 2026, 1.1k stars) does the same offline on Cloudflare Pages.

The two asterisks:

1. **Fonts are the fidelity ceiling, not the engine.** If the document's real fonts
   aren't available, *no engine on earth* reproduces its pagination exactly. Metric-compatible
   substitutes (Carlito↔Calibri etc.) get ~99% there; the Local Font Access API
   (Chrome/Edge desktop) gets us the user's *actual* fonts for true metrics. Aptos —
   Microsoft's default font since 2024 — has **no open substitute** and cannot be bundled;
   reading it off the user's machine is the *only* way. So "pixel-perfect" is honestly
   achievable *when the fonts are present*, and "visually faithful" otherwise.
2. **No vendor promises "pixel perfect" in writing** — Apryse says "maintains the original
   document fidelity", Nutrient says "industry-leading fidelity". We should match that
   honesty: promise *"the highest-fidelity conversion that runs on your own device"*, and
   let a published benchmark do the bragging.

So: we don't have to choose between ChatGPT's Options A/B/C. We build a **ladder of
engines**, all on-device, each rung a strict fidelity upgrade, with the existing Python
engine as the always-works floor and an optional native Bridge as the ceiling.

```
Tier 0  Pyodide + pypdf/fpdf2 (today)      structure-preserving   ~13 MB   all browsers
Tier 1  qpdf / PyMuPDF / real fonts        better PDF plumbing    +1–17 MB all browsers
Tier 2  x2t.wasm (ONLYOFFICE core)         office↔office, native  +6.8 MB  all browsers
Tier 3  sdkjs print pipeline (CryptPad     office→PDF, near-      +tens MB desktop
        pattern)  — or ZetaOffice (spike)  pixel-perfect
Local   queryLocalFonts                    exact user fonts       0        Chrome/Edge
Bridge  Patram Bridge (Tauri + LibreOffice true pixel-perfect     ~5 MB    separate
        / Word COM)                        (Word's own engine)    install  app
```

---

## 1. What we ship today, and why it can't get there from here

`pdf_tools.py` converts Office files by walking their *structure* (python-docx /
openpyxl / python-pptx) and re-typesetting into fpdf2 with hardcoded styles. There is no
layout engine in the chain, so fidelity is capped at "readable", permanently. Two deeper
holes the research confirmed:

- fpdf2's complex-script shaping needs **uharfbuzz, which has no Pyodide wheel** — so
  Devanagari (our own brand script!) cannot render correctly through the current path.
- fpdf2 **rejects CFF-outline OTFs** ("Postscript outlines are not supported") — many
  macOS system fonts and all Noto CJK OTFs.

Tier 0 stays — it's small, universal, and fine for merge/split/organize and quick
conversions — but the fidelity story moves to new engines.

---

## 2. The engine ladder in detail

### Tier 1 — quick wins inside the current architecture (weeks, not months)

All of these drop into the existing worker pattern; none needs COOP/COEP.

| Move | What it buys | Cost | License |
|---|---|---|---|
| **qpdf-wasm** (`@neslinesli93/qpdf-wasm` 0.3.0 = qpdf 12.2.0) | Linearize ("fast web view"), AES-256 encrypt/decrypt, repair damaged PDFs (xref recovery), lossy image recompression (`--optimize-images --jpeg-quality`) | **1.33 MB** wasm (~0.6 MB wire) | Apache-2.0 ✅ |
| **PyMuPDF Pyodide wheel** (official, in the Pyodide CDN index) | `Document.rewrite_images(dpi_threshold, dpi_target, quality)` = the only client-side Ghostscript-/ebook-style **downsampling compression**; far better PDF→text than pypdf | 16.7 MB wheel, lazy-loaded | AGPL-3.0 ⚠ license gate (§6) |
| **pdf2docx under Pyodide** — **verified by execution** during research (Pyodide 314.0.2: 5-page PDF→DOCX in 1.06 s, tables intact) | A real PDF→Word tool: flowing paragraphs, ruled tables, images — replaces our text-dump | ~33 MB of wheels (pymupdf + opencv-python + numpy…), lazy | pdf2docx MIT; PyMuPDF AGPL ⚠ |
| **pdfplumber under Pyodide** (verified installable; `deps=False` trick) | Layout-aware `extract_tables()` → openpyxl = a real PDF→Excel | ~8 MB wheels | MIT ✅ |
| **Bundled Unicode fonts for fpdf2** (Noto Sans + Noto Sans Devanagari TTFs) | Kills the latin-1 transliteration shame in text→PDF | ~2.7 MB assets | OFL ✅ |
| **Pyodide bump 0.28.1 → 314.x** | Required for the verified pdf2docx recipe; Python 3.14 | — | MPL-2.0 |
| *(optional)* **@embedpdf/pdfium** 2.14.4 | New "flatten forms/annotations" tool (`FPDFPage_Flatten` verified in typings); higher-fidelity rendering than pdf.js on hard files | 4.63 MB wasm | MIT/Apache ✅ |

Verified integration recipe for pdf2docx (executed successfully in research):
`micropip.install(["pymupdf","opencv-python","numpy","python-docx","fonttools","fire"])`
then `micropip.install("pdf2docx", deps=False)` (its `opencv-python-headless` pin is the
only obstacle; Pyodide's `opencv-python` provides the same `cv2`).

Memory reality check: the full pdf2docx pipeline measured **~700 MB RSS** in Node —
fine on desktop, fatal on low-end mobile. Gate heavy tools by `navigator.deviceMemory` /
UA and warn honestly.

Notes: Ghostscript-WASM exists (AGPL, ~16 MB, no canonical maintained npm build) but
PyMuPDF's `rewrite_images` covers the same compression need inside our existing Python
worker — prefer it. pdfcpu-wasm (25 MB, overlaps pypdf) is not worth the payload.
mupdf.js (3.6 MB br, AGPL) is a fine render/redact engine but its writer can't
downsample and linearize was removed — qpdf + PyMuPDF cover us.

### Tier 2 — x2t.wasm: ONLYOFFICE's converter core, in a worker (the fidelity workhorse)

`cryptpad/onlyoffice-x2t-wasm` (v9.3.0+0, Apr 2026, tracking ONLYOFFICE core 9.3) is the
canonical, actively maintained build. **6.8 MB brotli on the wire** (36 MB raw), no
pthreads → **no COOP/COEP needed**, runs in a classic worker via MEMFS.

What it gives us: **native-engine office↔office conversion** — docx/doc/odt/rtf/txt/html,
xlsx/xls/ods/csv, pptx/ppt/odp — the same C++ OOXML codebase as ONLYOFFICE Document
Server. This immediately upgrades every "Word↔", "Excel↔", "PowerPoint↔" tool that
isn't PDF-bound, and adds formats we don't have (ODF, RTF, legacy .doc/.xls/.ppt).

What it does **not** give us: direct DOCX→PDF. The `doctrenderer` layout component is
deliberately stubbed out of the WASM build (`doctrenderer_empty.cpp` in the Dockerfile).
x2t can only *assemble* a PDF from a pre-rendered `pdf.bin` — which is exactly what
Tier 3 supplies.

Integration facts (from CryptPad's production `x2t.js`):
- Per job: fresh module instance (known cross-conversion **memory leak** — upstream runs
  x2t as a one-shot CLI), `FS.mkdir /working{,media,fonts,themes}`, write input +
  `params.xml` (`TaskQueueDataConvert`, `<m_sFontDir>/working/fonts/</m_sFontDir>`),
  `ccall('main1')`, read output. Format IDs: docx=65, xlsx=257, pptx=129, pdf=513…
- Fonts are **not** baked in — we supply TTFs into `/working/fonts` per job (this is a
  feature: it's our injection point for both the substitute pack and local fonts, §3).
- Version pinning: v9.3.0 has an open large-file regression (80 MB pptx OOMs, issue #12)
  and CryptPad prod still pins v7.3+1. **Pin v8.3.0+0 initially** (62.5 MB raw / 23.5 MB
  zip), benchmark v9.3.0 before adopting. ⚠ spike.
- PDF *input* (pdf→docx via x2t's PdfFile) is compiled in but unproven in WASM. ⚠ spike;
  pdf2docx covers this regardless.

### Tier 3 — the crown: near-pixel-perfect Office→PDF, fully client-side

Two candidate routes; we spike both against the benchmark (§7) and ship the winner.
Route A is the favorite on evidence.

**Route A — the CryptPad pipeline (x2t + sdkjs), proven in production since 2021:**

```
DOCX ── x2t.wasm ──▶ editor .bin ── sdkjs (ONLYOFFICE's JS layout engine,
                                     hidden iframe, offline dist) ──▶ pdf.bin
     ◀────────────── final PDF ◀── x2t.wasm merges bin + pdf.bin,
                                    embeds fonts from /working/fonts
```

- Fidelity: ONLYOFFICE-grade — the best OOXML fidelity in open source, same engine
  family the commercial world validates.
- Cost: the sdkjs/web-apps dist is heavy (ZIZIYI's all-three-editors asset release is
  606 MB unzipped; per-format lazy slices are tens of MB) and integration is real work:
  offline mock of the editor's server API, print-pipeline driving, version-locking sdkjs
  to the x2t release. CryptPad and ZIZIYI are our two reference codebases.
- Same trick works for XLSX→PDF (spreadsheet sdkjs) and PPTX→PDF (presentation sdkjs).

**Route B — ZetaOffice / LibreOffice-WASM (zetajs), the "whole office suite" hammer:** ⚠

- Real: zetajs (MIT, v1.2.0) has a headless `convertpdf` example; fonts injectable
  pre-boot into `/instdir/share/fonts/truetype/` (proven by mapo80/libreoffice-web).
  LibreOffice core is MPL-2.0 — the friendliest license on the board.
- Brutal: ~250 MB artifacts (154 MB soffice.wasm + 95 MB data), 20–90 s cold start,
  500 MB–1 GB RAM, **pthreads → SharedArrayBuffer → COOP/COEP site-wide** (with all the
  cross-origin fallout of §5). An independent Feb 2026 test called it "still
  unrealistic/unstable for production." The failed research agent for this area means
  these numbers are cross-referenced from three other dossiers but unverified by a
  dedicated pass — all the more reason it's a spike, not a commitment.
- Verdict: keep as a spike / possible future "Studio mode"; don't put it on the
  critical path.

### Bridge — Patram Bridge, the native ceiling (optional install, still zero upload)

A ~5 MB Tauri app serving `http://127.0.0.1:<port>`, detected by the site on an explicit
"Connect" click. Verified 2026 platform reality:

- **Chrome 142+ gates localhost with the "Apps on device" permission** (Local Network
  Access replaced PNA preflights); Chrome 145 split `loopback-network` from
  `local-network`; Chrome 147 extended it to WebSockets. One prompt, then persistent.
  Firefox 150 ships its own LNA with prompting. **Safari cannot reach a plain-HTTP
  localhost daemon at all** (mixed-content, WebKit bug open since 2017) — hide Bridge UI
  there. Brave only lets allowlisted sites prompt (apply to their list, or wait for
  their Chromium-LNA migration).
- Precedents that survive LNA with fine UX: Figma's font agent (127.0.0.1:44950),
  Dynamsoft's TWAIN service (their docs are a ready-made LNA-UX playbook).
- Bridge internals: detect system **LibreOffice** (`soffice` on PATH) and keep it warm
  unoserver-style (2–4× throughput vs cold starts); on Windows, detect **Word and drive
  it via COM** (docx2pdf pattern) — *that* is literal pixel-perfect, Word's own engine.
  Offer LibreOffice download-on-demand (~351 MB) rather than bundling (also dodges
  Tauri's NSIS sidecar-update bug #15134).
- Hardening (GitHub Security Lab baseline): bind 127.0.0.1 only; validate Host header
  (kills DNS rebinding); exact-match Origin allowlist echoed via CORS (never `*`);
  pairing token as Authorization header; prefer plain fetch over WS.
- Distribution on an OSS budget: SignPath Foundation (free OSS Windows signing) or Azure
  Artifact Signing $9.99/mo (⚠ individual onboarding is US/Canada-only — as an
  individual maintainer elsewhere, Certum OSS ~$50–90/yr is the fallback); Apple
  $99/yr + notarization (mandatory since Sequoia); Tauri updater via signed manifests on
  GitHub Releases, free.

---

## 3. Fonts — the actual pixel-perfection problem

**Baseline pack (all browsers, bundled, license-clean):** Carlito (=Calibri), Caladea
(=Cambria), Liberation Sans/Serif/Mono or Croscore Arimo/Tinos/Cousine
(=Arial/Times/Courier New), Noto Sans + **Noto Sans Devanagari** (647 KB — our own script
ships day one). All OFL/Apache; serve OFL.txt alongside. Base pack ≈ 2–3 MB, lazy CJK
subsets only when a document needs them (Noto CJK is 9.6–17.8 MB raw; per-document
subsets are 100–700 KB). Mirror LibreOffice 26.2's updated FontSubstTable for the long
tail (Candara/Consolas/Segoe→ substitutes).

**Exact mode (Chrome/Edge desktop):** `queryLocalFonts({ postscriptNames: [...] })` —
behind an explicit user action ("Use my computer's fonts for exact layout"). We already
unzip OOXML, so we read the declared font names from `fontTable.xml`, request exactly
those, get **complete SFNT bytes** via `FontData.blob()`, and write them into the
engine's MEMFS (`/working/fonts/Name[_Bold][_Italic].ttf`) — byte-for-byte the CryptPad
injection pattern; typst.ts ships the same queryLocalFonts→WASM flow in production. The
bytes never leave the worker: fully consistent with the pledge. Check each font's
`fsType` embedding bits before embedding in output PDFs. Safari/Firefox: never coming
(Mozilla position stalled since 2020) — substitutes are the path there.

**The Aptos problem, stated honestly:** default M365 font since 2024, no metric
substitute exists (TDF confirmed, Mar 2026), EULA forbids bundling. Local-font capture
is the *only* pixel-true path for post-2024 default documents. This single fact makes
"exact mode" a headline feature, not a nicety.

**Subsetting before embedding:** fonttools (pyftsubset) + brotli are already in the
Pyodide index — subset in the existing Python worker; or harfbuzz-subset.wasm (496 KB)
on the JS side. Caveat from §1: substitutes are ~99% pagination-true, not 100 —
documented glyph-width edge cases exist (google/fonts #9720). Never claim "pixel-perfect
with substituted fonts."

---

## 4. PDF → Office (the reverse direction, right-sized)

- **PDF→Word:** pdf2docx (MIT) under Pyodide — *verified working by execution*. Ceiling
  is "pdf2docx tier": flowing paragraphs, ruled tables, images, simple multi-column. The
  commercial bar (Solid Framework, powers Acrobat) has no WASM offering at all, so this
  is genuinely state-of-the-open-art client-side. Scanned PDFs route through the
  existing tesseract.js OCR first.
- **PDF→Excel:** pdfplumber `extract_tables()` → openpyxl (both verified under Pyodide).
- **PDF→PowerPoint:** no OSS client-side path exists. Ship page-images-on-slides
  (pdf.js render → python-pptx) honestly labeled, or drop the tool.
- LibreOffice is a dead end for this direction (Draw imports PDFs as per-line text
  frames → "text-box soup").

---

## 5. Platform rules (verified, they shape everything)

1. **Do not add COOP/COEP until a SAB engine lands.** Nothing in Tiers 0–2 needs it —
   Pyodide only needs SAB for keyboard interrupts; x2t has no pthreads. Only ZetaOffice
   forces isolation. If/when we flip it: `require-corp` (Safari still lacks
   `credentialless`), and it works on Vercel static via `vercel.json` headers.
   cdn.jsdelivr.net already sends CORP + ACAO:* (verified by curl), and PyPI wheels send
   ACAO:* on GET, so Pyodide + micropip survive isolation — but every other third-party
   URL (Google Fonts!) must be audited first.
2. **Dedicated workers only** — Firefox still can't give SAB to shared/service workers
   (bug 1613912, active July 2026). Our architecture already complies.
3. **Hosting economics:** Vercel re-compresses at the edge and *ignores* pre-compressed
   `.br` uploads — we can't rely on shipping max-brotli x2t ourselves. Options in order:
   measure Vercel's edge-brotli on the 36 MB wasm; if inadequate, serve `x2t.wasm.br`
   with a neutral extension + `DecompressionStream`; or put engines on Cloudflare R2
   (free egress) with explicit CORS/CORP headers. jsDelivr's standard caps (150 MB/pkg,
   20 MB/file from GitHub) block big engines without a negotiated endpoint. Vercel
   bandwidth: 100 GB/mo Hobby ≈ hard cap; Pro 1 TB then ~$0.15/GB.
4. **Caching:** engines to Cache Storage/OPFS with `navigator.storage.persist()`;
   immutable URLs + `instantiateStreaming` (Chrome/Firefox cache compiled machine code;
   Safari recompiles every load). **Safari purges all origin storage after 7 days
   without a visit** — build a graceful "re-download engine" moment into the boot
   readout rather than a surprise stall.
5. **Memory budgets:** wasm32 caps at 4 GiB; Memory64 is not in Safari — design for
   ≤2 GiB desktop, and treat iOS as ≤~1 GiB with aggressive OOM (active regressions as
   of iOS 26.2). Mobile gets Tier 0 + qpdf, with heavier tools gated + explained.

---

## 6. The license gate (Decision #1 — blocks Tier 1)

The repo currently has **no LICENSE file**. The entire high-fidelity roadmap — x2t,
sdkjs, PyMuPDF, pdf2docx's engine, mupdf, Ghostscript — is **AGPL-3.0** (or dual
commercial). Serving WASM to browsers is conveying; the low-risk posture is: Patram's
repo goes **AGPL-3.0**, publishes full source (it already would), and links the exact
upstream tags of each engine as Corresponding Source. The permissive-only alternative
(qpdf + PDFium + pdfcpu) caps us at Tier 1 minus compression-by-PyMuPDF and kills
Tiers 2–3 entirely.

**Recommendation: adopt AGPL-3.0 for the repo.** Patram is a free, privacy-first,
source-open tool — AGPL costs us nothing we weren't giving away and unlocks everything.
It is a one-way ratchet, so it's the first decision to make, deliberately. (Not legal
advice; a LICENSE + NOTICE file with per-engine attributions is part of Phase 0.)

---

## 7. Measuring "pixel-perfect" — the benchmark harness

No vendor publishes fidelity numbers. We will. (This also replaces marketing adjectives
with a graph — very much our voice.)

- **Corpus:** ~50 real-world documents per format tiered by difficulty: plain letters,
  styled reports (headers/footers/fields), tables (ruled + borderless), images + floats,
  charts, SmartArt, equations (OMML), tracked changes, RTL + Devanagari + CJK, Aptos-only
  documents, legacy .doc/.xls/.ppt, password-protected. Public/synthetic docs only, in
  `test/corpus/`.
- **References:** for each doc, a reference render — Word via COM (on the Windows dev
  machine, scripted) and LibreOffice headless. Store rendered PNGs per page at fixed DPI.
- **Metric:** rasterize our output PDF (pdf.js or PyMuPDF), compare page-by-page — SSIM +
  pixel-diff percentage, plus structural checks (page count drift, text recall). Score
  per tier, per feature category.
- **Harness:** extends `test/verify.mjs`'s pattern; runs headless in CI; emits a
  markdown/JSON scorecard so every engine change shows its fidelity delta. The scorecard
  is also the honest public claim: "Tier 3 scores 0.97 median SSIM vs Word on our corpus."

---

## 8. Product shape — how the ladder is surfaced

- **Engine tiers are visible, in Patram's voice.** Each tool card/workbench states which
  engine will run and what it costs to summon: "Fidelity engine · 7 MB download, cached
  for offline" — consent before big downloads, progress in the existing boot-readout
  aesthetic. The seal/readout already established this language; extend it.
- **Exact-fonts toggle** on conversion workbenches (Chrome/Edge): "Use this device's
  fonts for exact layout" → permission prompt → per-document font matching report
  ("Calibri ✓ local · Aptos ✓ local · FoundryGrotesk ✗ substituted with Arimo").
- **A fidelity ribbon on results:** which fonts were exact vs substituted, so users know
  *when* they got pixel-perfect rather than being promised it always.
- **Bridge as a quiet upgrade path:** a small "Native engine" row that lights up when the
  Bridge is detected; a docs page for the one-time "Apps on device" prompt (crib
  Dynamsoft's error-state UX: "not installed" vs "permission denied").
- **Mobile honesty:** heavy tiers hidden or gated with an explanation, not a crash.
- **The pledge is unchanged and becomes provable:** files never leave the device — now
  including the fonts read from it.

---

## 9. Roadmap

**Phase 0 — Foundations (small, do first)**
- [ ] Decision #1: adopt AGPL-3.0 (LICENSE + NOTICE with engine attributions).
- [ ] Benchmark corpus v1 + reference renders + SSIM harness (§7) — *before* engines land,
      so every later phase has a scoreboard.
- [ ] Engine-loader plumbing: lazy per-tool engine downloads, Cache Storage/OPFS +
      `persist()`, download-consent UI, Safari re-download UX.
- [ ] Font pack v1 (Carlito/Caladea/Arimo/Tinos/Cousine/Noto Sans/Noto Devanagari) +
      AllFonts index generation (core's AllFontsGen), OFL notices.

**Phase 1 — Quick wins (existing architecture)**
- [ ] Pyodide 0.28.1 → 314.x bump (verify all existing tools via test/verify.mjs).
- [ ] qpdf-wasm: linearize + encrypt/decrypt + repair tools; recompression option in
      Compress.
- [ ] PyMuPDF wheel: `rewrite_images` downsampling in Compress (finally answers
      "Ghostscript-grade isn't possible in-browser" — it now is); better PDF→Text.
- [ ] pdf2docx PDF→Word (verified recipe, §2 Tier 1); pdfplumber PDF→Excel.
- [ ] Unicode fonts in fpdf2 paths (drop `_latin1`); Devanagari via shaping-aware path or
      honest labeling until harfbuzz shaping lands.
- [ ] README "Limitations" refresh per the new reality.

**Phase 2 — Fidelity engine (x2t.wasm)**
- [ ] Vendor x2t (pin v8.3.0+0; benchmark v9.3.0), classic worker, fresh-instance-per-job.
- [ ] Font injection into `/working/fonts` from pack; params.xml plumbing; format matrix
      (docx/doc/odt/rtf/txt/html · xlsx/xls/ods/csv · pptx/ppt/odp).
- [ ] ⚠ Spikes: x2t PDF-input in WASM; large-file limits; Vercel edge-brotli vs R2 hosting.
- [ ] Benchmark scorecard: Tier 2 vs Tier 0 office↔office.

**Phase 3 — Near-pixel-perfect Office→PDF**
- [ ] ⚠ Spike A: sdkjs print pipeline (CryptPad/ZIZIYI as references) — docx first.
- [ ] ⚠ Spike B: ZetaOffice headless `convertpdf` on the corpus (fidelity, RAM, cold
      start, COOP/COEP fallout). Pick the winner on scorecard + payload + stability.
- [ ] Ship DOCX→PDF, then XLSX→PDF (print-area semantics!), then PPTX→PDF.
- [ ] Local Font Access "exact mode": fontTable extraction → queryLocalFonts →
      MEMFS injection → fidelity ribbon. (First-mover: nobody has wired these together.)

**Phase 4 — Patram Bridge**
- [ ] Tauri shell: health endpoint, pairing token, Host/Origin hardening (§2 Bridge).
- [ ] Engine detection: soffice (warm listener), Word COM on Windows (pixel-perfect path).
- [ ] LNA UX + docs; signing (SignPath/Certum + Apple); auto-update via signed manifests.
- [ ] Site integration: detection card, capability negotiation, benchmark row.

**Phase 5 — Positioning**
- [ ] Publish the fidelity scorecard; rewrite tool badges/marketing around measured tiers.
- [ ] Brave allowlist application; enterprise-policy docs (LocalNetworkAccessAllowedForUrls).

---

## 10. Top risks

| Risk | Exposure | Mitigation |
|---|---|---|
| AGPL ratchet regretted later | whole roadmap | Decide eyes-open in Phase 0; permissive fallback documented (§6) |
| sdkjs integration is a swamp (offline mocks, version locking) | Phase 3 | Two production references to crib (CryptPad, ZIZIYI); ZetaOffice as plan B; timebox the spike |
| x2t v9.3 large-file regression / memory leak | Phase 2 | Pin v8.3.0; fresh instance per job; file-size guardrails |
| Fonts: substitute ≠ identical pagination; Aptos gap on substitutes-only browsers | fidelity claims | Fidelity ribbon honesty; exact mode on Chromium; never claim pixel-perfect w/ substitutes |
| iOS/Safari: memory OOMs, 7-day storage purge, no local fonts, no Bridge | mobile users | Tier-gate by device; re-download UX; Safari gets Tiers 0–2 only |
| Engine hosting cost/limits (Vercel re-compression, jsDelivr caps) | Phase 2+ | R2/free-egress CDN with CORS/CORP; measure before choosing |
| LNA prompt friction / Brave blocklist / Safari-no-Bridge | Phase 4 | Explicit-click connect; Dynamsoft-style error UX; Brave allowlist PR |
| Research verification pass didn't complete (session limits) | plan accuracy | Load-bearing claims carry primary-source citations; each ⚠ is spike-gated before build |

---

## Appendix — payload budget (wire ≈ brotli)

| Asset | Wire | Raw | License |
|---|---|---|---|
| Pyodide core + wheels (today) | ~13 MB | — | MPL/BSD/MIT |
| qpdf.wasm | ~0.6 MB | 1.33 MB | Apache-2.0 |
| @embedpdf/pdfium | ~1.8 MB | 4.63 MB | MIT + Apache/BSD |
| Font pack v1 | ~2 MB | ~3 MB | OFL/Apache |
| x2t.wasm (v9.3) | 6.8 MB | 36 MB | AGPL-3.0 |
| PyMuPDF wheel | ~17 MB | — | AGPL-3.0 |
| pdf2docx wheel stack | ~33 MB | — | MIT + AGPL |
| sdkjs per-format slice | tens of MB | 606 MB all-editors dist | AGPL-3.0 |
| ZetaOffice | ~50 MB initial | ~250 MB | MPL-2.0 |
| Patram Bridge app | ~5 MB installer | LibreOffice +351 MB on demand | MIT/Apache + MPL |

Key sources: cryptpad/onlyoffice-x2t-wasm · cryptpad `www/common/outer/x2t.js` ·
baotlake/office-website (ZIZIYI) · docs.apryse.com/web/guides/office ·
nutrient.io/guides/web/conversion · developer.chrome.com/blog/local-network-access ·
developer.mozilla.org (queryLocalFonts, storage quotas) · blog.documentfoundation.org
(Aptos/font substitution) · pymupdf.readthedocs.io/en/latest/pyodide.html ·
github.com/ArtifexSoftware/pdf2docx · qpdf.readthedocs.io · vercel.com/docs/limits ·
webkit.org/blog/14403 · caniuse (Memory64, COEP:credentialless, OPFS) ·
github.blog localhost-dangers · allotropia zetajs · mapo80/libreoffice-web.
