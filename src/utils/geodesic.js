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

/**
 * Calculate destination point given start point, bearing and distance
 * 
 * @param {Object} start - Start point with latitude and longitude properties
 * @param {number} bearingDeg - Bearing in degrees (0 = North, 90 = East)
 * @param {number} distanceKm - Distance in kilometers
 * @returns {Object} Destination point {latitude, longitude}
 */
export const destinationPoint = (start, bearingDeg, distanceKm) => {
  const earthRadius = EARTH_RADIUS_KM;
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);
  const bearing = toRadians(bearingDeg);
  const d = distanceKm / earthRadius;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: toDegrees(lat2),
    longitude: ((toDegrees(lon2) + 540) % 360) - 180
  };
};

/**
 * Generate geodesic rectangle (swath) coordinates
 * 
 * @param {Object} center - Center point with latitude and longitude properties
 * @param {number} widthKm - Width in kilometers (cross-track)
 * @param {number} lengthKm - Length in kilometers (along-track)
 * @param {number} headingDeg - Satellite heading/track in degrees (0 = North)
 * @param {number} nPointsPerSide - Points per side for smoother curves (default: 10)
 * @returns {Array} Array of {longitude, latitude} coordinates
 */
export const geodesicRectangleCoords = (center, widthKm, lengthKm, headingDeg = 0, nPointsPerSide = 10) => {
  const halfWidth = widthKm / 2;
  const halfLength = lengthKm / 2;
  const coords = [];

  // Calculate the 4 corners relative to heading
  // Forward-left, Forward-right, Back-right, Back-left
  const forwardBearing = headingDeg;
  const rightBearing = (headingDeg + 90) % 360;
  const backBearing = (headingDeg + 180) % 360;
  const leftBearing = (headingDeg + 270) % 360;

  // Get corner points
  const forwardCenter = destinationPoint(center, forwardBearing, halfLength);
  const backCenter = destinationPoint(center, backBearing, halfLength);

  const forwardLeft = destinationPoint(forwardCenter, leftBearing, halfWidth);
  const forwardRight = destinationPoint(forwardCenter, rightBearing, halfWidth);
  const backRight = destinationPoint(backCenter, rightBearing, halfWidth);
  const backLeft = destinationPoint(backCenter, leftBearing, halfWidth);

  // Add points along each side
  const addSidePoints = (from, to, n) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      coords.push({
        latitude: from.latitude + t * (to.latitude - from.latitude),
        longitude: from.longitude + t * (to.longitude - from.longitude)
      });
    }
  };

  addSidePoints(forwardLeft, forwardRight, nPointsPerSide);
  addSidePoints(forwardRight, backRight, nPointsPerSide);
  addSidePoints(backRight, backLeft, nPointsPerSide);
  addSidePoints(backLeft, forwardLeft, nPointsPerSide);

  return coords;
};

/**
 * Generate geodesic ellipse coordinates
 * 
 * @param {Object} center - Center point with latitude and longitude properties
 * @param {number} semiMajorKm - Semi-major axis in kilometers (along-track)
 * @param {number} semiMinorKm - Semi-minor axis in kilometers (cross-track)
 * @param {number} headingDeg - Orientation angle in degrees (0 = North)
 * @param {number} nPoints - Number of points (default: 72)
 * @returns {Array} Array of {longitude, latitude} coordinates
 */
export const geodesicEllipseCoords = (center, semiMajorKm, semiMinorKm, headingDeg = 0, nPoints = 72) => {
  const coords = [];
  const headingRad = toRadians(headingDeg);

  for (let i = 0; i <= nPoints; i++) {
    const angle = (i * 2 * Math.PI) / nPoints;
    
    // Ellipse parametric equation with rotation
    const x = semiMajorKm * Math.cos(angle);
    const y = semiMinorKm * Math.sin(angle);
    
    // Rotate by heading
    const rotX = x * Math.cos(headingRad) - y * Math.sin(headingRad);
    const rotY = x * Math.sin(headingRad) + y * Math.cos(headingRad);
    
    // Calculate bearing and distance from center
    const distance = Math.sqrt(rotX * rotX + rotY * rotY);
    const bearing = toDegrees(Math.atan2(rotX, rotY));
    
    const point = destinationPoint(center, bearing, distance);
    coords.push(point);
  }

  return coords;
};

