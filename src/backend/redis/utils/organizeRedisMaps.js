/**
 * organizeRedisMaps.js
 *
 * This module provides utilities for building and organizing Redis data structures
 * for the AggieExperts mapping interface. It is responsible for:
 *   - Fetching and filtering all works and grants from Redis, excluding metadata and entry keys.
 *   - Building main lookup maps (locationMap, worksMap, grantsMap, expertsMap) from Redis hashes.
 *   - Parsing and cleaning geometry, authors, and related experts for each entry.
 *   - Aggregating and linking works, grants, and experts to their respective locations.
 *   - Handling overlapping locations and aggregating country-level data.
 *   - Building layer-specific maps for frontend rendering (workLayer, grantLayer, combinedLayer, overlap layers).
 *   - Building specificity maps (country, state, county, city, exact) for each layer.
 *
 * Key Functions:
 *   - getWorkKeys(redisClient): Fetches all work keys from Redis, excluding metadata and entry keys.
 *   - getGrantKeys(redisClient): Fetches all grant keys from Redis, excluding metadata and entry keys.
 *   - getWorkEntryKeys(redisClient, workKey): Fetches all entry keys for a given work.
 *   - getGrantEntryKeys(redisClient, grantKey): Fetches all entry keys for a given grant.
 *   - buildRedisMaps(redisClient): Main function to build all lookup and layer maps from Redis data.
 *
 * Parameters:
 * @param {Object} redisClient - The Redis client instance used for database operations.
 * @param {String} workKey - The location keys for works in Redis.
 * @param {String} grantKey - The location keys for grants in Redis.
 * @param {Number} placeRank - The place rank of the location (1-30). Used to determine specificity. 
 * 
 * Data Structures Returned by buildRedisMaps:
 *   - locationMap: Map of locationID to location metadata and associated work/grant/expert IDs.
 *   - worksMap: Map of workID to work metadata.
 *   - grantsMap: Map of grantID to grant metadata.
 *   - expertsMap: Map of expertID to expert metadata.
 *   - workLayerMap, grantLayerMap, combinedLayerMap: Maps for non-overlap layers.
 *   - overlapWorkLayerMap, overlapGrantLayerMap: Maps for overlap layers.
 *   - workLayerSpecificityMaps, grantLayerSpecificityMaps, combinedLayerSpecificityMaps, overlapWorkLayerSpecificityMaps, overlapGrantLayerSpecificityMaps: 
 *     Objects containing specificity maps (country, state, county, city, exact) for each layer.
 *
 * Notes:
 *   - Only entries with confidence > 60 (works) or > 59 (grants) are included.
 *   - Handles missing or malformed data gracefully, logging warnings as needed.
 *   - Aggregates country-level data for locations with specificity "country".
 *   - Designed for efficient frontend queries and map rendering.
 *
 * Usage:
 *   const { buildRedisMaps } = require('./organizeRedisMaps');
 *   const maps = await buildRedisMaps(redisClient);
 *
 * Alyssa Vallejo, 2025
 */


const getPlaceRankLevel = (placeRank) => {
  if (placeRank >= 1 && placeRank <= 6) return "country";
  if (placeRank >= 7 && placeRank <= 11) return "state";
  if (placeRank >= 12 && placeRank <= 13) return "county";
  if (placeRank >= 14 && placeRank <= 24) return "city";
  if (placeRank >= 25 && placeRank <= 30) return "exact";
  return "unknown";
};

/**
 * Fetch all work keys from Redis, excluding metadata and entry keys.
 */
async function getWorkKeys(redisClient) {
  let workKeys = await redisClient.keys('work:*');
  if (!Array.isArray(workKeys)) workKeys = [];
  workKeys = workKeys.filter(key => !key.includes(':metadata') && !key.includes(':entry:'));     
  return workKeys;
}

/**
 * Fetch all grant keys from Redis, excluding metadata and entry keys.
 */
async function getGrantKeys(redisClient) {
  let grantKeys = await redisClient.keys('grant:*');
  if (!Array.isArray(grantKeys)) grantKeys = [];
  grantKeys = grantKeys.filter(key => !key.includes(':metadata') && !key.includes(':entry:'));     
  return grantKeys;
}

/**
 * Fetch all entry keys for a given work location key.
 */
async function getWorkEntryKeys(redisClient, workKey) {
  return await redisClient.keys(`${workKey}:entry:*`);
}

/**
 * Fetch all entry keys for a given grant location key.
 */
async function getGrantEntryKeys(redisClient, grantKey) {
  return await redisClient.keys(`${grantKey}:entry:*`);
}

