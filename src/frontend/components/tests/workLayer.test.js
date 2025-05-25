/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import WorkLayer from "../rendering/WorkLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

// Mock react-leaflet
jest.mock("react-leaflet", () => ({
  useMap: jest.fn(),
}));

// Mock leaflet.markercluster
jest.mock("leaflet.markercluster", () => {});

// Mock Leaflet with all necessary methods
jest.mock("leaflet", () => {
  // Create the polygon object that will be returned by L.polygon()
  const mockPolygonObject = {
    addTo: jest.fn().mockReturnThis(),
    getCenter: jest.fn(() => ({ lat: 0, lng: 0 })),
    getBounds: jest.fn(() => ({
      getCenter: jest.fn(() => ({ lat: 0, lng: 0 })),
      getEast: jest.fn(() => 2),
      getWest: jest.fn(() => 0),
      getNorth: jest.fn(() => 2),
      getSouth: jest.fn(() => 0),
    })),
  };

  // Create the marker object that will be returned by L.marker()
  const mockMarkerObject = {
    addTo: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    getLatLng: jest.fn(() => ({ lat: 0, lng: 0 })),
    options: { expertCount: 3 }, // Add this for cluster testing
  };

  const mockPopupObject = {
    setLatLng: jest.fn().mockReturnThis(),
    setContent: jest.fn().mockReturnThis(),
    openOn: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    close: jest.fn(),
    getElement: jest.fn(() => ({
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    })),
  };

  const mockMarkerClusterGroupObject = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    getAllChildMarkers: jest.fn(() => [
      { options: { expertCount: 3 } },
      { options: { expertCount: 2 } }
    ]),
  };

  return {
    // L.polygon should be a function that returns the polygon object
    polygon: jest.fn(() => mockPolygonObject),
    // L.marker should be a function that returns the marker object
    marker: jest.fn(() => mockMarkerObject),
    // L.popup should be a function that returns the popup object
    popup: jest.fn(() => mockPopupObject),
    // L.markerClusterGroup should be a function that returns the cluster group object
    markerClusterGroup: jest.fn(() => mockMarkerClusterGroupObject),
    divIcon: jest.fn(() => ({ options: { html: "" } })),
    point: jest.fn(() => [40, 40]),
  };
});

// Mock the popup creation function
jest.mock("../rendering/Popups", () => ({
  createMultiExpertContent: jest.fn(() => "<div>Mock expert popup content</div>"),
}));

// Mock the panel data preparation function
jest.mock("../rendering/utils/preparePanelData", () => ({
  prepareWorkPanelData: jest.fn(() => ({ mockWorkData: "test" })),
}));

