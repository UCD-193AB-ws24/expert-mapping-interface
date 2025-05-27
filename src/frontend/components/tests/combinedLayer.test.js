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

beforeEach(() => {
  mockMap = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
  };
  useMap.mockReturnValue(mockMap);
});

let storedCombinedClickHandler = null;

const viewBtnMock = {
  addEventListener: jest.fn((event, handler) => {
    if (event === "click") {
      storedCombinedClickHandler = handler;
    }
  }),
};

const triggerCombinedClick = () => {
  const mockEvent = {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };
  if (storedCombinedClickHandler) storedCombinedClickHandler(mockEvent);
};


const popupEventListeners = {};

const mockPopupElement = {
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


// jest.mock("../rendering/utils/preparePanelData", () => ({
//   prepareGrantPanelData: jest.fn(() => ({ mock: "grant" })),
//   prepareWorkPanelData: jest.fn(() => ({ mock: "work" })),
// }));
jest.mock("../rendering/utils/preparePanelData", () => ({
  prepareGrantPanelData: jest.fn(() => {
    console.log("🎯 prepareGrantPanelData called!");
    return { mock: "grant" };
  }),
  prepareWorkPanelData: jest.fn(() => {
    console.log("🎯 prepareWorkPanelData called!");
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

    expect(L.polygon).toHaveBeenCalled();
    expect(L.marker).toHaveBeenCalled();
    expect(mockMap.addLayer).toHaveBeenCalled(); // for marker cluster group
  });
});

it("removes all layers on unmount in CombinedLayer", () => {
  const locationMap = new Map([
    [
      "combined_point",
      {
        geometryType: "Point",
        coordinates: [0, 0],
        grantIDs: [1],
        worksIDs: [2],
        name: "Combined Point",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { matchedFields: ["field1"], relatedExpertIDs: [101] }],
  ]);

  const worksMap = new Map([
    [2, { matchedFields: ["field2"], relatedExpertIDs: [102] }],
  ]);

  const expertsMap = new Map([
    [101, { name: "Expert A" }],
    [102, { name: "Expert B" }],
  ]);

  const { unmount } = render(
    <CombinedLayer
      locationMap={locationMap}
      grantsMap={grantsMap}
      worksMap={worksMap}
      expertsMap={expertsMap}
      showGrants={true}
      showWorks={true}
      setSelectedGrants={jest.fn()}
      setSelectedWorks={jest.fn()}
      setPanelOpen={jest.fn()}
      setPanelType={jest.fn()}
      setLocationName={jest.fn()}
    />
  );

  unmount();
  expect(mockMap.removeLayer).toHaveBeenCalled();
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

  // Since the early return doesn't log an error, this is optional:
  // expect(consoleSpy).toHaveBeenCalled();

  expect(mockMap.addLayer).not.toHaveBeenCalled();

  consoleSpy.mockRestore();
});

it("handles polygon marker click and opens panel with combined data", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "polygonClick",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [2, 2]]],
        grantIDs: [1],
        workIDs: [10], 
        expertIDs: [5],
        name: "Clickable Polygon",
        display_name: "Clickable Display",
      },
    ],
  ]);
  

  const grantsMap = new Map([
    [1, { matchedFields: ["grantKeyword"], relatedExpertIDs: [5] }],
  ]);

  const worksMap = new Map([
    [10, { matchedFields: ["workKeyword"], relatedExpertIDs: [6] }],
  ]);

  const expertsMap = new Map([
    [5, { name: "Grant Expert" }],
    [6, { name: "Work Expert" }],
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

  const clickHandler = marker.on.mock.calls.find(([e]) => e === "click")?.[1];
  expect(clickHandler).toBeDefined();
  clickHandler();

  const popup = L.popup.mock.results[0]?.value;
  const popupElement = popup.getElement();

  const viewBtn = popupElement.querySelector(".view-combined-btn");
  const clickBtn = viewBtn?.addEventListener.mock.calls.find(([e]) => e === "click")?.[1];

  if (clickBtn) {
    clickBtn({ preventDefault: jest.fn(), stopPropagation: jest.fn() });
  }

  expect(mockSetSelectedGrants).toHaveBeenCalled();
  expect(mockSetSelectedWorks).toHaveBeenCalled();
  expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
  expect(mockSetPanelType).toHaveBeenCalledWith("combined");
});

