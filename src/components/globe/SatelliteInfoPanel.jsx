/**
 * SatelliteInfoPanel Component
 * Displays satellite position, altitude, coverage info
 */

import React, { useMemo } from 'react';
import { Satellite, Clock, AlertTriangle } from 'lucide-react';
import { calculateCoverageRadius } from '../../utils/geodesic';
import { useTimeStore, useSatelliteStore } from '../../stores';

/**
 * Parse TLE epoch from line1
 * Format: YYDDD.DDDDDDDD where YY=year, DDD.DDDDDDDD=day of year with fraction
 */
const parseTleEpoch = (tleLine1) => {
  if (!tleLine1 || !tleLine1.startsWith('1 ')) return null;
  
  try {
    const epochStr = tleLine1.substring(18, 32).trim();
    const epochYear = parseInt(epochStr.substring(0, 2));
    const epochDayFull = parseFloat(epochStr.substring(2));
    const epochDayInt = Math.floor(epochDayFull);
    const epochDayFrac = epochDayFull - epochDayInt;
    
    const totalSecondsFloat = epochDayFrac * 86400;
    const hours = Math.floor(totalSecondsFloat / 3600);
    const minutes = Math.floor((totalSecondsFloat % 3600) / 60);
    const seconds = Math.floor(totalSecondsFloat % 60);
    
    const fullYear = epochYear > 56 ? 1900 + epochYear : 2000 + epochYear;
    const epochDate = new Date(Date.UTC(fullYear, 0, epochDayInt, hours, minutes, seconds));
    
    return epochDate;
  } catch (e) {
    console.error('Error parsing TLE epoch:', e);
    return null;
  }
};

const SatelliteInfoPanel = ({ 
  satelliteName, 
  satellitePosition, 
  noradId = '40931',
  period = '~97.4 min',
  satellite = null,
  isLoading 
}) => {
  // Get time store for simulation mode awareness
  const mode = useTimeStore((state) => state.mode);
  const currentTime = useTimeStore((state) => state.currentTime);
  const getTleInfoForTime = useSatelliteStore((state) => state.getTleInfoForTime);

  // Calculate coverage at 0° elevation (horizon) for max theoretical coverage
  const coverageRadius = calculateCoverageRadius(satellitePosition.alt, 0);
  
  // Get TLE info based on mode - use simulation time if in simulation mode
  const tleInfo = useMemo(() => {
    if (!satellite?.id) return null;
    
    // In simulation mode, get TLE info for current simulation time
    // This shows which TLE is being used for backdated propagation
    const targetTime = mode === 'simulation' ? currentTime : new Date();
    return getTleInfoForTime(satellite.id, targetTime);
  }, [satellite?.id, mode, currentTime, getTleInfoForTime]);

  // Parse TLE epoch from the active TLE
  const tleEpoch = useMemo(() => {
    if (tleInfo?.tle?.line1) {
      return parseTleEpoch(tleInfo.tle.line1);
    }
    // Fallback to satellite's current TLE
    if (satellite?.tle?.line1) {
      return parseTleEpoch(satellite.tle.line1);
    }
    return null;
  }, [tleInfo?.tle?.line1, satellite?.tle?.line1]);
  
  // Format epoch for display - age is relative to simulation time in sim mode
  const epochDisplay = useMemo(() => {
    if (!tleEpoch) return null;
    
    // In simulation mode, calculate age relative to simulation time
    const referenceTime = mode === 'simulation' ? currentTime : new Date();
    const ageMs = referenceTime.getTime() - tleEpoch.getTime();
    const ageDays = Math.floor(Math.abs(ageMs) / (1000 * 60 * 60 * 24));
    const isFuture = ageMs < 0;
    
    return {
      date: tleEpoch.toLocaleDateString(),
      time: tleEpoch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ageDays: ageDays,
      isFuture: isFuture,
      isOld: ageDays > 10
    };
  }, [tleEpoch, mode, currentTime]);
  
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
      
      {/* TLE Epoch Info */}
      {epochDisplay && (
        <div className="mt-2 pt-1 border-t border-white/10">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
            <Clock className="w-3 h-3" />
            {mode === 'simulation' ? 'Active TLE' : 'TLE Epoch'}
            {epochDisplay.isOld && (
              <AlertTriangle 
                className="w-3 h-3 text-amber-400 ml-1" 
                title={epochDisplay.isFuture 
                  ? "TLE is more than 10 days ahead of simulation time" 
                  : "TLE is more than 10 days old"
                } 
              />
            )}
          </div>
          <div className="text-[10px] space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Date:</span>
              <span className="text-orange-300">{epochDisplay.date}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Time:</span>
              <span className="text-orange-300">{epochDisplay.time} UTC</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Age:</span>
              <span className={`${epochDisplay.ageDays > 14 ? 'text-red-400' : epochDisplay.ageDays > 7 ? 'text-yellow-400' : 'text-green-400'}`}>
                {epochDisplay.isFuture 
                  ? `${epochDisplay.ageDays} day${epochDisplay.ageDays !== 1 ? 's' : ''} ahead`
                  : `${epochDisplay.ageDays} day${epochDisplay.ageDays !== 1 ? 's' : ''} old`
                }
              </span>
            </div>
            {mode === 'simulation' && satellite?.tleHistory?.length > 1 && (
              <div className="text-[9px] text-cyan-400/70 mt-1">
                📡 Auto-selected from {satellite.tleHistory.length} TLEs
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SatelliteInfoPanel;
