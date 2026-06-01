import React, { useState, useRef, useEffect } from 'react';
import { formatBytes, getPdfPageCount, deletePagesFromPdf, downloadPdf, parsePageRangeString } from '../utils/pdf';
import { 
  FileUp, 
  Trash2, 
  Settings, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileText,
  BadgeAlert,
  Heading2
} from 'lucide-react';

export default function DeleteTools() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  
  // Custom delete ranges rules input
  const [deletePagesInput, setDeletePagesInput] = useState<string>('2');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processLog, setProcessLog] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse page list lists
  const [removedPagesSet, setRemovedPagesSet] = useState<Set<number>>(new Set());
  const [remainingPagesList, setRemainingPagesList] = useState<number[]>([]);

  // Monitor parsing triggers
  useEffect(() => {
    if (totalPages > 0) {
      const removedSet = parsePageRangeString(deletePagesInput, totalPages);
      setRemovedPagesSet(removedSet);

      const remaining: number[] = [];
      for (let i = 1; i <= totalPages; i++) {
        if (!removedSet.has(i)) {
          remaining.push(i);
        }
      }
      setRemainingPagesList(remaining);
    } else {
      setRemovedPagesSet(new Set());
      setRemainingPagesList([]);
    }
  }, [deletePagesInput, totalPages]);

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
      // Sensible initial deletion page default
      setDeletePagesInput(pCount > 1 ? '2' : '1');
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
    setDeletePagesInput('2');
    setError(null);
    setSuccessMsg(null);
    setFileError(null);
    setProcessLog('');
  };

  const triggerInputClick = () => {
    fileInputRef.current?.click();
  };

  // Process delete page splitting task
  const handleDeleteSubmit = async () => {
    setError(null);
    setSuccessMsg(null);

    if (!file) {
      setError('Please select or upload a valid PDF file first.');
      return;
    }

    if (removedPagesSet.size === 0) {
      setError('Please input valid page ranges or numbers to delete.');
      return;
    }

    if (removedPagesSet.size >= totalPages) {
      setError(`Cannot delete all pages of the document (${totalPages} total). At least 1 page must persist in the new document.`);
      return;
    }

    setIsProcessing(true);
    setProcessLog('Initializing removal blueprint...');

    try {
      const outputBytes = await deletePagesFromPdf(file, deletePagesInput, (msg) => {
        setProcessLog(msg);
      });

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      downloadPdf(outputBytes, `${baseName}_cleaned.pdf`);
      setSuccessMsg(`Successfully deleted ${removedPagesSet.size} page(s) out of ${totalPages}. New PDF ready and download triggered.`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Removal processing failed due to unexpected render stream errors.');
    } finally {
      setIsProcessing(false);
      setProcessLog('');
    }
  };

  return (
    <div id="delete-tools" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* File Ingest Panel - Left side */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Delete PDF Pages</h2>
          <p className="text-stone-500 text-sm mt-0.5">
            Remove unneeded pages or segments before sharing or saving your file.
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
            <span className="text-[11px] text-stone-450 mt-2 block w-[85%]">
              Processing happens strictly offline in the browser's sandbox. Files are never sent elsewhere.
            </span>
          </div>
        ) : isLoadingFile ? (
          <div className="border border-stone-200 bg-white rounded-2xl p-16 text-center text-stone-500 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
            <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
            <p className="text-xs font-bold mt-4 text-stone-800 font-mono tracking-tight">Dissecting Page Tree Architecture...</p>
            <p className="text-[11px] text-stone-450 mt-1">Evaluating index hierarchies locally</p>
          </div>
        ) : (
          <div className="border border-stone-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-stone-150 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
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
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">Status Checklist</span>
                <span className="text-xs font-bold text-teal-650 mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span> Buffer Ready (100% Local)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Local file errors */}
        {fileError && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs font-medium">
              {fileError}
            </div>
          </div>
        )}
      </div>

      {/* Constraints parameters & Deletion list - Right side */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <div className="border border-stone-200 bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-5">
          <h3 className="font-bold text-stone-800 text-sm border-b border-stone-100 pb-3 flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-rose-550" />
            Removal Target Specs
          </h3>

          <div>
            <label htmlFor="delete-pages-input" className="block text-xs font-bold text-stone-500 mb-1.5">
              Pages to Delete
            </label>
            <input
              id="delete-pages-input"
              type="text"
              disabled={!file || isProcessing}
              placeholder="e.g. 2, 4, 7-9"
              value={deletePagesInput}
              onChange={(e) => {
                setDeletePagesInput(e.target.value);
                setSuccessMsg(null);
                setError(null);
              }}
              className="w-full bg-stone-50 border border-stone-150 text-stone-850 placeholder-stone-400 rounded-xl px-4 py-2.5 font-mono text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-orange-500 focus:outline-hidden disabled:opacity-40 transition-all"
            />
            <span className="text-[10px] text-stone-400 mt-1.5 block">
              Syntax support: commas (<code className="bg-stone-50 px-1 py-0.2 rounded font-mono">,</code>) and ranges (<code className="bg-stone-50 px-1 py-0.2 rounded font-mono">-</code>). Example: <code className="text-stone-500 font-mono">1, 3, 5-8</code>
            </span>
          </div>

          {/* Interactive visual breakdown check */}
          {file && (
            <div className="flex flex-col gap-3.5 bg-stone-55 rounded-xl p-4 border border-stone-200 text-xs text-stone-700 bg-stone-50/50">
              <div>
                <span className="font-bold text-stone-600 block mb-1">
                  ❌ Pages to Remove ({removedPagesSet.size}):
                </span>
                <div className="flex flex-wrap gap-1 mt-1 max-h-[70px] overflow-y-auto">
                  {removedPagesSet.size === 0 ? (
                    <span className="text-stone-400 italic text-[11px]">None specified yet</span>
                  ) : (
                    Array.from(removedPagesSet).sort((a: number, b: number) => a - b).map(p => (
                      <span key={p} className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        Page {p}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-stone-200 pt-2.5">
                <span className="font-bold text-stone-600 block mb-1">
                  ✅ Pages to Keep ({remainingPagesList.length}):
                </span>
                <div className="flex flex-wrap gap-1 mt-1 max-h-[100px] overflow-y-auto">
                  {remainingPagesList.length === 0 ? (
                    <span className="text-rose-500 font-bold italic text-[11px] flex items-center gap-1">
                      <BadgeAlert className="h-4 w-4 shrink-0" /> Error: Document is completely empty!
                    </span>
                  ) : (
                    remainingPagesList.map(p => (
                      <span key={p} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                        {p}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Process Trigger Button */}
          <button
            type="button"
            disabled={!file || isProcessing || removedPagesSet.size === 0 || remainingPagesList.length === 0}
            onClick={handleDeleteSubmit}
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-45 text-white py-3.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors mt-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                Processing Pages Deletion...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Process & Download Cleaned PDF
              </>
            )}
          </button>
        </div>

        {/* Global Errors / success log notifications */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs font-medium">
              {error}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs font-medium">
              {successMsg}
            </div>
          </div>
        )}

        {isProcessing && processLog && (
          <div className="bg-stone-950 text-stone-200 border border-stone-850 p-4 rounded-xl font-mono text-xs shadow-md">
            <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-2">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Deconstructive Engine Log</span>
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
