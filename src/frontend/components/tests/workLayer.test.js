/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import WorkLayer from "../rendering/WorkLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

jest.useFakeTimers();

jest.mock("leaflet.markercluster", () => { });  // Mock leaflet.markercluster

// Mock react-leaflet
jest.mock("react-leaflet", () => ({
  useMap: jest.fn(),
}));

const popupEventListeners = {}; // Store popup event listeners for testing

const mockPopupElement = {  // Mock popup element
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

const mockButtonElement = { // Mock button element
  addEventListener: jest.fn(),
};

jest.mock("leaflet", () => {  // Mock Leaflet library
  const mockPolygonObject = {
    addTo: jest.fn().mockReturnThis(),
    getBounds: jest.fn(() => ({
      getCenter: jest.fn(() => ({ lat: 0, lng: 0 })),
      getEast: jest.fn(() => 2),
      getWest: jest.fn(() => 0),
      getNorth: jest.fn(() => 2),
      getSouth: jest.fn(() => 0),
    })),
    getCenter: jest.fn(() => ({ lat: 0, lng: 0 })),
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

jest.mock("../rendering/Popups", () => ({ // Mock Popups module
  createMultiExpertContent: jest.fn((expertCount, locationName, workCount, matchedFields) => {
    return `<div>
              Experts: ${expertCount}, 
              Works: ${workCount}, 
              Location: ${locationName}, 
              Matched Fields: ${matchedFields.join(", ")}
            </div>`;
  }),
}));

jest.mock("../rendering/utils/preparePanelData", () => ({ // Mock preparePanelData function
  prepareWorkPanelData: jest.fn(() => ({
    expertIDs: [2],
    workIDs: [1],
  })),
}));

describe("WorkLayer component", () => {
  let mockMap;

  beforeEach(() => {  // Setup before each test
    mockMap = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    };
    useMap.mockReturnValue(mockMap);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders polygons and points when showWorks is true", () => {
    const locationMap = { // Mock locationMap with polygons and points
      loc1: {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      workIDs: [1],
      expertIDs: [2],
      name: "Polygon A",
      },
      loc2: {
      geometryType: "Point",
      coordinates: [0, 0],
      workIDs: [3],
      expertIDs: [4],
      name: "Point B",
      },
    };

    const worksMap = {
      1: { matchedFields: ["field1"] },
      3: { matchedFields: ["field2"] },
    };

    const expertsMap = {
      2: { name: "Expert 1" },
      4: { name: "Expert 2" },
    };

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

    // Verify that polygons, markers, and clusters were created
    expect(L.markerClusterGroup).toHaveBeenCalled();
    expect(L.polygon).toHaveBeenCalled();
    expect(L.marker).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled();
  });

  it("does not render anything when showWorks is false", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });  // Suppress console errors

    render(
      <WorkLayer
        locationMap={{}}
        worksMap={{}}
        expertsMap={{}}
        showWorks={false}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );

    expect(consoleSpy).toHaveBeenCalledWith("Error: No works found!");  // Check for error message
    expect(mockMap.addLayer).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles polygon marker click and opens panel with data", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      polygonClick: {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      workIDs: [1],
      expertIDs: [5],
      name: "Clickable Polygon",
      display_name: "Clickable Display",
      },
    };

    const worksMap = {
      1: { matchedFields: ["keyword1"] },
    };

    const expertsMap = {
      5: { name: "Dr. Polygon" },
    };

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

    // Simulate a click event on the marker
    const clickHandler = marker.on.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();

    // Simulate clicking the "view experts" button inside the popup
    const viewBtn = popupElement.querySelector(".view-w-experts-btn");
    const clickBtn = viewBtn?.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];

    if (clickBtn) {
      clickBtn({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }

    // Verify that the appropriate handlers were called
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
  });

  it("shows popup on point marker hover and closes on mouseleave", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      hoverPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [101],
      expertIDs: [42],
      name: "Hover Point Location",
      display_name: "Hover Display",
      },
    };

    const worksMap = {
      101: { matchedFields: ["climate", "data"] },
    };

    const expertsMap = {
      42: { name: "Hover Work Expert" },
    };

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

    // Retrieve the first marker and simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Verify that the popup was opened
    const popup = L.popup.mock.results[0]?.value;
    expect(popup.openOn).toHaveBeenCalled();

    // Simulate mouseleave to close the popup
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    expect(popupEventListeners.mouseleave).toBeDefined();
    popupEventListeners.mouseleave();

    // Fast-forward timers and verify that the popup was closed
    jest.runAllTimers();
    expect(popup.close).toHaveBeenCalled();
  });


  it("opens popup and sets work panel data on point marker click", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = { // Mock locationMap with a clickable point
      clickPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [201],
      expertIDs: [301],
      name: "Clickable Point",
      display_name: "Clickable Point Display",
      },
    };

    const worksMap = {
      201: { matchedFields: ["sustainability"] },
    };

    const expertsMap = {
      301: { name: "Click Work Expert" },
    };

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
     // Simulate a click event on the marker
    const marker = L.marker.mock.results[0]?.value;
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();
    // Retrieve the popup and simulate clicking the "view experts" button
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
    // Verify that the appropriate handlers were called
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
  });

  it("calls iconCreateFunction and returns custom cluster icon with expert count", () => {
    const locationMap = { // Mock locationMap with a point
      pointA: {
      geometryType: "Point",
      coordinates: [0, 0],
      workIDs: [1],
      expertIDs: [1],
      name: "Point A",
      },
    };

    const worksMap = {
      1: { title: "Work A" },
    };

    const expertsMap = {
      1: { name: "Expert A" },
    };

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
    
    // Retrieve cluster options and the icon creation function
    const clusterOptions = L.markerClusterGroup.mock.calls[0][0];
    const iconCreateFn = clusterOptions.iconCreateFunction;
    // Mock a cluster with child markers containing expert counts
    const mockCluster = {
      getAllChildMarkers: () => [
        { options: { expertCount: 2 } },
        { options: { expertCount: 3 } },
      ],
    };

    iconCreateFn(mockCluster);  // Call the icon creation function with the mock cluster

    // Verify that the divIcon was created with the correct HTML expert count and className
    expect(L.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("5"),
        className: "custom-cluster-icon",
      })
    );
  });

  it("handles polygon popup mouseenter and mouseleave correctly", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      polygonPopup: {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      workIDs: [1],
      expertIDs: [1],
      name: "Popup Polygon",
      display_name: "Polygon Popup Display",
      },
    };

    const worksMap = {
      1: { matchedFields: ["popupTest"] },
    };

    const expertsMap = {
      1: { name: "Popup Expert" },
    };

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
    // Simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    const mouseenterHandler = popupElement.addEventListener.mock.calls.find(  // Find mouseenter handler
      ([event]) => event === "mouseenter"
    )?.[1];
    const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(  // Find mouseleave handler
      ([event]) => event === "mouseleave"
    )?.[1];

    expect(mouseenterHandler).toBeDefined();
    expect(mouseleaveHandler).toBeDefined();

    mouseenterHandler();  // Simulate mouseenter
    mouseleaveHandler();  // Simulate mouseleave
    jest.runAllTimers();  // Fast-forward timers to trigger popup close

    expect(popup.close).toHaveBeenCalled(); // Verify that the popup was closed
  });

  it("handles click on polygon popup button to open panel and close popup", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      "polygon-popup": {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      workIDs: [1],
      expertIDs: [2],
      name: "Popup Polygon",
      display_name: "Popup Location",
      },
    };

    const worksMap = { 1: { matchedFields: ["topic"] } };
    const expertsMap = { 2: { name: "Expert X" } };

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

    // Simulate mouseover to open the popup
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseover).toBeDefined();
    mouseover();

    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();

    // Simulate clicking the "view experts" button in the popup
    const viewExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
    expect(viewExpertsBtn).toBeDefined();

    // Mock the addEventListener for the button
    const clickHandler = viewExpertsBtn.addEventListener.mock.calls.find(
      ([e]) => e === "click"
    )?.[1];
    expect(clickHandler).toBeDefined();

    // Simulate the click event
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

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [1, 2, 3],
      expertIDs: [1],
      name: "Test Point",
      },
    };

    const worksMap = {
      1: { matchedFields: ["field1", "field2"] },
      2: {},
      3: { matchedFields: null },
    };

    const expertsMap = {
      1: { name: "Test Expert" },
    };

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
    // Simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    // Check if mouseover handler is defined
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    expect(L.popup).toHaveBeenCalled();
  });

  it("handles missing popup element gracefully", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const mockPopupWithNullElement = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      close: jest.fn(),
      getElement: jest.fn(() => null),
    };

    L.popup.mockImplementationOnce(() => mockPopupWithNullElement);

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [1],
      expertIDs: [1],
      name: "Test Point",
      },
    };

    const worksMap = { 1: { matchedFields: ["test"] } };
    const expertsMap = { 1: { name: "Test Expert" } };

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

    expect(() => mouseoverHandler()).not.toThrow();
  });

  it("handles missing view button in popup gracefully", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    // Mock a popup element that does not contain the view button
    const mockPopupElementNoButton = {
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => null),
    };
    // Mock the popup to return the element without the button
    const mockPopupWithNoButton = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      remove: jest.fn(),
      close: jest.fn(),
      getElement: jest.fn(() => mockPopupElementNoButton),
    };

    L.popup.mockImplementationOnce(() => mockPopupWithNoButton);

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [1],
      expertIDs: [1],
      name: "Test Point",
      },
    };

    const worksMap = { 1: { matchedFields: ["test"] } };
    const expertsMap = { 1: { name: "Test Expert" } };

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
    // Simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    
    expect(() => mouseoverHandler()).not.toThrow();
  });

  it("clears popup close timeout on mouseenter", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      hoverCancel: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [1],
      expertIDs: [2],
      name: "Hover Cancel Test",
      },
    };

    const worksMap = { 1: { matchedFields: ["energy"] } };
    const expertsMap = { 2: { name: "Dr. Hover" } };

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
    mouseover();
    // Verify that the popup was opened
    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
    const mouseleave = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseleave")?.[1];
    const mouseenter = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseenter")?.[1];

    mouseleave(); // Simulate mouseleave to set a timeout for closing the popup
    const clearSpy = jest.spyOn(global, "clearTimeout");  // Spy on clearTimeout
    mouseenter(); // Simulate mouseenter to clear the timeout
    expect(clearSpy).toHaveBeenCalled();  // Verify that clearTimeout was called
    clearSpy.mockRestore(); // Restore the original clearTimeout function
  });

  it("removes existing workPointPopup before creating a new one", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [1],
      expertIDs: [2],
      name: "Test Point",
      display_name: "Test Display"
      },
    };

    const worksMap = { 1: { matchedFields: ["field1"] } };
    const expertsMap = { 2: { name: "Test Expert" } };

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
    // Simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler(); // Open the popup
    const firstPopup = L.popup.mock.results[0]?.value;
    expect(firstPopup).toBeDefined();
    mouseoverHandler(); // Open the popup again to trigger removal of the previous one
    expect(firstPopup.remove).toHaveBeenCalled();
  });

  it("clears workPointCT timeout on mouseover", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      workIDs: [1],
      expertIDs: [2],
      name: "Test Point",
      display_name: "Test Display"
      },
    };

    const worksMap = { 1: { matchedFields: ["field1"] } };
    const expertsMap = { 2: { name: "Test Expert" } };

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
    // Simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();
    // Spy on clearTimeout to ensure it is called
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined(); // Get the mouseover handler
    mouseoverHandler(); // Simulate mouseover to clear the timeout
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();  // Restore the original clearTimeout function
  });

  it("renders polygons and handles events", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      polygon_test: {
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
    };

    const worksMap = { 1: { matchedFields: ["field1"] } };
    const expertsMap = { 2: { name: "Test Expert" } };

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
    // Check if the polygon was added to the map
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();
    // Check if the popup was created
    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();
    expect(L.popup).toHaveBeenCalledWith( // Check popup options
      expect.objectContaining({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
    );
    // Check if the popup content was set correctly
    const mouseleaveHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseleaveHandler).toBeDefined();
    mouseleaveHandler();
    jest.runAllTimers();
    expect(popup.close).toHaveBeenCalled();
    // Check if the popup element was created and contains the button
    const popupElement = popup.getElement();
    const button = popupElement.querySelector(".view-w-experts-btn");
    expect(button).toBeDefined();
    // Check if the button has the correct class and text
    const clickHandler = button.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

    expect(mockSetSelectedWorks).toHaveBeenCalledWith(  // Check if the selected works were set correctly
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

    // Mock the necessary functions and objects
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      polygon_test: {
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
    };

    const worksMap = { 1: { matchedFields: ["field1"] } };
    const expertsMap = { 2: { name: "Test Expert" } };

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
    // Check if the polygon was created
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();
    // Simulate mouseover to open the popup
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();
    // Spy on clearTimeout to ensure it is called
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();
    // Verify that clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();

    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();
    expect(L.popup).toHaveBeenCalledWith( // Check popup options
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

    expect(popup.openOn).toHaveBeenCalledWith(expect.any(Object));  // Check if the popup was opened on the map

    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    const mouseenterHandler = popupElement.addEventListener.mock.calls.find(  // Find mouseenter handler
      ([event]) => event === "mouseenter"
    )?.[1];
    expect(mouseenterHandler).toBeDefined();

    const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(  // Find mouseleave handler
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

    const locationMap = {
      "no-matched-fields": {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      workIDs: [1],
      expertIDs: [2],
      name: "No Fields Polygon",
      display_name: "Polygon",
      },
    };

    const worksMap = {
      1: { title: "Work with no fields" },
    };

    const expertsMap = {
      2: { name: "No Fields Expert" },
    };

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

    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];  // Get the mouseover handler
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0]?.value; // Get the popup created by mouseover
    expect(popup).toBeDefined();
  });

  it("removes existing popup before creating a new one", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      "double-hover": {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      workIDs: [1],
      expertIDs: [2],
      name: "Popup Remover",
      display_name: "Popup Overwrite",
      },
    };

    const worksMap = {
      1: { matchedFields: ["field"] },
    };

    const expertsMap = {
      2: { name: "Expert A" },
    };

    const popupElement = {  // Mock popup element
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    };

    const popupMock = { // Mock popup methods
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      getElement: jest.fn(() => popupElement),
      close: jest.fn(),
      remove: jest.fn(),
    };

    L.popup // Mock the L.popup function to return our mock popup
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

    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];  // Get the mouseover handler
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    mouseoverHandler();

    expect(popupMock.remove).toHaveBeenCalled();  // Verify that the existing popup was removed
  });

  it("removes popup when clicking a second polygon", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      polygon1: {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [1, 0]]],
      workIDs: [1],
      expertIDs: [2],
      name: "First Polygon",
      display_name: "First Polygon",
      },
      polygon2: {
      geometryType: "Polygon",
      coordinates: [[[2, 2], [3, 3], [3, 2]]],
      workIDs: [3],
      expertIDs: [4],
      name: "Second Polygon",
      display_name: "Second Polygon",
      },
    };

    const worksMap = {
      1: { matchedFields: ["field1"] },
      3: { matchedFields: ["field2"] },
    };

    const expertsMap = {
      2: { name: "Expert A" },
      4: { name: "Expert B" },
    };

    const popupElement = {  // Mock popup element
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    };

    const popupMock = { // Mock popup methods
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      getElement: jest.fn(() => popupElement),
      close: jest.fn(),
      remove: jest.fn(),
    };

    L.popup // Mock the L.popup function to return our mock popup
      .mockReturnValueOnce(popupMock)
      .mockReturnValueOnce(popupMock);

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
    // Simulate mouseover on the first polygon
    const marker1 = L.marker.mock.results[0]?.value;
    const marker2 = L.marker.mock.results[1]?.value;

    // Simulate mouseover event for the first polygon
    const click1 = marker1.on.mock.calls.find(([e]) => e === "click")?.[1];
    const click2 = marker2.on.mock.calls.find(([e]) => e === "click")?.[1];

    click1(); // Simulate clicking the first polygon
    click2(); // Simulate clicking the second polygon

    expect(popupMock.remove).toHaveBeenCalled();  // Verify that the existing popup was removed
  });

  // it("handles view-w-experts-btn click in point popup and updates panel state", () => {
  //   const mockSetSelectedWorks = jest.fn();
  //   const mockSetPanelOpen = jest.fn();
  //   const mockSetPanelType = jest.fn();

  //   const locationMap = new Map([
  //     [
  //       "point-popup-btn",
  //       {
  //         geometryType: "Point",
  //         coordinates: [5, 10],
  //         workIDs: [101],
  //         expertIDs: [202],
  //         name: "Work Point",
  //         display_name: "Point Display",
  //       },
  //     ],
  //   ]);

  //   const worksMap = new Map([
  //     [101, { matchedFields: ["ai", "robotics"] }],
  //   ]);

  //   const expertsMap = new Map([
  //     [202, { name: "Dr. Robotics" }],
  //   ]);

  //   const prepareWorkPanelData = require("../rendering/utils/preparePanelData").prepareWorkPanelData; // Import the prepareWorkPanelData function
  //   prepareWorkPanelData.mockClear(); // Clear any previous calls to the mock

  //   render(
  //     <WorkLayer
  //       locationMap={locationMap}
  //       worksMap={worksMap}
  //       expertsMap={expertsMap}
  //       showWorks={true}
  //       setSelectedWorks={mockSetSelectedWorks}
  //       setPanelOpen={mockSetPanelOpen}
  //       setPanelType={mockSetPanelType}
  //     />
  //   );

  //   const marker = L.marker.mock.results[0]?.value;
  //   const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
  //   expect(mouseover).toBeDefined();
  //   mouseover();

  //   const popup = L.popup.mock.results[0]?.value;
  //   const popupElement = popup.getElement();
  //   const button = popupElement.querySelector(".view-w-experts-btn"); // Get the button from the popup
  //   expect(button).toBeDefined(); 

  //   const clickHandler = button.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];  // Get the click handler for the button
  //   expect(clickHandler).toBeDefined();

  //   const preventDefault = jest.fn(); // Mock preventDefault function
  //   const stopPropagation = jest.fn();  // Mock stopPropagation function

  //   clickHandler({ preventDefault, stopPropagation });  // Simulate the click event

  //   expect(preventDefault).toHaveBeenCalled();
  //   expect(stopPropagation).toHaveBeenCalled();

  //   expect(prepareWorkPanelData).toHaveBeenCalledWith(
  //     [202], [101], expertsMap, worksMap, "point-popup-btn", "Point Display"
  //   );

    // Verify that the appropriate handlers were called
  //   expect(mockSetSelectedWorks).toHaveBeenCalled();
  //   expect(mockSetPanelType).toHaveBeenCalledWith("works");
  //   expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
  //   expect(popup.close).toHaveBeenCalled();
  // });

  it("removes existing workPointPopup before creating a new one", () => {
    // Mock the necessary functions and objects
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      "popup-click": {
      geometryType: "Point",
      coordinates: [0, 0],
      workIDs: [101],
      expertIDs: [202],
      name: "Work Popup",
      display_name: "Click Test",
      },
    };

    const worksMap = {
      101: { matchedFields: ["test"] },
    };

    const expertsMap = {
      202: { name: "Dr. Work" },
    };

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
    // Simulate mouseover to open the popup
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    const clickHandler = marker.on.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined();

    clickHandler();
    // Check if the popup was created
    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();

    // Check if the popup was opened on the map
    clickHandler();

    expect(popup.remove).toHaveBeenCalled(); // Verify that the existing popup was removed
  });


});
