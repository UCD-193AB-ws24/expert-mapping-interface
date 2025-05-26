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
      expect(result).toContain("Unknown"); // fallback for confidence
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
      expect(result).toContain("#c62828"); // red color for low confidence
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
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const result = createSingleExpertContent("Nowhere", []);
        expect(result).toContain("Error generating content");
        consoleSpy.mockRestore();
      });
      
      //64
      it("falls back to 'Unknown' location if locationName is undefined", () => {
        const entries = [{
          confidence: "High",
          relatedExperts: [{ name: "Fallback", url: "#" }],
        }];
        const result = createSingleExpertContent(undefined, entries);
        expect(result).toContain("Location:</strong> Unknown");
      });

      it("shows singular version of expert/grant count in all popups", () => {
        const singleMulti = createMultiExpertContent(1, "Test", 1);
        const singleGrant = createMultiGrantPopup(1, 1, "Test");
        const singleCombined = createCombinedPopup(1, 1, "Test");
        const singlePolygon = createMatchedCombinedPolygonPopup(1, 1, "Test");
      
        expect(singleMulti).toContain("1 Expert at this Location");
        expect(singleGrant).toContain("1 Expert at this Location");
        expect(singleCombined).toContain("1</strong> Expert with Works");
        expect(singleCombined).toContain("1</strong> Expert with Grants");
        expect(singlePolygon).toContain("1</strong> Expert with Works");
        expect(singlePolygon).toContain("1</strong> Expert with Grants");
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
  
      it("handles 0 experts and undefined location in createMatchedCombinedPolygonPopup", () => {
        const result = createMatchedCombinedPolygonPopup(0, 0, undefined);
        expect(result).toContain("<strong>0</strong> Experts with Works");
        expect(result).toContain("<strong>0</strong> Experts with Grants");
        expect(result).toContain("Location:</strong> undefined");
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