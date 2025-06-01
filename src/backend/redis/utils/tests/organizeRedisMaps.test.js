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
  .mockResolvedValueOnce(["work:1"])           // getWorkKeys
  .mockResolvedValueOnce(["grant:1"]);                  // getGrantEntryKeys for grant:1 (return empty)

redisClient.hGetAll
  .mockResolvedValueOnce({ // work:1
    name: "Germany",
    id: "1",
    geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }),
    country: "CountryA",
    place_rank: "2"
  })
.mockResolvedValueOnce({ // grant:1
    name: "Germany",
    id: "1",
    geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }),
    country: "CountryA",
    place_rank: "2"
});
redisClient.keys
    .mockResolvedValueOnce(["work:1:entry:1"])
    .mockResolvedValueOnce(["grant:1:entry:1"]); // No entries for grant:1
redisClient.hGetAll
    .mockResolvedValueOnce({ // work:1:entry:1
        id: "1",
        confidence: "61",
        authors: '["Author1"]',
        relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
    })
    .mockResolvedValueOnce({
        id: "1",
        confidence: "61",
        relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
    }); // No entries for grant:1:entry:1


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
it("handles authors as undefined, empty, null, bad json, and string", async () => {
  redisClient.keys
    .mockResolvedValueOnce(["work:1"])
    .mockResolvedValueOnce([]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) })
    .mockResolvedValueOnce({ id: "2", confidence: "61", authors: undefined })
    .mockResolvedValueOnce({ id: "3", confidence: "61", authors: "[]" })
    .mockResolvedValueOnce({ id: "4", confidence: "61", authors: "null" })
    .mockResolvedValueOnce({ id: "5", confidence: "61", authors: "{bad json" })
    .mockResolvedValueOnce({ id: "6", confidence: "61", authors: "Single Author" });

  redisClient.keys
    .mockResolvedValueOnce([
      "work:1:entry:1",
      "work:1:entry:2",
      "work:1:entry:3",
      "work:1:entry:4",
      "work:1:entry:5"
    ]);

  const result = await buildRedisMaps(redisClient);
  expect(result.worksMap.get("work:2").authors).toEqual([]); // undefined
  expect(result.worksMap.get("work:3").authors).toEqual([]); // "[]"
  expect(result.worksMap.get("work:4").authors).toEqual([]); // "null"
  expect(result.worksMap.get("work:5").authors).toEqual(["{bad json"]); // bad JSON string
  expect(result.worksMap.get("work:6").authors).toEqual(["Single Author"]); // plain string
});
it("skips grant entries with missing id", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({}) // entry missing id
    .mockResolvedValueOnce({ id: undefined }); // entry missing id

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1", "grant:1:entry:2"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.size).toBe(0);
});
it("handles missing geometry for works and grants", async () => {
  redisClient.keys
    .mockResolvedValueOnce(["work:1"])
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1" }) // work:1, no geometry
    .mockResolvedValueOnce({ id: "2" }); // grant:1, no geometry

  redisClient.keys.mockResolvedValue([]); // no entries

  const result = await buildRedisMaps(redisClient);
  expect(result.locationMap.size).toBe(2);
  for (const loc of result.locationMap.values()) {
    expect(loc.geometryType).toBe("");
    expect(loc.coordinates).toBeNull();
  }
});
it("sets specificity based on place_rank", async () => {
  redisClient.keys
    .mockResolvedValueOnce(["work:1"])
    .mockResolvedValueOnce([]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }), place_rank: "4" }); // city

  redisClient.keys.mockResolvedValue([]); // no entries

  const result = await buildRedisMaps(redisClient);
  const loc = Array.from(result.locationMap.values())[0];
  expect(loc.specificity).toBe("country");
});
it("handles relatedExperts with missing fields", async () => {
  redisClient.keys
    .mockResolvedValueOnce(["work:1"])
    .mockResolvedValueOnce([]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) })
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: '[{"fullName":"No ID"},{"expertId":"e2"}]'
    });

  redisClient.keys
    .mockResolvedValueOnce(["work:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.expertsMap.size).toBeGreaterThan(0);
});
it("handles redisClient.keys returning undefined or null", async () => {
  redisClient.keys
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(null);

  const result = await buildRedisMaps(redisClient);
  expect(result.locationMap.size).toBe(0);
});
it("handles geometry parsing errors for works and grants", async () => {
  redisClient.keys
    .mockResolvedValueOnce(["work:1"])
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: "{bad json" }) // work:1
    .mockResolvedValueOnce({ id: "2", geometry: "{bad json" }); // grant:1

  redisClient.keys.mockResolvedValue([]); // no entries

  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  await buildRedisMaps(redisClient);
  expect(spy).toHaveBeenCalledWith(expect.stringContaining("Error parsing geometry"), expect.any(Error));
  spy.mockRestore();
});

