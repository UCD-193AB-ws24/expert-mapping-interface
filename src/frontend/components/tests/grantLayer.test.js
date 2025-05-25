/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import GrantLayer from "../rendering/GrantLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

// Mock react-leaflet
jest.mock("react-leaflet", () => ({
  useMap: jest.fn(),
}));

// Mock Leaflet with polygon.getBounds().getCenter() and other dependencies
jest.mock("leaflet", () => {
  // Create the polygon object that will be returned by L.polygon()
  const mockPolygonObject = {
    addTo: jest.fn().mockReturnThis(),
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
    options: { expertCount: 2 }, // Add this for cluster testing
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
    getAllChildMarkers: jest.fn(() => [{ options: { expertCount: 2 } }]),
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
  createMultiGrantPopup: jest.fn(() => "<div>Mock popup content</div>"),
}));

// Mock the panel data preparation function
jest.mock("../rendering/utils/preparePanelData", () => ({
  prepareGrantPanelData: jest.fn(() => ({ mockData: "test" })),
}));

describe("GrantLayer component", () => {
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

  // Test: Initializes and adds layer group when showGrants is true
  it("renders polygons and points when showGrants is true", () => {
    const locationMap = new Map([
      [
        "loc1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [2],
          name: "Polygon A",
        },
      ],
      [
        "loc2",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          grantIDs: [3],
          expertIDs: [4],
          name: "Point B",
        },
      ],
    ]);

    const grantsMap = new Map([
      [1, { matchedFields: ["field1"] }],
      [3, { matchedFields: ["field2"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert 1" }],
      [4, { name: "Expert 2" }],
    ]);

    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(L.markerClusterGroup).toHaveBeenCalled();
    expect(L.polygon).toHaveBeenCalled();
    expect(L.marker).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled();
  });

  // Test: Cleans up layers correctly on component unmount
  it("removes all layers on unmount", () => {
    const locationMap = new Map([
      [
        "loc1",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          grantIDs: [1],
          expertIDs: [2],
          name: "Point X",
        },
      ],
    ]);

    const grantsMap = new Map([
      [1, { matchedFields: ["field1"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert 1" }],
    ]);

    const { unmount } = render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    unmount();
    expect(mockMap.removeLayer).toHaveBeenCalled();
  });

  // ✅ Test: Skips rendering and logs error if showGrants is false
  it("does not render anything when showGrants is false", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    render(
      <GrantLayer
        locationMap={new Map()}
        grantsMap={new Map()}
        expertsMap={new Map()}
        showGrants={false}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(consoleSpy).toHaveBeenCalledWith("Error: No grants found!");
    expect(mockMap.addLayer).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});