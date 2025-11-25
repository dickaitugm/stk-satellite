/**
 * Constants for STK Satellite Simulator
 */

// TLE Data untuk LAPAN-A2
export const LAPAN_A2_TLE = {
  name: 'LAPAN-A2',
  line1: '1 40931U 00000    25329.16366898  .00000000  00000-0 -12415-2 0    04',
  line2: '2 40931   5.9967 190.3873 0012662 345.8950  58.4170 14.79004108  3470'
};

// Layer options for base map
export const LAYER_OPTIONS = [
  { id: 'bmng', name: 'Blue Marble (NASA)', icon: '🌍' },
  { id: 'osm', name: 'OpenStreetMap', icon: '🗺️' }
];

// Globe/Map constants
export const EARTH_RADIUS_KM = 6371;
export const DEFAULT_RANGE_METERS = 23200000; // 23,200 km for full map view
export const STABILITY_THRESHOLD = 89; // degrees latitude for stable view
export const CALC_TARGET = 89; // target latitude for calculations

// Animation constants
export const BORDER_SENSOR_INTERVAL_MS = 100;
export const ORBIT_INTERVAL_MINUTES = 2;

// Mean motion for LAPAN-A2 (from TLE)
export const LAPAN_A2_MEAN_MOTION = 14.79004108; // rev/day
