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
  workKeys = workKeys.filter(key => !key.includes(':metadata') && !key.includes(':entry:'));
  return workKeys;
}

/**
 * Fetch all grant keys from Redis, excluding metadata and entry keys.
 */
async function getGrantKeys(redisClient) {
  let grantKeys = await redisClient.keys('grant:*');
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
    if (!data || !data.id) continue;

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
        console.error(`Error parsing geometry for ${workKey}:`, e);
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
    }
    if (locationID === "location:55") {
      console.log("[DEBUG] Added Africa to locationMap (WORKS):", locationMap.get(locationID));
    }
      // Get all entry keys for this location
    const entryKeys = await getWorkEntryKeys(redisClient, workKey);

    for (const entryKey of entryKeys) {
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) continue;

      const confidenceNum = Number(entry.confidence);
      if (isNaN(confidenceNum) || confidenceNum <= 70) continue;

      // Correctly parsing authors 
      let authors = entry.authors;
      if (typeof authors === "string") {
        try {
          authors = JSON.parse(authors);
        } catch {
          // If not a valid JSON string, treat as single author string
          authors = [authors];
        }
      }
      if (!Array.isArray(authors)) {
        authors = ["Unknown Authors"];
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
        locationID,
        relatedExpertIDs: [],
      });

      // Add workID to locationMap
      const locEntry = locationMap.get(locationID);
      if (locEntry && !locEntry.workIDs.includes(workID)) {
        locEntry.workIDs.push(workID);
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
    if (finalLocationID === "location:55") {
    console.log("[DEBUG] Added Africa to locationMap (GRANTS):", locationMap.get(finalLocationID));
  }
    // Get all entry keys for this location
    const entryKeys = await getGrantEntryKeys(redisClient, grantKey);

    for (const entryKey of entryKeys) {
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) continue;

      const confidenceNum = Number(entry.confidence);
      if (isNaN(confidenceNum) || confidenceNum <= 70) continue;

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
        locationID,
        relatedExpertIDs: [],
      });

      // Add grantID to locationMap
      const locEntry = locationMap.get(locationID);
      if (locEntry && !locEntry.grantIDs.includes(grantID)) {
        locEntry.grantIDs.push(grantID);
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
                id: expertID,
                name: expert.fullName || expert.name || "Unknown",
                url: expert.url || "#",
                locationIDs: [locationID],
                workIDs: [],
                grantIDs: [grantID],
              });
            } else {
              const expertObj = expertsMap.get(expertID);
              if (!expertObj.locationIDs.includes(locationID)) expertObj.locationIDs.push(locationID);
              if (!expertObj.grantIDs.includes(grantID)) expertObj.grantIDs.push(grantID);
            }
            // Link expert to grant
            if (!grantsMap.get(grantID).relatedExpertIDs.includes(expertID)) {
              grantsMap.get(grantID).relatedExpertIDs.push(expertID);
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

  // Update overlapping status for each location
  for (const locEntry of locationMap.values()) {
    if (locEntry.workIDs.length > 0 && locEntry.grantIDs.length > 0) {
      locEntry.overlapping = "true";
    } else {
      locEntry.overlapping = "false";
    }
  }

  const africaEntry = locationMap.get("location:55");
  if (africaEntry) {
    console.log("[DEBUG] Africa entry before specificity maps & aggregating:", africaEntry);
  } else {
    console.log("[DEBUG] Africa (location:55) not found in locationMap before specificity maps!");
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
      const entry = locationMap.get(id);
      if (!entry) return;
      allWorkIDs.push(...entry.workIDs);
      allGrantIDs.push(...entry.grantIDs);
      allExpertIDs.push(...entry.expertIDs);
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
    console.log(`[AGGREGATION SKIP] Skipping aggregation for locationID ${locationID} (${locEntry.name}) with country="${locEntry.country}"`);
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

      // Debug: log if Africa is in this specificity map
      if (entries.some(([id]) => id === "location:55")) {
        console.log(`[DEBUG] Africa found in ${level}Map`);
      }
    }
    return result;
  }

  // Build specificity maps for each layer
  const workLayerSpecificityMaps = buildSpecificityMaps(workLayerMap);
  const grantLayerSpecificityMaps = buildSpecificityMaps(grantLayerMap);
  const combinedLayerSpecificityMaps = buildSpecificityMaps(combinedLayerMap);
  const overlapWorkLayerSpecificityMaps = buildSpecificityMaps(overlapWorkLayerMap);
  const overlapGrantLayerSpecificityMaps = buildSpecificityMaps(overlapGrantLayerMap);




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