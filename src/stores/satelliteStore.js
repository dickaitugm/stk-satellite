/**
 * Satellite Store
 * Manages multiple satellites with TLE data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as satellite from 'satellite.js';
import { useLicenseStore } from './licenseStore';

// Default TLE data
const DEFAULT_SATELLITES = [
  {
    id: 'lapan-a2',
    name: 'LAPAN-A2',
    noradId: '40931',
    tle: {
      line1: '1 40931U 00000    25329.16366898  .00000000  00000-0 -12415-2 0    04',
      line2: '2 40931   5.9967 190.3873 0012662 345.8950  58.4170 14.79004108  3470'
    },
    color: { r: 0, g: 1, b: 1, a: 0.8 }, // Cyan
    isActive: true,
    isVisible: true,
    showCoverage: true,
    objects: [] // Sensor/payload objects
  }
];

export const useSatelliteStore = create(
  persist(
    (set, get) => ({
      // State
      satellites: DEFAULT_SATELLITES,
      selectedSatelliteId: 'lapan-a2',
      positions: {}, // { [id]: { lat, lon, alt, time } }
      
      // Computed - get selected satellite
      getSelectedSatellite: () => {
        const state = get();
        return state.satellites.find(s => s.id === state.selectedSatelliteId);
      },
      
      // Check if can add more satellites (license limit)
      canAddSatellite: () => {
        const licenseStore = useLicenseStore.getState();
        return licenseStore.canAddObject('satellite', get().satellites.length);
      },
      
      // Actions
      addSatellite: (satellite) => {
        // Check license limit before adding
        const licenseStore = useLicenseStore.getState();
        if (!licenseStore.canAddObject('satellite', get().satellites.length)) {
          console.warn('Satellite limit reached. Please upgrade your license.');
          return { success: false, error: 'LIMIT_REACHED', message: `Free tier is limited to ${licenseStore.tierLimits.maxSatellites} satellite(s). Please activate a license to add more.` };
        }
        
        set((state) => ({
          satellites: [...state.satellites, {
            ...satellite,
            id: satellite.id || `sat-${Date.now()}`,
            isActive: true,
            isVisible: true
          }]
        }));
        return { success: true };
      },
      
      removeSatellite: (id) => set((state) => ({
        satellites: state.satellites.filter(s => s.id !== id),
        selectedSatelliteId: state.selectedSatelliteId === id 
          ? state.satellites[0]?.id 
          : state.selectedSatelliteId
      })),
      
      updateSatellite: (id, updates) => set((state) => ({
        satellites: state.satellites.map(s => 
          s.id === id ? { ...s, ...updates } : s
        )
      })),
      
      selectSatellite: (id) => set({ selectedSatelliteId: id }),
      
      toggleVisibility: (id) => set((state) => ({
        satellites: state.satellites.map(s => 
          s.id === id ? { ...s, isVisible: !s.isVisible } : s
        )
      })),
      
      // Update satellite position
      updatePosition: (id, position) => set((state) => ({
        positions: {
          ...state.positions,
          [id]: { ...position, time: new Date() }
        }
      })),
      
      // Parse TLE and get satrec for a satellite
      getSatrec: (id) => {
        const sat = get().satellites.find(s => s.id === id);
        if (!sat?.tle) return null;
        try {
          return satellite.twoline2satrec(sat.tle.line1, sat.tle.line2);
        } catch (error) {
          console.error(`Failed to parse TLE for ${id}:`, error);
          return null;
        }
      },
      
      // Get satrec for a specific time using TLE history (for backdated propagation)
      getSatrecForTime: (id, targetTime) => {
        const sat = get().satellites.find(s => s.id === id);
        if (!sat) return null;
        
        // If no TLE history, use current TLE
        if (!sat.tleHistory || sat.tleHistory.length === 0) {
          if (!sat.tle) return null;
          try {
            return satellite.twoline2satrec(sat.tle.line1, sat.tle.line2);
          } catch (error) {
            console.error(`Failed to parse TLE for ${id}:`, error);
            return null;
          }
        }
        
        // Find best TLE for target time
        const targetMs = new Date(targetTime).getTime();
        let bestTle = sat.tle;
        let bestDiff = Infinity;
        
        for (const tle of sat.tleHistory) {
          if (!tle.epoch) continue;
          const epochMs = new Date(tle.epoch).getTime();
          const diff = targetMs - epochMs;
          const absDiff = Math.abs(diff);
          
          // Prefer TLEs before target time
          if (diff >= 0 || diff > -86400000) {
            if (absDiff < bestDiff) {
              bestDiff = absDiff;
              bestTle = { line1: tle.line1, line2: tle.line2 };
            }
          }
        }
        
        // If no suitable TLE found, use most recent
        if (!bestTle && sat.tleHistory.length > 0) {
          const mostRecent = sat.tleHistory[0];
          bestTle = { line1: mostRecent.line1, line2: mostRecent.line2 };
        }
        
        if (!bestTle) return null;
        
        try {
          return satellite.twoline2satrec(bestTle.line1, bestTle.line2);
        } catch (error) {
          console.error(`Failed to parse TLE for ${id}:`, error);
          return null;
        }
      },
      
      // Get TLE info for a specific time (returns TLE and age info for warnings)
      getTleInfoForTime: (id, targetTime) => {
        const sat = get().satellites.find(s => s.id === id);
        if (!sat) return null;
        
        const targetMs = new Date(targetTime).getTime();
        let bestTle = sat.tle;
        let bestEpoch = null;
        let bestDiff = Infinity;
        
        // Extract epoch from current TLE if no history
        if (!sat.tleHistory || sat.tleHistory.length === 0) {
          if (sat.tle?.line1) {
            try {
              const epochStr = sat.tle.line1.substring(18, 32).trim();
              const year = parseInt(epochStr.substring(0, 2));
              const dayOfYear = parseFloat(epochStr.substring(2));
              const fullYear = year > 56 ? 1900 + year : 2000 + year;
              const date = new Date(Date.UTC(fullYear, 0, 1));
              date.setTime(date.getTime() + (dayOfYear - 1) * 24 * 60 * 60 * 1000);
              bestEpoch = date.toISOString();
            } catch (e) {
              bestEpoch = null;
            }
          }
        } else {
          // Find best TLE from history
          for (const tle of sat.tleHistory) {
            if (!tle.epoch) continue;
            const epochMs = new Date(tle.epoch).getTime();
            const diff = targetMs - epochMs;
            const absDiff = Math.abs(diff);
            
            if (diff >= 0 || diff > -86400000) {
              if (absDiff < bestDiff) {
                bestDiff = absDiff;
                bestTle = { line1: tle.line1, line2: tle.line2 };
                bestEpoch = tle.epoch;
              }
            }
          }
          
          // Fallback to most recent
          if (!bestEpoch && sat.tleHistory.length > 0) {
            bestEpoch = sat.tleHistory[0].epoch;
          }
        }
        
        // Calculate age in days
        const ageMs = bestEpoch ? targetMs - new Date(bestEpoch).getTime() : null;
        const ageDays = ageMs !== null ? Math.abs(ageMs) / (1000 * 60 * 60 * 24) : null;
        
        return {
          tle: bestTle,
          epoch: bestEpoch,
          ageDays: ageDays,
          isOld: ageDays !== null && ageDays > 10, // Warning threshold: 10 days (both past and future)
          isFuture: ageMs !== null && ageMs < 0, // TLE is from future (simulation time is before TLE epoch)
        };
      },
      
      // Calculate position at given time (uses TLE history for backdated propagation)
      calculatePosition: (id, date = new Date()) => {
        // Use getSatrecForTime to automatically select best TLE based on simulation time
        const satrec = get().getSatrecForTime(id, date);
        if (!satrec) return null;
        
        const positionAndVelocity = satellite.propagate(satrec, date);
        if (!positionAndVelocity.position) return null;
        
        const gmst = satellite.gstime(date);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
        
        // Calculate heading/track from velocity vector if available
        let heading = 0;
        if (positionAndVelocity.velocity) {
          const vel = positionAndVelocity.velocity;
          // Convert ECI velocity to local ENU (East-North-Up) frame
          const lat = positionGd.latitude;
          const lon = satellite.degreesLong(positionGd.longitude) * Math.PI / 180;
          
          // Rotate velocity from ECI to ECEF
          const vxEcef = vel.x * Math.cos(gmst) + vel.y * Math.sin(gmst);
          const vyEcef = -vel.x * Math.sin(gmst) + vel.y * Math.cos(gmst);
          const vzEcef = vel.z;
          
          // Rotate from ECEF to local ENU
          const vEast = -vxEcef * Math.sin(lon) + vyEcef * Math.cos(lon);
          const vNorth = -vxEcef * Math.sin(lat) * Math.cos(lon) - vyEcef * Math.sin(lat) * Math.sin(lon) + vzEcef * Math.cos(lat);
          
          // Calculate heading (0 = North, 90 = East)
          heading = Math.atan2(vEast, vNorth) * 180 / Math.PI;
          if (heading < 0) heading += 360;
        }
        
        return {
          lat: satellite.degreesLat(positionGd.latitude),
          lon: satellite.degreesLong(positionGd.longitude),
          alt: positionGd.height,
          heading: heading
        };
      },
      
      // Import TLE from text (supports multiple satellites)
      importTLE: (tleText) => {
        const lines = tleText.trim().split('\n');
        const newSatellites = [];
        
        // Check license limit
        const licenseStore = useLicenseStore.getState();
        const currentCount = get().satellites.length;
        const maxAllowed = licenseStore.tierLimits.maxSatellites;
        const availableSlots = Math.max(0, maxAllowed - currentCount);
        
        for (let i = 0; i < lines.length; i += 3) {
          if (i + 2 >= lines.length) break;
          
          // Check if we've reached the limit
          if (newSatellites.length >= availableSlots && availableSlots !== Infinity) {
            console.warn(`Only imported ${newSatellites.length} satellite(s). Free tier limit reached.`);
            break;
          }
          
          const name = lines[i].trim();
          const line1 = lines[i + 1].trim();
          const line2 = lines[i + 2].trim();
          
          // Extract NORAD ID from line 1
          const noradId = line1.substring(2, 7).trim();
          
          newSatellites.push({
            id: `sat-${noradId}`,
            name,
            noradId,
            tle: { line1, line2 },
            color: { r: Math.random(), g: Math.random(), b: 1, a: 0.8 },
            isActive: true,
            isVisible: true
          });
        }
        
        if (newSatellites.length > 0) {
          set((state) => ({
            satellites: [...state.satellites, ...newSatellites]
          }));
        }
        
        return { 
          imported: newSatellites.length, 
          limitReached: newSatellites.length >= availableSlots && availableSlots !== Infinity
        };
      },
      
      // Reset to defaults
      reset: () => set({
        satellites: DEFAULT_SATELLITES,
        selectedSatelliteId: 'lapan-a2',
        positions: {}
      })
    }),
    {
      name: 'satellite-storage',
      partialize: (state) => ({
        satellites: state.satellites,
        selectedSatelliteId: state.selectedSatelliteId
      })
    }
  )
);
