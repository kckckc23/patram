import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { 
  FileUp, FileText, Download, Sparkles, RefreshCw, AlertCircle, 
  Image, FileCode, CheckCircle2, ChevronRight, Sliders, Palette 
} from 'lucide-react';
import { formatBytes } from '../utils/pdf';

type ConvertDirection = 'pdfToImg' | 'imgToPdf' | 'pdfToTxt' | 'htmlToPdf';

export default function ConverterTools() {
  const [direction, setDirection] = useState<ConvertDirection>('pdfToImg');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // SCRIPT INJECTION for PDF.js to render PDF to Images
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
        console.warn('Could not inject PDF.js for PDF-to-Image rendering.');
      }
    };
    loadPdfjs();
  }, []);

  // ==========================================
  // VIEW DIRECTIVE 1: PDF TO JPG/PNG WORKSPACE
  // ==========================================
  const [pdfToImgFile, setPdfToImgFile] = useState<File | null>(null);
  const [renderedImages, setRenderedImages] = useState<string[]>([]); // DataURLs
  
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
      setProgressMsg(`Rendering total sequence: ${count} pages onto canvas layers...`);

      const outputs: string[] = [];
      for (let i = 1; i <= count; i++) {
        setProgressMsg(`Pasting raster cells for page ${i}/${count}...`);
        const page = await pdf.getPage(i);
        // High quality (Scale = 1.5)
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
      setError(err?.message || 'Error occurred while rendering PDF pages to JPG.');
      setIsProcessing(false);
    }
  };

  const downloadImagePage = (dataUrl: string, idx: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${pdfToImgFile?.name ? pdfToImgFile.name.substring(0, pdfToImgFile.name.lastIndexOf('.')) : 'page'}_page_${idx + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        
        // Embed JPG or PNG
        if (file.type === 'image/png' || file.name.endsWith('.png')) {
          imageObj = await pdfDoc.embedPng(arrayBuffer);
        } else {
          imageObj = await pdfDoc.embedJpg(arrayBuffer);
        }

        // Add page matching sizes
        const page = pdfDoc.addPage(
          pageSizeConf === 'letter' ? [612, 792] : [595, 842]
        ); // Letter vs A4 in PostScript Points
        
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        // Scale image to fit inside standard borders
        const scaleFit = Math.min(
          (pageWidth - 60) / imageObj.width,
          (pageHeight - 60) / imageObj.height
        );
        
        const drawWidth = imageObj.width * scaleFit;
        const drawHeight = imageObj.height * scaleFit;
        // Center the graphics
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
      setError(err?.message || 'Error occurred while converting images to PDF.');
      setIsProcessing(false);
    }
  };

  // ==========================================
  // VIEW DIRECTIVE 3: PDF TO TEXT / HTML WORKSPACE
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
        allText += `\n\n--- PAGE ${i} --- \n\n${pageText || '[No searchable text layer on this page]'}`;
      }

      setExtractedTxt(allText.trim());
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
    link.download = `${name}_converted.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // VIEW DIRECTIVE 4: RICH WRITER / HTML TO PDF
  // ==========================================
  const [htmlInput, setHtmlInput] = useState<string>(
    '# PDFly Report Document\n\nGenerated: In-Memory Client Sandbox\n\nThis is a standard custom report drafted securely using the HTML / Text editor inside the offline browser thread. Confidential documents remain exclusively private.'
  );

  const runHtmlToPdf = async () => {
    if (!htmlInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    setProgressMsg('Drafting geometric print canvas...');

    try {
      await new Promise(resolve => setTimeout(resolve, 350));
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Standard letter page

      // Simple structural graphics render
      page.drawRectangle({
        x: 40,
        y: 730,
        width: 532,
        height: 3,
        color: undefined // border-outline only
      });
      
      // Split text lines cleanly
      const lines = htmlInput.split('\n');
      let baselineY = 700;

      lines.forEach((line) => {
        if (baselineY < 50) return; // Prevent overflow beyond page
        
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
          baselineY -= 12; // spacer
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

  return (
    <div id="converter-tools-root" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* Switcher & Core controls - Left Side */}
      <div className="lg:col-span-12">
        <div className="flex border-b border-stone-200 gap-1.5 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setDirection('pdfToImg'); setError(null); setSuccess(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              direction === 'pdfToImg'
                ? 'bg-orange-50 text-orange-700 font-extrabold border border-orange-100/90'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
            }`}
          >
            PDF to JPG/PNG
          </button>
          
          <button
            type="button"
            onClick={() => { setDirection('imgToPdf'); setError(null); setSuccess(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              direction === 'imgToPdf'
                ? 'bg-orange-50 text-orange-700 font-extrabold border border-orange-100/90'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
            }`}
          >
            JPG/PNG to PDF
          </button>

          <button
            type="button"
            onClick={() => { setDirection('pdfToTxt'); setError(null); setSuccess(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              direction === 'pdfToTxt'
                ? 'bg-orange-50 text-orange-700 font-extrabold border border-orange-100/90'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
            }`}
          >
            PDF to TXT Extract
          </button>

          <button
            type="button"
            onClick={() => { setDirection('htmlToPdf'); setError(null); setSuccess(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              direction === 'htmlToPdf'
                ? 'bg-orange-50 text-orange-700 font-extrabold border border-orange-100/90'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
            }`}
          >
            TXT/HTML Output to PDF
          </button>
        </div>
      </div>

      {/* Render selected directional sub-workspace */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        
        {/* VIEW 1: PDF to JPG */}
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
                onClick={runPdfToImg}
                disabled={isProcessing || !pdfToImgFile}
                className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-orange-400" />
                    Render Pages into JPGs
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: JPG TO PDF */}
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
                  className="bg-stone-50 border border-stone-150 rounded-xl px-3 py-2 text-xs text-stone-700"
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
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={runImgToPdf}
                disabled={isProcessing || imgToPdfFiles.length === 0}
                className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Compiling Graphics...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-orange-400" />
                    Compile Images to PDF
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: PDF TO TXT */}
        {direction === 'pdfToTxt' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">PDF to TXT String Extractor</h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Extract native unicode characters directly from searchable text-layered PDFs instantly in the sandbox.
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

              <button
                onClick={runPdfToTxt}
                disabled={isProcessing || !pdfToTxtFile}
                className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Extracting Strings...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-orange-400" />
                    Execute Text Layer Extraction
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: HTML Draft to PDF */}
        {direction === 'htmlToPdf' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Report Composer Workspace</h3>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Draft a custom text file layout or copy lists, then compile it into a standard formatted PDF output.
              </p>
            </div>

            <div className="border border-stone-200 bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-500">Draft Document Body Text</label>
                <textarea
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  rows={6}
                  placeholder="# Enter Heading 1&#10;Type paragraph texts here..."
                  className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-3 text-xs focus:bg-white focus:outline-hidden font-mono"
                />
                <span className="text-[9px] text-stone-400">Lines prefix with # will be rendered as displays. Regular text compiles page bodies.</span>
              </div>

              <button
                onClick={runHtmlToPdf}
                disabled={isProcessing || !htmlInput.trim()}
                className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Compiling Output Layout...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-orange-400" />
                    Save & Download PDF Layout
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 flex gap-3 text-rose-800 text-xs">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Conversion Aborted:</span>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* output state Preview Panel - Right Side */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="font-semibold text-stone-800 text-sm border-b border-stone-200 pb-2">
          Sandboxing Context State
        </div>

        {/* Live Processing progress */}
        {isProcessing && (
          <div className="bg-stone-950 text-stone-200 border border-stone-800 p-4 rounded-xl font-mono text-xs shadow-md">
            <span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider font-mono">Stream Analyzer Log</span>
            <p className="mt-1 flex items-center gap-2 text-stone-300">
              <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
              {progressMsg}
            </p>
          </div>
        )}

        {/* Success / outputs previews */}
        {!isProcessing && success && (
          <div className="bg-gradient-to-br from-orange-50/40 to-stone-50/40 border border-orange-100 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex gap-2.5 items-center text-emerald-800 text-xs font-bold leading-none">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Conversion Complete & Downloaded!
            </div>

            {/* If JPG outputs available, show visual grid list */}
            {direction === 'pdfToImg' && renderedImages.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Rendered JPG pages ({renderedImages.length})</span>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-stone-100/60 rounded-xl border border-stone-200">
                  {renderedImages.map((img, i) => (
                    <div key={i} className="bg-white p-2 border border-stone-200 rounded-lg flex flex-col gap-2 items-center">
                      <img src={img} className="max-h-24 object-contain shadow-xs border border-stone-100 rounded-sm" alt={`Page ${i+1}`} />
                      <button
                        onClick={() => downloadImagePage(img, i)}
                        className="text-[9px] font-bold text-orange-700 hover:underline flex items-center gap-0.5"
                      >
                        <Download className="h-2.5 w-2.5" /> Download Page
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If Text outputs available, show text layer viewer */}
            {direction === 'pdfToTxt' && extractedTxt && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Text layer compiled snippet</span>
                <div className="bg-white p-3 rounded-xl border border-stone-200 max-h-36 overflow-y-auto text-[10px] font-mono text-stone-600 block whitespace-pre-wrap">
                  {extractedTxt.slice(0, 1000)}...
                </div>
                <button
                  onClick={handleDownloadTxt}
                  className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors mt-1"
                >
                  <Download className="h-4 w-4" /> Download Combined .TXT File
                </button>
              </div>
            )}
          </div>
        )}

        {!isProcessing && !success && (
          <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-10 text-center text-stone-400 flex flex-col items-center justify-center min-h-[220px]">
            <Sliders className="h-7 w-7 text-stone-300" />
            <p className="text-xs font-semibold mt-3 text-stone-500">File Converter Sandbox</p>
            <p className="text-[11px] text-stone-400 mt-1 max-w-[200px]">
              Load files page-by-page or compose customized configurations inside the browser sandbox.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
