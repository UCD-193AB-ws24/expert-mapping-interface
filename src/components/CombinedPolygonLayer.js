import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { createCombinedPolygonPopup } from "./Popups";

/**
 * CombinedPolygonLayer Component
 * 
 * This component renders combined polygons on a Leaflet map where there is an overlap
 * between works and grants for specific locations. It handles interactive popups and
 * updates the state for selected experts, grants, and the side panel.
 * 
 * Props:
 * - workGeoJSON: GeoJSON object containing work-related data.
 * - grantGeoJSON: GeoJSON object containing grant-related data.
 * - showWorks: Boolean indicating whether to display work polygons.
 * - showGrants: Boolean indicating whether to display grant polygons.
 * - setSelectedExperts: Function to update the selected experts for the side panel.
 * - setSelectedGrants: Function to update the selected grants for the side panel.
 * - setPanelOpen: Function to control whether the side panel is open.
 * - setPanelType: Function to set the type of content displayed in the side panel.
 * - setCombinedKeys: Function to update the set of overlapping locations.
 * - combinedKeys: Set of currently overlapping locations.
 * - setLocationName: Function to set the name of the location for the side panel.
 */
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
  setLocationName
}) => {
  // Access the Leaflet map instance from react-leaflet's useMap hook
  const map = useMap();

  // Ref to store the polygon layers added to the map
  const polygonLayersRef = useRef([]);

  useEffect(() => {
    // Exit early if map, workGeoJSON, or grantGeoJSON is not available
    if (!map || !workGeoJSON || !grantGeoJSON) return;

    // Clear previous polygons from the map
    polygonLayersRef.current.forEach(p => map.removeLayer(p));
    polygonLayersRef.current = [];

    // Only proceed if both works and grants are to be displayed
    if (showWorks && showGrants) {
      const workPolygons = new Map(); // Map to store work polygons by location
      const grantPolygons = new Map(); // Map to store grant polygons by location
      let activePopup = null; // Variable to store the currently active popup
      let closeTimeout = null; // Timeout for closing popups on mouseout

      // Collect work polygons by location
      workGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === "Polygon") {
          const location = (feature.properties.location || feature.properties.display_name || "").toLowerCase().trim();
          if (!location) return;
          if (!workPolygons.has(location)) workPolygons.set(location, []);
          workPolygons.get(location).push(feature);
        }
      });

      // Collect grant polygons by location
      grantGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === "Polygon") {
          const location = (feature.properties.location || "").toLowerCase().trim();
          if (!location) return;
          if (!grantPolygons.has(location)) grantPolygons.set(location, []);
          grantPolygons.get(location).push(feature);
        }
      });

      const overlappingLocations = []; // Array to store locations with overlaps

      // Draw combined polygons for overlapping locations
      workPolygons.forEach((worksFeatures, location) => {
        if (grantPolygons.has(location)) {
          overlappingLocations.push(location);

          const grantsFeatures = grantPolygons.get(location);

          // Calculate the total number of works and grants for the location
          const worksCount = worksFeatures.reduce((sum, f) => sum + (f.properties.entries?.length || 0), 0);
          const grantsCount = grantsFeatures.reduce((sum, f) => sum + (f.properties.entries?.length || 0), 0);

          // Use the geometry of the first work feature for the polygon
          const geometry = worksFeatures[0].geometry;
          const flippedCoordinates = geometry.coordinates.map(ring =>
            ring.map(([lng, lat]) => [lat, lng])
          );

          // Determine the location name
          const locationName = 
            worksFeatures[0]?.properties?.display_name || 
            worksFeatures[0]?.properties?.location || 
            grantsFeatures[0]?.properties?.location || 
            "Unknown";

          // Create a Leaflet polygon with dashed styling
          const polygon = L.polygon(flippedCoordinates, {
            color: "red",
            fillColor: "transparent",
            dashArray: "5,5",
            fillOpacity: 0,
            weight: 3
          }).addTo(map);

          // Add the polygon to the list of layers
          polygonLayersRef.current.push(polygon);
          polygon.bringToFront();

          // Add event listeners for interactivity
          polygon.on("mouseover", () => {
            if (closeTimeout) clearTimeout(closeTimeout);

            // Create popup content for the combined polygon
            const content = createCombinedPolygonPopup(worksCount, grantsCount, locationName);

            // Close the currently active popup if it exists
            if (activePopup) activePopup.close();

            // Create and open a new popup
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

            // Add event listeners to the popup for mouse interactions
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

              // Add a click event listener to the "View Combined Polygon" button in the popup
              const viewBtn = popupElement.querySelector(".view-combined-polygon-btn");
              if (viewBtn) {
                viewBtn.addEventListener("click", (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  // Collect entries for works and grants at the location
                  const worksEntries = worksFeatures.flatMap(f => f.properties.entries || []);
                  const grantsEntries = grantsFeatures.flatMap(f => f.properties.entries || []);

                  // Update the state for the side panel
                  setSelectedExperts(worksEntries);
                  setSelectedGrants(grantsEntries);
                  setPanelType("combined-polygon");
                  setLocationName(locationName);
                  setPanelOpen(true);

                  // Close the active popup
                  if (activePopup) {
                    activePopup.close();
                    activePopup = null;
                  }
                });
              }
            }
          });

          // Close the popup on mouseout with a delay
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

      // Update the combinedKeys state if overlapping locations have changed
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

  // This component does not render any JSX
  return null;
};

export default CombinedPolygonLayer;