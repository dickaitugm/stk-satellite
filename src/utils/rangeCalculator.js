/**
 * Range calculation utilities for WorldWind 2D view
 */

import { DEFAULT_RANGE_METERS } from './constants';

/**
 * Menghitung range yang diperlukan untuk menampilkan full map (-90 to 90 latitude)
 * pada proyeksi Equirectangular berdasarkan tinggi canvas.
 * 
 * Untuk WorldWind 2D Equirectangular, range ~23,200 km untuk full map.
 * 
 * @param {number} canvasHeight - Height of the canvas in pixels
 * @returns {number} Optimal range in meters
 */
export const calculateOptimalRange = (canvasHeight) => {
  if (canvasHeight <= 0) return DEFAULT_RANGE_METERS;
  
  // Berdasarkan testing empiris, full map tercapai pada ~23,200 km
  return DEFAULT_RANGE_METERS;
};
