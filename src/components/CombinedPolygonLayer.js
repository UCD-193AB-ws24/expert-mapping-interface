import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { createCombinedPolygonPopup } from "./Popups";

const CombinedPolygonLayer = ({
  workGeoJSON,
  grantGeoJSON,
  showWorks,
  showGrants,
  setSelectedExperts,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  setCombinedKeys,
  combinedKeys, 
}) => {
  const map = useMap();
  const polygonLayersRef = useRef([]);

  useEffect(() => {
    if (!map || !workGeoJSON || !grantGeoJSON) return;

    // Clear previous polygons
    polygonLayersRef.current.forEach(p => map.removeLayer(p));
    polygonLayersRef.current = [];

    if (showWorks && showGrants) {
      const workPolygons = new Map();
      const grantPolygons = new Map();
      let activePopup = null;
      let closeTimeout = null;

      // Collect work polygons
      workGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === "Polygon") {
          const location = (feature.properties.location || feature.properties.display_name || "").toLowerCase().trim();
          if (!location) return;
          if (!workPolygons.has(location)) workPolygons.set(location, []);
          workPolygons.get(location).push(feature);
        }
      });

      // Collect grant polygons
      grantGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === "Polygon") {
          const location = (feature.properties.location || "").toLowerCase().trim();
          if (!location) return;
          if (!grantPolygons.has(location)) grantPolygons.set(location, []);
          grantPolygons.get(location).push(feature);
        }
      });

      const overlappingLocations = [];

      // Draw combined polygons where overlaps exist
      workPolygons.forEach((worksFeatures, location) => {
        if (grantPolygons.has(location)) {
          overlappingLocations.push(location);

          const grantsFeatures = grantPolygons.get(location);

          const worksCount = worksFeatures.reduce((sum, f) => sum + (f.properties.entries?.length || 0), 0);
          const grantsCount = grantsFeatures.reduce((sum, f) => sum + (f.properties.entries?.length || 0), 0);

          const geometry = worksFeatures[0].geometry;
          const flippedCoordinates = geometry.coordinates.map(ring =>
            ring.map(([lng, lat]) => [lat, lng])
          );

          const locationName = 
            worksFeatures[0]?.properties?.display_name || 
            worksFeatures[0]?.properties?.location || 
            grantsFeatures[0]?.properties?.location || 
            "Unknown";

          const polygon = L.polygon(flippedCoordinates, {
            color: "red",
            fillColor: "transparent",
            dashArray: "5,5",
            fillOpacity: 0,
            weight: 3
          }).addTo(map);

          polygonLayersRef.current.push(polygon);
          polygon.bringToFront();

          polygon.on("mouseover", () => {
            if (closeTimeout) clearTimeout(closeTimeout);
            const content = createCombinedPolygonPopup(worksCount, grantsCount, locationName);

            if (activePopup) activePopup.close();

            activePopup = L.popup({
              closeButton: false,
              autoClose: false,
              maxWidth: 300,
              className: 'hoverable-popup',
              autoPan: false,
              keepInView: false,
              interactive: true
            })
              .setLatLng(polygon.getBounds().getCenter())
              .setContent(content)
              .openOn(map);

            const popupElement = activePopup.getElement();
            if (popupElement) {
              popupElement.style.pointerEvents = 'auto';
              popupElement.addEventListener('mouseenter', () => clearTimeout(closeTimeout));
              popupElement.addEventListener('mouseleave', () => {
                closeTimeout = setTimeout(() => {
                  if (activePopup) {
                    activePopup.close();
                    activePopup = null;
                  }
                }, 300);
              });

              const viewBtn = popupElement.querySelector(".view-combined-polygon-btn");
              if (viewBtn) {
                viewBtn.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const worksEntries = worksFeatures.flatMap(f => f.properties.entries || []);
                  const grantsEntries = grantsFeatures.flatMap(f => f.properties.entries || []);

                  setSelectedExperts(worksEntries);
                  setSelectedGrants(grantsEntries);
                  setPanelType("combined-polygon");
                  setPanelOpen(true);

                  if (activePopup) {
                    activePopup.close();
                    activePopup = null;
                  }
                });
              }
            }
          });

          polygon.on("mouseout", () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });
        }
      });

      // 👉 Set combinedKeys after processing overlaps
      const newCombinedKeys = new Set(overlappingLocations);
const currentKeysString = JSON.stringify(Array.from(newCombinedKeys));
const existingKeysString = JSON.stringify(Array.from(combinedKeys));

if (currentKeysString !== existingKeysString) {
  console.log("Updating combinedKeys:", overlappingLocations);
  setCombinedKeys(newCombinedKeys);
} else {
  console.log("combinedKeys unchanged.");
}

    }

  }, [map, workGeoJSON, grantGeoJSON, showWorks, showGrants, setCombinedKeys, combinedKeys]);


  return null;
};

export default CombinedPolygonLayer;
