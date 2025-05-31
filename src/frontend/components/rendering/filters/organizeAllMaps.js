import { getMatchedFields } from "./searchFilter";

function aggregateCountryLocations(locationMap, worksMap, grantsMap, expertsMap) {
  // 1. Find all country-level locations
  const countryLocIDs = {};
  for (const [locID, loc] of locationMap.entries()) {
    if (loc.name && loc.country && loc.name === loc.country) {
      countryLocIDs[loc.country] = locID;
    }
  }

  // 2. For each non-country location, aggregate its IDs to the country location
  for (const [locID, loc] of locationMap.entries()) {
    if (!loc.country) continue;
    const countryLocID = countryLocIDs[loc.country];
    if (!countryLocID || countryLocID === locID) continue; // skip if no country or already country-level

    const countryLoc = locationMap.get(countryLocID);

    // Aggregate workIDs
    for (const workID of loc.workIDs) {
      if (!countryLoc.workIDs.includes(workID)) countryLoc.workIDs.push(workID);
      // Also add the country locationID to the work's locationIDs
      const work = worksMap.get(workID);
      if (work && !work.locationIDs.includes(countryLocID)) {
        work.locationIDs.push(countryLocID);
      }
    }
    // Aggregate grantIDs
    for (const grantID of loc.grantIDs) {
      if (!countryLoc.grantIDs.includes(grantID)) countryLoc.grantIDs.push(grantID);
      const grant = grantsMap.get(grantID);
      if (grant && !grant.locationIDs.includes(countryLocID)) {
        grant.locationIDs.push(countryLocID);
      }
    }
    // Aggregate expertIDs
    for (const expertID of loc.expertIDs) {
      if (!countryLoc.expertIDs.includes(expertID)) countryLoc.expertIDs.push(expertID);
      const expert = expertsMap.get(expertID);
      if (expert && !expert.locationIDs.includes(countryLocID)) {
        expert.locationIDs.push(countryLocID);
      }
    }
  }
}

