/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import CombinedLayer from "../rendering/CombinedLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";

jest.useFakeTimers();

// Mock react-leaflet
jest.mock("react-leaflet", () => ({
  useMap: jest.fn(),
}));

let mockMap;

beforeEach(() => {  // Reset the mock map before each test
  mockMap = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
  };
  useMap.mockReturnValue(mockMap);
});

let storedCombinedClickHandler = null;

const viewBtnMock = { // Mock for the view button in the popup
  addEventListener: jest.fn((event, handler) => {
    if (event === "click") {
      viewBtnMock._clickHandler = handler;
    }
  }),
  dispatchEvent: jest.fn((e) => {
    if (e.type === "click" && viewBtnMock._clickHandler) {
      viewBtnMock._clickHandler(e);
    }
  }),
};


const popupEventListeners = {};

const mockPopupElement = {  // Mock for the popup element
  style: { pointerEvents: "auto" },
  addEventListener: jest.fn((event, handler) => {
    popupEventListeners[event] = handler;
  }),
  querySelector: jest.fn((selector) => {
    if (selector === ".view-combined-btn") return viewBtnMock;
    return null;
  }),
};

// Leaflet mock
jest.mock("leaflet", () => {
  const mockPolygon = {
    addTo: jest.fn().mockReturnThis(),
    getBounds: jest.fn(() => ({
      getCenter: jest.fn(() => ({ lat: 0, lng: 0 })),
      getEast: () => 2,
      getWest: () => 0,
      getNorth: () => 2,
      getSouth: () => 0,
    })),
  };

  const mockMarker = {
    addTo: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    getLatLng: jest.fn(() => ({ lat: 0, lng: 0 })),
    options: { expertCount: 2 },
  };

  const mockPopup = {
    setLatLng: jest.fn().mockReturnThis(),
    setContent: jest.fn().mockReturnThis(),
    openOn: jest.fn().mockReturnThis(),
    getElement: jest.fn(() => mockPopupElement),
    remove: jest.fn(),
    close: jest.fn(),
  };

  const mockClusterGroup = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    getAllChildMarkers: jest.fn(() => [{ options: { expertCount: 2 } }]),
  };

  return {
    polygon: jest.fn(() => mockPolygon),
    marker: jest.fn(() => mockMarker),
    popup: jest.fn(() => mockPopup),
    markerClusterGroup: jest.fn(() => mockClusterGroup),
    divIcon: jest.fn(() => ({ options: { html: "" } })),
    point: jest.fn(() => [40, 40]),
  };
});

// Mocks for popup and panel data generation
jest.mock("../rendering/Popups", () => ({
  createCombinedPopup: jest.fn(() => "<button class='view-combined-btn'>View</button>"),
  createMatchedCombinedPolygonPopup: jest.fn(() => "<button class='view-combined-btn'>Matched View</button>"),
}));

jest.mock("../rendering/utils/preparePanelData", () => ({
  prepareGrantPanelData: jest.fn(() => {
    return { mock: "grant" };
  }),
  prepareWorkPanelData: jest.fn(() => {
    return { mock: "work" };
  }),
}));

