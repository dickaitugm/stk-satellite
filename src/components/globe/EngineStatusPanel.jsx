/**
 * EngineStatusPanel Component
 * Displays WorldWind engine status, canvas info, range control, and layer selector
 */

import React from 'react';
import LayerDropdown from '../ui/LayerDropdown';

const EngineStatusPanel = ({ 
  dimensions, 
  range, 
  setRange, 
  selectedLayer, 
  setSelectedLayer,
  layerOptions,
  isLoading 
}) => {
  return (
    <div className={`absolute top-2 left-2 bg-black/50 backdrop-blur-sm p-2 rounded border border-white/10 text-xs text-white transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
      <div className="font-bold text-blue-400 mb-1">ENGINE STATUS</div>
      <div>Mode: Globe2D</div>
      <div>Layer: {layerOptions.find(l => l.id === selectedLayer)?.name}</div>
      
      <div className="mt-2 border-t border-white/10 pt-1">
        <div>Canvas: {Math.round(dimensions.width)} x {Math.round(dimensions.height)}</div>
      </div>
      
      <div className="mt-2 border-t border-white/10 pt-1 pointer-events-auto">
        <label className="block mb-1 text-gray-400">Eye Range (km)</label>
        <input 
          type="number" 
          min="1000"
          step="100"
          value={range ? range / 1000 : 0}
          onChange={(e) => setRange(Number(e.target.value) * 1000)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:border-blue-500 outline-none"
        />
      </div>
      
      {/* Layer Selector */}
      <LayerDropdown 
        selectedLayer={selectedLayer}
        setSelectedLayer={setSelectedLayer}
        layerOptions={layerOptions}
      />
    </div>
  );
};

export default EngineStatusPanel;
