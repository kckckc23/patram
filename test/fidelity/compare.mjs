/*
 * PDF visual comparison (plan.md §7 metric).
 * Rasterizes two PDFs page-by-page with PyMuPDF inside Pyodide, then scores
 * each page pair with (a) SSIM on grayscale (8x8 windows, standard constants)
 * and (b) pixelmatch diff percentage. Smaller pages are padded to the larger
 * page's dimensions on a white background; a missing page (page-count drift)
 * is scored against a blank white page so drift costs points.
 *
 *   import { comparePdfs } from "./compare.mjs";
 *   const r = await comparePdfs(bufA, bufB, { dpi: 96, maxPages: 10 });
 *
 * CLI:
 *   node compare.mjs a.pdf b.pdf     # print a page-by-page report
 *   node compare.mjs --self          # built-in self-test (exit 1 on failure)
 */
import { loadPyodide } from "pyodide";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const CDN = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/";

// ---- Pyodide boot (lazy singleton — one WASM VM per process) ---------------
let pyPromise = null;
async function pyodide() {
  if (!pyPromise) {
    pyPromise = (async () => {
      const py = await loadPyodide();
      const lock = await (await fetch(CDN + "pyodide-lock.json")).json();
      // pymupdf ships as an official Pyodide-built wheel (no deps) on the CDN.
      await py.loadPackage(CDN + lock.packages["pymupdf"].file_name);
      py.runPython(`
import json, os, pymupdf

def rasterize(src, prefix, dpi, max_pages):
    """Render up to max_pages of a PDF to PNGs; return page count."""
    doc = pymupdf.open(src)
    n = min(doc.page_count, max_pages)
    for i in range(n):
        png = doc[i].get_pixmap(dpi=dpi).tobytes("png")
        open(f"{prefix}-{i}.png", "wb").write(png)
    total = doc.page_count
    doc.close()
    return total
`);
      return py;
    })();
  }
  return pyPromise;
}

// ---- pixel math -------------------------------------------------------------
function toGray(rgba, w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return g;
}

/** Mean SSIM over 8x8 windows, standard constants (K1=0.01, K2=0.03, L=255). */
function ssim(grayA, grayB, w, h) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, WIN = 8;
  let total = 0, windows = 0;
  for (let y = 0; y < h; y += WIN) {
    for (let x = 0; x < w; x += WIN) {
      const bw = Math.min(WIN, w - x), bh = Math.min(WIN, h - y), n = bw * bh;
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let j = 0; j < bh; j++) {
        let idx = (y + j) * w + x;
        for (let i = 0; i < bw; i++, idx++) {
          const a = grayA[idx], b = grayB[idx];
          sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
        }
      }
      const muA = sa / n, muB = sb / n;
      const varA = saa / n - muA * muA, varB = sbb / n - muB * muB;
      const cov = sab / n - muA * muB;
      total += ((2 * muA * muB + C1) * (2 * cov + C2)) /
               ((muA * muA + muB * muB + C1) * (varA + varB + C2));
      windows++;
    }
  }
  return total / windows;
}

/** Pad an RGBA image onto a white canvas of (w, h); null → all-white page. */
function padToCanvas(img, w, h) {
  const out = new Uint8Array(w * h * 4).fill(255);
  if (img) {
    for (let y = 0; y < img.height; y++) {
      out.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), y * w * 4);
    }
  }
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---- public API -------------------------------------------------------------
export async function comparePdfs(bufA, bufB, { dpi = 96, maxPages = 10 } = {}) {
  const py = await pyodide();
  py.FS.writeFile("/cmp-a.pdf", new Uint8Array(bufA));
  py.FS.writeFile("/cmp-b.pdf", new Uint8Array(bufB));
  const rasterize = py.globals.get("rasterize");
  let pageCountA, pageCountB;
  try {
    pageCountA = rasterize("/cmp-a.pdf", "/pa", dpi, maxPages);
    pageCountB = rasterize("/cmp-b.pdf", "/pb", dpi, maxPages);
  } finally {
    rasterize.destroy();
  }

  const nPages = Math.min(Math.max(pageCountA, pageCountB), maxPages);
  const pages = [];
  for (let i = 0; i < nPages; i++) {
    const imgA = i < pageCountA ? PNG.sync.read(Buffer.from(py.FS.readFile(`/pa-${i}.png`))) : null;
    const imgB = i < pageCountB ? PNG.sync.read(Buffer.from(py.FS.readFile(`/pb-${i}.png`))) : null;
    const w = Math.max(imgA?.width ?? 0, imgB?.width ?? 0);
    const h = Math.max(imgA?.height ?? 0, imgB?.height ?? 0);
    const a = padToCanvas(imgA, w, h);
    const b = padToCanvas(imgB, w, h);
    const mismatched = pixelmatch(a, b, null, w, h, { threshold: 0.1 });
    pages.push({
      page: i + 1,
      ssim: ssim(toGray(a, w, h), toGray(b, w, h), w, h),
      diffPct: (mismatched / (w * h)) * 100,
    });
    if (i < pageCountA) py.FS.unlink(`/pa-${i}.png`);
    if (i < pageCountB) py.FS.unlink(`/pb-${i}.png`);
  }
  const ssims = pages.map((p) => p.ssim);
  return {
    pages,
    median: median(ssims),
    worst: Math.min(...ssims),
    pageCountA,
    pageCountB,
  };
}

