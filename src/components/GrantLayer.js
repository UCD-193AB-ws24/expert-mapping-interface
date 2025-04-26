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
 * This component renders grant-related polygons on a Leaflet map, calculates
 * the number of related experts for each location, and handles interactive
 * popups and side panel actions.
 * 
 * Props:
 * - grantGeoJSON: GeoJSON object containing grant data with features and properties.
 * - showGrants: Boolean indicating whether to display grant polygons on the map.
 * - searchKeyword: String used to filter grants based on a search term.
 * - setSelectedGrants: Function to update the selected grants for the side panel.
 * - setPanelOpen: Function to control whether the side panel is open.
 * - setPanelType: Function to set the type of content displayed in the side panel.
 */

const GrantLayer = ({
  grantGeoJSON,
  showGrants,
  searchKeyword,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
}) => {
  // Access the Leaflet map instance from react-leaflet's useMap hook
  const map = useMap();

  useEffect(() => {
    // Exit early if map, grantGeoJSON, or showGrants is not available
    if (!map || !grantGeoJSON || !showGrants) return;

    // Convert the search keyword to lowercase for case-insensitive matching
    const keyword = searchKeyword?.toLowerCase() || "";

    // Map to store the count of experts per location
    const locationGrantCounts = new Map();
    // Array to keep track of all polygon layers added to the map
    const polygonLayers = [];
    // Variable to store the currently active popup
    let activePopup = null;
    // Timeout for closing popups on mouseout
    let closeTimeout = null;

    // Process each feature in the GeoJSON to calculate the total number of related experts
    grantGeoJSON.features.forEach((feature) => {
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";
      let totalLocationExperts = 0;

      // Count the number of related experts for each entry
      entries.forEach(entry => {
        const relatedExperts = entry.relatedExpert ? [entry.relatedExpert] : [];
        totalLocationExperts += relatedExperts.length;
      });

      // Update the expert count for the location
      if (location) {
        locationGrantCounts.set(location, (locationGrantCounts.get(location) || 0) + totalLocationExperts);
      }
    });

    // Filter and sort polygons by area (largest first)
    const sortedPolygons = grantGeoJSON.features
      .filter((feature) => feature.geometry?.type === "Polygon")
      .sort((a, b) => {
        const area = (f) => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    console.log("Grant Polygons to draw:", sortedPolygons.length);

    // Set to track locations that have already been rendered
    const polygonsToRender = new Set();

    // Render each polygon on the map
    sortedPolygons.forEach((feature) => {
      const geometry = feature.geometry;
      const location = feature.properties.location;

      // Skip rendering if the location has already been processed
      if (polygonsToRender.has(location)) return;
      if (location) polygonsToRender.add(location);

      // Flip coordinates from [lng, lat] to [lat, lng] for Leaflet compatibility
      const flippedCoordinates = geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      // Get the display name or location name for the polygon
      const name = feature.properties?.display_name || feature.properties?.location || "Unknown";

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

        // Get the expert count for the location
        const expertCount = locationGrantCounts.get(location) || 0;

        // Determine the popup content based on the expert count
        const content = (expertCount === 0)
          ? noGrantContent(location)
          : createMultiGrantPopup(expertCount, location);

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

          popupElement.addEventListener('mouseenter', () => {
            if (closeTimeout) clearTimeout(closeTimeout);
          });

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

              // Filter grants for the selected location and update the side panel
              const grantsAtLocation = grantGeoJSON.features.filter(f => f.properties.location === location);

              setSelectedGrants(grantsAtLocation);
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

    console.log("Grant Polygons drawn on map:", polygonLayers.length);

    // Cleanup function to remove all polygons from the map when the component unmounts
    return () => {
      polygonLayers.forEach(p => map.removeLayer(p));
    };
  }, [map, grantGeoJSON, showGrants, searchKeyword, setSelectedGrants, setPanelOpen, setPanelType]);

  // This component does not render any JSX
  return null;
};

export default GrantLayer;