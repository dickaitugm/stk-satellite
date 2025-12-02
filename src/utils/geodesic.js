/**
 * Geodesic calculation utilities
 */

import { EARTH_RADIUS_KM } from './constants';

/**
 * Calculate satellite coverage radius based on altitude and minimum elevation angle
 * Uses spherical Earth geometry to find the ground distance where satellite
 * appears at the specified elevation angle above the horizon.
 * 
 * Formula: 
 * - At 0° elevation (horizon): R_e * arccos(R_e / (R_e + h))
 * - At higher elevation: uses spherical geometry with elevation constraint
 * 
 * @param {number} altitudeKm - Satellite altitude in kilometers
 * @param {number} minElevationDeg - Minimum elevation angle in degrees (default: 0)
 * @returns {number} Coverage radius in kilometers
 */
export const calculateCoverageRadius = (altitudeKm, minElevationDeg = 0) => {
  const Re = EARTH_RADIUS_KM;
  const h = altitudeKm;
  const elevRad = (minElevationDeg * Math.PI) / 180;
  
  if (minElevationDeg <= 0) {
    // Simple horizon case (0° elevation)
    const cosTheta = Re / (Re + h);
    const theta = Math.acos(cosTheta);
    return Re * theta;
  }
  
  // For elevation > 0, use the formula:
  // sin(90° + elev) / (Re + h) = sin(nadir_angle) / Re
  // where nadir_angle is the angle at Earth's center
  
  // cos(elev) = (Re + h) * sin(nadir) / Re - using law of sines
  // We need to find the Earth central angle (theta) where elevation = minElevation
  
  // Using the relationship between elevation, slant range, and central angle:
  // rho (slant) = sqrt((Re+h)² + Re² - 2*Re*(Re+h)*cos(theta))
  // sin(elev + theta) = (Re + h) * sin(theta) / rho
  
  // Simpler approach using the half-angle formula:
  // At elevation E, the central angle theta satisfies:
  // sin(E) = (Re * cos(theta) - Re) / sqrt(Re² + (Re+h)² - 2*Re*(Re+h)*cos(theta)) 
  //        + (Re+h - Re*cos(theta)) / sqrt(...)
  
  // More direct formula - find central angle where elevation = minElevation
  // cos(90° - E) = cos(theta) * Re / (Re + h) + sin(theta) * ... 
  
  // Using the exact formula from satellite geometry:
  // The half-cone angle from satellite to Earth tangent point considering elevation
  const sinElev = Math.sin(elevRad);
  const cosElev = Math.cos(elevRad);
  
  // The angle at satellite between nadir and the observer at elevation E
  // sin(lambda) / Re = sin(90 + E) / (Re + h)
  // sin(lambda) = Re * cos(E) / (Re + h)
  const sinLambda = (Re * cosElev) / (Re + h);
  
  if (sinLambda > 1) {
    // Satellite too low for this elevation
    return 0;
  }
  
  const lambda = Math.asin(sinLambda);
  
  // The central angle (theta) is: 90° - E - lambda
  // But we need to be careful with the geometry
  const theta = (Math.PI / 2) - elevRad - lambda;
  
  if (theta <= 0) {
    return 0;
  }
  
  // Ground distance is Re * theta
  return Re * theta;
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
