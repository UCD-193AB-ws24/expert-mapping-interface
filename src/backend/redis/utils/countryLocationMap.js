/**
 * Build a country-level locationMap that aggregates all workIDs by country.
 * @param {object} redisClient - The Redis client instance.
 * @returns {Promise<Map>} countryLocationMap
 */
async function buildCountryLocationMap(redisClient) {
  const countryLocationMap = new Map();
  const workKeys = await redisClient.keys('work:*');
  const filteredWorkKeys = workKeys.filter(
    key => !key.includes(':entry:') && !key.includes(':metadata')
  );

  // First, collect country-level locations for coordinates
  const countryCoords = {};
  for (const workKey of filteredWorkKeys) {
    const data = await redisClient.hGetAll(workKey);
    if (!data || !data.country) continue;
    // If this location is a country (name === country), save its coordinates
    if (data.name && data.name === data.country) {
      let coordinates = data.coordinates;
      try { coordinates = JSON.parse(data.coordinates); } catch (e) {}
      countryCoords[data.country] = {
        coordinates: coordinates || null,
        geometryType: data.geometryType || "",
        display_name: data.display_name || data.country,
        place_rank: data.place_rank || "",
      };
    }
  }

  // Now, aggregate workIDs by country
  for (const workKey of filteredWorkKeys) {
    const data = await redisClient.hGetAll(workKey);
    if (!data || !data.country) continue;
    const country = data.country;

    // Get all entry keys for this location
    const entryKeys = await redisClient.keys(`${workKey}:entry:*`);
    for (const entryKey of entryKeys) {
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) continue;
      // Initialize country entry if not present
      if (!countryLocationMap.has(country)) {
        const coords = countryCoords[country] || {};
        countryLocationMap.set(country, {
          name: country,
          display_name: coords.display_name || country,
          country: country,
          place_rank: coords.place_rank || "",
          geometryType: coords.geometryType || "",
          coordinates: coords.coordinates || null,
          workIDs: [],
          grantIDs: [],
          expertIDs: [],
        });
      }
      // Add workID to the country's workIDs
      const countryEntry = countryLocationMap.get(country);
      if (!countryEntry.workIDs.includes(entry.id)) {
        countryEntry.workIDs.push(entry.id);
      }
    }
  }

  return countryLocationMap;
}

module.exports = { buildCountryLocationMap };