import {
  createSingleExpertContent,
  createMultiExpertContent,
  createMultiGrantPopup,
  createCombinedPopup,
} from "../rendering/Popups";

describe("Popups utility functions", () => {
  // Test for createSingleExpertContent
  it("generates correct HTML for a single expert", () => {
    const locationName = "Test Location";
    const entries = [
      {
        title: "Test Title",
        confidence: "High",
        issued: "2025-01-01",
        abstract: "Test Abstract",
        relatedExperts: [{ name: "Expert Name", url: "http://example.com" }],
      },
    ];

    const result = createSingleExpertContent(locationName, entries);
    expect(result).toContain("Test Location");
    expect(result).toContain("Test Title");
    expect(result).toContain("High");
    expect(result).toContain("2025-01-01");
    expect(result).toContain("Expert Name");
    expect(result).toContain("http://example.com");
  });

  it("handles undefined confidence value gracefully", () => {
    const result = createSingleExpertContent("Test Location", [
      {
        title: "Sample Title",
        confidence: undefined,
        issued: "2024-01-01",
        abstract: "Sample abstract",
        relatedExperts: [{ name: "Test Expert", url: "http://example.com" }],
      },
    ]);
    expect(result).toContain("Unknown");
  });


  it("renders correct styling for low confidence level", () => {
    const entries = [
      {
        confidence: "Low",
        relatedExperts: [{ name: "Test", url: "#" }],
      },
    ];
    const result = createSingleExpertContent("Nowhere", entries);
    expect(result).toContain("Low");
    expect(result).toContain("#c62828");
  });


  it("handles missing data gracefully in createSingleExpertContent", () => {
    const locationName = "Test Location";
    const entries = [{}];

    const result = createSingleExpertContent(locationName, entries);
    expect(result).toContain("No Title Available");
    expect(result).toContain("Unknown");
    expect(result).toContain("Unknown Expert");
    expect(result).toContain("#");
  });

  it("throws error when entries array is empty", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    const result = createSingleExpertContent("Nowhere", []);
    expect(result).toContain("Error generating content");
    consoleSpy.mockRestore();
  });

  it("falls back to 'Unknown' location if locationName is undefined", () => {
    const entries = [{
      confidence: "High",
      relatedExperts: [{ name: "Fallback", url: "#" }],
    }];
    const result = createSingleExpertContent(undefined, entries);
    expect(result).toContain("Location:</strong> Unknown");
  });

  it("generates correct HTML for combined popup", () => {
    const works2ExpertCount = { work1: 2, work2: 1 };
    const grants2ExpertCount = { grant1: 1 };
    const locationName = "Sample Location";
    const totalWorks = 2;
    const totalGrants = 1;
    const combinedExpertCount = 3;

    const result = createCombinedPopup(
      works2ExpertCount,
      grants2ExpertCount,
      locationName,
      totalWorks,
      totalGrants,
      combinedExpertCount
    );

    expect(result).toContain("Sample Location");
    expect(result).toContain("3 Expert");
    expect(result).toContain("Related Works:</strong> 2");
    expect(result).toContain("Related Grant:</strong> 1");
    expect(result).toContain("Open Panel");
  });

  it("generates correct popup for a single expert", () => {
    const result = createMultiExpertContent(1, "SoloCity", 1);
    expect(result).toContain("1 Expert in SoloCity");
    expect(result).toContain("Related Works:</strong> 1");
    expect(result).toContain("View Expert");

  });

  it("generates correct popup for multiple experts", () => {
    const result = createMultiExpertContent(3, "MultiTown", 5);
    expect(result).toContain("3 Experts in MultiTown");
    expect(result).toContain("Related Works:</strong> 5");
    expect(result).toContain("View Experts");
  });

  it("generates correct popup for a single grant expert", () => {
    const result = createMultiGrantPopup(1, 1, "GrantVille");
    expect(result).toContain("1 Expert in GrantVille");
    expect(result).toContain("Related Grants:</strong> 1");
    expect(result).toContain("View Expert");
  });

  it("generates correct popup for multiple grant experts", () => {
    const result = createMultiGrantPopup(2, 4, "Grantopolis");
    expect(result).toContain("2 Experts in Grantopolis");
    expect(result).toContain("Related Grants:</strong> 4");
    expect(result).toContain("View Experts");
  });

  it("renders plural for multiple works and grants in combined popup", () => {
    const html = createCombinedPopup({}, {}, "Testville", 2, 3, 5);
    expect(html).toContain("Related Works:");
    expect(html).toContain("Related Grants:");
  });

  it("renders singular for single work and grant in combined popup", () => {
    const html = createCombinedPopup({}, {}, "Testville", 1, 1, 1);
    expect(html).toContain("Related Work:");
    expect(html).toContain("Related Grant:");
  });
});