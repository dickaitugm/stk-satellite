/**
 * Access Pass Cache Service
 * 
 * Precomputes and caches satellite passes for ground stations
 * to avoid blocking the main thread during heavy pass calculations.
 * 
 * Features:
 * - Automatic precomputation when satellite/ground station is added
 * - Background refresh for simulation time changes
 * - LRU cache with configurable size
 * - Event-driven invalidation
 */

// Configuration
const CONFIG = {
  // Default time range for precomputation (24 hours)
  DEFAULT_TIME_RANGE_MS: 24 * 60 * 60 * 1000,
  
  // Extended time range for longer simulations (7 days)
  EXTENDED_TIME_RANGE_MS: 7 * 24 * 60 * 60 * 1000,
  
  // Cache size (satellite-groundStation pairs)
  MAX_CACHE_ENTRIES: 500,
  
  // Refresh threshold (precompute new passes when within this time of cache end)
  REFRESH_THRESHOLD_MS: 2 * 60 * 60 * 1000, // 2 hours
  
  // Debounce time for batch precomputation
  DEBOUNCE_MS: 500,
  
  // Min elevation for passes (degrees)
  DEFAULT_MIN_ELEVATION: 5,
};

// Cache storage: Map<cacheKey, PassCacheEntry>
const passCache = new Map();

// Pending precomputation requests
const pendingRequests = new Map();

// Debounce timer
let debounceTimer = null;
let pendingPrecompute = [];

/**
 * Generate cache key for satellite-groundStation pair
 */
function getCacheKey(satelliteId, groundStationId) {
  return `${satelliteId}:${groundStationId}`;
}

/**
 * Cache entry structure
 */
class PassCacheEntry {
  constructor(satelliteId, groundStationId, passes, timeRange) {
    this.satelliteId = satelliteId;
    this.groundStationId = groundStationId;
    this.passes = passes;
    this.startTime = timeRange.start;
    this.endTime = timeRange.end;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
  }

  /**
   * Check if cache covers the given time range
   */
  coversTimeRange(start, end) {
    return this.startTime <= start && this.endTime >= end;
  }

  /**
   * Check if cache needs refresh
   */
  needsRefresh(currentTime) {
    const timeToEnd = this.endTime - currentTime;
    return timeToEnd < CONFIG.REFRESH_THRESHOLD_MS;
  }

  /**
   * Get passes within a time range
   */
  getPassesInRange(start, end) {
    return this.passes.filter(pass => {
      const aosTime = pass.aos?.time || 0;
      const losTime = pass.los?.time || 0;
      return aosTime >= start && losTime <= end;
    });
  }
}

/**
 * Get cached passes for satellite-groundStation pair
 * @param {string} satelliteId 
 * @param {string} groundStationId 
 * @param {number} startTime - Start time in ms
 * @param {number} endTime - End time in ms
 * @returns {Array|null} Cached passes or null if not found
 */
export function getCachedPasses(satelliteId, groundStationId, startTime, endTime) {
  const key = getCacheKey(satelliteId, groundStationId);
  const entry = passCache.get(key);
  
  if (!entry) return null;
  
  entry.lastAccessed = Date.now();
  
  if (entry.coversTimeRange(startTime, endTime)) {
    return entry.getPassesInRange(startTime, endTime);
  }
  
  return null;
}

/**
 * Store passes in cache
 */
export function cachePasses(satelliteId, groundStationId, passes, timeRange) {
  const key = getCacheKey(satelliteId, groundStationId);
  
  // Evict old entries if cache is full
  if (passCache.size >= CONFIG.MAX_CACHE_ENTRIES) {
    evictOldestEntry();
  }
  
  const entry = new PassCacheEntry(satelliteId, groundStationId, passes, timeRange);
  passCache.set(key, entry);
  
  return entry;
}

/**
 * Evict least recently accessed entry
 */
function evictOldestEntry() {
  let oldestKey = null;
  let oldestTime = Infinity;
  
  for (const [key, entry] of passCache) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    passCache.delete(oldestKey);
  }
}

/**
 * Invalidate cache for a satellite
 */
