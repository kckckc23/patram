/*
 * Fidelity scorecard (plan.md §7).
 * For every references/<name>.pdf with a matching <candidateDir>/<name>.pdf,
 * runs the SSIM/pixel-diff comparison and writes scorecard.json +
 * scorecard.md (worst-first), e.g.:
 *
 *   node score.mjs ../candidates-tier0
 *   node score.mjs ../candidates-tier0 --dpi 96 --max-pages 10
 *
 * Verdict per document, on median SSIM vs the reference render:
 *   ✓  ≥ 0.97   near-pixel-perfect
 *   ~  ≥ 0.90   visually faithful, visible drift
 *   ✗  < 0.90   layout diverges
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { comparePdfs } from "./compare.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const refDir = path.join(here, "references");
const indexPath = path.join(here, "corpus", "index.json");

// ---- args -------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const dpi = flag("--dpi", 96);
const maxPages = flag("--max-pages", 10);
const candidateDir = args.find((a) => !a.startsWith("--") && a !== String(dpi) && a !== String(maxPages));

if (!candidateDir) {
  console.error("usage: node score.mjs <candidateDir> [--dpi 96] [--max-pages 10]");
  process.exit(2);
}
if (!existsSync(refDir) || !readdirSync(refDir).some((f) => f.endsWith(".pdf"))) {
  console.error("references/ has no PDFs — run `node render-references.mjs` (or render-references.ps1) first.");
  process.exit(1);
}

const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : [];
const meta = new Map(index.map((e) => [e.file.replace(/\.[^.]+$/, ""), e]));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const verdictOf = (m) => (m >= 0.97 ? "✓" : m >= 0.9 ? "~" : "✗");

// ---- score ------------------------------------------------------------------
const refs = readdirSync(refDir).filter((f) => f.endsWith(".pdf")).sort();
const rows = [];
const skipped = [];
console.log(`Scoring ${path.resolve(candidateDir)} against ${refs.length} reference(s) (dpi=${dpi}, maxPages=${maxPages})…`);

for (const ref of refs) {
  const cand = path.join(candidateDir, ref);
  if (!existsSync(cand)) { skipped.push(ref); continue; }
  const stem = ref.replace(/\.pdf$/, "");
  const m = meta.get(stem) ?? {};
  const r = await comparePdfs(readFileSync(path.join(refDir, ref)), readFileSync(cand), { dpi, maxPages });
  const row = {
    doc: stem,
    format: m.format ?? "?",
    tier: m.tier ?? null,
    features: m.features ?? [],
    pagesRef: r.pageCountA,
    pagesCandidate: r.pageCountB,
    medianSsim: +r.median.toFixed(4),
    worstSsim: +r.worst.toFixed(4),
    diffPct: +median(r.pages.map((p) => p.diffPct)).toFixed(3),
    verdict: verdictOf(r.median),
    pages: r.pages.map((p) => ({ page: p.page, ssim: +p.ssim.toFixed(4), diffPct: +p.diffPct.toFixed(3) })),
  };
  rows.push(row);
  console.log(`  ${row.verdict} ${stem}  median=${row.medianSsim}  worst=${row.worstSsim}  diff=${row.diffPct}%`);
}

if (!rows.length) {
  console.error(`No candidate PDFs matched — expected <candidateDir>/<name>.pdf mirroring references/. Skipped: ${skipped.join(", ")}`);
  process.exit(1);
}

// worst-first: median ascending, then worst ascending
rows.sort((a, b) => a.medianSsim - b.medianSsim || a.worstSsim - b.worstSsim);

// ---- emit -------------------------------------------------------------------
const scorecard = {
  generated: new Date().toISOString(),
  candidateDir: path.resolve(candidateDir),
  settings: { dpi, maxPages },
  thresholds: { pass: 0.97, warn: 0.9 },
  summary: {
    documents: rows.length,
    skipped,
    medianSsim: +median(rows.map((r) => r.medianSsim)).toFixed(4),
    worstSsim: +Math.min(...rows.map((r) => r.worstSsim)).toFixed(4),
    verdicts: {
      pass: rows.filter((r) => r.verdict === "✓").length,
      warn: rows.filter((r) => r.verdict === "~").length,
      fail: rows.filter((r) => r.verdict === "✗").length,
    },
  },
  results: rows,
};
writeFileSync(path.join(here, "scorecard.json"), JSON.stringify(scorecard, null, 2) + "\n");

const md = [
  "# Patram fidelity scorecard",
  "",
  `- candidate: \`${scorecard.candidateDir}\``,
  `- generated: ${scorecard.generated} · dpi ${dpi} · max ${maxPages} pages/doc`,
  `- corpus median SSIM: **${scorecard.summary.medianSsim}** · worst page SSIM: **${scorecard.summary.worstSsim}**`,
  `- verdicts: ${scorecard.summary.verdicts.pass} ✓ · ${scorecard.summary.verdicts.warn} ~ · ${scorecard.summary.verdicts.fail} ✗` +
    (skipped.length ? ` · ${skipped.length} skipped (no candidate PDF)` : ""),
  "",
  "| doc | tier | pages (ref/cand) | median SSIM | worst SSIM | diff % | verdict |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) =>
    `| ${r.doc} | ${r.tier ?? "?"} | ${r.pagesRef}/${r.pagesCandidate} | ${r.medianSsim.toFixed(4)} | ${r.worstSsim.toFixed(4)} | ${r.diffPct.toFixed(2)} | ${r.verdict} |`),
  "",
  "Verdict on median SSIM: ✓ ≥ 0.97 · ~ ≥ 0.90 · ✗ below. Sorted worst-first.",
  ...(skipped.length ? ["", "Skipped (no candidate): " + skipped.join(", ")] : []),
  "",
].join("\n");
writeFileSync(path.join(here, "scorecard.md"), md);

console.log(`\nscorecard.json + scorecard.md written — ` +
  `${scorecard.summary.verdicts.pass} ✓ / ${scorecard.summary.verdicts.warn} ~ / ${scorecard.summary.verdicts.fail} ✗` +
  (skipped.length ? ` (${skipped.length} skipped)` : ""));
