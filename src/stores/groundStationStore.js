/**
 * Ground Station Store
 * Manages ground stations / facilities
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Default ground stations
const DEFAULT_GROUND_STATIONS = [
    {
        id: "gs-rancabungur",
        name: "Rancabungur Ground Station",
        location: {
            lat: -6.535654,
            lon: 106.7011967,
            alt: 0.17, // km above sea level
        },
        type: "tracking",
        color: { r: 1, g: 0.5, b: 0, a: 1 }, // Orange
        isActive: true,
        isVisible: true,
        showCoverage: true,
        antenna: {
            minElevation: 5, // degrees
            maxRange: 2500, // km
        },
    },
    {
        id: "gs-biak",
        name: "Biak Ground Station",
        location: {
            lat: -1.1833,
            lon: 136.1,
            alt: 0.01,
        },
        type: "tracking",
        color: { r: 1, g: 0.5, b: 0, a: 1 },
        isActive: true,
        isVisible: true,
        showCoverage: true,
        antenna: {
            minElevation: 5,
            maxRange: 2500,
        },
    },
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
                return state.groundStations.find((gs) => gs.id === state.selectedStationId);
            },

            getVisibleStations: () => {
                return get().groundStations.filter((gs) => gs.isVisible);
            },

            getStationById: (id) => {
                return get().groundStations.find((gs) => gs.id === id);
            },

            // Actions
            addGroundStation: (station) => {
                console.log("Adding ground station:", station);
                set((state) => {
                    const newStation = {
                        ...station,
                        id: station.id || `gs-${Date.now()}`,
                        isActive: station.isActive !== undefined ? station.isActive : true,
                        isVisible: station.isVisible !== undefined ? station.isVisible : true,
                    };
                    console.log("New station data:", newStation);
                    return {
                        groundStations: [...state.groundStations, newStation],
                    };
                });
            },

            removeGroundStation: (id) => {
                console.log("Removing ground station:", id);
                set((state) => ({
                    groundStations: state.groundStations.filter((gs) => gs.id !== id),
                    selectedStationId:
                        state.selectedStationId === id ? null : state.selectedStationId,
                }));
            },

            updateGroundStation: (id, updates) => {
                console.log("Updating ground station:", id, updates);
                set((state) => ({
                    groundStations: state.groundStations.map((gs) =>
                        gs.id === id ? { ...gs, ...updates } : gs
                    ),
                }));
            },

            // Upsert - add or update
            upsertGroundStation: (station) => {
                const existing = get().groundStations.find((gs) => gs.id === station.id);
                if (existing) {
                    get().updateGroundStation(station.id, station);
                } else {
                    get().addGroundStation(station);
                }
            },

            selectStation: (id) => set({ selectedStationId: id }),

            toggleVisibility: (id) =>
                set((state) => ({
                    groundStations: state.groundStations.map((gs) =>
                        gs.id === id ? { ...gs, isVisible: !gs.isVisible } : gs
                    ),
                })),

            toggleCoverage: (id) =>
                set((state) => ({
                    groundStations: state.groundStations.map((gs) =>
                        gs.id === id ? { ...gs, showCoverage: !gs.showCoverage } : gs
                    ),
                })),

            // Reset to defaults
            reset: () =>
                set({
                    groundStations: DEFAULT_GROUND_STATIONS,
                    selectedStationId: null,
                }),
        }),
        {
            name: "ground-station-storage",
            version: 3, // Increment version to force refresh of persisted data
            partialize: (state) => ({
                groundStations: state.groundStations,
                selectedStationId: state.selectedStationId,
            }),
            // Migration function for version updates
            migrate: (persistedState, version) => {
                let state = persistedState;

                if (version < 2) {
                    // Migrate v1 to v2: add showCoverage if missing
                    state = {
                        ...state,
                        groundStations: (state.groundStations || DEFAULT_GROUND_STATIONS).map(
                            (gs) => ({
                                ...gs,
                                showCoverage:
                                    gs.showCoverage !== undefined ? gs.showCoverage : true,
                            })
                        ),
                    };
                }

                if (version < 3) {
                    // Migrate v2 to v3: add coverages array if missing
                    state = {
                        ...state,
                        groundStations: (state.groundStations || DEFAULT_GROUND_STATIONS).map(
                            (gs) => ({
                                ...gs,
                                coverages: gs.coverages || [
                                    {
                                        id: `cov-${gs.id}`,
                                        name: "Default Coverage",
                                        type: "manual",
                                        satelliteId: null,
                                        minElevation: gs.antenna?.minElevation || 5,
                                        maxRange: gs.antenna?.maxRange || 2500,
                                        color: gs.color || { r: 1, g: 0.5, b: 0, a: 1 },
                                        isVisible: gs.showCoverage !== false,
                                    },
                                ],
                            })
                        ),
                    };
                }

                return state;
            },
        }
    )
);
