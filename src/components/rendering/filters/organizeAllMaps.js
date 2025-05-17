export function organizeAllMaps({
  overlappingFeatures, // [{ location, worksFeatures, grantsFeatures }]
  workOnlyFeatures,    // [{ location, worksFeatures }]
  grantOnlyFeatures    // [{ location, grantsFeatures }]
}) {
  function buildMaps(features, type) {
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
            const workID = `work_${entry.id}`;
            worksMap.set(workID, {
              workID: entry.id || 'Unknown workID',
              title: entry.title || "Untitled Work",
              abstract: entry.abstract || "No Abstract",
              issued: entry.issued || "Unknown",
              confidence: entry.confidence || "Unknown",
              locationID,
              relatedExpertIDs: [],
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
                  expertID = `expert_${expert.id}`;
                  expertsMap.set(expertID, {
                    id: expert.id || 'Unknown ID',
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
          entries.forEach((entry) => {
            const grantID = `grant_${entry.id}`;
            grantsMap.set(grantID, {
              grantID: entry.id || 'Unknown grantID',
              title: entry.title || "Untitled Grant",
              funder: entry.funder || "Unknown",
              startDate: entry.start_date || "Unknown",
              endDate: entry.end_date || "Unknown",
              confidence: entry.confidence || "Unknown",
              locationID,
              relatedExpertIDs: [],
            });
            locationMap.get(locationID).grantIDs.push(grantID);

            // Handle experts (same as before)
            if (entry.relatedExperts) {
              entry.relatedExperts.forEach((expert) => {
                const expertName = expert.fullName;
                let expertID = Array.from(expertsMap.entries()).find(
                  ([, value]) => value.name === expertName
                )?.[0];

                if (!expertID) {
                  expertID = `expert_${expert.id}`;
                  expertsMap.set(expertID, {
                    id: expert.id || 'Unknown ID',
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
    combined: buildMaps(overlappingFeatures, "both"),
    works: buildMaps(workOnlyFeatures, "work"),
    grants: buildMaps(grantOnlyFeatures, "grant"),
  };
}