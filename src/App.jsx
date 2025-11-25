/**
 * App.jsx
 * Main application entry point - Layout orchestrator
 */

import React, { useState } from 'react';
import { Monitor, Map as MapIcon, Info } from 'lucide-react';

// Layout components
import { TopNavbar, BottomNavbar } from './components/layout';

// Globe components
import { Globe2D } from './components/globe';

/**
 * Main App Component
 */
export default function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [cursorCoords, setCursorCoords] = useState({ lat: 0, lon: 0 });

  const toggleSimulation = () => setIsSimulating(!isSimulating);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* TOP MENU */}
      <TopNavbar 
        isSimulating={isSimulating} 
        toggleSimulation={toggleSimulation}
      />

      {/* MAIN CONTENT / MAP AREA */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* Toolbar Floating */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
          <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-white shadow-lg" title="Select">
            <Monitor className="w-5 h-5" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-white shadow-lg" title="Layers">
            <MapIcon className="w-5 h-5" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-white shadow-lg" title="Info">
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* WorldWind Component */}
        <Globe2D 
          isSimulating={isSimulating}
          onMouseMove={setCursorCoords}
        />
      </div>

      {/* BOTTOM MENU */}
      <BottomNavbar 
        cursorCoords={cursorCoords}
        activeSatellite={isSimulating}
      />
    </div>
  );
}