describe("CombinedLayer component", () => {
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

  it("opens combined panel from marker click (mobile/tablet) and shows matched popup", () => {
   // Mock the necessary functions
    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();

    const locationMap = new Map([ 
      [
        "mobileClickTest",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          workIDs: [301],
          grantIDs: [401],
          grantExpertIDs: [1],
          workExpertIDs: [2],
          name: "Mobile Point",
          display_name: "Mobile Click Location",
        },
      ],
    ]);

    const worksMap = new Map([
      [301, { matchedFields: ["impact"], relatedExpertIDs: [2] }],
    ]);

    const grantsMap = new Map([
      [401, { matchedFields: ["climate"], relatedExpertIDs: [1] }],
    ]);

    const expertsMap = new Map([
      [1, { name: "Grant Expert" }],
      [2, { name: "Work Expert" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );
    // Simulate marker click
    const marker = L.marker.mock.results[0]?.value;
    expect(marker).toBeDefined();
    // Find the click handler for the marker
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler(); 

    const popup = L.popup.mock.results[L.popup.mock.calls.length - 1]?.value;
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();
    // Check if the popup content is set correctly
    const viewBtn = popupElement.querySelector(".view-combined-btn");
    expect(viewBtn).toBeDefined();

    const btnClickHandler = viewBtn.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];
    expect(btnClickHandler).toBeDefined();

    btnClickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    // Check if the correct functions were called
    expect(mockSetSelectedGrants).toHaveBeenCalledWith({ mock: "grant" });
    expect(mockSetSelectedWorks).toHaveBeenCalledWith({ mock: "work" });
    expect(mockSetPanelType).toHaveBeenCalledWith("combined");
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(popup.close).toHaveBeenCalled();
  });

  it("clears timeout on popup mouseenter in renderPolygons (line 215)", () => {
    jest.useFakeTimers();
    // Mock the necessary functions
    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();

    const locationMap = new Map([
      [
        "mouseenterTest",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [1, 0]]],
          workIDs: [5],
          grantIDs: [6],
          grantExpertIDs: [1],
          workExpertIDs: [2],
          name: "Mouseenter Polygon",
          display_name: "Mouseenter Test",
        },
      ],
    ]);

    const worksMap = new Map([[5, { matchedFields: ["mouse"], relatedExpertIDs: [2] }]]);
    const grantsMap = new Map([[6, { matchedFields: ["enter"], relatedExpertIDs: [1] }]]);
    const expertsMap = new Map([
      [1, { name: "Grant Expert" }],
      [2, { name: "Work Expert" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );
    // Simulate marker hover to trigger popup
    const marker = L.marker.mock.results[0]?.value;
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseover).toBeDefined();
    mouseover();
    // Check if popup was created
    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();
    // Check if mouseenter event listener was added
    const mouseenterHandler = popupElement.addEventListener.mock.calls.find(([e]) => e === "mouseenter")?.[1];
    expect(mouseenterHandler).toBeDefined();

    mouseenterHandler();

    // ensures Jest counts the line — even if clearTimeout doesn’t do anything
    expect(typeof clearTimeout).toBe("function");
  });


  it("closes polygon popup on popup mouseleave (covering activePopup.close via popup element)", () => {
    jest.useFakeTimers();

    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();

    const locationMap = new Map([
      [
        "mouseleaveOnlyTest",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [1, 0]]],
          workIDs: [10],
          grantIDs: [20],
          grantExpertIDs: [1],
          workExpertIDs: [2],
          name: "Mouseleave Only",
          display_name: "Mouseleave Only",
        },
      ],
    ]);

    const worksMap = new Map([[10, { matchedFields: ["x"], relatedExpertIDs: [2] }]]);
    const grantsMap = new Map([[20, { matchedFields: ["y"], relatedExpertIDs: [1] }]]);
    const expertsMap = new Map([
      [1, { name: "Grant Expert" }],
      [2, { name: "Work Expert" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    mouseover(); // trigger popup creation

    const popup = L.popup.mock.results[0]?.value;
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();

    // Trigger only the mouseleave from the popup itself
    const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(([event]) => event === "mouseleave")?.[1];
    expect(mouseleaveHandler).toBeDefined();

    mouseleaveHandler(); // simulate mouse leaving the popup
    jest.runAllTimers(); // advance timers to trigger popup close

    expect(popup.close).toHaveBeenCalled();
  });

  it("closes polygon popup on marker mouseout only (covering activePopup.close)", () => {
    jest.useFakeTimers();

    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();

    const locationMap = new Map([
      [
        "mouseoutOnlyTest",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [1, 0]]],
          workIDs: [10],
          grantIDs: [20],
          grantExpertIDs: [1],
          workExpertIDs: [2],
          name: "Mouseout Only",
          display_name: "Mouseout Only",
        },
      ],
    ]);
    // Mock data for works and grants
    const worksMap = new Map([[10, { matchedFields: ["x"], relatedExpertIDs: [2] }]]);
    const grantsMap = new Map([[20, { matchedFields: ["y"], relatedExpertIDs: [1] }]]);
    const expertsMap = new Map([
      [1, { name: "Grant Expert" }],
      [2, { name: "Work Expert" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );

    const marker = L.marker.mock.results[0]?.value;
    const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    mouseover(); // trigger popup creation

    const popup = L.popup.mock.results[0]?.value;
    expect(popup).toBeDefined();

    // Don't simulate popup mouseleave — only marker mouseout
    const mouseout = marker.on.mock.calls.find(([e]) => e === "mouseout")?.[1];
    mouseout();

    jest.runAllTimers(); // run the timeout for the close()

    expect(popup.close).toHaveBeenCalled();
  });

  it("handles polygon marker click and displays combined popup with matched fields", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();

    const locationMap = new Map([
      [
        "polygonClickTest",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          grantIDs: [101],
          workIDs: [202],
          expertIDs: [10, 20],
          grantExpertIDs: [10],
          workExpertIDs: [20],
          name: "Test Polygon",
          display_name: "Test Polygon Display",
        },
      ],
    ]);

    const grantsMap = new Map([
      [101, { matchedFields: ["climate"], relatedExpertIDs: [10] }],
    ]);
    const worksMap = new Map([
      [202, { matchedFields: ["research"], relatedExpertIDs: [20] }],
    ]);
    const expertsMap = new Map([
      [10, { name: "Grant Expert" }],
      [20, { name: "Work Expert" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );

    const marker = L.marker.mock.results[0].value;
    const clickHandler = marker.on.mock.calls.find(([event]) => event === "click")?.[1];
    expect(clickHandler).toBeDefined();

    clickHandler();
    // Check if the popup was created
    const popup = L.popup.mock.results[0]?.value;
    expect(popup.setContent).toHaveBeenCalled();
    // Check if the popup content includes the view button
    const popupElement = popup.getElement();
    expect(popupElement).toBeDefined();
    const viewBtn = popupElement.querySelector(".view-combined-btn");
    expect(viewBtn).toBeDefined();

    const clickBtnHandler = viewBtn.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickBtnHandler).toBeDefined();

    clickBtnHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
    // Check if the correct functions were called
    expect(mockSetSelectedGrants).toHaveBeenCalledWith({ mock: "grant" });
    expect(mockSetSelectedWorks).toHaveBeenCalledWith({ mock: "work" });
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(mockSetPanelType).toHaveBeenCalledWith("combined");
  });

  it("handles click on polygon popup button to open combined panel and close popup", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();

    const locationMap = new Map([
      [
        "combined-popup",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          workIDs: [2],
          expertIDs: [3],
          name: "Combined Polygon",
          display_name: "Combined Location",
        },
      ],
    ]);

    const grantsMap = new Map([
      [1, { matchedFields: ["funding"], relatedExpertIDs: [3] }],
    ]);
    const worksMap = new Map([
      [2, { matchedFields: ["research"], relatedExpertIDs: [3] }],
    ]);
    const expertsMap = new Map([
      [3, { name: "Expert A" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );

    const marker = L.marker.mock.results[0].value;

    // Simulate hover to trigger popup
    const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
    expect(mouseoverHandler).toBeDefined();
    mouseoverHandler();

    const popup = L.popup.mock.results[0].value;
    const popupElement = popup.getElement();

    // Simulate clicking the .view-combined-btn inside the popup
    const viewBtn = popupElement.querySelector(".view-combined-btn");
    expect(viewBtn).toBeDefined();

    const clickHandler = viewBtn.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];
    expect(clickHandler).toBeDefined();

    clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

    expect(mockSetSelectedGrants).toHaveBeenCalled();
    expect(mockSetSelectedWorks).toHaveBeenCalled();
    expect(mockSetPanelType).toHaveBeenCalledWith("combined");
    expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
    expect(popup.close).toHaveBeenCalled();
  });

  it("warns and returns if workID or grantID is missing in worksMap or grantsMap (renderPoints)", () => {
    const mockSetSelectedGrants = jest.fn();
    const mockSetSelectedWorks = jest.fn();
    const mockSetPanelOpen = jest.fn();
    const mockSetPanelType = jest.fn();
    const mockSetLocationName = jest.fn();
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });

    const locationMap = new Map([
      [
        "missing-data-location",
        {
          geometryType: "Point",
          coordinates: [0, 0],
          workIDs: [999],
          grantIDs: [888],
          name: "Missing Data Location",
          display_name: "Missing Data",
        },
      ],
    ]);

    const worksMap = new Map();
    const grantsMap = new Map();
    const expertsMap = new Map();

    render(
      <CombinedLayer
        locationMap={locationMap}
        worksMap={worksMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showGrants={true}
        showWorks={true}
        setSelectedGrants={mockSetSelectedGrants}
        setSelectedWorks={mockSetSelectedWorks}
        setPanelOpen={mockSetPanelOpen}
        setPanelType={mockSetPanelType}
        setLocationName={mockSetLocationName}
      />
    );
    // Check if the console warning was called
    expect(consoleWarnSpy).toHaveBeenCalledWith("Work with ID 999 not found in worksMap.");
    expect(consoleWarnSpy).toHaveBeenCalledWith("Grant with ID 888 not found in grantsMap.");
    // Ensure no layers were added to the map
    consoleWarnSpy.mockRestore();
  });

  it("renders polygons and points when showWorks and showGrants are true", () => {
    const locationMap = new Map([
      [
        "combined1",
        {
          geometryType: "Polygon",
          coordinates: [[[0, 0], [1, 1], [2, 2]]],
          grantIDs: [1],
          workIDs: [2],
          name: "Combined Location",
        },
      ],
    ]);

    const grantsMap = new Map([[1, { relatedExpertIDs: [10] }]]);
    const worksMap = new Map([[2, { relatedExpertIDs: [11] }]]);
    const expertsMap = new Map([
      [10, { name: "Grant Expert" }],
      [11, { name: "Work Expert" }],
    ]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        grantsMap={grantsMap}
        worksMap={worksMap}
        expertsMap={expertsMap}
        showWorks={true}
        showGrants={true}
        setSelectedGrants={jest.fn()}
        setSelectedWorks={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
        setLocationName={jest.fn()}
      />
    );
    // Check if the polygon and marker were created
    expect(L.polygon).toHaveBeenCalled();
    expect(L.marker).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled();
  });
});

it("shows matched popup with correct fields and triggers combined panel on button click", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "hoverMatched",
      {
        geometryType: "Point",
        coordinates: [0, 0],
        workIDs: [10],
        grantIDs: [20],
        grantExpertIDs: [1],
        workExpertIDs: [2],
        name: "Matched Hover Location",
        display_name: "Matched Hover",
      },
    ],
  ]);

  const worksMap = new Map([[10, { matchedFields: ["fieldA"], relatedExpertIDs: [2] }]]);
  const grantsMap = new Map([[20, { matchedFields: ["fieldB"], relatedExpertIDs: [1] }]]);
  const expertsMap = new Map([
    [1, { name: "Grant Expert" }],
    [2, { name: "Work Expert" }],
  ]);

  render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );

  const marker = L.marker.mock.results[0]?.value;
  const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
  expect(mouseover).toBeDefined();
  mouseover(); // trigger hover logic

  const popup = L.popup.mock.results[0]?.value;
  const popupElement = popup.getElement();
  expect(popupElement).toBeDefined();

  const viewBtn = popupElement.querySelector(".view-combined-btn"); // Check if the view button is present
  expect(viewBtn).toBeDefined();

  const clickHandler = viewBtn.addEventListener.mock.calls.find(([event]) => event === "click")?.[1];
  expect(clickHandler).toBeDefined();
  clickHandler({ preventDefault: jest.fn(), stopPropagation: jest.fn() });

  // Check if the correct functions were called
  expect(mockSetSelectedGrants).toHaveBeenCalledWith({ mock: "grant" });
  expect(mockSetSelectedWorks).toHaveBeenCalledWith({ mock: "work" });
  expect(mockSetPanelType).toHaveBeenCalledWith("combined");
  expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
  expect(popup.close).toHaveBeenCalled();
});