export function organizeAllMaps({
  overlappingFeatures, // [{ location, worksFeatures, grantsFeatures }]
  workOnlyFeatures,    // [{ location, worksFeatures }]
  grantOnlyFeatures,    // [{ location, grantsFeatures }]
  searchKeyword
}) {
  function buildMaps(features, type, searchKeyword) {
    const locationMap = new Map();
    const worksMap = new Map();
    const grantsMap = new Map();
    const expertsMap = new Map();

    (features || []).forEach((locObj, locIdx) => {
      const location = locObj.location || "Unknown";
      // Use the first feature (work or grant) to get geometry/properties for the location
      const sampleFeature =
        (type === "work" && locObj.worksFeatures?.[0]) ||
        (type === "grant" && locObj.grantsFeatures?.[0]) ||
        (type === "both" && (locObj.worksFeatures?.[0] || locObj.grantsFeatures?.[0]));

      if (!sampleFeature || !sampleFeature.properties) {
        console.warn(`[organizeAllMaps] No sample feature for location ${location} (index ${locIdx})`);
        return;
      }

      const geometry = sampleFeature.geometry;
      const locationID = sampleFeature.id || `${location}_${locIdx}`;

      if (!locationMap.has(locationID)) {
        locationMap.set(locationID, {
          name: location,
          display_name: sampleFeature.properties.display_name,
          country: sampleFeature.properties.country,
          place_rank: sampleFeature.properties.place_rank,
          geometryType: geometry?.type,
          coordinates: geometry?.coordinates,
          workIDs: [],
          grantIDs: [],
          expertIDs: [],
        });
      }

      // Handle works
      if ((type === "work" || type === "both") && Array.isArray(locObj.worksFeatures)) {
        locObj.worksFeatures.forEach((feature) => {
          const entries = feature.properties.entries || [];
          entries.forEach((entry) => {
            const matchedFields = getMatchedFields(searchKeyword, entry);
            if (searchKeyword && matchedFields.length === 0) {
              console.warn("Error with matched fields...");
              return;
            }
            const confidence = typeof entry.confidence === "string" ? Number(entry.confidence) : entry.confidence;
            if (confidence < 60) {
              console.warn(`Skipping low confidence entry: ${entry.title} (${entry.confidence})`);
              return;
            }
            const workID = `work_${entry.id}`;
            worksMap.set(workID, {
              workID: entry.id || 'Unknown workID',
              title: entry.title || "Untitled Work",
              abstract: entry.abstract || "No Abstract",
              issued: entry.issued || "Unknown",
              confidence: entry.confidence || "Unknown",
              locationIDs: [locationID],
              relatedExpertIDs: [],
              matchedFields,
            });
            locationMap.get(locationID).workIDs.push(workID);
            // console.log(`✅ Matched work: ${entry.title} at locationID ${locationID}`);
            // Handle experts (same as before)
            if (entry.relatedExperts) {
              entry.relatedExperts.forEach((expert) => {
                const expertName = expert.fullName;
                let expertID = Array.from(expertsMap.entries()).find(
                  ([, value]) => value.name === expertName
                )?.[0];

                if (!expertID) {
                  expertID = `expert_${expert.expertId}`;
                  expertsMap.set(expertID, {
                    id: expert.expertId || 'Unknown ID',
                    name: expertName || "Unknown",
                    url: expert.url || "#",
                    locationIDs: [],
                    workIDs: [],
                    grantIDs: [],
                  });
                }

                if (!worksMap.get(workID).relatedExpertIDs.includes(expertID)) {
                  worksMap.get(workID).relatedExpertIDs.push(expertID);
                }
                if (!expertsMap.get(expertID).workIDs.includes(workID)) {
                  expertsMap.get(expertID).workIDs.push(workID);
                }
                if (!expertsMap.get(expertID).locationIDs.includes(locationID)) {
                  expertsMap.get(expertID).locationIDs.push(locationID);
                }
                if (!locationMap.get(locationID).expertIDs.includes(expertID)) {
                  locationMap.get(locationID).expertIDs.push(expertID);
                }
              });
            }
          });
        });
      }

      // Handle grants
      if ((type === "grant" || type === "both") && Array.isArray(locObj.grantsFeatures)) {
        locObj.grantsFeatures.forEach((feature) => {

          const entries = feature.properties.entries || [];

          // Only use entries that actually matched the keyword
          const filteredEntries = entries.filter((entry) => {
            const matchedFields = getMatchedFields(searchKeyword, entry);
            entry._matchedFields = matchedFields; // store it temporarily for later use
            return !searchKeyword || matchedFields.length > 0;
          });

          if (filteredEntries.length === 0) return;
          // console.log(`✅ ${filteredEntries.length} matched entries for grant feature at locationID ${locationID}`);


          filteredEntries.forEach((entry) => {
            const confidence = typeof entry.confidence === "string" ? Number(entry.confidence) : entry.confidence;
            if (confidence < 60) {
              console.warn(`Skipping low confidence entry: ${entry.title} (${entry.confidence})`);
              return;
            }
            const matchedFields = entry._matchedFields || [];
            const grantID = `grant_${entry.id}`;
            grantsMap.set(grantID, {
              grantID: entry.id || 'Unknown grantID',
              title: entry.title || "Untitled Grant",
              funder: entry.funder || "Unknown",
              startDate: entry.startDate || "Unknown",
              endDate: entry.endDate || "Unknown",
              confidence: entry.confidence || "Unknown",
              locationIDs: [locationID],
              relatedExpertIDs: [],
              matchedFields,
            });
            // console.log(`✅ Matched grant: ${entry.title} at locationID ${locationID}`);
            // console.log("📌 Updated location entry:", locationMap.get(locationID));


            // locationMap.get(locationID).grantIDs.push(grantID);
            const locEntry = locationMap.get(locationID);
            if (!locEntry) {
              console.warn("Grant skipped: locationID not found in locationMap", locationID);
              return;
            }
            locEntry.grantIDs.push(grantID);


            if (entry.relatedExperts) {
              entry.relatedExperts.forEach((expert) => {
                const expertName = expert.fullName;
                let expertID = Array.from(expertsMap.entries()).find(
                  ([, value]) => value.name === expertName
                )?.[0];

                if (!expertID) {
                  expertID = `expert_${expert.expertId}`;
                  expertsMap.set(expertID, {
                    id: expert.expertId || 'Unknown ID',
                    name: expertName || "Unknown",
                    url: expert.url || "#",
                    locationIDs: [],
                    workIDs: [],
                    grantIDs: [],
                  });
                }

                if (!grantsMap.get(grantID).relatedExpertIDs.includes(expertID)) {
                  grantsMap.get(grantID).relatedExpertIDs.push(expertID);
                }
                if (!expertsMap.get(expertID).grantIDs.includes(grantID)) {
                  expertsMap.get(expertID).grantIDs.push(grantID);
                }
                if (!expertsMap.get(expertID).locationIDs.includes(locationID)) {
                  expertsMap.get(expertID).locationIDs.push(locationID);
                }
                if (!locationMap.get(locationID).expertIDs.includes(expertID)) {
                  locationMap.get(locationID).expertIDs.push(expertID);
                }
              });
            }
          });

        });
      }
    });
    aggregateCountryLocations(locationMap, worksMap, grantsMap, expertsMap);
  return {
      locationMap, 
      worksMap,
      grantsMap,
      expertsMap
    };
  }

  return {
    combined: buildMaps(overlappingFeatures, "both", searchKeyword),
    works: buildMaps(workOnlyFeatures, "work", searchKeyword),
    grants: buildMaps(grantOnlyFeatures, "grant", searchKeyword),
  };
}