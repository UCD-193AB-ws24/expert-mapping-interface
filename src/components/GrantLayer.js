import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { createMultiGrantPopup } from "./Popups";

/**
 * GrantLayer Component
 * 
 * This component renders grant-related polygons on a Leaflet map. It filters
 * and sorts polygons based on the provided GeoJSON data, handles interactive
 * popups, and updates the state for selected grants and the side panel.
 * 
 * Props:
 * - grantGeoJSON: GeoJSON object containing grant-related data.
 * - showGrants: Boolean indicating whether to display grant polygons.
 * - searchKeyword: String used to filter grants based on a search term.
 * - setSelectedGrants: Function to update the selected grants for the side panel.
 * - setPanelOpen: Function to control whether the side panel is open.
 * - setPanelType: Function to set the type of content displayed in the side panel.
 * - combinedKeys: Set of overlapping locations between works and grants.
 * - showWorks: Boolean indicating whether to display work-related polygons.
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
  // Access the Leaflet map instance from react-leaflet's useMap hook
  const map = useMap();

  useEffect(() => {
    // Exit early if map, grantGeoJSON, or showGrants is not available
    if (!map || !grantGeoJSON || !showGrants) return;

    console.log("GrantLayer - combinedKeys:", Array.from(combinedKeys));

    // Convert the search keyword to lowercase for case-insensitive matching
    const keyword = searchKeyword?.toLowerCase() || "";
    const polygonLayers = []; // Array to keep track of all polygon layers added to the map
    let activePopup = null; // Variable to store the currently active popup
    let closeTimeout = null; // Timeout for closing popups on mouseout

    // Filter and sort polygons by area (largest first)
    const sortedPolygons = grantGeoJSON.features
      .filter(f => f.geometry?.type === "Polygon")
      .sort((a, b) => {
        const area = f => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    const polygonsToRender = new Set(); // Set to track locations that have already been rendered

    // Render each polygon on the map
    sortedPolygons.forEach(feature => {
      const locationRaw = feature.properties.location || "Unknown";
      const location = locationRaw.trim().toLowerCase();

      console.log("GrantLayer - Checking location:", location);

      // Skip rendering if the location has already been processed
      if (!location || polygonsToRender.has(location)) return;
      polygonsToRender.add(location);

      // Filter entries based on the search keyword
      const matchedEntries = (feature.properties.entries || []).filter(entry => {
        if (!keyword) return true;
        const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
        const quoteMatch = keyword.match(/^"(.*)"$/); // Match exact phrases in quotes
        return quoteMatch
          ? entryText.includes(quoteMatch[1].toLowerCase())
          : keyword.split(/\s+/).every(term => entryText.includes(term));
      });

      // Skip rendering if no entries match the search keyword
      if (matchedEntries.length === 0) return;

      // Skip rendering if the location overlaps with combinedKeys
      if (showWorks && showGrants && [...combinedKeys].some(key => key.trim().toLowerCase() === location)) {
        console.log(`GrantLayer - Skipping popup for overlapping location: ${location}`);
        return;
      }

      // Flip coordinates from [lng, lat] to [lat, lng] for Leaflet compatibility
      const flippedCoordinates = feature.geometry.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));

      // Create a Leaflet polygon with styling and add it to the map
      const polygon = L.polygon(flippedCoordinates, {
        color: "darkblue",
        fillColor: "orange",
        fillOpacity: 0.5,
        weight: 2,
      }).addTo(map);

      // Add the polygon to the list of layers
      polygonLayers.push(polygon);

      // Add event listeners for interactivity
      polygon.on("mouseover", () => {
        if (!showGrants) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        // Create popup content for the polygon
        const content = createMultiGrantPopup(matchedEntries.length, locationRaw);

        // Close the currently active popup if it exists
        if (activePopup) activePopup.close();

        // Create and open a new popup
        activePopup = L.popup({
          closeButton: false,
          autoClose: false,
          maxWidth: 300,
          className: 'hoverable-popup',
          autoPan: false
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

          // Add a click event listener to the "View Grants" button in the popup
          const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
          if (viewGrantsBtn) {
            viewGrantsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Update the state for the side panel
              setSelectedGrants([feature]);
              setPanelType("grant-polygon");
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
    });

    // Cleanup function to remove all polygons from the map when the component unmounts
    return () => {
      polygonLayers.forEach(p => map.removeLayer(p));
    };
  }, [map, grantGeoJSON, showGrants, searchKeyword, setSelectedGrants, setPanelOpen, setPanelType]);

  // This component does not render any JSX
  return null;
};

export default GrantLayer;