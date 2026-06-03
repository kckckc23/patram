import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import { 
  FileUp, FileText, Download, Sparkles, RefreshCw, AlertCircle, 
  Trash2, RotateCw, ArrowLeftRight, ChevronLeft, ChevronRight, CheckCircle2, Sliders 
} from 'lucide-react';
import { formatBytes } from '../utils/pdf';

// Page structure for organizing layout
interface OrganizedPage {
  originalIndex: number; // 0-based page index from original document
  rotation: number; // Page rotation offset (0, 90, 180, 270 degrees)
}

export default function OrganizeTools() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<OrganizedPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Script loaded flag for thumbnails
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setSuccess(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
        loadPdfDocument(selectedFile);
      } else {
        setError('Please upload a valid PDF document.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(false);
    
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      loadPdfDocument(selectedFile);
    }
  };

  // Loads dependencies for rendering page pictures
  const loadPdfjsCdn = async () => {
    if (window.pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }
    try {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      document.body.appendChild(script);
      await new Promise((resolve) => {
        script.onload = resolve;
      });
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        setPdfjsLoaded(true);
      }
    } catch {
      console.warn('Pdf.js CDN failed to load; using text-layered metadata previews as graceful fallback.');
    }
  };

  useEffect(() => {
    loadPdfjsCdn();
  }, []);

  // Reads the PDF structure and initializes local slot states
  const loadPdfDocument = async (pdfFile: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const buffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = pdfDoc.getPageCount();
      
      const initializedPages: OrganizedPage[] = [];
      for (let i = 0; i < count; i++) {
        initializedPages.push({ originalIndex: i, rotation: 0 });
      }
      setPages(initializedPages);
      setIsLoading(false);

      // Render actual canvases after the grid mounts
      setTimeout(() => {
        renderCanvasThumbnails(buffer, initializedPages);
      }, 400);

    } catch (err: any) {
      setError(err?.message || 'Failed to inspect PDF page architecture.');
      setIsLoading(false);
    }
  };

  // Paints high-fidelity visual thumbnails on Canvas elements
  const renderCanvasThumbnails = async (pdfBuffer: ArrayBuffer, targetPages: OrganizedPage[]) => {
    if (!window.pdfjsLib) return;
    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;

      for (let i = 0; i < targetPages.length; i++) {
        const pageConf = targetPages[i];
        const page = await pdf.getPage(pageConf.originalIndex + 1);
        const refIdx = pageConf.originalIndex;
        const canvas = canvasRefs.current[refIdx];
        
        if (canvas) {
          const viewport = page.getViewport({ scale: 0.4 });
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;
          }
        }
      }
    } catch (err) {
      console.error('Error drawing canvas thumbnails:', err);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPages([]);
    setError(null);
    setSuccess(false);
  };

  // Page manipulations
  const rotatePage = (slotIndex: number) => {
    const updated = [...pages];
    updated[slotIndex].rotation = (updated[slotIndex].rotation + 90) % 360;
    setPages(updated);
  };

  const deletePage = (slotIndex: number) => {
    if (pages.length <= 1) {
      setError('Cannot exclude all pages. Your PDF output layout must contain at least one page.');
      return;
    }
    const updated = pages.filter((_, idx) => idx !== slotIndex);
    setPages(updated);
  };

  const movePage = (slotIndex: number, direction: 'left' | 'right') => {
    if (direction === 'left' && slotIndex === 0) return;
    if (direction === 'right' && slotIndex === pages.length - 1) return;

    const targetIndex = direction === 'left' ? slotIndex - 1 : slotIndex + 1;
    const updated = [...pages];
    // swap positions cleanly
    const temp = updated[slotIndex];
    updated[slotIndex] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    setPages(updated);
  };

  // Compiles and downloads based on active slot configuration
  const handleCompile = async () => {
    if (!file || pages.length === 0) return;
    setIsProcessing(true);
    setSuccess(false);
    setError(null);
    setLogs('Ingesting current original stream arrays...');

    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const buffer = await file.arrayBuffer();
      setLogs('Parsing and inspecting parent encryption tables...');
      const sourceDoc = await PDFDocument.load(buffer);
      const newDoc = await PDFDocument.create();

      setLogs(`Cloning indices: Copying ${pages.length} configured pages into memory...`);
      // Copy target index sequences
      const originalIndicesToExtract = pages.map(p => p.originalIndex);
      const copiedPages = await newDoc.copyPages(sourceDoc, originalIndicesToExtract);

      setLogs('Injecting geometries and painting rotation offsets...');
      copiedPages.forEach((page, index) => {
        const pageConf = pages[index];
        newDoc.addPage(page);
        if (pageConf.rotation > 0) {
          page.setRotation(degrees(pageConf.rotation));
        }
      });

      setLogs('Compressing dictionary directories & finalizing object streams...');
      const finalBytes = await newDoc.save({ useObjectStreams: true });
      
      setLogs('Writing file buffer downstream to user directory...');
      
      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || 'organized_doc';
      link.download = `${originalName}_rearranged.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLogs('Download injected successfully! Pipeline completed.');
      setSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error executing visual organization.');
      setIsProcessing(false);
    }
  };

  return (
    <div id="organize-tools-root" className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
          Organize & Rotate PDF Pages
        </h2>
        <p className="text-stone-500 text-sm mt-0.5">
          Visual workspace to rearrange pages, apply rotational geometry, or discard select sheets easily.
        </p>
      </div>

      {!file ? (
        <div
          id="organize-drag-container"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[280px] ${
            isDragging 
              ? 'border-orange-500 bg-orange-50/50 scale-[0.99] text-orange-700' 
              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/30 text-stone-500 bg-white'
          }`}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            onChange={handleFileChange} 
            accept=".pdf" 
            className="hidden" 
          />
          <div className="p-4 bg-stone-50 border border-stone-150 rounded-2xl text-stone-700">
            <ArrowLeftRight className="h-7 w-7 text-orange-600" />
          </div>
          <p className="mt-4 font-semibold text-sm text-stone-800">
            Select a PDF document to visualize, or <span className="text-orange-700 underline">browse files</span>
          </p>
          <span className="text-[11px] text-stone-400 mt-2 block max-w-sm">
            Draws full grid thumbnails page-by-page. Discard, copy, rotate, and restructure layout instantly.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Metadata bar */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-orange-100 text-orange-700 rounded-lg flex items-center justify-center font-bold">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-800 truncate max-w-xs">{file.name}</p>
                <p className="text-[10px] text-stone-450 font-mono mt-0.5">
                  Size: {formatBytes(file.size)} • Total Pages: {pages.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={clearFile}
                disabled={isProcessing}
                className="text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-50 px-3 py-2 rounded-lg border border-stone-200 transition-colors"
              >
                Clear File
              </button>
              
              <button
                onClick={handleCompile}
                disabled={isProcessing}
                className="bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                title="Saves and downloads arranged document layout"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Recompiling...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                    Save & Compile PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Core Visual Grid Workspace */}
          {isLoading ? (
            <div className="border border-stone-200 bg-white rounded-2xl p-16 text-center text-stone-500 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
              <RefreshCw className="h-8 w-8 text-orange-600 animate-spin" />
              <p className="text-xs font-bold mt-4 text-stone-800 font-mono tracking-tight">Slicing PDF stream pages...</p>
              <p className="text-[11px] text-stone-450 mt-1">Generating visual slots inside local memory sandbox</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[500px] overflow-y-auto p-1.5 border border-stone-200/60 bg-stone-50/50 rounded-2xl">
              {pages.map((pageConf, idx) => {
                const origIndex = pageConf.originalIndex;
                return (
                  <div
                    key={origIndex}
                    className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col justify-between shadow-xs hover:shadow-xs transition-shadow relative"
                  >
                    {/* page original layout indicator */}
                    <div className="flex items-center justify-between pointer-events-none mb-1.5">
                      <span className="text-[10px] font-black text-stone-400 font-mono">SLOT {idx + 1}</span>
                      <span className="text-[9px] font-bold text-orange-600 font-mono bg-orange-50 px-1.5 py-0.2 rounded border border-orange-100">
                        PG {origIndex + 1}
                      </span>
                    </div>

                    {/* Canvas/Thumbnail Frame */}
                    <div className="aspect-[3/4] bg-stone-50 border border-stone-150 rounded-lg flex items-center justify-center overflow-hidden mb-3 relative">
                      {pdfjsLoaded ? (
                        <canvas
                          ref={(el) => { canvasRefs.current[origIndex] = el; }}
                          style={{ transform: `rotate(${pageConf.rotation}deg)` }}
                          className="w-full max-h-full object-contain transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-center p-3">
                          <FileText className="h-6 w-6 text-stone-300 stroke-[1.5]" />
                          <span className="text-[10px] font-semibold text-stone-400">Page {origIndex + 1}</span>
                        </div>
                      )}

                      {/* Display rotation badge if turned */}
                      {pageConf.rotation > 0 && (
                        <span className="absolute bottom-1 right-1 bg-stone-900/80 backdrop-blur-xs text-white text-[8px] font-mono font-black rounded-sm px-1 py-0.2">
                          {pageConf.rotation}°
                        </span>
                      )}
                    </div>

                    {/* controls overlay row */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => movePage(idx, 'left')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-stone-100 rounded-md text-stone-500 disabled:opacity-20 transition-colors"
                          title="Move Left"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePage(idx, 'right')}
                          disabled={idx === pages.length - 1}
                          className="p-1 hover:bg-stone-100 rounded-md text-stone-500 disabled:opacity-20 transition-colors"
                          title="Move Right"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Rotate */}
                        <button
                          type="button"
                          onClick={() => rotatePage(idx)}
                          className="p-1 text-stone-500 hover:text-stone-850 hover:bg-stone-100 rounded-md transition-colors"
                          title="Rotate 90° Clockwise"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                        
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => deletePage(idx)}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Discard Page"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Compiler engine status feedback logs */}
          {isProcessing && (
            <div className="bg-stone-950 text-stone-200 border border-stone-850 p-4 rounded-xl font-mono text-xs shadow-md">
              <span className="text-[9px] text-orange-500 font-bold uppercase tracking-wider font-mono">
                Pipeline Stack Logger
              </span>
              <p className="mt-1 flex items-center gap-2">
                <RefreshCw className="h-3 w-3 animate-spin text-orange-500" />
                {logs}
              </p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-emerald-800 text-xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Compilation Successful!</span>
                <p className="mt-0.5 text-emerald-750">Your configured index array was compiled into the target file download stack.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 flex gap-3 text-rose-800 text-xs">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Operation Aborted:</span>
                <p className="mt-0.5 leading-relaxed text-rose-750">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
