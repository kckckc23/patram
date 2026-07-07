/*
 * Pyodide Web Worker.
 *
 * Runs on the user's machine, off the UI thread. Loads the Python runtime,
 * installs the pure-Python PDF libraries, and executes pdf_tools.py against
 * file bytes. No file ever leaves the browser.
 */
const PYODIDE_VERSION = "0.28.1";
importScripts(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`);

let pyodide = null;

async function boot() {
  post("status", { msg: "Downloading Python runtime (Pyodide, ~first load only)…" });
  pyodide = await loadPyodide({
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  });

  post("status", { msg: "Loading micropip + Pillow…" });
  await pyodide.loadPackage(["micropip", "Pillow"]);

  post("status", { msg: "Installing pypdf, openpyxl, fpdf2…" });
  const micropip = pyodide.pyimport("micropip");
  await micropip.install(["pypdf", "openpyxl", "fpdf2"]);

  post("status", { msg: "Loading pdf_tools.py…" });
  const code = await (await fetch("./pdf_tools.py")).text();
  pyodide.runPython(code);

  post("ready", { msg: "Python engine ready — 100% local." });
}

const ready = boot().catch((err) => post("error", { msg: "Boot failed: " + err }));

self.onmessage = async (e) => {
  const { id, action, filename, bytes, isCsv } = e.data;
  try {
    await ready;
    post("status", { id, msg: "Processing in-browser…" });

    // Hand bytes to Python via the virtual filesystem (robust, no proxy juggling).
    pyodide.FS.writeFile("/in", new Uint8Array(bytes));
    const py = `run("/in", "/out", "${action}", ${isCsv ? "True" : "False"})`;
    pyodide.runPython(py);
    const out = pyodide.FS.readFile("/out"); // Uint8Array

    const base = filename.replace(/\.[^.]+$/, "");
    const outName = action === "compress" ? `${base}_compressed.pdf` : `${base}.pdf`;
    post("result", { id, outName, bytes: out, inSize: bytes.byteLength, outSize: out.byteLength }, [out.buffer]);
  } catch (err) {
    post("error", { id, msg: String(err) });
  }
};

function post(type, payload, transfer) {
  self.postMessage({ type, ...payload }, transfer || []);
}
