/**
 * useSatellitePositions Hook
 *
 * Hook for getting real-time satellite positions with IPC offloading.
 * Uses the satellitePositionService for:
 * - Batch position calculations via main process (10 Hz)
 * - Smooth interpolation for 60 FPS rendering
 * - Coverage circle caching
 * - Orbit path caching
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
    startPositionService,
    stopPositionService,
    subscribe,
    getInterpolatedPosition,
    getAllInterpolatedPositions,
    getCoverageCircle,
    getOrbitPath,
    forceRefresh,
    clearSatelliteCache,
    getServiceStatus,
    POSITION_SERVICE_CONFIG,
} from "../services/satellitePositionService";
import { useSatelliteStore, useTimeStore } from "../stores";

/**
 * Hook that provides optimized satellite positions
 *
 * @param {Object} options
 * @param {boolean} options.autoStart - Auto-start position service (default: true)
 * @param {boolean} options.enableInterpolation - Use interpolation (default: true)
 * @returns {Object} { positions, getPosition, getCoverage, getOrbit, isReady, refresh }
 */
export const useSatellitePositions = (options = {}) => {
    const { autoStart = true, enableInterpolation = true } = options;

    const [positions, setPositions] = useState({});
    const [isReady, setIsReady] = useState(false);
    const [usingIPC, setUsingIPC] = useState(false);

    // Store refs for callbacks
    const satellitesRef = useRef([]);

    // Check if IPC is available
    useEffect(() => {
        setUsingIPC(!!window.electronAPI?.calculateSatellitePositions);
    }, []);

    // Subscribe to store for satellite list
    useEffect(() => {
        const unsubscribe = useSatelliteStore.subscribe((state) => {
            satellitesRef.current = state.satellites;
        });

        // Initial value
        satellitesRef.current = useSatelliteStore.getState().satellites;

        return unsubscribe;
    }, []);

    // Start/stop position service
    useEffect(() => {
        if (!autoStart || !usingIPC) return;

        const getSatellites = () => satellitesRef.current;
        const getSimulationTime = () => useTimeStore.getState().currentTime.getTime();

        startPositionService(getSatellites, getSimulationTime);
        setIsReady(true);

        // Subscribe to position updates
        const unsubscribe = subscribe((newPositions) => {
            setPositions(newPositions);
        });

        return () => {
            unsubscribe();
            stopPositionService();
        };
    }, [autoStart, usingIPC]);

    /**
     * Get position for a specific satellite
     */
    const getPosition = useCallback(
        (satelliteId) => {
            if (enableInterpolation && usingIPC) {
                return getInterpolatedPosition(satelliteId);
            }
            return positions[satelliteId] || null;
        },
        [positions, enableInterpolation, usingIPC]
    );

    /**
     * Get all positions
     */
    const getAllPositions = useCallback(() => {
        if (enableInterpolation && usingIPC) {
            return getAllInterpolatedPositions();
        }
        return positions;
    }, [positions, enableInterpolation, usingIPC]);

    /**
     * Get coverage circle for a satellite
     */
    const getCoverage = useCallback(
        async (satelliteId) => {
            const pos = getPosition(satelliteId);
            if (!pos) return null;
            return getCoverageCircle(satelliteId, pos);
        },
        [getPosition]
    );

    /**
     * Get orbit path for a satellite
     */
    const getOrbit = useCallback(async (satelliteId, tle) => {
        const currentTime = useTimeStore.getState().currentTime.getTime();
        return getOrbitPath(satelliteId, tle, currentTime);
    }, []);

    /**
     * Force refresh all cached data
     */
    const refresh = useCallback(async () => {
        const satellites = satellitesRef.current;
        const currentTime = useTimeStore.getState().currentTime.getTime();
        await forceRefresh(satellites, currentTime);
    }, []);

    /**
     * Clear cache for a specific satellite
     */
    const clearCache = useCallback(async (satelliteId) => {
        await clearSatelliteCache(satelliteId);
    }, []);

    /**
     * Get service status
     */
    const getStatus = useCallback(() => {
        return {
            ...getServiceStatus(),
            usingIPC,
        };
    }, [usingIPC]);

    return {
        positions,
        getPosition,
        getAllPositions,
        getCoverage,
        getOrbit,
        isReady,
        usingIPC,
        refresh,
        clearCache,
        getStatus,
        config: POSITION_SERVICE_CONFIG,
    };
};

/**
 * Fallback hook for when IPC is not available
 * Uses direct satellite.js calculations (legacy behavior)
 */
export const useSatellitePositionsFallback = () => {
    const calculatePosition = useSatelliteStore((state) => state.calculatePosition);
    const satellites = useSatelliteStore((state) => state.satellites);
    const currentTime = useTimeStore((state) => state.currentTime);

    const [positions, setPositions] = useState({});

    // Calculate positions at lower frequency
    useEffect(() => {
        const interval = setInterval(() => {
            const newPositions = {};
            satellites
                .filter((s) => s.isVisible)
                .forEach((sat) => {
                    const pos = calculatePosition(sat.id, currentTime);
                    if (pos) {
                        newPositions[sat.id] = pos;
                    }
                });
            setPositions(newPositions);
        }, 100); // 10 Hz

        return () => clearInterval(interval);
    }, [satellites, currentTime, calculatePosition]);

    return {
        positions,
        getPosition: (id) => positions[id] || null,
        getAllPositions: () => positions,
        isReady: true,
        usingIPC: false,
    };
};

export default useSatellitePositions;
