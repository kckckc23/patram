/*
 * qpdf Web Worker — native PDF plumbing (qpdf 12.2 compiled to WebAssembly).
 *
 * Powers Protect (AES-256 encrypt), Unlock (decrypt), Repair (xref recovery)
 * and Linearize (fast web view). The ~1.3 MB wasm loads from the CDN on first
 * use and is cached by the browser. A fresh module instance runs each job —
 * qpdf is a one-shot CLI by design. Files never leave this device.
 */
const PKG = "https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/";
// The UMD glue is loaded via a cors fetch + indirect eval instead of
// importScripts: cors responses are what the service worker can cache, so the
// tool keeps working offline after its first use.
let glueReady = null;
function ensureGlue() {
  if (!glueReady) {
    glueReady = fetch(PKG + "qpdf.js", { mode: "cors" })
      .then((r) => { if (!r.ok) throw new Error("qpdf download failed (" + r.status + ")"); return r.text(); })
      .then((src) => { (0, eval)(src); /* defines global `Module` factory */ })
      .catch((e) => { glueReady = null; throw e; });
  }
  return glueReady;
}

const OPS = {
  linearize: () => ["--linearize"],
  repair: () => [],
  encrypt: (p) => {
    if (!p.password) throw new Error("A password is required.");
    return ["--encrypt", p.password, p.password, "256", "--"];
  },
  decrypt: (p) => {
    if (!p.password) throw new Error("Enter the document's password.");
    return ["--password=" + p.password, "--decrypt"];
  },
};

async function runQpdf(op, params, bytes) {
  const build = OPS[op];
  if (!build) throw new Error("Unknown operation: " + op);
  await ensureGlue();
  const stderr = [];
  const m = await Module({
    locateFile: () => PKG + "qpdf.wasm",
    noInitialRun: true,
    print: () => {},
    printErr: (s) => stderr.push(s),
  });
  m.FS.writeFile("/in.pdf", new Uint8Array(bytes));
  let code = 0;
  try {
    code = m.callMain([...build(params || {}), "/in.pdf", "/out.pdf"]);
  } catch (e) {
    code = typeof e?.status === "number" ? e.status : 1;
  }
  // qpdf exit 3 = "succeeded with warnings" (expected when repairing)
  if (code !== 0 && code !== 3) {
    const msg = stderr.filter((s) => s.includes("qpdf:")).pop() || stderr.pop() || ("qpdf failed (exit " + code + ")");
    throw new Error(msg.replace(/^qpdf:\s*/, "").replace(/\/in\.pdf/g, "file"));
  }
  return m.FS.readFile("/out.pdf");
}

self.onmessage = async (e) => {
  const { id, op, params, file } = e.data;
  try {
    self.postMessage({ type: "status", id, msg: "loading qpdf (≈1.3 MB, one-time)…" });
    const out = await runQpdf(op, params, file);
    self.postMessage({ type: "result", id, bytes: out }, [out.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", id, msg: err instanceof Error ? err.message : String(err) });
  }
};