/**
 * Generate cone/sector coordinates (pie slice shape)
 * 
 * @param {Object} center - Center point with latitude and longitude properties
 * @param {number} radiusKm - Radius in kilometers
 * @param {number} fovDeg - Field of view angle in degrees
 * @param {number} headingDeg - Center bearing of the cone in degrees
 * @param {number} nPoints - Number of points on the arc (default: 36)
 * @returns {Array} Array of {longitude, latitude} coordinates
 */
export const geodesicConeCoords = (center, radiusKm, fovDeg, headingDeg = 0, nPoints = 36) => {
  const coords = [];
  const halfFov = fovDeg / 2;
  const startBearing = headingDeg - halfFov;
  const endBearing = headingDeg + halfFov;

  // Start at center
  coords.push({ latitude: center.latitude, longitude: center.longitude });

  // Arc points
  for (let i = 0; i <= nPoints; i++) {
    const bearing = startBearing + (i * (endBearing - startBearing)) / nPoints;
    const point = destinationPoint(center, bearing, radiusKm);
    coords.push(point);
  }

  // Close back to center
  coords.push({ latitude: center.latitude, longitude: center.longitude });

  return coords;
};

/**
 * Generate swath coordinates based on shape type
 * 
 * @param {Object} center - Center point with latitude and longitude
 * @param {Object} objectConfig - Object configuration with swath properties
 * @param {number} headingDeg - Satellite heading in degrees
 * @returns {Array} Array of {longitude, latitude} coordinates
 */
export const generateSwathCoords = (center, objectConfig, headingDeg = 0) => {
  const shape = objectConfig.swathShape || "circle";
  // Support both naming conventions: swathWidth/scanWidth, swathLength/scanLength
  const width = objectConfig.swathWidth || objectConfig.scanWidth || 100;
  const length = objectConfig.swathLength || objectConfig.scanLength || width;
  // Cone angle: coneAngle for cone shape, fovAngle as fallback
  const coneAngle = objectConfig.coneAngle || objectConfig.fovAngle || 30;
  // Custom polygon vertices
  const customPoints = objectConfig.polygonVertices || objectConfig.swathPoints || [];

  switch (shape) {
    case "rectangle":
      return geodesicRectangleCoords(center, width, length, headingDeg);
    
    case "ellipse":
      // For ellipse: length is along-track (semi-major), width is cross-track (semi-minor)
      return geodesicEllipseCoords(center, length / 2, width / 2, headingDeg);
    
    case "cone":
      // Cone: uses width as radius, coneAngle as FOV
      return geodesicConeCoords(center, width, coneAngle, headingDeg);
    
    case "polygon":
      // Custom polygon - vertices are offsets in km from nadir
      if (customPoints.length >= 3) {
        // Convert km offsets to lat/lon offsets (approximate)
        const coords = customPoints.map(pt => {
          // pt.x = east offset (km), pt.y = north offset (km)
          const eastKm = pt.x || pt.lon || 0;
          const northKm = pt.y || pt.lat || 0;
          const distance = Math.sqrt(eastKm * eastKm + northKm * northKm);
          const bearing = toDegrees(Math.atan2(eastKm, northKm)) + headingDeg;
          return destinationPoint(center, bearing, distance);
        });
        // Close the polygon
        if (coords.length > 0) {
          coords.push({ ...coords[0] });
        }
        return coords;
      }
      // Fallback to circle if no valid polygon points
      return geodesicCircleCoords(center, width / 2);
    
    case "circle":
    default:
      return geodesicCircleCoords(center, width / 2);
  }
};
