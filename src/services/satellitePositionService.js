/**
 * Satellite Position Service
 *
 * This service manages satellite position calculations with:
 * - IPC offloading to main process
 * - Position caching
 * - Throttled updates (10-20 Hz)
 * - Smooth interpolation for 60 FPS rendering
 * - Coverage circle caching
 */

// Configuration
const CONFIG = {
    // How often to fetch new positions from main process (ms)
    POSITION_UPDATE_INTERVAL: 100, // 10 Hz

    // Interpolation delta for smooth animation
    INTERPOLATION_DELTA_MS: 100,

    // Coverage circle update threshold (degrees)
    COVERAGE_UPDATE_THRESHOLD: 0.05,

    // Coverage altitude change threshold (km)
    ALTITUDE_UPDATE_THRESHOLD: 1,

    // Orbit path update interval (ms)
    ORBIT_PATH_UPDATE_INTERVAL: 10000, // 10 seconds

    // Number of points for coverage circle (fewer = faster)
    COVERAGE_CIRCLE_POINTS: 72,

    // Number of points for orbit path
    ORBIT_PATH_POINTS: 100,
};

// State
let currentPositions = {}; // {[id]: {lat, lon, alt, velocity}}
let nextPositions = {}; // For interpolation
let lastUpdateTime = 0;
let lastFetchTime = 0;
let interpolationFactor = 0;

// Coverage cache: {[id]: {center, radius, coords, lastAlt, lastLat, lastLon}}
const coverageCache = new Map();

// Orbit path cache: {[id]: {path, lastUpdateTime}}
const orbitPathCache = new Map();

// Subscribers for position updates
const subscribers = new Set();

// Animation state
let animationFrameId = null;
let isRunning = false;

/**
 * Linear interpolation helper
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Interpolate longitude handling wrap-around at ±180
 */
function lerpLongitude(a, b, t) {
    let diff = b - a;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    let result = a + diff * t;
    if (result > 180) result -= 360;
    if (result < -180) result += 360;
    return result;
}

/**
 * Get interpolated position for a satellite at current render time
 * @param {string} id - Satellite ID
 * @returns {Object|null} Interpolated position {lat, lon, alt}
 */
export function getInterpolatedPosition(id) {
    const current = currentPositions[id];
    const next = nextPositions[id];

    if (!current) return null;
    if (!next) return current;

    return {
        lat: lerp(current.lat, next.lat, interpolationFactor),
        lon: lerpLongitude(current.lon, next.lon, interpolationFactor),
        alt: lerp(current.alt, next.alt, interpolationFactor),
        velocity: current.velocity || 0,
    };
}

/**
 * Get all interpolated positions
 * @returns {Object} {[id]: {lat, lon, alt}}
 */
export function getAllInterpolatedPositions() {
    const result = {};
    for (const id of Object.keys(currentPositions)) {
        const pos = getInterpolatedPosition(id);
        if (pos) result[id] = pos;
    }
    return result;
}

/**
 * Get cached coverage circle or generate new one
 * @param {string} id - Satellite ID
 * @param {Object} position - {lat, lon, alt}
 * @returns {Promise<Array|null>} Coverage circle coordinates
 */
export async function getCoverageCircle(id, position) {
    if (!position) return null;

    const cached = coverageCache.get(id);

    // Check if we need to regenerate
    if (cached) {
        const latDiff = Math.abs(position.lat - cached.lastLat);
        const lonDiff = Math.abs(position.lon - cached.lastLon);
        const altDiff = Math.abs(position.alt - cached.lastAlt);

        // Return cached if position hasn't changed significantly
        if (
            latDiff < CONFIG.COVERAGE_UPDATE_THRESHOLD &&
            lonDiff < CONFIG.COVERAGE_UPDATE_THRESHOLD &&
            altDiff < CONFIG.ALTITUDE_UPDATE_THRESHOLD
        ) {
            return cached.coords;
        }
    }

    // Generate new coverage circle via IPC
    try {
        if (!window.electronAPI?.generateCoverageCircle) {
            // Fallback to local calculation if IPC not available
            return null;
        }

        // First calculate radius (using 0° elevation for satellite's own footprint)
        const radiusResult = await window.electronAPI.calculateCoverageRadius(position.alt, 0);
        if (!radiusResult.success) return cached?.coords || null;

        // Then generate circle
        const result = await window.electronAPI.generateCoverageCircle(
            { latitude: position.lat, longitude: position.lon },
            radiusResult.radius,
            CONFIG.COVERAGE_CIRCLE_POINTS
        );

        if (result.success) {
            coverageCache.set(id, {
                coords: result.coords,
                radius: radiusResult.radius,
                lastLat: position.lat,
                lastLon: position.lon,
                lastAlt: position.alt,
            });
            return result.coords;
        }
    } catch (error) {
        console.error("Failed to get coverage circle:", error);
    }

    return cached?.coords || null;
}

