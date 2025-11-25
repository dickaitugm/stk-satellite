/**
 * Ground Station Store
 * Manages ground stations / facilities
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default ground stations
const DEFAULT_GROUND_STATIONS = [
  {
    id: 'gs-rumpin',
    name: 'Rumpin Ground Station',
    location: {
      lat: -6.3667,
      lon: 106.6833,
      alt: 0.15 // km above sea level
    },
    type: 'tracking',
    color: { r: 1, g: 0.5, b: 0, a: 1 }, // Orange
    isActive: true,
    isVisible: true,
    antenna: {
      minElevation: 5, // degrees
      maxRange: 2500 // km
    }
  },
  {
    id: 'gs-biak',
    name: 'Biak Ground Station',
    location: {
      lat: -1.1833,
      lon: 136.1000,
      alt: 0.01
    },
    type: 'tracking',
    color: { r: 1, g: 0.5, b: 0, a: 1 },
    isActive: true,
    isVisible: true,
    antenna: {
      minElevation: 5,
      maxRange: 2500
    }
  }
];

export const useGroundStationStore = create(
  persist(
    (set, get) => ({
      // State
      groundStations: DEFAULT_GROUND_STATIONS,
      selectedStationId: null,
      
      // Computed
      getSelectedStation: () => {
        const state = get();
        return state.groundStations.find(gs => gs.id === state.selectedStationId);
      },
      
      getVisibleStations: () => {
        return get().groundStations.filter(gs => gs.isVisible);
      },
      
      // Actions
      addGroundStation: (station) => set((state) => ({
        groundStations: [...state.groundStations, {
          ...station,
          id: station.id || `gs-${Date.now()}`,
          isActive: true,
          isVisible: true
        }]
      })),
      
      removeGroundStation: (id) => set((state) => ({
        groundStations: state.groundStations.filter(gs => gs.id !== id),
        selectedStationId: state.selectedStationId === id ? null : state.selectedStationId
      })),
      
      updateGroundStation: (id, updates) => set((state) => ({
        groundStations: state.groundStations.map(gs => 
          gs.id === id ? { ...gs, ...updates } : gs
        )
      })),
      
      selectStation: (id) => set({ selectedStationId: id }),
      
      toggleVisibility: (id) => set((state) => ({
        groundStations: state.groundStations.map(gs => 
          gs.id === id ? { ...gs, isVisible: !gs.isVisible } : gs
        )
      })),
      
      // Reset to defaults
      reset: () => set({
        groundStations: DEFAULT_GROUND_STATIONS,
        selectedStationId: null
      })
    }),
    {
      name: 'ground-station-storage',
      partialize: (state) => ({
        groundStations: state.groundStations,
        selectedStationId: state.selectedStationId
      })
    }
  )
);
