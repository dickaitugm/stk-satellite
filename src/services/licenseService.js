/**
 * ========================================
 * STK SATELLITE - LICENSE SERVICE
 * ========================================
 *
 * Adapted from CelestiaKey Activation Service for STK Satellite.
 * Includes grace period for offline usage and improved Electron integration.
 *
 * FLOW:
 * 1. Check local license cache on startup
 * 2. If exists, verify with server (online) or check grace period (offline)
 * 3. If not exists, require activation
 * 4. Grace period: 7 days offline usage allowed
 *
 * @version 1.0.0
 */

import crypto from "crypto";
import os from "os";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { app } from "electron";

// ============================================
// Configuration
// ============================================
const LICENSE_CONFIG = {
  // Database configuration (from environment or defaults)
  database: {
    host: process.env.DB_HOST || "10.35.0.103",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "orsync_admin",
    password: process.env.DB_PASSWORD || "semangka",
    database: process.env.DB_NAME || "license_app",
    connectTimeout: 10000,
    acquireTimeout: 10000,
  },

  // Grace period in days
  gracePeriodDays: 7,

  // Online check interval (24 hours)
  checkIntervalMs: 24 * 60 * 60 * 1000,

  // App info
  appName: "STK Satellite",
  appVersion: app?.getVersion?.() || "1.0.0",

  // License file
  licenseFileName: "license.dat",
};

// ============================================
// State
// ============================================
let dbConnection = null;
let licenseData = null;
let deviceFingerprint = null;

// ============================================
// Helper Functions
// ============================================

/**
 * Get license file path in user data directory
 */
function getLicenseFilePath() {
  const userDataPath = app?.getPath?.("userData") || path.join(os.homedir(), ".stk-satellite");
  return path.join(userDataPath, LICENSE_CONFIG.licenseFileName);
}

/**
 * Generate encryption key from stable device info
 * Uses hostname + platform (stable across restarts)
 * Note: Don't use dynamic fingerprint as it may change
 */
function getEncryptionKey() {
  // Use stable values that don't change between app restarts
  const stableKey = os.hostname() + os.platform() + os.arch() + "stk-satellite-v1";
  return crypto.createHash("sha256").update(stableKey).digest();
}

/**
 * Encrypt data for local storage
 */
function encryptData(data) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Encryption failed:", error);
    // Fallback to base64
    return "b64:" + Buffer.from(JSON.stringify(data)).toString("base64");
  }
}

/**
 * Decrypt data from local storage
 */
function decryptData(encryptedData) {
  try {
    if (encryptedData.startsWith("b64:")) {
      // Base64 fallback
      return JSON.parse(Buffer.from(encryptedData.slice(4), "base64").toString("utf8"));
    }

    const [ivHex, encrypted] = encryptedData.split(":");
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}

// ============================================
// Hardware Fingerprinting
// ============================================

/**
 * Generate hardware fingerprint from system info
 * Uses: CPU, MAC address, hostname, platform, memory
 */
export async function generateHardwareFingerprint() {
  try {
    const components = [];

    // CPU Information
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      components.push(`cpu:${cpus[0].model}`);
      components.push(`cores:${cpus.length}`);
    }

    // Network Interfaces (MAC Address)
    const networks = os.networkInterfaces();
    const macAddresses = [];
    for (const name of Object.keys(networks)) {
      for (const net of networks[name]) {
        if (net.mac && net.mac !== "00:00:00:00:00:00") {
          macAddresses.push(net.mac);
        }
      }
    }
    if (macAddresses.length > 0) {
      // Sort to get consistent result
      components.push(`mac:${macAddresses.sort()[0]}`);
    }

    // System Information
    components.push(`platform:${os.platform()}`);
    components.push(`arch:${os.arch()}`);
    components.push(`hostname:${os.hostname()}`);

    // Memory (rounded to GB for stability)
    const memoryGB = Math.floor(os.totalmem() / 1024 / 1024 / 1024);
    components.push(`memory:${memoryGB}`);

    // Generate SHA-256 hash
    const fingerprint = crypto
      .createHash("sha256")
      .update(components.join("|"))
      .digest("hex");

    deviceFingerprint = fingerprint;
    return fingerprint;
  } catch (error) {
    console.error("Error generating hardware fingerprint:", error);
    throw new Error("Failed to generate device fingerprint");
  }
}

