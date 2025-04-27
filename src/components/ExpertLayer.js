import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import {
  noResearcherContent,
  createSingleResearcherContent,
  createMultiResearcherContent
} from "./Popups";

/**
 * ExpertLayer Component
 * 
 * This component renders expert-related polygons and markers on a Leaflet map.
 * It handles interactive popups, clustering of markers, and updates the state
 * for selected experts and the side panel.
 * 
 * Props:
 * - geoData: GeoJSON object containing expert-related data.
 * - showWorks: Boolean indicating whether to display work-related polygons and markers.
 * - showGrants: Boolean indicating whether to display grant-related polygons and markers.
 * - searchKeyword: String used to filter experts based on a search term.
 * - setSelectedExperts: Function to update the selected experts for the side panel.
 * - setSelectedPointExperts: Function to update the selected point experts for the side panel.
 * - setPanelOpen: Function to control whether the side panel is open.
 * - setPanelType: Function to set the type of content displayed in the side panel.
 * - combinedKeys: Set of overlapping locations between works and grants.
 */
const ExpertLayer = ({
  geoData,
  showWorks,
  showGrants,
  searchKeyword,
  setSelectedExperts,
  setSelectedPointExperts,
  setPanelOpen,
  setPanelType,
  combinedKeys,
}) => {
  // Access the Leaflet map instance from react-leaflet's useMap hook
  const map = useMap();

  useEffect(() => {
    // Exit early if map or geoData is not available
    if (!map || !geoData) return;

    console.log("ExpertLayer - combinedKeys:", Array.from(combinedKeys));

    // Convert the search keyword to lowercase for case-insensitive matching
    const keyword = searchKeyword?.toLowerCase() || "";

    // Create a marker cluster group for clustering point markers
    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40
    });

    // Map to store the count of experts per location
    const locationExpertCounts = new Map();
    // Array to keep track of all polygon layers added to the map
    const polygonLayers = [];
    // Variable to store the currently active popup
    let activePopup = null;
    // Timeout for closing popups on mouseout
    let closeTimeout = null;

    // Filter features to include only work-related data if showWorks is true
    const filteredFeatures = geoData.features.filter(f =>
      (!f.properties?.type || f.properties.type === "work") && showWorks
    );

    // Calculate the total number of experts for each location
    filteredFeatures.forEach(feature => {
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";
      const totalLocationExperts = entries.reduce((sum, e) => sum + (e.relatedExperts?.length || 0), 0);
      if (location) {
        locationExpertCounts.set(location, (locationExpertCounts.get(location) || 0) + totalLocationExperts);
      }
    });

    // Sort polygons by area (largest first)
    const sortedPolygons = geoData.features
      .filter(f => f.geometry?.type === "Polygon")
      .sort((a, b) => {
        const area = f => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    // Set to track locations that have already been rendered
    const polygonsToRender = new Set();

    // Render each polygon on the map
    sortedPolygons.forEach(feature => {
      const locationRaw = feature.properties.location || "Unknown";
      const location = locationRaw.trim().toLowerCase();

      console.log("ExpertLayer - Checking location:", location);

      // Skip rendering if the location has already been processed
      if (!location || polygonsToRender.has(location)) return;
      polygonsToRender.add(location);

      // Skip rendering if the location overlaps with combinedKeys
      if (showWorks && showGrants && [...combinedKeys].some(key => key.trim().toLowerCase() === location)) {
        console.log(`ExpertLayer - Skipping popup for overlapping location: ${location}`);
        return;
      }

      // Flip coordinates from [lng, lat] to [lat, lng] for Leaflet compatibility
      const flippedCoordinates = feature.geometry.coordinates.map(ring =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      // Create a Leaflet polygon with styling and add it to the map
      const polygon = L.polygon(flippedCoordinates, {
        color: "blue",
        fillColor: "lightyellow",
        fillOpacity: 0.6,
        weight: 2
      }).addTo(map);

      // Add the polygon to the list of layers
      polygonLayers.push(polygon);

      // Add event listeners for interactivity
      polygon.on("mouseover", () => {
        if (!showWorks) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        // Get the expert count for the location
        const expertCount = locationExpertCounts.get(locationRaw) || 0;

        // Determine the popup content based on the expert count
        const content = expertCount === 0
          ? noResearcherContent(expertCount, locationRaw, expertCount)
          : createMultiResearcherContent(expertCount, locationRaw, expertCount);

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

          // Add a click event listener to the "View Experts" button in the popup
          const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
          if (viewExpertsBtn) {
            viewExpertsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Collect experts for the selected location and update the side panel
              const expertsAtLocation = geoData.features.filter(f => f.properties.location === locationRaw);
              setSelectedExperts(expertsAtLocation);
              setPanelType("polygon");
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

    // Add the marker cluster group to the map
    map.addLayer(markerClusterGroup);

    // Cleanup function to remove all layers from the map when the component unmounts
    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach(p => map.removeLayer(p));
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  // This component does not render any JSX
  return null;
};

export default ExpertLayer;