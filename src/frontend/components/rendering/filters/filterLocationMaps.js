export function filterLocationMapByKeyword(locationMap, filteredExpertsMap, filteredWorksMap, filteredGrantsMap) {
  return Object.fromEntries(
    Object.entries(locationMap)
      .map(([locID, loc]) => {
        // Filter IDs
        const filteredExpertIDs = (loc.expertIDs || []).filter(id => filteredExpertsMap[id]);
        const filteredWorkIDs = (loc.workIDs || []).filter(id => filteredWorksMap[id]);
        const filteredGrantIDs = (loc.grantIDs || []).filter(id => filteredGrantsMap[id]);
        if(locID === "location:22") {
          // Skip the "all" location
          console.log(locID, loc, filteredExpertIDs, filteredWorkIDs, filteredGrantIDs);
        }
        return [locID, {
          ...loc,
          expertIDs: filteredExpertIDs,
          workIDs: filteredWorkIDs,
          grantIDs: filteredGrantIDs,
        }];
      })
      // Only keep locations that have at least one work or grant
      .filter(([, loc]) =>
        (loc.workIDs && loc.workIDs.length) ||
        (loc.grantIDs && loc.grantIDs.length)
      )
  );
}