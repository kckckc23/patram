/*
 * Offline acceptance test — "works offline once loaded" must be literally true.
 *   phase 1 (online): boot engine, run Compress + Linearize (populates the SW cache)
 *   phase 2 (offline): reload → engine must boot from cache → both tools must work.
 * Serve the site on :8231 first:  python3 -m http.server 8231
 */
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";

const SAMPLE = fileURLToPath(new URL("../samples/sample.pdf", import.meta.url));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).split("\n")[0]));

async function runTool(id, expectSel) {
  await page.click(`.tool-card[data-id="${id}"]`);
  await page.waitForSelector("#stage .drop");
  const input = await page.$('#stage input[type="file"]');
  await input.uploadFile(SAMPLE);
  await page.waitForSelector("#stage .run:not([disabled])", { timeout: 60000 });
  await page.click("#stage .run");
  await page.waitForSelector(expectSel, { timeout: 120000 });
  await page.click("#back");
  await page.waitForSelector(".tool-card", { visible: true });
}

console.log("\x1b[1mphase 1: online — boot + populate caches\x1b[0m");
await page.goto("http://localhost:8231/index.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("#runtime")?.dataset.state === "ready", { timeout: 240000 });
console.log("  ✓ engine ready (online)");
await runTool("compress", "#stage .btn-dl");
console.log("  ✓ compress (online)");
await runTool("linearize", "#stage .btn-dl");
console.log("  ✓ linearize (online)");
await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await new Promise((r) => setTimeout(r, 3000)); // let cache.put()s settle

console.log("\x1b[1mphase 2: OFFLINE reload\x1b[0m");
await page.setOfflineMode(true);
await page.reload({ waitUntil: "domcontentloaded" });
try {
  await page.waitForFunction(() => document.querySelector("#runtime")?.dataset.state === "ready", { timeout: 180000 });
  console.log("  ✓ engine ready (OFFLINE)");
} catch {
  const state = await page.evaluate(() => ({
    state: document.querySelector("#runtime")?.dataset.state,
    boot: document.querySelector("#bootReadout")?.textContent.replace(/\s+/g, " ").slice(-250),
  }));
  console.log("  ✗ engine FAILED offline →", JSON.stringify(state));
  console.log(errors.join("\n"));
  await browser.close();
  process.exit(1);
}
await runTool("compress", "#stage .btn-dl");
console.log("  ✓ compress (OFFLINE)");
await runTool("linearize", "#stage .btn-dl");
console.log("  ✓ linearize (OFFLINE)");

console.log("\n\x1b[32mOFFLINE TEST PASSED\x1b[0m — site + engines fully usable without network after one visit.");
await browser.close();
