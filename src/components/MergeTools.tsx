import React, { useState, useRef } from 'react';
import { PdfDocFile } from '../types';
import { formatBytes, getPdfPageCount, mergePDFs, downloadPdf } from '../utils/pdf';
import { 
  FileUp, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FolderSync, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MergeTools() {
  const [files, setFiles] = useState<PdfDocFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file ingestion
  const handleFilesAdded = async (fileList: FileList) => {
    setError(null);
    setSuccessMsg(null);
    
    const newFilesList: PdfDocFile[] = [];
    const validPdfFiles = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (validPdfFiles.length === 0) {
      setError('No PDF files detected. Please drop or select valid .pdf files.');
      return;
    }

    // Add immediate skeletal states for uploaded files
    const initializedFiles = validPdfFiles.map(file => {
      const id = crypto.randomUUID();
      return {
        id,
        file,
        name: file.name,
        size: file.size,
        pageCount: 0,
        loading: true,
      };
    });

    setFiles(prev => [...prev, ...initializedFiles]);

    // Asynchronously resolve page counts in background
    for (const tempFile of initializedFiles) {
      try {
        const pages = await getPdfPageCount(tempFile.file);
        setFiles(prev => prev.map(f => f.id === tempFile.id ? { ...f, pageCount: pages, loading: false } : f));
      } catch (err: any) {
        console.error('Error reading PDF:', err);
        setFiles(prev => prev.map(f => f.id === tempFile.id ? { 
          ...f, 
          loading: false, 
          error: 'Encrypted, corrupted, or incompatible PDF.' 
        } : f));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Reordering & deletion actions
  const moveFile = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === files.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...files];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    setFiles(reordered);
    setSuccessMsg(null);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setSuccessMsg(null);
  };

  const clearAll = () => {
    setFiles([]);
    setError(null);
    setSuccessMsg(null);
    setMergeProgress('');
  };

  // Run full compiler merge
  const handleMergeSubmit = async () => {
    setError(null);
    setSuccessMsg(null);

    const validDocuments = files.filter(f => !f.error && !f.loading);
    if (validDocuments.length < 2) {
      setError('You must fully load at least 2 valid PDFs to merge.');
      return;
    }

    setIsMerging(true);
    setMergeProgress('Opening compiler pipeline...');

    try {
      const filesToProcess = validDocuments.map(f => f.file);
      const mergedBytes = await mergePDFs(filesToProcess, (msg) => {
        setMergeProgress(msg);
      });

      const todayStr = new Date().toISOString().split('T')[0];
      downloadPdf(mergedBytes, `Merged_Document_${todayStr}.pdf`);
      setSuccessMsg('PDF documents merged and downloaded successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to merge documents. Please verify that your PDFs are not encrypted or corrupted.');
    } finally {
      setIsMerging(false);
      setMergeProgress('');
    }
  };

  const hasErrors = files.some(f => f.error);

  return (
    <div id="merge-tools" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Selector & Setup - Left Side */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Merge PDF Documents</h2>
          <p className="text-stone-500 text-sm mt-0.5">
            Combine multiple PDF files together in a customized order.
          </p>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragging 
              ? 'border-orange-500 bg-orange-50/50 scale-[0.99] text-orange-700' 
              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50 text-stone-500 bg-white'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files && handleFilesAdded(e.target.files)} 
            multiple 
            accept=".pdf" 
            className="hidden" 
          />
          <div className="p-4 bg-stone-50 border border-stone-150 rounded-2xl text-stone-700 group-hover:scale-105 transition-transform">
            <FileUp className="h-7 w-7 text-orange-650" />
          </div>
          <p className="mt-4 font-semibold text-sm text-stone-800">
            Drag & drop files here, or <span className="text-orange-700 underline text-sm">browse files</span>
          </p>
          <span className="text-[11px] text-stone-400 mt-2 block">
            Supports multiple document selection (.pdf only)
          </span>
        </div>

        {/* Alert Messages */}
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
            <div className="text-xs font-medium leading-normal">
              {successMsg}
            </div>
          </div>
        )}

        {/* Action Controls bar */}
        {files.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="text-xs font-medium text-stone-600">
              <span className="text-stone-900 font-bold text-sm mr-1">{files.length}</span> {files.length === 1 ? 'file' : 'files'} loaded
            </div>
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={clearAll} 
                disabled={isMerging}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-stone-200 disabled:opacity-50"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleMergeSubmit}
                disabled={isMerging || files.filter(f => !f.error && !f.loading).length < 2}
                className="bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors shrink-0"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <FolderSync className="h-4 w-4" />
                    Combine PDFs
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Live Build log */}
        {isMerging && mergeProgress && (
          <div className="bg-stone-950 text-stone-200 border border-stone-850 p-4 rounded-xl font-mono text-xs shadow-md">
            <div className="flex items-center justify-between border-b border-stone-850 pb-2 mb-2">
              <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">Compiler Sandbox Logs</span>
              <span className="animate-pulse bg-emerald-500 h-2 w-2 rounded-full leading-none"></span>
            </div>
            <div className="text-stone-300 leading-relaxed font-mono font-medium">
              &gt; {mergeProgress}
            </div>
          </div>
        )}
      </div>

      {/* Uploaded File List Manager - Right Side */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="font-semibold text-stone-800 text-sm flex items-center justify-between border-b border-stone-200 pb-2">
          <span>Arrange Order</span>
          <span className="text-[11px] font-normal text-stone-400">First file compiles on top</span>
        </div>

        {files.length === 0 ? (
          <div className="border border-stone-200 bg-stone-50/50 rounded-2xl p-12 text-center text-stone-400 flex flex-col items-center justify-center h-full min-h-[250px]">
            <FileText className="h-8 w-8 text-stone-300 stroke-[1.5]" />
            <p className="text-xs font-semibold mt-3 text-stone-500">Queue is empty</p>
            <p className="text-[11px] text-stone-400/85 mt-1 max-w-[200px]">Add files to define composite output order</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[550px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {files.map((file, idx) => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white border rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all duration-150 ${
                    file.error 
                      ? 'border-rose-200 hover:border-rose-350 bg-rose-50/30' 
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {/* Info Indicator */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center font-mono text-xs font-black text-stone-600 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-800 truncate" title={file.name}>
                        {file.name}
                      </p>
                      
                      {/* Sub-meta details */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-stone-450 font-mono">
                          {formatBytes(file.size)}
                        </span>
                        <span className="text-[10px] text-stone-300">•</span>
                        
                        {file.loading ? (
                          <span className="flex items-center gap-1 text-[10px] text-orange-650 font-mono">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Analyzing...
                          </span>
                        ) : file.error ? (
                          <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 bg-rose-500 rounded-full"></span>
                            Incompatible
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-750 font-extrabold font-mono bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-150/40">
                            {file.pageCount === 1 ? '1 page' : `${file.pageCount} pages`}
                          </span>
                        )}
                      </div>

                      {/* Display explicit error log if loaded document fails */}
                      {file.error && (
                        <p className="text-[10px] text-rose-600 mt-1 font-semibold leading-normal bg-rose-50 border border-rose-100 px-2 py-1 rounded">
                          {file.error}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Ordering buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0 || isMerging}
                      onClick={() => moveFile(idx, 'up')}
                      className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === files.length - 1 || isMerging}
                      onClick={() => moveFile(idx, 'down')}
                      className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isMerging}
                      onClick={() => removeFile(file.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 transition-colors ml-1"
                      title="Remove from queue"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
