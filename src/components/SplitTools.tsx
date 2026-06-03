import React, { useState, useRef, useEffect } from 'react';
import { formatBytes, getPdfPageCount, splitPDF, downloadPdf } from '../utils/pdf';
import { 
  FileUp, 
  Trash2, 
  Scissors, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileText,
  CalendarDays
} from 'lucide-react';

export default function SplitTools() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  
  // Custom range constraints
  const [startPage, setStartPage] = useState<string>('1');
  const [endPage, setEndPage] = useState<string>('1');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processLog, setProcessLog] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File loading handlers
  const handleFileSelected = async (selectedFile: File) => {
    setError(null);
    setSuccessMsg(null);
    setFileError(null);
    setIsLoadingFile(true);
    setFile(null);
    setTotalPages(0);

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Incompatible format. Please select a valid .pdf file.');
      setIsLoadingFile(false);
      return;
    }

    try {
      const pCount = await getPdfPageCount(selectedFile);
      setFile(selectedFile);
      setTotalPages(pCount);
      setStartPage('1');
      setEndPage(String(pCount));
    } catch (err: any) {
      console.error(err);
      setFileError('Error analyzing PDF. The file might be encrypted or corrupted.');
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setTotalPages(0);
    setStartPage('1');
    setEndPage('1');
    setError(null);
    setSuccessMsg(null);
    setFileError(null);
    setProcessLog('');
  };

  const triggerInputClick = () => {
    fileInputRef.current?.click();
  };

  // Immediate live parsing constraints checks
  const parsedStart = parseInt(startPage, 10);
  const parsedEnd = parseInt(endPage, 10);
  
  const isRangeValid = 
    !isNaN(parsedStart) && 
    !isNaN(parsedEnd) && 
    parsedStart >= 1 && 
    parsedStart <= totalPages && 
    parsedEnd >= parsedStart && 
    parsedEnd <= totalPages;

  const countToExtract = isRangeValid ? (parsedEnd - parsedStart + 1) : 0;

  // Process split compiling
  const handleSplitSubmit = async () => {
    setError(null);
    setSuccessMsg(null);

    if (!file) {
      setError('Please select a valid PDF file first.');
      return;
    }

    if (!isRangeValid) {
      setError(`Invalid page range. The page range must be between 1 and ${totalPages}, with the end page matching or exceeding the start page.`);
      return;
    }

    setIsProcessing(true);
    setProcessLog('Initializing partition split...');

    try {
      const outputBytes = await splitPDF(file, parsedStart, parsedEnd, (msg) => {
        setProcessLog(msg);
      });

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      downloadPdf(outputBytes, `${baseName}_pages_${parsedStart}_to_${parsedEnd}.pdf`);
      setSuccessMsg(`Pages ${parsedStart} to ${parsedEnd} were successfully extracted into a new PDF.`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Page split operation failed due to an unexpected rendering exception.');
    } finally {
      setIsProcessing(false);
      setProcessLog('');
    }
  };

  return (
    <div id="split-tools" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* File Ingest panel - Left side */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Split PDF Documents</h2>
          <p className="text-stone-500 text-sm mt-0.5">
            Extract a subset range of pages from a single PDF document.
          </p>
        </div>

        {!file && !isLoadingFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={triggerInputClick}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 min-h-[300px] ${
              isDragging 
                ? 'border-orange-500 bg-orange-50/50 scale-[0.99] text-orange-700' 
                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50 text-stone-500 bg-white'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])} 
              accept=".pdf" 
              className="hidden" 
            />
            <div className="p-4 bg-stone-50 border border-stone-150 rounded-2xl text-stone-700">
              <FileUp className="h-7 w-7 text-orange-655" />
            </div>
            <p className="mt-4 font-semibold text-sm text-stone-800">
              Drag & drop your PDF here, or <span className="text-orange-700 underline text-sm">browse local files</span>
            </p>
            <span className="text-[11px] text-stone-400 mt-2 block">
              Max page limit depends on local browser memory. No files or document sheets ever leave your device.
            </span>
          </div>
        ) : isLoadingFile ? (
          <div className="border border-stone-200 bg-white rounded-2xl p-16 text-center text-stone-500 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
            <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
            <p className="text-xs font-bold mt-4 text-stone-800 font-mono tracking-tight">Analyzing Document Cryptography...</p>
            <p className="text-[11px] text-stone-450 mt-1">Reading headers entirely inside local JS thread</p>
          </div>
        ) : (
          <div className="border border-stone-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-stone-150 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-800 truncate block max-w-[220px]" title={file?.name}>
                    {file?.name}
                  </p>
                  <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                    {file && formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeFile}
                disabled={isProcessing}
                className="p-2 text-stone-450 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Discard file"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Document stats */}
            <div className="grid grid-cols-2 gap-4 bg-stone-50 rounded-xl p-4 border border-stone-150">
              <div>
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Pages</span>
                <span className="text-lg font-black text-stone-800 font-mono mt-0.5 block">{totalPages}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">File Status</span>
                <span className="text-xs font-bold text-emerald-650 mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Unlocked (Editable)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Local Error feedback */}
        {fileError && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs font-medium">
              {fileError}
            </div>
          </div>
        )}
      </div>

      {/* Constraints parameters & Split panel - Right side */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <div className="border border-stone-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-5">
          <h3 className="font-bold text-stone-800 text-sm border-b border-stone-100 pb-3 flex items-center gap-2">
            <Scissors className="h-4.5 w-4.5 text-orange-600" />
            Extract Range Rules
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-page-input" className="block text-xs font-bold text-stone-500 mb-1.5">
                From Page
              </label>
              <input
                id="start-page-input"
                type="number"
                disabled={!file || isProcessing}
                min="1"
                max={totalPages || "1"}
                value={startPage}
                onChange={(e) => {
                  setStartPage(e.target.value);
                  setSuccessMsg(null);
                  setError(null);
                }}
                className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-2.5 font-mono text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-500 focus:outline-hidden disabled:opacity-40 transition-all"
              />
            </div>
            <div>
              <label htmlFor="end-page-input" className="block text-xs font-bold text-stone-500 mb-1.5">
                To Page (Inclusive)
              </label>
              <input
                id="end-page-input"
                type="number"
                disabled={!file || isProcessing}
                min="1"
                max={totalPages || "1"}
                value={endPage}
                onChange={(e) => {
                  setEndPage(e.target.value);
                  setSuccessMsg(null);
                  setError(null);
                }}
                className="w-full bg-stone-50 border border-stone-150 text-stone-800 rounded-xl px-4 py-2.5 font-mono text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-500 focus:outline-hidden disabled:opacity-40 transition-all"
              />
            </div>
          </div>

          {/* Prompt info helper */}
          {file && (
            <div className={`p-4 rounded-xl text-xs font-medium border leading-relaxed ${
              isRangeValid 
                ? 'bg-orange-50/60 border-orange-100/70 text-orange-850' 
                : 'bg-amber-50/70 border-amber-100 text-amber-800'
            }`}>
              {isRangeValid ? (
                <span>
                  🎯 Target extracted size: <strong className="font-extrabold font-mono text-stone-800 text-sm">{countToExtract}</strong> {countToExtract === 1 ? 'page' : 'pages'} (Pages {startPage} through {endPage} inclusive).
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                  Please provide a valid range. Start page must be between 1 & {totalPages}, and End page must be &ge; Start.
                </span>
              )}
            </div>
          )}

          {/* Pipeline Button */}
          <button
            type="button"
            disabled={!file || isProcessing || !isRangeValid}
            onClick={handleSplitSubmit}
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                Extracting Pages...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4" />
                Export Extract
              </>
            )}
          </button>
        </div>

        {/* Global Errors / logs */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs font-medium">
              {error}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs font-medium">
              {successMsg}
            </div>
          </div>
        )}

        {isProcessing && processLog && (
          <div className="bg-stone-950 text-stone-200 border border-stone-800 p-4 rounded-xl font-mono text-xs shadow-md">
            <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-2">
              <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">Extraction Logs</span>
              <span className="animate-pulse bg-emerald-500 h-1.5 w-1.5 rounded-full"></span>
            </div>
            <div className="text-stone-350 leading-relaxed font-mono font-medium">
              &gt; {processLog}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
