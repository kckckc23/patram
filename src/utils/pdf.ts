import { PDFDocument } from 'pdf-lib';

/**
 * Formats bytes to standard human-readable format.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parses user input for pages to remove (e.g. "2, 4, 7-9") and returns a Set of 1-indexed page numbers.
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): Set<number> {
  const result = new Set<number>();
  const sanitized = rangeStr.trim();
  if (!sanitized) return result;

  const parts = sanitized.split(',');
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const bounds = part.split('-');
      if (bounds.length === 2) {
        const start = parseInt(bounds[0].trim(), 10);
        const end = parseInt(bounds[1].trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.min(start, end);
          const to = Math.max(start, end);
          for (let i = from; i <= to; i++) {
            if (i >= 1 && i <= totalPages) {
              result.add(i);
            }
          }
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum)) {
        if (pageNum >= 1 && pageNum <= totalPages) {
          result.add(pageNum);
        }
      }
    }
  }
  return result;
}

/**
 * Helper to read a PDF file and return its total page count.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  // Using ignoreEncryption to allow getting page counts of password files (but parsing will fail on save)
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return pdfDoc.getPageCount();
}

/**
 * Merges multiple PDF files in order.
 */
export async function mergePDFs(
  files: File[],
  onProgress?: (message: string) => void
): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error('No files provided for merging.');
  }

  onProgress?.('Initializing merged document...');
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(`Loading file ${i + 1} of ${files.length}: "${file.name}"...`);
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    onProgress?.(`Copying pages from "${file.name}"...`);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  onProgress?.('Saving merged file...');
  const bytes = await mergedPdf.save();
  return bytes;
}

/**
 * Splits a PDF file by page range (1-indexed, inclusive).
 */
export async function splitPDF(
  file: File,
  startPage: number,
  endPage: number,
  onProgress?: (message: string) => void
): Promise<Uint8Array> {
  onProgress?.('Reading original PDF...');
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();

  if (startPage < 1 || startPage > totalPages) {
    throw new Error(`Start page (${startPage}) must be between 1 and ${totalPages}.`);
  }
  if (endPage < startPage || endPage > totalPages) {
    throw new Error(`End page (${endPage}) must be between ${startPage} and ${totalPages}.`);
  }

  onProgress?.(`Extracting pages ${startPage} to ${endPage}...`);
  const splitPdf = await PDFDocument.create();
  
  // Create 0-indexed page list
  const pageIndices: number[] = [];
  for (let i = startPage - 1; i <= endPage - 1; i++) {
    pageIndices.push(i);
  }

  const copiedPages = await splitPdf.copyPages(pdfDoc, pageIndices);
  copiedPages.forEach((page) => {
    splitPdf.addPage(page);
  });

  onProgress?.('Writing new split PDF file...');
  const bytes = await splitPdf.save();
  return bytes;
}

/**
 * Prepares a cleaned PDF file by deleting specified pages.
 */
export async function deletePagesFromPdf(
  file: File,
  pagesToRemoveStr: string,
  onProgress?: (message: string) => void
): Promise<Uint8Array> {
  onProgress?.('Analyzing original file...');
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();

  const pagesToExclude = parsePageRangeString(pagesToRemoveStr, totalPages);
  
  if (pagesToExclude.size === 0) {
    throw new Error('Please specify at least one valid page to remove.');
  }

  if (pagesToExclude.size >= totalPages) {
    throw new Error(
      `Cannot delete all pages. The document of ${totalPages} pages has ${pagesToExclude.size} pages flagged for removal. At least one page must remain.`
    );
  }

  onProgress?.(`Re-building document by excluding ${pagesToExclude.size} pages...`);
  const outputPdf = await PDFDocument.create();
  
  // Build remaining 0-indexed page list
  const pageIndicesToKeep: number[] = [];
  for (let i = 0; i < totalPages; i++) {
    const pageOneIndexed = i + 1;
    if (!pagesToExclude.has(pageOneIndexed)) {
      pageIndicesToKeep.push(i);
    }
  }

  const copiedPages = await outputPdf.copyPages(pdfDoc, pageIndicesToKeep);
  copiedPages.forEach((page) => {
    outputPdf.addPage(page);
  });

  onProgress?.('Building final PDF file...');
  const bytes = await outputPdf.save();
  return bytes;
}

/**
 * Utility to download bytes as a PDF file in the browser.
 */
export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
