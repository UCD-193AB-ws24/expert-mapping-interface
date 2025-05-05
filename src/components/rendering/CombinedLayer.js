/**
 * CombinedLayer Component
 * 
 * This component is a React Leaflet layer that processes and displays combined locations
 * (works and grants) on a map. It handles filtering, rendering markers, and creating popups
 * for locations where works and grants overlap.
 * 
 * @file CombinedLayer.js
 * @module CombinedLayer
 */

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/* This component renders markers for combined locations (works and grants) on a Leaflet map.
 * It processes geoJSON data for works and grants, identifies overlapping locations, and displays
 * a combined marker with a popup for each overlapping location. The popup provides details about
 * the number of works and grants at the location and allows users to open a panel with more details.
 */

const CombinedLayer = ({
  overlappingLocations,
  showWorks,
  showGrants,
  searchKeyword,
  setSelectedWorks,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  setCombinedKeys 
}) => {
  const map = useMap();

  useEffect(() => {
    // Exit early if required data or map is not available
    if (!map || !geoData || !grantGeoJSON) return;
    if (!showWorks && !showGrants) return;

    const worksLocationMap = new Map();
    const grantsLocationMap = new Map();

    // Process works data 
    if (showWorks) {
      // Filter works based on the search keyword
      const filteredFeatures = geoData.features.filter((f) => {
        const isExpert = !f.properties?.type || f.properties?.type === "work"; // Ensure it's a work type
        if (!isExpert) return false;
        const props = JSON.stringify(f.properties || {}).toLowerCase();  // Convert properties to lowercase for comparison
        return keyword === "" || props.includes(keyword); // Match keyword
      });

      // Iterate over filtered works and map them to their locations
      filteredFeatures.forEach((feature) => {
        if (!feature.properties || !feature.geometry) return;
        const geometry = feature.geometry;
        const entries = feature.properties.entries || [];

        if (geometry.type === "Point" || geometry.type === "MultiPoint") {
          const coordsList = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates;

          coordsList.forEach(([lng, lat]) => {
            const key = `${lat},${lng}`; // Create a unique key for the location
            if (!worksLocationMap.has(key)) worksLocationMap.set(key, []); // Initialize location if not present

            // Add each entry to the location
            entries.forEach((entry) => {
              const entryStr = JSON.stringify(entry).toLowerCase();
              if (keyword && !entryStr.includes(keyword)) return;

              const researcher = entry.relatedExperts?.[0] || {};  // Get the first related expert

              worksLocationMap.get(key).push({
                researcher_name: researcher.name || "Unknown",
                researcher_url: researcher.url ? `https://experts.ucdavis.edu/${researcher.url}` : null,
                location_name: feature.properties.location || "Unknown",
                work_titles: [entry.title],
                work_count: 1,
                confidence: entry.confidence || "Unknown",
                type: "expert"
              });
            });
          });
        }
      });
    }

    // Process grants data
    if (showGrants && grantGeoJSON) {
      grantGeoJSON.features.forEach((feature) => {
        if (!feature.geometry || feature.geometry.type !== "Point") return; // Skip invalid features
        const coords = feature.geometry.coordinates;
        if (!Array.isArray(coords) || coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) return;

        const [lng, lat] = coords;
        const key = `${lat},${lng}`; // Create a unique key for the location
        if (!grantsLocationMap.has(key)) grantsLocationMap.set(key, []);

        const entries = feature.properties.entries || [];  // Get entries for the feature

        // Add each entry to the location
        entries.forEach((entry) => {
          const entryStr = JSON.stringify(entry).toLowerCase();
          if (keyword && !entryStr.includes(keyword)) return;

          entry.location_name = feature.properties.location;
          entry.researcher_name = entry.relatedExpert?.name || "Unknown";
          entry.researcher_url = entry.relatedExpert?.url
            ? `https://experts.ucdavis.edu/${entry.relatedExpert.url}`
            : null;
          entry.type = "grant";

          grantsLocationMap.get(key).push(entry);
        });
      });
    }

    // Combine Works and Grants
    const combinedLocations = new Map();

     // Find overlapping locations and combine works and grants
    worksLocationMap.forEach((works, locationKey) => {
      if (grantsLocationMap.has(locationKey) && grantsLocationMap.get(locationKey).length > 0) {
        combinedLocations.set(locationKey, {
          works: works,
          grants: grantsLocationMap.get(locationKey)
        });
        grantsLocationMap.delete(locationKey); // Remove from grants map to avoid duplication
      }
    });

    // Send combined keys to parent component
    if (setCombinedKeys) {
      setCombinedKeys(new Set(combinedLocations.keys()));
    }

    // Render combined markers
    combinedLocations.forEach((data, key) => {
      const [lat, lng] = key.split(",").map(Number); // Parse latitude and longitude
      const worksCount = data.works.length;
      const grantsCount = data.grants.length;
      const totalCount = worksCount + grantsCount;
      const locationName = data.works[0]?.location_name || data.grants[0]?.location_name || "Unknown";

      // Create a marker for the combined location
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='
            background-color: #6CCA98;
            color: white;
            font-weight: bold;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 4px rgba(0,0,0,0.2);
            transition: transform 0.2s ease-in-out;
          '>${totalCount}</div>`,
          className: "",
          iconSize: [40, 40]
        }),
        works: data.works,
        grants: data.grants,
        locationData: {
          worksCount,
          grantsCount,
          locationName
        }
      });

      // Create popup content for the marker
      const createCombinedPopupContent = (worksCount, grantsCount, locationName) => `
        <div style='padding: 15px; font-size: 14px; width: 250px;'>
          <div style='font-weight: bold; font-size: 16px; color: #6CCA98;'>Combined Location</div>
          <div style='margin-top: 8px; color: #333;'><strong>Location:</strong> ${locationName}</div>
          <div style='margin-top: 5px;'>
            <div style='color: #13639e; display: inline-block; margin-right: 10px;'>
              <strong>${worksCount}</strong> Works
            </div>
            <div style='color: #f59e0b; display: inline-block;'>
              <strong>${grantsCount}</strong> Grants
            </div>
          </div>
          <a href='#'
            class='view-combined-btn'
            style='display: block; margin-top: 12px; padding: 8px 10px; background: #6CCA98; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
            Open Panel
          </a>
        </div>
      `;

      const popup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 250,
        className: 'hoverable-popup',
        autoPan: false,
        keepInView: false,
        interactive: true
      });

      // Add event listeners for the marker
      marker.on("mouseover", () => {
        if (closeTimeout) clearTimeout(closeTimeout);
        popup.setLatLng(marker.getLatLng())
          .setContent(createCombinedPopupContent(worksCount, grantsCount, locationName))
          .openOn(map);
        activePopup = popup;

        const popupElement = popup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';
          popupElement.addEventListener("mouseenter", () => clearTimeout(closeTimeout));
          popupElement.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 500);
          });

          const viewBtn = popupElement.querySelector(".view-combined-btn");
          if (viewBtn) {
            viewBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedWorks(data.works);
              setSelectedGrants(data.grants);
              setPanelType("combined");
              setPanelOpen(true);
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

      marker.addTo(map); // Add marker to the map
      markers.push(marker);  // Store marker for cleanup
    });

    return () => {
      markers.forEach((marker) => map.removeLayer(marker));
    };
  }, [map, geoData, grantGeoJSON, showWorks, showGrants, searchKeyword, setSelectedWorks, setSelectedGrants, setPanelOpen, setPanelType, setCombinedKeys]);

  return null;
};

export default CombinedLayer;

