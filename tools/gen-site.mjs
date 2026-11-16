import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../js/registry.js";

const ROOT = new URL("../", import.meta.url);
const SITEMAP_OUT = fileURLToPath(new URL("sitemap.xml", ROOT));
const BASE = "https://patrampdf.karanchauhan.me";

const SLUGS = {
  merge: "merge-pdf",
  split: "split-pdf",
  delete: "delete-pdf-pages",
  organize: "organize-pdf",
  stamp: "stamp-pdf",
  imgOnPdf: "add-image-to-pdf",
  compress: "compress-pdf",
  linearize: "linearize-pdf",
  protect: "protect-pdf",
  unlock: "unlock-pdf",
  repair: "repair-pdf",
  metaStrip: "strip-pdf-metadata",
  pdfText: "pdf-to-text",
  ocr: "ocr-pdf",
  pdfImg: "pdf-to-images",
  imgPdf: "images-to-pdf",
  txtPdf: "text-to-pdf",
  wordPdf: "word-to-pdf",
  xlsxPdf: "excel-to-pdf",
  pptPdf: "powerpoint-to-pdf",
  pdfWord: "pdf-to-word",
  pdfXlsx: "pdf-to-excel",
  pdfPpt: "pdf-to-powerpoint",
};

const today = new Date().toISOString().slice(0, 10);

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function urlEntry(loc, priority) {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    "    <changefreq>monthly</changefreq>",
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

const toolList = TOOLS.filter((t) => !t.group).map((t) => {
  const slug = SLUGS[t.id];
  if (!slug) throw new Error(`No slug mapping for tool id "${t.id}"`);
  return { ...t, slug, url: `${BASE}/${slug}` };
});

function techNote(tool) {
  if (tool.heavy) {
    return `The first time you use this tool, Patram downloads its ${tool.heavy.label} (about ${tool.heavy.mb} MB) from a CDN; after that, the engine is cached for offline use.`;
  }
  if (tool.badge === "IN-BROWSER") {
    return "This tool runs with in-browser engines loaded on demand; after the first load, required assets can be reused from cache for faster, offline-friendly use.";
  }
  if (tool.badge === "QPDF") {
    return "This tool runs on your device using WebAssembly (qpdf). The engine is loaded when needed and cached after the first download so future use is faster and can work offline.";
  }
  return "This tool runs on your device using Python compiled to WebAssembly (Pyodide). The engine loads on demand and is cached after the first download so it can work offline on later visits.";
}

function pageCopy(tool) {
  const heavySentence = tool.heavy
    ? ` Because this conversion uses the ${tool.heavy.label}, expect a one-time engine download of about ${tool.heavy.mb} MB on first use before processing begins.`
    : "";
  const privacy = `Everything happens locally in your browser: your files are processed on-device via WebAssembly and are never uploaded to Patram’s servers. No account or signup is required, and your documents stay private on your own machine.${heavySentence}`;
  const p1 = `${tool.desc} Patram’s ${tool.name} tool helps you handle this task directly in your browser without sending documents anywhere else. It is designed for quick, private document work where you keep full control over your files from start to finish.`;
  const p2 = `${privacy} ${techNote(tool)} Open the tool when you are ready, choose your files or input, review the options, and save the finished result back to your device.`;
  return { p1, p2 };
}

function howToSteps(tool) {
  return [
    `Open <a href="/#/${tool.id}">${esc(tool.name)}</a> in Patram and add the file or content you want to work with.`,
    `Adjust the available options for ${esc(tool.name.toLowerCase())}, then start processing on your device.`,
    `Review the result and download the finished output — your files never leave this device.`,
  ];
}

function footerNav(currentSlug) {
  const items = toolList.map((t) => {
    const cls = t.slug === currentSlug ? ' class="current"' : "";
    return `<a${cls} href="/${t.slug}">${esc(t.name)}</a>`;
  });
  const privacyCls = currentSlug === "privacy" ? ' class="current"' : "";
  items.push(`<a${privacyCls} href="/privacy">Privacy</a>`);
  return `<nav class="tool-nav" aria-label="All PDF tools">\n      ${items.join("\n      ")}\n    </nav>`;
}

function toolPageHtml(tool) {
  const title = `${tool.name} - free, runs on your device | Patram`;
  const metaDesc = `${tool.desc} Runs entirely in your browser on your device — no upload, no account, files never leave your device.`;
  const canonical = `${BASE}/${tool.slug}`;
  const { p1, p2 } = pageCopy(tool);
  const steps = howToSteps(tool).map((s) => `        <li>${s}</li>`).join("\n");
  const nav = footerNav(tool.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: metaDesc,
    url: canonical,
    isPartOf: {
      "@type": "WebApplication",
      name: "Patram",
      url: `${BASE}/`,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Patram" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(metaDesc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${BASE}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Patram — free PDF tools that run in your browser. No upload, ever." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(metaDesc)}" />
  <meta name="twitter:image" content="${BASE}/og.png" />
  <meta name="theme-color" content="#c0261d" />
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="stylesheet" href="./styles.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <main class="tool-page" id="main">
    <p><a href="/">← Back to all tools</a></p>
    <h1>${esc(tool.name)}</h1>
    <p>${esc(p1)}</p>
    <p>${esc(p2)}</p>

    <h2>How to use ${esc(tool.name)}</h2>
    <ol>
${steps}
    </ol>

    <p><a class="open-tool" href="/#/${tool.id}">Open ${esc(tool.name)}</a></p>
  </main>

  <footer class="tool-page-footer">
    <p><a href="/">All Patram tools</a></p>
${nav}
  </footer>
</body>
</html>
`;
}

function privacyPageHtml() {
  const title = "Privacy - what Patram does with your files | Patram";
  const metaDesc = "What Patram does with your files: on-device WebAssembly processing, when network access is needed, and how you can verify privacy claims yourself.";
  const canonical = `${BASE}/privacy`;
  const nav = footerNav("privacy");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: metaDesc,
    url: canonical,
    isPartOf: {
      "@type": "WebApplication",
      name: "Patram",
      url: `${BASE}/`,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Patram" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(metaDesc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${BASE}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Patram — free PDF tools that run in your browser. No upload, ever." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(metaDesc)}" />
  <meta name="twitter:image" content="${BASE}/og.png" />
  <meta name="theme-color" content="#c0261d" />
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="stylesheet" href="./styles.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <main class="tool-page" id="main">
    <p><a href="/">← Back to all tools</a></p>
    <h1>Privacy</h1>

    <section>
      <h2>The short version</h2>
      <p>Your files are processed on your own device by WebAssembly engines; they are never uploaded; there is no account.</p>
    </section>

    <section>
      <h2>What needs the network, and when</h2>
      <p>The site itself and its engines (Pyodide, qpdf, pdf.js, tesseract.js) load from cdn.jsdelivr.net on first use. OCR additionally downloads language data and needs a connection while recognizing. Heavy engines (pdf2docx, pdfplumber, PyMuPDF) download once, on demand, with the size shown first. After download, engines are cached and tools work offline.</p>
    </section>

    <section>
      <h2>What to check yourself</h2>
      <p>DevTools network tab shows engine downloads on first use and no file uploads ever. DevTools &gt; Application &gt; Cache Storage shows what the service worker stored. The full source is at <a href="https://github.com/kckckc23/patram">github.com/kckckc23/patram</a> (AGPL-3.0).</p>
    </section>

    <section>
      <h2>Hosting</h2>
      <p>The site is served by Vercel, which processes standard web server logs (IP address, browser) as any host does, and loads Vercel Web Analytics (anonymous page-view counts, no cookies). No ads, no third-party trackers, no file content leaves the device.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Contact: the GitHub repo's issue tracker at <a href="https://github.com/kckckc23/patram/issues">github.com/kckckc23/patram/issues</a>.</p>
    </section>
  </main>

  <footer class="tool-page-footer">
    <p><a href="/">All Patram tools</a></p>
${nav}
  </footer>
</body>
</html>
`;
}

const sitemapEntries = [urlEntry(`${BASE}/`, "1.0")];
for (const tool of toolList) {
  sitemapEntries.push(urlEntry(tool.url, "0.8"));
  const html = toolPageHtml(tool);
  writeFileSync(fileURLToPath(new URL(`${tool.slug}.html`, ROOT)), html);
}
sitemapEntries.push(urlEntry(`${BASE}/privacy`, "0.5"));
writeFileSync(fileURLToPath(new URL("privacy.html", ROOT)), privacyPageHtml());

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapEntries,
  "</urlset>",
  "",
].join("\n");

writeFileSync(SITEMAP_OUT, sitemapXml);
console.log(`sitemap.xml written — ${sitemapEntries.length} URL(s), lastmod ${today}`);
console.log(`Generated ${toolList.length} tool page(s) and privacy.html at repo root`);
