/**
 * Satellite Constants
 * Shared constants for satellite configuration across components
 */

// Preset colors for satellites
export const PRESET_COLORS = [
  { name: "Cyan", r: 0, g: 1, b: 1 },
  { name: "Green", r: 0.2, g: 0.8, b: 0.2 },
  { name: "Yellow", r: 1, g: 0.9, b: 0.2 },
  { name: "Orange", r: 1, g: 0.5, b: 0 },
  { name: "Red", r: 1, g: 0.2, b: 0.2 },
  { name: "Purple", r: 0.7, g: 0.3, b: 0.9 },
  { name: "Blue", r: 0.2, g: 0.5, b: 1 },
  { name: "Pink", r: 1, g: 0.4, b: 0.7 },
  { name: "White", r: 1, g: 1, b: 1 },
];

// Axis options for object/payload orientation
export const AXIS_OPTIONS = [
  { id: "+x", name: "+X", description: "Positive X axis" },
  { id: "-x", name: "-X", description: "Negative X axis" },
  { id: "+y", name: "+Y", description: "Positive Y axis" },
  { id: "-y", name: "-Y", description: "Negative Y axis" },
  { id: "+z", name: "+Z (Nadir)", description: "Positive Z axis (Nadir)" },
  { id: "-z", name: "-Z (Zenith)", description: "Negative Z axis (Zenith)" },
];

// Orbit element source types - iconName will be resolved in components
export const ORBIT_SOURCE_TYPES = [
  {
    id: "tle-url",
    name: "TLE from URL",
    description: "Fetch TLE from online source",
    iconName: "Link",
  },
  {
    id: "tle-url-history",
    name: "TLE History URL",
    description: "URL with multiple TLE epochs",
    iconName: "FileText",
  },
  {
    id: "tle-manual",
    name: "Manual TLE",
    description: "Enter TLE lines manually",
    iconName: "FileText",
  },
  {
    id: "keplerian",
    name: "Keplerian Elements",
    description: "Enter orbital elements manually",
    iconName: "Globe",
  },
];

// Common TLE sources
export const TLE_SOURCES = [
  {
    id: "celestrak",
    name: "CelesTrak",
    urlTemplate: "https://celestrak.org/NORAD/elements/gp.php?NAME={SATELLITE_NAME}&FORMAT=TLE",
    description: "CelesTrak GP data",
  },
  {
    id: "celestrak-catnr",
    name: "CelesTrak (NORAD ID)",
    urlTemplate: "https://celestrak.org/NORAD/elements/gp.php?CATNR={NORAD_ID}&FORMAT=TLE",
    description: "CelesTrak by catalog number",
  },
  {
    id: "space-track",
    name: "Space-Track.org",
    urlTemplate: "https://www.space-track.org/basicspacedata/query/class/tle_latest/NORAD_CAT_ID/{NORAD_ID}/format/tle",
    description: "Space-Track API (requires auth)",
  },
  {
    id: "custom",
    name: "Custom URL",
    urlTemplate: "",
    description: "Enter custom URL",
  },
];

// Orbit presets for quick configuration
export const ORBIT_PRESETS = [
  {
    id: "custom",
    name: "Custom",
    description: "Define your own orbit",
    values: null,
  },
  {
    id: "leo-equatorial",
    name: "LEO Equatorial (600km)",
    description: "Low Earth Orbit, near equator",
    values: {
      semiMajorAxis: "6978.137",
      eccentricity: "0.001",
      inclination: "5",
      raan: "0",
      argOfPerigee: "0",
      meanAnomaly: "0",
    },
  },
  {
    id: "leo-polar",
    name: "LEO Polar (700km)",
    description: "Sun-synchronous polar orbit",
    values: {
      semiMajorAxis: "7078.137",
      eccentricity: "0.001",
      inclination: "98.2",
      raan: "0",
      argOfPerigee: "0",
      meanAnomaly: "0",
    },
  },
  {
    id: "iss",
    name: "ISS-like (400km)",
    description: "International Space Station orbit",
    values: {
      semiMajorAxis: "6778.137",
      eccentricity: "0.0001",
      inclination: "51.6",
      raan: "0",
      argOfPerigee: "0",
      meanAnomaly: "0",
    },
  },
  {
    id: "meo",
    name: "MEO (20,200km)",
    description: "GPS satellite orbit",
    values: {
      semiMajorAxis: "26578.137",
      eccentricity: "0.01",
      inclination: "55",
      raan: "0",
      argOfPerigee: "0",
      meanAnomaly: "0",
    },
  },
  {
    id: "geo",
    name: "GEO (35,786km)",
    description: "Geostationary orbit",
    values: {
      semiMajorAxis: "42164.137",
      eccentricity: "0.0001",
      inclination: "0",
      raan: "0",
      argOfPerigee: "0",
      meanAnomaly: "0",
    },
  },
];

// Camera types for payloads
export const CAMERA_TYPES = [
  { id: "rgb", name: "Digital RGB", description: "Standard RGB camera" },
  { id: "multispectral", name: "Multispectral", description: "Multi-band imaging" },
  { id: "sar", name: "SAR", description: "Synthetic Aperture Radar" },
];

// Payload types
export const PAYLOAD_TYPES = [
  { id: "camera", name: "Camera", description: "Imaging payload" },
  { id: "ais", name: "AIS Receiver", description: "Ship tracking" },
];

// Constants for orbital calculations
export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_MU = 398600.4418; // km³/s²