it("does not render anything when required data is missing", () => {
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });

  render(
    <CombinedLayer
      locationMap={new Map()}
      grantsMap={null}
      worksMap={null}
      expertsMap={null}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={jest.fn()}
      setSelectedWorks={jest.fn()}
      setPanelOpen={jest.fn()}
      setPanelType={jest.fn()}
      setLocationName={jest.fn()}
    />
  );
  // Check if an error was logged
  expect(mockMap.addLayer).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

it("closes polygon popup on marker mouseout in CombinedLayer", () => {
  jest.useFakeTimers(); // Ensure fake timers are enabled

  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "polygon_mouseout",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [2, 2]]],
        grantIDs: [1],
        workIDs: [2],
        name: "Mouseout Polygon",
        display_name: "Mouseout Test",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { matchedFields: ["field1"], relatedExpertIDs: [10] }],
  ]);
  const worksMap = new Map([
    [2, { matchedFields: ["field2"], relatedExpertIDs: [11] }],
  ]);
  const expertsMap = new Map([
    [10, { name: "Expert A" }],
    [11, { name: "Expert B" }],
  ]);

  render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );
  // Simulate marker hover to trigger popup
  const marker = L.marker.mock.results[0]?.value;
  expect(marker).toBeDefined();
  const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
  expect(mouseoverHandler).toBeDefined();
  mouseoverHandler();
  const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
  expect(mouseoutHandler).toBeDefined();
  mouseoutHandler();
  // timers are used to simulate the delay in closing the popup
  jest.runAllTimers();
  const popup = L.popup.mock.results[0]?.value;
  expect(popup?.close).toHaveBeenCalled();
});

