import { ipcMain } from "electron";
import {
    calculateSatellitePositions,
    calculatePositionsForInterpolation,
    generateOrbitPath,
    generateOrbitPathsBatch,
    generateGeodesicCircleFast,
    getUnitCircle,
    calculateCoverageRadius,
    clearCache,
} from "./satelliteCalculator.js";

export function registerIpcHandlers() {
    // Fetch TLE from URL (bypasses CORS)
    ipcMain.handle("fetch-tle", async (event, url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const text = await response.text();
            return { success: true, data: text };
        } catch (error) {
            console.error("Failed to fetch TLE:", error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Calculate positions for multiple satellites (batch)
     * Called at ~10-20 Hz from renderer, positions are interpolated between calls
     *
     * @param {Array} satellites - Array of {id, tle: {line1, line2}}
     * @param {number} timestamp - Unix timestamp in ms
     */
    ipcMain.handle("calculate-satellite-positions", async (event, satellites, timestamp) => {
        try {
            const result = calculateSatellitePositions(satellites, timestamp);
            return { success: true, ...result };
        } catch (error) {
            console.error("Failed to calculate positions:", error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Calculate positions with delta for smooth interpolation
     * Returns current and next positions for velocity-based interpolation
     *
     * @param {Array} satellites - Array of {id, tle: {line1, line2}}
     * @param {number} timestamp - Current Unix timestamp in ms
     * @param {number} deltaMs - Time delta for interpolation (default: 100ms)
     */
    ipcMain.handle(
        "calculate-positions-interpolated",
        async (event, satellites, timestamp, deltaMs = 100) => {
            try {
                const result = calculatePositionsForInterpolation(satellites, timestamp, deltaMs);
                return { success: true, ...result };
            } catch (error) {
                console.error("Failed to calculate interpolated positions:", error);
                return { success: false, error: error.message };
            }
        }
    );

    /**
     * Generate orbit path for a single satellite
     * Called on-demand when satellite is added or periodically (~every 10 seconds)
     *
     * @param {Object} tle - {line1, line2}
     * @param {number} startTimestamp - Start time in Unix ms
     * @param {number} numPoints - Number of points to generate
     */
    ipcMain.handle("generate-orbit-path", async (event, tle, startTimestamp, numPoints = 100) => {
        try {
            const path = generateOrbitPath(tle, startTimestamp, null, numPoints);
            return { success: true, path };
        } catch (error) {
            console.error("Failed to generate orbit path:", error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Batch generate orbit paths for multiple satellites
     *
     * @param {Array} satellites - Array of {id, tle: {line1, line2}}
     * @param {number} startTimestamp - Start time in Unix ms
     * @param {number} numPoints - Number of points per orbit
     */
    ipcMain.handle(
        "generate-orbit-paths-batch",
        async (event, satellites, startTimestamp, numPoints = 100) => {
            try {
                const paths = generateOrbitPathsBatch(satellites, startTimestamp, numPoints);
                return { success: true, paths };
            } catch (error) {
                console.error("Failed to generate orbit paths batch:", error);
                return { success: false, error: error.message };
            }
        }
    );

    /**
     * Generate geodesic circle coordinates
     * Uses optimized calculation with pre-computed unit circle
     *
     * @param {Object} center - {latitude, longitude}
     * @param {number} radiusKm - Radius in kilometers
     * @param {number} nPoints - Number of points (default: 72)
     */
    ipcMain.handle("generate-coverage-circle", async (event, center, radiusKm, nPoints = 72) => {
        try {
            const unitCircle = getUnitCircle(nPoints);
            const coords = generateGeodesicCircleFast(center, radiusKm, unitCircle);
            return { success: true, coords };
        } catch (error) {
            console.error("Failed to generate coverage circle:", error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Calculate coverage radius from altitude
     *
     * @param {number} altitudeKm - Satellite altitude in km
     */
    ipcMain.handle("calculate-coverage-radius", async (event, altitudeKm) => {
        try {
            const radius = calculateCoverageRadius(altitudeKm);
            return { success: true, radius };
        } catch (error) {
            console.error("Failed to calculate coverage radius:", error);
            return { success: false, error: error.message };
        }
    });

    /**
     * Clear satellite cache (when TLE is updated)
     *
     * @param {string} id - Optional satellite ID
     */
    ipcMain.handle("clear-satellite-cache", async (event, id = null) => {
        try {
            clearCache(id);
            return { success: true };
        } catch (error) {
            console.error("Failed to clear cache:", error);
            return { success: false, error: error.message };
        }
    });
}
