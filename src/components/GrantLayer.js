import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

import {
  noGrantContent,
  createMultiGrantPopup,
} from "./Popups";

/**
 * GrantLayer Component
 * 
 * This component is responsible for rendering grant-related data on a Leaflet map.
 * It processes GeoJSON data to display markers for grants and handles interactions such as hover and click events.
 * 
 * Props:
 * - grantGeoJSON: GeoJSON data containing features with grant-related information.
 * - showGrants: Boolean to toggle the display of grant markers.
 * - searchKeyword: String used to filter grants based on a search term.
 * - setSelectedGrants: Function to update the selected grants for the side panel.
 * - setPanelOpen: Function to toggle the side panel's visibility.
 * - setPanelType: Function to set the type of data displayed in the side panel.
 * - combinedKeys: Set of keys used to avoid duplicate markers for combined data.
 * - showWorks: Boolean to toggle the display of works-related data (used to avoid conflicts with grants).
 */

const GrantLayer = ({
  grantGeoJSON,
  showGrants,
  searchKeyword,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  combinedKeys,
  showWorks   
}) => {
  const map = useMap(); // Access the Leaflet map instance from react-leaflet.

  useEffect(() => {
    if (!map || !grantGeoJSON || !showGrants) return; // Exit early if the map, grants, or GeoJSON data is not available.

    const keyword = searchKeyword?.toLowerCase() || ""; // Prepare the search keyword for filtering (case-insensitive).
    const polygonLayers = [];
    let activePopup = null;
    let closeTimeout = null;

    // Filter and sort polygons 
    const sortedPolygons = grantGeoJSON.features
      .filter((feature) => feature.geometry?.type === "Polygon")
      .sort((a, b) => {
        const area = (f) => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    const polygonsToRender = new Set();

    sortedPolygons.forEach((feature) => {
      const location = feature.properties.location || "Unknown";
      // if (polygonsToRender.has(location)) return;
      // if (!location) return;

      if (!location) return;

if (showWorks && showGrants && combinedKeys?.has(location)) return;

if (polygonsToRender.has(location)) return;

polygonsToRender.add(location);


      const entries = feature.properties.entries || [];

       // Filter entries based on the search keyword.
      const matchedEntries = entries.filter(entry => {
        if (!keyword) return true;
        const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
        const quoteMatch = keyword.match(/^"(.*)"$/);  // Exact phrase match.
        if (quoteMatch) {
          const phrase = quoteMatch[1].toLowerCase();
          return entryText.includes(phrase);
        } else {
          const terms = keyword.split(/\s+/); // Multi-word match.
          return terms.every(term => entryText.includes(term));
        }
      });

      if (matchedEntries.length === 0) return;  // Skip polygons with no matched entries

      polygonsToRender.add(location);

      const flippedCoordinates = feature.geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      // Create a polygon layer for the feature.
      const polygon = L.polygon(flippedCoordinates, {
        color: "darkblue",
        fillColor: "orange",
        fillOpacity: 0.5,
        weight: 2,
      }).addTo(map);

      polygonLayers.push(polygon);
      

      polygon.on("mouseover", () => {
        if (!showGrants) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const content = createMultiGrantPopup(matchedEntries.length, location);

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

          // Prevent the popup from closing when the mouse enters it.
          popupElement.addEventListener('mouseenter', () => clearTimeout(closeTimeout));
          
          // Close the popup when the mouse leaves it after a short delay.
          popupElement.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });

           // Add a click event listener to the "View Grants" button in the popup.
          const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
          if (viewGrantsBtn) {
            viewGrantsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Update the selected grants and open the side panel.
              setSelectedGrants([feature]);  
              setPanelType("grant-polygon");
              setPanelOpen(true);

              // Close the popup after the button is clicked.
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
    });

    return () => {
      polygonLayers.forEach(p => map.removeLayer(p));
    };
  }, [map, grantGeoJSON, showGrants, searchKeyword, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;
