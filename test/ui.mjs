/*
 * UI matrix — drives every tool in the registry through a real browser and
 * asserts it produces its result with no console errors. This is the gate that
 * makes UI refactors safe: verify.mjs proves the engine, this proves the wiring.
 *
 *   python3 -m http.server 8231     # serve the site first
 *   node ui.mjs                     # 19 tools, light engine paths only
 *   node ui.mjs --full              # + OCR, PDF→Word/Excel hifi, Compress max
 *   node ui.mjs --only=merge,stamp  # a subset while iterating
 *
 * A tool listed in app.js but absent here fails the run, so a new tool cannot
 * ship without a UI test.
 */
import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ensureFixtures, fixture, PASSWORD } from "./ui-fixtures.mjs";

const ORIGIN = "http://localhost:8231";
const APP = fileURLToPath(new URL("../app.js", import.meta.url));
const full = process.argv.includes("--full");
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);

const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const bad = (m) => console.log("  \x1b[31m✗\x1b[0m " + m);
const step = (m) => console.log("\x1b[1m" + m + "\x1b[0m");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- the matrix ---------------------------------------------------------- */
/* files: fixture keys uploaded into the tool's own file input
   before: extra interaction before the run button (fields, second upload, …)
   expect: what proves the tool worked
   heavy:  needs a multi-MB engine download — only with --full            */
const CASES = [
  { id: "merge",     files: ["multi", "one"] },
  { id: "split",     files: ["multi"] },
  { id: "delete",    files: ["multi"], before: (p) => type(p, "#stage .input.mono", "1,4") },
  { id: "organize",  files: ["multi"],
    // wait for the whole board: the Save button only arms once pages are drawn
    ready: "#stage .run:not([disabled])",
    before: (p) => p.waitForFunction(() => document.querySelectorAll("#stage .thumb canvas").length === 4) },
  { id: "stamp",     files: ["multi"], before: (p) => type(p, '#stage input[type="text"]', "CONFIDENTIAL") },
  { id: "imgOnPdf",  files: ["multi"], fileInput: '#stage input[accept=".pdf"]',
    ready: "#stage .page-stage canvas",
    before: async (p) => {
      await (await p.$('#stage input[accept="image/*"]')).uploadFile(fixture("photo"));
      await p.waitForSelector("#stage .pl");
    } },
  { id: "compress",  files: ["multi"] },
  { id: "linearize", files: ["multi"] },
  { id: "protect",   files: ["multi"], before: async (p) => {
      await type(p, '#stage input[type="password"]', PASSWORD);
      await type(p, '#stage input[type="password"]:nth-of-type(2)', PASSWORD, true);
    } },
  { id: "unlock",    files: ["locked"], before: (p) => type(p, '#stage input[type="password"]', PASSWORD) },
  { id: "repair",    files: ["multi"] },
  { id: "metaStrip", files: ["multi"] },
  { id: "pdfText",   files: ["multi"], expect: "#stage .text-out" },
  { id: "pdfImg",    files: ["multi"], expect: "#stage .gallery figure" },
  { id: "pdfPpt",    files: ["multi"] },
  { id: "imgPdf",    files: ["photo"] },
  { id: "txtPdf",    files: [], before: (p) => type(p, "#stage .textarea", "Hello from the UI matrix.") },
  { id: "wordPdf",   files: ["doc"] },
  { id: "xlsxPdf",   files: ["book"] },
  { id: "pptPdf",    files: ["deck"] },
  { id: "ocr",       files: ["multi"], heavy: "tesseract ≈12 MB", expect: "#stage .text-out", timeout: 300000 },
  { id: "pdfWord",   files: ["multi"], heavy: "pdf2docx ≈33 MB", timeout: 600000 },
  { id: "pdfXlsx",   files: ["multi"], heavy: "pdfplumber ≈8 MB", timeout: 300000 },
];

async function type(page, sel, value, optional) {
  const el = await page.$(sel);
  if (!el) { if (optional) return; throw new Error("no element for " + sel); }
  await el.click({ clickCount: 3 });
  await el.type(value);
}

/* ---- run ---------------------------------------------------------------- */
await ensureFixtures({ log: (m) => console.log("  " + m) });

