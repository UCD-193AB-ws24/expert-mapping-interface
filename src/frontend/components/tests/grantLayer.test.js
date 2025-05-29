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

// Mock the popup creation utility
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
  prepareGrantPanelData: jest.fn(() => ({
    expertIDs: [2],
    grantIDs: [1],
  })),
}));

describe("GrantLayer component", () => {
  let mockMap;

  beforeEach(() => {
    // Mock the map object returned by useMap
    mockMap = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    };
    useMap.mockReturnValue(mockMap);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not render anything when showGrants is false", () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

    render(
      <GrantLayer
        locationMap={{}}
        grantsMap={{}}
        expertsMap={{}}
        showGrants={false}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
      />
    );
    // Ensure an error is logged and no layers are added to the map
    expect(consoleSpy).toHaveBeenCalledWith("Error: No grants found!");
    expect(mockMap.addLayer).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("handles polygon marker click and opens panel with data", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    // Define mock data for location, grants, and experts
    const locationMap = {
      polygonClick: {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [2, 2]]],
        grantIDs: [1],
        expertIDs: [5],
        name: "Clickable Polygon",
        display_name: "Clickable Display",
      },
    };
    const grantsMap = {
      1: { matchedFields: ["keyword1"] },
    };
    const expertsMap = {
      5: { name: "Dr. Polygon" },
    };
  
    // Render the GrantLayer component with mock data and handlers
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
  
    // Retrieve the first marker created by the component
    const marker = L.marker.mock.results[0]?.value;
  
    // Simulate a click event on the marker
    const clickHandler = marker.on.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined(); // Ensure the click handler is defined
    clickHandler(); // Trigger the click event
  
    // Retrieve the popup created by the click event
    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
  
    // Find the "view experts" button inside the popup
    const viewBtn = popupElement.querySelector(".view-g-experts-btn");
    const clickBtn = viewBtn?.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];
  
    // Simulate a click on the "view experts" button
    if (clickBtn) {
      clickBtn({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    }
  
    // Verify that the appropriate handlers were called with the correct arguments
    expect(mockSetSelectedGrants).toHaveBeenCalled(); // Ensure grants were set
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true); // Ensure panel was opened
    expect(mockSetPanelType).toHaveBeenCalledWith("grants"); // Ensure panel type was set
  });

  it("shows popup on point marker hover and closes on mouseleave", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    // Define mock data for location, grants, and experts
    const locationMap = {
      hoverPoint: {
        geometryType: "Point",
        coordinates: [10, 20],
        grantIDs: [101],
        expertIDs: [42],
        name: "Hover Point Location",
        display_name: "Hover Display",
      },
    };
  
    const grantsMap = {
      101: { matchedFields: ["climate", "data"] }, // Mock grant data
    };
    
    const expertsMap = {
      42: { name: "Hover Grant Expert" }, // Mock expert data
    };
    // Render the GrantLayer component with mock data and handlers
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
  
    // Retrieve the first marker created by the component
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined(); // Ensure the marker is defined
  
    // Simulate mouseover to open the popup
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined(); // Ensure the mouseover handler is defined
    mouseoverHandler(); // Trigger the mouseover event
  
    // Verify that the popup was opened
    const popup = L.popup.mock.results[0]?.value;
    expect(popup.openOn).toHaveBeenCalled(); // Ensure the popup was added to the map
  
    // Retrieve the popup element
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined(); // Ensure the popup element is defined
  
    // Simulate mouseleave to close the popup
    expect(popupEventListeners.mouseleave).toBeDefined(); // Ensure the mouseleave event is defined
    popupEventListeners.mouseleave(); // Trigger the mouseleave event
  
    // Fast-forward timers to simulate the delay before closing the popup
    jest.runAllTimers();
  
    // Verify that the popup was closed
    expect(popup.close).toHaveBeenCalled();
  });

  it("opens popup and sets grant panel data on point marker click", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
  
    // Define mock data for location, grants, and experts
    const locationMap = {
      clickPoint: {
      geometryType: "Point",
      coordinates: [10, 20], // Coordinates for the point marker
      grantIDs: [201], // Associated grant IDs
      expertIDs: [301], // Associated expert IDs
      name: "Clickable Point",
      display_name: "Clickable Point Display",
      },
    };
    
    const grantsMap = {
      201: { matchedFields: ["sustainability"] }, // Mock grant data
    };
    
    const expertsMap = {
      301: { name: "Click Grant Expert" }, // Mock expert data
    };
  
    // Render the GrantLayer component with mock data and handlers
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
  
    // Retrieve the first marker created by the component
    const marker = L.marker.mock.results[0]?.value;
  
    // Simulate a click event on the marker
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined(); // Ensure the click handler is defined
    clickHandler(); // Trigger the click event
  
    // Retrieve the popup created by the click event
    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();
  
    // Find the "view experts" button inside the popup
    const btn = popupElement.querySelector(".view-g-experts-btn");
    const clickBtnHandler = btn?.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
  
    // Simulate a click on the "view experts" button
    if (clickBtnHandler) {
      clickBtnHandler({
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      });
    }
  
    // Verify that the appropriate handlers were called with the correct arguments
    expect(mockSetSelectedGrants).toHaveBeenCalled(); // Ensure grants were set
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true); // Ensure panel was opened
    expect(mockSetPanelType).toHaveBeenCalledWith("grants"); // Ensure panel type was set
  });

  it("calls iconCreateFunction and returns custom cluster icon with expert count", () => {
    // Prepare dummy map data
    const locationMap = {
      pointA: {
      geometryType: "Point",
      coordinates: [0, 0],
      grantIDs: [1],
      expertIDs: [1],
      name: "Point A",
      },
    };

    const grantsMap = {
      1: { title: "Grant A" },
    };

    const expertsMap = {
      1: { name: "Expert A" },
    };

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

    const locationMap = {
      polygonPopup: {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      grantIDs: [1],
      expertIDs: [1],
      name: "Popup Polygon",
      display_name: "Polygon Popup Display",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["popupTest"] }, // Mock grant data
    };

    const expertsMap = {
      1: { name: "Popup Expert" }, // Mock expert data
    };

    render(   //Render the GrantLayer component with mock data and handlers
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

    const marker = L.marker.mock.results[0]?.value; // Retrieve the first marker created by the component

    // Simulate mouseover to create a popup
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0]?.value; // Retrieve the popup created by the mouseover event
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    const mouseenterHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseenter" // Find the mouseenter event handler
    )?.[1];
    const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(
      ([event]) => event === "mouseleave" // Find the mouseleave event handler
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

    const locationMap = {
      "polygon-popup": {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      grantIDs: [1],
      expertIDs: [2],
      name: "Popup Polygon",
      display_name: "Popup Location",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["topic"] },
    };
    const expertsMap = {
      2: { name: "Expert X" },
    };

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

    const popup = L.popup.mock.results[0].value; // Retrieve the popup created by the mouseover event
    const popupElement = popup.getElement();

    // Find the "view experts" button inside the popup
    const viewExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
    expect(viewExpertsBtn).toBeDefined(); 

    // Find the click event handler for the button
    const clickHandler = viewExpertsBtn.addEventListener.mock.calls.find( 
      ([e]) => e === "click"
    )?.[1];
    expect(clickHandler).toBeDefined();

    // Simulate button click
    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    
    // Verify that the panel data preparation function was called
    expect(mockSetSelectedGrants).toHaveBeenCalled(); 
    expect(mockSetPanelType).toHaveBeenCalledWith("grants");
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(popup.close).toHaveBeenCalled();
  });

  it("handles missing popup element ", () => {
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

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      grantIDs: [1],
      expertIDs: [1],
      name: "Test Point",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["test"] },
    };
    const expertsMap = {
      1: { name: "Test Expert" },
    };

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
  it("handles missing view button in popup ", () => {
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

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      grantIDs: [1],
      expertIDs: [1],
      name: "Test Point",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["test"] },
    };
    const expertsMap = {
      1: { name: "Test Expert" },
    };

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

    const marker = L.marker.mock.results[0]?.value; // Retrieve the first marker created by the component
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];

    // This should not throw an error even without the view button
    expect(() => mouseoverHandler()).not.toThrow();
  });


  it("clears popup close timeout on mouseenter", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      hoverCancel: {
      geometryType: "Point",
      coordinates: [10, 20],
      grantIDs: [1],
      expertIDs: [2],
      name: "Hover Cancel Test",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["energy"] },
    };
    const expertsMap = {
      2: { name: "Dr. Hover" },
    };

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

    // Trigger mouseover to simulate popup creation
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    mouseover();

    const popup = L.popup.mock.results[0].value;  // Retrieve the popup created by the mouseover event
    const popupElement = popup.getElement();

    // Find the mouseleave and mouseenter event handlers
    const mouseleave = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseleave")?.[1];
    const mouseenter = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseenter")?.[1];

    // Simulate mouseleave → sets timeout to close
    mouseleave();

    const clearSpy = jest.spyOn(global, "clearTimeout");

    // Simulate mouseenter before timeout fires
    mouseenter();

    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
  });


  // it("handles view-g-experts-btn click in point popup and updates panel state", () => {
  //   const mockSetSelectedGrants = jest.fn();
  //   const mockSetPanelOpen = jest.fn();
  //   const mockSetPanelType = jest.fn();

  //   const locationMap = new Map([ // Define mock data for location, grants, and experts
  //     [
  //       "viewBtnPoint",
  //       {
  //         geometryType: "Point",
  //         coordinates: [0, 0],
  //         grantIDs: [11],
  //         expertIDs: [22],
  //         name: "Popup Button Location",
  //         display_name: "Popup View Test",
  //       },
  //     ],
  //   ]);

  //   const grantsMap = new Map([[11, { title: "Grant X" }]]);
  //   const expertsMap = new Map([[22, { name: "Dr. Test" }]]);

  //   // Spy on prepareGrantPanelData to make sure it’s called with expected args
  //   const prepareGrantPanelData = require("../rendering/utils/preparePanelData").prepareGrantPanelData;
  //   prepareGrantPanelData.mockClear();

  //   render(
  //     <GrantLayer
  //       locationMap={locationMap}
  //       grantsMap={grantsMap}
  //       expertsMap={expertsMap}
  //       showGrants={true}
  //       setSelectedGrants={mockSetSelectedGrants}
  //       setPanelOpen={mockSetPanelOpen}
  //       setPanelType={mockSetPanelType}
  //     />
  //   );
  //   // Retrieve the first marker created by the component
  //   const marker = L.marker.mock.results[0].value;
  //   const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
  //   expect(mouseoverHandler).toBeDefined();
  //   mouseoverHandler();

  //   // Trigger the mouseover to create the popup
  //   const popup = L.popup.mock.results[0]?.value;
  //   const popupElement = popup.getElement();

  //   // Ensure the popup element is defined
  //   // and contains the view button
  //   const viewBtn = popupElement.querySelector(".view-g-experts-btn");
  //   expect(viewBtn).toBeDefined();

  //   const clickHandler = viewBtn.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];
  //   expect(clickHandler).toBeDefined();

  //   clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

  //   // Verify that the prepareGrantPanelData was called with correct parameters
  //   expect(prepareGrantPanelData).toHaveBeenCalledWith(
  //     [22], [11], grantsMap, expertsMap, "viewBtnPoint", "Popup View Test"
  //   );
  //   expect(mockSetSelectedGrants).toHaveBeenCalled();
  //   expect(mockSetPanelType).toHaveBeenCalledWith("grants");
  //   expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
  //   expect(popup.close).toHaveBeenCalled();
  // });

  it("closes grant point popup on marker mouseout after timeout", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      timeoutPoint: {
      geometryType: "Point",
      coordinates: [0, 0],
      grantIDs: [101],
      expertIDs: [202],
      name: "Timeout Point",
      },
    };

    const grantsMap = {
      101: { matchedFields: ["energy"] },
    };
    const expertsMap = {
      202: { name: "Dr. Timeout" },
    };

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

    // Trigger mouseover to open the popup
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Trigger mouseout
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();

    // Wait for the timeout to finish
    jest.runAllTimers();

    const popup = L.popup.mock.results[0]?.value;
    expect(popup.close).toHaveBeenCalled();
  });

  it("removes existing grantPointPopup before creating a new one", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      grantIDs: [1],
      expertIDs: [2],
      name: "Test Point",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["field1"] },
    };
    const expertsMap = {
      2: { name: "Test Expert" },
    };

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

  it("clears grantPointCT timeout on mouseover", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      testPoint: {
      geometryType: "Point",
      coordinates: [10, 20],
      grantIDs: [1],
      expertIDs: [2],
      name: "Test Point",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["field1"] },
    };
    const expertsMap = {
      2: { name: "Test Expert" },
    };

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

    // Simulate mouseout to set grantPointCT
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();

    // Mock setTimeout and clearTimeout
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    // Simulate mouseover to clear grantPointCT
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Verify that clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Clean up
    clearTimeoutSpy.mockRestore();
  });

  it("renders polygons and handles events", () => {
    const mockSetSelectedGrants = jest.fn();
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
      grantIDs: [1],
      expertIDs: [2],
      name: "Test Polygon",
      display_name: "Test Polygon Display",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["field1"] },
    };
    const expertsMap = {
      2: { name: "Test Expert" },
    };

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

    // Verify polygon was created
    const polygon = L.polygon.mock.results[0]?.value;
    expect(polygon).toBeDefined();
    expect(L.polygon).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        color: "#eda012",
        fillColor: "#efa927",
        fillOpacity: 0.5,
        weight: 2,
      })
    );

    // Verify marker was created at the polygon center
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();

    // Simulate mouseover to create a popup
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0]?.value; // Retrieve the popup created by the mouseover event
    expect(popup).toBeDefined();
    expect(L.popup).toHaveBeenCalledWith( // Popup options
      expect.objectContaining({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
    );

    // Simulate mouseleave to close the popup after a timeout
    const mouseleaveHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseleaveHandler).toBeDefined();
    mouseleaveHandler();
    jest.runAllTimers(); // Fast-forward the timeout
    expect(popup.close).toHaveBeenCalled();

    // Simulate button click inside the popup
    const popupElement = popup.getElement();
    const button = popupElement.querySelector(".view-g-experts-btn");
    expect(button).toBeDefined();

    // Simulate the button click using the addEventListener mock
    const clickHandler = button.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

    expect(mockSetSelectedGrants).toHaveBeenCalledWith( // Prepare the panel data
      expect.objectContaining({
        expertIDs: [2],
        grantIDs: [1],
      })
    );
    // Verify that the panel was opened with the correct type
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("grants");
    expect(popup.close).toHaveBeenCalled();
  });

  it("handles polygon marker mouseover and creates a popup", () => {
    const mockSetSelectedGrants = jest.fn();
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
      grantIDs: [1],
      expertIDs: [2],
      name: "Test Polygon",
      display_name: "Test Polygon Display",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["field1"] },
    };
    const expertsMap = {
      2: { name: "Test Expert" },
    };

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

    // Simulate mouseout to set closeTimeout
    const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
    expect(mouseoutHandler).toBeDefined();
    mouseoutHandler();

    // Mock clearTimeout
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    // Simulate mouseover to clear closeTimeout
    const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Verify popup was created
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

    // Verify popup content
    expect(popup.setContent).toHaveBeenCalledWith(
      expect.stringContaining("Test Polygon")
    );

    // Verify popup was added to the map
    expect(popup.openOn).toHaveBeenCalledWith(expect.any(Object));

    // Verify popup events
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

    // Simulate mouseleave to close the popup after a timeout
    mouseleaveHandler();
    jest.runAllTimers(); // Fast-forward the timeout
    expect(popup.close).toHaveBeenCalled();

    // Clean up
    clearTimeoutSpy.mockRestore();
  });

  it("removes existing popup before creating a new one", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      "double-hover": {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [2, 2]]],
      grantIDs: [1],
      expertIDs: [2],
      name: "Popup Remover",
      display_name: "Popup Overwrite",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["field"] },
    };

    const expertsMap = {
      2: { name: "Expert A" },
    };

    // Mock the popup element and its methods
    const popupElement = {
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    };

    // Mock the popup object with necessary methods
    const popupMock = {
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn().mockReturnThis(),
      getElement: jest.fn(() => popupElement),
      close: jest.fn(),
      remove: jest.fn(),
    };

    // Return the same popup twice (simulate persistent object)
    L.popup
      .mockReturnValueOnce(popupMock)
      .mockReturnValueOnce(popupMock); // second hover will reuse this

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

    //  Trigger first hover — creates initial popup
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    // Trigger second hover — should trigger activePopup.remove()
    mouseoverHandler();

    //  Expect .remove() to be called on the existing popup
    expect(popupMock.remove).toHaveBeenCalled();
  });

  it("removes popup when clicking a second polygon", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();

    const locationMap = {
      polygon1: {
      geometryType: "Polygon",
      coordinates: [[[0, 0], [1, 1], [1, 0]]],
      grantIDs: [1],
      expertIDs: [2],
      name: "First Polygon",
      display_name: "First Polygon",
      },
      polygon2: {
      geometryType: "Polygon",
      coordinates: [[[2, 2], [3, 3], [3, 2]]],
      grantIDs: [3],
      expertIDs: [4],
      name: "Second Polygon",
      display_name: "Second Polygon",
      },
    };

    const grantsMap = {
      1: { matchedFields: ["field1"] },
      3: { matchedFields: ["field2"] },
    };

    const expertsMap = {
      2: { name: "Expert A" },
      4: { name: "Expert B" },
    };

    const popupElement = {  // Mock popup element with necessary methods
      style: { pointerEvents: "auto" },
      addEventListener: jest.fn(),
      querySelector: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
    };

    const popupMock = { // Mock popup object with necessary methods
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
      <GrantLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        isMobileView={true}
        setSelectedGrants={mockSetSelectedGrants}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
      />
    );

    const marker1 = L.marker.mock.results[0]?.value;  // First polygon marker
    const marker2 = L.marker.mock.results[1]?.value;  // Second polygon marker

    const click1 = marker1.on.mock.calls.find(([e]) => e === "click")?.[1]; // Click handler for first polygon
    const click2 = marker2.on.mock.calls.find(([e]) => e === "click")?.[1]; // Click handler for second polygon

    click1(); // create first popup
    click2(); //call .remove() on the first one

    expect(popupMock.remove).toHaveBeenCalled();  // Expect the first popup to be removed
  });

});

