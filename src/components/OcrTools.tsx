import React, { useState, useRef, useEffect } from 'react';
import { FileUp, FileText, Download, Sparkles, RefreshCw, AlertCircle, Copy, Check, Search, Languages } from 'lucide-react';
import { formatBytes } from '../utils/pdf';

// Declare globals for loaded CDNs
declare global {
  interface Window {
    pdfjsLib?: any;
    Tesseract?: any;
  }
}

interface PageTextResult {
  pageNum: number;
  text: string;
}

export default function OcrTools() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('eng'); // eng, spa, fra, deu
  const [isProcessing, setIsProcessing] = useState(false);
  const [libsReady, setLibsReady] = useState({ pdfjs: false, tesseract: false });
  const [loadingLibs, setLoadingLibs] = useState(false);
  
  // Progress states
  const [currentPageNum, setCurrentPageNum] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageProgressPercent, setPageProgressPercent] = useState<number>(0);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  
  // Results
  const [extractedPages, setExtractedPages] = useState<PageTextResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [processLogs]);

  // Load CDN scripts on demand
  const loadCdnScripts = async (): Promise<boolean> => {
    if (libsReady.pdfjs && libsReady.tesseract) return true;
    setLoadingLibs(true);
    addLog('Attaching local compiler script injections...');
    
    try {
      // 1. Load pdf.js
      if (!window.pdfjsLib) {
        addLog('Spinning up pdf.js canvas rendering context...');
        const pdfScript = document.createElement('script');
        pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        document.body.appendChild(pdfScript);
        await new Promise((resolve, reject) => {
          pdfScript.onload = resolve;
          pdfScript.onerror = () => reject(new Error('Failed to load PDF rendering context from CDN.'));
        });
        
        // Load worker
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        }
      }
      
      // 2. Load Tesseract.js
      if (!window.Tesseract) {
        addLog('Launching Tesseract.js neural OCR engine thread...');
        const tesserScript = document.createElement('script');
        tesserScript.src = 'https://unpkg.com/tesseract.js@v4.0.2/dist/tesseract.min.js';
        document.body.appendChild(tesserScript);
        await new Promise((resolve, reject) => {
          tesserScript.onload = resolve;
          tesserScript.onerror = () => reject(new Error('Failed to load OCR compilation thread from CDN.'));
        });
      }

      setLibsReady({ pdfjs: true, tesseract: true });
      setLoadingLibs(false);
      addLog('Dynamic sandboxing engines loaded and compiled successfully!');
      return true;
    } catch (err: any) {
      setLoadingLibs(false);
      addLog(`Library injection failed: ${err.message}`);
      setError(err.message || 'Error injecting external PDF/OCR assets.');
      return false;
    }
  };

  const addLog = (msg: string) => {
    setProcessLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

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
    setExtractedPages([]);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        setFile(selectedFile);
      } else {
        setError('Please select a valid PDF document.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setExtractedPages([]);
    
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
    }
  };

  const runOcr = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setProcessLogs([]);
    setExtractedPages([]);
    
    const loaded = await loadCdnScripts();
    if (!loaded) {
      setIsProcessing(false);
      return;
    }

    try {
      addLog(`Initializing extraction on file: "${file.name}"...`);
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF via PDFJS
      addLog('Unfolding PDF stream structure...');
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const total = pdf.numPages;
      setTotalPages(total);
      addLog(`Detected total structure: ${total} pages.`);

      const resultsList: PageTextResult[] = [];

      // Create OCR worker
      addLog(`Initializing Tesseract language worker for code: "${language}"...`);
      const worker = await window.Tesseract.createWorker({
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setPageProgressPercent(Math.round(m.progress * 100));
          }
        }
      });

      addLog(`Injecting neural weights for language pack "${language}" dynamically...`);
      await worker.loadLanguage(language);
      await worker.initialize(language);

      for (let pNum = 1; pNum <= total; pNum++) {
        setCurrentPageNum(pNum);
        setPageProgressPercent(0);
        addLog(`[Page ${pNum}/${total}] Capturing raster canvas layers...`);
        
        const page = await pdf.getPage(pNum);
        
        // Render at high resolution for precise OCR (Scale = 2.0)
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
          throw new Error('Could not instantiate 2D canvas drawing context.');
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
        addLog(`[Page ${pNum}/${total}] Canvas painted. Running optical OCR model evaluation...`);

        // Convert canvas image to web data url
        const dataUrl = canvas.toDataURL('image/png');
        
        // Perform OCR on output image
        const { data: { text } } = await worker.recognize(dataUrl);
        
        addLog(`[Page ${pNum}/${total}] Evaluation output compiled! Characters extracted: ${text ? text.trim().length : 0}`);
        
        resultsList.push({
          pageNum: pNum,
          text: text && text.trim().length > 0 ? text : `[Page ${pNum} - Scanned canvas yields no text content.]`
        });

        setExtractedPages([...resultsList]);
        
        // Wait briefly so render cycles catch up on layout
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      addLog('Terminating worker threads safely...');
      await worker.terminate();
      addLog('OCR processing concluded. High quality text structure is now downloadable!');
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      addLog(`[CRITICAL ERROR] ${err?.message || 'Error occurred during OCR evaluation.'}`);
      setError(err?.message || 'Error evaluating scanned PDF files.');
      setIsProcessing(false);
    }
  };

  const getCombinedText = () => {
    return extractedPages.map(p => `--- PAGE ${p.pageNum} --- \n\n${p.text}`).join('\n\n');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getCombinedText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const text = getCombinedText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const originalName = file?.name.substring(0, file.name.lastIndexOf('.')) || 'extracted_doc';
    link.download = `${originalName}_ocr_output.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearFile = () => {
    setFile(null);
    setExtractedPages([]);
    setError(null);
    setCurrentPageNum(0);
    setTotalPages(0);
  };

  // Filter based on search query
  const filteredPages = extractedPages.filter(p => 
    p.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="ocr-tools-root" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* File Ingestion & Option Panel - Left Side */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
            Local OCR PDF Analyzer
          </h2>
          <p className="text-stone-500 text-sm mt-0.5">
            Convert non-selectable physical scans into searchable, plain copyable unicode text.
          </p>
        </div>

        {/* Drag block */}
        {!file ? (
          <div
            id="ocr-file-drag-container"
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
              <Sparkles className="h-7 w-7 text-orange-600" />
            </div>
            <p className="mt-4 font-semibold text-sm text-stone-800">
              Upload scanned PDF / Image PDF, or <span className="text-orange-700 underline">browse files</span>
            </p>
            <span className="text-[11px] text-stone-400 mt-2 block max-w-sm">
              Takes text images, evaluates geometries via WebAssembly OCR, and returns clean unicode.
            </span>
          </div>
        ) : (
          <div className="border border-stone-200 bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-150 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-800 truncate block max-w-[200px]" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                    Original: {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={clearFile}
                disabled={isProcessing}
                className="text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-50 px-2 py-1 rounded-lg border border-stone-200 transition-colors"
              >
                Change
              </button>
            </div>

            {/* Language Settings */}
            <div className="flex flex-col gap-2">
              <label htmlFor="language-select" className="text-xs font-bold text-stone-500 flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> Scanned Document Language
              </label>
              <select
                id="language-select"
                value={language}
                disabled={isProcessing}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-2.5 font-mono text-xs focus:bg-white focus:outline-hidden"
              >
                <option value="eng">English Pack (Neural Model v2)</option>
                <option value="spa">Spanish Pack (Español)</option>
                <option value="fra">French Pack (Français)</option>
                <option value="deu">German Pack (Deutsch)</option>
              </select>
            </div>

            {/* Submit */}
            <button
              onClick={runOcr}
              disabled={isProcessing}
              className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-orange-400" />
                  Running Neural Compilation...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  Extract & OCR Document Pages
                </>
              )}
            </button>
          </div>
        )}

        {/* Live Processing Progress Console  */}
        {isProcessing && (
          <div className="border border-stone-200 bg-stone-950 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-850 pb-2">
              <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider font-mono">
                Scanned Core Node Logs
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                Page {currentPageNum} / {totalPages || '?'}
              </span>
            </div>

            <div 
              ref={logContainerRef}
              className="bg-stone-900/60 p-3 rounded-lg text-[10px] font-mono text-stone-300 h-28 overflow-y-auto leading-relaxed"
            >
              {processLogs.map((log, i) => (
                <div key={i} className="mb-1 last:mb-0">&gt; {log}</div>
              ))}
            </div>

            {/* Progress indicators */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
                <span>Page OCR Confidence</span>
                <span>{pageProgressPercent}%</span>
              </div>
              <div className="bg-stone-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-orange-500 h-full transition-all duration-150" 
                  style={{ width: `${pageProgressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 flex gap-3 text-rose-800 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <span className="font-bold">OCR Runtime Engine Blocked:</span>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* output text visualization - Right Side */}
      <div className="lg:col-span-6 flex flex-col gap-4">
        <div className="font-semibold text-stone-800 text-sm border-b border-stone-200 pb-2 flex items-center justify-between">
          <span>Searchable Text Payload</span>
          {extractedPages.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="p-1.5 text-stone-450 hover:text-stone-700 rounded-lg hover:bg-stone-50 border border-stone-200 flex items-center gap-1 text-[10px] font-semibold"
                title="Copy combined text"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-650" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy All'}
              </button>
              
              <button
                onClick={handleDownloadTxt}
                className="p-1.5 text-orange-655 hover:text-orange-705 rounded-lg hover:bg-orange-50/50 border border-orange-100 flex items-center gap-1 text-[10px] font-semibold"
                title="Download text file"
              >
                <Download className="h-3 w-3" />
                Download unicode Txt
              </button>
            </div>
          )}
        </div>

        {extractedPages.length === 0 ? (
          <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-12 text-center text-stone-400 flex flex-col items-center justify-center min-h-[340px]">
            <FileText className="h-8 w-8 text-stone-300 stroke-[1.5]" />
            {loadingLibs ? (
              <>
                <p className="text-xs font-semibold mt-3 text-stone-600">Mounting OCR Model Datasets...</p>
                <p className="text-[11px] text-stone-400 mt-1 max-w-[200px]">Initial boot compiles in ~5s depending on download speeds</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold mt-3 text-stone-500">Output Payload Frame is Empty</p>
                <p className="text-[11px] text-stone-400 mt-1 max-w-[200px]">Perform local scanning to generate text blocks</p>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 h-full min-h-[340px]">
            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                placeholder="Search raw extracted characters..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:bg-white focus:outline-hidden font-mono"
              />
            </div>

            {/* Extracted block viewport */}
            <div className="flex-1 overflow-y-auto max-h-[280px] bg-stone-50 rounded-xl p-4 border border-stone-150 flex flex-col gap-3">
              {filteredPages.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-xs italic">
                  No matching unicode strings located in document.
                </div>
              ) : (
                filteredPages.map((page) => (
                  <div key={page.pageNum} className="border-b border-stone-150 last:border-0 pb-3 last:pb-0">
                    <span className="block text-[9px] font-bold text-orange-500 font-mono tracking-wider uppercase mb-1">
                      PAGE {page.pageNum}
                    </span>
                    <p className="text-xs font-mono text-stone-700 whitespace-pre-wrap leading-relaxed select-text">
                      {page.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