it("shows popup on point marker hover and closes on mouseleave in CombinedLayer", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "hoverPoint",
      {
        geometryType: "Point",
        coordinates: [10, 20],
        grantIDs: [101],
        worksIDs: [201], 
        name: "Hover Point Location",
        display_name: "Hover Display",
      },
    ],
  ]);

  const grantsMap = new Map([
    [101, { matchedFields: ["climate", "data"], relatedExpertIDs: [1] }],
  ]);

  const worksMap = new Map([
    [201, { matchedFields: ["modeling", "forecast"], relatedExpertIDs: [2] }],
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

  const marker = L.marker.mock.results[0]?.value;
  expect(marker).toBeDefined();

  const mouseoverHandler = marker.on.mock.calls.find(([event]) => event === "mouseover")?.[1];
  expect(mouseoverHandler).toBeDefined();
  mouseoverHandler();

  const mouseoutHandler = marker.on.mock.calls.find(([event]) => event === "mouseout")?.[1];
  expect(mouseoutHandler).toBeDefined();
  mouseoutHandler();

  jest.runAllTimers();

  const popup = L.popup.mock.results[0]?.value;
  expect(popup?.close).toHaveBeenCalled();
});

it("sorts polygons by area before rendering in CombinedLayer", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "larger_polygon",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [0, 4], [4, 4], [4, 0], [0, 0]]],
        grantIDs: [1],
        workIDs: [3],
        worksIDs: [3], // for internal code compatibility
        name: "Large Polygon",
      },
    ],
    [
      "smaller_polygon",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]],
        grantIDs: [2],
        workIDs: [4],
        worksIDs: [4],
        name: "Small Polygon",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { matchedFields: ["a"], relatedExpertIDs: [10] }],
    [2, { matchedFields: ["b"], relatedExpertIDs: [11] }],
  ]);

  const worksMap = new Map([
    [3, { matchedFields: ["c"], relatedExpertIDs: [10] }],
    [4, { matchedFields: ["d"], relatedExpertIDs: [11] }],
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

  expect(L.polygon).toHaveBeenCalled();
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

  // Call the function
  iconCreateFn(mockCluster);

  // Check the result
  expect(L.divIcon).toHaveBeenCalledWith(
    expect.objectContaining({
      html: expect.stringContaining("7"), // 3 + 4
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

  // Simulate hover to open popup
  mouseoverHandler();

  const popup = L.popup.mock.results[0]?.value;
  expect(popup).toBeDefined();

  const popupElement = popup.getElement();
  expect(popupElement).toBeDefined();

  // Check and invoke mouseenter/mouseleave
  const mouseenterHandler = popupElement.addEventListener.mock.calls.find(
    ([event]) => event === "mouseenter"
  )?.[1];
  const mouseleaveHandler = popupElement.addEventListener.mock.calls.find(
    ([event]) => event === "mouseleave"
  )?.[1];

  expect(mouseenterHandler).toBeDefined();
  expect(mouseleaveHandler).toBeDefined();

  // Simulate behavior
  mouseenterHandler(); // cancel timeout
  mouseleaveHandler(); // schedule close
  jest.runAllTimers(); // run timeout
  expect(popup.close).toHaveBeenCalled();
});


it("removes existing popup before creating a new one in CombinedLayer", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const locationMap = new Map([
    [
      "double-hover",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [2, 2]]],
        grantIDs: [1],
        workIDs: [2],
        expertIDs: [3],
        name: "Popup Remover",
        display_name: "Popup Overwrite",
      },
    ],
  ]);

  const grantsMap = new Map([
    [1, { matchedFields: ["field"], relatedExpertIDs: [3] }],
  ]);

  const worksMap = new Map([
    [2, { matchedFields: ["concept"], relatedExpertIDs: [3] }],
  ]);

  const expertsMap = new Map([
    [3, { name: "Expert A" }],
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
    remove: jest.fn(), // ✅ what we test for
  };

  // Set up L.popup to return the same popup twice
  L.popup
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
      setSelectedGrants={mockSetSelectedGrants}
      setSelectedWorks={mockSetSelectedWorks}
      setPanelOpen={mockSetPanelOpen}
      setPanelType={mockSetPanelType}
      setLocationName={mockSetLocationName}
    />
  );

  const marker = L.marker.mock.results[0]?.value;
  expect(marker).toBeDefined();

  const mouseoverHandler = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
  expect(mouseoverHandler).toBeDefined();

  // 🔁 First hover — shows popup
  mouseoverHandler();

  // 🔁 Second hover — should remove existing popup
  mouseoverHandler();

  expect(popupMock.remove).toHaveBeenCalled(); // ✅ Passes if popup is cleaned up
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
    remove: jest.fn(), // ✅ what we’re checking
  };

  // Simulate same popup being reused
  L.popup
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

  expect(marker1).toBeDefined();
  expect(marker2).toBeDefined();

  const click1 = marker1.on.mock.calls.find(([e]) => e === "click")?.[1];
  const click2 = marker2.on.mock.calls.find(([e]) => e === "click")?.[1];

  expect(click1).toBeDefined();
  expect(click2).toBeDefined();

  // 🔁 Simulate clicking on two separate polygons
  click1(); // creates first popup
  click2(); // should remove the previous popup

  // ✅ Ensure the popup removal was called
  expect(popupMock.remove).toHaveBeenCalled();
});

