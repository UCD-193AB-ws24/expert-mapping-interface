import { useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import {
  createGrantPopupContent,
  createMultiGrantPopup
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
    if (!map || !showGrants || !grantGeoJSON) return; // Exit early if the map, grants, or GeoJSON data is not available.

    const keyword = searchKeyword?.toLowerCase() || ""; // Prepare the search keyword for filtering (case-insensitive).
    const locationMap = new Map();
    let activePopup = null;
    let closeTimeout = null;

    // Process each feature in the GeoJSON data.
    (grantGeoJSON?.features || []).forEach((feature) => {
      // Skip features without geometry or unsupported geometry types.
      if (!feature.geometry || (feature.geometry.type !== "Point" && feature.geometry.type !== "Polygon")) return;


      let lat, lng;
      // Extract coordinates for Point geometries.
      if (feature.geometry.type === "Point") {
        [lng, lat] = feature.geometry.coordinates;
      }
      // Calculate the center for Polygon geometries.
       else if (feature.geometry.type === "Polygon") {
        const latlngs = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
        const center = L.polygon(latlngs).getBounds().getCenter();
        lat = center.lat;
        lng = center.lng;
      } else {
        return; // skip unsupported geometry
      }

      // Create a unique key for the location using latitude and longitude.
      const key = `${lat},${lng}`;
      if (!locationMap.has(key)) locationMap.set(key, []);

      // Extract grant entries from the feature's properties.
      const entries = feature.properties.entries || [];
      const matchedEntries = [];
      
      
      // Filter entries based on the search keyword.
      entries.forEach(entry => {
        if (keyword) {
          const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
          const quoteMatch = keyword.match(/^"(.*)"$/);  // Exact phrase match.
          if (quoteMatch) {
            const phrase = quoteMatch[1].toLowerCase();
            if (!entryText.includes(phrase)) return;
          } else {
            const terms = keyword.toLowerCase().split(/\s+/); // Multi-word match.
            const matchesAll = terms.every(term => entryText.includes(term));
            if (!matchesAll) return;
          }
        }

        // Add additional properties to the entry for display purposes.
        entry.location_name = feature.properties.location;
        entry.researcher_name = entry.relatedExpert?.name || "Unknown";
        entry.researcher_url = entry.relatedExpert?.url
          ? `https://experts.ucdavis.edu/${entry.relatedExpert.url}`
          : null;

        matchedEntries.push(entry);
      });

      // Add matched entries to the location map.
      if (matchedEntries.length > 0) {
        locationMap.get(key).push(...matchedEntries);
      }
    });

    // Initialize an array to store markers.
    const markers = [];

    // Create markers for each location in the location map.
    locationMap.forEach((grants, key) => {
      if (!grants || grants.length === 0) return;

       // Skip markers if both grants and works are shown and the location is in `combinedKeys`.
      if (showGrants && showWorks && combinedKeys?.has(key)) return;

       // Extract latitude and longitude from the location key.
      const [lat, lng] = key.split(",").map(Number);

      // Create a custom marker for the location.
      // const aggieGold = "#F6E8B1";
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #f59e0b; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${grants.length}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30],
        }),
        grantCount: grants.length,
        grants,
      });

      // Create a popup for the marker.
      const popup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 250,
        className: 'hoverable-popup',
        autoPan: false,
        keepInView: false,
        interactive: true
      });

       // Add hover behavior for the marker.
      marker.on("mouseover", () => {
        if (!grants || grants.length === 0 || !grants[0]) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        // Generate popup content based on the number of grants.
        const content = grants.length === 1
          ? createGrantPopupContent(grants[0])
          : createMultiGrantPopup(grants, grants[0].location_name);

        // Set the popup content and position, then open it on the map.
        popup.setLatLng(marker.getLatLng())
             .setContent(content)
             .openOn(map);

        activePopup = popup;

        // Enable interaction with the popup.
        const popupElement = popup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';

          // Prevent the popup from closing when the mouse enters it.
          popupElement.addEventListener("mouseenter", () => {
            if (closeTimeout) clearTimeout(closeTimeout);
          });

           // Close the popup when the mouse leaves it after a short delay.
          popupElement.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 500);
          });

          // Add a click event listener to the "View Grants" button in the popup.
          const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
          if (viewGrantsBtn) {
            viewGrantsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Update the selected grants and open the side panel.
              setSelectedGrants(grants);
              setPanelType("grants");
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

      marker.on("mouseout", () => {
        closeTimeout = setTimeout(() => {
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        }, 500);
      });

       // Add the marker to the map and store it in the markers array.
      marker.addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach((marker) => {
        map.removeLayer(marker);
      });
    };
  }, [map, grantGeoJSON, showGrants, searchKeyword, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;