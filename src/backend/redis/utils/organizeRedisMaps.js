import { getPlaceRankLevel } from './redisFilters.js';

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
  let workKeys = await redisClient.keys('grant:*');
  workKeys = workKeys.filter(key => !key.includes(':metadata') && !key.includes(':entry:'));
  return workKeys;
}

/**
 * Fetch all entry keys for a given work location key.
 */
async function getWorkEntryKeys(redisClient, workKey) {
  return await redisClient.keys(`${workKey}:entry:*`);
}

/**
 * Fetch all entry keys for a given work location key.
 */
async function getGrantEntryKeys(redisClient, grantKey) {
  return await redisClient.keys(`${grantKey}:entry:*`);
}
/**
 * Build locationMap, worksMap, and expertsMap from Redis.
 */
async function buildRedisMaps(redisClient) {
  const locationMap = new Map();
  const worksMap = new Map();
  const grantsMap = new Map();
  const expertsMap = new Map();

  const workKeys = await getWorkKeys(redisClient);
  const grantKeys = await getGrantKeys(redisClient);

  for (const workKey of workKeys) {
    const data = await redisClient.hGetAll(workKey);
    if (!data || !data.id) continue;

    const locationID = data.id || workKey;
    let coordinates = data.coordinates;
    try { coordinates = JSON.parse(data.coordinates); } catch (e) {}

    // Initialize locationMap entry if not present
    if (!locationMap.has(locationID)) {
      locationMap.set(locationID, {
        name: data.name || "",
        id: locationID || "Unknown ID",
        display_name: data.display_name || "",
        country: data.country || "",
        place_rank: data.place_rank || "",
        geometryType: data.geometryType || "",
        coordinates: coordinates || null,
        workIDs: [],
        grantIDs: [],
        expertIDs: [],
        specificity: getPlaceRankLevel(data.place_rank) || "unknown",
        overlapping: "false",
      });
    }
    // Get all entry keys for this location
    const entryKeys = await getWorkEntryKeys(redisClient, workKey);

    for (const entryKey of entryKeys) {
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) continue;

      const workID = entry.id;
      // Add to worksMap
      worksMap.set(workID, {
        workID: entry.id,
        title: entry.title || "Untitled Work",
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
            const expertID = expert.expertId || expert.id || expert.name;
            if (!expertID) return;
            // Add/update expert in expertsMap
            if (!expertsMap.has(expertID)) {
              expertsMap.set(expertID, {
                id: expertID,
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

  for (const grantKey of grantKeys) {
    const data = await redisClient.hGetAll(grantKey);
    if (!data || !data.id) continue;
    const locationID = data.id || grantKey;
    let coordinates = data.coordinates;
    try { coordinates = JSON.parse(data.coordinates); } catch (e) {}

    // Check for overlapping locations
    let overlapping = "false";
    for (const loc of locationMap.values()) {
      if (loc.name && data.name && loc.name === data.name) {
        overlapping = "true";
        break;
      }
    }

    // Initialize locationMap entry if not present
    if (!locationMap.has(locationID)) {
      locationMap.set(locationID, {
        name: data.name || "",
        id: locationID || "Unknown ID",
        display_name: data.display_name || "",
        country: data.country || "",
        place_rank: data.place_rank || "",
        geometryType: data.geometryType || "",
        coordinates: coordinates || null,
        workIDs: [],
        grantIDs: [],
        expertIDs: [],
        specificity: getPlaceRankLevel(data.place_rank) || "unknown",
        overlapping,
      });
    }
    // Get all entry keys for this location
    const entryKeys = await getGrantEntryKeys(redisClient, grantKey);

    for (const entryKey of entryKeys) {
      const entry = await redisClient.hGetAll(entryKey);
      if (!entry || !entry.id) continue;

      const grantID = entry.id;
      // Add to grantsMap
      grantsMap.set(grantID, {
        grantID: entry.id,
        url: entry.url || '',
        title: entry.title || '',
        funder: entry.funder || '',
        endDate: entry.endDate || '',
        startDate: entry.startDate || '',
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
            const expertID = expert.expertId || expert.id || expert.name;
            if (!expertID) return;
            // Add/update expert in expertsMap
            if (!expertsMap.has(expertID)) {
              expertsMap.set(expertID, {
                id: expertID,
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
    // or: loc.overlapping === "true"
  );

  // Optionally, convert back to Map if needed:
  const workLayerMap = new Map(workLayerLocations.map(loc => [loc.id, loc]));
  const grantLayerMap = new Map(grantLayerLocations.map(loc => [loc.id, loc]));
  const combinedLayerMap = new Map(combinedLayerLocations.map(loc => [loc.id, loc]));

  // Return all maps for frontend use
  return {
    locationMap,
    worksMap,
    grantsMap,
    expertsMap,
    workLayerMap,
    grantLayerMap,
    combinedLayerMap
  };
}

module.exports = { getWorkKeys, buildRedisMaps };