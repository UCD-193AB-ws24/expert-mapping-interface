import { prepareGrantPanelData, prepareWorkPanelData } from "../preparePanelData";

describe("preparePanelData utility functions", () => {
  const expertsMap = {
    e1: { name: "Alice", url: "alice", expertId: "e1" },
    e2: { name: "Bob", url: "http://bob.com", expertId: "e2" },
    e3: { name: "Charlie", url: "", expertId: "e3" },
  };

  const grantsMap = {
    g1: {
      grantID: "g1",
      title: "Grant 1",
      funder: "NSF",
      startDate: "2020",
      endDate: "2021",
      confidence: "High",
      matchedFields: ["title"],
      relatedExpertIDs: ["e1"],
      locationIDs: ["loc1"],
    },
    g2: {
      grantID: "g2",
      title: "Grant 2",
      funder: "NIH",
      startDate: "2021",
      endDate: "2022",
      confidence: "Low",
      matchedFields: [],
      relatedExpertIDs: ["e2"],
      locationIDs: ["loc1"],
    },
    g3: {
      grantID: "g3",
      title: "Grant 3",
      funder: "DOE",
      startDate: "2022",
      endDate: "2023",
      confidence: "Medium",
      matchedFields: [],
      // No relatedExpertIDs
      locationIDs: ["loc1"],
    },
  };

  const worksMap = {
    w1: {
      workID: "w1",
      title: "Work 1",
      issued: "2019",
      confidence: "High",
      matchedFields: ["title"],
      relatedExpertIDs: ["e1"],
      locationIDs: ["loc1"],
    },
    w2: {
      workID: "w2",
      title: "Work 2",
      issued: "2020",
      confidence: "Low",
      matchedFields: [],
      relatedExpertIDs: ["e2"],
      locationIDs: ["loc1"],
    },
    w3: {
      workID: "w3",
      title: "Work 3",
      issued: "2021",
      confidence: "Medium",
      matchedFields: [],
      // No relatedExpertIDs
      locationIDs: ["loc1"],
    },
  };

  test("prepareGrantPanelData returns correct expert and grant info, builds full URL", () => {
    const result = prepareGrantPanelData(
      ["e1", "e2"],
      ["g1", "g2"],
      grantsMap,
      expertsMap,
      "loc1",
      "Location 1"
    );
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Alice");
    expect(result[0].url).toBe("https://experts.ucdavis.edu/alice");
    expect(result[0].grants[0].title).toBe("Grant 1");
    expect(result[1].name).toBe("Bob");
    expect(result[1].url).toBe("http://bob.com");
    expect(result[1].grants[0].title).toBe("Grant 2");
  });

  test("prepareGrantPanelData filters out experts not in expertsMap", () => {
    const result = prepareGrantPanelData(
      ["e1", "e999"],
      ["g1"],
      grantsMap,
      expertsMap,
      "loc1",
      "Location 1"
    );
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Alice");
  });

  test("prepareGrantPanelData skips grants not in grantsMap or not related to expert", () => {
    const result = prepareGrantPanelData(
      ["e1"],
      ["g1", "g3", "g999"],
      grantsMap,
      expertsMap,
      "loc1",
      "Location 1"
    );
    expect(result[0].grants.length).toBe(1); // Only g1 is related to e1
    expect(result[0].grants[0].title).toBe("Grant 1");
  });

  test("prepareWorkPanelData returns correct expert and work info, builds full URL", () => {
    const result = prepareWorkPanelData(
      ["e1", "e2"],
      ["w1", "w2"],
      expertsMap,
      worksMap,
      "loc1",
      "Location 1"
    );
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Alice");
    expect(result[0].url).toBe("https://experts.ucdavis.edu/alice");
    expect(result[0].works[0].title).toBe("Work 1");
    expect(result[1].name).toBe("Bob");
    expect(result[1].url).toBe("http://bob.com");
    expect(result[1].works[0].title).toBe("Work 2");
  });

  test("prepareWorkPanelData filters out experts not in expertsMap", () => {
    const result = prepareWorkPanelData(
      ["e1", "e999"],
      ["w1"],
      expertsMap,
      worksMap,
      "loc1",
      "Location 1"
    );
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Alice");
  });

  test("prepareWorkPanelData skips works not in worksMap or not related to expert", () => {
    const result = prepareWorkPanelData(
      ["e1"],
      ["w1", "w3", "w999"],
      expertsMap,
      worksMap,
      "loc1",
      "Location 1"
    );
    expect(result[0].works.length).toBe(1); // Only w1 is related to e1
    expect(result[0].works[0].title).toBe("Work 1");
  });

  test("prepareGrantPanelData handles grant with missing relatedExpertIDs", () => {
    const result = prepareGrantPanelData(
      ["e1"],
      ["g3"],
      grantsMap,
      expertsMap,
      "loc1",
      "Location 1"
    );
    expect(result.length).toBe(0); // g3 has no relatedExpertIDs
  });

  test("prepareWorkPanelData handles work with missing relatedExpertIDs", () => {
    const result = prepareWorkPanelData(
      ["e1"],
      ["w3"],
      expertsMap,
      worksMap,
      "loc1",
      "Location 1"
    );
    expect(result.length).toBe(0);
  });

  test("prepareWorkPanelData handles expert with missing url property", () => {
  const expertsMapWithMissingUrl = {
    ...expertsMap,
    e4: { name: "Dana", expertId: "e4" }
  };
  const worksMapWithE4 = {
    ...worksMap,
    w4: { workID: "w4", title: "Work 4", relatedExpertIDs: ["e4"], locationIDs: ["loc1"] }
  };
  const result = prepareWorkPanelData(
    ["e4"],
    ["w4"],
    expertsMapWithMissingUrl,
    worksMapWithE4,
    "loc1",
    "Location 1"
  );
  expect(result.length).toBe(1); // Ensure the expert is included
  expect(result[0].url).toBe(""); // e3 has empty url
  expect(result[0].works[0].title).toBe("Work 4");
});
test("prepareGrantPanelData handles grant with missing fields", () => {
  const grantsMapWithMissingFields = {
    ...grantsMap,
    g4: { grantID: "g4", relatedExpertIDs: ["e1"], locationIDs: ["loc1"] }
  };
  const result = prepareGrantPanelData(
    ["e1"],
    ["g4"],
    grantsMapWithMissingFields,
    expertsMap,
    "loc1",
    "Location 1"
  );
  expect(result[0].grants[0].title).toBe("Untitled Grant");
  expect(result[0].grants[0].funder).toBe("Unknown");
});

test("prepareWorkPanelData handles work with missing fields", () => {
  const worksMapWithMissingFields = {
    ...worksMap,
    w5: { workID: "w5", relatedExpertIDs: ["e1"], locationIDs: ["loc1"] }
  };
  const result = prepareWorkPanelData(
    ["e1"],
    ["w5"],
    expertsMap,
    worksMapWithMissingFields,
    "loc1",
    "Location 1"
  );
  expect(result[0].works[0].title).toBe("Untitled Work");
  expect(result[0].works[0].issued).toBe("Unknown");
});

test("prepareGrantPanelData skips grants not linked to location", () => {
  const grantsMapWithWrongLocation = {
    ...grantsMap,
    g5: { grantID: "g5", relatedExpertIDs: ["e1"], locationIDs: ["loc2"] }
  };
  const result = prepareGrantPanelData(
    ["e1"],
    ["g5"],
    grantsMapWithWrongLocation,
    expertsMap,
    "loc1",
    "Location 1"
  );
  expect(result.length).toBe(0);
});

test("prepareWorkPanelData skips works not linked to location", () => {
  const worksMapWithWrongLocation = {
    ...worksMap,
    w6: { workID: "w6", relatedExpertIDs: ["e1"], locationIDs: ["loc2"] }
  };
  const result = prepareWorkPanelData(
    ["e1"],
    ["w6"],
    expertsMap,
    worksMapWithWrongLocation,
    "loc1",
    "Location 1"
  );
  expect(result.length).toBe(0);
});

test("prepareGrantPanelData returns empty array if no expertIDs match", () => {
  const result = prepareGrantPanelData(
    ["e999"],
    ["g1"],
    grantsMap,
    expertsMap,
    "loc1",
    "Location 1"
  );
  expect(result.length).toBe(0);
});

});