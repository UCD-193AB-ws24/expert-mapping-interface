/**
 * @file GrantLayer.js
 * @description This component renders grant-related polygons and points on a Leaflet map.
 *              It handles interactive popups, zoom filtering, and updates the state for
 *              selected grants and the side panel.
 *
 * FUNCTIONS:
 * - prepareGrantPanelData: Prepares data for the side panel based on grants and experts.
 * - renderPolygons: Renders grant-related polygons on the map.
 * - renderPoints: Renders grant-related points on the map.
 *
 * PROPS:
 * - nonOverlappingGrants: Array of grant locations that do not overlap with works.
 * - showWorks: Boolean indicating whether to display works.
 * - showGrants: Boolean indicating whether to display grants.
 * - setSelectedGrants: Function to update the selected grants for the side panel.
 * - setPanelOpen: Function to control whether the side panel is open.
 * - setPanelType: Function to set the type of content displayed in the side panel.
 * - combinedKeys: Set of overlapping location keys.
 * - searchKeyword: Keyword used for filtering grants.
 *
 * Marina Mata, 2025
 */

import { useEffect, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { createMultiGrantPopup, createMatchedGrantPopup } from "./Popups";
// import { filterFeaturesByZoom } from "./filters/zoomFilter";
// import { getMatchedFields } from "./filters/searchFilter";
import { prepareGrantPanelData } from "./utils/preparePanelData";

// const prepareGrantPanelData = (expertIDs, grantIDs, grantsMap, expertsMap, locationID) => {
//   return expertIDs.map((expertID) => {
//     const expert = expertsMap.get(expertID);
//     if (!expert) {
//       console.warn(`Expert with ID ${expertID} not found in expertsMap.`);
//       return null;
//     }

//     // Ensure the URL is a full URL
//     const fullUrl = expert.url.startsWith("http")
//       ? expert.url
//       : `https://experts.ucdavis.edu/${expert.url}`;

//     // Find grants associated with this expert and the current location
//     const associatedGrants = grantIDs
//       .map((grantID) => {
//         const grant = grantsMap.get(grantID);
//         if (!grant) {
//           console.warn(`Grant with ID ${grantID} not found in grantsMap.`);
//           return null;
//         }
//         return grant;
//       })

//       // Filter grants based on the expert ID and location ID
//       .filter((grant) => {
//         if (!grant) return false;
//         if (!grant.relatedExpertIDs) {
//           console.warn(`Grant with ID ${grant.grantID} has no relatedExpertIDs.`);
//           return false;
//         }
//         if (!grant.relatedExpertIDs.includes(expertID)) {
//           console.warn(
//             `Grant with ID ${grant.grantID} has relatedExpertID ${grant.relatedExpertIDs}, which does not match expertID ${expertID}.`
//           );
//           return false;
//         }
//         if (!grant.locationID.includes(locationID)) {
//           console.warn(
//             `Grant with ID ${grant.grantID} has locationID ${grant.locationID}, which does not match locationID ${locationID}.`
//           );
//           return false;
//         }
//         return true;
//       });

//     return {
//       name: expert.name || "Unknown",
//       url: fullUrl, // Use the full URL
//       grants: associatedGrants.map((grant) => ({
//         title: grant.title || "Untitled Grant",
//         funder: grant.funder || "Unknown",
//         startDate: grant.startDate || "Unknown",
//         endDate: grant.endDate || "Unknown",
//         confidence: grant.confidence || "Unknown",
//         matchedFields: grant.matchedFields || [],
//       })),
//     };
//   }).filter((expert) => expert); // Filter out null experts
// };


const renderPolygons = ({
  locationMap,
  map,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  polygonLayers,
  polygonMarkers,
  grantsMap,
  expertsMap,
}) => {
  // Sort polygons by area (largest to smallest)
  const sortedPolygons = Array.from(locationMap.entries())
    .filter(([, value]) => value.geometryType === "Polygon" && value.grantIDs.length > 0)
    .sort(([, a], [, b]) => {
      const area = (geometry) => {
        const bounds = L.polygon(
          geometry.coordinates[0].map(([lng, lat]) => [lat, lng])
        ).getBounds();
        return (
          (bounds.getEast() - bounds.getWest()) *
          (bounds.getNorth() - bounds.getSouth())
        );
      };
      return area(b) - area(a); // Sort largest to smallest
    });

  sortedPolygons.forEach(([locationID, locationData]) => {
    // Flip coordinates for Leaflet compatibility
    const flippedCoordinates = locationData.coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng])
    );

    // Create a polygon for the location
    const polygon = L.polygon(flippedCoordinates, {
      color: "#eda012",
      fillColor: "#efa927",
      fillOpacity: 0.5,
      weight: 2,
    }).addTo(map);

    polygonLayers.push(polygon);

    // Calculate the center of the polygon
    const polygonCenter = polygon.getBounds().getCenter();

    // Create a marker at the center of the polygon
    const marker = L.marker(polygonCenter, {
      icon: L.divIcon({
        html: `<div style='
              background: #eda012;
              color: white;
              border-radius: 50%;
              width: 30px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
            '>${locationData.expertIDs.length}</div>`,
        className: "polygon-center-marker",
        iconSize: [30, 30],
      }),
    }).addTo(map);

    polygonMarkers.push(marker);

    let activePopup = null;
    let closeTimeout = null;

    // Handle mouseover event for the marker
    marker.on("mouseover", () => {
      if (closeTimeout) clearTimeout(closeTimeout);
      const matchedFieldsSet = new Set();
      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap.get(grantID);
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiGrantPopup(
        locationData.expertIDs.length,
        locationData.grantIDs.length,
        locationData.name,
        matchedFields
      );


      // Remove existing popup if it exists
      if (activePopup) activePopup.remove();

      // Create a new popup
      activePopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(polygon.getBounds().getCenter())
        .setContent(content)
        .openOn(map);

      const popupElement = activePopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        popupElement.addEventListener("mouseenter", () => {
          clearTimeout(closeTimeout);
        });

        popupElement.addEventListener("mouseleave", () => {
          closeTimeout = setTimeout(() => {
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          }, 100);
        });

        // Add event listener for the button inside the popup
        const viewExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
        if (viewExpertsBtn) {
          viewExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareGrantPanelData(
              locationData.expertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID
            );
            setSelectedGrants(panelData);
            setPanelType("grants");
            setPanelOpen(true);

            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          });
        }
      }
    });

    // Handle mouseout event for the marker
    marker.on("mouseout", () => {
      closeTimeout = setTimeout(() => {
        if (activePopup) {
          activePopup.close();
          activePopup = null;
        }
      }, 100);
    });
  });
};

