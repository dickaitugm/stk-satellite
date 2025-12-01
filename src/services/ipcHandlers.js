import { ipcMain, dialog, app, shell } from "electron";
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
import { colorToKml, generateGroundTrackKml, generatePassKml, generateMultiPassKml } from "./kmlGenerator.js";

// ============================================
// Version Check Configuration
// ============================================
const GITHUB_REPO = "dickaitugm/stk-satellite";
const GRACE_PERIOD_DAYS = 7;

/**
 * Compare two version strings in format "year.major.minor"
 * @param {string} current - Current version (e.g., "25.0.0")
 * @param {string} latest - Latest version (e.g., "25.1.0")
 * @returns {number} -1 if current < latest, 0 if equal, 1 if current > latest
 */
function compareVersions(current, latest) {
  // Remove 'v' prefix if present
  const cleanCurrent = current.replace(/^v/, "");
  const cleanLatest = latest.replace(/^v/, "");

  const currentParts = cleanCurrent.split(".").map(Number);
  const latestParts = cleanLatest.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (curr < lat) return -1;
    if (curr > lat) return 1;
  }
  return 0;
}

/**
 * Get update check data file path
 * @returns {string} Path to update-check.json in userData
 */
function getUpdateCheckFilePath() {
  return path.join(app.getPath("userData"), "update-check.json");
}

/**
 * Read update check data from file
 * @returns {Object|null} Update check data or null if not exists
 */
function readUpdateCheckData() {
  try {
    const filePath = getUpdateCheckFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read update check data:", error);
  }
  return null;
}

/**
 * Write update check data to file
 * @param {Object} data - Data to write
 */
