export function filterLocationMapByKeyword(locationMap, filteredExpertsMap, filteredWorksMap, filteredGrantsMap) {
  return Object.fromEntries(
    Object.entries(locationMap).map(([locID, loc]) => {
      // Filter IDs
      const filteredExpertIDs = (loc.expertIDs || []).filter(id => filteredExpertsMap[id]);
      const filteredWorkIDs = (loc.workIDs || []).filter(id => filteredWorksMap[id]);
      const filteredGrantIDs = (loc.grantIDs || []).filter(id => filteredGrantsMap[id]);
      return [locID, {
        ...loc,
        expertIDs: filteredExpertIDs,
        workIDs: filteredWorkIDs,
        grantIDs: filteredGrantIDs,
      }];
    })
    // Remove locations with no matching IDs (customize for your use case)
    .filter(([, loc]) =>
      (loc.workIDs && loc.workIDs.length) ||
      (loc.grantIDs && loc.grantIDs.length) ||
      (loc.expertIDs && loc.expertIDs.length)
    )
  );
}