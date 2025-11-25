/**
 * Scenario Store
 * Manages scenario/project settings and metadata
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useScenarioStore = create(
  persist(
    (set, get) => ({
      // Scenario metadata
      name: 'Untitled Scenario',
      description: '',
      author: '',
      createdAt: null,
      modifiedAt: null,
      
      // Scenario settings
      settings: {
        // Time settings
        epochTime: new Date().toISOString(),
        duration: 86400, // seconds (24 hours)
        
        // Display settings
        showGroundTracks: true,
        showCoverage: true,
        showOrbits: true,
        showLabels: true,
        
        // Propagation settings
        propagationStep: 60, // seconds
        orbitPoints: 180, // points for orbit path
        
        // Analysis settings
        accessAnalysisEnabled: false,
        coverageAnalysisEnabled: false
      },
      
      // View state
      view: {
        projection: '2D',
        center: { lat: 0, lon: 117 }, // Indonesia center
        range: 23200000, // meters
        showAtmosphere: false,
        showStars: true,
        showTectonicPlates: false
      },
      
      // Layer visibility
      layers: {
        blueMarble: true,
        bingAerial: false,
        bingRoads: false,
        tectonicPlates: false,
        starField: true
      },
      
      // File info
      filePath: null,
      isDirty: false,
      
      // Actions
      setName: (name) => set({ 
        name, 
        modifiedAt: new Date().toISOString(),
        isDirty: true 
      }),
      
      setDescription: (description) => set({ 
        description, 
        modifiedAt: new Date().toISOString(),
        isDirty: true 
      }),
      
      setAuthor: (author) => set({ author }),
      
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates },
        modifiedAt: new Date().toISOString(),
        isDirty: true
      })),
      
      updateView: (updates) => set((state) => ({
        view: { ...state.view, ...updates }
      })),
      
      setLayer: (layerName, visible) => set((state) => ({
        layers: { ...state.layers, [layerName]: visible }
      })),
      
      toggleLayer: (layerName) => set((state) => ({
        layers: { ...state.layers, [layerName]: !state.layers[layerName] }
      })),
      
      // File operations
      setFilePath: (filePath) => set({ filePath }),
      markSaved: () => set({ isDirty: false }),
      markDirty: () => set({ isDirty: true }),
      
      // Create new scenario
      newScenario: () => {
        const now = new Date().toISOString();
        set({
          name: 'Untitled Scenario',
          description: '',
          author: '',
          createdAt: now,
          modifiedAt: now,
          settings: {
            epochTime: now,
            duration: 86400,
            showGroundTracks: true,
            showCoverage: true,
            showOrbits: true,
            showLabels: true,
            propagationStep: 60,
            orbitPoints: 180,
            accessAnalysisEnabled: false,
            coverageAnalysisEnabled: false
          },
          view: {
            projection: '2D',
            center: { lat: 0, lon: 117 },
            range: 23200000,
            showAtmosphere: false,
            showStars: true,
            showTectonicPlates: false
          },
          layers: {
            blueMarble: true,
            bingAerial: false,
            bingRoads: false,
            tectonicPlates: false,
            starField: true
          },
          filePath: null,
          isDirty: false
        });
      },
      
      // Export scenario data
      exportData: () => {
        const state = get();
        return {
          name: state.name,
          description: state.description,
          author: state.author,
          createdAt: state.createdAt,
          modifiedAt: state.modifiedAt,
          settings: state.settings,
          view: state.view,
          layers: state.layers
        };
      },
      
      // Import scenario data
      importData: (data) => set({
        ...data,
        isDirty: false,
        modifiedAt: new Date().toISOString()
      })
    }),
    {
      name: 'scenario-storage',
      partialize: (state) => ({
        name: state.name,
        description: state.description,
        author: state.author,
        settings: state.settings,
        view: state.view,
        layers: state.layers
      })
    }
  )
);
