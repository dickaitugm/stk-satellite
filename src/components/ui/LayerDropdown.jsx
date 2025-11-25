/**
 * LayerDropdown Component
 * Dropdown selector for base map layers
 */

import React, { useState } from 'react';

const LayerDropdown = ({ selectedLayer, setSelectedLayer, layerOptions }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  
  return (
    <div className="mt-2 border-t border-white/10 pt-1 pointer-events-auto relative">
      <label className="block mb-1 text-gray-400">Base Layer</label>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs text-left flex items-center justify-between hover:border-blue-500 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>{layerOptions.find(l => l.id === selectedLayer)?.icon}</span>
          <span>{layerOptions.find(l => l.id === selectedLayer)?.name}</span>
        </span>
        <span className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg z-50 overflow-hidden">
          {layerOptions.map((layer) => (
            <button
              key={layer.id}
              onClick={() => {
                setSelectedLayer(layer.id);
                setShowDropdown(false);
              }}
              className={`w-full px-2 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors ${selectedLayer === layer.id ? 'bg-blue-600/30 text-blue-300' : 'text-white'}`}
            >
              <span>{layer.icon}</span>
              <span>{layer.name}</span>
              {selectedLayer === layer.id && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LayerDropdown;