/**
 * Get cached orbit path or generate new one
 * @param {string} id - Satellite ID
 * @param {Object} satellite - Satellite object with tle and tleHistory
 * @param {number} currentTime - Current simulation time (ms)
 * @returns {Promise<Array|null>} Orbit path points
 */
export async function getOrbitPath(id, satellite, currentTime) {
    const cached = orbitPathCache.get(id);

    // Select best TLE for current simulation time
    const tle = selectBestTLE(satellite, currentTime);
    
    // Create cache key based on TLE epoch to detect TLE changes
    const tleEpoch = tle?.line1?.substring(18, 32) || '';
    const cachedTleEpoch = cached?.tleEpoch || '';

    // Return cached if still fresh AND using same TLE
    if (cached && 
        currentTime - cached.lastUpdateTime < CONFIG.ORBIT_PATH_UPDATE_INTERVAL &&
        tleEpoch === cachedTleEpoch) {
        return cached.path;
    }

    // Generate new path via IPC
    try {
        if (!window.electronAPI?.generateOrbitPath) {
            return cached?.path || null;
        }

        const result = await window.electronAPI.generateOrbitPath(
            tle,
            currentTime,
            CONFIG.ORBIT_PATH_POINTS
        );

        if (result.success) {
            orbitPathCache.set(id, {
                path: result.path,
                lastUpdateTime: currentTime,
                tleEpoch: tleEpoch, // Store TLE epoch to detect changes
            });
            return result.path;
        }
    } catch (error) {
        console.error("Failed to get orbit path:", error);
    }

    return cached?.path || null;
}

/**
 * Select the best TLE for a given simulation time (for tle-url-history mode)
 * @param {Object} satellite - Satellite with tleHistory
 * @param {number} timestamp - Target simulation time in ms
 * @returns {Object} Best TLE {line1, line2}
 */
function selectBestTLE(satellite, timestamp) {
    // If no TLE history or not using history mode, use current TLE
    if (!satellite.tleHistory || satellite.tleHistory.length === 0 || 
        (satellite.orbitSource !== "tle-url-history" && satellite.orbitSource !== "tle-url")) {
        return satellite.tle;
    }

    // Find best TLE for target time
    let bestTle = satellite.tle;
    let bestDiff = Infinity;

    for (const tle of satellite.tleHistory) {
        if (!tle.epoch) continue;
        const epochMs = new Date(tle.epoch).getTime();
        const diff = timestamp - epochMs;
        const absDiff = Math.abs(diff);

        // Prefer TLEs before or near target time (within 24 hours after is OK)
        if (diff >= 0 || diff > -86400000) {
            if (absDiff < bestDiff) {
                bestDiff = absDiff;
                bestTle = { line1: tle.line1, line2: tle.line2 };
            }
        }
    }

    // If no suitable TLE found, use most recent from history
    if (!bestTle && satellite.tleHistory.length > 0) {
        const mostRecent = satellite.tleHistory[0];
        bestTle = { line1: mostRecent.line1, line2: mostRecent.line2 };
    }

    return bestTle || satellite.tle;
}

/**
 * Fetch new positions from main process
 * @param {Array} satellites - Array of {id, tle, isVisible}
 * @param {number} timestamp - Current simulation time
 */
