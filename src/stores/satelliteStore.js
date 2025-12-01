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
    isVisible: true
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
      
      // Calculate position at given time
      calculatePosition: (id, date = new Date()) => {
        const satrec = get().getSatrec(id);
        if (!satrec) return null;
        
        const positionAndVelocity = satellite.propagate(satrec, date);
        if (!positionAndVelocity.position) return null;
        
        const gmst = satellite.gstime(date);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
        
        return {
          lat: satellite.degreesLat(positionGd.latitude),
          lon: satellite.degreesLong(positionGd.longitude),
          alt: positionGd.height
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