// Helper function to calculate Mean Motion from Semi-major Axis
export const calculateMeanMotion = (semiMajorAxisKm) => {
  const a = parseFloat(semiMajorAxisKm);
  if (isNaN(a) || a <= 0) return null;
  const nRadPerSec = Math.sqrt(EARTH_MU / Math.pow(a, 3));
  const nRevPerDay = (nRadPerSec * 86400) / (2 * Math.PI);
  return nRevPerDay;
};

// Helper function to calculate orbital period
export const calculateOrbitalPeriod = (semiMajorAxisKm) => {
  const n = calculateMeanMotion(semiMajorAxisKm);
  if (!n) return null;
  return (24 * 60) / n; // minutes
};

// Helper function to calculate altitude from semi-major axis
export const calculateAltitude = (semiMajorAxisKm) => {
  const a = parseFloat(semiMajorAxisKm);
  if (isNaN(a)) return null;
  return a - EARTH_RADIUS_KM;
};

// Helper function to calculate semi-major axis from altitude
export const calculateSemiMajorAxis = (altitudeKm) => {
  const alt = parseFloat(altitudeKm);
  if (isNaN(alt)) return null;
  return EARTH_RADIUS_KM + alt;
};

// Helper function to extract NORAD ID from TLE line 1
export const extractNoradId = (line1) => {
  if (!line1 || line1.length < 7) return "";
  return line1.substring(2, 7).trim();
};

// Convert Keplerian elements to TLE (simplified)
export const keplerianToTLE = (kep, name) => {
  const epochDate = new Date(kep.epoch);
  const year = epochDate.getFullYear() % 100;
  const startOfYear = new Date(epochDate.getFullYear(), 0, 1);
  const dayOfYear = (epochDate - startOfYear) / 86400000 + 1;

  const epochStr = `${year.toString().padStart(2, "0")}${dayOfYear.toFixed(8).padStart(12, "0")}`;

  const n = (Math.sqrt(EARTH_MU / Math.pow(kep.semiMajorAxis, 3)) * 86400) / (2 * Math.PI);

  const line1 = `1 99999U 00000A   ${epochStr}  .00000000  00000-0  00000-0 0    0`;
  const line2 = `2 99999 ${kep.inclination.toFixed(4).padStart(8)} ${kep.raan.toFixed(4).padStart(8)} ${(kep.eccentricity * 10000000).toFixed(0).padStart(7, "0")} ${kep.argOfPerigee.toFixed(4).padStart(8)} ${kep.meanAnomaly.toFixed(4).padStart(8)} ${n.toFixed(8).padStart(11)}    0`;

  return { line1, line2 };
};

// Default object/sensor configuration
export const createDefaultObject = (index = 1, presetColor = null) => ({
  id: `obj-${Date.now()}`,
  name: `Object ${index}`,
  type: "sensor",
  axis: "+z",
  // Scanning parameters
  scanWidth: 100,
  scanLength: 0,
  scanAngle: 0,
  // Field of view
  fovCrossTrack: 30,
  fovAlongTrack: 30,
  // Visual settings
  color: presetColor || PRESET_COLORS[0],
  isVisible: true,
  showSwath: true,
  showLabel: true,
  labelSize: 10,
  // Custom parameters
  customParams: {},
});

// Parse TLE epoch to Date
export const parseTleEpoch = (line1) => {
  if (!line1 || line1.length < 32) return null;
  
  const epochStr = line1.substring(18, 32).trim();
  const epochYear = parseInt(epochStr.substring(0, 2));
  const epochDayFull = parseFloat(epochStr.substring(2));
  const epochDayInt = Math.floor(epochDayFull);
  const epochDayFrac = epochDayFull - epochDayInt;
  const totalSecondsFloat = epochDayFrac * 86400;
  const hours = Math.floor(totalSecondsFloat / 3600);
  const minutes = Math.floor((totalSecondsFloat % 3600) / 60);
  const seconds = Math.floor(totalSecondsFloat % 60);
  const milliseconds = Math.round((totalSecondsFloat % 1) * 1000);
  const fullYear = epochYear > 56 ? 1900 + epochYear : 2000 + epochYear;
  
  return new Date(Date.UTC(fullYear, 0, epochDayInt, hours, minutes, seconds, milliseconds));
};

// Extract orbital elements from TLE
export const extractOrbitalElements = (line1, line2) => {
  // TLE lines are typically 69 chars but can vary slightly
  if (!line1 || !line2 || line1.length < 50 || line2.length < 50) return null;
  if (!line1.startsWith("1 ") || !line2.startsWith("2 ")) return null;

  try {
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const raan = parseFloat(line2.substring(17, 25).trim());
    const eccentricity = parseFloat("0." + line2.substring(26, 33).trim());
    const argOfPerigee = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim());
    const meanMotion = parseFloat(line2.substring(52, 63).trim());
    
    // Calculate semi-major axis from mean motion
    // n = sqrt(μ/a³) -> a = (μ/n²)^(1/3)
    const nRadPerSec = (meanMotion * 2 * Math.PI) / 86400;
    const semiMajorAxis = Math.pow(EARTH_MU / Math.pow(nRadPerSec, 2), 1/3);
    const altitude = semiMajorAxis - EARTH_RADIUS_KM;
    const period = (24 * 60) / meanMotion;

    return {
      inclination,
      raan,
      eccentricity,
      argOfPerigee,
      meanAnomaly,
      meanMotion,
      semiMajorAxis,
      altitude,
      period,
      epoch: parseTleEpoch(line1),
    };
  } catch (error) {
    console.error("Failed to extract orbital elements:", error);
    return null;
  }
};
