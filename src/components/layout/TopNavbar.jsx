/**
 * TopNavbar Component
 * Navigation bar with simulation controls and time display
 */

import React from 'react';
import { 
  Play, Pause, FastForward, Rewind, 
  Settings, Globe 
} from 'lucide-react';

const TopNavbar = ({ isSimulating, toggleSimulation, simSpeed, setSimSpeed }) => {
  return (
    <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 select-none flex-shrink-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-wider">
          <Globe className="w-6 h-6" />
          <span>ORBIT<span className="text-white">SIM</span> v2.0 (WW)</span>
        </div>
        <div className="h-6 w-px bg-slate-700 mx-2" />
        <div className="hidden md:flex gap-4 text-sm text-slate-300 font-medium">
          <button className="hover:text-white transition-colors">File</button>
          <button className="hover:text-white transition-colors">Edit</button>
          <button className="hover:text-white transition-colors">View</button>
          <button className="hover:text-white transition-colors">Analysis</button>
        </div>
      </div>

      <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
        <button className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white">
          <Rewind className="w-4 h-4" />
        </button>
        <button 
          onClick={toggleSimulation}
          className={`p-1.5 mx-1 rounded text-white ${isSimulating ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white">
          <FastForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-right hidden sm:block">
          <div className="text-slate-400">UTC Time</div>
          <div className="font-mono text-emerald-400">{new Date().toISOString().split('T')[1].split('.')[0]}</div>
        </div>
        <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopNavbar;
