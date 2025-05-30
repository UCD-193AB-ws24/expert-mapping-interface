import { getMatchedFields } from "./searchFilter";

const getPlaceRankLevel = (placeRank) => {
  if (placeRank >= 1 && placeRank <= 6) return "country";
  if (placeRank >= 7 && placeRank <= 11) return "state";
  if (placeRank >= 12 && placeRank <= 13) return "county";
  if (placeRank >= 14 && placeRank <= 24) return "city";
  if (placeRank >= 25 && placeRank <= 30) return "exact";
  return "unknown";
};

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
      let overlap = false;
      // Use the first feature (work or grant) to get geometry/properties for the location
      const sampleFeature =
        (type === "work" && locObj.worksFeatures?.[0]) ||
        (type === "grant" && locObj.grantsFeatures?.[0]) ||
        (type === "both" && (locObj.worksFeatures?.[0] || locObj.grantsFeatures?.[0]));

      if (!sampleFeature || !sampleFeature.properties) {
        console.warn(`[organizeAllMaps] No sample feature for location ${location} (index ${locIdx})`);
        return;
      }

      if (type === "both") {
        overlap = true;
      }

      const geometry = sampleFeature.geometry;
      const locationID = sampleFeature.id || `${location}_${locIdx}`;

      if (!locationMap.has(locationID)) {
        locationMap.set(locationID, {
          name: sampleFeature.name || "",
          id: locationID || "Unknown ID",
          location: sampleFeature.location || "",
          display_name: sampleFeature.display_name || "",
          country: sampleFeature.country || "",
          place_rank: sampleFeature.place_rank || "",
          geometryType: geometry.type || "",
          coordinates: geometry.coordinates || null,
          workIDs: [],
          grantIDs: [],
          expertIDs: [],
          specificity: getPlaceRankLevel(Number(sampleFeature.place_rank)) || "unknown",
          overlapping: overlap,
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
            const workID = `work_${entry.id}`;
            worksMap.set(workID, {
              workID: entry.id,
              title: entry.title || "Untitled Work",
              authors: authors,
              abstract: entry.abstract || "No Abstract",
              issued: entry.issued || "Unknown",
              confidence: entry.confidence || "Unknown",
              locationIDs: [],
              relatedExpertIDs: [],
              matchedFields: [], 
            });
            locationMap.get(locationID).workIDs.push(workID);

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
                    expertID: expert.expertId || expertID,
                    name: expertName || expert.name || "Unknown",
                    url: expert.url || "#",
                    locationIDs: [locationID],
                    workIDs: [workID],
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
          console.log(`✅ ${filteredEntries.length} matched entries for grant feature at locationID ${locationID}`);


          filteredEntries.forEach((entry) => {
            const matchedFields = entry._matchedFields || [];
            const grantID = `grant_${entry.id}`;
            grantsMap.set(grantID, {
              grantID: entry.id || 'Unknown grantID',
              title: entry.title || "Untitled Grant",
              funder: entry.funder || "Unknown",
              startDate: entry.startDate || "Unknown",
              endDate: entry.endDate || "Unknown",
              confidence: entry.confidence || "Unknown",
              locationID,
              relatedExpertIDs: [],
              matchedFields,
            });
            console.log(`✅ Matched grant: ${entry.title} at locationID ${locationID}`);
            console.log("📌 Updated location entry:", locationMap.get(locationID));


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
                    expertID: expert.expertId || 'Unknown ID',
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

    return { locationMap, worksMap, grantsMap, expertsMap };
  }

  return {
    combined: buildMaps(overlappingFeatures, "both", searchKeyword),
    works: buildMaps(workOnlyFeatures, "work", searchKeyword),
    grants: buildMaps(grantOnlyFeatures, "grant", searchKeyword),
  };
}