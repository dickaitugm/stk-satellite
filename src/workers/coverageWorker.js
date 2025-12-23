/**
 * Coverage Worker
 * Web Worker for heavy geodesic calculations in renderer process
 *
 * Handles:
 * - Coverage circle generation (geodesic circles)
 * - Swath polygon generation
 * - Coverage radius calculations
 *
 * This offloads trigonometric calculations from main thread
 * to keep UI responsive and WorldWind rendering smooth.
 */

// Earth radius in km
const EARTH_RADIUS_KM = 6371;

// Pre-computed unit circle cache
let unitCircleCache = null;
let unitCircleCacheSize = 0;

/**
 * Get or create unit circle points
 * @param {number} nPoints - Number of points
 * @returns {Array} Array of {sinB, cosB}
 */
function getUnitCircle(nPoints = 72) {
  if (unitCircleCache && unitCircleCacheSize === nPoints) {
    return unitCircleCache;
  }

  unitCircleCache = [];
  for (let i = 0; i < nPoints; i++) {
    const bearing = (i * 360) / nPoints;
    const bearingRad = (bearing * Math.PI) / 180;
    unitCircleCache.push({
      bearing,
      sinB: Math.sin(bearingRad),
      cosB: Math.cos(bearingRad),
    });
  }
  unitCircleCacheSize = nPoints;

  return unitCircleCache;
}

/**
 * Calculate coverage radius with elevation constraint
 * @param {number} altitudeKm - Satellite altitude in km
 * @param {number} minElevationDeg - Minimum elevation angle in degrees
 * @returns {number} Coverage radius in km
 */
function calculateCoverageRadius(altitudeKm, minElevationDeg = 0) {
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
  const theta = Math.PI / 2 - elevRad - lambda;

  if (theta <= 0) return 0;

  return Re * theta;
}

/**
 * Generate geodesic circle coordinates
 * @param {Object} center - {latitude, longitude} in degrees
 * @param {number} radiusKm - Radius in kilometers
 * @param {number} nPoints - Number of points
 * @returns {Array} Array of {latitude, longitude}
 */
function generateGeodesicCircle(center, radiusKm, nPoints = 72) {
  const uc = getUnitCircle(nPoints);

  const lat1 = (center.latitude * Math.PI) / 180;
  const lon1 = (center.longitude * Math.PI) / 180;
  const d = radiusKm / EARTH_RADIUS_KM;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);

  const coords = [];

  for (const { sinB, cosB } of uc) {
    const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * cosB);
    const lon2 = lon1 + Math.atan2(sinB * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));

    coords.push({
      latitude: (lat2 * 180) / Math.PI,
      longitude: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
    });
  }

  // Close the circle
  if (coords.length > 0) {
    coords.push({ ...coords[0] });
  }

  return coords;
}

/**
 * Generate swath coordinates for a sensor
 * @param {Object} center - {latitude, longitude}
 * @param {Object} sensorConfig - Sensor configuration
 * @param {number} heading - Satellite heading in degrees
 * @returns {Array} Swath polygon coordinates
 */
function generateSwathCoords(center, sensorConfig, heading = 0) {
  const {
    swathWidth = 0,
    scanWidth = 0,
    swathShape = "rectangle",
    // lookAngle and lookDirection could be used for off-nadir pointing in future
    // lookAngle = 0,
    // lookDirection = 'right',
  } = sensorConfig;

  const width = swathWidth || scanWidth;
  if (width <= 0) return [];

  const halfWidth = width / 2;
  const headingRad = (heading * Math.PI) / 180;
  const lat1 = (center.latitude * Math.PI) / 180;
  const lon1 = (center.longitude * Math.PI) / 180;

  const coords = [];

  if (swathShape === "circle") {
    // Circular swath - just a circle
    return generateGeodesicCircle(center, halfWidth, 36);
  }

  // Rectangle swath
  const lengthKm = sensorConfig.swathLength || width * 0.5;
  const halfLength = lengthKm / 2;

  // Calculate corner offsets
  const corners = [
    { along: halfLength, across: halfWidth },
    { along: halfLength, across: -halfWidth },
    { along: -halfLength, across: -halfWidth },
    { along: -halfLength, across: halfWidth },
  ];

  for (const corner of corners) {
    // Convert to bearing and distance
    const dx = corner.along * Math.cos(headingRad) - corner.across * Math.sin(headingRad);
    const dy = corner.along * Math.sin(headingRad) + corner.across * Math.cos(headingRad);
    const dist = Math.sqrt(dx * dx + dy * dy) / EARTH_RADIUS_KM;
    const bearing = Math.atan2(dy, dx);

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));

    coords.push({
      latitude: (lat2 * 180) / Math.PI,
      longitude: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
    });
  }

  // Close the polygon
  if (coords.length > 0) {
    coords.push({ ...coords[0] });
  }

  return coords;
}

/**
 * Batch generate coverage circles for multiple satellites
 * @param {Array} requests - Array of {id, center, radiusKm, nPoints}
 * @returns {Object} {[id]: coords}
 */
function batchGenerateCoverageCircles(requests) {
  const results = {};

  for (const req of requests) {
    results[req.id] = generateGeodesicCircle(req.center, req.radiusKm, req.nPoints || 72);
  }

  return results;
}

// Message handler
self.onmessage = function (e) {
  const { type, id, payload } = e.data;

  try {
    let result;

    switch (type) {
      case "generate-coverage-circle":
        result = generateGeodesicCircle(payload.center, payload.radiusKm, payload.nPoints || 72);
        break;

      case "batch-generate-coverage-circles":
        result = batchGenerateCoverageCircles(payload.requests);
        break;

      case "calculate-coverage-radius":
        result = calculateCoverageRadius(payload.altitudeKm, payload.minElevationDeg || 0);
        break;

      case "generate-swath":
        result = generateSwathCoords(payload.center, payload.sensorConfig, payload.heading || 0);
        break;

      case "batch-generate-swaths":
        result = {};
        for (const req of payload.requests) {
          result[req.id] = generateSwathCoords(req.center, req.sensorConfig, req.heading || 0);
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({ id, success: false, error: error.message });
  }
};

// Signal ready
self.postMessage({ type: "ready" });
