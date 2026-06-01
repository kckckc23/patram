import React from 'react';
import { ShieldCheck, Layers, HelpCircle } from 'lucide-react';

export default function Header() {
  return (
    <header className="w-full bg-white border-b border-stone-200 py-5 px-6 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 flex items-center justify-center shadow-xs">
            <Layers className="h-6 w-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
              PDFly Tools
              <span className="text-xs font-normal px-2.5 py-0.5 bg-stone-100 text-stone-600 rounded-full border border-stone-200">
                v1.0 (Web Assembly)
              </span>
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              Secure client-side PDF workspace
            </p>
          </div>
        </div>

        {/* Security / Privacy Shield Banner */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-xl text-emerald-800 md:self-center">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold block">100% Private & Secure</span>
            <span className="text-emerald-700/90 font-medium">Your files never leave your computer. All processing runs offline in memory.</span>
          </div>
        </div>
        
      </div>
    </header>
  );
}