const renderPoints = ({
  locationMap,
  map,
  grantMarkerGroup,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  grantsMap,
  expertsMap,
}) => {
  locationMap.forEach((locationData, locationID) => {
    if (locationData.geometryType !== "Point" || locationData.grantIDs.length === 0) return;

    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    // Create a marker for the location
    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #eda012; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${locationData.grantIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
    });

    let grantPointPopup = null;
    let grantPointCT = null; // CT = closetimeout

    // Handle mouseover event for the marker
    marker.on("mouseover", () => {
      if (grantPointCT) clearTimeout(grantPointCT);
      const matchedFieldsSet = new Set();
      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap.get(grantID);
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiGrantPopup(
        locationData.expertIDs.length,
        locationData.grantIDs.length,
        locationData.name,
        matchedFields
      );

      // Remove existing popup if it exists
      if (grantPointPopup) grantPointPopup.remove();

      // Create a new popup
      grantPointPopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);
      const popupElement = grantPointPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        popupElement.addEventListener("mouseenter", () => {
          clearTimeout(grantPointCT);
        });

        popupElement.addEventListener("mouseleave", () => {
          grantPointCT = setTimeout(() => {
            if (grantPointPopup) {
              grantPointPopup.close();
              grantPointPopup = null;
            }
          }, 100);
        });

        // Add event listener for the button inside the popup
        const viewWPointExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
        if (viewWPointExpertsBtn) {
          viewWPointExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareGrantPanelData(
              locationData.grantIDs,
              locationData.expertIDs,
              grantsMap,
              expertsMap,
              locationID
            );
            setSelectedGrants(panelData);
            setPanelType("grants");
            setPanelOpen(true);

            if (grantPointPopup) {
              grantPointPopup.close();
              grantPointPopup = null;
            }
          });
        }
      }
    });

    // Handle mouseout event for the marker
    marker.on("mouseout", () => {
      grantPointCT = setTimeout(() => {
        if (grantPointPopup) {
          grantPointPopup.close();
          grantPointPopup = null;
        }
      }, 100);
    });

    grantMarkerGroup.addLayer(marker);
  });
  map.addLayer(grantMarkerGroup);
};


// Main component for rendering grant-related polygons and points on the map.
const GrantLayer = ({
  locationMap,
  grantsMap,
  expertsMap,
  showWorks,
  showGrants,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
}) => {
  const map = useMap();
  // Handle zoom filtering
  // const handleZoomEnd = () => {
  //   if (!map || !nonOverlappingGrants) return;

  //   const zoomLevel = map.getZoom();

  //   const zoomFilteredGrants = filterFeaturesByZoom(nonOverlappingGrants, zoomLevel, "grantsFeatures");

  //   setFilteredGrants(zoomFilteredGrants); // Update the filtered grants state
  // };

  useEffect(() => {
    if (!map || !locationMap || !grantsMap || !expertsMap || !showGrants) {
      console.error("Error: No grants found!");
      return;
    }

    const grantMarkerGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const totalExperts = cluster
          .getAllChildMarkers()
          .reduce((sum, marker) => sum + marker.options.expertCount, 0);

        return L.divIcon({
          html: `<div style="background: #eda012; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40),
        });
      },
    });

    const polygonLayers = [];
    const polygonMarkers = [];
  
    // Render polygons
    renderPolygons({
      locationMap,
      map,
      setSelectedGrants,
      setPanelOpen,
      setPanelType,
      polygonLayers,
      polygonMarkers,
      grantsMap,
      expertsMap,
    });

    // Render points
    renderPoints({
      locationMap,
      map,
      grantMarkerGroup,
      setSelectedGrants,
      setPanelOpen,
      setPanelType,
      grantsMap,
      expertsMap,
    });

    // Cleanup function
    return () => {
      map.removeLayer(grantMarkerGroup);
      polygonLayers.forEach((p) => map.removeLayer(p));
      polygonMarkers.forEach((m) => map.removeLayer(m));
      // map.off("zoomend", handleZoomEnd);
    };
  }, [map, locationMap, grantsMap, expertsMap, showGrants, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;








