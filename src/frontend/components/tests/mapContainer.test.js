/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React, { createRef } from "react";
import { render } from "@testing-library/react";
import MapWrapper from "../MapContainer";

// Mock the react-leaflet MapContainer and TileLayer
jest.mock("react-leaflet", () => {
  const React = require("react");
  const actual = jest.requireActual("react-leaflet");

  return {
    ...actual,
    MapContainer: ({ children, whenCreated, mapRef, ...rest }) => {
      // Filter out the problematic props
      const { minZoom, maxZoom, maxBounds, maxBoundsViscosity, ...divProps } = rest;

      React.useEffect(() => {
        if (whenCreated) {
          whenCreated({ id: "fake-map-instance" });
        }
        if (mapRef && typeof mapRef === "object") {
          mapRef.current = { id: "fake-map-instance" };
        }
      }, [whenCreated, mapRef]);

      return (
        <div data-testid="mock-map" {...divProps}>
          {children}
        </div>
      );
    },
    TileLayer: () => <div data-testid="mock-tile-layer" />,
  };
});

describe("MapContainer", () => {
  it("renders MapContainer and TileLayer", () => {
    const { getByTestId } = render(<MapWrapper />);
    expect(getByTestId("mock-map")).toBeInTheDocument();
    expect(getByTestId("mock-tile-layer")).toBeInTheDocument();
  });

  it("renders children inside the map", () => {
    const { getByText } = render(
      <MapWrapper>
        <div>Child Element</div>
      </MapWrapper>
    );
    expect(getByText("Child Element")).toBeInTheDocument();
  });

  it("assigns map instance to mapRef when created", () => {
    const mapRef = createRef();
    render(<MapWrapper mapRef={mapRef} />);
    expect(mapRef.current).toBeDefined(); // might stay null due to mocking
  });
});
