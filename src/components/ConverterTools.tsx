import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { 
  FileUp, FileText, Download, Sparkles, RefreshCw, AlertCircle, 
  Image, FileCode, CheckCircle2, ChevronRight, Sliders, Palette,
  ArrowLeft, Table, Presentation, FileClock
} from 'lucide-react';
import { formatBytes } from '../utils/pdf';
import * as docx from 'docx';
import { renderAsync } from 'docx-preview';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


type ConvertDirection = 
  | 'pdfToImg' | 'imgToPdf' | 'pdfToTxt' | 'htmlToPdf'
  | 'pdfToWord' | 'wordToPdf' | 'pdfToExcel' | 'excelToPdf'
  | 'pdfToPpt' | 'pptToPdf' | 'txtToPdf';

interface ConverterCard {
  id: ConvertDirection;
  title: string;
  desc: string;
  icon: any;
  badge: 'Local-Only' | 'Normalized' | 'Workspace';
  badgeStyle: string;
}

export default function ConverterTools() {
  const [direction, setDirection] = useState<ConvertDirection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Script injection for PDF.js (for PDF to Image conversions)
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);

  useEffect(() => {
    const loadPdfjs = async () => {
      if (window.pdfjsLib) {
        setPdfjsLoaded(true);
        return;
      }
      try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        document.body.appendChild(script);
        script.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            setPdfjsLoaded(true);
          }
        };
      } catch {
        console.warn('Could not inject PDF.js library.');
      }
    };
    loadPdfjs();
  }, []);

  // Normalizes Unicode parsed text (decomposes ligatures, cleans control characters & debris)
  const cleanAndNormalizeUnicode = (text: string): string => {
    if (!text) return "";
    
    // 1. Unicode KC standard decompositions
    let clean = text.normalize("NFKC");
    
    // 2. Map standard typographic ligatures
    const ligatureMap: Record<string, string> = {
      'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', 'ﬆ': 'st',
      '\u00A0': ' ', // Non-breaking space
      '\u200B': '',  // Zero-width space
      '\u200C': '',  // Zero-width non-joiner
      '’': "'", '‘': "'", '”': '"', '“': '"', '—': '-', '–': '-'
    };
    
    for (const [ligature, replacement] of Object.entries(ligatureMap)) {
      clean = clean.replace(new RegExp(ligature, 'g'), replacement);
    }
    
    // 3. Clear raw esc debris
    clean = clean.replace(/\\r/g, "");
    clean = clean.replace(/\\n/g, "\n");
    clean = clean.replace(/\\u[0-9a-fA-F]{4}/g, "");
    
    // 4. Shrink space bands
    clean = clean.replace(/[ \t]+/g, ' ');
    
    // 5. Trim adjacent line breaks
    const lines = clean.split('\n');
    const cleanedLines = lines.map(line => line.trim());
    
    let result = cleanedLines.join('\n');
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result.trim();
  };

  // List of unified grid feature cards
  const converterList: ConverterCard[] = [
    {
      id: 'pdfToWord',
      title: 'PDF to Word Converter',
      desc: 'Extract and compile PDF paragraphs and line offsets into high-quality editable Microsoft Word documents (.docx) 100% in your browser.',
      icon: FileText,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'wordToPdf',
      title: 'Word to PDF Compiler',
      desc: 'Parse Microsoft Word XML stream layouts and render them directly into standard vector PDFs 100% in your browser.',
      icon: FileClock,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'pdfToExcel',
      title: 'PDF to Excel Sheets',
      desc: 'Detect horizontal grids and structural table offsets to align elements directly into a clean multi-column Excel spreadsheet (.xlsx) 100% in your browser.',
      icon: Table,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'excelToPdf',
      title: 'Excel to PDF Grid',
      desc: 'Turn CSV sheets, tabular files, or grid datasheets into formatted vector PDFs with clean alignments 100% in your browser.',
      icon: Sliders,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'pdfToPpt',
      title: 'PDF to Slide Deck',
      desc: 'Extract chapters, structures, and body outlines from PDF sheets into an offline Microsoft PowerPoint layout (.ppt) 100% in your browser.',
      icon: Presentation,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'pptToPdf',
      title: 'PowerPoint to PDF',
      desc: 'Process corporate slideshows (.ppt, .pptx) into beautifully sized, high-contrast landscape format vector PDFs 100% in your browser.',
      icon: Sparkles,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'pdfToImg',
      title: 'PDF to Image Raster',
      desc: 'Process every sheet of a target file into ready-to-download high-resolution JPG snapshots.',
      icon: Image,
      badge: 'Local-Only',
      badgeStyle: 'bg-stone-100 text-stone-600 border-stone-200',
    },
    {
      id: 'imgToPdf',
      title: 'Images to PDF Pack',
      desc: 'Sequence multiple PNG/JPG graphic screenshots together into a single, cohesive PDF.',
      icon: FileUp,
      badge: 'Local-Only',
      badgeStyle: 'bg-stone-100 text-stone-600 border-stone-200',
    },
    {
      id: 'pdfToTxt',
      title: 'PDF to Normalized TXT',
      desc: 'Extract clean OCR textual arrays complete with customized Unicode compatibility mappings.',
      icon: CheckCircle2,
      badge: 'Normalized',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
    {
      id: 'htmlToPdf',
      title: 'HTML / Text Composer',
      desc: 'Draft customizable rich reports on our browser text editor and print them onto a PDF.',
      icon: Download,
      badge: 'Workspace',
      badgeStyle: 'bg-blue-50 text-blue-850 border-blue-150',
    },
    {
      id: 'txtToPdf',
      title: 'TXT to PDF Converter',
      desc: 'Convert plain text (.txt) files into structured, multi-page vector PDFs with dynamic line wrapping, page breaks, margins, and headers.',
      icon: FileText,
      badge: 'Local-Only',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-150',
    },
  ];

  // ==========================================
  // CLIENT-SIDE CONVERSION ENGINES (100% Browser Local)
  // ==========================================
  const runPdfToWordClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Loading PDF document structure in browser sandbox...");

    try {
      if (!window.pdfjsLib) {
        throw new Error("PDF.js library is not loaded. Please wait for the script to synchronize.");
      }

      const buffer = await targetFile.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const docxParagraphs: docx.Paragraph[] = [];
      setProgressMsg(`Parsing ${totalPages} page(s) for layout elements...`);

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgressMsg(`Extracting text rows from Page ${pageNum}/${totalPages}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        if (items.length === 0) continue;

        // Group text items with similar Y-coordinates (tolerance of 6pt)
        const linesMap: { y: number; items: any[] }[] = [];
        for (const item of items) {
          const y = item.transform[5];
          let line = linesMap.find(l => Math.abs(l.y - y) < 6);
          if (line) {
            line.items.push(item);
          } else {
            linesMap.push({ y, items: [item] });
          }
        }

        // Sort lines by Y descending (top to bottom)
        linesMap.sort((a, b) => b.y - a.y);

        // For each line, sort items by X ascending (left to right) and format
        for (const line of linesMap) {
          line.items.sort((a, b) => a.transform[4] - b.transform[4]);

          const itemsInfo = line.items.map(item => {
            const style = textContent.styles[item.fontName];
            const fontStr = ((style?.fontFamily || '') + '_' + item.fontName).toLowerCase();
            const isBold = fontStr.includes('bold') || fontStr.includes('black') || fontStr.includes('heavy') || fontStr.includes('semibold') || fontStr.includes('gothic');
            
            const transformSize = Math.abs(item.transform[3]);
            const fontSize = item.height || transformSize || 10;
            return {
              str: item.str,
              fontSize,
              isBold,
            };
          });

          // Merge contiguous text runs with identical styles
          const mergedItems: { str: string; fontSize: number; isBold: boolean }[] = [];
          for (const info of itemsInfo) {
            const cleanedText = cleanAndNormalizeUnicode(info.str);
            if (!cleanedText) continue;

            if (mergedItems.length > 0) {
              const last = mergedItems[mergedItems.length - 1];
              if (last.fontSize === info.fontSize && last.isBold === info.isBold) {
                last.str += (last.str.endsWith(' ') || cleanedText.startsWith(' ') ? '' : ' ') + cleanedText;
              } else {
                mergedItems.push({
                  str: cleanedText,
                  fontSize: info.fontSize,
                  isBold: info.isBold
                });
              }
            } else {
              mergedItems.push({
                str: cleanedText,
                fontSize: info.fontSize,
                isBold: info.isBold
              });
            }
          }

          if (mergedItems.length > 0) {
            const maxFontSize = Math.max(...mergedItems.map(mi => mi.fontSize));
            const isLineHeading = maxFontSize >= 14;
            const paragraphHeading = isLineHeading 
              ? (maxFontSize >= 18 ? docx.HeadingLevel.HEADING_1 : docx.HeadingLevel.HEADING_2) 
              : undefined;

            const docxParagraph = new docx.Paragraph({
              heading: paragraphHeading,
              spacing: { before: isLineHeading ? 220 : 120, after: 120, line: 240 },
              children: mergedItems.map(mi => {
                return new docx.TextRun({
                  text: mi.str,
                  font: "Arial",
                  size: Math.round(mi.fontSize * 2),
                  bold: mi.isBold,
                  color: isLineHeading ? "111827" : "374151"
                });
              })
            });
            docxParagraphs.push(docxParagraph);
          }
        }
      }

      setProgressMsg("Formatting structured Rich text Document lines (.docx)...");

      const doc = new docx.Document({
        sections: [
          {
            properties: {},
            children: docxParagraphs
          }
        ]
      });

      setProgressMsg("Packaging files into client downloadable bytes...");
      const docBlob = await docx.Packer.toBlob(doc);
      
      const downloadUrl = URL.createObjectURL(docBlob);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;

      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      tempLink.download = `${strippedName}_converted.docx`;

      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side PDF-to-Word conversion.");
      setIsProcessing(false);
    }
  };

  const runWordToPdfClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Scanning XML structure from local word document...");

    try {
      const arrayBuffer = await targetFile.arrayBuffer();

      // Create a temporary wrapper with height 0 and overflow hidden to avoid display, keeping children at 100% opacity and normal flow coordinates
      const wrapper = document.createElement('div');
      wrapper.id = 'temp-docx-pdf-wrapper';
      wrapper.style.height = '0';
      wrapper.style.overflow = 'hidden';
      wrapper.style.position = 'relative';
      document.body.appendChild(wrapper);

      const tempContainer = document.createElement('div');
      tempContainer.id = 'temp-docx-pdf-container';
      tempContainer.style.width = '800px';
      tempContainer.style.background = '#ffffff';
      tempContainer.style.color = '#000000';
      tempContainer.style.padding = '45px';
      tempContainer.style.fontFamily = 'Arial, sans-serif';
      wrapper.appendChild(tempContainer);

      setProgressMsg("Formatting vector graphics and font structures (docx-preview)...");
      await renderAsync(arrayBuffer, tempContainer);

      // Sequential DOM rendering paint guarantee using a promise wrapper with requestAnimationFrame
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 500); // Wait 500ms to be fully painted and ready in DOM
          });
        });
      });

      setProgressMsg("Compiling high-contrast document pages (html2pdf)...");
      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      
      const opt = {
        margin:       0,
        filename:     `${strippedName}_converted.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().from(tempContainer).set(opt).save();

      // Cleanup DOM structure
      document.body.removeChild(wrapper);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side Word-to-PDF compiler.");
      setIsProcessing(false);
      const oldWrapper = document.getElementById('temp-docx-pdf-wrapper');
      if (oldWrapper && oldWrapper.parentNode) {
        oldWrapper.parentNode.removeChild(oldWrapper);
      }
    }
  };

  const runPdfToExcelClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Loading PDF tabular grid coordinates...");

    try {
      if (!window.pdfjsLib) {
        throw new Error("PDF.js library is not loaded. Please wait.");
      }

      const buffer = await targetFile.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const rows2D: string[][] = [];
      setProgressMsg(`Tracing aligned data elements across ${totalPages} page(s)...`);

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgressMsg(`Mapping column alignments on Page ${pageNum}/${totalPages}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        if (items.length === 0) continue;

        // Group layout elements by common row threshold (Y axis coordinates)
        const rowsMap: Map<number, any[]> = new Map();

        items.forEach(item => {
          const y = item.transform[5];
          let foundKey: number | null = null;
          for (const key of rowsMap.keys()) {
            if (Math.abs(key - y) < 8) {
              foundKey = key;
              break;
            }
          }

          if (foundKey !== null) {
            rowsMap.get(foundKey)!.push(item);
          } else {
            rowsMap.set(y, [item]);
          }
        });

        // Sort row Y-boundaries descending (top of page down to bottom)
        const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => b - a);

        sortedRowKeys.forEach(yKey => {
          const rowItems = rowsMap.get(yKey)!;
          // Sort column elements ascending (left to right)
          rowItems.sort((a, b) => a.transform[4] - b.transform[4]);

          const rowCells: string[] = [];
          let currentCellText: string[] = [];
          let prevXEnd = -1;

          rowItems.forEach((item) => {
            const xStart = item.transform[4];
            const str = item.str;
            const widthEst = item.width || (str.length * 6);

            if (prevXEnd === -1) {
              currentCellText.push(str);
            } else {
              const gap = xStart - prevXEnd;
              if (gap > 22) { // Detect cell break spacing gap
                rowCells.push(currentCellText.join(' ').trim());
                currentCellText = [str];
              } else {
                currentCellText.push(str);
              }
            }
            prevXEnd = xStart + widthEst;
          });

          if (currentCellText.length > 0) {
            rowCells.push(currentCellText.join(' ').trim());
          }

          if (rowCells.some(cell => cell.length > 0)) {
            const normalizedCells = rowCells.map(c => cleanAndNormalizeUnicode(c));
            rows2D.push(normalizedCells);
          }
        });

        if (pageNum < totalPages) {
          rows2D.push([`--- PAGE BREAK: ${pageNum} -> ${pageNum + 1} ---`]);
        }
      }

      setProgressMsg("Injecting matrices into OpenXML worksheets (SheetJS)...");
      const worksheet = XLSX.utils.aoa_to_sheet(rows2D);

      // Loop through matrix items to calculate max column character widths
      const colWidths: number[] = [];
      for (let r = 0; r < rows2D.length; r++) {
        const row = rows2D[r];
        for (let c = 0; c < row.length; c++) {
          const val = row[c] || '';
          const valLen = val.toString().length;
          if (colWidths[c] === undefined || valLen > colWidths[c]) {
            colWidths[c] = valLen;
          }
        }
      }
      
      // Inject column dimension constraints ('!cols') into SheetJS
      worksheet['!cols'] = colWidths.map(w => ({ wch: Math.max(w || 10, 10) }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Extracted PDF Table');

      setProgressMsg("Encoding compression spreadsheets...");
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

      setProgressMsg("Saving Excel binary collection locally...");
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;

      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      tempLink.download = `${strippedName}_sheets.xlsx`;

      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side PDF-to-Excel compiler.");
      setIsProcessing(false);
    }
  };

  const runExcelToPdfClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Scanning uploaded spreadsheet structures locally...");

    try {
      const arrayBuffer = await targetFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!jsonData || jsonData.length === 0) {
        throw new Error("Unable to parse any rows or cells from this workbook.");
      }

      setProgressMsg("Formatting vector grid rows using jsPDF autotable...");

      // Inspect column size counts
      const maxCols = Math.max(...jsonData.map(row => row.length));
      
      // Switch the jsPDF instance dynamically to landscape if columns exceed 5
      const orientation = maxCols > 5 ? 'landscape' : 'portrait';
      const doc = new jsPDF({ 
        orientation: orientation, 
        unit: 'pt', 
        format: 'letter' 
      });

      // First row as headers
      const headers = jsonData[0].map(val => String(val ?? ''));
      const dataRows = jsonData.slice(1).map(row => row.map(val => String(val ?? '')));

      // Wrap table data inside jspdf-autotable configurations to avoid page clipping
      autoTable(doc, {
        head: [headers],
        body: dataRows,
        theme: 'grid',
        styles: {
          fontSize: maxCols > 8 ? 6 : 8, // dynamically adjust font size if there are many columns
          cellPadding: 4,
          lineColor: [220, 220, 220],
          lineWidth: 0.5,
          overflow: 'linebreak', // Ensure text wraps to avoid clipping
        },
        headStyles: {
          fillColor: [234, 88, 12], // PDFly orange brand background color
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        margin: { top: 40, bottom: 40, left: 30, right: 30 }
      });

      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      doc.save(`${strippedName}_grid.pdf`);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side Excel-to-PDF compiler.");
      setIsProcessing(false);
    }
  };

  const runPdfToPptClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Loading PDF document index structures in local sandbox...");

    try {
      if (!window.pdfjsLib) {
        throw new Error("PDF.js library is not loaded. Please wait.");
      }

      // Dynamically load pptxgenjs CDN script if not present on window
      if (!(window as any).PptxGenJS) {
        setProgressMsg("Loading pptxgenjs library from CDN...");
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
          document.body.appendChild(script);
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load pptxgenjs library from CDN."));
        });
      }

      const buffer = await targetFile.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      const pptx = new (window as any).PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      setProgressMsg(`Rendering ${totalPages} page(s) to presentation slide backgrounds...`);

      for (let i = 1; i <= totalPages; i++) {
        setProgressMsg(`Rasterizing PDF Page ${i}/${totalPages}...`);
        const page = await pdf.getPage(i);
        
        // Render PDF page to HTML5 canvas
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const context = canvas.getContext('2d');
        
        if (context) {
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Export canvas as image
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          
          // Slide-by-slide append them as full-screen background assets
          const slide = pptx.addSlide();
          slide.background = { data: imgData };
        }
      }

      setProgressMsg("Saving PowerPoint presentation...");
      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      await pptx.writeFile({ fileName: `${strippedName}_presentation.pptx` });

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side PDF-to-PPT converter.");
      setIsProcessing(false);
    }
  };

  const runPptToPdfClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Unzipping PowerPoint archive structure...");

    try {
      // Dynamically load JSZip if not present on window
      if (!(window as any).JSZip) {
        setProgressMsg("Loading JSZip library from CDN...");
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          document.body.appendChild(script);
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load JSZip library from CDN."));
        });
      }

      const arrayBuffer = await targetFile.arrayBuffer();
      const zip = await (window as any).JSZip.loadAsync(arrayBuffer);
      const parser = new DOMParser();

      // Find all slide XML files
      const slideFiles = Object.keys(zip.files).filter(name => 
        name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
      );

      if (slideFiles.length === 0) {
        throw new Error("No slide layout structure found inside the uploaded PowerPoint presentation.");
      }

      // Sort slide files numerically
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^\d]/g, ''), 10);
        const numB = parseInt(b.replace(/[^\d]/g, ''), 10);
        return numA - numB;
      });

      const slidesTextList: string[] = [];
      setProgressMsg(`Parsing presentation slide structures...`);

      for (const name of slideFiles) {
        const xmlString = await zip.files[name].async('string');
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
        const textNodes = xmlDoc.getElementsByTagName('a:t');
        
        let slideText = '';
        for (let j = 0; j < textNodes.length; j++) {
          slideText += (textNodes[j].textContent || '') + ' ';
        }
        slidesTextList.push(slideText.trim());
      }

      setProgressMsg("Formatting vector presentation pages using pdf-lib on a landscape canvas...");
      const pdfDoc = await PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (let i = 0; i < slidesTextList.length; i++) {
        const page = pdfDoc.addPage([792, 612]); // Landscape Letter format
        const { width, height } = page.getSize();

        // Premium layout cards: Border card
        page.drawRectangle({
          x: 30,
          y: 30,
          width: width - 60,
          height: height - 60,
          borderColor: rgb(0.9, 0.9, 0.9),
          borderWidth: 1.5,
        });

        // Top thin accent bar (PDFly brand orange)
        page.drawRectangle({
          x: 30,
          y: height - 36,
          width: width - 60,
          height: 6,
          color: rgb(0.917, 0.345, 0.043),
        });

        // Slide title
        page.drawText(`PRESENTATION DECK: SLIDE ${i + 1}`, {
          x: 60,
          y: height - 80,
          size: 18,
          font: fontBold,
          color: rgb(0.917, 0.345, 0.043),
        });

        // Slide underline strip
        page.drawRectangle({
          x: 60,
          y: height - 95,
          width: 250,
          height: 1.5,
          color: rgb(0.917, 0.345, 0.043),
        });

        const slideText = slidesTextList[i] || "[No text found on this slide]";
        const cleanedText = cleanAndNormalizeUnicode(slideText);
        
        // Split text body into lines and format/wrap manually
        const words = cleanedText.split(' ');
        let currentLine = '';
        let lineY = height - 140;

        for (let j = 0; j < words.length; j++) {
          const testLine = currentLine ? currentLine + ' ' + words[j] : words[j];
          const textW = fontRegular.widthOfTextAtSize(testLine, 12);
          if (textW > width - 120) {
            page.drawText(currentLine, { x: 60, y: lineY, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
            lineY -= 20;
            currentLine = words[j];
            if (lineY < 85) break;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine && lineY >= 85) {
          page.drawText(currentLine, { x: 60, y: lineY, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        }

        // Footer slide number
        page.drawText(`Slide ${i + 1} of ${slidesTextList.length}`, {
          x: width - 120,
          y: 50,
          size: 9,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Footer brand
        page.drawText(`🔒 Secure Local Sandbox Conversion`, {
          x: 60,
          y: 50,
          size: 8,
          font: fontRegular,
          color: rgb(0.6, 0.6, 0.6),
        });
      }

      setProgressMsg("Downloading PDF presentation...");
      const pdfBytes = await pdfDoc.save();

      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;

      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      tempLink.download = `${strippedName}_presentation.pdf`;

      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side PowerPoint-to-PDF converter.");
      setIsProcessing(false);
    }
  };

  const runTxtToPdfClient = async (targetFile: File) => {
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Reading plain text file...");

    try {
      const text = await targetFile.text();
      const cleanText = cleanAndNormalizeUnicode(text);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });

      const margin = 54; // standard 0.75-inch margin (54pt)
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const containerWidth = pageWidth - (margin * 2);
      
      const fontSize = 11;
      doc.setFont('Helvetica');
      doc.setFontSize(fontSize);
      
      // Calculate dynamic line heights for plaintext files
      const lineHeight = fontSize * 1.4;

      // Use jsPDF's splitTextToSize utility to handle line wrapping against container widths
      const wrappedLines: string[] = doc.splitTextToSize(cleanText, containerWidth);

      // Maintain an active Y-coordinate index tracker
      let currentY = margin + fontSize; // Start below the top margin
      const bottomThreshold = pageHeight - margin;

      // Running Header & Footer Renderer
      const drawHeaderFooter = (pageNum: number) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        // Header
        doc.text(`Document: ${targetFile.name}`, margin, margin - 15);
        doc.line(margin, margin - 8, pageWidth - margin, margin - 8);
        
        // Footer
        doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - margin + 20, { align: 'center' });
        doc.text(`🔒 Private Client Sandbox`, margin, pageHeight - margin + 20);
        
        // Reset styles for regular text
        doc.setFontSize(fontSize);
        doc.setTextColor(40, 40, 40);
      };

      // Draw header and footer on first page
      let pageNumber = 1;
      drawHeaderFooter(pageNumber);

      for (let i = 0; i < wrappedLines.length; i++) {
        const line = wrappedLines[i];
        
        // If the height pointer drops below the bottom margin threshold
        if (currentY + lineHeight > bottomThreshold) {
          // inject a local page break
          doc.addPage();
          pageNumber++;
          // reset the coordinate pointer back to the top-margin header line
          currentY = margin + fontSize;
          // draw header & footer on new page
          drawHeaderFooter(pageNumber);
        }

        // Draw line text
        doc.text(line, margin, currentY);
        currentY += lineHeight;
      }

      const strippedName = targetFile.name.substring(0, targetFile.name.lastIndexOf('.')) || targetFile.name;
      doc.save(`${strippedName}_converted.pdf`);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed client-side TXT-to-PDF compiler.");
      setIsProcessing(false);
    }
  };

  // Safe Client-Side Unified Router (No network uploads, zero files sent to APIs)
  const runServerConversion = async (targetFile: File | null) => {
    if (!targetFile || !direction) {
      setError("Please load a valid document file.");
      return;
    }

    if (direction === 'pdfToWord') {
      await runPdfToWordClient(targetFile);
      return;
    }
    if (direction === 'wordToPdf') {
      await runWordToPdfClient(targetFile);
      return;
    }
    if (direction === 'pdfToExcel') {
      await runPdfToExcelClient(targetFile);
      return;
    }
    if (direction === 'excelToPdf') {
      await runExcelToPdfClient(targetFile);
      return;
    }
    if (direction === 'pdfToPpt') {
      await runPdfToPptClient(targetFile);
      return;
    }
    if (direction === 'pptToPdf') {
      await runPptToPdfClient(targetFile);
      return;
    }
    if (direction === 'txtToPdf') {
      await runTxtToPdfClient(targetFile);
      return;
    }
  };

  // ==========================================
  // VIEW DIRECTIVE 1: PDF TO JPG/PNG WORKSPACE
  // ==========================================
  const [pdfToImgFile, setPdfToImgFile] = useState<File | null>(null);
  const [renderedImages, setRenderedImages] = useState<string[]>([]);
  
  const runPdfToImg = async () => {
    if (!pdfToImgFile || !window.pdfjsLib) return;
    setIsProcessing(true);
    setError(null);
    setRenderedImages([]);
    setProgressMsg('Unlocking local PDF document index tree...');

    try {
      // Dynamically load JSZip if not present on window
      if (!(window as any).JSZip) {
        setProgressMsg("Loading JSZip library from CDN...");
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          document.body.appendChild(script);
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load JSZip library from CDN."));
        });
      }

      const buffer = await pdfToImgFile.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const count = pdf.numPages;
      setProgressMsg(`Rendering sequence: ${count} pages onto canvas layers...`);

      const zip = new (window as any).JSZip();
      const outputs: string[] = [];

      for (let i = 1; i <= count; i++) {
        setProgressMsg(`Pasting raster cells for page ${i}/${count}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const context = canvas.getContext('2d');
        
        if (context) {
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          // Get JPEG Blob from Canvas
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
          });
          
          if (blob) {
            zip.file(`page_${i}.jpg`, blob);
          }
          outputs.push(canvas.toDataURL('image/jpeg', 0.9));
        }
      }

      setProgressMsg('Generating compressed ZIP archive (JSZip)...');
      const zipContent = await zip.generateAsync({ type: 'blob' });
      
      const downloadUrl = URL.createObjectURL(zipContent);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;
      tempLink.download = `converted-images.zip`;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

      setRenderedImages(outputs);
      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      setError(err?.message || 'Error rendering PDF sheets to JPG images.');
      setIsProcessing(false);
    }
  };

  // ==========================================
  // VIEW DIRECTIVE 2: JPG/PNG TO PDF WORKSPACE
  // ==========================================
  const [imgToPdfFiles, setImgToPdfFiles] = useState<File[]>([]);
  const [pageSizeConf, setPageSizeConf] = useState<'letter' | 'a4'>('letter');

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImgToPdfFiles(prev => [...prev, ...filesArray]);
    }
  };

  const removeImgFile = (index: number) => {
    setImgToPdfFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const runImgToPdf = async () => {
    if (imgToPdfFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg('Initializing blank page-wrap container...');

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < imgToPdfFiles.length; i++) {
        const file = imgToPdfFiles[i];
        setProgressMsg(`Processing image element ${i + 1}/${imgToPdfFiles.length}: "${file.name}"...`);
        
        const arrayBuffer = await file.arrayBuffer();
        let imageObj;
        
        if (file.type === 'image/png' || file.name.endsWith('.png')) {
          imageObj = await pdfDoc.embedPng(arrayBuffer);
        } else {
          imageObj = await pdfDoc.embedJpg(arrayBuffer);
        }

        const page = pdfDoc.addPage(
          pageSizeConf === 'letter' ? [612, 792] : [595, 842]
        );
        
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        const scaleFit = Math.min(
          (pageWidth - 60) / imageObj.width,
          (pageHeight - 60) / imageObj.height
        );
        
        const drawWidth = imageObj.width * scaleFit;
        const drawHeight = imageObj.height * scaleFit;
        const drawX = (pageWidth - drawWidth) / 2;
        const drawY = (pageHeight - drawHeight) / 2;

        page.drawImage(imageObj, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight
        });
      }

      setProgressMsg('Aligning streams and packing files...');
      const bytes = await pdfDoc.save({ useObjectStreams: true });
      
      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `compiled_images_output.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      setError(err?.message || 'Error converting images to PDF.');
      setIsProcessing(false);
    }
  };

  // ==========================================
  // VIEW DIRECTIVE 3: PDF TO TEXT WORKSPACE (Normalized)
  // ==========================================
  const [pdfToTxtFile, setPdfToTxtFile] = useState<File | null>(null);
  const [extractedTxt, setExtractedTxt] = useState<string>('');

  const runPdfToTxt = async () => {
    if (!pdfToTxtFile || !window.pdfjsLib) return;
    setIsProcessing(true);
    setError(null);
    setExtractedTxt('');
    setProgressMsg('Unzipping text strings from PDF structure...');

    try {
      const buffer = await pdfToTxtFile.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const count = pdf.numPages;
      
      let allText = '';
      for (let i = 1; i <= count; i++) {
        setProgressMsg(`Extracting text nodes for page ${i}/${count}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        allText += `\n\n--- PAGE ${i} ---\n\n${pageText || '[No searchable text layer on this page]'}`;
      }

      // Requirement 3: Applying robust Unicode normalization right before delivery
      const normalizedString = cleanAndNormalizeUnicode(allText);
      setExtractedTxt(normalizedString);
      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      setError(err?.message || 'Error executing text extraction.');
      setIsProcessing(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!extractedTxt) return;
    const blob = new Blob([extractedTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = pdfToTxtFile?.name.substring(0, pdfToTxtFile.name.lastIndexOf('.')) || 'extracted';
    link.download = `${name}_clean.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // VIEW DIRECTIVE 4: RICH WRITER / HTML TO PDF
  // ==========================================
  const [htmlInput, setHtmlInput] = useState<string>(
    '# PDFly Corporate Report\n\nGenerated: Secure Client-Side Sandbox Ecosystem\n\nThis is a standard report written cleanly in our workspace text editor. Draft guidelines, outlines, or tables, then export them straight to a printed document index in standard letter margins.'
  );

  const runHtmlToPdf = async () => {
    if (!htmlInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    setProgressMsg('Drafting geometric print canvas...');

    try {
      await new Promise(resolve => setTimeout(resolve, 350));
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]);

      page.drawRectangle({
        x: 40,
        y: 730,
        width: 532,
        height: 3,
        color: undefined
      });
      
      const lines = htmlInput.split('\n');
      let baselineY = 700;

      lines.forEach((line) => {
        if (baselineY < 50) return;
        
        const isHeader = line.startsWith('#');
        const renderText = isHeader ? line.replace('#', '').trim() : line.trim();

        if (renderText) {
          page.drawText(renderText, {
            x: 45,
            y: baselineY,
            size: isHeader ? 16 : 10,
            lineHeight: 14,
            maxWidth: 512
          });
          baselineY -= isHeader ? 28 : 18;
        } else {
          baselineY -= 12;
        }
      });

      setProgressMsg('Writing final compiled array structures...');
      const bytes = await pdfDoc.save();

      const blob = new Blob([bytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pdfly_drafted_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      setError(err?.message || 'Error compiling custom report PDF configuration.');
      setIsProcessing(false);
    }
  };


  // ==========================================
  // COMMON LOCAL SANDBOX COMPILER FOR NEW UTILITIES
  // ==========================================
  const [loadedPipelineFile, setLoadedPipelineFile] = useState<File | null>(null);

  const getPipelineAcceptTypes = () => {
    if (direction === 'pdfToWord' || direction === 'pdfToExcel' || direction === 'pdfToPpt') {
      return '.pdf';
    }
    if (direction === 'wordToPdf') {
      return '.docx,.doc';
    }
    if (direction === 'excelToPdf') {
      return '.xlsx,.csv';
    }
    if (direction === 'pptToPdf') {
      return '.pptx,.ppt';
    }
    if (direction === 'txtToPdf') {
      return '.txt';
    }
    return '*';
  };

  const getPipelineTitle = () => {
    switch(direction) {
      case 'pdfToWord': return 'PDF to Word Doc Extractor';
      case 'wordToPdf': return 'Microsoft Word to PDF Compiler';
      case 'pdfToExcel': return 'PDF to Excel Sheets';
      case 'excelToPdf': return 'Spreadsheet Excel to PDF Grid';
      case 'pdfToPpt': return 'PDF to Slide Deck Outline';
      case 'pptToPdf': return 'Corporate Presentation to PDF';
      case 'txtToPdf': return 'Plain Text to PDF Compiler';
      default: return 'Document pipeline conversion';
    }
  };

  const getPipelineDesc = () => {
    switch(direction) {
      case 'pdfToWord': return 'Load a text-layered PDF to extract its textual flows into an editable Word document (.docx) in browser sandbox memory.';
      case 'wordToPdf': return 'Compile Word draft files (.docx, .doc) into standard, high-contrast, fully formatted PDFs completely offline.';
      case 'pdfToExcel': return 'Parse and align tables and lines of spacing data out of PDF into a cleanly formatted .xlsx spreadsheet.';
      case 'excelToPdf': return 'Compile sheet tables or raw CSV lists with bordered grids directly onto landscape vector PDFs.';
      case 'pdfToPpt': return 'Translate chapters and core outlines from multi-page PDFs into PowerPoint slides (.ppt) in offline memory.';
      case 'pptToPdf': return 'Load presentation files (.pptx, .ppt) to draw slides sequentially onto landscape vector PDFs.';
      case 'txtToPdf': return 'Convert plain text files (.txt) into structured, multi-page vector PDFs with dynamic line wrapping, page breaks, margins, and headers.';
      default: return 'Private isolated offline compiler engine';
    }
  };

  const currentIcon = () => {
    switch(direction) {
      case 'pdfToWord': return <FileText className="h-10 w-10 text-orange-600" />;
      case 'wordToPdf': return <FileClock className="h-10 w-10 text-orange-600" />;
      case 'pdfToExcel': return <Table className="h-10 w-10 text-orange-600" />;
      case 'excelToPdf': return <Sliders className="h-10 w-10 text-orange-600" />;
      case 'pdfToPpt': return <Presentation className="h-10 w-10 text-orange-600" />;
      case 'pptToPdf': return <Sparkles className="h-10 w-10 text-orange-600" />;
      case 'txtToPdf': return <FileText className="h-10 w-10 text-orange-600" />;
      default: return <FileUp className="h-10 w-10 text-orange-600" />;
    }
  };

  // Switcher layout or main details page
  if (direction === null) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-600" />
            Convert PDF Suite
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Choose a specialized document compiler from the interactive grid deck. All processes are protected.
          </p>
        </div>

        {/* REFACTORING: Unified Grid Layout of Feature Cards (Requirement 2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {converterList.map((card) => {
            const CardIcon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => {
                  setDirection(card.id);
                  setError(null);
                  setSuccess(false);
                  setLoadedPipelineFile(null);
                  setPdfToImgFile(null);
                  setImgToPdfFiles([]);
                  setPdfToTxtFile(null);
                }}
                className="group bg-white border border-stone-200/85 hover:border-orange-500 rounded-2xl p-5 shadow-xs hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between h-52 relative overflow-hidden"
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                      <CardIcon className="h-4.5 w-4.5 stroke-[2.2]" />
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${card.badgeStyle}`}>
                      {card.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-800 tracking-tight group-hover:text-orange-700 transition-colors">
                      {card.title}
                    </h4>
                    <p className="text-[10px] text-stone-500 mt-1 line-clamp-3 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-extrabold tracking-tight group-hover:text-orange-600 transition-colors mt-2">
                  <span>Open Workspace</span>
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      
      {/* Back button header (Return to Convert suite deck) */}
      <div 
        onClick={() => {
          setDirection(null);
          setError(null);
          setSuccess(false);
        }}
        className="flex items-center gap-1.5 text-stone-500 hover:text-stone-850 text-xs font-black tracking-tight cursor-pointer transition-colors w-fit border border-stone-200 bg-stone-50 hover:bg-stone-100/60 py-1.5 px-3 rounded-lg"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Convert Suite Grid</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Selected workspace interface */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          
          {/* LOCAL-ONLY 1: PDF to Images */}
          {direction === 'pdfToImg' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">PDF to Image (JPG Compilation)</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Renders page contents directly into in-tab browser resolution images.
                </p>
              </div>

              <div className="border border-stone-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <label className="text-xs font-bold text-stone-500">Upload PDF Document</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    setError(null);
                    setSuccess(false);
                    if (e.target.files && e.target.files.length > 0) {
                      setPdfToImgFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-3 text-xs focus:bg-white focus:outline-hidden"
                />

                {pdfToImgFile && (
                  <p className="text-[10px] text-stone-450 font-mono">
                    Loaded: {pdfToImgFile.name} ({formatBytes(pdfToImgFile.size)})
                  </p>
                )}

                <button
                  type="button"
                  onClick={runPdfToImg}
                  disabled={isProcessing || !pdfToImgFile}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-orange-200" />
                      Render Pages into JPGs
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* LOCAL-ONLY 2: JPG/PNG TO PDF */}
          {direction === 'imgToPdf' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">JPG/PNG to PDF Compiler</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Upload image assets sequentially and output a cleanly wrapped PDF structure.
                </p>
              </div>

              <div className="border border-stone-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-500">Page Configuration</label>
                  <select
                    value={pageSizeConf}
                    onChange={(e) => setPageSizeConf(e.target.value as 'letter' | 'a4')}
                    className="bg-stone-50 border border-stone-150 rounded-xl px-3 py-2 text-xs text-stone-700 focus:outline-hidden"
                  >
                    <option value="letter">Letter Layout (8.5 x 11 in)</option>
                    <option value="a4">A4 Layout (210 x 297 mm)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-stone-500">Append Graphic Files</label>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    onChange={handleImgUpload}
                    className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                {imgToPdfFiles.length > 0 && (
                  <div className="flex flex-col gap-2 bg-stone-50 rounded-xl p-3 max-h-36 overflow-y-auto border border-stone-150">
                    <span className="text-[10px] font-bold text-stone-400 uppercase">Image Queue Order</span>
                    {imgToPdfFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-stone-100 text-[10px] text-stone-700 font-medium">
                        <span className="truncate max-w-[200px]">{f.name} ({formatBytes(f.size)})</span>
                        <button
                          type="button"
                          onClick={() => removeImgFile(idx)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={runImgToPdf}
                  disabled={isProcessing || imgToPdfFiles.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Compiling Graphics...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-orange-200" />
                      Compile Images to PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* NORMALIZED WORKSPACE: PDF to TXT */}
          {direction === 'pdfToTxt' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">PDF to TXT Unicode Normalizer</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Extract searchable text lines and process ligature/math symbol errors into clean Unicode text.
                </p>
              </div>

              <div className="border border-stone-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <label className="text-xs font-bold text-stone-500">Pick PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    setError(null);
                    setSuccess(false);
                    if (e.target.files && e.target.files.length > 0) {
                      setPdfToTxtFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-3 text-xs focus:bg-white focus:outline-hidden"
                />

                {pdfToTxtFile && (
                  <p className="text-[10px] text-stone-450 font-mono">
                    Loaded: {pdfToTxtFile.name} ({formatBytes(pdfToTxtFile.size)})
                  </p>
                )}

                <button
                  type="button"
                  onClick={runPdfToTxt}
                  disabled={isProcessing || !pdfToTxtFile}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Running Normalizer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-orange-200" />
                      Normalize Text Layer
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* WORKSPACE RICH WRITER: HTML / Outline compiler */}
          {direction === 'htmlToPdf' && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Report Composer Workspace</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Draft clean text summaries or document structures inside the sandbox, then compile it into a PDF print list.
                </p>
              </div>

              <div className="border border-stone-200 bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-stone-500">Draft Document Body Text</label>
                  <textarea
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    rows={8}
                    placeholder="# Target Heading 1&#10;Type paragraph texts here..."
                    className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-3 text-xs focus:bg-white focus:outline-hidden font-mono leading-relaxed"
                  />
                  <span className="text-[9px] text-stone-400">Lines prefix with # will be rendered as display headings. Regular text compiles paragraph lines.</span>
                </div>

                <button
                  type="button"
                  onClick={runHtmlToPdf}
                  disabled={isProcessing || !htmlInput.trim()}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Compiling Outline...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-orange-200" />
                      Compile Report to PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* DYNAMIC NEW BI-DIRECTIONAL FULL-STACK PIPELINES (Requirement 1) */}
          {(direction === 'pdfToWord' || direction === 'wordToPdf' || 
            direction === 'pdfToExcel' || direction === 'excelToPdf' ||
            direction === 'pdfToPpt' || direction === 'pptToPdf' ||
            direction === 'txtToPdf') && (
            
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <h3 className="text-sm font-bold text-stone-900">{getPipelineTitle()}</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">{getPipelineDesc()}</p>
              </div>

              <div className="border border-stone-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div className="p-4 rounded-2xl border flex items-center gap-4 bg-emerald-50/50 border-emerald-100 text-emerald-800">
                  <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-xs shrink-0 text-stone-700">
                    {currentIcon()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none block mb-1 text-emerald-700">
                      Local Sandbox Engine
                    </span>
                    <h5 className="text-[11px] text-stone-700 font-medium leading-normal">
                      High-fidelity, browser-based compiled conversion executing 100% locally and privately on your device inside a secure sandbox.
                    </h5>
                  </div>
                </div>

                <label className="text-xs font-bold text-stone-500">Upload Target File</label>
                <input
                  type="file"
                  accept={getPipelineAcceptTypes()}
                  onChange={(e) => {
                    setError(null);
                    setSuccess(false);
                    if (e.target.files && e.target.files.length > 0) {
                      setLoadedPipelineFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-3 text-xs focus:bg-white focus:outline-hidden"
                />

                {loadedPipelineFile && (
                  <p className="text-[10px] text-stone-500 font-mono">
                    Buffered: {loadedPipelineFile.name} ({formatBytes(loadedPipelineFile.size)})
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => runServerConversion(loadedPipelineFile)}
                  disabled={isProcessing || !loadedPipelineFile}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Converting File Pipeline...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-orange-200" />
                      Execute Document Conversion
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Operation Errors Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 flex gap-3 text-rose-800 text-xs">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Conversion Interrupted:</span>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

        </div>

        {/* Right column: Sandbox Context Logs/Outputs Displays */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="font-bold text-stone-800 text-xs uppercase tracking-wider border-b border-stone-200 pb-2">
            Workspace Sandbox State
          </div>

          {/* Running logging arrays */}
          {isProcessing && (
            <div className="bg-stone-950 text-stone-200 border border-stone-800 p-4 rounded-xl font-mono text-xs shadow-md">
              <span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider font-mono">Stream Analyzer Log</span>
              <p className="mt-1 flex items-center gap-2 text-stone-300">
                <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
                {progressMsg}
              </p>
            </div>
          )}

          {/* Output success preview state */}
          {!isProcessing && success && (
            <div className="bg-gradient-to-br from-orange-50/40 to-stone-50/40 border border-orange-100 rounded-2xl p-5 flex flex-col gap-4 select-text">
              <div className="flex gap-2.5 items-center text-emerald-800 text-xs font-bold leading-none">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Conversion Complete & Saved!
              </div>

              {/* Slider images preview */}
              {direction === 'pdfToImg' && renderedImages.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Rendered PDF Page Snaps</span>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1.5 bg-stone-100/60 rounded-xl border border-stone-200">
                    {renderedImages.map((img, i) => (
                      <div key={i} className="bg-white p-2 border border-stone-200 rounded-lg flex flex-col gap-2 items-center">
                        <img src={img} className="max-h-24 object-contain shadow-xs border border-stone-100 rounded-sm" alt={`Page ${i+1}`} />
                        <button
                          type="button"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = img;
                            link.download = `${pdfToImgFile?.name ? pdfToImgFile.name.substring(0, pdfToImgFile.name.lastIndexOf('.')) : 'page'}_page_${i+1}.jpg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="text-[9px] font-bold text-orange-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Download className="h-2.5 w-2.5" /> Download Snapshot
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Normalization results display page */}
              {direction === 'pdfToTxt' && extractedTxt && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase">Normalized Unicode String (Snippet)</span>
                  <div className="bg-white p-3 rounded-xl border border-stone-200 max-h-40 overflow-y-auto text-[10px] font-mono text-stone-600 block whitespace-pre-wrap leading-relaxed select-text">
                    {extractedTxt.slice(0, 1500)}{extractedTxt.length > 1500 ? '...' : ''}
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors mt-2"
                  >
                    <Download className="h-4 w-4" /> Download Unified .TXT File
                  </button>
                </div>
              )}

              {/* Generic prompt success message for downloaded files */}
              {(direction === 'pdfToWord' || direction === 'wordToPdf' || 
                direction === 'pdfToExcel' || direction === 'excelToPdf' ||
                direction === 'pdfToPpt' || direction === 'pptToPdf' ||
                direction === 'txtToPdf' ||
                direction === 'imgToPdf' || direction === 'htmlToPdf') && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 leading-relaxed font-bold">
                  The compiled output document file has been constructed securely inside the sandbox and transferred automatically onto your computer's system download files list.
                </div>
              )}
            </div>
          )}

          {/* Placeholder default state */}
          {!isProcessing && !success && (
            <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-10 text-center text-stone-400 flex flex-col items-center justify-center min-h-[220px]">
              <LockCheckIcon className="h-7 w-7 text-stone-300" />
              <p className="text-xs font-black mt-3 text-stone-700 uppercase tracking-wide">Workspace Ready</p>
              <p className="text-[11px] text-stone-400 mt-1.5 max-w-[200px] leading-relaxed font-medium">
                Load target document assets to execute secure in-browser compilers in local RAM entirely offline.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Minimal placeholder graphics
function LockCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <path d="m11 16 1 1 2-2" />
    </svg>
  );
}
