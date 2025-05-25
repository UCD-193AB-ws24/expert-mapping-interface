import {
    createSingleExpertContent,
    createMultiExpertContent,
    createMultiGrantPopup,
    createCombinedPopup,
    createMatchedCombinedPolygonPopup,
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
  
    it("handles missing data gracefully in createSingleExpertContent", () => {
        const locationName = "Test Location";
        const entries = [{}];
      
        const result = createSingleExpertContent(locationName, entries);
        expect(result).toContain("No Title Available");
        expect(result).toContain("Unknown");
        expect(result).toContain("Unknown Expert");
        expect(result).toContain("#");
      });
  
    // Test for createMultiExpertContent
    it("generates correct HTML for multiple experts", () => {
      const expertCount = 3;
      const locationName = "Test Location";
      const totalWorks = 5;
  
      const result = createMultiExpertContent(expertCount, locationName, totalWorks);
      expect(result).toContain("3 Experts at this Location");
      expect(result).toContain("Test Location");
      expect(result).toContain("5");
      expect(result).toContain("View Experts");
    });
  
    // Test for createMultiGrantPopup
    it("generates correct HTML for multiple grants", () => {
      const expertCount = 2;
      const grantCount = 4;
      const locationName = "Test Location";
  
      const result = createMultiGrantPopup(expertCount, grantCount, locationName);
      expect(result).toContain("2 Experts at this Location");
      expect(result).toContain("Test Location");
      expect(result).toContain("4");
      expect(result).toContain("View Experts");
    });
  
    // Test for createCombinedPopup
    it("generates correct HTML for combined popup", () => {
        const works2ExpertCount = 2;
        const grants2ExpertCount = 3;
        const locationName = "Test Location";
        const matchedFields = ["field1", "field2"];
      
        const result = createCombinedPopup(works2ExpertCount, grants2ExpertCount, locationName, matchedFields);
        expect(result).toMatch(/<strong>2<\/strong> Experts with Works/);
        expect(result).toMatch(/<strong>3<\/strong> Experts with Grants/);
        expect(result).toContain("Test Location");
        expect(result).toContain("🔍 Match found");
        expect(result).toContain("Open Panel");
      });
  
    // Test for createMatchedCombinedPolygonPopup
    it("generates correct HTML for matched combined polygon popup", () => {
        const works2ExpertCount = 1;
        const grants2ExpertCount = 2;
        const locationName = "Test Location";
      
        const result = createMatchedCombinedPolygonPopup(works2ExpertCount, grants2ExpertCount, locationName);
        expect(result).toMatch(/<strong>1<\/strong> Expert with Works/);
        expect(result).toMatch(/<strong>2<\/strong> Experts with Grants/);
        expect(result).toContain("Test Location");
        expect(result).toContain("Open Panel");
      });
  });