// the registry is the source of truth for what must be covered
const registryIds = [...readFileSync(APP, "utf8").matchAll(/\{ id: "([\w]+)", name:/g)].map((m) => m[1]);
const covered = new Set(CASES.map((c) => c.id));
const uncovered = registryIds.filter((id) => !covered.has(id));
const stale = CASES.map((c) => c.id).filter((id) => !registryIds.includes(id));
if (uncovered.length) { bad(`tools in app.js with no UI case: ${uncovered.join(", ")}`); process.exitCode = 1; }
if (stale.length) { bad(`UI cases for tools that no longer exist: ${stale.join(", ")}`); process.exitCode = 1; }
if (!uncovered.length && !stale.length) ok(`matrix covers all ${registryIds.length} registered tools`);

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1100 });
let consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).split("\n")[0]));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const url = m.location()?.url || "";
  if (url.includes("_vercel/insights")) return;             // 404 until Analytics is enabled
  consoleErrors.push("console: " + m.text().slice(0, 160));
});

step("Booting the engine…");
await page.goto(`${ORIGIN}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("#runtime")?.dataset.state === "ready", { timeout: 300000 });
ok("engine ready");

const selected = CASES.filter((c) => (only.length ? only.includes(c.id) : true))
                      .filter((c) => (c.heavy ? full : true));
const skipped = CASES.filter((c) => c.heavy && !full).map((c) => `${c.id} (${c.heavy})`);

step(`Driving ${selected.length} tool${selected.length === 1 ? "" : "s"}…`);
const results = [];
for (const c of CASES.filter((x) => selected.includes(x))) {
  consoleErrors = [];
  const t0 = Date.now();
  try {
    await page.evaluate(() => {
      const back = document.querySelector("#back");
      if (back && !document.querySelector("#workbench").hidden) back.click();
    });
    await page.waitForSelector(`.tool-card[data-id="${c.id}"]`, { visible: true, timeout: 15000 });
    await page.click(`.tool-card[data-id="${c.id}"]`);
    await page.waitForSelector("#stage .tool-head", { timeout: 15000 });

    if (c.files.length) {
      const sel = c.fileInput || '#stage input[type="file"]';
      await page.waitForSelector(sel);
      await (await page.$(sel)).uploadFile(...c.files.map(fixture));
    }
    if (c.ready) await page.waitForSelector(c.ready, { timeout: c.timeout || 120000 });
    else await wait(350);                          // let renderLeft settle
    if (c.before) await c.before(page);

    await page.waitForSelector("#stage .run:not([disabled])", { timeout: 60000 });
    await page.click("#stage .run");
    await page.waitForSelector(c.expect || "#stage .btn-dl", { timeout: c.timeout || 180000 });

    const label = await page.$eval("#stage", (n) => {
      const dl = n.querySelector(".btn-dl");
      if (dl) return dl.textContent.replace(/\s+/g, " ").trim();
      const t = n.querySelector(".text-out");
      if (t) return `${t.textContent.length} chars of text`;
      return `${n.querySelectorAll(".gallery figure").length} images`;
    });
    const state = await page.evaluate(() => document.querySelector("#runtime").dataset.state);
    if (consoleErrors.length) throw new Error(consoleErrors.join(" | "));
    if (state === "error") throw new Error("runtime ended in the error state");
    results.push({ id: c.id, pass: true, ms: Date.now() - t0, label });
    ok(`${c.id.padEnd(10)} ${String(Date.now() - t0).padStart(6)}ms  ${label.slice(0, 62)}`);
  } catch (err) {
    const alert = await page.$eval("#stage", (n) => n.querySelector(".alert")?.textContent.trim() || "")
      .catch(() => "");
    results.push({ id: c.id, pass: false, ms: Date.now() - t0, label: (alert || err.message).slice(0, 150) });
    bad(`${c.id.padEnd(10)} ${String(Date.now() - t0).padStart(6)}ms  ${(alert || err.message).slice(0, 110)}`);
  }
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log();
if (skipped.length) console.log(`  skipped (run with --full): ${skipped.join(", ")}`);
if (failed.length) {
  console.log(`\n\x1b[31mUI MATRIX FAILED\x1b[0m — ${failed.length}/${results.length}: ${failed.map((f) => f.id).join(", ")}`);
  process.exit(1);
}
console.log(`\x1b[32mUI MATRIX PASSED\x1b[0m — ${results.length} tools produced their result, no console errors.`);
process.exit(process.exitCode || 0);
