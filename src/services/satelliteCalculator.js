/**
 * Satellite Calculator Service
 * Runs in Electron main process for offloading heavy SGP4 calculations
 *
 * This module provides batch calculation capabilities to reduce IPC overhead
 * and keep the renderer process free for smooth 60 FPS rendering.
 */

import * as satellite from "satellite.js";

// Cache for parsed satrec objects to avoid re-parsing TLE
const satrecCache = new Map();

/**
 * Parse TLE and cache the satrec object
 * @param {string} id - Satellite ID
 * @param {string} line1 - TLE line 1
 * @param {string} line2 - TLE line 2
 * @returns {Object|null} satrec object or null if parsing fails
 */
function getSatrec(id, line1, line2) {
  const cacheKey = `${id}-${line1.substring(18, 32)}`; // ID + epoch for cache invalidation

  if (satrecCache.has(cacheKey)) {
    return satrecCache.get(cacheKey);
  }

  try {
    const satrec = satellite.twoline2satrec(line1, line2);
    satrecCache.set(cacheKey, satrec);

    // Limit cache size to prevent memory leaks
    if (satrecCache.size > 100) {
      const firstKey = satrecCache.keys().next().value;
      satrecCache.delete(firstKey);
    }

    return satrec;
  } catch (error) {
    console.error(`Failed to parse TLE for ${id}:`, error);
    return null;
  }
}

/**
 * Calculate single satellite position at given time
 * @param {Object} satrec - Parsed satrec object
 * @param {Date} date - Time to calculate position for
 * @returns {Object|null} Position {lat, lon, alt, velocity} or null
 */
function calculatePositionFromSatrec(satrec, date) {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity.position) return null;

    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

    // Calculate velocity magnitude for interpolation hints
    const vel = positionAndVelocity.velocity;
    const velocityMag = vel ? Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z) : 0;

    return {
      lat: satellite.degreesLat(positionGd.latitude),
      lon: satellite.degreesLong(positionGd.longitude),
      alt: positionGd.height,
      velocity: velocityMag, // km/s
    };
  } catch (error) {
    return null;
  }
}

/**
 * Batch calculate positions for multiple satellites
 * This is the main function called from IPC handler
 *
 * @param {Array} satellites - Array of {id, tle: {line1, line2}}
 * @param {number} timestamp - Unix timestamp (ms) for calculation
 * @returns {Object} { positions: {[id]: {lat, lon, alt, velocity}}, timestamp }
 */