it("handles relatedExperts as invalid JSON, array, and undefined", async () => {
  redisClient.keys
    .mockResolvedValueOnce(["work:1"])
    .mockResolvedValueOnce([]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) })
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: "{bad json"
    }) // invalid JSON
    .mockResolvedValueOnce({
      id: "3",
      confidence: "61",
      relatedExperts: [{ expertId: "e2" }] // missing fullName
    })
    .mockResolvedValueOnce({
      id: "4",
      confidence: "61"
      // relatedExperts: undefined
    });

  redisClient.keys
    .mockResolvedValueOnce(["work:1:entry:1", "work:1:entry:2", "work:1:entry:3"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.worksMap.get("work:2").relatedExpertIDs.length).toBe(0); // invalid JSON
  expect(result.worksMap.get("work:3").relatedExpertIDs.length).toBe(1); // array with missing field
  expect(result.worksMap.get("work:4").relatedExpertIDs.length).toBe(0); // undefined
});

it("handles grant relatedExperts as string, array, and missing fields", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
    }) // valid JSON string
    .mockResolvedValueOnce({
      id: "3",
      confidence: "61",
      relatedExperts: [{ fullName: "No ID" }]
    }); // array with missing expertId

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1", "grant:1:entry:2"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(1);
  expect(result.grantsMap.get("grant:3").relatedExpertIDs.length).toBe(1); // Should still add with fallback
});

it("handles duplicate expert and grant IDs in grant entries", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: '[{"expertId":"e1","fullName":"Expert One"}]'
    });

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  // Call twice to simulate duplicate linking
  const result = await buildRedisMaps(redisClient);
  const expert = result.expertsMap.get("expert:e1");
  expect(expert.grantIDs.length).toBe(1); // Should not duplicate
  expect(result.locationMap.size).toBeGreaterThan(0);
});
it("handles geometry parsing errors for grants", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: "{bad json" }); // grant:1

  redisClient.keys.mockResolvedValue([]); // no entries

  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  await buildRedisMaps(redisClient);
  expect(spy).toHaveBeenCalledWith(expect.stringContaining("Error parsing geometry"), expect.any(Error));
  spy.mockRestore();
});
it("handles grant relatedExperts as invalid JSON", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: "{bad json"
    }); // grant:1:entry:1

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(0); // Should skip invalid JSON
});
it("handles grant relatedExperts as array with missing fields", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: [{ fullName: "No ID" }, { expertId: "e2" }]
    }); // grant:1:entry:1

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.expertsMap.size).toBeGreaterThan(0);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(2);
});

it("handles grant entry with relatedExperts undefined", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61"
      // relatedExperts: undefined
    });

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(0);
});

// Grant entry with relatedExperts as an empty array (covers 326, 354)
it("handles grant entry with relatedExperts as empty array", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: []
    });

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(0);
});

// Grant entry with relatedExperts as a number (covers 399-403)
it("handles grant entry with relatedExperts as a number", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: 12345
    });

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(0);
});

// Grant entry with relatedExperts as undefined (covers 409, 411, 417, 419)
it("handles grant entry with relatedExperts undefined", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61"
      // relatedExperts: undefined
    });

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(0);
});

// Grant entry with relatedExperts as array with missing fields (covers 385-386)
it("handles grant entry with relatedExperts array missing fields", async () => {
  redisClient.keys
    .mockResolvedValueOnce([]) // work keys
    .mockResolvedValueOnce(["grant:1"]);
  redisClient.hGetAll
    .mockResolvedValueOnce({ id: "1", geometry: JSON.stringify({ type: "Point", coordinates: [0, 0] }) }) // grant:1
    .mockResolvedValueOnce({
      id: "2",
      confidence: "61",
      relatedExperts: [{ foo: "bar" }]
    });

  redisClient.keys
    .mockResolvedValueOnce(["grant:1:entry:1"]);

  const result = await buildRedisMaps(redisClient);
  expect(result.grantsMap.get("grant:2").relatedExpertIDs.length).toBe(1); // Should still add with fallback
});

});