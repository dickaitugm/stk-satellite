/**
 * LoadingOverlay Component
 * Full-screen loading indicator during initialization
 */

import React from 'react';
import { Globe } from 'lucide-react';

const LoadingOverlay = ({ isLoading }) => {
  return (
    <div className={`absolute inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center transition-opacity ease-out ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
        <Globe className="w-16 h-16 text-blue-500 animate-spin relative z-10" style={{ animationDuration: '2s' }} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-blue-400 font-mono text-sm tracking-[0.3em] font-bold animate-pulse">SYSTEM INITIALIZATION</span>
        <div className="flex items-center gap-2 text-slate-500 text-[10px] tracking-widest">
          <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
