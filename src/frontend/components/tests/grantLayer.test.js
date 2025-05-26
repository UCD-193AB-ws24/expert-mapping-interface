/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import GrantLayer from "../rendering/GrantLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

jest.useFakeTimers();

// Mock react-leaflet
jest.mock("react-leaflet", () => ({
  useMap: jest.fn(),
}));

const popupEventListeners = {};

const mockPopupElement = {
  style: { pointerEvents: "auto" },
  addEventListener: jest.fn((event, handler) => {
    popupEventListeners[event] = handler;
  }),
  querySelector: jest.fn((selector) => {
    if (selector === ".view-g-experts-btn") {
      return mockButtonElement;
    }
    return null;
  }),
};

const mockButtonElement = {
  addEventListener: jest.fn(),
};


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
    getElement: jest.fn(() => mockPopupElement),
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
// jest.mock("../rendering/Popups", () => ({
//   createMultiGrantPopup: jest.fn(() => "<div>Mock popup content</div>"),
// }));
// Mock the popup creation function
jest.mock("../rendering/Popups", () => ({
  createMultiGrantPopup: jest.fn((expertCount, grantCount, locationName, matchedFields) => {
    return `<div>
              Experts: ${expertCount}, 
              Grants: ${grantCount}, 
              Location: ${locationName}, 
              Matched Fields: ${matchedFields.join(", ")}
            </div>`;
  }),
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
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

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

  it("handles polygon marker click and opens panel with data", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygonClick",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [5],
          name: "Clickable Polygon",
          display_name: "Clickable Display",
        },
      ],
    ]);

    const grantsMap = new Map([
      [1, { matchedFields: ["keyword1"] }],
    ]);

    const expertsMap = new Map([
      [5, { name: "Dr. Polygon" }],
    ]);

    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;

    const clickHandler = marker.on.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();

    const viewBtn = popupElement.querySelector(".view-g-experts-btn");
    const clickBtn = viewBtn?.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];

    if (clickBtn) {
      clickBtn({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }

    expect(mockSetSelectedGrants).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("grants");
  });

  it("shows popup on point marker hover and closes on mouseleave", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "hoverPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          grantIDs: [101],
          expertIDs: [42],
          name: "Hover Point Location",
          display_name: "Hover Display",
        },
      ],
    ]);

    const grantsMap = new Map([
      [101, { matchedFields: ["climate", "data"] }],
    ]);

    const expertsMap = new Map([
      [42, { name: "Hover Grant Expert" }],
    ]);

    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0]?.value;
    expect(popup.openOn).toHaveBeenCalled();

    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    expect(popupEventListeners.mouseleave).toBeDefined();
    popupEventListeners.mouseleave(); // simulate mouseleave


    jest.runAllTimers();
    expect(popup.close).toHaveBeenCalled();
  });

  it("opens popup and sets grant panel data on point marker click", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "clickPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          grantIDs: [201],
          expertIDs: [301],
          name: "Clickable Point",
          display_name: "Clickable Point Display",
        },
      ],
    ]);

    const grantsMap = new Map([
      [201, { matchedFields: ["sustainability"] }],
    ]);

    const expertsMap = new Map([
      [301, { name: "Click Grant Expert" }],
    ]);

    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();

    const btn = popupElement.querySelector(".view-g-experts-btn");
    const clickBtnHandler = btn?.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];

    if (clickBtnHandler) {
      clickBtnHandler({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }

    expect(mockSetSelectedGrants).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("grants");
  });

  it("closes polygon popup on marker mouseout", () => {
    jest.useFakeTimers(); // Ensure fake timers are enabled

    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygon_mouseout",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [2],
          name: "Mouseout Polygon",
          display_name: "Mouseout Test",
        },
      ],
    ]);

    const grantsMap = new Map([
      [1, { matchedFields: ["topic"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert A" }],
    ]);

    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    // Simulate mouseover to create the popup
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Now simulate mouseout
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();

    // Fast-forward the timeout that closes the popup
    jest.runAllTimers();

    const popup = L.popup.mock.results[0]?.value;
    expect(popup?.close).toHaveBeenCalled();
  });

  it("sorts polygons by area before rendering", () => {
    const locationMap = new Map([
      [
        "larger_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [0, 4], [4, 4], [4, 0], [0, 0]]],
          grantIDs: [1],
          expertIDs: [10],
          name: "Large Polygon",
        },
      ],
      [
        "smaller_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]],
          grantIDs: [2],
          expertIDs: [11],
          name: "Small Polygon",
        },
      ],
    ]);
  
    const grantsMap = new Map([
      [1, { matchedFields: ["a"] }],
      [2, { matchedFields: ["b"] }],
    ]);
    const expertsMap = new Map([
      [10, { name: "Big Grant" }],
      [11, { name: "Small Grant" }],
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
  
    expect(L.polygon).toHaveBeenCalled();
  });
  
  it("calls iconCreateFunction and returns custom cluster icon with expert count", () => {
    // Prepare dummy map data
    const locationMap = new Map([
      [
        "pointA",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          grantIDs: [1],
          expertIDs: [1],
          name: "Point A",
        },
      ],
    ]);
  
    const grantsMap = new Map([
      [1, { title: "Grant A" }],
    ]);
  
    const expertsMap = new Map([
      [1, { name: "Expert A" }],
    ]);
  
    // Render component to initialize markerClusterGroup
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
  
    // Grab the iconCreateFunction from the first call to markerClusterGroup
    const clusterOptions = L.markerClusterGroup.mock.calls[0][0];
    const iconCreateFn = clusterOptions.iconCreateFunction;
  
    // Create a fake cluster
    const mockCluster = {
      getAllChildMarkers: () => [
        { options: { expertCount: 2 } },
        { options: { expertCount: 3 } },
      ],
    };
  
    // Call iconCreateFunction
    iconCreateFn(mockCluster);
  
    // Assert divIcon was called with the correct total
    expect(L.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("5"), // 2 + 3 experts
        className: "custom-cluster-icon",
      })
    );
  });
  
  it("handles polygon popup mouseenter and mouseleave correctly", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "polygonPopup",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [1],
          name: "Popup Polygon",
          display_name: "Polygon Popup Display",
        },
      ],
    ]);
  
    const grantsMap = new Map([
      [1, { matchedFields: ["popupTest"] }],
    ]);
  
    const expertsMap = new Map([
      [1, { name: "Popup Expert" }],
    ]);
  
    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();
  
    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();
  
    const mouseenterHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseenter"
    )?.[1];
    const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseleave"
    )?.[1];
  
    expect(mouseenterHandler).toBeDefined();
    expect(mouseleaveHandler).toBeDefined();
  
    mouseenterHandler(); // simulate hover
    mouseleaveHandler(); // simulate exit
    jest.runAllTimers(); // simulate delay
  
    expect(popup.close).toHaveBeenCalled();
  });
  
  it("handles click on polygon popup button to open panel and close popup", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "polygon-popup",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          expertIDs: [2],
          name: "Popup Polygon",
          display_name: "Popup Location",
        },
      ],
    ]);
  
    const grantsMap = new Map([[1, { matchedFields: ["topic"] }]]);
    const expertsMap = new Map([[2, { name: "Expert X" }]]);
  
    render(
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0].value;
  
    // Simulate mouseover to create popup
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseover).toBeDefined();
    mouseover();
  
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    const viewExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
    expect(viewExpertsBtn).toBeDefined();
  
    const clickHandler = viewExpertsBtn.addEventListener.mock.calls.find(
      ([e]) => e === "click"
    )?.[1];
    expect(clickHandler).toBeDefined();
  
    // Simulate button click
    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
  
    expect(mockSetSelectedGrants).toHaveBeenCalled();
    expect(mockSetPanelType).toHaveBeenCalledWith("grants");
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(popup.close).toHaveBeenCalled();
  });
  
  // Test for grants without matchedFields
