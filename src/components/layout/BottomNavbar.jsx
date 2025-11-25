/**
 * BottomNavbar Component
 * Status bar with cursor coordinates and system status
 */

import React from 'react';
import { Crosshair } from 'lucide-react';

const BottomNavbar = ({ cursorCoords, activeSatellite }) => {
  return (
    <div className="h-8 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-4 text-xs select-none flex-shrink-0 z-50">
      <div className="flex items-center gap-6 text-slate-400">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeSatellite ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>Status: {activeSatellite ? "ACTIVE" : "READY"}</span>
        </div>
        <div className="hidden sm:block">
          <span>Projection: Equirectangular (2:1)</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4 font-mono text-slate-300">
        <div className="flex items-center gap-1 w-32">
          <Crosshair className="w-3 h-3 text-blue-400" />
          <span>
            Lat: {cursorCoords.lat.toFixed(2)}°
          </span>
        </div>
        <div className="flex items-center gap-1 w-32">
          <Crosshair className="w-3 h-3 text-blue-400" />
          <span>
            Lon: {cursorCoords.lon.toFixed(2)}°
          </span>
        </div>
      </div>
    </div>
  );
};

export default BottomNavbar;