describe("WorkLayer component", () => {
  let mockMap;

  beforeEach(() => {
    mockMap = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    };
    useMap.mockReturnValue(mockMap);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  //  Test: Initializes and adds layer group when showWorks is true
  it("renders polygons and points when showWorks is true", () => {
    const locationMap = new Map([
      [
        "loc1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1, 2],
          workIDs: [10, 20],
          name: "Polygon Location",
          display_name: "Test Polygon"
        },
      ],
      [
        "loc2",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          expertIDs: [3, 4, 5],
          workIDs: [30, 40],
          name: "Point Location",
          display_name: "Test Point"
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Work 1", matchedFields: ["field1"] }],
      [20, { title: "Work 2", matchedFields: ["field2"] }],
      [30, { title: "Work 3", matchedFields: ["field3"] }],
      [40, { title: "Work 4", matchedFields: ["field4"] }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Expert 1" }],
      [2, { name: "Expert 2" }],
      [3, { name: "Expert 3" }],
      [4, { name: "Expert 4" }],
      [5, { name: "Expert 5" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(L.markerClusterGroup).toHaveBeenCalled();
    expect(L.polygon).toHaveBeenCalled();
    expect(L.marker).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled();
  });

  // Test: Handles polygon locations correctly
  it("renders polygon markers at polygon centers", () => {
    const locationMap = new Map([
      [
        "polygon_loc",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1, 2, 3],
          workIDs: [10],
          name: "Test Polygon",
          display_name: "Test Polygon Display"
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Polygon Work", matchedFields: ["research"] }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Expert 1" }],
      [2, { name: "Expert 2" }],
      [3, { name: "Expert 3" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(L.polygon).toHaveBeenCalledWith(
      [[[0, 0], [1, 1], [2, 2]]],
      expect.objectContaining({
        color: "#3879C7",
        fillColor: "#4783CB",
        fillOpacity: 0.6,
        weight: 2,
      })
    );
    expect(L.marker).toHaveBeenCalled();
  });

  //  Test: Handles point locations correctly
  it("renders point markers with clustering", () => {
    const locationMap = new Map([
      [
        "point_loc",
        {
          geometryType: "Point",
          coordinates: [10, 20], // [lng, lat]
          expertIDs: [1, 2],
          workIDs: [10, 20],
          name: "Test Point",
          display_name: "Test Point Display"
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Point Work 1", matchedFields: ["field1"] }],
      [20, { title: "Point Work 2", matchedFields: ["field2"] }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Expert 1" }],
      [2, { name: "Expert 2" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    // Should create marker with flipped coordinates [lat, lng]
    expect(L.marker).toHaveBeenCalledWith(
      [20, 10], // flipped from [10, 20]
      expect.objectContaining({
        icon: expect.anything(),
        expertCount: 2,
      })
    );
  });

  //  Test: Skips locations with no experts
  it("skips polygon locations with no experts", () => {
    const locationMap = new Map([
      [
        "empty_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [], // No experts
          workIDs: [10],
          name: "Empty Polygon",
        },
      ],
      [
        "valid_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1], // Has experts
          workIDs: [20],
          name: "Valid Polygon",
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Work 1" }],
      [20, { title: "Work 2" }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Expert 1" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    // Should only call L.polygon once (for the valid polygon)
    expect(L.polygon).toHaveBeenCalledTimes(1);
  });

  //  Test: Cleans up layers correctly on component unmount
  it("removes all layers on unmount", () => {
    const locationMap = new Map([
      [
        "test_loc",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          expertIDs: [1],
          workIDs: [10],
          name: "Test Location",
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Test Work" }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Test Expert" }],
    ]);

    const { unmount } = render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    unmount();
    expect(mockMap.removeLayer).toHaveBeenCalled();
  });

  //  Test: Skips rendering and logs error if showWorks is false
  it("does not render anything when showWorks is false", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <WorkLayer
        locationMap={new Map()}
        worksMap={new Map()}
        expertsMap={new Map()}
        showWorks={false}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(consoleSpy).toHaveBeenCalledWith("Error: No works found!");
    expect(mockMap.addLayer).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // Test: Handles invalid point coordinates
  it("skips points with invalid coordinates", () => {
    const locationMap = new Map([
      [
        "invalid_point",
        {
          geometryType: "Point",
          coordinates: [10], // Invalid - should have 2 coordinates
          expertIDs: [1],
          workIDs: [10],
          name: "Invalid Point",
        },
      ],
      [
        "valid_point",
        {
          geometryType: "Point",
          coordinates: [10, 20], // Valid coordinates
          expertIDs: [2],
          workIDs: [20],
          name: "Valid Point",
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Work 1" }],
      [20, { title: "Work 2" }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Expert 1" }],
      [2, { name: "Expert 2" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    // Should only create one marker (for the valid point)
    expect(L.marker).toHaveBeenCalledTimes(1);
    expect(L.marker).toHaveBeenCalledWith(
      [20, 10], // Valid flipped coordinates
      expect.objectContaining({
        expertCount: 1,
      })
    );
  });

  // Test: Creates cluster group with correct configuration
  it("creates marker cluster group with correct configuration", () => {
    const locationMap = new Map([
      [
        "test_point",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          expertIDs: [1],
          workIDs: [10],
          name: "Test Point",
        },
      ],
    ]);

    const worksMap = new Map([
      [10, { title: "Test Work" }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Test Expert" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(L.markerClusterGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        showCoverageOnHover: false,
        maxClusterRadius: 100,
        spiderfyOnMaxZoom: false,
        iconCreateFunction: expect.any(Function),
      })
    );
  });
});