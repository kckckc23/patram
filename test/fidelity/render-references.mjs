/*
 * Reference renderer (plan.md §7): converts every corpus office document to a
 * reference PDF in references/ using LibreOffice headless.
 *
 * Finds LibreOffice in this order:
 *   1. `soffice` on PATH (Linux/WSL native install)
 *   2. /mnt/c/Program Files/LibreOffice/program/soffice.exe        (Windows under WSL)
 *   3. /mnt/c/Program Files (x86)/LibreOffice/program/soffice.exe  (Windows under WSL)
 *
 * When a Windows .exe is driven from WSL, paths are translated with `wslpath -w`
 * because the Windows process cannot see /mnt/... paths.
 *
 * If LibreOffice is not installed this prints guidance and exits 0 — the rest
 * of the harness still works, you just have no references yet. For true-Word
 * references on a Windows machine with Office installed, use
 * render-references.ps1 instead (Word/Excel/PowerPoint COM export).
 *
 *   node render-references.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const corpusDir = path.join(here, "corpus");
const refDir = path.join(here, "references");
const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const warn = (m) => console.log("  \x1b[33m!\x1b[0m " + m);
const step = (m) => console.log("\x1b[1m" + m + "\x1b[0m");

// ---- locate LibreOffice -----------------------------------------------------
function findSoffice() {
  const probe = spawnSync("soffice", ["--version"], { stdio: "pipe" });
  if (!probe.error && probe.status === 0) return { cmd: "soffice", windows: false };
  for (const p of [
    "/mnt/c/Program Files/LibreOffice/program/soffice.exe",
    "/mnt/c/Program Files (x86)/LibreOffice/program/soffice.exe",
  ]) {
    if (existsSync(p)) return { cmd: p, windows: true };
  }
  return null;
}

const toWin = (p) => execFileSync("wslpath", ["-w", p], { encoding: "utf8" }).trim();

// ---- main -------------------------------------------------------------------
step("Looking for LibreOffice…");
const soffice = findSoffice();
if (!soffice) {
  warn("LibreOffice not found (no `soffice` on PATH, no Windows install under /mnt/c).");
  console.log(`
  To render reference PDFs you have two options:

  A) LibreOffice (this script):
     - WSL/Linux:  sudo apt install libreoffice
     - Windows:    install from https://www.libreoffice.org/download/
       (this script auto-detects the Windows install from WSL)
     then re-run:  node render-references.mjs

  B) Microsoft Office COM (true-Word references, Windows + Office required):
     from Windows PowerShell in this directory:
       powershell -ExecutionPolicy Bypass -File render-references.ps1

  Nothing else in the harness is blocked: gen-corpus.mjs and
  compare.mjs --self work without references.
`);
  process.exit(0);
}
ok(`found ${soffice.cmd}${soffice.windows ? " (Windows exe via WSL)" : ""}`);

if (!existsSync(path.join(corpusDir, "index.json"))) {
  warn("corpus/index.json missing — run `node gen-corpus.mjs` first.");
  process.exit(1);
}
const index = JSON.parse(readFileSync(path.join(corpusDir, "index.json"), "utf8"));
mkdirSync(refDir, { recursive: true });

step(`Rendering ${index.length} reference PDFs into references/ …`);
let rendered = 0, failed = 0;
for (const { file } of index) {
  const src = path.join(corpusDir, file);
  const out = path.join(refDir, file.replace(/\.[^.]+$/, ".pdf"));
  // LibreOffice instances fight over the user profile — run strictly serially.
  const args = soffice.windows
    ? ["--headless", "--convert-to", "pdf", "--outdir", toWin(refDir), toWin(src)]
    : ["--headless", "--convert-to", "pdf", "--outdir", refDir, src];
  const res = spawnSync(soffice.cmd, args, { stdio: "pipe", timeout: 180_000 });
  if (res.status === 0 && existsSync(out) && statSync(out).size > 0) {
    ok(`${file} → ${path.basename(out)} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
    rendered++;
  } else {
    warn(`${file}: conversion failed${res.stderr ? " — " + String(res.stderr).trim().split("\n")[0] : ""}`);
    failed++;
  }
}

step(`\n${rendered}/${index.length} references rendered${failed ? `, ${failed} failed` : ""}.`);
if (rendered > 0) {
  console.log("Next: produce candidate PDFs with a Patram engine, then run\n  node score.mjs <candidateDir>");
}
process.exit(failed && !rendered ? 1 : 0);
