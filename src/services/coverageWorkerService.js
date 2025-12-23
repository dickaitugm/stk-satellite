/**
 * Coverage Worker Service
 * 
 * Manages a Web Worker for geodesic calculations in the renderer process.
 * This offloads heavy trigonometric calculations from the main thread.
 * 
 * Features:
 * - Singleton worker instance
 * - Promise-based async interface
 * - Batch processing support
 * - Fallback to main thread if worker fails
 */

// Worker instance
let worker = null;
let isWorkerReady = false;
let pendingRequests = new Map();
let nextRequestId = 0;

// Fallback geodesic calculation (used if worker fails)
function fallbackGeodesicCircle(center, radiusKm, nPoints = 72) {
  const EARTH_RADIUS_KM = 6371;
  const coords = [];
  
  const lat1 = (center.latitude * Math.PI) / 180;
  const lon1 = (center.longitude * Math.PI) / 180;
  const d = radiusKm / EARTH_RADIUS_KM;
  
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);
  
  for (let i = 0; i < nPoints; i++) {
    const bearing = (i * 360) / nPoints;
    const bearingRad = (bearing * Math.PI) / 180;
    const sinB = Math.sin(bearingRad);
    const cosB = Math.cos(bearingRad);
    
    const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * cosB);
    const lon2 = lon1 + Math.atan2(sinB * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));
    
    coords.push({
      latitude: (lat2 * 180) / Math.PI,
      longitude: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
    });
  }
  
  if (coords.length > 0) {
    coords.push({ ...coords[0] });
  }
  
  return coords;
}

/**
 * Initialize the coverage worker
 * @returns {Promise<boolean>} Whether worker initialized successfully
 */
export async function initCoverageWorker() {
  if (worker) return isWorkerReady;
  
  try {
    // Create worker from the coverageWorker.js file
    worker = new Worker(
      new URL('../workers/coverageWorker.js', import.meta.url),
      { type: 'module' }
    );
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Coverage worker initialization timeout');
        resolve(false);
      }, 5000);
      
      worker.onmessage = (e) => {
        const { type, id, success, result, error } = e.data;
        
        if (type === 'ready') {
          clearTimeout(timeout);
          isWorkerReady = true;
          console.log('✅ Coverage worker ready');
          resolve(true);
          return;
        }
        
        // Handle response to pending request
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error));
          }
        }
      };
      
      worker.onerror = (error) => {
        console.error('Coverage worker error:', error);
        isWorkerReady = false;
      };
    });
  } catch (error) {
    console.error('Failed to create coverage worker:', error);
    return false;
  }
}

/**
 * Execute a task on the coverage worker
 * @param {string} type - Task type
 * @param {Object} payload - Task payload
 * @returns {Promise} Task result
 */
async function execOnWorker(type, payload) {
  if (!isWorkerReady || !worker) {
    throw new Error('Coverage worker not ready');
  }
  
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ type, id, payload });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Worker request timeout'));
      }
    }, 5000);
  });
}

/**
 * Generate coverage circle using worker (with fallback)
 * @param {Object} center - {latitude, longitude}
 * @param {number} radiusKm - Radius in km
 * @param {number} nPoints - Number of points
 * @returns {Promise<Array>} Circle coordinates
 */
export async function generateCoverageCircle(center, radiusKm, nPoints = 72) {
  if (isWorkerReady && worker) {
    try {
      return await execOnWorker('generate-coverage-circle', { center, radiusKm, nPoints });
    } catch (error) {
      console.warn('Worker failed, using fallback:', error.message);
    }
  }
  
  // Fallback to main thread
  return fallbackGeodesicCircle(center, radiusKm, nPoints);
}

/**
 * Batch generate coverage circles
 * @param {Array} requests - Array of {id, center, radiusKm, nPoints}
 * @returns {Promise<Object>} {[id]: coords}
 */
export async function batchGenerateCoverageCircles(requests) {
  if (isWorkerReady && worker) {
    try {
      return await execOnWorker('batch-generate-coverage-circles', { requests });
    } catch (error) {
      console.warn('Worker batch failed, using fallback:', error.message);
    }
  }
  
  // Fallback to main thread
  const results = {};
  for (const req of requests) {
    results[req.id] = fallbackGeodesicCircle(req.center, req.radiusKm, req.nPoints || 72);
  }
  return results;
}

/**
 * Calculate coverage radius
 * @param {number} altitudeKm - Satellite altitude in km
 * @param {number} minElevationDeg - Minimum elevation in degrees
 * @returns {Promise<number>} Coverage radius in km
 */
export async function calculateCoverageRadiusAsync(altitudeKm, minElevationDeg = 0) {
  if (isWorkerReady && worker) {
    try {
      return await execOnWorker('calculate-coverage-radius', { altitudeKm, minElevationDeg });
    } catch (error) {
      console.warn('Worker failed, using fallback:', error.message);
    }
  }
  
  // Fallback - synchronous calculation
  const EARTH_RADIUS_KM = 6371;
  const Re = EARTH_RADIUS_KM;
  const h = altitudeKm;
  const elevRad = (minElevationDeg * Math.PI) / 180;
  
  if (minElevationDeg <= 0) {
    const cosTheta = Re / (Re + h);
    const theta = Math.acos(cosTheta);
    return Re * theta;
  }
  
  const cosElev = Math.cos(elevRad);
  const sinLambda = (Re * cosElev) / (Re + h);
  
  if (sinLambda > 1) return 0;
  
  const lambda = Math.asin(sinLambda);
  const theta = (Math.PI / 2) - elevRad - lambda;
  
  if (theta <= 0) return 0;
  
  return Re * theta;
}

/**
 * Generate swath polygon
 * @param {Object} center - {latitude, longitude}
 * @param {Object} sensorConfig - Sensor configuration
 * @param {number} heading - Satellite heading in degrees
 * @returns {Promise<Array>} Swath coordinates
 */
export async function generateSwath(center, sensorConfig, heading = 0) {
  if (isWorkerReady && worker) {
    try {
      return await execOnWorker('generate-swath', { center, sensorConfig, heading });
    } catch (error) {
      console.warn('Worker failed for swath:', error.message);
    }
  }
  
  // Return empty array as fallback (swath is optional)
  return [];
}

/**
 * Terminate the coverage worker
 */
export function terminateCoverageWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    isWorkerReady = false;
    pendingRequests.clear();
    console.log('🛑 Coverage worker terminated');
  }
}

/**
 * Check if worker is ready
 * @returns {boolean}
 */
export function isWorkerAvailable() {
  return isWorkerReady && worker !== null;
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  initCoverageWorker().catch(console.error);
}
