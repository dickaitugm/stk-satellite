/**
 * BorderSensors Component
 * Displays lat/lon coordinates at canvas edges for debugging/calibration
 */

import React from 'react';

const BorderSensors = ({ borderStats, isLoading }) => {
  const baseClass = `bg-slate-900/90 text-white text-[10px] border border-slate-500/50 z-10 shadow-lg transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`;
  
  return (
    <>
      {/* TOP */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${baseClass} px-2 py-1 rounded-b flex flex-col items-center`}>
        <div className={`w-2 h-2 rounded-full mb-1 ${borderStats.top ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span>{borderStats.top ? `${borderStats.top.lat.toFixed(2)}°, ${borderStats.top.lon.toFixed(2)}°` : 'NO SIGNAL'}</span>
      </div>
      
      {/* BOTTOM */}
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${baseClass} px-2 py-1 rounded-t flex flex-col-reverse items-center`}>
        <div className={`w-2 h-2 rounded-full mt-1 ${borderStats.bottom ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span>{borderStats.bottom ? `${borderStats.bottom.lat.toFixed(2)}°, ${borderStats.bottom.lon.toFixed(2)}°` : 'NO SIGNAL'}</span>
      </div>
      
      {/* LEFT */}
      <div className={`absolute top-1/2 left-0 -translate-y-1/2 ${baseClass} px-1 py-1 rounded-r flex flex-row items-center`}>
        <div className={`w-2 h-2 rounded-full mr-1 ${borderStats.left ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <div className="flex flex-col">
          {borderStats.left ? (
            <>
              <span>{borderStats.left.lat.toFixed(2)}°</span>
              <span>{borderStats.left.lon.toFixed(2)}°</span>
            </>
          ) : <span>NO SIGNAL</span>}
        </div>
      </div>
      
      {/* RIGHT */}
      <div className={`absolute top-1/2 right-0 -translate-y-1/2 ${baseClass} px-1 py-1 rounded-l flex flex-row-reverse items-center`}>
        <div className={`w-2 h-2 rounded-full ml-1 ${borderStats.right ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <div className="flex flex-col text-right">
          {borderStats.right ? (
            <>
              <span>{borderStats.right.lat.toFixed(2)}°</span>
              <span>{borderStats.right.lon.toFixed(2)}°</span>
            </>
          ) : <span>NO SIGNAL</span>}
        </div>
      </div>
    </>
  );
};

export default BorderSensors;
