

import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * MapWrapper Component
 * 
 * This component serves as a wrapper for the Leaflet map. It provides a base map with configurable
 * settings such as initial view, zoom levels, and map bounds. It also allows child components to
 * be rendered within the map, enabling the addition of layers, markers, and other map features.
 * 
 * Features:
 * - Sets the initial center and zoom level of the map.
 * - Restricts zoom levels and map bounds to prevent users from panning too far.
 * - Includes a TileLayer for rendering the base map using OpenStreetMap tiles.
 */

const MapWrapper = ({ children }) => {
  return (
    <MapContainer
      center={[30, 0]} // Initial center of the map [latitude, longitude].
      zoom={2} // Initial zoom level.
      minZoom={2} // Minimum zoom level to prevent excessive zooming out.
      maxZoom={12} // Maximum zoom level to prevent excessive zooming in.
      style={{ height: "100%", width: "100%" }} // Full height and width to fit the container.
      maxBounds={[
        [-80, -200], // Southwest corner of the map bounds
        [85, 200]    // Northeast corner of the map bounds
      ]}
      maxBoundsViscosity={1.0} // Viscosity for the bounds to prevent panning outside the defined area.
    >
      {/* Add a TileLayer to render the base map using OpenStreetMap tiles. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
};

export default MapWrapper;