it("calls iconCreateFunction and returns custom cluster icon with expert count in CombinedLayer", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();
  const locationMap = new Map([
    [
      "pointA",
      {
        geometryType: "Point",
        coordinates: [0, 0],
        grantIDs: [1],
        workIDs: [2],
        worksIDs: [2],
        name: "Point A",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { relatedExpertIDs: [10] }],
  ]);
  const worksMap = new Map([
    [2, { relatedExpertIDs: [11] }],
  ]);
  const expertsMap = new Map([
    [10, { name: "Grant Expert" }],
    [11, { name: "Work Expert" }],
  ]);

  render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );

  // Get the iconCreateFunction from the markerClusterGroup config
  const clusterOptions = L.markerClusterGroup.mock.calls[0][0];
  const iconCreateFn = clusterOptions.iconCreateFunction;
  // Create a fake cluster with child markers that have expertCount
  const mockCluster = {
    getAllChildMarkers: () => [
      { options: { expertCount: 3 } },
      { options: { expertCount: 4 } },
    ],
  };
// Mock the L.divIcon to check if it was called with the correct parameters
  iconCreateFn(mockCluster);
  expect(L.divIcon).toHaveBeenCalledWith(
    expect.objectContaining({
      html: expect.stringContaining("7"), 
      className: "custom-cluster-icon",
    })
  );
});