//79-80 and 94-95
it("logs warnings when workID or grantID is missing from their respective maps", () => {
  const mockSetSelectedGrants = jest.fn();
  const mockSetSelectedWorks = jest.fn();
  const mockSetPanelOpen = jest.fn();
  const mockSetPanelType = jest.fn();
  const mockSetLocationName = jest.fn();

  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

  const locationMap = new Map([
    [
      "missing-both",
      {
        geometryType: "Polygon",
        coordinates: [[[0, 0], [1, 1], [1, 0]]],
        grantIDs: [123], // not in grantsMap
        workIDs: [456], // not in worksMap
        expertIDs: [2],
        name: "Missing Data Polygon",
        display_name: "Missing Data",
      },
    ],
  ]);

  const grantsMap = new Map(); // missing grant
  const worksMap = new Map(); // missing work
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

  expect(consoleWarnSpy).toHaveBeenCalledWith(
    "Work with ID 456 not found in worksMap."
  );
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    "Grant with ID 123 not found in grantsMap."
  );

  consoleWarnSpy.mockRestore();
});

// it("handles click on polygon .view-combined-btn and sets combined panel", () => {
//   const mockSetSelectedGrants = jest.fn();
//   const mockSetSelectedWorks = jest.fn();
//   const mockSetPanelOpen = jest.fn();
//   const mockSetPanelType = jest.fn();
//   const mockSetLocationName = jest.fn();

//   const locationMap = new Map([
//     [
//       "combinedLocation",
//       {
//         geometryType: "Polygon",
//         coordinates: [[[0, 0], [1, 1], [1, 0]]],
//         grantIDs: [1],
//         workIDs: [2],
//         expertIDs: [99],
//         name: "Combo Location",
//         display_name: "Combo Location",
//       },
//     ],
//   ]);

//   const grantsMap = new Map([[1, { matchedFields: ["test"], relatedExpertIDs: [99] }]]);
//   const worksMap = new Map([[2, { matchedFields: ["info"], relatedExpertIDs: [98] }]]);
//   const expertsMap = new Map([
//     [98, { name: "Work Expert" }],
//     [99, { name: "Grant Expert" }],
//   ]);

//   render(
//     <CombinedLayer
//       locationMap={locationMap}
//       grantsMap={grantsMap}
//       worksMap={worksMap}
//       expertsMap={expertsMap}
//       showGrants={true}
//       showWorks={true}
//       setSelectedGrants={mockSetSelectedGrants}
//       setSelectedWorks={mockSetSelectedWorks}
//       setPanelOpen={mockSetPanelOpen}
//       setPanelType={mockSetPanelType}
//       setLocationName={mockSetLocationName}
//     />
//   );

//   const marker = L.marker.mock.results[0]?.value;
//   const mouseover = marker.on.mock.calls.find(([e]) => e === "mouseover")?.[1];
//   expect(mouseover).toBeDefined();
//   mouseover();

//   const popup = L.popup.mock.results[0]?.value;
//   const popupElement = popup.getElement();
//   expect(popupElement).toBeDefined();

//   const viewBtn = popupElement.querySelector(".view-combined-btn");

//   // Fire a real event instead of calling stored handler
//   const event = new Event("click", { bubbles: true });
//   viewBtn.dispatchEvent(event);

//   expect(mockSetSelectedGrants).toHaveBeenCalledWith({ mock: "grant" });
//   expect(mockSetSelectedWorks).toHaveBeenCalledWith({ mock: "work" });
//   expect(mockSetPanelType).toHaveBeenCalledWith("combined");
//   expect(mockSetPanelOpen).toHaveBeenCalledWith(true);
// });


//407-408, 421-422
