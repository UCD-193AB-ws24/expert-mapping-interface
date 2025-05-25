/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import WorkLayer from "../rendering/WorkLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

jest.useFakeTimers();

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
        querySelector: jest.fn(() => mockButtonElement),
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

const mockButtonElement = {
    addEventListener: jest.fn(),
  };
  
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

  //329-335 - keeper
  it("closes popup on popup mouseleave for renderPoints", () => {
    jest.useFakeTimers();
  
    const locationMap = new Map([
      [
        "point1",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          expertIDs: [1],
          workIDs: [10],
          name: "Point 1",
          display_name: "Point 1 Display",
        },
      ],
    ]);
  
    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={new Map()}
        expertsMap={new Map()}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );
  
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    // Simulate mouseleave event
    const mouseLeaveHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseleave"
    )?.[1];
  
    if (mouseLeaveHandler) {
      mouseLeaveHandler();
    }
  
    // Fast-forward the timer
    jest.advanceTimersByTime(200);
  
    // Verify that popup.close() was called
    expect(popup.close).toHaveBeenCalled();
  });
  
  // Test: Handles point marker hover interactions - keeper
  it("handles polygon marker click events and opens panel", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "polygon_click",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1, 2],
          workIDs: [10],
          name: "Click Polygon",
          display_name: "Test Click Polygon",
        },
      ],
    ]);
  
    render(
      <WorkLayer
        locationMap={locationMap}
        worksMap={new Map()}
        expertsMap={new Map()}
        showWorks={true}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0].value;
  
    // Trigger the click handler
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    if (clickHandler) clickHandler();
  
    // Verify popup creation
    expect(L.popup).toHaveBeenCalled();
  });


  //103-171 - keeper
  it("handles polygon marker mouseover to show popup with matched fields", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "hover_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1],
          workIDs: [10],
          name: "Hover Polygon",
          display_name: "Hover Polygon Display"
        },
      ],
    ]);
  
    const worksMap = new Map([
      [10, { title: "Hover Work", matchedFields: ["data", "field"] }],
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
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0].value;
  
    // Trigger the mouseover handler
    const mouseoverHandler = marker.on.mock.calls.find(
      ([event]) => event === "mouseover"
    )?.[1];
  
    if (mouseoverHandler) {
      mouseoverHandler(); // Simulate hover
    }
  
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    expect(L.popup).toHaveBeenCalled();
    expect(popup.setContent).toHaveBeenCalledWith(expect.stringContaining("Mock expert popup content"));
    expect(popup.openOn).toHaveBeenCalled();
  
    // Trigger mouseenter (for popup element)
    const mouseEnterListener = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseenter"
    )?.[1];
  
    if (mouseEnterListener) {
      mouseEnterListener();
    }
  
    // Trigger mouseleave
    const mouseLeaveListener = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseleave"
    )?.[1];
  
    if (mouseLeaveListener) {
      mouseLeaveListener();
      jest.runAllTimers(); // Run timeout from mouseleave
    }
  
    // Trigger the "view experts" button click logic
    const btn = popupElement.querySelector(".view-w-experts-btn");
    const clickHandler = btn?.addEventListener.mock.calls.find(
      ([event]) => event === "click"
    )?.[1];
  
    if (clickHandler) {
      clickHandler({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }
  
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
  });
  
  //178-182 - keeper
  it("calls mouseout handler to close polygon popup", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "test_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1],
          workIDs: [10],
          name: "Test Polygon",
          display_name: "Test Polygon Display"
        },
      ],
    ]);
  
    const worksMap = new Map([
      [10, { title: "Test Work", matchedFields: ["keyword"] }],
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
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0].value;
  
    // Find the mouseout handler
    const mouseoutHandler = marker.on.mock.calls.find(
      ([event]) => event === "mouseout"
    )?.[1];
  
    // Call it directly
    if (mouseoutHandler) {
      mouseoutHandler();
    }
  
    // Wait for setTimeout to run
    jest.runAllTimers();
  });

  //189-243 - keeper
  it("handles polygon marker click to open popup and set panel data", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "click_polygon",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          expertIDs: [1, 2],
          workIDs: [10, 20],
          name: "Click Polygon",
          display_name: "Click Polygon Display"
        },
      ],
    ]);
  
    const worksMap = new Map([
      [10, { title: "Work 1", matchedFields: ["field1"] }],
      [20, { title: "Work 2", matchedFields: ["field2"] }],
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
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    // Get the polygon marker
    const marker = L.marker.mock.results[0].value;
  
    // Get the click handler
    const clickHandler = marker.on.mock.calls.find(
      ([event]) => event === "click"
    )?.[1];
  
    // Trigger the click
    if (clickHandler) clickHandler();
  
    // Simulate clicking the button inside the popup
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    const btn = popupElement.querySelector(".view-w-experts-btn");
    const clickListener = btn?.addEventListener.mock.calls.find(
      ([event]) => event === "click"
    )?.[1];
  
    if (clickListener) {
      clickListener({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }
  
    // Assert the panel update functions were called
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
  });

  //375-428 - keeper
  it("handles point marker click to open popup and set panel data", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "click_point",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          expertIDs: [1],
          workIDs: [100],
          name: "Click Point",
          display_name: "Click Point Display",
        },
      ],
    ]);
  
    const worksMap = new Map([
      [100, { title: "Click Work", matchedFields: ["topic", "method"] }],
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
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0].value;
  
    // Trigger the click handler manually
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    if (clickHandler) {
      clickHandler();
    }

    const btnClickHandler = mockButtonElement.addEventListener.mock.calls.find(
        ([event]) => event === "click"
      )?.[1];
      
      if (btnClickHandler) {
        btnClickHandler({
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        });
      }
  
    // Access popup
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    // Verify results
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
    expect(popup.close).toHaveBeenCalled();
  });

  
  //291-357 - keeper
  it("handles point marker mouseover to show popup with matched fields", () => {
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    const locationMap = new Map([
      [
        "hover_point",
        {
          geometryType: "Point",
          coordinates: [10, 20],
          expertIDs: [1],
          workIDs: [100],
          name: "Hover Point",
          display_name: "Hover Point Display"
        },
      ],
    ]);
  
    const worksMap = new Map([
      [100, { title: "Hover Work", matchedFields: ["data", "analysis"] }],
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
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );
  
    const marker = L.marker.mock.results[0].value;
  
    // Trigger the mouseover handler
    const mouseoverHandler = marker.on.mock.calls.find(
      ([event]) => event === "mouseover"
    )?.[1];
  
    if (mouseoverHandler) {
      mouseoverHandler(); // Simulate hover
    }
  
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    expect(L.popup).toHaveBeenCalled();
    expect(popup.setContent).toHaveBeenCalledWith(expect.stringContaining("Mock expert popup content"));
    expect(popup.openOn).toHaveBeenCalled();
  
    // Trigger mouseenter (clearTimeout behavior)
    const mouseEnterListener = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseenter"
    )?.[1];
    if (mouseEnterListener) mouseEnterListener();
  
    // Trigger mouseleave (starts close timeout)
    const mouseLeaveListener = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseleave"
    )?.[1];
    if (mouseLeaveListener) {
      mouseLeaveListener();
      jest.runAllTimers(); // run setTimeout from mouseleave
    }
  
    // Trigger view experts button
    const btn = popupElement.querySelector(".view-w-experts-btn");
    const clickHandler = btn?.addEventListener.mock.calls.find(
      ([event]) => event === "click"
    )?.[1];
  
    if (clickHandler) {
      clickHandler({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }
  
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("works");
    expect(popup.close).toHaveBeenCalled();
  });
  
  // Test: Handles cluster icon creation function - keeper
  it("creates custom cluster icons with total expert count", () => {
    const locationMap = new Map([
      [
        "cluster_point1",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          expertIDs: [1, 2],
          workIDs: [10],
          name: "Cluster Point 1",
        },
      ],
      [
        "cluster_point2",
        {
          geometryType: "Point",
          coordinates: [0.1, 0.1],
          expertIDs: [3, 4, 5],
          workIDs: [20],
          name: "Cluster Point 2",
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
  
    // Verify cluster group was created with iconCreateFunction
    expect(L.markerClusterGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        iconCreateFunction: expect.any(Function),
      })
    );
  
    // Test the iconCreateFunction
    const clusterGroupCall = L.markerClusterGroup.mock.calls[0][0];
    const iconCreateFunction = clusterGroupCall.iconCreateFunction;
    
    // Mock cluster object
    const mockCluster = {
      getAllChildMarkers: () => [
        { options: { expertCount: 2 } },
        { options: { expertCount: 3 } }
      ]
    };
  
    const result = iconCreateFunction(mockCluster);
    expect(L.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('5'), // 2 + 3 = 5 total experts
        className: "custom-cluster-icon",
      })
    );
  });
  
  // Test: Handles invalid/missing props gracefully - keeper
  it("handles missing or invalid props gracefully", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  
    // Test with null locationMap
    render(
      <WorkLayer
        locationMap={null}
        worksMap={new Map()}
        expertsMap={new Map()}
        showWorks={true}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );
  
    expect(consoleSpy).toHaveBeenCalledWith('Error: No works found!');
    
    consoleSpy.mockRestore();
  });
    
});