export function calculateSatellitePositions(satellites, timestamp) {
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
 * Calculate positions at two time points for interpolation
 * Returns current position and position slightly ahead for velocity-based interpolation
 *
 * @param {Array} satellites - Array of {id, tle: {line1, line2}}
 * @param {number} timestamp - Current Unix timestamp (ms)
 * @param {number} deltaMs - Time delta for second point (default: 100ms)
 * @returns {Object} { current: positions, next: positions, deltaMs }
 */
export function calculatePositionsForInterpolation(satellites, timestamp, deltaMs = 100) {
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
 * Generate orbit path points for a satellite
 *
 * @param {Object} tle - {line1, line2}
 * @param {number} startTimestamp - Start time (Unix ms)
 * @param {number} periodMinutes - Orbit period in minutes (optional, will calculate from TLE)
 * @param {number} numPoints - Number of points to generate (default: 100)
 * @returns {Array} Array of {lat, lon, alt, time}
 */
export function generateOrbitPath(tle, startTimestamp, periodMinutes = null, numPoints = 100) {
  if (!tle?.line1 || !tle?.line2) return [];

  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (!satrec) return [];

  // Calculate orbit period from mean motion if not provided
  if (!periodMinutes) {
    const meanMotion = (satrec.no * 1440) / (2 * Math.PI); // rev/day to rev/day
    periodMinutes = 1440 / meanMotion; // minutes per orbit
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
 * Batch generate orbit paths for multiple satellites
 *
 * @param {Array} satellites - Array of {id, tle: {line1, line2}}
 * @param {number} startTimestamp - Start time (Unix ms)
 * @param {number} numPoints - Points per orbit (default: 100)
 * @returns {Object} { [id]: Array of orbit points }
 */
export function generateOrbitPathsBatch(satellites, startTimestamp, numPoints = 100) {
  const paths = {};

  for (const sat of satellites) {
    if (!sat.tle?.line1 || !sat.tle?.line2) continue;
    paths[sat.id] = generateOrbitPath(sat.tle, startTimestamp, null, numPoints);
  }

  return paths;
}

/**
 * Calculate coverage radius using curved Earth formula
 * This is a simple calculation but included here for completeness
 *
 * @param {number} altitudeKm - Satellite altitude in km
 * @returns {number} Coverage radius in km
 */
export function calculateCoverageRadius(altitudeKm) {
  const EARTH_RADIUS_KM = 6371;
  const cosTheta = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm);
  const theta = Math.acos(cosTheta);
  return EARTH_RADIUS_KM * theta;
}

/**
 * Pre-generate unit circle coordinates (can be scaled and translated)
 * Generate once and cache for reuse
 *
 * @param {number} nPoints - Number of points (default: 72 for 5-degree steps)
 * @returns {Array} Array of {bearing, sinB, cosB} for fast circle generation
 */
let unitCircleCache = null;
export function getUnitCircle(nPoints = 72) {
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
 * Generate geodesic circle using pre-calculated unit circle
 * Much faster than calculating sin/cos every time
 *
 * @param {Object} center - {latitude, longitude} in degrees
 * @param {number} radiusKm - Radius in kilometers
 * @param {Array} unitCircle - Pre-calculated unit circle from getUnitCircle()
 * @returns {Array} Array of {latitude, longitude}
 */
export function generateGeodesicCircleFast(center, radiusKm, unitCircle = null) {
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

  // Close the circle
  if (coords.length > 0) {
    coords.push({ ...coords[0] });
  }

  return coords;
}

/**
 * Clear satrec cache (useful when TLE is updated)
 * @param {string} id - Optional satellite ID to clear specific entry
 */
export function clearCache(id = null) {
  if (id) {
    // Clear all entries for this satellite ID
    for (const key of satrecCache.keys()) {
      if (key.startsWith(id + "-")) {
        satrecCache.delete(key);
      }
    }
  } else {
    satrecCache.clear();
  }
}

/**
 * Calculate look angles (azimuth, elevation, range) from ground station to satellite
 * @param {Object} groundStation - {lat, lon, alt} in degrees and meters
 * @param {Object} satrec - Parsed satrec object
 * @param {Date} date - Time for calculation
 * @returns {Object|null} {azimuth, elevation, range} in degrees and km
 */
function calculateLookAngles(groundStation, satrec, date) {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity.position) return null;

    const gmst = satellite.gstime(date);

    // Observer position
    const observerGd = {
      latitude: satellite.degreesLat((groundStation.lat * Math.PI) / 180),
      longitude: satellite.degreesLong((groundStation.lon * Math.PI) / 180),
      height: (groundStation.alt || 0) / 1000, // Convert m to km
    };

    // Convert observer geodetic to radians for lookAngles
    const observerEcf = satellite.geodeticToEcf({
      latitude: (groundStation.lat * Math.PI) / 180,
      longitude: (groundStation.lon * Math.PI) / 180,
      height: (groundStation.alt || 0) / 1000,
    });

    // Get satellite ECI position
    const positionEci = positionAndVelocity.position;

    // Convert satellite ECI to ECF
    const positionEcf = satellite.eciToEcf(positionEci, gmst);

    // Calculate look angles
    const lookAngles = satellite.ecfToLookAngles(
      { latitude: (groundStation.lat * Math.PI) / 180, longitude: (groundStation.lon * Math.PI) / 180, height: (groundStation.alt || 0) / 1000 },
      positionEcf
    );

    return {
      azimuth: (lookAngles.azimuth * 180) / Math.PI, // Convert to degrees
      elevation: (lookAngles.elevation * 180) / Math.PI, // Convert to degrees
      range: lookAngles.rangeSat, // Already in km
    };
  } catch (error) {
    console.error("Error calculating look angles:", error);
    return null;
  }
}

/**
 * Calculate satellite passes (AOS/LOS) over a ground station
 * @param {Object} tle - {line1, line2} TLE data
 * @param {Object} groundStation - {lat, lon, alt} ground station location
 * @param {number} startTimestamp - Start time (Unix ms)
 * @param {number} endTimestamp - End time (Unix ms)
 * @param {number} minElevation - Minimum elevation in degrees (default: 5)
 * @returns {Array} Array of pass objects with AOS, LOS, and max elevation details
 */
export function calculateSatellitePasses(tle, groundStation, startTimestamp, endTimestamp, minElevation = 5) {
  if (!tle?.line1 || !tle?.line2) return [];

  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (!satrec) return [];

  const passes = [];
  const stepMs = 30 * 1000; // 30 second step for initial scan
  const fineStepMs = 1000; // 1 second step for precise AOS/LOS

  let inPass = false;
  let currentPass = null;
  let maxElevation = -90;
  let maxElevationTime = null;
  let maxElevationAz = 0;

  // Iterate through time range
  for (let t = startTimestamp; t <= endTimestamp; t += stepMs) {
    const date = new Date(t);
    const lookAngles = calculateLookAngles(groundStation, satrec, date);

    if (!lookAngles) continue;

    const elevation = lookAngles.elevation;

    if (elevation >= minElevation) {
      if (!inPass) {
        // Start of pass - find precise AOS
        inPass = true;
        let aosTime = t;

        // Search backwards for precise AOS
        for (let tAos = t; tAos >= t - stepMs; tAos -= fineStepMs) {
          const aosDate = new Date(tAos);
          const aosLookAngles = calculateLookAngles(groundStation, satrec, aosDate);
          if (aosLookAngles && aosLookAngles.elevation < minElevation) {
            aosTime = tAos + fineStepMs;
            break;
          }
          aosTime = tAos;
        }

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

      // Track max elevation
      if (elevation > maxElevation) {
        maxElevation = elevation;
        maxElevationTime = t;
        maxElevationAz = lookAngles.azimuth;
      }
    } else if (inPass) {
      // End of pass - find precise LOS
      inPass = false;
      let losTime = t;

      // Search backwards for precise LOS
      for (let tLos = t - stepMs; tLos <= t; tLos += fineStepMs) {
        const losDate = new Date(tLos);
        const losLookAngles = calculateLookAngles(groundStation, satrec, losDate);
        if (losLookAngles && losLookAngles.elevation < minElevation) {
          losTime = tLos;
          break;
        }
      }

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

      currentPass.duration = (losTime - currentPass.aos.time) / 1000; // seconds

      passes.push(currentPass);
      currentPass = null;
      maxElevation = -90;
    }
  }

  // Handle pass that extends beyond end time
  if (inPass && currentPass) {
    const losDate = new Date(endTimestamp);
    const losLookAngles = calculateLookAngles(groundStation, satrec, losDate);

    currentPass.los = {
      time: endTimestamp,
      date: losDate.toISOString(),
      azimuth: losLookAngles?.azimuth || 0,
      elevation: losLookAngles?.elevation || 0,
      partial: true, // Indicates pass extends beyond time range
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
 * Calculate detailed pass positions (AOS, 1/4, 1/2, 3/4, LOS points)
 * @param {Object} tle - {line1, line2} TLE data
 * @param {Object} groundStation - {lat, lon, alt} ground station location
 * @param {Object} pass - Pass object with aos, los, maxElevation
 * @returns {Array} Array of 5 position points with time, az, el, range
 */
export function calculatePassDetails(tle, groundStation, pass) {
  if (!tle?.line1 || !tle?.line2) return [];
  if (!pass?.aos?.time || !pass?.los?.time) return [];

  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
  if (!satrec) return [];

  const aosTime = pass.aos.time;
  const losTime = pass.los.time;
  const maxElTime = pass.maxElevation?.time || (aosTime + losTime) / 2;

  // Calculate 5 key points: AOS, 1/2 AOS-MAX, MAX, 1/2 MAX-LOS, LOS
  const points = [
    { label: "AOS", time: aosTime },
    { label: "1/2 Rise", time: (aosTime + maxElTime) / 2 },
    { label: "Max El", time: maxElTime },
    { label: "1/2 Set", time: (maxElTime + losTime) / 2 },
    { label: "LOS", time: losTime },
  ];

  const details = [];

  for (const point of points) {
    const date = new Date(point.time);
    const lookAngles = calculateLookAngles(groundStation, satrec, date);

    if (lookAngles) {
      details.push({
        label: point.label,
        time: point.time,
        date: date.toISOString(),
        azimuth: lookAngles.azimuth,
        elevation: lookAngles.elevation,
        range: lookAngles.range,
      });
    }
  }

  return details;
}

/**
 * Parse TLE epoch from line 1
 * @param {string} line1 - TLE line 1
 * @returns {Date|null} Epoch date or null
 */
export function parseTleEpoch(line1) {
  if (!line1 || line1.length < 32) return null;

  try {
    // TLE line 1 format: epoch is at columns 18-32
    // Format: YYDDD.DDDDDDDD where YY=year, DDD.DDDDDDDD=day of year with fraction
    const epochStr = line1.substring(18, 32).trim();
    const year = parseInt(epochStr.substring(0, 2));
    const dayOfYear = parseFloat(epochStr.substring(2));

    // Convert 2-digit year to 4-digit
    const fullYear = year < 57 ? 2000 + year : 1900 + year;

    // Calculate date from day of year
    const date = new Date(Date.UTC(fullYear, 0, 1));
    date.setTime(date.getTime() + (dayOfYear - 1) * 24 * 60 * 60 * 1000);

    return date;
  } catch (error) {
    console.error("Error parsing TLE epoch:", error);
    return null;
  }
}
