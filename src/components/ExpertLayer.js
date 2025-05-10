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

import { processWorkData } from "./geoJsonProcessor";

import { processWorkData } from "./geoJsonProcessor";

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
  
  // Initialize data processing for works
  // These works and their respective data will not be changed very often, so we can use a memoized version of the data.
  // This will help in avoiding unnecessary re-renders and improve performance.

  // filteredWorks: an array of features that have properties.type == "work"
  // coordinatesToExperts: a map of coordinates to experts
  // expertToWorksAndLocations: a map of experts to their works and locations
  const { filteredWorks, coordinatesToExperts, expertToWorksAndLocations } = processWorkData(geoData);

  
  
  // Initialize data processing for works
  // These works and their respective data will not be changed very often, so we can use a memoized version of the data.
  // This will help in avoiding unnecessary re-renders and improve performance.

  // filteredWorks: an array of features that have properties.type == "work"
  // coordinatesToExperts: a map of coordinates to experts
  // expertToWorksAndLocations: a map of experts to their works and locations
  const { filteredWorks, coordinatesToExperts, expertToWorksAndLocations } = processWorkData(geoData);

  
  useEffect(() => {
    if (!map || !filteredFeatures || !geoData) return;

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
    const polygonMarkerLayers = [];

    
    // Make sure showWorks is enabled before proceeding.
    if (!showWorks) return;
    if (!map || !filteredFeatures || !geoData) return;

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
    const polygonMarkerLayers = [];

    
    // Make sure showWorks is enabled before proceeding.
    if (!showWorks) return;

    // Initialize a MarkerClusterGroup for clustering point markers.
    let markerClusterGroup = L.markerClusterGroup({
    let markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 20,
      maxClusterRadius: 20,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers();
        const totalExperts = markers.reduce((sum, marker) => sum + marker.options.expertCount, 0);
        const markers = cluster.getAllChildMarkers();
        const totalExperts = markers.reduce((sum, marker) => sum + marker.options.expertCount, 0);
        return L.divIcon({
          html: `<div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40)
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40)
        });
      }
    });
    
    const renderLevels = () => {
      const currentZoom = map.getZoom();

      // Clear existing layers
      // Reset locationExpertCounts to prevent accumulation of expert counts
      locationExpertCounts.clear();
      polygonMarkerLayers.forEach(layer => map.removeLayer(layer));
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
      }
    });
    
    const renderLevels = () => {
      const currentZoom = map.getZoom();

      // Clear existing layers
      // Reset locationExpertCounts to prevent accumulation of expert counts
      locationExpertCounts.clear();
      polygonMarkerLayers.forEach(layer => map.removeLayer(layer));
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

        const center = polygon.getBounds().getCenter();
        const expertCount = locationExpertCounts.get(location) || 0;
        const polygonMarker = L.marker(center, {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${expertCount}</div>`,
            className: "center-marker-icon",
            iconSize: [30, 30]
          })
        }).addTo(map);
        
        polygonMarkerLayers.push(polygonMarker);

        polygonMarker.on("mouseover", () => {
          if (!showWorks) return;
          if (closeTimeout) clearTimeout(closeTimeout);
        polygonLayers.push(polygon);

        const center = polygon.getBounds().getCenter();
        const expertCount = locationExpertCounts.get(location) || 0;
        const polygonMarker = L.marker(center, {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${expertCount}</div>`,
            className: "center-marker-icon",
            iconSize: [30, 30]
          })
        }).addTo(map);
        
        polygonMarkerLayers.push(polygonMarker);

        polygonMarker.on("mouseover", () => {
          if (!showWorks) return;
          if (closeTimeout) clearTimeout(closeTimeout);

          
          if (expertCount === 0) return; //if polygon has no related experts, skip hover
          
          if (expertCount === 0) return; //if polygon has no related experts, skip hover

          const content = createMultiResearcherContent(
            expertCount,
            name,
            expertCount
          );
          const content = createMultiResearcherContent(
            expertCount,
            name,
            expertCount
          );

          // Close any existing popup before opening a new one.
          if (activePopup) activePopup.close();
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
        });

        polygonMarker.on("mouseout", () => {
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
        const workCount = entries.length;

        const expertCount = 0;
        entries.forEach(entry => {
          const relatedExperts = entry.relatedExperts || [];
          expertCount += relatedExperts.length;
        });

        
        polygonMarker.on("mouseout", () => {
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
        const workCount = entries.length;

        const expertCount = 0;
        entries.forEach(entry => {
          const relatedExperts = entry.relatedExperts || [];
          expertCount += relatedExperts.length;
        });

        

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${expertCount}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30]
          })
        });
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${expertCount}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30]
          })
        });

        marker.on("mouseover", () => {
          if (closeTimeout) clearTimeout(closeTimeout);
        marker.on("mouseover", () => {
          if (closeTimeout) clearTimeout(closeTimeout);

          // const content = createSingleResearcherContent();
          activePopup = L.popup({ closeButton: false, autoClose: false })
            .setLatLng(marker.getLatLng())
            .setContent(content)
            .openOn(map);
        });
          // const content = createSingleResearcherContent();
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
              }, 500);
            });

        markerClusterGroup.addLayer(marker);
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
      map.off('zoomend', renderFeatures);
      polygonLayers.forEach(layer => map.removeLayer(layer));
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach((p) => map.removeLayer(p));
      polygonMarkerLayers.forEach((p) => map.removeLayer(p));
      polygonMarkerLayers.forEach((p) => map.removeLayer(p));
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;