export function invalidateSatelliteCache(satelliteId) {
  for (const key of passCache.keys()) {
    if (key.startsWith(satelliteId + ':')) {
      passCache.delete(key);
    }
  }
}

/**
 * Invalidate cache for a ground station
 */
export function invalidateGroundStationCache(groundStationId) {
  for (const key of passCache.keys()) {
    if (key.endsWith(':' + groundStationId)) {
      passCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export function clearPassCache() {
  passCache.clear();
}

/**
 * Request pass precomputation (debounced)
 * @param {Object} satellite - Satellite object with TLE
 * @param {Object} groundStation - Ground station object with location
 * @param {number} startTime - Start time in ms
 * @param {number} endTime - End time in ms
 * @param {number} minElevation - Minimum elevation in degrees
 */
export function requestPrecompute(satellite, groundStation, startTime, endTime, minElevation = CONFIG.DEFAULT_MIN_ELEVATION) {
  pendingPrecompute.push({
    satellite,
    groundStation,
    startTime,
    endTime,
    minElevation,
  });
  
  // Debounce to batch multiple requests
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    processPendingPrecompute();
  }, CONFIG.DEBOUNCE_MS);
}

/**
 * Process pending precomputation requests
 */
async function processPendingPrecompute() {
  const requests = [...pendingPrecompute];
  pendingPrecompute = [];
  debounceTimer = null;
  
  if (requests.length === 0) return;
  
  console.log(`📊 Precomputing passes for ${requests.length} satellite-groundStation pairs...`);
  
  for (const req of requests) {
    const { satellite, groundStation, startTime, endTime, minElevation } = req;
    const key = getCacheKey(satellite.id, groundStation.id);
    
    // Skip if already cached and fresh
    const existing = passCache.get(key);
    if (existing && existing.coversTimeRange(startTime, endTime)) {
      continue;
    }
    
    // Skip if already computing
    if (pendingRequests.has(key)) {
      continue;
    }
    
    // Mark as pending
    pendingRequests.set(key, true);
    
    try {
      // Call IPC to compute passes (uses worker thread)
      if (window.electronAPI?.calculateSatellitePasses) {
        const result = await window.electronAPI.calculateSatellitePasses(
          satellite.tle,
          { lat: groundStation.location.lat, lon: groundStation.location.lon, alt: groundStation.location.alt || 0 },
          startTime,
          endTime,
          minElevation
        );
        
        if (result.success) {
          cachePasses(satellite.id, groundStation.id, result.passes, { start: startTime, end: endTime });
          console.log(`✅ Cached ${result.passes.length} passes for ${satellite.name} -> ${groundStation.name}`);
        }
      }
    } catch (error) {
      console.error(`Failed to precompute passes for ${satellite.name} -> ${groundStation.name}:`, error);
    } finally {
      pendingRequests.delete(key);
    }
  }
}

/**
 * Precompute passes for all visible satellites and ground stations
 * Call this when satellites or ground stations change
 */
export async function precomputeAllPasses(satellites, groundStations, currentTime) {
  const startTime = currentTime;
  const endTime = currentTime + CONFIG.DEFAULT_TIME_RANGE_MS;
  
  const visibleSatellites = satellites.filter(s => s.isVisible && s.tle?.line1);
  const visibleStations = groundStations.filter(gs => gs.isVisible !== false);
  
  for (const sat of visibleSatellites) {
    for (const gs of visibleStations) {
      requestPrecompute(sat, gs, startTime, endTime);
    }
  }
}

/**
 * Check and refresh cache for current simulation time
 */
export function checkCacheRefresh(currentTime) {
  for (const [key, entry] of passCache) {
    if (entry.needsRefresh(currentTime)) {
      // Trigger refresh in background
      // This would require satellite and groundStation objects
      // For now, just log that refresh is needed
      console.log(`🔄 Cache refresh needed for ${key}`);
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: passCache.size,
    maxSize: CONFIG.MAX_CACHE_ENTRIES,
    pendingRequests: pendingRequests.size,
    pendingPrecompute: pendingPrecompute.length,
  };
}

export { CONFIG as PASS_CACHE_CONFIG };
