/**
 * useSatellitePositions Hook
 *
 * Hook for getting real-time satellite positions with IPC offloading.
 * Uses the satellitePositionService for:
 * - Batch position calculations via main process (10 Hz)
 * - Smooth interpolation for 60 FPS rendering
 * - Coverage circle caching
 * - Orbit path caching
 *
 * PERFORMANCE OPTIMIZED:
 * - Uses refs for high-frequency position data (no re-renders)
 * - State updates throttled to 10 Hz for UI components
 * - Direct ref access available via getPositionRef() for animation loops
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

// Throttle interval for React state updates
const STATE_UPDATE_INTERVAL = 100; // 10 Hz

/**
 * Hook that provides optimized satellite positions
 *
 * @param {Object} options
 * @param {boolean} options.autoStart - Auto-start position service (default: true)
 * @param {boolean} options.enableInterpolation - Use interpolation (default: true)
 * @param {boolean} options.throttleStateUpdates - Throttle React state updates (default: true)
 * @returns {Object} { positions, getPosition, getCoverage, getOrbit, isReady, refresh }
 */
export const useSatellitePositions = (options = {}) => {
  const { autoStart = true, enableInterpolation = true, throttleStateUpdates = true } = options;

  // React state for UI components (updated at 10 Hz)
  const [positions, setPositions] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [usingIPC, setUsingIPC] = useState(false);

  // Refs for high-frequency access (updated every frame, no re-renders)
  const positionsRef = useRef({});
  const lastStateUpdateRef = useRef(0);
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
    const getSimulationTime = () => useTimeStore.getState().getInternalTime();

    startPositionService(getSatellites, getSimulationTime);
    setIsReady(true);

    // Subscribe to position updates
    const unsubscribe = subscribe((newPositions) => {
      // Always update ref (no re-render)
      positionsRef.current = newPositions;

      // Throttle React state updates
      if (throttleStateUpdates) {
        const now = Date.now();
        if (now - lastStateUpdateRef.current >= STATE_UPDATE_INTERVAL) {
          lastStateUpdateRef.current = now;
          setPositions(newPositions);
        }
      } else {
        setPositions(newPositions);
      }
    });

    return () => {
      unsubscribe();
      stopPositionService();
    };
  }, [autoStart, usingIPC, throttleStateUpdates]);

  /**
   * Get position for a specific satellite (uses ref for latest data)
   */
  const getPosition = useCallback(
    (satelliteId) => {
      if (enableInterpolation && usingIPC) {
        return getInterpolatedPosition(satelliteId);
      }
      return positionsRef.current[satelliteId] || null;
    },
    [enableInterpolation, usingIPC]
  );

  /**
   * Get position ref directly (for animation loops - no re-render)
   */
  const getPositionRef = useCallback(() => {
    return positionsRef.current;
  }, []);

  /**
   * Get all positions (uses ref for latest data)
   */
  const getAllPositions = useCallback(() => {
    if (enableInterpolation && usingIPC) {
      return getAllInterpolatedPositions();
    }
    return positionsRef.current;
  }, [enableInterpolation, usingIPC]);

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
  const getOrbit = useCallback(async (satelliteId, satellite) => {
    const currentTime = useTimeStore.getState().currentTime.getTime();
    // Pass full satellite object for TLE history selection
    return getOrbitPath(satelliteId, satellite, currentTime);
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
    positionsRef, // Direct ref access for animation loops
    getPosition,
    getPositionRef,
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
