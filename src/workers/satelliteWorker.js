/**
 * Satellite Worker Thread
 * Runs heavy SGP4 calculations in a separate thread to avoid blocking main process
 *
 * Handles:
 * - Batch satellite position calculations
 * - Interpolated positions for smooth animation
 * - Orbit path generation
 * - Access pass calculations (AOS/LOS)
 * - Coverage circle generation
 */

import { parentPort } from "worker_threads";
import * as satellite from "satellite.js";

// Cache for parsed satrec objects
const satrecCache = new Map();
const MAX_CACHE_SIZE = 200; // Support up to 100 satellites with TLE history

/**
 * Parse TLE and cache the satrec object
 */
function getSatrec(id, line1, line2) {
  const cacheKey = `${id}-${line1.substring(18, 32)}`;

  if (satrecCache.has(cacheKey)) {
    return satrecCache.get(cacheKey);
  }

  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    satrecCache.set(cacheKey, satrec);

    // LRU-style eviction
    if (satrecCache.size > MAX_CACHE_SIZE) {
      const firstKey = satrecCache.keys().next().value;
      satrecCache.delete(firstKey);
    }

    return satrec;
  } catch {
    return null;
  }
}

/**
 * Calculate single satellite position
 */
function calculatePositionFromSatrec(satrec, date) {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity.position) return null;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

    const vel = positionAndVelocity.velocity;
    const velocityMag = vel ? Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) : 0;

    return {
      lat: satellite.degreesLat(positionGd.latitude),
      lon: satellite.degreesLong(positionGd.longitude),
      alt: positionGd.height,
      velocity: velocityMag,
    };
  } catch {
    return null;
  }
}

/**
 * Batch calculate positions for multiple satellites
 */
function calculateSatellitePositions(satellites, timestamp) {
  const date = new Date(timestamp);
  const positions = {};

  for (const sat of satellites) {
    if (!sat.tle?.line1 || !sat.tle?.line2) continue;

    const satrec = getSatrec(sat.id, sat.tle.line1, sat.tle.line2);
    if (!satrec) continue;

    const pos = calculatePositionFromSatrec(satrec, date);
    if (pos) {
      positions[sat.id] = pos;
    }
  }

  return { positions, timestamp };
}

/**
 * Calculate positions with interpolation data
 */
function calculatePositionsForInterpolation(satellites, timestamp, deltaMs = 100) {
  const current = calculateSatellitePositions(satellites, timestamp);
  const next = calculateSatellitePositions(satellites, timestamp + deltaMs);

  return {
    current: current.positions,
    next: next.positions,
    timestamp,
    deltaMs,
  };
}

/**
 * Generate orbit path points
 */
function generateOrbitPath(tle, startTimestamp, periodMinutes = null, numPoints = 100) {
  if (!tle?.line1 || !tle?.line2) return [];

  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (!satrec) return [];

  if (!periodMinutes) {
    const meanMotion = (satrec.no * 1440) / (2 * Math.PI);
    periodMinutes = 1440 / meanMotion;
  }

  const stepMinutes = periodMinutes / numPoints;
  const points = [];

  for (let i = 0; i <= numPoints; i++) {
    const time = new Date(startTimestamp + i * stepMinutes * 60 * 1000);
    const pos = calculatePositionFromSatrec(satrec, time);

    if (pos) {
      points.push({
        lat: pos.lat,
        lon: pos.lon,
        alt: pos.alt,
        time: time.getTime(),
      });
    }
  }

  return points;
}

/**
 * Batch generate orbit paths
 */
function generateOrbitPathsBatch(satellites, startTimestamp, numPoints = 100) {
  const paths = {};

  for (const sat of satellites) {
    if (!sat.tle?.line1 || !sat.tle?.line2) continue;
    paths[sat.id] = generateOrbitPath(sat.tle, startTimestamp, null, numPoints);
  }

  return paths;
}

/**
 * Calculate coverage radius with elevation constraint
 */
function calculateCoverageRadius(altitudeKm, minElevationDeg = 0) {
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
  const theta = Math.PI / 2 - elevRad - lambda;

  if (theta <= 0) return 0;

  return Re * theta;
}

