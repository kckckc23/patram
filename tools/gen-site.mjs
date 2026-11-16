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

const KEYWORDS = {
  merge:    { kw: "merge pdf", h1: "Merge PDF online, free and private", faqs: [{ q: "Can I reorder files before merging?", a: "Yes. You can drag files or use the arrows to set the order before merging." }] },
  split:    { kw: "split pdf", h1: "Split PDF online, free and private", faqs: [{ q: "Can I extract a range of pages?", a: "Yes. You can keep a single range of pages as a new document." }] },
  delete:   { kw: "delete pdf pages", h1: "Delete PDF pages online, free and private", faqs: [{ q: "Can I delete specific pages or ranges?", a: "Yes. You can remove pages by number or range, for example 2, 5-8." }] },
  organize: { kw: "organize pdf pages", h1: "Organize PDF pages online, free and private", faqs: [{ q: "Can I reorder and rotate pages?", a: "Yes. You can reorder, rotate, or drop pages, then rebuild the PDF." }] },
  stamp:    { kw: "add page numbers to pdf", h1: "Add page numbers to PDF online, free and private", faqs: [{ q: "Can I add watermarks or page numbers?", a: "Yes. You can add a watermark, header/footer text, or page numbers." }] },
  imgOnPdf: { kw: "add image to pdf", h1: "Add image to PDF online, free and private", faqs: [{ q: "Can I place an image anywhere on a page?", a: "Yes. You can drop a logo, signature, or photo anywhere on a page, then save." }] },
  compress: { kw: "compress pdf", h1: "Compress PDF online, free and private", faqs: [{ q: "What compression options are available?", a: "You can shrink file size with options ranging from lossless cleanup to full image downsampling." }] },
  linearize:{ kw: "linearize pdf", h1: "Linearize PDF online, free and private", faqs: [{ q: "What does linearizing a PDF do?", a: "It optimizes the PDF for fast page-by-page web viewing." }] },
  protect:  { kw: "password protect pdf", h1: "Password protect PDF online, free and private", faqs: [{ q: "How is the PDF protected?", a: "You can encrypt the PDF with a password using AES-256, applied on your device." }] },
  unlock:   { kw: "remove pdf password", h1: "Remove PDF password online, free and private", faqs: [{ q: "Can I remove a PDF password?", a: "Yes. If you know the password, you can remove it from the PDF." }] },
  repair:   { kw: "repair pdf", h1: "Repair PDF online, free and private", faqs: [{ q: "What does repairing a PDF do?", a: "It rebuilds a damaged file's structure (cross-reference recovery)." }] },
  metaStrip:{ kw: "remove pdf metadata", h1: "Remove PDF metadata online, free and private", faqs: [{ q: "What metadata can be removed?", a: "You can remove author, title, software traces, and XMP data from a PDF." }] },
  pdfText:  { kw: "pdf to text", h1: "PDF to text online, free and private", faqs: [{ q: "Does this extract the selectable text?", a: "Yes. It pulls the selectable text layer out of a PDF." }] },
  ocr:      { kw: "ocr pdf", h1: "OCR PDF online, free and private", faqs: [{ q: "Can it read scanned PDFs?", a: "Yes. It can read text from scanned or image PDFs using on-device OCR." }] },
  pdfImg:   { kw: "pdf to jpg", h1: "PDF to JPG online, free and private", faqs: [{ q: "Can I save pages as images?", a: "Yes. Each page is rendered to a JPG, and you can save one, all of them, or a zip." }] },
  imgPdf:   { kw: "jpg to pdf", h1: "JPG to PDF online, free and private", faqs: [{ q: "Which image formats can I convert?", a: "You can place JPG or PNG images onto pages, one per image." }] },
  txtPdf:   { kw: "text to pdf", h1: "Text to PDF online, free and private", faqs: [{ q: "Can I create a PDF from typed text?", a: "Yes. You can type or paste text, or load a .txt file, and export a PDF." }] },
  wordPdf:  { kw: "word to pdf", h1: "Word to PDF online, free and private", faqs: [{ q: "Does it support .docx files?", a: "Yes. It converts .docx files to PDF, with a quick re-typeset option or full formatting via your browser's print engine." }] },
  xlsxPdf:  { kw: "excel to pdf", h1: "Excel to PDF online, free and private", faqs: [{ q: "Can I convert spreadsheets to PDF?", a: "Yes. It renders a spreadsheet as a formatted table PDF." }] },
  pptPdf:   { kw: "powerpoint to pdf", h1: "PowerPoint to PDF online, free and private", faqs: [{ q: "How are slides converted?", a: "Each slide's text is laid out on a landscape PDF." }] },
  pdfWord:  { kw: "pdf to word", h1: "PDF to Word online, free and private", faqs: [{ q: "What can be extracted to Word?", a: "It rebuilds an editable .docx with flowing text, tables, and images." }] },
  pdfXlsx:  { kw: "pdf to excel", h1: "PDF to Excel online, free and private", faqs: [{ q: "How are tables extracted?", a: "It detects real tables into an .xlsx workbook, with a sheet per page." }] },
  pdfPpt:   { kw: "pdf to powerpoint", h1: "PDF to PowerPoint online, free and private", faqs: [{ q: "How are pages converted to slides?", a: "Each page becomes a slide, pixel-faithful, or you can extract editable text instead." }] },
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capKw(kw) {
  return kw.replace(/\b\w/g, (c) => c.toUpperCase());
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

// map tool id -> category for related tools
const catById = (() => {
  let cat = null;
  const m = new Map();
  for (const t of TOOLS) {
    if (t.group) { cat = t.group; continue; }
    m.set(t.id, cat);
  }
  return m;
})();

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
  const altCls = currentSlug === "ilovepdf-alternative" ? ' class="current"' : "";
  items.push(`<a${altCls} href="/ilovepdf-alternative">iLovePDF alternative</a>`);
  return `<nav class="tool-nav" aria-label="All PDF tools">\n      ${items.join("\n      ")}\n    </nav>`;
}

function relatedTools(tool) {
  const cat = catById.get(tool.id);
  const group = toolList.filter((t) => t.id !== tool.id && catById.get(t.id) === cat);
  if (group.length === 0) return "";
  const picks = group.slice(0, Math.min(4, group.length));
  const links = picks.map((t) => `<li><a href="/${t.slug}">${esc(t.name)}</a></li>`).join("\n      ");
  return `\n    <h2>Related tools</h2>\n    <ul>\n      ${links}\n    </ul>`;
}

function toolPageHtml(tool) {
  const meta = KEYWORDS[tool.id];
  if (!meta) throw new Error(`No KEYWORDS entry for tool id "${tool.id}"`);
  const kwCap = capKw(meta.kw);
  const title = `${kwCap} Online Free - No Upload | Patram`;
  const metaDesc = `${kwCap}: ${tool.desc} Free, no upload, runs on your device.`;
  const canonical = `${BASE}/${tool.slug}`;
  const { p2 } = pageCopy(tool);
  const p1 = `${tool.desc} Use Patram to ${meta.kw} online for free in your browser — no upload and no account — so you can handle this task privately on your own device.`;
  const steps = howToSteps(tool).map((s) => `        <li>${s}</li>`).join("\n");
  const nav = footerNav(tool.slug);

  const faqs = [
    { q: `Is ${meta.kw} free?`, a: `Yes. ${kwCap} with Patram is completely free.` },
    { q: "Do my files get uploaded?", a: "No. Your files are processed on your device in your browser and are never uploaded." },
    ...meta.faqs,
  ];
  if (tool.heavy) {
    faqs.push({
      q: "Why is there a one-time download?",
      a: `This tool uses the ${tool.heavy.label} (about ${tool.heavy.mb} MB), which is downloaded once on first use and then cached for offline use.`,
    });
  }

  const faqSection = faqs.map((f) => `      <h3>${esc(f.q)}</h3>\n      <p>${esc(f.a)}</p>`).join("\n");

  const webPageLd = {
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
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
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
  <meta name="theme-color" content="#14532d" />
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="stylesheet" href="./styles.css" />
  <script type="application/ld+json">${JSON.stringify(webPageLd)}</script>
  <script type="application/ld+json">${JSON.stringify(faqLd)}</script>
</head>
<body>
  <main class="tool-page" id="main">
    <p><a href="/">← Back to all tools</a></p>
    <h1>${esc(meta.h1)}</h1>
    <p>${esc(p1)}</p>
    <p>${esc(p2)}</p>

    <h2>How to use ${esc(tool.name)}</h2>
    <ol>
${steps}
    </ol>

    <h2>Frequently asked questions</h2>
${faqSection}
${relatedTools(tool)}

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
  <meta name="theme-color" content="#14532d" />
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

function alternativePageHtml() {
  const title = "iLovePDF Alternative: Free PDF Tools, No Upload | Patram";
  const metaDesc = "Patram is a free iLovePDF alternative where files never leave your device - merge, split, compress, convert and OCR in your browser. No account, no upload.";
  const canonical = `${BASE}/ilovepdf-alternative`;
  const nav = footerNav("ilovepdf-alternative");
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

  const toolLinks = [
    ["Merge PDFs", "/merge-pdf"],
    ["Split PDF", "/split-pdf"],
    ["Compress PDF", "/compress-pdf"],
    ["Convert to PDF", "/word-to-pdf"],
    ["Convert from PDF", "/pdf-to-word"],
    ["OCR scanned PDF", "/ocr-pdf"],
  ].map(([name, href]) => `<a href="${href}">${esc(name)}</a>`).join(", ");

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
  <meta name="theme-color" content="#14532d" />
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="stylesheet" href="./styles.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <main class="tool-page" id="main">
    <p><a href="/">← Back to all tools</a></p>
    <h1>A free iLovePDF alternative that never uploads your files</h1>
    <p>Patram offers the same kinds of everyday PDF tools — merge, split, compress, convert and OCR — with one key difference: where your files go. With Patram, documents are processed on your device in your browser instead of being sent to a server for processing.</p>

    <h2>Comparison</h2>
    <table>
      <thead>
        <tr>
          <th scope="col">Feature</th>
          <th scope="col">iLovePDF</th>
          <th scope="col">Patram</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Where files are processed</th>
          <td>Files are uploaded to iLovePDF's servers for processing</td>
          <td>On your device, in your browser (WebAssembly)</td>
        </tr>
        <tr>
          <th scope="row">Account needed</th>
          <td>Not required for basic use</td>
          <td>No</td>
        </tr>
        <tr>
          <th scope="row">Price</th>
          <td>Free to use, with paid plans available</td>
          <td>Free</td>
        </tr>
        <tr>
          <th scope="row">File-size limits</th>
          <td>Plan-based limits</td>
          <td>Limited by your device’s available memory</td>
        </tr>
        <tr>
          <th scope="row">Works offline</th>
          <td>No</td>
          <td>Yes, after the first load and engine downloads</td>
        </tr>
        <tr>
          <th scope="row">Open source</th>
          <td>No</td>
          <td>Yes (AGPL-3.0)</td>
        </tr>
      </tbody>
    </table>

    <h2>When Patram is a better fit</h2>
    <ul>
      <li><strong>Sensitive documents:</strong> useful for contracts, IDs, financial records, or anything you prefer to keep on your own device.</li>
      <li><strong>Slow or metered connections:</strong> once the app and required engines are cached, you can work without sending files over the network.</li>
      <li><strong>Offline work:</strong> after the first load, tools can run without an internet connection.</li>
    </ul>

    <h2>When iLovePDF might fit better</h2>
    <ul>
      <li>You want dedicated mobile apps.</li>
      <li>You want an integrated e-signing workflow.</li>
    </ul>

    <h2>Try Patram</h2>
    <p>Open the <a href="/">Patram home page</a> to browse all tools, or jump straight to common tasks like ${toolLinks}.</p>
    <p><a class="open-tool" href="/">Open all tools</a></p>
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
sitemapEntries.push(urlEntry(`${BASE}/ilovepdf-alternative`, "0.7"));
writeFileSync(fileURLToPath(new URL("ilovepdf-alternative.html", ROOT)), alternativePageHtml());

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapEntries,
  "</urlset>",
  "",
].join("\n");

writeFileSync(SITEMAP_OUT, sitemapXml);
console.log(`sitemap.xml written — ${sitemapEntries.length} URL(s), lastmod ${today}`);
console.log(`Generated ${toolList.length} tool page(s), privacy.html, and ilovepdf-alternative.html at repo root`);
