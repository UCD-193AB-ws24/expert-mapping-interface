const { buildRedisMaps } = require("../organizeRedisMaps");

describe("buildRedisMaps", () => {
  let redisClient;

  beforeEach(() => {
    redisClient = {
      keys: jest.fn(),
      hGetAll: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it("handles empty redis (no works or grants)", async () => {
    redisClient.keys.mockResolvedValue([]);
    const result = await buildRedisMaps(redisClient);
    expect(result.locationMap.size).toBe(0);
    expect(result.worksMap.size).toBe(0);
    expect(result.grantsMap.size).toBe(0);
    expect(result.expertsMap.size).toBe(0);
  });

  it("skips work and grant keys with missing id", async () => {
    redisClient.keys
      .mockResolvedValueOnce(["work:1", "work:2"])
      .mockResolvedValueOnce(["grant:1", "grant:2"]);
    redisClient.hGetAll
      .mockResolvedValueOnce({}) // work:1 missing id
      .mockResolvedValueOnce({ id: undefined }) // work:2 missing id
      .mockResolvedValueOnce({}) // grant:1 missing id
      .mockResolvedValueOnce({ id: undefined }); // grant:2 missing id

    const result = await buildRedisMaps(redisClient);
    expect(result.locationMap.size).toBe(0);
    expect(result.worksMap.size).toBe(0);
    expect(result.grantsMap.size).toBe(0);
  });

  it("handles geometry parsing errors for works and grants", async () => {
    redisClient.keys
      .mockResolvedValueOnce(["work:1"])
      .mockResolvedValueOnce(["grant:1"]);
    redisClient.hGetAll
      .mockResolvedValueOnce({ id: "1", geometry: "{bad json" }) // work:1
      .mockResolvedValueOnce({ id: "1", geometry: "{bad json" }); // grant:1

    // Mock entry keys to empty so we don't go into entry loops
    redisClient.keys.mockResolvedValue([]);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await buildRedisMaps(redisClient);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Error parsing geometry"), expect.any(Error));
    spy.mockRestore();
  });

  it("skips work entries with low confidence or missing id", async () => {
    redisClient.keys
      .mockResolvedValueOnce(["work:1"])
      .mockResolvedValueOnce([]);
    redisClient.hGetAll
      .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // work:1
      .mockResolvedValueOnce({ id: undefined }) // entry missing id
      .mockResolvedValueOnce({ id: "2", confidence: "50" }) // entry low confidence
      .mockResolvedValueOnce({ id: "3", confidence: "not-a-number" }); // entry NaN

    redisClient.keys
      .mockResolvedValueOnce(["work:1:entry:1", "work:1:entry:2", "work:1:entry:3"]);

    const result = await buildRedisMaps(redisClient);
    expect(result.worksMap.size).toBe(0); // All entries skipped
  });

  it("parses authors as string, array, and invalid JSON", async () => {
    redisClient.keys
      .mockResolvedValueOnce(["work:1"])
      .mockResolvedValueOnce([]);
    redisClient.hGetAll
      .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // work:1
      .mockResolvedValueOnce({ id: "2", confidence: "61", authors: '["A","B"]' }) // valid JSON
      .mockResolvedValueOnce({ id: "3", confidence: "61", authors: "C" }) // string
      .mockResolvedValueOnce({ id: "4", confidence: "61", authors: "{bad json" }); // invalid JSON

    redisClient.keys
      .mockResolvedValueOnce(["work:1:entry:1", "work:1:entry:2", "work:1:entry:3"]);

    const result = await buildRedisMaps(redisClient);
    expect(result.worksMap.size).toBe(3);
    expect(result.worksMap.get("work:2").authors).toEqual(["A", "B"]);
    expect(result.worksMap.get("work:3").authors).toEqual(["C"]);
    expect(result.worksMap.get("work:4").authors).toEqual(["{bad json"]);
  });

  it("handles relatedExperts as string, array, and invalid JSON", async () => {
    redisClient.keys
      .mockResolvedValueOnce(["work:1"])
      .mockResolvedValueOnce([]);
    redisClient.hGetAll
      .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // work:1
      .mockResolvedValueOnce({
        id: "2",
        confidence: "61",
        authors: '["A"]',
        relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
      }) // valid JSON
      .mockResolvedValueOnce({
        id: "3",
        confidence: "61",
        authors: '["B"]',
        relatedExperts: "{bad json"
      }) // invalid JSON
      .mockResolvedValueOnce({
        id: "4",
        confidence: "61",
        authors: '["C"]',
        relatedExperts: [{ expertId: "e2", fullName: "Expert Two" }]
      }); // array

    redisClient.keys
      .mockResolvedValueOnce(["work:1:entry:1", "work:1:entry:2", "work:1:entry:3"]);

    const result = await buildRedisMaps(redisClient);
    expect(result.expertsMap.size).toBeGreaterThan(0);
    expect(result.worksMap.get("work:2").relatedExpertIDs.length).toBe(1);
    expect(result.worksMap.get("work:3").relatedExpertIDs.length).toBe(0); // invalid JSON
    expect(result.worksMap.get("work:4").relatedExpertIDs.length).toBe(1);
  });


it("handles overlapping locations for grants", async () => {
  // Mock main keys
  redisClient.keys
    .mockResolvedValueOnce(["work:1"]);      // getWorkKeys
    // .mockResolvedValueOnce(["grant:1"])     // getGrantKeys

redisClient.hGetAll
  .mockResolvedValueOnce({ // work:1
    name: "Germany",
    id: "1",
    geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }),
    country: "CountryA",
    place_rank: "2"
  });
//   .mockResolvedValueOnce({ // grant:1
//     name: "Germany",
//     id: "2",
//     geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }),
//     country: "CountryA",
//     place_rank: "2"
//   });

redisClient.keys
    .mockResolvedValueOnce(["work:1:entry:1"]); // getWorkEntryKeys for work:1
    // .mockResolvedValueOnce(["grant:1:entry:1"]); // getGrantEntryKeys for grant:1

  // Mock main hashes (same name, different id, valid geometry)
  redisClient.hGetAll
    .mockResolvedValueOnce({ // work:1:entry:1
        id: "1",
        title: "Work1",
        confidence: "61",
        abstract: "No Abstract",
        issued: "Unknown",
        authors: '["Stupid Author"]',
        relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
    });
//   .mockResolvedValueOnce({ // grant:1:entry:1
//     id: "2",
//     title: "Grant1",
//     confidence: "70",
//     relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'

//   });

    const result = await buildRedisMaps(redisClient);
    console.log(Array.from(result.locationMap.values()));
    expect(result.locationMap.size).toBe(1);
});

  it("handles grant entries with low confidence", async () => {
    redisClient.keys
      .mockResolvedValueOnce([]) // work keys
      .mockResolvedValueOnce(["grant:1"]);
    redisClient.hGetAll
      .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
      .mockResolvedValueOnce({ id: "2", confidence: "59" }) // low confidence
      .mockResolvedValueOnce({ id: "3", confidence: "not-a-number" }); // NaN

    redisClient.keys
      .mockResolvedValueOnce(["grant:1:entry:1", "grant:1:entry:2"]);

    const result = await buildRedisMaps(redisClient);
    expect(result.grantsMap.size).toBe(0); // All entries skipped
  });

  it("handles grant entries with relatedExperts as string and array", async () => {
    redisClient.keys
      .mockResolvedValueOnce([]) // work keys
      .mockResolvedValueOnce(["grant:1"]);
    redisClient.hGetAll
      .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
      .mockResolvedValueOnce({
        id: "2",
        confidence: "61",
        relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
      }) // valid JSON
      .mockResolvedValueOnce({
        id: "3",
        confidence: "61",
        relatedExperts: [{ expertId: "e2", fullName: "Expert Two" }]
      }); // array

    redisClient.keys
      .mockResolvedValueOnce(["grant:1:entry:1", "grant:1:entry:2"]);

    const result = await buildRedisMaps(redisClient);
    expect(result.expertsMap.size).toBeGreaterThan(0);
    expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(1);
    expect(result.grantsMap.get("grant:3").relatedExpertIDs.length).toBe(1);
  });

//   it("handles country-level aggregation and specificity maps", async () => {
//   // Mock entry keys for work and grant
// redisClient.keys
//   .mockResolvedValueOnce(["work:1:entry:1"])
//   .mockResolvedValueOnce(["grant:1:entry:1"]);

// // Both entries use id: "2", country: "CountryA", place_rank: "2"
// redisClient.hGetAll
//   .mockResolvedValueOnce({
//     id: "2",
//     confidence: "61",
//     country: "CountryA",
//     place_rank: "2"
//   }) // work:1:entry:1
//   .mockResolvedValueOnce({
//     id: "2", 
//     confidence: "61",
//     country: "CountryA",
//     place_rank: "2"
//   }); // grant:1:entry:1
  

//   const result = await buildRedisMaps(redisClient);
//   console.log(JSON.stringify(result, null, 2));
//   const loc = Array.from(result.locationMap.values())[0];
//   expect(loc.specificity).toBe("country");
//   expect(result.workLayerSpecificityMaps.countryMap.size).toBeGreaterThan(0);
//   expect(result.grantLayerSpecificityMaps.countryMap.size).toBeGreaterThan(0);
//   expect(result.combinedLayerSpecificityMaps.countryMap.size).toBeGreaterThan(0);
// });




});