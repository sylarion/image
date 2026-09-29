import React from 'react';
import Link from 'next/link';
import { Camera, FolderKanban, Plus } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1e2230] bg-[#090a0f]/90 backdrop-blur-md">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight text-white flex items-center gap-1.5 text-base">
                CATALOG <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-medium border border-blue-500/30">AI</span>
              </span>
              <span className="text-[10px] text-[#8e96aa] tracking-widest uppercase">Fashion Production</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link 
              href="/" 
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-[#161923] transition-colors"
            >
              <FolderKanban className="w-4 h-4 text-blue-400" />
              <span>Producciones</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/productions/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Producción</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
