# Patram fidelity benchmark harness

Measures how close Patram's document conversions get to "pixel-perfect"
(plan.md §7). No vendor publishes fidelity numbers — this harness produces
ours: a per-document SSIM / pixel-diff scorecard of any candidate engine
against reference renders from LibreOffice or Microsoft Office.

Everything runs headless in Node via Pyodide (same pattern as `../verify.mjs`);
the only optional native dependency is the reference renderer itself.

## The flow

```
gen-corpus.mjs ──▶ corpus/*.docx|xlsx|pptx + index.json     (deterministic inputs)
                        │
render-references.mjs   │  (LibreOffice headless)           ──▶ references/*.pdf
render-references.ps1   │  (Word/Excel/PowerPoint COM)      ──▶ references/*.pdf
                        │
your engine under test ─┴──▶ <candidateDir>/*.pdf           (same basenames)
                        │
score.mjs <candidateDir> ──▶ scorecard.json + scorecard.md  (worst-first table)
```

```sh
cd test/fidelity
npm install

# 1. generate the corpus (17 documents, byte-identical on every run)
node gen-corpus.mjs

# 2. render reference PDFs (pick one)
node render-references.mjs          # LibreOffice: PATH `soffice`, or Windows
                                    # install auto-detected from WSL
powershell -ExecutionPolicy Bypass -File render-references.ps1
                                    # true-Word references; Windows + MS Office,
                                    # run from Windows PowerShell, not WSL

# 3. convert the corpus with the engine you want to measure, writing
#    <candidateDir>/<same-basename>.pdf  (e.g. t01-plain-letter.pdf)

# 4. score it
node score.mjs path/to/candidateDir
node compare.mjs --self             # harness self-test (no corpus needed)
node compare.mjs a.pdf b.pdf        # ad-hoc comparison of any two PDFs
```

First run of any Pyodide script downloads wheels from the CDN (network
required, may take a few minutes); they are cached in `node_modules` for
subsequent runs.

## What the scores mean

Both PDFs are rasterized page-by-page at 96 dpi with PyMuPDF; the smaller page
is padded onto a white canvas of the larger page's size, and a missing page
(page-count drift) is scored against a blank page — drift costs points.

- **SSIM** (structural similarity, grayscale, 8×8 windows): 1.0 = visually
  identical. It tracks *perceived* structure, so it forgives anti-aliasing
  noise but punishes moved/reflowed/missing content.
- **diff %** (pixelmatch): percentage of pixels that visibly differ. Blunter
  than SSIM but great at catching color and hairline changes.
- **pages ref/cand**: page-count drift is itself a fidelity failure.

Verdict per document, on **median page SSIM** vs the reference:

| verdict | median SSIM | reading |
|---|---|---|
| ✓ | ≥ 0.97 | near-pixel-perfect — claimable |
| ~ | ≥ 0.90 | visually faithful; drift you can see side-by-side |
| ✗ | < 0.90 | layout diverges; structure-only conversion |

`scorecard.md` is sorted worst-first so the top of the table is always the
work list. `scorecard.json` carries per-page numbers for CI trend lines.

Caveat from plan.md §3: with substituted fonts even a perfect engine won't hit
SSIM 1.0 against a Word reference — compare tiers against the *same*
reference set, and treat deltas (engine A vs engine B on identical
references) as the primary signal.

## The corpus

17 synthetic, deterministic documents (no randomness, fixed timestamps —
regenerating produces byte-identical files, so references stay valid).
`corpus/index.json` lists `{file, format, tier, features}` per document.

Tiers: **1** plain content, **2** styled/structured (tables, formats, images,
shapes), **3** layout-hostile (fields, multi-column, complex script, 40+
pages, 30-column sheets).

| doc | exercises |
|---|---|
| t01-plain-letter | unstyled paragraphs |
| t02-styles-headings | Title/H1/H2, quote, bullet + numbered lists |
| t03-ruled-tables | 2 ruled tables, merged cells both axes |
| t04-images | inline PNG (generated with Pillow) |
| t05-headers-footers | header, footer with PAGE field, multi-page |
| t06-multicolumn | 2-column section via w:cols |
| t07-devanagari | complex-script shaping (पत्रम् …) |
| t08-long | 40+ pages, repeated styled chapters |
| s01-grid | plain grid + header row |
| s02-formats | currency/date formats, bold, fills |
| s03-wide | 30 columns — pagination stress |
| s04-multisheet | 3 sheets |
| s05-merged-cells | merged ranges + borders |
| p01-title-bullets | title slide, bullets with indent levels |
| p02-positioned-shapes | absolutely positioned colored shapes |
| p03-image-slide | PNG at absolute position |
| p04-two-content-layout | Two Content layout placeholders |

## Adding corpus documents

1. In `gen-corpus.mjs`, add an entry to `MANIFEST` (`file`, `format`, `tier`,
   `features`) and a generation block in the Python section that writes
   `/corpus/<file>` and saves through `save_docx` / `save_xlsx` / `save_pptx`
   (they pin document properties and normalize zip timestamps — that is what
   keeps the corpus byte-deterministic; don't call `.save()` directly).
2. Keep it deterministic: no `now()`, no randomness; fixed dates only.
3. Re-run `node gen-corpus.mjs`, then re-render references.

Real-world (non-synthetic) documents can be dropped straight into `corpus/`
and added to `index.json` by hand — they just won't be regenerable.

## Files

- `gen-corpus.mjs` — deterministic corpus generator (Pyodide: python-docx,
  openpyxl, python-pptx, Pillow)
- `render-references.mjs` — LibreOffice headless reference renderer
  (PATH or Windows-under-WSL installs; exits gracefully when absent)
- `render-references.ps1` — Microsoft Office COM reference renderer
- `compare.mjs` — PDF visual diff library + CLI (`--self` for the self-test);
  exports `comparePdfs(bufA, bufB, {dpi, maxPages})`
- `score.mjs` — batch scorer → `scorecard.json` / `scorecard.md`
- `corpus/`, `references/`, `scorecard.*` — generated artifacts
