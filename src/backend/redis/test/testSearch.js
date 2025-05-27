const fetch = require('node-fetch');
const RAW_MAPS_API_URL = 'http://localhost:3001/api/redis/getRawMaps';

/**
 * Checks if the keyword matches any relevant field in the entry.
 * Adjust this logic as needed for your data structure.
 */
function matchesKeyword(keyword, entry) {
  if (!keyword || !entry) return false;
  const lowerKeyword = keyword.toLowerCase();

  // Search in title, abstract, authors, funder, etc.
  const fields = [
    entry.title, 
    entry.abstract, // For works
    entry.funder, // For grants
    ...(Array.isArray(entry.authors) ? entry.authors : []),
    ...(Array.isArray(entry.keywords) ? entry.keywords : []),
    entry.name, // For experts and locations

  ];

  return fields.some(
    field =>
      typeof field === 'string' && field.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Filters works, grants, and locations by a keyword using matchesKeyword logic.
 * @param {string} keyword
 * @param {Object|Map} worksMap
 * @param {Object|Map} grantsMap
 * @param {Object|Map} expertsMap
 * @param {Object|Map} locationMap
 * @returns {Object} { works: [...], grants: [...], locations: [...] }
 */
function filterAllMapsByKeyword(keyword, worksMap, grantsMap, expertsMap, locationMap) {
  // Helper to get values from Map or plain object
  const getValues = (map) =>
    map instanceof Map ? Array.from(map.values()) : Object.values(map);

  const filteredWorks = getValues(worksMap).filter(entry => matchesKeyword(keyword, entry));
  const filteredGrants = getValues(grantsMap).filter(entry => matchesKeyword(keyword, entry));
  const filteredExperts = getValues(expertsMap).filter(entry => matchesKeyword(keyword, entry));
  const filteredLocations = locationMap
    ? getValues(locationMap).filter(entry => matchesKeyword(keyword, entry))
    : [];

  return {
    works: filteredWorks,
    grants: filteredGrants,
    experts: filteredExperts,
    locations: filteredLocations,
  };
}

async function runSearch(keyword) {
  const response = await fetch(RAW_MAPS_API_URL);
  const data = await response.json();

  // If your maps are plain objects, you can pass them directly
  const { works, grants, experts, locations } = filterAllMapsByKeyword(
    keyword,
    data.worksMap,
    data.grantsMap,
    data.expertsMap || {}, // expertsMap may not be present, so default to empty object
    {} // or {} if not present
  );

  console.log(`Works matching "${keyword}":`, works.map(w => w.workID));
  console.log(`Grants matching "${keyword}":`, grants.map(g => g.grantID));
  console.log(`Experts matching "${keyword}":`, experts.map(e => e.id));
//   console.log(`Locations matching "${keyword}":`, locations.map(l => l.name || l.id));
}

runSearch('flower'); // Example keyword, replace with your search term