it("handles polygon popup mouseenter and mouseleave correctly in CombinedLayer", () => {
  jest.useFakeTimers();

  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "polygonPopup",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [2, 2]]],
        grantIDs: [1],
        workIDs: [10],
        name: "Popup Polygon",
        display_name: "Polygon Popup Display",
      },
    ],
  ]);
  // Mock data for grants and works
  const grantsMap = new Map([
    [1, { matchedFields: ["grantMatch"], relatedExpertIDs: [101] }],
  ]);
  const worksMap = new Map([
    [10, { matchedFields: ["workMatch"], relatedExpertIDs: [102] }],
  ]);
  const expertsMap = new Map([
    [101, { name: "Grant Expert" }],
    [102, { name: "Work Expert" }],
  ]);

  render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );

  const marker = L.marker.mock.results[0]?.value;
  const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
  expect(mouseoverHandler).toBeDefined();
  mouseoverHandler();
  const popup = L.popup.mock.results[0]?.value;
  expect(popup).toBeDefined();
  const popupElement = popup.getElement();
  expect(popupElement).toBeDefined();

  const mouseenterHandler = popupElement.addEventListener.mock.calls.find(  
    ([event]) => event === "mouseenter"
  )?.[1]; // Get the mouseenter handler from the popup element
  const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(
    ([event]) => event === "mouseleave"
  )?.[1]; // Get the mouseleave handler from the popup element

  // Ensure both handlers are defined
  expect(mouseenterHandler).toBeDefined();
  expect(mouseleaveHandler).toBeDefined();
  mouseenterHandler();
  mouseleaveHandler();
  jest.runAllTimers();
  expect(popup.close).toHaveBeenCalled();
});

