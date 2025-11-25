/**
 * Geodesic calculation utilities
 */

import { EARTH_RADIUS_KM } from './constants';

/**
 * Calculate satellite coverage radius based on altitude
 * Uses the curved Earth formula: R_e * arccos(R_e / (R_e + h))
 * 
 * @param {number} altitudeKm - Satellite altitude in kilometers
 * @returns {number} Coverage radius in kilometers
 */
export const calculateCoverageRadius = (altitudeKm) => {
  const Re = EARTH_RADIUS_KM;
  const cosTheta = Re / (Re + altitudeKm);
  const theta = Math.acos(cosTheta);
  const curvedKm = Re * theta;
  return curvedKm;
};

// Alias for backward compatibility
export const curvedFunction = calculateCoverageRadius;

/**
 * Generate geodesic circle coordinates around a center point
 * 
 * @param {Object} center - Center point with latitude and longitude properties
 * @param {number} radiusKm - Radius of circle in kilometers
 * @param {number} nPoints - Number of points to generate (default: 361)
 * @returns {Array} Array of {longitude, latitude} coordinates
 */
export const geodesicCircleCoords = (center, radiusKm, nPoints = 361) => {
  const earthRadius = EARTH_RADIUS_KM;
  const angles = Array.from({ length: nPoints }, (_, i) => (i * 360) / (nPoints - 1));
  const circleCoords = [];

  const lat1 = (center.latitude * Math.PI) / 180;
  const lon1 = (center.longitude * Math.PI) / 180;
  const d = radiusKm / earthRadius;

  angles.forEach((bearing) => {
    const bearingRad = (bearing * Math.PI) / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
      );
    const latDeg = (lat2 * 180) / Math.PI;
    const lonDeg = (((lon2 * 180) / Math.PI + 540) % 360) - 180;
    circleCoords.push({ longitude: lonDeg, latitude: latDeg });
  });

  return circleCoords;
};

/**
 * Convert degrees to radians
 * @param {number} degrees 
 * @returns {number} radians
 */
export const toRadians = (degrees) => degrees * (Math.PI / 180);

/**
 * Convert radians to degrees
 * @param {number} radians 
 * @returns {number} degrees
 */
export const toDegrees = (radians) => radians * (180 / Math.PI);
