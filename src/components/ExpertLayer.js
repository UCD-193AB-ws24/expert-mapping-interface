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
 * This component renders expert-related polygons and point markers on a Leaflet map.
 * It handles keyword filtering, clustering of markers, interactive popups, and updates
 * the state for selected experts and the side panel.
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
    const locationMap = new Map();
    const locationExpertCounts = new Map();
    const polygonLayers = []; // Array to keep track of all polygon layers added to the map
    let activePopup = null; // Variable to store the currently active popup
    let closeTimeout = null; // Timeout for closing popups on mouseout

    // Filter features to include only work-related data if showWorks is true
    const filteredFeatures = geoData.features.filter(f =>
      (!f.properties?.type || f.properties.type === "work") && showWorks
    );

    // --- Handle Points with Keyword Filtering ---
    filteredFeatures.forEach(feature => {
      const geometry = feature.geometry;
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";

      // Calculate the total number of experts for the location
      let totalLocationExperts = entries.reduce((sum, e) => sum + (e.relatedExperts?.length || 0), 0);
      locationExpertCounts.set(location, (locationExpertCounts.get(location) || 0) + totalLocationExperts);

      // Handle point geometries (Point or MultiPoint)
      if (["Point", "MultiPoint"].includes(geometry.type)) {
        const coords = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates;

        coords.forEach(([lng, lat]) => {
          const key = `${lat},${lng}`;
          if (!locationMap.has(key)) locationMap.set(key, []);

          const popupEntries = [];   // For marker popups
          const panelEntries = [];   // For side panel

          // Filter entries based on the search keyword
          entries.forEach(entry => {
            if (keyword) {
              const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
              const quoteMatch = keyword.match(/^"(.*)"$/); // Match exact phrases in quotes
              if (quoteMatch) {
                const phrase = quoteMatch[1];
                if (!entryText.includes(phrase)) return;  //Exact phrase match
              } else {
                const terms = keyword.split(/\s+/); // Split multi-word input
                const matchesAll = terms.every(term => entryText.includes(term));
                if (!matchesAll) return; // Partial + multi-word match (AND logic)
              }
            }

            // Collect matched entries with expert details
            const expert = entry.relatedExperts?.[0];
            popupEntries.push({
              researcher_name: expert?.name || entry.authors?.join(", ") || "Unknown",
              researcher_url: expert?.url ? `https://experts.ucdavis.edu/${expert.url}` : null,
              location_name: location,
              work_titles: [entry.title],
              work_count: 1,
              confidence: entry.confidence || "Unknown",
              type: "expert",
            });

            // For Side Panel
            panelEntries.push({
              ...entry,
              relatedExperts: entry.relatedExperts || [],
              location_name: location
            });
          });

          // Add popup entries to the location map
          if (popupEntries.length > 0) {
            locationMap.get(key).push(...popupEntries);
            locationMap.get(key).panelData = panelEntries;
          }
        });
      }
    });

    // --- Handle Polygons ---
    const sortedPolygons = geoData.features
      .filter(f => f.geometry?.type === "Polygon")
      .sort((a, b) => {
        const area = f => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    const polygonsToRender = new Set(); // Set to track locations that have already been rendered

    sortedPolygons.forEach(feature => {
      const locationRaw = feature.properties.location || "Unknown";
      const location = locationRaw.trim().toLowerCase();
      if (!showWorks && (showGrants || !searchKeyword)) return;


      // Skip rendering if the location has already been processed
      if (!location || polygonsToRender.has(location)) return;

      // Skip rendering if the location overlaps with combinedKeys
      if (showWorks && showGrants && [...combinedKeys].some(key => key.trim().toLowerCase() === location)) {
        console.log(`ExpertLayer - Skipping popup for overlapping location: ${location}`);
        return;
      }
      const entries = feature.properties.entries || [];

      // Filter entries based on the search keyword
      const matchedEntries = entries.filter(entry => {
        if (!keyword) return true;
        const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
        const quoteMatch = keyword.match(/^"(.*)"$/); // Match exact phrases in quotes
        if (quoteMatch) {
          return entryText.includes(quoteMatch[1]);
        } else {
          const terms = keyword.split(/\s+/);
          return terms.every(term => entryText.includes(term));
        }
      });


      if (matchedEntries.length === 0) return;  // Skip rendering if no matches

      polygonsToRender.add(location);

      // Flip coordinates from [lng, lat] to [lat, lng] for Leaflet compatibility
      const flippedCoordinates = feature.geometry.coordinates.map(ring =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      // Get the expert count for the location
      const expertCount = locationExpertCounts.get(locationRaw) || 0;

      // Create a Leaflet polygon with styling and add it to the map
      const polygon = L.polygon(flippedCoordinates, {
        color: "blue",
        fillColor: "#dbeafe",
        fillOpacity: 0.6,
        weight: 2
      }).addTo(map);

      // Add the polygon to the list of layers
      polygonLayers.push(polygon);

      // Add event listeners for interactivity
      polygon.on("mouseover", () => {
        if (!showWorks) return;
        if (closeTimeout) clearTimeout(closeTimeout);

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

    // --- Render Markers for Points ---
    locationMap.forEach((experts, key) => {
      if (!experts.length || (showGrants && showWorks && combinedKeys?.has(key))) return;

      const [lat, lng] = key.split(",").map(Number);

      // Create a custom marker for the location
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${experts.length}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30],
        }),
        experts,
        expertCount: experts.length,
        panelData: locationMap.get(key).panelData   // Attach panel data here
      });

      marker.on("mouseover", () => {
        const content = experts.length === 1
          ? createSingleResearcherContent(experts[0])
          : createMultiResearcherContent(
            experts.length,
            experts[0]?.location_name,
            experts.reduce((s, e) => s + (parseInt(e.work_count) || 0), 0)
          );

        if (activePopup) activePopup.close();

        // Create and open a new popup (same style as polygon)
        activePopup = L.popup({
          closeButton: false,
          autoClose: false,
          maxWidth: 300,
          className: 'hoverable-popup',
          autoPan: false
        })
          .setLatLng(marker.getLatLng())
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

          // Handle the "View Experts" button click
          const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
          if (viewExpertsBtn) {
            viewExpertsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              setSelectedPointExperts(marker.options.panelData);   // ⭐ Use panelData
              setPanelType("point");
              setPanelOpen(true);

              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            });
          }
        }
      });

      // Close popup on mouseout like polygons
      marker.on("mouseout", () => {
        closeTimeout = setTimeout(() => {
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        }, 500);
      });

      // Add the marker to the cluster group
      markerClusterGroup.addLayer(marker);
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