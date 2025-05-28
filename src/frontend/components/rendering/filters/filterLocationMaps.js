export function filterWorkLayerLocationMap(locationMap, filteredWorksMap) {
  return Object.fromEntries(
    Object.entries(locationMap)
      .map(([locID, loc]) => {
        const filteredWorkIDs = (loc.workIDs || []).filter(id => filteredWorksMap[id]);
        return [locID, { ...loc, workIDs: filteredWorkIDs }];
      })
      .filter(([, loc]) => loc.workIDs && loc.workIDs.length)
  );
}

export function filterGrantLayerLocationMap(locationMap, filteredGrantsMap) {
  return Object.fromEntries(
    Object.entries(locationMap)
      .map(([locID, loc]) => {
        const filteredGrantIDs = (loc.grantIDs || []).filter(id => filteredGrantsMap[id]);
        return [locID, { ...loc, grantIDs: filteredGrantIDs }];
      })
      .filter(([, loc]) => loc.grantIDs && loc.grantIDs.length)
  );
}

export function filterLocationMap(locationMap, filteredWorksMap, filteredGrantsMap) {
   return Object.fromEntries(
    Object.entries(locationMap)
    .map(([locID, loc]) => {
      const filteredGrantIDs = (loc.grantIDs || []).filter(id => filteredGrantsMap[id]);
      const filteredWorkIDs = (loc.workIDs || []).filter(id => filteredWorksMap[id]);

      return [locID, { ...loc, workIDs: filteredWorkIDs, grantIDs: filteredGrantIDs }];
    })
      .filter(([, loc]) => (loc.workIDs && loc.workIDs.length) || (loc.grantIDs && loc.grantIDs.length))
  );
}