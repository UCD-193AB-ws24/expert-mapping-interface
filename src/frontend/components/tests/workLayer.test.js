/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import WorkLayer from "../rendering/WorkLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

jest.useFakeTimers();

jest.mock("leaflet.markercluster", () => { });

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
    if (selector === ".view-w-experts-btn") {
      return mockButtonElement;
    }
    return null;
  }),
};

const mockButtonElement = {
  addEventListener: jest.fn(),
};

jest.mock("leaflet", () => {
  const mockPolygonObject = {
    addTo: jest.fn().mockReturnThis(),
    getBounds: jest.fn(() => ({
      getCenter: jest.fn(() => ({ lat: 0, lng: 0 })),
      getEast: jest.fn(() => 2),
      getWest: jest.fn(() => 0),
      getNorth: jest.fn(() => 2),
      getSouth: jest.fn(() => 0),
    })),
    getCenter: jest.fn(() => ({ lat: 0, lng: 0 })), // needed for some WorkLayer logic
  };

  const mockMarkerObject = {
    addTo: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    getLatLng: jest.fn(() => ({ lat: 0, lng: 0 })),
    options: { expertCount: 2 },
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
    polygon: jest.fn(() => mockPolygonObject),
    marker: jest.fn(() => mockMarkerObject),
    popup: jest.fn(() => mockPopupObject),
    markerClusterGroup: jest.fn(() => mockMarkerClusterGroupObject),
    divIcon: jest.fn(() => ({ options: { html: "" } })),
    point: jest.fn(() => [40, 40]),
  };
});

jest.mock("../rendering/Popups", () => ({
  createMultiExpertContent: jest.fn((expertCount, locationName, workCount, matchedFields) => {
    return `<div>
              Experts: ${expertCount}, 
              Works: ${workCount}, 
              Location: ${locationName}, 
              Matched Fields: ${matchedFields.join(", ")}
            </div>`;
  }),
}));