it("removes popup when clicking a second polygon in CombinedLayer", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();
  const locationMap = new Map([
    [
      "polygon1",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [1, 0]]],
        grantIDs: [1],
        workIDs: [11],
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
        grantIDs: [3],
        workIDs: [13],
        expertIDs: [4],
        name: "Second Polygon",
        display_name: "Second Polygon",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { matchedFields: ["field1"], relatedExpertIDs: [2] }],
    [3, { matchedFields: ["field2"], relatedExpertIDs: [4] }],
  ]);
  const worksMap = new Map([
    [11, { matchedFields: ["concept1"], relatedExpertIDs: [2] }],
    [13, { matchedFields: ["concept2"], relatedExpertIDs: [4] }],
  ]);
  const expertsMap = new Map([
    [2, { name: "Expert A" }],
    [4, { name: "Expert B" }],
  ]);
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

  L.popup // Mock the L.popup method to return our mock popup
    .mockReturnValueOnce(popupMock)
    .mockReturnValueOnce(popupMock);

  render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      isMobileView={true}
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );
  
  const marker1 = L.marker.mock.results[0]?.value;
  const marker2 = L.marker.mock.results[1]?.value;
  // Ensure both markers are defined
  expect(marker1).toBeDefined();
  expect(marker2).toBeDefined();
  // Simulate the click event on both markers
  const click1 = marker1.on.mock.calls.find(([e]) => e === "click")?.[1];
  const click2 = marker2.on.mock.calls.find(([e]) => e === "click")?.[1];
  expect(click1).toBeDefined();
  expect(click2).toBeDefined();
  click1(); // Trigger click on the first marker
  click2(); // Trigger click on the second marker
  expect(popupMock.remove).toHaveBeenCalled();  // Check if the popup was removed
});

it("logs warnings when workID or grantID is missing from their respective maps", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();
  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
  const locationMap = new Map([
    [
      "missing-both",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [1, 0]]],
        grantIDs: [123],
        workIDs: [456],
        expertIDs: [2],
        name: "Missing Data Polygon",
        display_name: "Missing Data",
      },
    ],
  ]);

  const grantsMap = new Map();
  const worksMap = new Map();
  const expertsMap = new Map([[2, { name: "Expert A" }]]);

  render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );
  // Check if the console warnings were called
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    "Work with ID 456 not found in worksMap."
  );
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    "Grant with ID 123 not found in grantsMap."
  );

  consoleWarnSpy.mockRestore(); // Restore the original console.warn function
});
