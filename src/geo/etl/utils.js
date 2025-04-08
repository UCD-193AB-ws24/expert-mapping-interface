/**
 * utils.js
 * 
 * Purpose:
 * Shared utility functions for ETL process.
 * Provides helper functions for name normalization and data processing.
 * 
 * Usage:
 * const { storeComplexGeometry, normalizeLocation, processName } = require('./utils');
 * 
 * Functions:
 * - normalizeLocation: Standardizes location names
 * - processName: Formats researcher names
 * - Other utility functions for data processing
 */

function normalizeLocationName(location) {
  return location.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeResearcherName(name) {
  return name.trim()
    .split(',')
    .map(part => part.trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    )
    .join(', ');
}

function storeComplexGeometry(geometry) {
    if (geometry.type === 'Point') return geometry;
    
    return {
        type: geometry.type,
        coordinates: geometry.coordinates,
        bbox: turf.bbox(turf.feature(geometry))
    };
}

module.exports = {
  normalizeLocationName,
  normalizeResearcherName,
  storeComplexGeometry
}; 
