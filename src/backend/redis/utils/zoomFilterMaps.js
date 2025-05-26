import { buildRedisMaps } from './organizeRedisMaps.js';

// Assume locationMap is a Map of all locations, each with a 'specificity' field (country, state, county, city, exact)
function splitLocationMapByZoom(locationMap) {
  const zoomMaps = {
    1: new Map(), // country
    2: new Map(), // state
    3: new Map(), // county
    4: new Map(), // city
    5: new Map(), // exact
  };

  for (const [id, loc] of locationMap.entries()) {
    switch (loc.specificity) {
      case 'country':
        zoomMaps[1].set(id, loc);
        break;
      case 'state':
        zoomMaps[2].set(id, loc);
        break;
      case 'county':
        zoomMaps[3].set(id, loc);
        break;
      case 'city':
        zoomMaps[4].set(id, loc);
        break;
      case 'exact':
        zoomMaps[5].set(id, loc);
        break;
    }
  }
  return zoomMaps;
}