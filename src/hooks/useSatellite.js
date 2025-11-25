/**
 * Custom hook for satellite TLE parsing and propagation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as satellite from 'satellite.js';
import { LAPAN_A2_MEAN_MOTION, ORBIT_INTERVAL_MINUTES } from '../utils/constants';

/**
 * Hook to handle satellite TLE parsing and position propagation
 * 
 * @param {Object} tle - TLE data object with name, line1, line2
 * @returns {Object} { satrec, position, getSatellitePosition, generateOrbitPath }
 */
export const useSatellite = (tle) => {
  const satrec = useRef(null);
  const [position, setPosition] = useState({ lat: 0, lon: 0, alt: 0 });
  const [isReady, setIsReady] = useState(false);

  // Parse TLE on mount
  useEffect(() => {
    if (!tle?.line1 || !tle?.line2) return;
    
    try {
      satrec.current = satellite.twoline2satrec(tle.line1, tle.line2);
      setIsReady(true);
      console.log('✅ TLE parsed successfully for', tle.name);
    } catch (error) {
      console.error('Failed to parse TLE:', error);
      setIsReady(false);
    }
  }, [tle]);

  /**
   * Get satellite position at a given time
   * @param {Date} date - Time to calculate position for
   * @returns {Object|null} { lat, lon, alt } or null if error
   */
  const getSatellitePosition = useCallback((date) => {
    if (!satrec.current) return null;
    
    const positionAndVelocity = satellite.propagate(satrec.current, date);
    if (!positionAndVelocity.position) return null;
    
    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    
    return {
      lat: satellite.degreesLat(positionGd.latitude),
      lon: satellite.degreesLong(positionGd.longitude),
      alt: positionGd.height // in km
    };
  }, []);

  /**
   * Generate orbit path points for 1 complete pass
   * @param {Date} startTime - Start time for orbit calculation (default: now)
   * @returns {Array} Array of position points with time
   */
  const generateOrbitPath = useCallback((startTime = new Date()) => {
    if (!satrec.current) return [];
    
    const points = [];
    
    // Periode orbit = 1440 / mean_motion (minutes)
    const orbitPeriodMinutes = 1440 / LAPAN_A2_MEAN_MOTION;
    
    // Generate points setiap ORBIT_INTERVAL_MINUTES untuk 1 orbit penuh
    const totalPoints = Math.ceil(orbitPeriodMinutes / ORBIT_INTERVAL_MINUTES);
    
    for (let i = 0; i <= totalPoints; i++) {
      const time = new Date(startTime.getTime() + i * ORBIT_INTERVAL_MINUTES * 60 * 1000);
      const pos = getSatellitePosition(time);
      if (pos) {
        points.push({
          ...pos,
          time: time
        });
      }
    }
    
    return points;
  }, [getSatellitePosition]);

  /**
   * Update current position to now
   */
  const updatePosition = useCallback(() => {
    const pos = getSatellitePosition(new Date());
    if (pos) {
      setPosition(pos);
    }
    return pos;
  }, [getSatellitePosition]);

  return {
    satrec: satrec.current,
    position,
    isReady,
    getSatellitePosition,
    generateOrbitPath,
    updatePosition
  };
};