// Pre-computed unit circle
let unitCircleCache = null;
function getUnitCircle(nPoints = 72) {
  if (unitCircleCache && unitCircleCache.length === nPoints) {
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

  return unitCircleCache;
}

/**
 * Generate geodesic circle fast
 */
function generateGeodesicCircleFast(center, radiusKm, unitCircle = null) {
  const EARTH_RADIUS_KM = 6371;
  const uc = unitCircle || getUnitCircle();

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

  if (coords.length > 0) {
    coords.push({ ...coords[0] });
  }

  return coords;
}

/**
 * Calculate look angles from ground station to satellite
 */
function calculateLookAngles(groundStation, satrec, date) {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity.position) return null;

    const gmst = satellite.gstime(date);
    const positionEci = positionAndVelocity.position;
    const positionEcf = satellite.eciToEcf(positionEci, gmst);

    const lookAngles = satellite.ecfToLookAngles(
      {
        latitude: (groundStation.lat * Math.PI) / 180,
        longitude: (groundStation.lon * Math.PI) / 180,
        height: (groundStation.alt || 0) / 1000,
      },
      positionEcf
    );

    return {
      azimuth: (lookAngles.azimuth * 180) / Math.PI,
      elevation: (lookAngles.elevation * 180) / Math.PI,
      range: lookAngles.rangeSat,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate satellite passes with optimized scanning
 * Uses adaptive step size for better performance
 */
function calculateSatellitePasses(tle, groundStation, startTimestamp, endTimestamp, minElevation = 5) {
  if (!tle?.line1 || !tle?.line2) return [];

  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (!satrec) return [];

  const passes = [];

  // Adaptive step - larger for long time ranges
  const duration = endTimestamp - startTimestamp;
  const baseStep = 30 * 1000; // 30 seconds
  const stepMs = duration > 86400000 ? 60 * 1000 : baseStep; // 60s for > 24h
  const fineStepMs = 1000;

  let inPass = false;
  let currentPass = null;
  let maxElevation = -90;
  let maxElevationTime = null;
  let maxElevationAz = 0;

  for (let t = startTimestamp; t <= endTimestamp; t += stepMs) {
    const date = new Date(t);
    const lookAngles = calculateLookAngles(groundStation, satrec, date);

    if (!lookAngles) continue;

    const elevation = lookAngles.elevation;

    if (elevation >= minElevation) {
      if (!inPass) {
        inPass = true;
        let aosTime = t;

        // Binary search for precise AOS
        let left = t - stepMs;
        let right = t;
        while (right - left > fineStepMs) {
          const mid = Math.floor((left + right) / 2);
          const midAngles = calculateLookAngles(groundStation, satrec, new Date(mid));
          if (midAngles && midAngles.elevation >= minElevation) {
            right = mid;
          } else {
            left = mid;
          }
        }
        aosTime = right;

        const aosDate = new Date(aosTime);
        const aosLookAngles = calculateLookAngles(groundStation, satrec, aosDate);

        currentPass = {
          aos: {
            time: aosTime,
            date: aosDate.toISOString(),
            azimuth: aosLookAngles?.azimuth || 0,
            elevation: aosLookAngles?.elevation || minElevation,
          },
          los: null,
          maxElevation: null,
        };

        maxElevation = aosLookAngles?.elevation || minElevation;
        maxElevationTime = aosTime;
        maxElevationAz = aosLookAngles?.azimuth || 0;
      }

      if (elevation > maxElevation) {
        maxElevation = elevation;
        maxElevationTime = t;
        maxElevationAz = lookAngles.azimuth;
      }
    } else if (inPass) {
      inPass = false;

      // Binary search for precise LOS
      let left = t - stepMs;
      let right = t;
      while (right - left > fineStepMs) {
        const mid = Math.floor((left + right) / 2);
        const midAngles = calculateLookAngles(groundStation, satrec, new Date(mid));
        if (midAngles && midAngles.elevation >= minElevation) {
          left = mid;
        } else {
          right = mid;
        }
      }
      const losTime = left;

      const losDate = new Date(losTime);
      const losLookAngles = calculateLookAngles(groundStation, satrec, losDate);

      currentPass.los = {
        time: losTime,
        date: losDate.toISOString(),
        azimuth: losLookAngles?.azimuth || 0,
        elevation: losLookAngles?.elevation || minElevation,
      };

      currentPass.maxElevation = {
        time: maxElevationTime,
        date: new Date(maxElevationTime).toISOString(),
        azimuth: maxElevationAz,
        elevation: maxElevation,
      };

      currentPass.duration = (losTime - currentPass.aos.time) / 1000;

      passes.push(currentPass);
      currentPass = null;
      maxElevation = -90;
    }
  }

  // Handle pass extending beyond end time
  if (inPass && currentPass) {
    const losDate = new Date(endTimestamp);
    const losLookAngles = calculateLookAngles(groundStation, satrec, losDate);

    currentPass.los = {
      time: endTimestamp,
      date: losDate.toISOString(),
      azimuth: losLookAngles?.azimuth || 0,
      elevation: losLookAngles?.elevation || 0,
      partial: true,
    };

    currentPass.maxElevation = {
      time: maxElevationTime,
      date: new Date(maxElevationTime).toISOString(),
      azimuth: maxElevationAz,
      elevation: maxElevation,
    };

    currentPass.duration = (endTimestamp - currentPass.aos.time) / 1000;
    currentPass.partial = true;

    passes.push(currentPass);
  }

  return passes;
}

/**
 * Generate pass path for visualization
 */
function generatePassPath(tle, groundStation, pass, numPoints = 60) {
  if (!tle?.line1 || !tle?.line2) return [];
  if (!pass?.aos?.time || !pass?.los?.time) return [];

  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (!satrec) return [];

  const aosTime = pass.aos.time;
  const losTime = pass.los.time;
  const duration = losTime - aosTime;
  const stepMs = duration / (numPoints - 1);

  const path = [];

  for (let i = 0; i < numPoints; i++) {
    const time = aosTime + i * stepMs;
    const date = new Date(time);

    try {
      const positionAndVelocity = satellite.propagate(satrec, date);
      if (!positionAndVelocity.position) continue;

      const gmst = satellite.gstime(date);
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
      const lookAngles = satellite.ecfToLookAngles(
        {
          latitude: (groundStation.lat * Math.PI) / 180,
          longitude: (groundStation.lon * Math.PI) / 180,
          height: (groundStation.alt || 0) / 1000,
        },
        positionEcf
      );

      path.push({
        time,
        date: date.toISOString(),
        lat: satellite.degreesLat(positionGd.latitude),
        lon: satellite.degreesLong(positionGd.longitude),
        alt: positionGd.height,
        azimuth: (lookAngles.azimuth * 180) / Math.PI,
        elevation: (lookAngles.elevation * 180) / Math.PI,
        range: lookAngles.rangeSat,
      });
    } catch {
      // Skip point on error
    }
  }

  return path;
}

/**
 * Clear cache
 */
function clearCache(id = null) {
  if (id) {
    for (const key of satrecCache.keys()) {
      if (key.startsWith(id + "-")) {
        satrecCache.delete(key);
      }
    }
  } else {
    satrecCache.clear();
  }
}

// Message handler
parentPort.on("message", (message) => {
  const { type, id, payload } = message;

  try {
    let result;

    switch (type) {
      case "calculate-positions":
        result = calculateSatellitePositions(payload.satellites, payload.timestamp);
        break;

      case "calculate-positions-interpolated":
        result = calculatePositionsForInterpolation(payload.satellites, payload.timestamp, payload.deltaMs);
        break;

      case "generate-orbit-path":
        result = generateOrbitPath(payload.tle, payload.startTimestamp, payload.periodMinutes, payload.numPoints);
        break;

      case "generate-orbit-paths-batch":
        result = generateOrbitPathsBatch(payload.satellites, payload.startTimestamp, payload.numPoints);
        break;

      case "generate-coverage-circle": {
        const unitCircle = getUnitCircle(payload.nPoints);
        result = generateGeodesicCircleFast(payload.center, payload.radiusKm, unitCircle);
        break;
      }

      case "calculate-coverage-radius":
        result = calculateCoverageRadius(payload.altitudeKm, payload.minElevationDeg);
        break;

      case "calculate-satellite-passes":
        result = calculateSatellitePasses(payload.tle, payload.groundStation, payload.startTimestamp, payload.endTimestamp, payload.minElevation);
        break;

      case "generate-pass-path":
        result = generatePassPath(payload.tle, payload.groundStation, payload.pass, payload.numPoints);
        break;

      case "clear-cache":
        clearCache(payload?.id);
        result = { cleared: true };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    parentPort.postMessage({ id, success: true, result });
  } catch (error) {
    parentPort.postMessage({ id, success: false, error: error.message });
  }
});

// Signal ready
parentPort.postMessage({ type: "ready" });