jest.mock("../rendering/utils/preparePanelData", () => ({
  prepareWorkPanelData: jest.fn(() => ({
    expertIDs: [2],
    workIDs: [1],
  })),
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

  // ✅ Converted: Initializes and adds layer group when showWorks is true
  it("renders polygons and points when showWorks is true", () => {
    const locationMap = new Map([
      [
        "loc1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [2],
          name: "Polygon A",
        },
      ],
      [
        "loc2",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          workIDs: [3],
          expertIDs: [4],
          name: "Point B",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["field1"] }],
      [3, { matchedFields: ["field2"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert 1" }],
      [4, { name: "Expert 2" }],
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

  it("does not render anything when showWorks is false", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

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

  it("handles polygon marker click and opens panel with data", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygonClick",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [5],
          name: "Clickable Polygon",
          display_name: "Clickable Display",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["keyword1"] }],
    ]);

    const expertsMap = new Map([
      [5, { name: "Dr. Polygon" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
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

    const viewBtn = popupElement.querySelector(".view-w-experts-btn");
    const clickBtn = viewBtn?.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];

    if (clickBtn) {
      clickBtn({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }

    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
  });

  it("shows popup on point marker hover and closes on mouseleave", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "hoverPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [101],
          expertIDs: [42],
          name: "Hover Point Location",
          display_name: "Hover Display",
        },
      ],
    ]);

    const worksMap = new Map([
      [101, { matchedFields: ["climate", "data"] }],
    ]);

    const expertsMap = new Map([
      [42, { name: "Hover Work Expert" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
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

  it("opens popup and sets work panel data on point marker click", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "clickPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [201],
          expertIDs: [301],
          name: "Clickable Point",
          display_name: "Clickable Point Display",
        },
      ],
    ]);

    const worksMap = new Map([
      [201, { matchedFields: ["sustainability"] }],
    ]);

    const expertsMap = new Map([
      [301, { name: "Click Work Expert" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
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

    const btn = popupElement.querySelector(".view-w-experts-btn");
    const clickBtnHandler = btn?.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];

    if (clickBtnHandler) {
      clickBtnHandler({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }

    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
  });

  it("closes polygon popup on marker mouseout", () => {
    jest.useFakeTimers(); // Ensure fake timers are enabled

    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygon_mouseout",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [2],
          name: "Mouseout Polygon",
          display_name: "Mouseout Test",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["topic"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert A" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
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

    // Simulate mouseout to start the close timeout
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
          workIDs: [1],
          expertIDs: [10],
          name: "Large Polygon",
        },
      ],
      [
        "smaller_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]],
          workIDs: [2],
          expertIDs: [11],
          name: "Small Polygon",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["a"] }],
      [2, { matchedFields: ["b"] }],
    ]);

    const expertsMap = new Map([
      [10, { name: "Big Work" }],
      [11, { name: "Small Work" }],
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
          workIDs: [1],
          expertIDs: [1],
          name: "Point A",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { title: "Work A" }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Expert A" }],
    ]);

    // Render component to initialize markerClusterGroup
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
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygonPopup",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [1],
          name: "Popup Polygon",
          display_name: "Polygon Popup Display",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["popupTest"] }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Popup Expert" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
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
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygon-popup",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [2],
          name: "Popup Polygon",
          display_name: "Popup Location",
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["topic"] }]]);
    const expertsMap = new Map([[2, { name: "Expert X" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
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

    const viewExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
    expect(viewExpertsBtn).toBeDefined();

    const clickHandler = viewExpertsBtn.addEventListener.mock.calls.find(
      ([e]) => e === "click"
    )?.[1];
    expect(clickHandler).toBeDefined();

    // Simulate button click
    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(popup.close).toHaveBeenCalled();
  });

  it("handles works without matchedFields in popup creation", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "testPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [1, 2, 3],
          expertIDs: [1],
          name: "Test Point",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["field1", "field2"] }], // Has matchedFields
      [2, {}], // No matchedFields
      [3, { matchedFields: null }], // Null matchedFields
    ]);

    const expertsMap = new Map([[1, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];

    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    expect(L.popup).toHaveBeenCalled();
  });

  it("handles missing popup element gracefully", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    // Mock popup.getElement() to return null
    const mockPopupWithNullElement = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      close: jest.fn(),
      getElement: jest.fn(() => null), // Simulate missing DOM element
    };

    // Override popup for this test
    L.popup.mockImplementationOnce(() => mockPopupWithNullElement);

    const locationMap = new Map([
      [
        "testPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [1],
          expertIDs: [1],
          name: "Test Point",
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["test"] }]]);
    const expertsMap = new Map([[1, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];

    // Should not crash even if popup element is null
    expect(() => mouseoverHandler()).not.toThrow();
  });

  it("handles missing view button in popup gracefully", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    // Simulate a popup element with no view-w-experts-btn
    const mockPopupElementNoButton = {
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => null), // No button found
    };

    const mockPopupWithNoButton = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      close: jest.fn(),
      getElement: jest.fn(() => mockPopupElementNoButton),
    };

    // Override popup instance for this test
    L.popup.mockImplementationOnce(() => mockPopupWithNoButton);

    const locationMap = new Map([
      [
        "testPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [1],
          expertIDs: [1],
          name: "Test Point",
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["test"] }]]);
    const expertsMap = new Map([[1, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];

    expect(() => mouseoverHandler()).not.toThrow(); // should not crash
  });

  it("clears popup close timeout on mouseenter", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "hoverCancel",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [1],
          expertIDs: [2],
          name: "Hover Cancel Test",
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["energy"] }]]);
    const expertsMap = new Map([[2, { name: "Dr. Hover" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;

    // Trigger popup creation
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    mouseover();

    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();

    // Grab event handlers
    const mouseleave = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseleave")?.[1];
    const mouseenter = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseenter")?.[1];

    // Simulate leave → triggers close timeout
    mouseleave();

    const clearSpy = jest.spyOn(global, "clearTimeout");

    // Simulate enter → should cancel the timeout
    mouseenter();

    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
  });


  it("removes existing workPointPopup before creating a new one", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "testPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [1],
          expertIDs: [2],
          name: "Test Point",
          display_name: "Test Display"
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["field1"] }]]);
    const expertsMap = new Map([[2, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;

    // Simulate mouseover to create the first popup
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const firstPopup = L.popup.mock.results[0]?.value;
    expect(firstPopup).toBeDefined();

    // Simulate mouseover again to trigger the removal of the existing popup
    mouseoverHandler();

    // Assert that the first popup was removed
    expect(firstPopup.remove).toHaveBeenCalled();
  });

  it("clears workPointCT timeout on mouseover", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "testPoint",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          workIDs: [1],
          expertIDs: [2],
          name: "Test Point",
          display_name: "Test Display"
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["field1"] }]]);
    const expertsMap = new Map([[2, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;

    // Simulate mouseout to set workPointCT
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();

    // Spy on clearTimeout
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    // Simulate mouseover to clear workPointCT
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it("renders polygons and handles events", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygon_test",
        {
          geometryType: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
          workIDs: [1],
          expertIDs: [2],
          name: "Test Polygon",
          display_name: "Test Polygon Display",
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["field1"] }]]);
    const expertsMap = new Map([[2, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const polygon = L.polygon.mock.results[0]?.value;
    expect(polygon).toBeDefined();
    expect(L.polygon).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        color: "#3879C7",
        fillColor: "#4783CB",
        fillOpacity: 0.6,
        weight: 2,
      })
    );

    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();
    expect(L.popup).toHaveBeenCalledWith(
      expect.objectContaining({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
    );

    const mouseleaveHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseleaveHandler).toBeDefined();
    mouseleaveHandler();
    jest.runAllTimers();
    expect(popup.close).toHaveBeenCalled();

    const popupElement = popup.getElement();
    const button = popupElement.querySelector(".view-w-experts-btn");
    expect(button).toBeDefined();

    const clickHandler = button.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

    expect(mockSetSelectedWorks).toHaveBeenCalledWith(
      expect.objectContaining({
        expertIDs: [2],
        workIDs: [1],
      })
    );
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
    expect(popup.close).toHaveBeenCalled();
  });

  it("handles polygon marker mouseover and creates a popup", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygon_test",
        {
          geometryType: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
          workIDs: [1],
          expertIDs: [2],
          name: "Test Polygon",
          display_name: "Test Polygon Display",
        },
      ],
    ]);

    const worksMap = new Map([[1, { matchedFields: ["field1"] }]]);
    const expertsMap = new Map([[2, { name: "Test Expert" }]]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    // Simulate mouseout to set timeout
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();

    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    // Simulate mouseover to clear timeout and trigger popup
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();
    expect(L.popup).toHaveBeenCalledWith(
      expect.objectContaining({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
    );

    expect(popup.setContent).toHaveBeenCalledWith(
      expect.stringContaining("Test Polygon")
    );

    expect(popup.openOn).toHaveBeenCalledWith(expect.any(Object));

    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    const mouseenterHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseenter"
    )?.[1];
    expect(mouseenterHandler).toBeDefined();

    const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseleave"
    )?.[1];
    expect(mouseleaveHandler).toBeDefined();

    mouseleaveHandler();
    jest.runAllTimers();
    expect(popup.close).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it("handles polygon popup when works have no matchedFields", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "no-matched-fields",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [2],
          name: "No Fields Polygon",
          display_name: "Polygon",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { title: "Work with no fields" }], // 👈 no matchedFields
    ]);

    const expertsMap = new Map([
      [2, { name: "No Fields Expert" }],
    ]);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler(); // 👈 This triggers the popup creation

    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();
  });

  it("removes existing popup before creating a new one", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "double-hover",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          workIDs: [1],
          expertIDs: [2],
          name: "Popup Remover",
          display_name: "Popup Overwrite",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["field"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert A" }],
    ]);

    const popupElement = {
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    };

    const popupMock = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      getElement: jest.fn(() => popupElement),
      close: jest.fn(),
      remove: jest.fn(),
    };

    // Simulate reused popup for hover
    L.popup
      .mockReturnValueOnce(popupMock)
      .mockReturnValueOnce(popupMock);

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    // Trigger first hover — creates popup
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Trigger second hover — should remove existing
    mouseoverHandler();

    expect(popupMock.remove).toHaveBeenCalled();
  });

  it("removes popup when clicking a second polygon", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = new Map([
      [
        "polygon1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [1, 0]]],
          workIDs: [1],
          expertIDs: [2],
          name: "First Polygon",
          display_name: "First Polygon",
        },
      ],
      [
        "polygon2",
        {
          geometryType: "Polygon",
          coordinates: [[[2, 2], [3, 3], [3, 2]]],
          workIDs: [3],
          expertIDs: [4],
          name: "Second Polygon",
          display_name: "Second Polygon",
        },
      ],
    ]);

    const worksMap = new Map([
      [1, { matchedFields: ["field1"] }],
      [3, { matchedFields: ["field2"] }],
    ]);

    const expertsMap = new Map([
      [2, { name: "Expert A" }],
      [4, { name: "Expert B" }],
    ]);

    const popupElement = {
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    };

    const popupMock = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      getElement: jest.fn(() => popupElement),
      close: jest.fn(),
      remove: jest.fn(),
    };

    L.popup
      .mockReturnValueOnce(popupMock) // popup for first polygon
      .mockReturnValueOnce(popupMock); // popup for second polygon

    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        isMobileView={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker1 = L.marker.mock.results[0]?.value;
    const marker2 = L.marker.mock.results[1]?.value;

    const click1 = marker1.on.mock.calls.find(([e]) => e === "click")?.[1];
    const click2 = marker2.on.mock.calls.find(([e]) => e === "click")?.[1];

    click1(); // First polygon popup
    click2(); // Should remove the first popup

    expect(popupMock.remove).toHaveBeenCalled();
  });

  it("handles view-w-experts-btn click in point popup and updates panel state", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "point-popup-btn",
        {
          geometryType: "Point",
          coordinates: [5, 10],
          workIDs: [101],
          expertIDs: [202],
          name: "Work Point",
          display_name: "Point Display",
        },
      ],
    ]);
  
    const worksMap = new Map([
      [101, { matchedFields: ["ai", "robotics"] }],
    ]);
  
    const expertsMap = new Map([
      [202, { name: "Dr. Robotics" }],
    ]);
  
    // Spy on prepareWorkPanelData
    const prepareWorkPanelData = require("../rendering/utils/preparePanelData").prepareWorkPanelData;
    prepareWorkPanelData.mockClear();
  
    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0]?.value;
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseover).toBeDefined();
    mouseover();
  
    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
    const button = popupElement.querySelector(".view-w-experts-btn");
    expect(button).toBeDefined();
  
    const clickHandler = button.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined();
  
    const preventDefault = jest.fn();
    const stopPropagation = jest.fn();
  
    clickHandler({ preventDefault, stopPropagation });
  
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  
    expect(prepareWorkPanelData).toHaveBeenCalledWith(
      [202], [101], expertsMap, worksMap, "point-popup-btn", "Point Display"
    );
  
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(popup.close).toHaveBeenCalled();
  });

  it("removes existing workPointPopup before creating a new one", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "popup-click",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          workIDs: [101],
          expertIDs: [202],
          name: "Work Popup",
          display_name: "Click Test",
        },
      ],
    ]);
  
    const worksMap = new Map([
      [101, { matchedFields: ["test"] }],
    ]);
  
    const expertsMap = new Map([
      [202, { name: "Dr. Work" }],
    ]);
  
    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();
  
    const clickHandler = marker.on.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined();
  
    // 🟢 First click creates popup
    clickHandler();
  
    // Get the created popup
    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();
  
    
    clickHandler();
  
    expect(popup.remove).toHaveBeenCalled(); 
  });
  

});
