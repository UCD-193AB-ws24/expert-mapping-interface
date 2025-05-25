/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import CombinedLayer from "../rendering/CombinedLayer";
import { useMap } from "react-leaflet";
import L from "leaflet";
import * as panelUtils from "../rendering/utils/preparePanelData";

jest.mock("react-leaflet", () => {
  return {
    __esModule: true,
    ...jest.requireActual("react-leaflet"),
    useMap: jest.fn(),
  };
});

jest.mock("leaflet", () => {
  return {
    polygon: jest.fn(),
    marker: jest.fn(),
    popup: jest.fn(() => ({
      setLatLng: jest.fn().mockReturnThis(),
      setContent: jest.fn().mockReturnThis(),
      openOn: jest.fn(),
      remove: jest.fn(),
      getElement: jest.fn(() => ({
        style: { pointerEvents: "auto" },
        addEventListener: jest.fn(),
      })),
    })),
    markerClusterGroup: jest.fn(() => ({
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    })),
    divIcon: jest.fn(() => ({})),
    point: jest.fn(() => [40, 40]),
  };
});

describe("CombinedLayer (no getBounds tests)", () => {
  let mockMap;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMap = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
    };
    useMap.mockReturnValue(mockMap);

    L.marker.mockImplementation(() => ({
      addTo: jest.fn(),
      on: jest.fn(),
      bindPopup: jest.fn(),
      getLatLng: jest.fn(() => ({ lat: 1, lng: 1 })),
      options: {},
    }));

    L.polygon.mockImplementation(() => ({
      addTo: jest.fn(),
      bindPopup: jest.fn(),
      on: jest.fn(),
    }));
  });

  // Test to verify that a point marker is rendered when the geometry is Point
  it("renders point marker if geometry is Point", () => {
    const locationMap = new Map([
      ["loc2", {
        geometryType: "Point",
        coordinates: [0, 0],
        worksIDs: ["w2"],
        grantIDs: ["g2"],
        name: "Loc2",
      }]
    ]);
    const worksMap = new Map([["w2", { relatedExpertIDs: ["e1"], matchedFields: ["title"] }]]);
    const grantsMap = new Map([["g2", { relatedExpertIDs: ["e2"], matchedFields: ["abstract"] }]]);
    const expertsMap = new Map([["e1", {}], ["e2", {}]]);

    render(
      <CombinedLayer
        locationMap={locationMap}
        worksMap={worksMap}
        grantsMap={grantsMap}
        expertsMap={expertsMap}
        showWorks={true}
        showGrants={true}
        setSelectedWorks={jest.fn()}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
        setLocationName={jest.fn()}
      />
    );

    expect(L.marker).toHaveBeenCalled();
  });

  // Test to verify that nothing is rendered if both toggles are off
  it("does not render anything if both toggles are off", () => {
    render(
      <CombinedLayer
        locationMap={new Map()}
        worksMap={new Map()}
        grantsMap={new Map()}
        expertsMap={new Map()}
        showWorks={false}
        showGrants={false}
        setSelectedWorks={jest.fn()}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
        setLocationName={jest.fn()}
      />
    );
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  // Test to verify that layers are cleaned up when the component unmounts
  it("cleans up layers on unmount", () => {
    const { unmount } = render(
      <CombinedLayer
        locationMap={new Map()}
        worksMap={new Map()}
        grantsMap={new Map()}
        expertsMap={new Map()}
        showWorks={true}
        showGrants={true}
        setSelectedWorks={jest.fn()}
        setSelectedGrants={jest.fn()}
        setPanelOpen={jest.fn()}
        setPanelType={jest.fn()}
        setLocationName={jest.fn()}
      />
    );
    unmount();
    expect(mockMap.removeLayer).toHaveBeenCalled();
  });
});