/**
 * License tier constants and limits
 * Defines what features are available in Free vs Licensed tiers
 */

// Free tier limitations
export const FREE_TIER_LIMITS = {
  // Object limits
  maxSatellites: 1,
  maxGroundStations: 1,
  maxTargetAreas: 0,
  
  // Feature restrictions
  features: {
    // Allowed in free tier
    basicTracking: true,
    globe2D: true,
    realTimePosition: true,
    
    // Restricted in free tier
    passAnalysis: false,
    kmlExport: false,
    simulationMode: false,
    tleHistory: false,
    payloads: false,
    borderSensors: false,
    multipleViews: false,
    dataExport: false,
    advancedSettings: false,
  },
  
  // UI restrictions
  ui: {
    showUpgradePrompts: true,
    watermark: true,
  }
};

// Licensed tier - full access
export const LICENSED_LIMITS = {
  // Object limits
  maxSatellites: Infinity,
  maxGroundStations: Infinity,
  maxTargetAreas: Infinity,
  
  // Feature restrictions
  features: {
    // All features enabled
    basicTracking: true,
    globe2D: true,
    realTimePosition: true,
    passAnalysis: true,
    kmlExport: true,
    simulationMode: true,
    tleHistory: true,
    payloads: true,
    borderSensors: true,
    multipleViews: true,
    dataExport: true,
    advancedSettings: true,
  },
  
  // UI restrictions
  ui: {
    showUpgradePrompts: false,
    watermark: false,
  }
};

// Feature descriptions for UI
export const FEATURE_DESCRIPTIONS = {
  basicTracking: 'Basic satellite position tracking',
  globe2D: '2D globe visualization',
  realTimePosition: 'Real-time position updates',
  passAnalysis: 'Satellite pass prediction and analysis',
  kmlExport: 'Export data to KML format',
  simulationMode: 'Time simulation controls',
  tleHistory: 'Historical TLE data access',
  payloads: 'Satellite payload management',
  borderSensors: 'Border sensor visualization',
  multipleViews: 'Multiple view windows',
  dataExport: 'Export tracking data',
  advancedSettings: 'Advanced configuration options',
};

// License request email template
export const LICENSE_REQUEST_EMAIL = {
  to: 'license@stk-satellite.com', // Replace with actual email
  subject: 'STK Satellite License Request',
};

// Get current tier limits based on license status
export const getTierLimits = (isLicensed) => {
  return isLicensed ? LICENSED_LIMITS : FREE_TIER_LIMITS;
};

// Check if a feature is available
export const isFeatureAvailable = (featureName, isLicensed) => {
  const limits = getTierLimits(isLicensed);
  return limits.features[featureName] ?? false;
};

// Check if can add more objects
export const canAddObject = (objectType, currentCount, isLicensed) => {
  const limits = getTierLimits(isLicensed);
  switch (objectType) {
    case 'satellite':
      return currentCount < limits.maxSatellites;
    case 'groundStation':
      return currentCount < limits.maxGroundStations;
    case 'targetArea':
      return currentCount < limits.maxTargetAreas;
    default:
      return false;
  }
};
