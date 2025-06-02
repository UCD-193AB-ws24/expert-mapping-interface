import {
  filterWorkLayerLocationMap,
  filterGrantLayerLocationMap,
  filterLocationMap,
} from "../filterLocationMaps";

describe("filterLocationMaps utility functions", () => {
  const locationMap = {
    loc1: { workIDs: ["w1", "w2"], grantIDs: ["g1"], name: "A" },
    loc2: { workIDs: ["w3"], grantIDs: ["g2", "g3"], name: "B" },
    loc3: { workIDs: [], grantIDs: [], name: "C" },
  };

  const filteredWorksMap = { w1: {}, w3: {} };
  const filteredGrantsMap = { g2: {}, g3: {} };

  test("filterWorkLayerLocationMap filters workIDs correctly", () => {
    const result = filterWorkLayerLocationMap(locationMap, filteredWorksMap);
    expect(result).toEqual({
      loc1: { ...locationMap.loc1, workIDs: ["w1"] },
      loc2: { ...locationMap.loc2, workIDs: ["w3"] },
    });
    expect(result.loc1.workIDs).not.toContain("w2");
  });

  test("filterGrantLayerLocationMap filters grantIDs correctly", () => {
    const result = filterGrantLayerLocationMap(locationMap, filteredGrantsMap);
    expect(result).toEqual({
      loc2: { ...locationMap.loc2, grantIDs: ["g2", "g3"] },
    });
    expect(result.loc1).toBeUndefined();
  });

  test("filterLocationMap filters both workIDs and grantIDs, keeps only locations with at least one", () => {
    const result = filterLocationMap(locationMap, filteredWorksMap, filteredGrantsMap);
    expect(result).toEqual({
      loc1: { ...locationMap.loc1, workIDs: ["w1"], grantIDs: [] },
      loc2: { ...locationMap.loc2, workIDs: ["w3"], grantIDs: ["g2", "g3"] },
    });
    expect(result.loc3).toBeUndefined();
  });

  test("filterWorkLayerLocationMap returns empty object if no workIDs match", () => {
    const emptyWorksMap = {};
    const result = filterWorkLayerLocationMap(locationMap, emptyWorksMap);
    expect(result).toEqual({});
  });

  test("filterGrantLayerLocationMap returns empty object if no grantIDs match", () => {
    const emptyGrantsMap = {};
    const result = filterGrantLayerLocationMap(locationMap, emptyGrantsMap);
    expect(result).toEqual({});
  });
  test("handles locations with undefined workIDs and grantIDs", () => {
    const mapWithMissingArrays = {
      loc1: { name: "A" },
      loc2: { workIDs: ["w1"], name: "B" },
    };
    const worksMap = { w1: {} };
    const grantsMap = {};

    expect(filterWorkLayerLocationMap(mapWithMissingArrays, worksMap)).toEqual({
      loc2: { ...mapWithMissingArrays.loc2, workIDs: ["w1"] },
    });
    expect(filterGrantLayerLocationMap(mapWithMissingArrays, grantsMap)).toEqual({});
  });
  test("returns empty object when all locations are filtered out", () => {
    const worksMap = { w999: {} }; // No matching IDs
    const grantsMap = { g999: {} };
    expect(filterLocationMap(locationMap, worksMap, grantsMap)).toEqual({});
  });
  test("keeps location if at least one workID or grantID matches", () => {
    const worksMap = { w1: {} };
    const grantsMap = {};
    const result = filterLocationMap(locationMap, worksMap, grantsMap);
    expect(result).toEqual({
      loc1: { ...locationMap.loc1, workIDs: ["w1"], grantIDs: [] },
    });
  });
  test("returns empty object if locationMap is empty", () => {
    expect(filterLocationMap({}, filteredWorksMap, filteredGrantsMap)).toEqual({});
  });

  test("handles location with undefined workIDs and grantIDs", () => {
    const map = { loc1: { name: "A" } };
    expect(filterWorkLayerLocationMap(map, {})).toEqual({});
    expect(filterGrantLayerLocationMap(map, {})).toEqual({});
  });

  test("returns empty object if locationMap is empty", () => {
    expect(filterLocationMap({}, { w1: {} }, { g1: {} })).toEqual({});
  });

  test("filters out locations with no matching IDs", () => {
    const map = { loc1: { workIDs: ["w1"], grantIDs: ["g1"] } };
    expect(filterLocationMap(map, {}, {})).toEqual({});
  });
  test("filterGrantLayerLocationMap handles location with only grantIDs", () => {
    const map = { loc1: { grantIDs: ["g2", "g3"], name: "A" } };
    const grantsMap = { g2: {}, g3: {} };
    expect(filterGrantLayerLocationMap(map, grantsMap)).toEqual({
      loc1: { ...map.loc1, grantIDs: ["g2", "g3"] }
    });
  });
  test("filterLocationMap removes locations with empty workIDs and grantIDs arrays", () => {
    const map = { loc1: { workIDs: [], grantIDs: [], name: "A" } };
    const worksMap = {};
    const grantsMap = {};
    expect(filterLocationMap(map, worksMap, grantsMap)).toEqual({});
  });
  test("filterWorkLayerLocationMap skips undefined location objects", () => {
    const map = { loc1: undefined, loc2: { workIDs: ["w1"], name: "B" } };
    const worksMap = { w1: {} };
    expect(filterWorkLayerLocationMap(map, worksMap)).toEqual({
      loc2: { ...map.loc2, workIDs: ["w1"] }
    });
  });
  test("filterWorkLayerLocationMap handles undefined filteredWorksMap", () => {
    const map = { loc1: { workIDs: ["w1"], name: "A" } };
    expect(filterWorkLayerLocationMap(map, undefined)).toEqual({});
  });
  test("filterGrantLayerLocationMap handles undefined filteredGrantsMap", () => {
    const map = { loc1: { grantIDs: ["g1"], name: "A" } };
    expect(filterGrantLayerLocationMap(map, undefined)).toEqual({});
  });
  test("filterLocationMap handles undefined filteredWorksMap and filteredGrantsMap", () => {
    const map = { loc1: { workIDs: ["w1"], grantIDs: ["g1"], name: "A" } };
    expect(filterLocationMap(map, undefined, undefined)).toEqual({});
    expect(filterLocationMap(map, { w1: {} }, undefined)).toEqual({
      loc1: { ...map.loc1, workIDs: ["w1"], grantIDs: [] }
    });
    expect(filterLocationMap(map, undefined, { g1: {} })).toEqual({
      loc1: { ...map.loc1, workIDs: [], grantIDs: ["g1"] }
    });
  });
  test("filterLocationMap handles location with only workIDs present", () => {
    const map = { loc1: { workIDs: ["w1"], name: "A" } };
    expect(filterLocationMap(map, { w1: {} }, {})).toEqual({
      loc1: { ...map.loc1, workIDs: ["w1"], grantIDs: [] }
    });
  });
  test("filterLocationMap handles location with only grantIDs present", () => {
    const map = { loc1: { grantIDs: ["g1"], name: "A" } };
    expect(filterLocationMap(map, {}, { g1: {} })).toEqual({
      loc1: { ...map.loc1, workIDs: [], grantIDs: ["g1"] }
    });
  });
});