/**
 * Get detailed hardware info for activation
 */
export async function getHardwareInfo() {
  try {
    const fingerprint = await generateHardwareFingerprint();

    // Get network info
    const networks = os.networkInterfaces();
    let macAddress = "";
    let localIp = "";

    for (const name of Object.keys(networks)) {
      for (const net of networks[name]) {
        if (net.mac && net.mac !== "00:00:00:00:00:00" && !macAddress) {
          macAddress = net.mac;
        }
        if (net.family === "IPv4" && !net.internal && !localIp) {
          localIp = net.address;
        }
      }
    }

    // Get public IP
    let publicIp = "";
    try {
      const response = await fetch("https://api.ipify.org?format=json", { 
        signal: AbortSignal.timeout(5000) 
      });
      const data = await response.json();
      publicIp = data.ip;
    } catch {
      console.warn("Could not fetch public IP");
    }

    return {
      fingerprint,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      macAddress,
      localIp,
      publicIp,
      cpuModel: os.cpus()[0]?.model || "Unknown",
      memoryGB: Math.floor(os.totalmem() / 1024 / 1024 / 1024),
    };
  } catch (error) {
    console.error("Error getting hardware info:", error);
    throw error;
  }
}

// ============================================
// Database Connection
// ============================================

/**
 * Connect to MySQL database
 */
async function connectToDatabase() {
  try {
    if (dbConnection) {
      // Test existing connection
      await dbConnection.ping();
      return dbConnection;
    }

    console.log("Connecting to license database...");
    dbConnection = await mysql.createConnection(LICENSE_CONFIG.database);
    console.log("License database connected");
    return dbConnection;
  } catch (error) {
    console.error("Database connection failed:", error.message);
    throw new Error("Cannot connect to license server: " + error.message);
  }
}

/**
 * Close database connection
 */
async function closeDatabaseConnection() {
  if (dbConnection) {
    try {
      await dbConnection.end();
    } catch (error) {
      console.error("Error closing database connection:", error);
    }
    dbConnection = null;
  }
}

// ============================================
// Local License Management
// ============================================

/**
 * Save license data to local encrypted file
 */
async function saveLicenseData(data) {
  try {
    const filePath = getLicenseFilePath();
    const dirPath = path.dirname(filePath);
    
    console.log("Saving license to:", filePath);

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log("Created directory:", dirPath);
    }

    const encrypted = encryptData(data);
    fs.writeFileSync(filePath, encrypted, "utf8");
    console.log("License data saved successfully");
    
    // Verify save was successful
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log("License file size:", stats.size, "bytes");
    }
  } catch (error) {
    console.error("Failed to save license data:", error);
    throw new Error("Failed to save license data");
  }
}

/**
 * Load license data from local encrypted file
 */
function loadLicenseData() {
  try {
    const filePath = getLicenseFilePath();
    console.log("Loading license from:", filePath);

    if (!fs.existsSync(filePath)) {
      console.log("License file not found");
      return null;
    }

    const encrypted = fs.readFileSync(filePath, "utf8");
    console.log("License file read, decrypting...");
    
    const data = decryptData(encrypted);

    if (data) {
      console.log("License data loaded successfully");
      licenseData = data;
    } else {
      console.log("Failed to decrypt license data - file may be corrupted");
      // Delete corrupted file so user can re-activate
      try {
        fs.unlinkSync(filePath);
        console.log("Corrupted license file deleted");
      } catch (e) {
        console.error("Failed to delete corrupted file:", e);
      }
    }

    return data;
  } catch (error) {
    console.error("Failed to load license data:", error);
    return null;
  }
}

/**
 * Delete local license data
 */
function deleteLicenseData() {
  try {
    const filePath = getLicenseFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    licenseData = null;
  } catch (error) {
    console.error("Failed to delete license data:", error);
  }
}