/**
 * Build locationMap, worksMap, grantsMap, and expertsMap from Redis.
 */
async function buildRedisMaps(redisClient) {
  const locationMap = new Map();
  const worksMap = new Map();
  const grantsMap = new Map();
  const expertsMap = new Map();

  const workKeys = await getWorkKeys(redisClient);
  const grantKeys = await getGrantKeys(redisClient);

  // --- WORKS ---
  for (const workKey of workKeys) {
    const data = await redisClient.hGetAll(workKey);
    if (!data || !data.id) {
      console.log("[organizeRedisMaps] Skipping work with missing id:", workKey);
    continue;}

    // Extract the number from workKey (format: work:n)
    const match = workKey.match(/^work:(\d+)$/); // failsafe regex to match work keys
    const locationID = `location:${data.id}` || `location:${match[1]}`;
    
    let geometryType = "";
    let coordinates = null;

    if (data.geometry) {
      try {
        const geometryObj = typeof data.geometry === "string"
          ? JSON.parse(data.geometry)
          : data.geometry;
        geometryType = geometryObj?.type || "";
        coordinates = geometryObj?.coordinates || null;
      } catch (e) {
        console.log(`Error parsing geometry for ${workKey}:`, e);
      }
    }

    // Initialize locationMap entry if not present
    if (!locationMap.has(locationID)) {
      locationMap.set(locationID, {
        name: data.name || "",
        id: locationID || "Unknown ID",
        location: data.location || "",
        display_name: data.display_name || "",
        country: data.country || "",
        place_rank: data.place_rank || "",
        geometryType: geometryType || "",
        coordinates: coordinates || null,
        workIDs: [],
        grantIDs: [],
        expertIDs: [],
        specificity: getPlaceRankLevel(Number(data.place_rank)) || "unknown",
        overlapping: "false",
      });
      console.log(`[organizeRedisMaps] Initialized locationMap entry for ${locationID}`);
      console.log(locationMap.get(locationID));
    }
    
      // Get all entry keys for this location
    const entryKeys = await getWorkEntryKeys(redisClient, workKey);

    for (const entryKey of entryKeys) {
      console.log(`Processing entry key: ${entryKey}`);
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) {
        console.log(`[organizeRedisMaps] Skipping entry with missing id: ${entryKey}`);
        continue
      };

      const confidenceNum = Number(entry.confidence);
      if (isNaN(confidenceNum) || confidenceNum <= 60) continue;

      // Correctly parsing authors 
      let authors = entry.authors;
      if( !authors || authors === "[]" || authors === "null" || authors === "undefined") {
        console.log(`[organizeRedisMaps] No authors found for entry ${entry.id}, using default.`);
        authors = [];
      }
      if (typeof authors === "string") {
        try {
          authors = JSON.parse(authors);
          console.log(`[organizeRedisMaps] Parsed authors for entry ${entry.id}:`, authors);
        } catch {
          // If not a valid JSON string, treat as single author string
          authors = [authors];
          console.log(`[organizeRedisMaps] Using single author string for entry ${entry.id}:`, authors);
        }
      }
      if (!Array.isArray(authors)) {
        authors = ["Unknown Authors"];
        console.log(`[organizeRedisMaps] Authors for entry ${entry.id} is not an array, using default.`);
      }

      const workID = `work:${entry.id}` || workKey;
      // Add to worksMap
      worksMap.set(workID, {
        workID: entry.id,
        title: entry.title || "Untitled Work",
        authors: authors,
        abstract: entry.abstract || "No Abstract",
        issued: entry.issued || "Unknown",
        confidence: entry.confidence || "Unknown",
        locationIDs: [locationID],
        relatedExpertIDs: [],
        matchedFields: [], 
      });
      const workEntry = worksMap.get(workID);
      if (workEntry && !workEntry.locationIDs.includes(locationID)) {
        console.log(`[organizeRedisMaps] Adding locationID ${locationID} to work ${workID}`);
        workEntry.locationIDs = [locationID];
      }
      console.log(`[organizeRedisMaps] Adding work ${workID} to worksMap with locationID ${locationID}`);
      // Add workID to locationMap
      const locEntry = locationMap.get(locationID);
      if (locEntry && !locEntry.workIDs.includes(workID)) {
        locEntry.workIDs.push(workID);
        console.log(`[organizeRedisMaps] Added workID ${workID} to location ${locationID}`);
      }

      // Handle related experts
      if (entry.relatedExperts) {
        let relatedExperts;
        try {
          relatedExperts = typeof entry.relatedExperts === "string"
            ? JSON.parse(entry.relatedExperts)
            : entry.relatedExperts;
        } catch (e) {
          relatedExperts = [];
        }
        if (Array.isArray(relatedExperts)) {
          relatedExperts.forEach((expert) => {
            const expertID = `expert:${expert.expertId}` || `expert:${expert.name}`;
            if (!expertID) return;
            // Add/update expert in expertsMap
            if (!expertsMap.has(expertID)) {
              expertsMap.set(expertID, {
                expertID: expert.expertId || expertID,
                name: expert.fullName || expert.name || "Unknown",
                url: expert.url || "#",
                locationIDs: [locationID],
                workIDs: [workID],
                grantIDs: [],
              });
            } else {
              const expertObj = expertsMap.get(expertID);
              if (!expertObj.locationIDs.includes(locationID)) expertObj.locationIDs.push(locationID);
              if (!expertObj.workIDs.includes(workID)) expertObj.workIDs.push(workID);
            }
            // Link expert to work
            if (!worksMap.get(workID).relatedExpertIDs.includes(expertID)) {
              worksMap.get(workID).relatedExpertIDs.push(expertID);
            }
            // Link expert to location
            if (!locEntry.expertIDs.includes(expertID)) {
              locEntry.expertIDs.push(expertID);
            }
          });
        }
      }
    }
  }

  // --- GRANTS ---
  for (const grantKey of grantKeys) {
    const data = await redisClient.hGetAll(grantKey);
    if (!data || !data.id) continue;
    const locationID = `location:${data.id}` || grantKey;
    let geometryType = "";
    let coordinates = null;

    if (data.geometry) {
      try {
        const geometryObj = typeof data.geometry === "string"
          ? JSON.parse(data.geometry)
          : data.geometry;
        geometryType = geometryObj?.type || "";
        coordinates = geometryObj?.coordinates || null;
      } catch (e) {
        console.error(`Error parsing geometry for ${grantKey}:`, e);
      }
    }

    // Check for overlapping locations
    let overlapping = "false";
    for (const loc of locationMap.values()) {
      if (loc.name && data.name && loc.name === data.name) {
        overlapping = "true";
        break;
      }
    }

    // Check for duplicate locations by location name
    let existingLocationID = null;
    for (const [locID, locEntry] of locationMap.entries()) {
      if (locEntry.location === data.location) {
      existingLocationID = locID;
      console.log(`Found existing location for ${data.location}: ${locID}`);
      break;
      }
    }

    // Use existing locationID if found, otherwise use the new one
    const finalLocationID = existingLocationID || locationID;

    // Initialize locationMap entry if not present
    if (!locationMap.has(finalLocationID)) {
      locationMap.set(finalLocationID, {
      name: data.name || "",
      id: finalLocationID || "Unknown ID",
      display_name: data.display_name || "",
      country: data.country || "",
      place_rank: data.place_rank || "",
      geometryType: geometryType || "",
      coordinates: coordinates || null,
      workIDs: [],
      grantIDs: [],
      expertIDs: [],
      specificity: getPlaceRankLevel(Number(data.place_rank)) || "unknown",
      overlapping,
      });
    }

    // Get all entry keys for this location
    const entryKeys = await getGrantEntryKeys(redisClient, grantKey);

    for (const entryKey of entryKeys) {
      // console.log(`Processing entry key: ${entryKey}`);
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) continue;

      const confidenceNum = Number(entry.confidence);
      if (isNaN(confidenceNum) || confidenceNum <= 59) 
        {// console.warn(`Skipping entry with low confidence: ${entry.id} confidence=${entry.confidence}, place_rank=${data.place_rank}`);
          continue;}

      const grantID = `grant:${entry.id}` || grantKey;
      // Add to grantsMap
      grantsMap.set(grantID, {
        grantID: entry.id || grantKey,
        name: entry.name || "Untitled Grant",
        title: entry.title || '',
        funder: entry.funder || '',
        endDate: entry.endDate || '',
        startDate: entry.startDate || '',
        confidence: entry.confidence || "Unknown",
        locationIDs: [finalLocationID],
        relatedExpertIDs: [],
        matchedFields: [],
      });
      // console.log(`Adding grant ${grantID} to grantsMap with locationID ${finalLocationID}`);
      // Add grantID to locationMap
      const currLoc = locationMap.get(finalLocationID);
      // Handle related experts
      if (entry.relatedExperts) {
        let relatedExperts;
        try {
          relatedExperts = typeof entry.relatedExperts === "string"
            ? JSON.parse(entry.relatedExperts)
            : entry.relatedExperts;
        } catch (e) {
          relatedExperts = [];
        }
        if (Array.isArray(relatedExperts)) {
          relatedExperts.forEach((expert) => {
            const expertID = `expert:${expert.expertId}` || `expert:${expert.name}`;
            if (!expertID) return;
            // Add/update expert in expertsMap
            if (!expertsMap.has(expertID)) {
              expertsMap.set(expertID, {
                id: expert.expertId || expertID,
                name: expert.fullName || expert.name || "Unknown",
                url: expert.url || "#",
                locationIDs: [finalLocationID],
                workIDs: [],
                grantIDs: [grantID],
              });
            } else {
              const expertObj = expertsMap.get(expertID);
              if (!expertObj.locationIDs.includes(finalLocationID)) 
              {
                // console.log(`Adding locationID ${finalLocationID} to expert ${expertID}`);
                expertObj.locationIDs.push(finalLocationID);
              }
              if (!expertObj.grantIDs.includes(grantID))
              {
                // console.log(`Adding grantID ${grantID} to expert ${expertID}`);
                expertObj.grantIDs.push(grantID);
              }
            }
            // Link expert to grant
            if (!grantsMap.get(grantID).relatedExpertIDs.includes(expertID)) {
              // console.log(`Linking expert ${expertID} to grant ${grantID}`);
              grantsMap.get(grantID).relatedExpertIDs.push(expertID);
            }
            // Link expert to location
            if (!currLoc.expertIDs.includes(expertID)) {
              // console.log(`Linking expert ${expertID} to location ${finalLocationID}`);
              currLoc.expertIDs.push(expertID);
            }
            if (!currLoc.grantIDs.includes(grantID)) {
              // console.log(`Linking grant ${grantID} to location ${finalLocationID}`);
              currLoc.grantIDs.push(grantID);
            }
            
          });
        }
      }
    }
  }


  // Update overlapping status for each location
  for (const locEntry of locationMap.values()) {
    if (locEntry.workIDs.length > 0 && locEntry.grantIDs.length > 0) {
      locEntry.overlapping = "true";
    } else {
      locEntry.overlapping = "false";
    }
  }

  

  // Build country to locationIDs map
  // Use country if present, otherwise use name (for continents/regions)
  const countryToLocationIDs = new Map();
  for (const [locationID, locEntry] of locationMap.entries()) {
    const country = locEntry.country;
    if (!country) continue;
    if (!countryToLocationIDs.has(country)) countryToLocationIDs.set(country, []);
    countryToLocationIDs.get(country).push(locationID);
  }
  
  // Aggregate for country-level locations
  for (const [locationID, locEntry] of locationMap.entries()) {
  if (locEntry.specificity === "country" && locEntry.country && 
    locEntry.country !== "None") {
    const countryOrRegion = locEntry.country || locEntry.name;
    const allLocIDs = countryToLocationIDs.get(countryOrRegion) || [];
    const allWorkIDs = [];
    const allGrantIDs = [];
    const allExpertIDs = [];

    allLocIDs.forEach(id => {
      const entry = locationMap.get ? locationMap.get(id) : locationMap[id];
      if (!entry) {
        console.warn(`[organizeRedisMaps] Skipping missing location entry for id: ${id}`);
        return;
      }
      allWorkIDs.push(...(entry.workIDs || []));
      allGrantIDs.push(...(entry.grantIDs || []));
      allExpertIDs.push(...(entry.expertIDs || []));
    });

    locEntry.workIDs = [...new Set(allWorkIDs)];
    locEntry.grantIDs = [...new Set(allGrantIDs)];
    locEntry.expertIDs = [...new Set(allExpertIDs)];

    // Add country locationID to each work, grant, and expert
    for (const workID of locEntry.workIDs) {
      const work = worksMap.get(workID);
      if (work && Array.isArray(work.locationIDs) && !work.locationIDs.includes(locationID)) {
        work.locationIDs.push(locationID);
      } else if (work && !work.locationIDs) {
        work.locationIDs = [locationID];
      }
    }
    for (const grantID of locEntry.grantIDs) {
      const grant = grantsMap.get(grantID);
      if (grant && Array.isArray(grant.locationIDs) && !grant.locationIDs.includes(locationID)) {
        grant.locationIDs.push(locationID);
      } else if (grant && !grant.locationIDs) {
        grant.locationIDs = [locationID];
      }
    }
    for (const expertID of locEntry.expertIDs) {
      const expert = expertsMap.get(expertID);
      if (expert && Array.isArray(expert.locationIDs) && !expert.locationIDs.includes(locationID)) {
        expert.locationIDs.push(locationID);
      } else if (expert && !expert.locationIDs) {
        expert.locationIDs = [locationID];
      }
    }

    // Recalculate overlapping after aggregation
    locEntry.overlapping =
      locEntry.workIDs.length > 0 && locEntry.grantIDs.length > 0
        ? "true"
        : "false";
  }
  else if (
    locEntry.specificity === "country" &&
    (!locEntry.country || locEntry.country === "None")
  ) {
    //console.log(`[AGGREGATION SKIP] Skipping aggregation for locationID ${locationID} (${locEntry.name}) with country="${locEntry.country}"`);
  }
}

  // Convert locationMap to array for filtering
  const locationsArray = Array.from(locationMap.values());

  // Work Layer: Only locations with works and no grants
  const workLayerLocations = locationsArray.filter(
    loc => loc.workIDs.length > 0 && loc.grantIDs.length === 0
  );

  // Grant Layer: Only locations with grants and no works
  const grantLayerLocations = locationsArray.filter(
    loc => loc.grantIDs.length > 0 && loc.workIDs.length === 0
  );

  // Combined Layer: Only overlapping locations
  const combinedLayerLocations = locationsArray.filter(
    loc => loc.workIDs.length > 0 && loc.grantIDs.length > 0
  );

  // Overlap Work Layer: all locations with works (including overlaps)
  const overlapWorkLayerLocations = locationsArray.filter(
    loc => loc.workIDs.length > 0
  );

  // Overlap Grant Layer: all locations with grants (including overlaps)
  const overlapGrantLayerLocations = locationsArray.filter(
    loc => loc.grantIDs.length > 0
  );

  // Optionally, convert back to Map if needed:
  const workLayerMap = new Map(workLayerLocations.map(loc => [loc.id, loc]));
  const grantLayerMap = new Map(grantLayerLocations.map(loc => [loc.id, loc]));
  const combinedLayerMap = new Map(combinedLayerLocations.map(loc => [loc.id, loc]));
  const overlapWorkLayerMap = new Map(overlapWorkLayerLocations.map(loc => [loc.id, loc]));
  const overlapGrantLayerMap = new Map(overlapGrantLayerLocations.map(loc => [loc.id, loc]));
  console.log(`Work Layer Locations: ${workLayerLocations.length}`);
  console.log(`Grant Layer Locations: ${grantLayerLocations.length}`);
  console.log(`Combined Layer Locations: ${combinedLayerLocations.length}`);
  console.log(`Overlap Work Layer Locations: ${overlapWorkLayerLocations.length}`);
  console.log(`Overlap Grant Layer Locations: ${overlapGrantLayerLocations.length}`);

  /**
   * Helper to build specificity maps for a given location map.
   * Returns an object with keys: country, state, county, city, exact.
   */
  function buildSpecificityMaps(locationMap) {
    const specificityLevels = ["country", "state", "county", "city", "exact"];
    const result = {};
    for (const level of specificityLevels) {
      const entries = Array.from(locationMap.entries()).filter(
        ([, locEntry]) => locEntry.specificity === level
      );
      result[`${level}Map`] = new Map(entries);
    }
    return result;
  }

  // Build specificity maps for each layer
  const workLayerSpecificityMaps = buildSpecificityMaps(workLayerMap);
  const grantLayerSpecificityMaps = buildSpecificityMaps(grantLayerMap);
  const combinedLayerSpecificityMaps = buildSpecificityMaps(combinedLayerMap);
  const overlapWorkLayerSpecificityMaps = buildSpecificityMaps(overlapWorkLayerMap);
  const overlapGrantLayerSpecificityMaps = buildSpecificityMaps(overlapGrantLayerMap);

  // Log the length of every map in overlapGrantLayerSpecificityMaps
  // for (const [key, map] of Object.entries(overlapGrantLayerSpecificityMaps)) {
  //   console.log(`overlapGrantLayerSpecificityMaps.${key}:`);
  //   for (const [locID, locEntry] of map.entries()) {
  //     console.log(`${locID}:`, locEntry);
  //   }
  // }




  // Return all maps for frontend use
  return {
    locationMap,
    worksMap,
    grantsMap,
    expertsMap,
    workLayerMap,
    grantLayerMap,
    combinedLayerMap,
    overlapWorkLayerMap,
    overlapGrantLayerMap,
    workLayerSpecificityMaps,
    grantLayerSpecificityMaps,
    combinedLayerSpecificityMaps,
    overlapWorkLayerSpecificityMaps,
    overlapGrantLayerSpecificityMaps,
  };
}

module.exports = { getWorkKeys, buildRedisMaps };