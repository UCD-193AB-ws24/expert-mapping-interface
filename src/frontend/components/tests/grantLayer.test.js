/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import GrantLayer from "../rendering/GrantLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";
import * as panelUtils from "../rendering/utils/preparePanelData";


// Mock react-leaflet
jest.mock("react-leaflet", () => ({
  useMap: jest.fn(),
}));

// Mock Leaflet
jest.mock("leaflet", () => {
    
  const mockMarker = jest.fn(() => ({
    addTo: jest.fn(),
    on: jest.fn(),
    getLatLng: jest.fn(() => ({ lat: 0, lng: 0 })),
  }));

  const mockPopup = jest.fn(() => ({
    setLatLng: jest.fn(() => mockPopup),
    setContent: jest.fn(() => mockPopup),
    openOn: jest.fn(),
    remove: jest.fn(),
    getElement: jest.fn(() => ({
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
    })),
  }));

  const mockMarkerClusterGroup = jest.fn(() => ({
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    getAllChildMarkers: jest.fn(() => [{ options: { expertCount: 2 } }]),
  }));

  return {
    polygon: mockPolygon,
    marker: mockMarker,
    popup: mockPopup,
    markerClusterGroup: mockMarkerClusterGroup,
    divIcon: jest.fn(() => ({ options: { html: "" } })),
    point: jest.fn(),
  };
});

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

  // mounts and adds layer group when showGrants is true
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

    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={new Map()}
        expertsMap={new Map()}
        showGrants={true}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(L.markerClusterGroup).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled();
  });

  // cleans up all layers on unmount
  it("removes all layers on unmount", () => {
    const locationMap = new Map([
      [
        "loc1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [2],
          name: "Polygon X",
        },
      ],
    ]);

    const { unmount } = render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={new Map()}
        expertsMap={new Map()}
        showGrants={true}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    unmount();
    expect(mockMap.removeLayer).toHaveBeenCalled();
  });

  // skips rendering when showGrants is false
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

  // Test: Clicking popup button sets grant panel state
it("clicking popup button sets grant panel state and selected data", () => {
    const mockGrantData = [{ id: 1 }];
    const prepareGrantPanelDataSpy = jest
      .spyOn(panelUtils, "prepareGrantPanelData")
      .mockReturnValue(mockGrantData);
  
    const createMultiGrantPopupSpy = jest
      .spyOn(popupUtils, "createMultiGrantPopup")
      .mockImplementation(() => {
        // Simulate a button in the popup HTML
        return `<button class="view-g-experts-btn">View</button>`;
      });
  
    const setSelectedGrants = jest.fn();
    const setPanelOpen = jest.fn();
    const setPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "location1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [2],
          name: "Popup Location",
          display_name: "Popup Location Display",
        },
      ],
    ]);
  
    const container = document.createElement("div");
    document.body.appendChild(container);
  
    const { container: reactContainer } = render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={new Map([[1, { matchedFields: ["title"] }]])}
        expertsMap={new Map([[2, {}]])}
        showGrants={true}
        setSelectedGrants={setSelectedGrants}
        setPanelOpen={setPanelOpen}
        setPanelType={setPanelType}
      />,
      { container }
    );
  
    // Simulate manually the presence of the button
    const popupBtn = document.querySelector(".view-g-experts-btn");
    if (popupBtn) {
      popupBtn.click();
  
      expect(prepareGrantPanelDataSpy).toHaveBeenCalled();
      expect(setSelectedGrants).toHaveBeenCalledWith(mockGrantData);
      expect(setPanelType).toHaveBeenCalledWith("grants");
      expect(setPanelOpen).toHaveBeenCalledWith(true);
    } else {
      throw new Error("Popup button was not rendered or attached.");
    }
  
    document.body.removeChild(container);
  });
});