function writeUpdateCheckData(data) {
  try {
    const filePath = getUpdateCheckFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write update check data:", error);
  }
}

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

  /**
   * Export pass(es) to KML
   * @param {Object} passData - Pass export data
   * @param {string} passData.groundStationName - Name of the ground station
   * @param {string} passData.groundStationId - ID of the ground station
   * @param {Object} passData.location - Ground station location {lat, lon}
   * @param {Array} passData.passes - Array of pass data with path, aos, los, maxElevation
   * @param {boolean} passData.exportAll - Whether exporting all passes
   * @returns {Promise<{success, filePath?, error?}>}
   */
  ipcMain.handle("export-pass-kml", async (event, passData) => {
    try {
      const { groundStationName, location, passes, exportAll } = passData;

      if (!passes || passes.length === 0) {
        return { success: false, error: "No pass data to export" };
      }

      // Sanitize name for filename
      const safeName = groundStationName.replace(/[<>:"/\\|?*]/g, "-").trim() || "GroundStation";

      // Helper function to format UTC time for filename (YYYYMMDD-HHmmss)
      const formatTimeForFilename = (timestamp) => {
        const d = new Date(timestamp);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        const hour = String(d.getUTCHours()).padStart(2, "0");
        const min = String(d.getUTCMinutes()).padStart(2, "0");
        const sec = String(d.getUTCSeconds()).padStart(2, "0");
        return `${year}${month}${day}-${hour}${min}${sec}`;
      };

      const exportTime = new Date();

      let defaultFilename;
      if (exportAll) {
        // For all passes: use AOS of first pass and LOS of last pass
        const firstAos = formatTimeForFilename(passes[0].aos.time);
        const lastLos = formatTimeForFilename(passes[passes.length - 1].los.time);
        const satName = passes[0].satelliteName.replace(/[<>:"/\\|?*]/g, "-").trim();
        defaultFilename = `${safeName}-${satName}-passes-${firstAos}_to_${lastLos}UTC.kml`;
      } else {
        // For single pass: use AOS and LOS times
        const pass = passes[0];
        const satName = pass.satelliteName.replace(/[<>:"/\\|?*]/g, "-").trim();
        const aosTime = formatTimeForFilename(pass.aos.time);
        const losTime = formatTimeForFilename(pass.los.time);
        defaultFilename = `${safeName}-${satName}-pass-${aosTime}_to_${losTime}UTC.kml`;
      }

      const defaultPath = path.join(app.getPath("documents"), defaultFilename);

      const result = await dialog.showSaveDialog({
        title: exportAll ? "Export All Passes to KML" : "Export Pass to KML",
        defaultPath: defaultPath,
        filters: [
          { name: "KML Files", extensions: ["kml"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: "Export cancelled" };
      }

      // Generate KML content
      let kmlContent;
      if (exportAll) {
        kmlContent = generateMultiPassKml({
          groundStationName,
          satelliteName: passes[0]?.satelliteName || "Unknown Satellite",
          passes,
          groundStation: location,
          exportTime,
        });
      } else {
        const pass = passes[0];
        kmlContent = generatePassKml({
          satelliteName: pass.satelliteName,
          groundStationName,
          kmlColor: "ff9900ff", // Purple default
          aos: pass.aos,
          los: pass.los,
          maxElevation: pass.maxElevation,
          pathPoints: pass.path,
          groundStation: location,
          passNumber: pass.passNumber || 1,
          exportTime,
        });
      }

      // Write KML file
      fs.writeFileSync(result.filePath, kmlContent, "utf-8");

      return { success: true, filePath: result.filePath };
    } catch (error) {
      console.error("Failed to export pass KML:", error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // Version Check Handlers
  // ============================================

  /**
   * Get current app version
   */
  ipcMain.handle("get-app-version", async () => {
    return { success: true, version: app.getVersion() };
  });

  /**
   * Check for updates from GitHub Releases
   * Returns update info including grace period status
   */
  ipcMain.handle("check-for-updates", async () => {
    try {
      const currentVersion = app.getVersion();

      // Fetch latest release from GitHub
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "STK-Satellite-App",
        },
      });

      // Handle 404 - no releases yet
      if (response.status === 404) {
        return {
          success: true,
          hasUpdate: false,
          currentVersion,
          latestVersion: currentVersion,
          message: "No releases found",
        };
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const release = await response.json();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const releaseUrl = release.html_url;
      const releaseNotes = release.body || "";
      const publishedAt = release.published_at;

      // Compare versions
      const comparison = compareVersions(currentVersion, latestVersion);

      if (comparison >= 0) {
        // Current version is up to date or newer
        // Clear any existing update check data
        const filePath = getUpdateCheckFilePath();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return {
          success: true,
          hasUpdate: false,
          currentVersion,
          latestVersion,
        };
      }

      // Update available - check grace period
      let updateCheckData = readUpdateCheckData();
      const now = new Date();

      if (!updateCheckData || updateCheckData.latestVersion !== latestVersion) {
        // New version detected for the first time, start grace period
        updateCheckData = {
          latestVersion,
          firstDetected: now.toISOString(),
        };
        writeUpdateCheckData(updateCheckData);
      }

      // Calculate days elapsed since first detection
      const firstDetected = new Date(updateCheckData.firstDetected);
      const daysElapsed = Math.floor((now - firstDetected) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysElapsed);
      const isBlocked = daysElapsed >= GRACE_PERIOD_DAYS;

      return {
        success: true,
        hasUpdate: true,
        currentVersion,
        latestVersion,
        releaseUrl,
        releaseNotes,
        publishedAt,
        daysRemaining,
        isBlocked,
        firstDetected: updateCheckData.firstDetected,
      };
    } catch (error) {
      console.error("Failed to check for updates:", error);
      // On error, allow app to continue (grace mode)
      return {
        success: false,
        error: error.message,
        hasUpdate: false,
        currentVersion: app.getVersion(),
      };
    }
  });

  /**
   * Open release page in default browser
   */
  ipcMain.handle("open-release-page", async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Failed to open release page:", error);
      return { success: false, error: error.message };
    }
  });
}
