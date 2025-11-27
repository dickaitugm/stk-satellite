// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Mengekspos API yang aman ke jendela renderer (GUI)
contextBridge.exposeInMainWorld("electronAPI", {
  // Fetch TLE from URL (bypasses CORS)
  fetchTLE: (url) => ipcRenderer.invoke("fetch-tle", url),

  // ============================================
  // Satellite Calculation APIs (offloaded to main process)
  // ============================================

  /**
   * Calculate positions for multiple satellites (batch)
   * @param {Array} satellites - Array of {id, tle: {line1, line2}}
   * @param {number} timestamp - Unix timestamp in ms
   * @returns {Promise<{success, positions, timestamp}>}
   */
  calculateSatellitePositions: (satellites, timestamp) => ipcRenderer.invoke("calculate-satellite-positions", satellites, timestamp),

  /**
   * Calculate positions with delta for smooth interpolation
   * @param {Array} satellites - Array of {id, tle: {line1, line2}}
   * @param {number} timestamp - Current Unix timestamp in ms
   * @param {number} deltaMs - Time delta for interpolation (default: 100ms)
   * @returns {Promise<{success, current, next, timestamp, deltaMs}>}
   */
  calculatePositionsInterpolated: (satellites, timestamp, deltaMs = 100) => ipcRenderer.invoke("calculate-positions-interpolated", satellites, timestamp, deltaMs),

  /**
   * Generate orbit path for a single satellite
   * @param {Object} tle - {line1, line2}
   * @param {number} startTimestamp - Start time in Unix ms
   * @param {number} numPoints - Number of points to generate
   * @returns {Promise<{success, path}>}
   */
  generateOrbitPath: (tle, startTimestamp, numPoints = 100) => ipcRenderer.invoke("generate-orbit-path", tle, startTimestamp, numPoints),

  /**
   * Batch generate orbit paths for multiple satellites
   * @param {Array} satellites - Array of {id, tle: {line1, line2}}
   * @param {number} startTimestamp - Start time in Unix ms
   * @param {number} numPoints - Number of points per orbit
   * @returns {Promise<{success, paths}>}
   */
  generateOrbitPathsBatch: (satellites, startTimestamp, numPoints = 100) => ipcRenderer.invoke("generate-orbit-paths-batch", satellites, startTimestamp, numPoints),

  /**
   * Generate geodesic circle coordinates for coverage area
   * @param {Object} center - {latitude, longitude}
   * @param {number} radiusKm - Radius in kilometers
   * @param {number} nPoints - Number of points (default: 72)
   * @returns {Promise<{success, coords}>}
   */
  generateCoverageCircle: (center, radiusKm, nPoints = 72) => ipcRenderer.invoke("generate-coverage-circle", center, radiusKm, nPoints),

  /**
   * Calculate coverage radius from altitude
   * @param {number} altitudeKm - Satellite altitude in km
   * @returns {Promise<{success, radius}>}
   */
  calculateCoverageRadius: (altitudeKm) => ipcRenderer.invoke("calculate-coverage-radius", altitudeKm),

  /**
   * Clear satellite cache (when TLE is updated)
   * @param {string} id - Optional satellite ID
   * @returns {Promise<{success}>}
   */
  clearSatelliteCache: (id = null) => ipcRenderer.invoke("clear-satellite-cache", id),

  // ============================================
  // Backup & Restore Configuration APIs
  // ============================================

  /**
   * Backup configuration to JSON file
   * Opens save dialog and writes config data to selected file
   * @param {Object} configData - Configuration data to save
   * @returns {Promise<{success, filePath?, error?}>}
   */
  backupConfig: (configData) => ipcRenderer.invoke("backup-config", configData),

  /**
   * Restore configuration from JSON file
   * Opens file dialog and reads config data from selected file
   * @returns {Promise<{success, data?, filePath?, error?}>}
   */
  restoreConfig: () => ipcRenderer.invoke("restore-config"),
});