async function fetchPositions(satellites, timestamp) {
    if (!window.electronAPI?.calculatePositionsInterpolated) {
        return;
    }

    // Filter visible satellites and select best TLE for simulation time
    const visibleSatellites = satellites
        .filter((s) => s.isVisible && s.tle)
        .map((s) => ({
            ...s,
            tle: selectBestTLE(s, timestamp) // Select best TLE based on simulation time
        }));

    if (visibleSatellites.length === 0) {
        currentPositions = {};
        nextPositions = {};
        return;
    }

    try {
        const result = await window.electronAPI.calculatePositionsInterpolated(
            visibleSatellites,
            timestamp,
            CONFIG.INTERPOLATION_DELTA_MS
        );

        if (result.success) {
            currentPositions = result.current;
            nextPositions = result.next;
            lastFetchTime = Date.now();
            interpolationFactor = 0;
        }
    } catch (error) {
        console.error("Failed to fetch positions:", error);
    }
}

/**
 * Subscribe to position updates
 * @param {Function} callback - Called with positions on each update
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
}

/**
 * Notify all subscribers
 */
function notifySubscribers() {
    const positions = getAllInterpolatedPositions();
    for (const callback of subscribers) {
        try {
            callback(positions);
        } catch (error) {
            console.error("Subscriber error:", error);
        }
    }
}

/**
 * Main update loop - called at 60 FPS
 */
function updateLoop(satellites, getSimulationTime) {
    if (!isRunning) return;

    const now = Date.now();
    const simulationTime = getSimulationTime();

    // Update interpolation factor
    const elapsed = now - lastFetchTime;
    interpolationFactor = Math.min(elapsed / CONFIG.INTERPOLATION_DELTA_MS, 1);

    // Fetch new positions if interval elapsed
    if (now - lastUpdateTime >= CONFIG.POSITION_UPDATE_INTERVAL) {
        lastUpdateTime = now;
        fetchPositions(satellites, simulationTime);
    }

    // Notify subscribers with interpolated positions
    notifySubscribers();

    // Continue loop
    animationFrameId = requestAnimationFrame(() => updateLoop(satellites, getSimulationTime));
}

/**
 * Start the position update service
 * @param {Function} getSatellites - Function that returns current satellites array
 * @param {Function} getSimulationTime - Function that returns current simulation time (ms)
 */
export function startPositionService(getSatellites, getSimulationTime) {
    if (isRunning) return;

    isRunning = true;
    lastUpdateTime = 0;
    lastFetchTime = Date.now();

    // Initial fetch
    fetchPositions(getSatellites(), getSimulationTime());

    // Start update loop with satellite getter
    const loop = () => {
        if (!isRunning) return;

        const now = Date.now();
        const simulationTime = getSimulationTime();

        // Update interpolation factor
        const elapsed = now - lastFetchTime;
        interpolationFactor = Math.min(elapsed / CONFIG.INTERPOLATION_DELTA_MS, 1);

        // Fetch new positions if interval elapsed
        if (now - lastUpdateTime >= CONFIG.POSITION_UPDATE_INTERVAL) {
            lastUpdateTime = now;
            fetchPositions(getSatellites(), simulationTime);
        }

        // Notify subscribers
        notifySubscribers();

        // Continue loop
        animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    console.log("✅ Position service started");
}

/**
 * Stop the position update service
 */
export function stopPositionService() {
    isRunning = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    console.log("⏹️ Position service stopped");
}

/**
 * Force refresh all data (after TLE update, etc.)
 * @param {Array} satellites - Satellites array
 * @param {number} timestamp - Current simulation time
 */
export async function forceRefresh(satellites, timestamp) {
    // Clear caches
    coverageCache.clear();
    orbitPathCache.clear();

    // Clear main process cache
    if (window.electronAPI?.clearSatelliteCache) {
        await window.electronAPI.clearSatelliteCache();
    }

    // Fetch fresh positions
    await fetchPositions(satellites, timestamp);

    console.log("🔄 Position service refreshed");
}

/**
 * Clear cache for specific satellite
 * @param {string} id - Satellite ID
 */
export async function clearSatelliteCache(id) {
    coverageCache.delete(id);
    orbitPathCache.delete(id);

    if (window.electronAPI?.clearSatelliteCache) {
        await window.electronAPI.clearSatelliteCache(id);
    }
}

/**
 * Get current service status
 * @returns {Object} Status info
 */
export function getServiceStatus() {
    return {
        isRunning,
        satelliteCount: Object.keys(currentPositions).length,
        coverageCacheSize: coverageCache.size,
        orbitPathCacheSize: orbitPathCache.size,
        lastUpdateTime,
        interpolationFactor,
    };
}

// Export config for external adjustment
export { CONFIG as POSITION_SERVICE_CONFIG };
