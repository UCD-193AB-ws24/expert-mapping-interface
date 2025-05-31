/**
 * Returns the place_rank range for a given zoom level.
 */
export function getPlaceRankRange(zoomLevel) {
  if (zoomLevel >= 2 && zoomLevel <= 4) return [1, 6]; // Country level
  if (zoomLevel >= 5 && zoomLevel <= 7) return [7, 11]; // State level
  if (zoomLevel >= 8 && zoomLevel <= 10) return [12, 13]; // County level
  if (zoomLevel >= 11 && zoomLevel <= 13) return [14, 24]; // City level
  if (zoomLevel >= 14) return [25, 30]; // Exact level
  return [Infinity, Infinity];
}

/**
 * Filters a locationMap (Map of locationID -> locationObj) by zoomLevel.
 * Returns a new Map with only locations in the current place_rank range.
 */
export function filterLocationMapByZoom(locationMap, zoomLevel) {
  const [minRank, maxRank] = getPlaceRankRange(zoomLevel);
  const filtered = new Map();

  for (const [locID, loc] of locationMap.entries()) {
    const rank = Number(loc.place_rank);
    if (!isNaN(rank) && rank >= minRank && rank <= maxRank) {
      filtered.set(locID, loc);
    }
  }
  return filtered;
}