/**
 * SatelliteInfoPanel Component
 * Displays satellite position, altitude, coverage info
 */

import React from 'react';
import { Satellite } from 'lucide-react';
import { calculateCoverageRadius } from '../../utils/geodesic';

const SatelliteInfoPanel = ({ 
  satelliteName, 
  satellitePosition, 
  noradId = '40931',
  period = '~97.4 min',
  isLoading 
}) => {
  const coverageRadius = calculateCoverageRadius(satellitePosition.alt);
  
  return (
    <div className={`absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-2 rounded border border-white/10 text-xs text-white transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
      <div className="font-bold text-cyan-400 mb-1 flex items-center gap-2">
        <Satellite className="w-4 h-4" />
        {satelliteName}
      </div>
      <div className="space-y-1 font-mono">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Latitude:</span>
          <span className="text-green-400">{satellitePosition.lat.toFixed(4)}°</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Longitude:</span>
          <span className="text-green-400">{satellitePosition.lon.toFixed(4)}°</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Altitude:</span>
          <span className="text-yellow-400">{satellitePosition.alt.toFixed(2)} km</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Coverage:</span>
          <span className="text-green-300">{coverageRadius.toFixed(1)} km</span>
        </div>
      </div>
      <div className="mt-2 pt-1 border-t border-white/10 text-[10px] text-gray-500">
        <div>NORAD ID: {noradId}</div>
        <div>Period: {period}</div>
      </div>
    </div>
  );
};

export default SatelliteInfoPanel;