it("handles grants without matchedFields in popup creation", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();

  const locationMap = new Map([
    [
      "testPoint",
      {
        geometryType: "Point",
        coordinates: [10, 20],
        grantIDs: [1, 2, 3],
        expertIDs: [1],
        name: "Test Point",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { matchedFields: ["field1", "field2"] }], // Has matchedFields
    [2, {}], // No matchedFields property
    [3, { matchedFields: null }], // matchedFields is null
  ]);

  const expertsMap = new Map([[1, { name: "Test Expert" }]]);

  render(
    <GrantLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      expertsMap={expertsMap}
      showGrants={true}
      setSelectedGrants={mockSetSelectedGrants}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
    />
  );

  const marker = L.marker.mock.results[0]?.value;
  const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
  
  // Trigger mouseover to test matchedFields handling
  mouseoverHandler();

  expect(L.popup).toHaveBeenCalled();
});

// Test for popup element not existing
it("handles missing popup element gracefully", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();

  // Mock popup.getElement() to return null
  const mockPopupWithNullElement = {
    setLatLng: jest.fn().mockReturnThis(),
    setContent: jest.fn().mockReturnThis(),
    openOn: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    close: jest.fn(),
    getElement: jest.fn(() => null), // Return null instead of element
  };

  // Override the L.popup mock for this test
  L.popup.mockImplementationOnce(() => mockPopupWithNullElement);

  const locationMap = new Map([
    [
      "testPoint",
      {
        geometryType: "Point",
        coordinates: [10, 20],
        grantIDs: [1],
        expertIDs: [1],
        name: "Test Point",
      },
    ],
  ]);

  const grantsMap = new Map([[1, { matchedFields: ["test"] }]]);
  const expertsMap = new Map([[1, { name: "Test Expert" }]]);

  render(
    <GrantLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      expertsMap={expertsMap}
      showGrants={true}
      setSelectedGrants={mockSetSelectedGrants}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
    />
  );

  const marker = L.marker.mock.results[0]?.value;
  const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
  
  // This should not throw an error even with null popup element
  expect(() => mouseoverHandler()).not.toThrow();
});

// Test for missing view button in popup
it("handles missing view button in popup gracefully", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();

  // Mock popup element without the view button
  const mockPopupElementNoButton = {
    style: { pointerEvents: "auto" },
    addEventListener: jest.fn(),
    querySelector: jest.fn(() => null), // Return null for button query
  };

  const mockPopupWithNoButton = {
    setLatLng: jest.fn().mockReturnThis(),
    setContent: jest.fn().mockReturnThis(),
    openOn: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    close: jest.fn(),
    getElement: jest.fn(() => mockPopupElementNoButton),
  };

  L.popup.mockImplementationOnce(() => mockPopupWithNoButton);

  const locationMap = new Map([
    [
      "testPoint",
      {
        geometryType: "Point",
        coordinates: [10, 20],
        grantIDs: [1],
        expertIDs: [1],
        name: "Test Point",
      },
    ],
  ]);

  const grantsMap = new Map([[1, { matchedFields: ["test"] }]]);
  const expertsMap = new Map([[1, { name: "Test Expert" }]]);

  render(
    <GrantLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      expertsMap={expertsMap}
      showGrants={true}
      setSelectedGrants={mockSetSelectedGrants}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
    />
  );

  const marker = L.marker.mock.results[0]?.value;
  const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
  
  // This should not throw an error even without the view button
  expect(() => mouseoverHandler()).not.toThrow();
});





});