// ============================================
// License Validation
// ============================================

/**
 * Validate license key format
 * Format: XXXX-XXXX-XXXX-XXXX
 */
export function validateLicenseKeyFormat(licenseKey) {
  if (!licenseKey || typeof licenseKey !== "string") {
    return { valid: false, error: "License key is required" };
  }

  const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const normalizedKey = licenseKey.toUpperCase().trim();

  if (!keyPattern.test(normalizedKey)) {
    return {
      valid: false,
      error: "Invalid license key format. Expected: XXXX-XXXX-XXXX-XXXX",
    };
  }

  return { valid: true, normalizedKey };
}

// ============================================
// Grace Period Logic
// ============================================

/**
 * Calculate grace period status
 */
function calculateGracePeriod(lastVerified) {
  if (!lastVerified) {
    return { inGracePeriod: false, daysRemaining: 0, isExpired: true };
  }

  const lastVerifiedDate = new Date(lastVerified);
  const now = new Date();
  const daysSinceVerify = Math.floor((now - lastVerifiedDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, LICENSE_CONFIG.gracePeriodDays - daysSinceVerify);

  return {
    inGracePeriod: daysRemaining > 0,
    daysRemaining,
    isExpired: daysRemaining === 0,
    daysSinceVerify,
  };
}

// ============================================
// Main License Operations
// ============================================

/**
 * Activate a license key
 */
export async function activateLicense(licenseKey) {
  try {
    console.log("Starting license activation...");

    // 1. Validate format
    const validation = validateLicenseKeyFormat(licenseKey);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 2. Generate fingerprint
    const fingerprint = await generateHardwareFingerprint();
    console.log("Hardware fingerprint:", fingerprint.substring(0, 8) + "...");

    // 3. Connect to database
    const connection = await connectToDatabase();

    try {
      await connection.beginTransaction();

      // 4. Check license exists and is active
      const [licenseRows] = await connection.execute(
        `SELECT l.*, p.name as product_name, u.full_name as user_name 
         FROM licenses l 
         LEFT JOIN products p ON l.product_id = p.id 
         LEFT JOIN users u ON l.user_id = u.id 
         WHERE l.license_key = ? AND l.status = 'active'`,
        [validation.normalizedKey]
      );

      if (licenseRows.length === 0) {
        await connection.rollback();
        return { success: false, error: "Invalid or inactive license key" };
      }

      const license = licenseRows[0];

      // 5. Check expiry
      if (license.valid_until && new Date(license.valid_until) < new Date()) {
        await connection.rollback();
        return { success: false, error: "License has expired" };
      }

      // 6. Check existing activation
      const hardwareIdBuffer = Buffer.from(fingerprint, "hex");
      const [existingActivations] = await connection.execute(
        "SELECT * FROM activations WHERE license_id = ? AND hardware_id = ?",
        [license.id, hardwareIdBuffer]
      );

      if (existingActivations.length > 0) {
        const activation = existingActivations[0];

        if (activation.is_active) {
          // Already activated on this device
          await connection.commit();

          const data = {
            ...license,
            activation_id: activation.id,
            device_fingerprint: fingerprint,
            activated_at: activation.created_at,
            last_verified: new Date().toISOString(),
          };

          await saveLicenseData(data);
          licenseData = data;

          return {
            success: true,
            message: "Device already activated",
            data: getLicenseInfo(),
          };
        } else {
          // Reactivate
          await connection.execute(
            `UPDATE activations SET is_active = true, deactivation_reason = NULL WHERE id = ?`,
            [activation.id]
          );
        }
      } else {
        // 7. Check max activations
        const [activeCount] = await connection.execute(
          "SELECT COUNT(*) as count FROM activations WHERE license_id = ? AND is_active = true",
          [license.id]
        );

        if (activeCount[0].count >= license.max_activations) {
          await connection.rollback();
          return {
            success: false,
            error: `Maximum activations reached (${license.max_activations}). Please deactivate another device first.`,
          };
        }

        // 8. Create new activation
        const hwInfo = await getHardwareInfo();
        await connection.execute(
          `INSERT INTO activations 
           (license_id, hardware_id, motherboard_serial, mac_address, disk_serial, public_ip, local_ip, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?, true)`,
          [
            license.id,
            hardwareIdBuffer,
            hwInfo.hostname, // Using hostname as motherboard_serial placeholder
            hwInfo.macAddress,
            "", // disk_serial - would need systeminformation for this
            hwInfo.publicIp,
            hwInfo.localIp,
          ]
        );
      }

      await connection.commit();

      // 9. Save locally
      const data = {
        ...license,
        device_fingerprint: fingerprint,
        activated_at: new Date().toISOString(),
        last_verified: new Date().toISOString(),
      };

      await saveLicenseData(data);
      licenseData = data;

      console.log("License activated successfully!");
      return {
        success: true,
        message: "License activated successfully",
        data: getLicenseInfo(),
      };
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error("License activation failed:", error);
    return {
      success: false,
      error: error.message || "Activation failed",
    };
  } finally {
    await closeDatabaseConnection();
  }
}

/**
 * Verify license - main verification function
 * Checks local cache, online verification, and grace period
 */
export async function verifyLicense() {
  try {
    // 1. Load local license data
    const localData = loadLicenseData();

    if (!localData) {
      return {
        valid: false,
        code: "NOT_ACTIVATED",
        error: "No license found. Please activate your license.",
        requiresActivation: true,
      };
    }

    // 2. Generate and verify fingerprint
    const currentFingerprint = await generateHardwareFingerprint();
    if (currentFingerprint !== localData.device_fingerprint) {
      return {
        valid: false,
        code: "HARDWARE_CHANGED",
        error: "Hardware configuration has changed. Please reactivate your license.",
        requiresActivation: true,
      };
    }

    // 3. Check local expiry
    if (localData.valid_until && new Date(localData.valid_until) < new Date()) {
      return {
        valid: false,
        code: "EXPIRED",
        error: "License has expired",
        expiredAt: localData.valid_until,
        isBlocked: true,
      };
    }

    // 4. Try online verification
    let onlineResult = null;
    let isOffline = false;

    try {
      const connection = await connectToDatabase();

      // Verify license in database
      const [licenseRows] = await connection.execute(
        `SELECT l.*, p.name as product_name, u.full_name as user_name 
         FROM licenses l 
         LEFT JOIN products p ON l.product_id = p.id 
         LEFT JOIN users u ON l.user_id = u.id 
         WHERE l.license_key = ?`,
        [localData.license_key]
      );

      if (licenseRows.length === 0) {
        await closeDatabaseConnection();
        return {
          valid: false,
          code: "NOT_FOUND",
          error: "License not found in database",
          isBlocked: true,
        };
      }

      const license = licenseRows[0];

      // Check status
      if (license.status !== "active") {
        await closeDatabaseConnection();
        return {
          valid: false,
          code: "REVOKED",
          error: `License is ${license.status}`,
          isBlocked: true,
        };
      }

      // Check expiry
      if (license.valid_until && new Date(license.valid_until) < new Date()) {
        await closeDatabaseConnection();
        return {
          valid: false,
          code: "EXPIRED",
          error: "License has expired",
          expiredAt: license.valid_until,
          isBlocked: true,
        };
      }

      // Check activation status
      const hardwareIdBuffer = Buffer.from(localData.device_fingerprint, "hex");
      const [activationRows] = await connection.execute(
        `SELECT * FROM activations WHERE license_id = ? AND hardware_id = ? AND is_active = true`,
        [license.id, hardwareIdBuffer]
      );

      await closeDatabaseConnection();

      if (activationRows.length === 0) {
        return {
          valid: false,
          code: "DEACTIVATED",
          error: "This device has been deactivated",
          isBlocked: true,
        };
      }

      // Online verification successful - update local data
      localData.last_verified = new Date().toISOString();
      localData.status = license.status;
      localData.valid_until = license.valid_until;
      localData.product_name = license.product_name;
      localData.user_name = license.user_name;
      await saveLicenseData(localData);
      licenseData = localData;

      onlineResult = { valid: true };
    } catch (error) {
      console.warn("Online verification failed:", error.message);
      isOffline = true;
      await closeDatabaseConnection();
    }

    // 5. Handle offline mode with grace period
    if (isOffline) {
      const gracePeriod = calculateGracePeriod(localData.last_verified);

      if (gracePeriod.isExpired) {
        return {
          valid: false,
          code: "OFFLINE_EXPIRED",
          error: `Offline grace period expired. Please connect to the internet to verify your license.`,
          isBlocked: true,
          isOffline: true,
        };
      }

      // Grace period active
      return {
        valid: true,
        code: "OFFLINE_GRACE",
        isOffline: true,
        gracePeriod: {
          daysRemaining: gracePeriod.daysRemaining,
          lastVerified: localData.last_verified,
        },
        license: getLicenseInfo(),
        warning: `Offline mode: ${gracePeriod.daysRemaining} days remaining to verify license`,
      };
    }

    // 6. Online verification successful
    return {
      valid: true,
      code: "VALID",
      license: getLicenseInfo(),
      lastVerified: localData.last_verified,
    };
  } catch (error) {
    console.error("License verification error:", error);

    // On unexpected error, check grace period
    const localData = licenseData || loadLicenseData();
    if (localData) {
      const gracePeriod = calculateGracePeriod(localData.last_verified);
      if (gracePeriod.inGracePeriod) {
        return {
          valid: true,
          code: "ERROR_GRACE",
          error: error.message,
          gracePeriod: {
            daysRemaining: gracePeriod.daysRemaining,
          },
          license: getLicenseInfo(),
        };
      }
    }

    return {
      valid: false,
      code: "ERROR",
      error: error.message,
      isBlocked: true,
    };
  }
}

/**
 * Deactivate license from current device
 */
export async function deactivateLicense() {
  try {
    const localData = loadLicenseData();

    if (!localData) {
      return { success: false, error: "No active license found" };
    }

    try {
      const connection = await connectToDatabase();

      const hardwareIdBuffer = Buffer.from(localData.device_fingerprint, "hex");
      await connection.execute(
        `UPDATE activations 
         SET is_active = false, deactivation_reason = 'Manual deactivation by user' 
         WHERE license_id = ? AND hardware_id = ? AND is_active = true`,
        [localData.id, hardwareIdBuffer]
      );

      await closeDatabaseConnection();
    } catch (error) {
      console.warn("Could not update server, proceeding with local deactivation:", error.message);
      await closeDatabaseConnection();
    }

    // Delete local data
    deleteLicenseData();

    return {
      success: true,
      message: "License deactivated successfully",
    };
  } catch (error) {
    console.error("Deactivation failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get current license info
 */
export function getLicenseInfo() {
  const data = licenseData || loadLicenseData();

  if (!data) {
    return null;
  }

  return {
    licenseKey: data.license_key,
    productName: data.product_name || LICENSE_CONFIG.appName,
    userName: data.user_name || "Unknown",
    status: data.status,
    validUntil: data.valid_until,
    activatedAt: data.activated_at,
    lastVerified: data.last_verified,
    maxActivations: data.max_activations,
  };
}

/**
 * Get license status summary
 */
export async function getLicenseStatus() {
  const data = licenseData || loadLicenseData();

  if (!data) {
    return {
      isActivated: false,
      requiresActivation: true,
    };
  }

  const gracePeriod = calculateGracePeriod(data.last_verified);

  return {
    isActivated: true,
    licenseInfo: getLicenseInfo(),
    gracePeriod: {
      daysRemaining: gracePeriod.daysRemaining,
      inGracePeriod: gracePeriod.inGracePeriod,
    },
    lastVerified: data.last_verified,
  };
}

/**
 * Check if license needs verification (more than 24h since last check)
 */
export function needsVerification() {
  const data = licenseData || loadLicenseData();

  if (!data || !data.last_verified) {
    return true;
  }

  const lastVerified = new Date(data.last_verified);
  const now = new Date();
  const timeSinceVerify = now - lastVerified;

  return timeSinceVerify > LICENSE_CONFIG.checkIntervalMs;
}
