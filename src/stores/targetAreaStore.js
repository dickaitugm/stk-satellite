/**
 * Target Area Store
 * Manages target areas / regions of interest
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default target areas for Indonesia
const DEFAULT_TARGET_AREAS = [
  {
    id: 'ta-jakarta',
    name: 'Jakarta Metro',
    type: 'polygon',
    coordinates: [
      { lat: -6.0, lon: 106.6 },
      { lat: -6.0, lon: 107.1 },
      { lat: -6.5, lon: 107.1 },
      { lat: -6.5, lon: 106.6 }
    ],
    color: { r: 0.2, g: 0.8, b: 0.2, a: 0.3 },
    borderColor: { r: 0.2, g: 0.8, b: 0.2, a: 1 },
    isActive: true,
    isVisible: true,
    priority: 1
  },
  {
    id: 'ta-surabaya',
    name: 'Surabaya Area',
    type: 'circle',
    center: { lat: -7.25, lon: 112.75 },
    radius: 50, // km
    color: { r: 0.8, g: 0.2, b: 0.2, a: 0.3 },
    borderColor: { r: 0.8, g: 0.2, b: 0.2, a: 1 },
    isActive: true,
    isVisible: true,
    priority: 2
  }
];

export const useTargetAreaStore = create(
  persist(
    (set, get) => ({
      // State
      targetAreas: DEFAULT_TARGET_AREAS,
      selectedAreaId: null,
      
      // Computed
      getSelectedArea: () => {
        const state = get();
        return state.targetAreas.find(ta => ta.id === state.selectedAreaId);
      },
      
      getVisibleAreas: () => {
        return get().targetAreas.filter(ta => ta.isVisible);
      },
      
      getActiveAreas: () => {
        return get().targetAreas.filter(ta => ta.isActive);
      },
      
      // Actions
      addTargetArea: (area) => set((state) => ({
        targetAreas: [...state.targetAreas, {
          ...area,
          id: area.id || `ta-${Date.now()}`,
          isActive: true,
          isVisible: true,
          priority: area.priority || state.targetAreas.length + 1
        }]
      })),
      
      // Add polygon area
      addPolygonArea: (name, coordinates, color) => set((state) => ({
        targetAreas: [...state.targetAreas, {
          id: `ta-${Date.now()}`,
          name,
          type: 'polygon',
          coordinates,
          color: color || { r: 0.5, g: 0.5, b: 1, a: 0.3 },
          borderColor: { ...color, a: 1 } || { r: 0.5, g: 0.5, b: 1, a: 1 },
          isActive: true,
          isVisible: true,
          priority: state.targetAreas.length + 1
        }]
      })),
      
      // Add circle area
      addCircleArea: (name, center, radius, color) => set((state) => ({
        targetAreas: [...state.targetAreas, {
          id: `ta-${Date.now()}`,
          name,
          type: 'circle',
          center,
          radius, // km
          color: color || { r: 0.5, g: 0.5, b: 1, a: 0.3 },
          borderColor: { ...color, a: 1 } || { r: 0.5, g: 0.5, b: 1, a: 1 },
          isActive: true,
          isVisible: true,
          priority: state.targetAreas.length + 1
        }]
      })),
      
      removeTargetArea: (id) => set((state) => ({
        targetAreas: state.targetAreas.filter(ta => ta.id !== id),
        selectedAreaId: state.selectedAreaId === id ? null : state.selectedAreaId
      })),
      
      updateTargetArea: (id, updates) => set((state) => ({
        targetAreas: state.targetAreas.map(ta => 
          ta.id === id ? { ...ta, ...updates } : ta
        )
      })),
      
      selectArea: (id) => set({ selectedAreaId: id }),
      
      toggleVisibility: (id) => set((state) => ({
        targetAreas: state.targetAreas.map(ta => 
          ta.id === id ? { ...ta, isVisible: !ta.isVisible } : ta
        )
      })),
      
      toggleActive: (id) => set((state) => ({
        targetAreas: state.targetAreas.map(ta => 
          ta.id === id ? { ...ta, isActive: !ta.isActive } : ta
        )
      })),
      
      // Reset to defaults
      reset: () => set({
        targetAreas: DEFAULT_TARGET_AREAS,
        selectedAreaId: null
      }),
      
      // Clear all
      clearAll: () => set({
        targetAreas: [],
        selectedAreaId: null
      })
    }),
    {
      name: 'target-area-storage',
      partialize: (state) => ({
        targetAreas: state.targetAreas,
        selectedAreaId: state.selectedAreaId
      })
    }
  )
);