// ---- CLI --------------------------------------------------------------------
function printReport(label, r) {
  console.log(`\x1b[1m${label}\x1b[0m`);
  console.log(`  pages: A=${r.pageCountA} B=${r.pageCountB} (compared ${r.pages.length})`);
  for (const p of r.pages) {
    console.log(`  page ${String(p.page).padStart(2)}  ssim=${p.ssim.toFixed(4)}  diff=${p.diffPct.toFixed(3)}%`);
  }
  console.log(`  median ssim=${r.median.toFixed(4)}  worst ssim=${r.worst.toFixed(4)}`);
}

async function selfTest() {
  console.log("\x1b[1mSelf-test: generating PDFs via PyMuPDF…\x1b[0m");
  const py = await pyodide();
  py.runPython(`
doc = pymupdf.open()
for i in range(2):
    page = doc.new_page()  # A4
    page.insert_text((72, 90), f"Patram fidelity self-test — page {i + 1}", fontsize=18)
    for line in range(12):
        page.insert_text((72, 140 + line * 22),
                         "The quick brown fox jumps over the lazy dog. " * 2, fontsize=10)
    page.draw_rect(pymupdf.Rect(72, 430, 300, 520), color=(0.1, 0.2, 0.5), width=2)
doc.save("/self-a.pdf")

# perturbed copy: drop a text box onto page 1
doc2 = pymupdf.open("/self-a.pdf")
doc2[0].insert_textbox(pymupdf.Rect(150, 300, 480, 420),
                       "PERTURBATION: this box exists only in copy B.",
                       fontsize=20, color=(0.8, 0, 0))
doc2.save("/self-b.pdf")
doc.close(); doc2.close()
`);
  const a = py.FS.readFile("/self-a.pdf");
  const b = py.FS.readFile("/self-b.pdf");

  const same = await comparePdfs(a, a);
  printReport("A vs A (identical — expect ssim≈1.0, diff≈0%)", same);
  const perturbed = await comparePdfs(a, b);
  printReport("A vs B (perturbed page 1 — expect ssim<0.99)", perturbed);

  const failures = [];
  if (!(same.median > 0.999)) failures.push(`identical median ssim ${same.median} ≤ 0.999`);
  if (!(same.worst > 0.999)) failures.push(`identical worst ssim ${same.worst} ≤ 0.999`);
  if (!same.pages.every((p) => p.diffPct < 0.01)) failures.push("identical diffPct ≥ 0.01%");
  if (!(perturbed.worst < 0.99)) failures.push(`perturbed worst ssim ${perturbed.worst} ≥ 0.99`);
  if (!(perturbed.pages[0].diffPct > 0.1)) failures.push("perturbed page 1 diffPct ≤ 0.1%");
  if (!(perturbed.pages[1].ssim > 0.999)) failures.push("untouched page 2 ssim ≤ 0.999");

  if (failures.length) {
    console.error("\x1b[31mSELF-TEST FAILED\x1b[0m\n  " + failures.join("\n  "));
    process.exit(1);
  }
  console.log("\x1b[32mSELF-TEST PASSED\x1b[0m");
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const args = process.argv.slice(2);
  if (args[0] === "--self") {
    await selfTest();
  } else if (args.length === 2) {
    const r = await comparePdfs(readFileSync(args[0]), readFileSync(args[1]));
    printReport(`${args[0]} vs ${args[1]}`, r);
  } else {
    console.error("usage: node compare.mjs <a.pdf> <b.pdf> | node compare.mjs --self");
    process.exit(2);
  }
}
