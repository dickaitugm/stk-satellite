/**
 * App.jsx
 * Main application entry point - Layout orchestrator
 */

import React, { useState } from 'react';

// Layout components
import { TopNavbar, BottomNavbar } from './components/layout';

// Globe components
import { Globe2D } from './components/globe';

// Sidebar components
import { Sidebar } from './components/sidebar';

// Stores
import { useTimeStore, useSatelliteStore } from './stores';

/**
 * Main App Component
 */
export default function App() {
  const [cursorCoords, setCursorCoords] = useState({ lat: 0, lon: 0 });
  
  // Stores
  const isPlaying = useTimeStore(state => state.isPlaying);
  const satellites = useSatelliteStore(state => state.satellites);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* TOP MENU */}
      <TopNavbar />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden flex">
        
        {/* LEFT SIDEBAR */}
        <Sidebar />

        {/* MAP AREA */}
        <div className="flex-1 overflow-hidden relative">
          {/* WorldWind Component */}
          <Globe2D onMouseMove={setCursorCoords} />
        </div>
      </div>

      {/* BOTTOM MENU */}
      <BottomNavbar 
        cursorCoords={cursorCoords}
        activeSatellite={satellites.length > 0}
      />
    </div>
  );
}