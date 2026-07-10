/*
 * Browser smoke test: launches headless Chromium against the static site,
 * boots the real Pyodide engine, and drives the UI for two tools.
 *   (server must be running on :8231)  node smoke.mjs
 */
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";

const SAMPLE = fileURLToPath(new URL("../samples/sample.pdf", import.meta.url));
const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

console.log("\x1b[1mLoading page + booting engine…\x1b[0m");
await page.goto("http://localhost:8231/index.html", { waitUntil: "domcontentloaded" });

await page.waitForFunction(() => document.querySelector("#runtime")?.dataset.state === "ready", { timeout: 180000 });
ok("engine reached READY state in the browser");

// --- Compress ---
console.log("\x1b[1mCompress tool…\x1b[0m");
await page.click('.tool-card[data-id="compress"]');
await page.waitForSelector("#stage .drop");
const c1 = await page.$('#stage input[type="file"]');
await c1.uploadFile(SAMPLE);
await page.waitForSelector("#stage .run:not([disabled])");
await page.click("#stage .run");
await page.waitForSelector("#stage .btn-dl", { timeout: 60000 });
const compressStat = await page.$eval("#stage .result", (n) => n.textContent.replace(/\s+/g, " ").trim());
ok("compress produced a download — " + compressStat.slice(0, 80));

// --- PDF -> Text ---
console.log("\x1b[1mPDF → Text tool…\x1b[0m");
await page.click("#back");                       // return to the index before picking another tool
await page.waitForSelector('.tool-card[data-id="pdfText"]', { visible: true });
await page.click('.tool-card[data-id="pdfText"]');
await page.waitForSelector("#stage .drop");
const c2 = await page.$('#stage input[type="file"]');
await c2.uploadFile(SAMPLE);
await page.waitForSelector("#stage .run:not([disabled])");
await page.click("#stage .run");
await page.waitForSelector("#stage .text-out", { timeout: 60000 });
const len = await page.$eval("#stage .text-out", (n) => n.textContent.length);
ok("pdf→text rendered " + len + " chars in the output panel");

// --- Linearize (qpdf.wasm, engine-independent worker) ---
console.log("\x1b[1mLinearize (qpdf) tool…\x1b[0m");
await page.click("#back");
await page.waitForSelector('.tool-card[data-id="linearize"]', { visible: true });
await page.click('.tool-card[data-id="linearize"]');
await page.waitForSelector("#stage .drop");
const c3 = await page.$('#stage input[type="file"]');
await c3.uploadFile(SAMPLE);
await page.waitForSelector("#stage .run:not([disabled])");
await page.click("#stage .run");
await page.waitForSelector("#stage .btn-dl", { timeout: 60000 });
ok("qpdf linearize produced a download (qpdf.wasm loaded in-browser)");

if (errors.length) { console.log("\x1b[31mpage errors:\x1b[0m\n" + errors.join("\n")); await browser.close(); process.exit(1); }
console.log("\n\x1b[32mBROWSER SMOKE TEST PASSED\x1b[0m — UI + workers + engines work end to end in a real browser.");
await browser.close();
