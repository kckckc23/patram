import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { 
  FileUp, FileText, Download, Sparkles, RefreshCw, AlertCircle, 
  Image, FileCode, CheckCircle2, ChevronRight, Sliders, Palette,
  ArrowLeft, Table, Presentation, FileClock
} from 'lucide-react';
import { formatBytes } from '../utils/pdf';

type ConvertDirection = 
  | 'pdfToImg' | 'imgToPdf' | 'pdfToTxt' | 'htmlToPdf'
  | 'pdfToWord' | 'wordToPdf' | 'pdfToExcel' | 'excelToPdf'
  | 'pdfToPpt' | 'pptToPdf';

interface ConverterCard {
  id: ConvertDirection;
  title: string;
  desc: string;
  icon: any;
  badge: 'Local-Only' | 'Full-Stack' | 'Normalized' | 'Workspace';
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
      desc: 'Process PDF text structures and layout stream buffers into standard fully formatted Word documents (.doc).',
      icon: FileText,
      badge: 'Full-Stack',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    {
      id: 'wordToPdf',
      title: 'Word to PDF Compiler',
      desc: 'Interpret Microsoft Word XML text structures and compile them into a print-ready formatted PDF.',
      icon: FileClock,
      badge: 'Full-Stack',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    {
      id: 'pdfToExcel',
      title: 'PDF to Excel Sheets',
      desc: 'Detect and isolate tabular grids or figures in PDFs and output highly structured CSV charts.',
      icon: Table,
      badge: 'Full-Stack',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    {
      id: 'excelToPdf',
      title: 'Excel to PDF Grid',
      desc: 'Turn massive CSV sheets or tabular grid data lists into cleanly spaced PDF print outlines.',
      icon: Sliders,
      badge: 'Full-Stack',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    {
      id: 'pdfToPpt',
      title: 'PDF to Slide Deck',
      desc: 'Analyze paragraphs to compile formatted presentation elements into PowerPoint templates.',
      icon: Presentation,
      badge: 'Full-Stack',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-100',
    },
    {
      id: 'pptToPdf',
      title: 'PowerPoint to PDF',
      desc: 'Interpret corporate slideshow outlines and render them on landscape orientation PDF sheets.',
      icon: Sparkles,
      badge: 'Full-Stack',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-100',
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
  ];

  // POST multipart files to backend server nodes
  const runServerConversion = async (targetFile: File | null) => {
    if (!targetFile || !direction) {
      setError("Please load a valid document file.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(false);
    setProgressMsg("Allocating multi-part form parameters...");

    try {
      const formData = new FormData();
      formData.append("file", targetFile);
      formData.append("direction", direction);

      setProgressMsg("Sending file bytes to high-speed secure sandbox network...");
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error ?? "Failed inside sandbox server engine pipeline.");
      }

      setProgressMsg("Streaming compiled output array structures from server...");
      const fileBlob = await response.blob();
      
      const downloadUrl = URL.createObjectURL(fileBlob);
      const tempLink = document.createElement("a");
      tempLink.href = downloadUrl;

      // Deduce file extension
      const originalName = targetFile.name;
      const strippedName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
      
      if (direction === "pdfToWord") {
        tempLink.download = `${strippedName}_converted.doc`;
      } else if (direction === "wordToPdf") {
        tempLink.download = `${strippedName}_converted.pdf`;
      } else if (direction === "pdfToExcel") {
        tempLink.download = `${strippedName}_sheets.csv`;
      } else if (direction === "excelToPdf") {
        tempLink.download = `${strippedName}_grid.pdf`;
      } else if (direction === "pdfToPpt") {
        tempLink.download = `${strippedName}_deck.ppt`;
      } else if (direction === "pptToPdf") {
        tempLink.download = `${strippedName}_slides.pdf`;
      }

      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Internal error compiling full-stack request.");
      setIsProcessing(false);
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
      const buffer = await pdfToImgFile.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      const count = pdf.numPages;
      setProgressMsg(`Rendering sequence: ${count} pages onto canvas layers...`);

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
          outputs.push(canvas.toDataURL('image/jpeg', 0.9));
        }
      }

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
      
      const blob = new Blob([bytes], { type: 'application/pdf' });
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

      const blob = new Blob([bytes], { type: 'application/pdf' });
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
  // COMMON FULL-STACK COMPILER FOR NEW UTILITIES
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
    return '*';
  };

  const getPipelineTitle = () => {
    switch(direction) {
      case 'pdfToWord': return 'PDF to Word Doc Extractor';
      case 'wordToPdf': return 'Microsoft Word to PDF Compiler';
      case 'pdfToExcel': return 'PDF to Excel CSV Spreadsheet';
      case 'excelToPdf': return 'CSV / Excel Worksheet to PDF';
      case 'pdfToPpt': return 'PDF to Slide Deck Outline';
      case 'pptToPdf': return 'Corporate Presentation to PDF';
      default: return 'Document pipeline conversion';
    }
  };

  const getPipelineDesc = () => {
    switch(direction) {
      case 'pdfToWord': return 'Upload a text-layered PDF to convert its textual flows into an editable Microsoft Word document (.doc).';
      case 'wordToPdf': return 'Convert your Word draft files (.docx, .doc) quickly into standard, high-contrast, fully formatted PDFs.';
      case 'pdfToExcel': return 'Extract tables and lines of spacing data out of PDF into a cleanly formatted sheet .CSV file.';
      case 'excelToPdf': return 'Render plain spreadsheet sheets or raw CSV lists with bordered grids directly onto a landscape landscape layout PDF.';
      case 'pdfToPpt': return 'Condense chapters and core outlines from multi-page PDFs into readable slideshow pages (.ppt).';
      case 'pptToPdf': return 'Upload presentation files (.pptx, .ppt) to layout slides with slide boundaries into a landscape orientation PDF.';
      default: return 'Full-stack isolated offline compiler engine';
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
            direction === 'pdfToPpt' || direction === 'pptToPdf') && (
            
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <h3 className="text-sm font-bold text-stone-900">{getPipelineTitle()}</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">{getPipelineDesc()}</p>
              </div>

              <div className="border border-stone-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center gap-4">
                  <div className="p-3 bg-white rounded-xl border border-orange-200/80 shadow-xs">
                    {currentIcon()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest leading-none block mb-1">
                      Full-Stack Engine
                    </span>
                    <h5 className="text-[11px] text-stone-700 font-bold leading-normal">
                      Stream-based file conversion logic running securely via back-end sandboxed process threads.
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
                Upload target document assets to execute in-tab compilers or full-stack sandboxing streams dynamically.
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
