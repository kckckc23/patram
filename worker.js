/*
 * Pyodide Web Worker — the local engine.
 *
 * Runs on the user's machine, off the UI thread. Loads the Python runtime once,
 * installs the pure-Python PDF libraries, then executes pdf_tools.dispatch()
 * against file bytes. Heavy engines (PyMuPDF, pdf2docx, pdfplumber) and the
 * Unicode font pack are fetched lazily on first use and cached by the browser.
 * No file ever leaves the browser.
 */
const PYODIDE_VERSION = "314.0.2";
const BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
importScripts(BASE + "pyodide.js");

let pyodide = null;

async function boot() {
  post("boot", { phase: "runtime", msg: "Fetching Python runtime (WebAssembly)…" });
  pyodide = await loadPyodide({ indexURL: BASE });

  post("boot", { phase: "packages", msg: "Loading Pillow + lxml…" });
  await pyodide.loadPackage(["micropip", "Pillow", "lxml"]);

  post("boot", { phase: "packages", msg: "Installing pypdf, openpyxl, fpdf2, python-docx, python-pptx…" });
  const micropip = pyodide.pyimport("micropip");
  await micropip.install(["pypdf", "openpyxl", "fpdf2", "python-docx", "python-pptx"]);

  post("boot", { phase: "module", msg: "Loading engine…" });
  pyodide.runPython(await (await fetch("./pdf_tools.py")).text());

  post("ready", { msg: "Engine ready" });
}

const ready = boot().catch((e) => post("error", { msg: "Engine failed to start: " + e }));

/* ---- Unicode font pack — fetched on first text-rendering job ------------- */
const FONT_FILES = [
  "NotoSans-Regular.ttf", "NotoSans-Bold.ttf",
  "NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari-Bold.ttf",
];
const FONT_ACTIONS = new Set(["textToPdf", "wordToPdf", "tableToPdf", "pptToPdf"]);
let fontsReady = null;
function ensureFonts(note) {
  if (!fontsReady) {
    fontsReady = (async () => {
      note("fetching Unicode fonts (≈1.7 MB, one-time)…");
      try { pyodide.FS.mkdir("/fonts"); } catch {}
      await Promise.all(FONT_FILES.map(async (f) => {
        const r = await fetch("./fonts/" + f);
        if (!r.ok) throw new Error("font fetch failed: " + f);
        pyodide.FS.writeFile("/fonts/" + f, new Uint8Array(await r.arrayBuffer()));
      }));
    })().catch((e) => { fontsReady = null; throw e; });
  }
  return fontsReady;
}

/* ---- heavy engines — installed on first use, then resident --------------- */
const ENGINE_SETUP = {
  pymupdf: {
    note: "downloading compression engine (≈17 MB, one-time)…",
    py: `import micropip\nawait micropip.install("pymupdf")`,
  },
  pdf2docx: {
    note: "downloading high-fidelity PDF→Word engine (≈33 MB, one-time)…",
    py: `import micropip
await micropip.install(["pymupdf", "opencv-python", "numpy", "fonttools", "fire"])
await micropip.install("pdf2docx", deps=False)`,
  },
  pdfplumber: {
    note: "downloading table-detection engine (≈8 MB, one-time)…",
    py: `import micropip
await micropip.install(["pdfminer.six"])
await micropip.install("pdfplumber", deps=False)`,
  },
};
const engines = {};
function ensureEngine(name, note) {
  if (!engines[name]) {
    engines[name] = (async () => {
      note(ENGINE_SETUP[name].note);
      await pyodide.runPythonAsync(ENGINE_SETUP[name].py);
    })().catch((e) => { engines[name] = null; throw e; });
  }
  return engines[name];
}
function requiredEngine(action, p) {
  if (action === "pdfToWord" && p.engine === "hifi") return "pdf2docx";
  if (action === "pdfToXlsx" && p.engine === "hifi") return "pdfplumber";
  if (action === "compress" && p.mode === "max") return "pymupdf";
  return null;
}

self.onmessage = async (e) => {
  const { id, action, params, files } = e.data; // files: array of ArrayBuffer
  const note = (msg) => post("status", { id, msg });
  try {
    await ready;
    if (!pyodide) throw new Error("Engine is not running.");

    // fonts are an enhancement — if they can't be fetched, render with core fonts
    if (FONT_ACTIONS.has(action)) await ensureFonts(note).catch(() => {});
    const eng = requiredEngine(action, params || {});
    if (eng) { await ensureEngine(eng, note); note("engine ready — working…"); }

    (files || []).forEach((buf, i) => pyodide.FS.writeFile("/in" + i, new Uint8Array(buf)));

    const p = { ...(params || {}), n: (files || []).length };
    const call = `dispatch(${JSON.stringify(action)}, ${JSON.stringify(JSON.stringify(p))})`;
    const res = JSON.parse(pyodide.runPython(call));

    if (res.kind === "file") {
      const out = pyodide.FS.readFile("/out"); // Uint8Array
      post("result", { id, kind: "file", bytes: out }, [out.buffer]);
    } else if (res.kind === "text") {
      post("result", { id, kind: "text", text: res.text });
    } else {
      post("result", { id, kind: "json", data: res });
    }
  } catch (err) {
    post("error", { id, msg: humanize(String(err)) });
  }
};

// Surface the Python ValueError message, not the whole WASM traceback.
function humanize(s) {
  const m = s.match(/ValueError:\s*(.+)/) || s.match(/Error:\s*(.+)/);
  return m ? m[1].split("\n")[0] : s.split("\n")[0];
}

function post(type, payload, transfer) {
  self.postMessage({ type, ...payload }, transfer || []);
}
