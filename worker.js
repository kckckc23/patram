/*
 * Pyodide Web Worker — the local engine.
 *
 * Runs on the user's machine, off the UI thread. Loads the Python runtime once,
 * installs the pure-Python PDF libraries, then executes pdf_tools.dispatch()
 * against file bytes. No file ever leaves the browser.
 */
const PYODIDE_VERSION = "0.28.1";
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

self.onmessage = async (e) => {
  const { id, action, params, files } = e.data; // files: array of ArrayBuffer
  try {
    await ready;
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
