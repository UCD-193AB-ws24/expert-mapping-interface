
// components/map/MapContainer.js

import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MapWrapper = ({ children }) => {
  return (
    <MapContainer
      center={[30, 0]} // initial view
      zoom={2}
      minZoom={2}
      maxZoom={4}
      style={{ height: "100%", width: "100%" }}
      maxBounds={[
        [-80, -200], // Southwest corner
        [85, 200]    // Northeast corner
      ]}
      maxBoundsViscosity={1.0}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
};

export default MapWrapper;
