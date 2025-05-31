/**
 * @file filterLocationMaps.js
 * @description
 * Utility functions for filtering location maps based on filtered works and grants.
 * 
 * These functions take a locationMap (object mapping location IDs to location objects)
 * and filtered works/grants maps, and return new location maps containing only the
 * works and/or grants that are present in the filtered maps.
 * 
 * - filterWorkLayerLocationMap: Filters each location's workIDs to only those present in filteredWorksMap.
 * - filterGrantLayerLocationMap: Filters each location's grantIDs to only those present in filteredGrantsMap.
 * - filterLocationMap: Filters both workIDs and grantIDs for each location, keeping only locations with at least one work or grant.
 * 
 * This helps ensure that only relevant works and grants are shown on the map after applying filters.
 * 
 * Alyssa Vallejo, 2025
 */


export function filterWorkLayerLocationMap(locationMap, filteredWorksMap) {
  return Object.fromEntries(
    Object.entries(locationMap)
      .map(([locID, loc]) => {
        if (!loc) return null; // Skip undefined locations
        const filteredWorkIDs = (loc.workIDs || []).filter(id => filteredWorksMap && filteredWorksMap[id]);
        return [locID, { ...loc, workIDs: filteredWorkIDs }];
      })
      .filter(entry => entry && entry[1].workIDs && entry[1].workIDs.length)
  );
}

export function filterGrantLayerLocationMap(locationMap, filteredGrantsMap) {
  return Object.fromEntries(
    Object.entries(locationMap)
      .map(([locID, loc]) => {
        if (!loc) return null;
        const filteredGrantIDs = (loc.grantIDs || []).filter(id => filteredGrantsMap && filteredGrantsMap[id]);
        return [locID, { ...loc, grantIDs: filteredGrantIDs }];
      })
      .filter(entry => entry && entry[1].grantIDs && entry[1].grantIDs.length)
  );
}

export function filterLocationMap(locationMap, filteredWorksMap, filteredGrantsMap) {
  return Object.fromEntries(
    Object.entries(locationMap)
      .map(([locID, loc]) => {
        if (!loc) return null; // Skip undefined locations
        const filteredGrantIDs = (loc.grantIDs || []).filter(
          id => filteredGrantsMap && filteredGrantsMap[id]
        );
        const filteredWorkIDs = (loc.workIDs || []).filter(
          id => filteredWorksMap && filteredWorksMap[id]
        );
        return [locID, { ...loc, workIDs: filteredWorkIDs, grantIDs: filteredGrantIDs }];
      })
      .filter(
        entry =>
          entry &&
          ((entry[1].workIDs && entry[1].workIDs.length) ||
            (entry[1].grantIDs && entry[1].grantIDs.length))
      )
  );
}