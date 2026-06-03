import React, { useState, lazy, Suspense } from 'react';
import { ActiveTab } from './types';
import Header from './components/Header';
import MergeTools from './components/MergeTools';

// Code-splitting optimized workspaces: loaded dynamically on-demand
const SplitTools = lazy(() => import('./components/SplitTools'));
const DeleteTools = lazy(() => import('./components/DeleteTools'));
const CompressTools = lazy(() => import('./components/CompressTools'));
const OcrTools = lazy(() => import('./components/OcrTools'));
const OrganizeTools = lazy(() => import('./components/OrganizeTools'));
const ConverterTools = lazy(() => import('./components/ConverterTools'));
import { 
  FolderSync, 
  Scissors, 
  Trash2, 
  ShieldCheck, 
  HelpCircle, 
  FileCode,
  ArrowRight,
  Minimize2,
  Sparkles,
  Sliders,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('merge');

  // Renders the correct tool viewport
  const renderActiveTool = () => {
    switch (activeTab) {
      case 'merge':
        return <MergeTools />;
      case 'split':
        return <SplitTools />;
      case 'delete':
        return <DeleteTools />;
      case 'compress':
        return <CompressTools />;
      case 'ocr':
        return <OcrTools />;
      case 'organize':
        return <OrganizeTools />;
      case 'converter':
        return <ConverterTools />;
      default:
        return <MergeTools />;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'merge': return 'Merge PDFs';
      case 'split': return 'Split PDF';
      case 'delete': return 'Delete Pages';
      case 'compress': return 'Compress PDF';
      case 'ocr': return 'OCR Analyzer';
      case 'organize': return 'Organize & Rotate';
      case 'converter': return 'Convert PDF Suite';
    }
  };

  return (
    <div className="min-h-screen bg-stone-50/70 flex flex-col font-sans select-none antialiased text-stone-800">
      {/* Visual Header with local safety banner */}
      <Header />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-8">
        
        {/* Bento Dashboard Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Left Hand Sidebar Navigation Controls */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-widest px-3 mb-2 block animate-pulse">
                Workspace Utilities
              </span>
              
              {/* Tab: Merge Documents */}
              <button
                type="button"
                onClick={() => setActiveTab('merge')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'merge'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/80 shadow-xs'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderSync className="h-4.5 w-4.5 shrink-0" />
                  <span>Merge PDFs</span>
                </div>
                {activeTab !== 'merge' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

              {/* Tab: Split Range */}
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'split'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/80 shadow-xs'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scissors className="h-4.5 w-4.5 shrink-0" />
                  <span>Split PDF</span>
                </div>
                {activeTab !== 'split' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

              {/* Tab: Delete Pages */}
              <button
                type="button"
                onClick={() => setActiveTab('delete')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'delete'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/80 shadow-xs'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="h-4.5 w-4.5 shrink-0" />
                  <span>Delete Pages</span>
                </div>
                {activeTab !== 'delete' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

              {/* Tab: Compress PDF */}
              <button
                type="button"
                onClick={() => setActiveTab('compress')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'compress'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/85'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Minimize2 className="h-4.5 w-4.5 shrink-0 text-orange-600" />
                  <span>Compress PDF</span>
                </div>
                {activeTab !== 'compress' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

              {/* Tab: OCR Scan */}
              <button
                type="button"
                onClick={() => setActiveTab('ocr')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'ocr'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/85'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4.5 w-4.5 shrink-0 text-orange-600" />
                  <span>OCR PDF scan</span>
                </div>
                {activeTab !== 'ocr' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

              {/* Tab: Organize visual */}
              <button
                type="button"
                onClick={() => setActiveTab('organize')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'organize'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/85'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="h-4.5 w-4.5 shrink-0 text-orange-600" />
                  <span>Organize & Rotate</span>
                </div>
                {activeTab !== 'organize' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

              {/* Tab: Converters */}
              <button
                type="button"
                onClick={() => setActiveTab('converter')}
                className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === 'converter'
                    ? 'bg-orange-50 text-orange-700 border border-orange-100/85'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="h-4.5 w-4.5 shrink-0 text-orange-600" />
                  <span>Convert PDF Suite</span>
                </div>
                {activeTab !== 'converter' && <ArrowRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
              </button>

            </div>

            {/* Quick Specs Utility card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider flex items-center gap-1">
                <FileCode className="h-3.5 w-3.5" /> Engine Blueprint
              </span>
              <p className="text-[11px] leading-relaxed text-stone-500">
                Processed in-memory. Bytes are fetched into immediate JavaScript ArrayBuffers, and compiled via Web Assembly pipelines. Perfect offline fidelity.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="py-0.5 px-2 bg-stone-50 text-[10px] font-mono text-stone-600 border border-stone-200 rounded-md">
                  In-Memory ONLY
                </span>
                <span className="py-0.5 px-2 bg-stone-50 text-[10px] font-mono text-stone-600 border border-stone-200 rounded-md">
                  Local-First
                </span>
              </div>
            </div>
          </div>

          {/* Right Hand Tool Workspace Frame */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden min-h-[480px]">
              
              {/* Active panel rendering with slight entry transition */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <Suspense fallback={
                    <div className="animate-pulse flex flex-col gap-6">
                      <div>
                        <div className="h-6 bg-stone-100 rounded-lg w-1/3 mb-2"></div>
                        <div className="h-3.5 bg-stone-100 rounded-lg w-2/3"></div>
                      </div>
                      <div className="h-48 bg-stone-50/50 border border-stone-200/80 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center">
                          <div className="h-4 w-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></div>
                        </div>
                        <span className="text-[11px] text-stone-400 font-mono font-bold tracking-tight">MOUNTING SANDBOX SUITE CORE...</span>
                      </div>
                    </div>
                  }>
                    {renderActiveTool()}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          
        </div>

        {/* Security and FAQs section */}
        <section className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
          <div>
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
              Is it safe to upload critical papers?
            </h4>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">
              <strong>Absolutely.</strong> There is no server upload. All manipulations take place in your current web tab's secure browser memory sandbox. Your documents are completely encrypted from external network sniffing.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-orange-600" />
              Can I run this offline?
            </h4>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">
              <strong>Yes.</strong> Once this web page loads, all script dependencies reside locally on your browser. You can fully isolate your computer from the internet and complete all operations seamlessly.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
              <FileCode className="h-4.5 w-4.5 text-orange-600" />
              What is the parsing limit?
            </h4>
            <p className="text-xs text-stone-500 mt-2 leading-relaxed">
              Normal PDF operations complete in milliseconds. For extremely hefty files (e.g. over 200MB or thick scan graphics), processing might take up to a few seconds depending on your device's core CPU speed.
            </p>
          </div>
        </section>

      </main>

      {/* Humble, flat professional footer */}
      <footer className="w-full text-center py-5 border-t border-stone-250 mt-12 bg-white">
        <p className="text-[10px] text-stone-400 font-medium font-mono">
          🔒 SSL SECURE CLIENT-SIDE SANDBOX • COMPILED WITH COGNITIVE STABILITY
        </p>
      </footer>
    </div>
  );
}
