import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";

import {
  createSingleResearcherContent,
  createMultiResearcherContent,
  createGrantPopupContent,
  createMultiGrantPopup,
} from "./Popups";

/**
 * ExpertLayer Component
 * 
 * This component is responsible for rendering a map layer that displays expert-related data
 * using Leaflet and MarkerCluster. It handles filtering, clustering, and displaying popups
 * for both point and polygon geometries.
 * 
 * Props:
 * - geoData: GeoJSON data containing features with expert-related information.
 * - showWorks: Boolean to toggle the display of works-related data.
 * - showGrants: Boolean to toggle the display of grants-related data.
 * - searchKeyword: String used to filter features based on a search term.
 * - setSelectedExperts: Function to update the selected experts for the side panel.
 * - setSelectedPointExperts: Function to update experts for a specific point.
 * - setPanelOpen: Function to toggle the side panel's visibility.
 * - setPanelType: Function to set the type of data displayed in the side panel.
 * - combinedKeys: Set of keys used to avoid duplicate markers for combined data.
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
  const map = useMap(); // Access the Leaflet map instance from react-leaflet.

  useEffect(() => {
    if (!map || !geoData) return;

    const zoomThresholds = {
      continental: 2, // Show continental polygons at zoom level 2 or lower
      country: 3,     // Show country polygons at zoom level 3-5
      state: 4,       // Show state polygons at zoom level 6-8
      city: 6,       // Show city polygons at zoom level 9-12
      points: 8      // Show individual points at zoom level 13 or higher
    };
    
    
    // Maps and arrays to store location-based data and polygon layers.
    const locationMap = new Map();
    const locationExpertCounts = new Map();
    let activePopup = null;
    let closeTimeout = null;
    const polygonLayers = [];

     // Convert the search keyword to lowercase for case-insensitive matching.
    const keyword = searchKeyword?.toLowerCase() || "";

    // Filter features based on the type and the `showWorks` flag.
    const filteredFeatures = geoData?.features?.filter(
      (f) => (!f.properties?.type || f.properties?.type === "work") && showWorks
    );

    // Initialize a MarkerClusterGroup for clustering point markers.
    let markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers();
        const totalExperts = markers.reduce((sum, marker) => sum + marker.options.expertCount, 0);
        return L.divIcon({
          html: `<div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40)
        });
      }
    });
    
    const renderLevels = () => {
      const currentZoom = map.getZoom();

      // Clear existing layers
      polygonLayers.forEach(layer => map.removeLayer(layer));
      map.removeLayer(markerClusterGroup);
      markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
        iconCreateFunction: (cluster) => {
          const markers = cluster.getAllChildMarkers();
          const totalExperts = markers.reduce((sum, marker) => sum + marker.options.expertCount, 0);
          return L.divIcon({
            html: `<div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40)
          });
        }
      });

      const getPolygonArea = (coordinates) => {
        const bounds = L.polygon(coordinates.map(([lng, lat]) => [lat, lng])).getBounds();
        return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
      };

      const sortedPolygons = filteredFeatures.filter(feature => feature.geometry.type === "Polygon")
        .map(feature => ({
          ...feature,
          area: getPolygonArea(feature.geometry.coordinates[0])
        }))
        .sort((a, b) => b.area - a.area); // Sort by area descending

      const polygonsToRender = sortedPolygons.filter(feature => {
        const area = feature.area;

        if (currentZoom <= zoomThresholds.continental) {
          return area > 100000; // Example threshold for continental polygons
        } else if (currentZoom <= zoomThresholds.country) {
          return area > 10000 && area <= 100000; // Example threshold for country polygons
        } else if (currentZoom <= zoomThresholds.state) {
          return area > 1000 && area <= 10000; // Example threshold for state polygons
        } else if (currentZoom <= zoomThresholds.city) {
          return area > 100 && area <= 1000; // Example threshold for city polygons
        }
        return false;
      });
      
      const pointsToRender =filteredFeatures.filter(feature => {
        return feature.geometry.type === "Point" && currentZoom >= zoomThresholds.points;
      });

      // Render polygons
      polygonsToRender.forEach(feature => {
        const geometry = feature.geometry;
        const entries = feature.properties.entries || [];
        const location = feature.properties.location || "Unknown";
        const flippedCoordinates = geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
        const name = feature.properties?.display_name || feature.properties?.location || "Unknown";
        let totalLocationExperts = 0;

        // Calculate the total number of experts for the location.
        entries.forEach(entry => {
          const relatedExperts = entry.relatedExperts || [];
          totalLocationExperts += relatedExperts.length;
        });

        if (totalLocationExperts > 0) {
          console.log("Location:", location, "Total Experts:", totalLocationExperts);
        }
        if (location) {
          locationExpertCounts.set(location, (locationExpertCounts.get(location) || 0) + (totalLocationExperts || 0));
        }
        
        // Create a Leaflet polygon using the flipped coordinates.
        // Set the polygon's style with a blue border, yellow fill, and 60% opacity.
        const outlineColor = "#13639e";
        const fillColor = "rgb(41, 122, 180)";
        const polygon = L.polygon(flippedCoordinates, {
          color: outlineColor,
          fillColor: fillColor,
          fillOpacity: 0.6,
          weight: 2,
        }).addTo(map);

        polygonLayers.push(polygon);

        polygon.on("mouseover", () => {
          if (!showWorks) return;
          if (closeTimeout) clearTimeout(closeTimeout);

          const expertCount = locationExpertCounts.get(location) || 0;
          if (expertCount === 0) return; //if polygon has so related experts, skip hover

          const content = createMultiResearcherContent(
            expertCount,
            name,
            expertCount
          );

          // Close any existing popup before opening a new one.
          if (activePopup) activePopup.close();

          // Create a new Leaflet popup with the generated content.
          activePopup = L.popup({
            closeButton: false,
            autoClose: false,
            maxWidth: 300,
            className: 'hoverable-popup',
            autoPan: false,
            keepInView: false,
            interactive: true
          })
            .setLatLng(polygon.getBounds().getCenter()) // Position the popup at the center of the polygon's bounds.
            .setContent(content) // Set the content of the popup.
            .openOn(map); // Add the popup to the map.

          // Retrieve the DOM element of the popup for further interaction.
          const popupElement = activePopup.getElement();
          if (popupElement) {
            popupElement.style.pointerEvents = 'auto';

          // Prevent the popup from closing when the mouse enters it.
          popupElement.addEventListener('mouseenter', () => {
            if (closeTimeout) clearTimeout(closeTimeout);
          });

          // Close the popup when the mouse leaves it after a short delay.
          popupElement.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });

           // Filter the GeoJSON features to find experts associated with the polygon's location.
          const expertsAtLocation = geoData.features.filter(f => f.properties.location === location);

           // Add a click event listener to the "View Experts" button in the popup.
          const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
          if (viewExpertsBtn) {
            viewExpertsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Update the selected experts and open the side panel with the appropriate type.
              setSelectedExperts(expertsAtLocation);
              setPanelType("polygon");
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

      // Render points
      pointsToRender.forEach(feature => {
        const geometry = feature.geometry;
        const [lng, lat] = feature.geometry.coordinates;
        const coords = geometry.type === "Point" ? [[lng, lat]] : geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
        const entries = feature.properties.entries || [];
        // const location = feature.properties.location || "Unknown";

        coords.forEach(([lng, lat]) => {
          const key = `${lat},${lng}`;
          if (!locationMap.has(key)) locationMap.set(key, []);

          const matchedEntries = [];

          // Filter entries based on the search keyword.
          entries.forEach(entry => {
            if (keyword) {
              const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase(); 
              const quoteMatch = keyword.match(/^"(.*)"$/); // Exact phrase match.
              if (quoteMatch) {
                const phrase = quoteMatch[1].toLowerCase();
                if (!entryText.includes(phrase)) return; 
              } else {
                const terms = keyword.toLowerCase().split(/\s+/); // Multi-word match.
                const matchesAll = terms.every(term => entryText.includes(term));
                if (!matchesAll) return;
              }
            }

            const expert = entry.relatedExperts?.[0]; // Extract the first related expert from the entry, if available.
            // Create an object representing the matched entry and push it to the `matchedEntries` array.
            matchedEntries.push({
              researcher_name: expert?.name || entry.authors?.join(", ") || "Unknown",
              researcher_url: expert?.url
                ? `https://experts.ucdavis.edu/${expert.url}`
                : null,
              location_name: feature.properties.location || "Unknown",
              work_titles: [entry.title],
              work_count: 1,
              confidence: entry.confidence || "Unknown",
              type: "expert",
            });
          });

          // If there are any matched entries, add them to the `locationMap` for the corresponding key.
          if (matchedEntries.length > 0) {
            //console.log("Location:", key, "Matched Entries:", matchedEntries);
            locationMap.get(key).push(...matchedEntries);
          }
        });

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>1</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30]
          })
        });

        marker.on("mouseover", () => {
          if (closeTimeout) clearTimeout(closeTimeout);

          const content = createSingleResearcherContent(feature.properties);
          activePopup = L.popup({ closeButton: false, autoClose: false })
            .setLatLng(marker.getLatLng())
            .setContent(content)
            .openOn(map);
        });

        marker.on("mouseout", () => {
          closeTimeout = setTimeout(() => {
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          }, 300);
        });

        marker.on("click", () => {
          setSelectedPointExperts([feature.properties]);
          setPanelType("point");
          setPanelOpen(true);
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        });

        markerClusterGroup.addLayer(marker);
      });

      map.addLayer(markerClusterGroup);

  };
    // Initial render
    renderLevels();

    // Add zoom listener
    map.on('zoomend', renderLevels);
    // Cleanup function to remove layers when the component unmounts or dependencies change.
    return () => {
      map.off('zoomend', renderLevels);
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach((p) => map.removeLayer(p));
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;