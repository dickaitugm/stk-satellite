import { ipcMain, dialog, app } from "electron";
import fs from "fs";
import path from "path";
import {
  calculateSatellitePositions,
  calculatePositionsForInterpolation,
  generateOrbitPath,
  generateOrbitPathsBatch,
  generateGeodesicCircleFast,
  getUnitCircle,
  calculateCoverageRadius,
  clearCache,
} from "./satelliteCalculator.js";
import { colorToKml, generateGroundTrackKml } from "./kmlGenerator.js";

export function registerIpcHandlers() {
  // Fetch TLE from URL (bypasses CORS)
  ipcMain.handle("fetch-tle", async (event, url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      return { success: true, data: text };
    } catch (error) {
      console.error("Failed to fetch TLE:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Calculate positions for multiple satellites (batch)
   * Called at ~10-20 Hz from renderer, positions are interpolated between calls
   *
   * @param {Array} satellites - Array of {id, tle: {line1, line2}}
   * @param {number} timestamp - Unix timestamp in ms
   */
  ipcMain.handle("calculate-satellite-positions", async (event, satellites, timestamp) => {
    try {
      const result = calculateSatellitePositions(satellites, timestamp);
      return { success: true, ...result };
    } catch (error) {
      console.error("Failed to calculate positions:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Calculate positions with delta for smooth interpolation
   * Returns current and next positions for velocity-based interpolation
   *
   * @param {Array} satellites - Array of {id, tle: {line1, line2}}
   * @param {number} timestamp - Current Unix timestamp in ms
   * @param {number} deltaMs - Time delta for interpolation (default: 100ms)
   */
  ipcMain.handle("calculate-positions-interpolated", async (event, satellites, timestamp, deltaMs = 100) => {
    try {
      const result = calculatePositionsForInterpolation(satellites, timestamp, deltaMs);
      return { success: true, ...result };
    } catch (error) {
      console.error("Failed to calculate interpolated positions:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Generate orbit path for a single satellite
   * Called on-demand when satellite is added or periodically (~every 10 seconds)
   *
   * @param {Object} tle - {line1, line2}
   * @param {number} startTimestamp - Start time in Unix ms
   * @param {number} numPoints - Number of points to generate
   */
  ipcMain.handle("generate-orbit-path", async (event, tle, startTimestamp, numPoints = 100) => {
    try {
      const path = generateOrbitPath(tle, startTimestamp, null, numPoints);
      return { success: true, path };
    } catch (error) {
      console.error("Failed to generate orbit path:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Batch generate orbit paths for multiple satellites
   *
   * @param {Array} satellites - Array of {id, tle: {line1, line2}}
   * @param {number} startTimestamp - Start time in Unix ms
   * @param {number} numPoints - Number of points per orbit
   */
  ipcMain.handle("generate-orbit-paths-batch", async (event, satellites, startTimestamp, numPoints = 100) => {
    try {
      const paths = generateOrbitPathsBatch(satellites, startTimestamp, numPoints);
      return { success: true, paths };
    } catch (error) {
      console.error("Failed to generate orbit paths batch:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Generate geodesic circle coordinates
   * Uses optimized calculation with pre-computed unit circle
   *
   * @param {Object} center - {latitude, longitude}
   * @param {number} radiusKm - Radius in kilometers
   * @param {number} nPoints - Number of points (default: 72)
   */
  ipcMain.handle("generate-coverage-circle", async (event, center, radiusKm, nPoints = 72) => {
    try {
      const unitCircle = getUnitCircle(nPoints);
      const coords = generateGeodesicCircleFast(center, radiusKm, unitCircle);
      return { success: true, coords };
    } catch (error) {
      console.error("Failed to generate coverage circle:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Calculate coverage radius from altitude
   *
   * @param {number} altitudeKm - Satellite altitude in km
   */
  ipcMain.handle("calculate-coverage-radius", async (event, altitudeKm) => {
    try {
      const radius = calculateCoverageRadius(altitudeKm);
      return { success: true, radius };
    } catch (error) {
      console.error("Failed to calculate coverage radius:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Clear satellite cache (when TLE is updated)
   *
   * @param {string} id - Optional satellite ID
   */
  ipcMain.handle("clear-satellite-cache", async (event, id = null) => {
    try {
      clearCache(id);
      return { success: true };
    } catch (error) {
      console.error("Failed to clear cache:", error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // Backup & Restore Configuration APIs
  // ============================================

  /**
   * Backup configuration to JSON file
   * Opens save dialog and writes config data to selected file
   *
   * @param {Object} configData - Configuration data to save
   * @param {string} scenarioName - Name of the scenario for filename
   * @returns {Promise<{success, filePath?, error?}>}
   */
  ipcMain.handle("backup-config", async (event, configData, scenarioName = "Untitled") => {
    try {
      // Sanitize scenario name for filename (remove invalid characters)
      const safeName = scenarioName.replace(/[<>:"/\\|?*]/g, "-").trim() || "Untitled";
      const defaultPath = path.join(app.getPath("documents"), `orbitsim-${safeName}-${new Date().toISOString().slice(0, 10)}.json`);

      const result = await dialog.showSaveDialog({
        title: "Backup Configuration",
        defaultPath: defaultPath,
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: "Backup cancelled" };
      }

      // Add metadata
      const backupData = {
        _meta: {
          version: "1.0",
          appName: "OrbitSim",
          createdAt: new Date().toISOString(),
        },
        ...configData,
      };

      fs.writeFileSync(result.filePath, JSON.stringify(backupData, null, 2), "utf-8");

      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error("Failed to backup config:", error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Restore configuration from JSON file
   * Opens file dialog and reads config data from selected file
   *
   * @returns {Promise<{success, data?, filePath?, error?}>}
   */
  ipcMain.handle("restore-config", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Restore Configuration",
        defaultPath: app.getPath("documents"),
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "Restore cancelled" };
      }

      const filePath = result.filePaths[0];
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const configData = JSON.parse(fileContent);

      // Validate backup file
      if (!configData._meta || configData._meta.appName !== "OrbitSim") {
        return {
          success: false,
          error: "Invalid backup file. This file was not created by OrbitSim.",
        };
      }

      return { success: true, data: configData, filePath };
    } catch (error) {
      console.error("Failed to restore config:", error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // Export Ground Track to KMZ API
  // ============================================

  /**
   * Export satellite ground track to KMZ file for Google Earth
   *
   * @param {Object} orbitData - { satelliteName, color, orbitPoints: [{lat, lon, alt, time}], currentPosition, simulationTime }
   * @returns {Promise<{success, filePath?, error?}>}
   */
  ipcMain.handle("export-orbit-kmz", async (event, orbitData) => {
    try {
      const { satelliteName, color, orbitPoints, currentPosition, simulationTime } = orbitData;

      if (!orbitPoints || orbitPoints.length === 0) {
        return { success: false, error: "No orbit data to export" };
      }

      // Sanitize satellite name for filename
      const safeName = satelliteName.replace(/[<>:"/\\|?*]/g, "-").trim() || "Satellite";

      // Format simulation time for filename (use simulationTime if provided, otherwise current time)
      const exportTime = new Date(simulationTime || Date.now());
      const timeStr = exportTime
        .toISOString()
        .replace(/[:.]/g, "-") // Replace : and . with -
        .slice(0, 19); // YYYY-MM-DDTHH-MM-SS

      const defaultPath = path.join(app.getPath("documents"), `${safeName}-groundtrack-${timeStr}.kml`);

      const result = await dialog.showSaveDialog({
        title: "Export Ground Track to KML",
        defaultPath: defaultPath,
        filters: [
          { name: "KML Files", extensions: ["kml"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: "Export cancelled" };
      }

      // Convert color and get current position
      const kmlColor = colorToKml(color);
      const currentPos = currentPosition || orbitPoints[0];

      // Generate KML content
      const kmlContent = generateGroundTrackKml({
        satelliteName,
        kmlColor,
        currentPos,
        orbitPoints,
        exportTime,
      });

      // Write KML file
      fs.writeFileSync(result.filePath, kmlContent, "utf-8");

      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error("Failed to export ground track:", error);
      return { success: false, error: error.message };
    }
  });
}
