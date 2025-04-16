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

     // Convert the search keyword to lowercase for case-insensitive matching.
    const keyword = searchKeyword?.toLowerCase() || "";

    // Filter features based on the type and the `showWorks` flag.
    const filteredFeatures = geoData?.features?.filter(
      (f) => (!f.properties?.type || f.properties?.type === "work") && showWorks
    );

    // Initialize a MarkerClusterGroup for clustering point markers.
    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        // Custom cluster icon showing the total number of experts in the cluster.
        const totalExperts = cluster
          .getAllChildMarkers()
          .reduce((sum, marker) => sum + marker.options.expertCount, 0);
        return L.divIcon({
          html: `<div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40),
        });
      },
    });

    // Maps and arrays to store location-based data and polygon layers.
    const locationMap = new Map();
    const locationExpertCounts = new Map();
    const polygonLayers = [];
    let activePopup = null;
    let closeTimeout = null;

    // Process each feature in the filtered GeoJSON data.
    filteredFeatures?.forEach((feature) => {
      const geometry = feature.geometry;
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";
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

    // Handle point and multipoint geometries.
      if (["Point", "MultiPoint"].includes(geometry.type)) {
        const coords = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates;

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
            locationMap.get(key).push(...matchedEntries);
          }
        });
      }
    });


    // Sort and render polygon geometries.
    const sortedPolygons = geoData.features
      .filter((feature) => {
        const geom = feature.geometry;
        const rings = geom?.coordinates;
        const outer = rings?.[0];
        return (
          geom?.type === "Polygon" &&
          Array.isArray(outer) &&
          outer.length >= 4 &&
          outer.length <= 200000
        );
      })
      .sort((a, b) => {
         // Define a function to calculate the approximate area of a polygon feature.
        const area = (f) => {
          // Create a Leaflet polygon using the coordinates of the feature's geometry.
          // The coordinates are flipped from [lng, lat] to [lat, lng] as required by Leaflet.
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          // Calculate the area as the product of the width (east-west distance) and height (north-south distance) of the bounding box.
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        // Compare two features by their calculated area in descending order.
        // Features with larger areas will appear earlier in the sorted array.
        return area(b) - area(a);
      });

    console.log("Polygons to draw:", sortedPolygons.length);
    const polygonsToRender = new Set();

    sortedPolygons.forEach((feature, i) => {
      // Extract the geometry and location properties from the feature.
      const geometry = feature.geometry;
      const location = feature.properties.location;

      // Skip rendering if the location has already been processed.
      if (polygonsToRender.has(location)) return;

      // Add the location to the set of polygons to render if it exists.
      if (location) polygonsToRender.add(location);

      // Flip the coordinates from [lng, lat] to [lat, lng] as required by Leaflet.
      const flippedCoordinates = geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      // Retrieve the name of the polygon, using either the display name or location.
      // Default to "Unknown" if neither is available.
      const name = feature.properties?.display_name || feature.properties?.location || "Unknown";
      console.log(" Drawing polygon:", name, flippedCoordinates[0]);

      // Create a Leaflet polygon using the flipped coordinates.
      // Set the polygon's style with a blue border, yellow fill, and 60% opacity.
      const polygon = L.polygon(flippedCoordinates, {
        color: "blue",
        fillColor: "yellow",
        fillOpacity: 0.6,
        weight: 2,
      }).addTo(map);

      polygonLayers.push(polygon); // Store the created polygon in the `polygonLayers` array for later use (e.g., cleanup).


      // Add hover and click events for polygons.
      polygon.on("mouseover", () => {
        if (!showWorks) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const expertCount = locationExpertCounts.get(location) || 0;
        if (expertCount === 0) return; //if polygon has so related experts, skip hover

        const content = createMultiResearcherContent(
          expertCount,
          feature.properties.display_name || feature.properties.location || "Unknown",
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

      // Add a mouseout event to close the popup when the mouse leaves the polygon.
      polygon.on("mouseout", () => {
        closeTimeout = setTimeout(() => {
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        }, 300);
      });


    // Add expert count to middle of polygon
    const polygonCenter = polygon.getBounds().getCenter();
    const numberMarker = L.divIcon({
      html: `<div style="background:rgb(19, 38, 158); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${expertCount}</div>`,
      className: 'polygon-number-icon',
      iconSize: [30, 30],
    });

    // Renders expert count on polyon
    const polygonMarker = L.marker(polygonCenter, { icon: numberMarker }).addTo(mapRef.current);

    // [MAY DELETE/REDUCE LATER] Allows hovering over polygonMarker to display popup card 
    polygonMarker.on("mouseover", () => {
      if (!showWorks) return;
      if (closeTimeout) clearTimeout(closeTimeout);

      const expertsAtLocation = geoData.features.filter(f => f.properties?.location_id === locationId);
      const totalWorks = expertsAtLocation.reduce((sum, expert) => sum + (parseInt(expert.properties?.work_count) || 0), 0);

      const content = expertsAtLocation.length === 1
        ? createSingleResearcherContent(expertsAtLocation[0].properties)
        : createMultiResearcherContent(expertsAtLocation.length, feature.properties.location_name, totalWorks);

      if (activePopup) activePopup.close();
      activePopup = L.popup({ closeButton: false, autoClose: false, maxWidth: 300, className: 'hoverable-popup', autoPan: false, keepInView: false, interactive: true })
        .setLatLng(polygon.getBounds().getCenter())
        .setContent(content)
        .openOn(map);

      const popupElement = activePopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = 'auto';
        popupElement.addEventListener("mouseenter", () => { if (closeTimeout) clearTimeout(closeTimeout); });
        popupElement.addEventListener("mouseleave", () => {
          closeTimeout = setTimeout(() => {
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          }, 300);
        });

        const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
        if (viewExpertsBtn) {
          viewExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedExperts(expertsAtLocation);
            setPanelType("polygon");
            setPanelOpen(true);
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          });
        }
      }
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

    console.log("Polygons drawn on map:", polygonLayers.length);

     // Add markers for point geometries.
    locationMap.forEach((experts, key) => {
      if (!experts.length || (showGrants && showWorks && combinedKeys?.has(key))) return;
      const [lat, lng] = key.split(",").map(Number);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${experts.length}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30],
        }),
        experts,
        expertCount: experts.length,
      });

      marker.on("mouseover", () => {
        const content = experts.length === 1
          ? createSingleResearcherContent(experts[0])
          : createMultiResearcherContent(experts.length, experts[0]?.location_name, experts.reduce((s, e) => s + (parseInt(e.work_count) || 0), 0));

        activePopup = L.popup({ closeButton: false, autoClose: false, maxWidth: 250 })
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

    // Add the marker cluster group to the map.
    map.addLayer(markerClusterGroup);

    // Cleanup function to remove layers when the component unmounts or dependencies change.
    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach((p) => map.removeLayer(p));
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;