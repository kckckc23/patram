import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOOLS } from "../js/registry.js";

const OUT = fileURLToPath(new URL("../sitemap.xml", import.meta.url));
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

const entries = [urlEntry(`${BASE}/`, "1.0")];

for (const tool of TOOLS) {
  if (tool.group) continue;
  const slug = SLUGS[tool.id];
  if (!slug) {
    throw new Error(`No slug mapping for tool id "${tool.id}"`);
  }
  entries.push(urlEntry(`${BASE}/${slug}`, "0.8"));
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries,
  "</urlset>",
  "",
].join("\n");

writeFileSync(OUT, xml);
console.log(`sitemap.xml written — ${entries.length} URL(s), lastmod ${today}`);
