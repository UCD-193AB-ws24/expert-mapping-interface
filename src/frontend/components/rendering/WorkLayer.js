/**
 * @file WorkLayer.js
 * @description This file contains the implementation of the `WorkLayer` component, which is responsible for rendering
 *              works-related data on a Leaflet map. It includes logic for rendering polygons and points, clustering markers,
 *              and handling interactions such as hover and click events. The component also filters works based on zoom level
 *              and search keywords.
 *
 * FUNCTIONS:
 * - preparePanelData: Prepares data for the side panel by collecting expert and work information.
 * - renderPolygons: Renders polygons on the map for locations with works.
 * - renderPoints: Renders points on the map with clustering logic for locations with works.
 *
 * COMPONENTS:
 * - WorkLayer: React component that integrates the above functions to render works data on the map.
 *
 * Marina Mata, 2025
 */

import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import { createMultiExpertContent } from "./Popups";
// import { filterFeaturesByZoom } from "./filters/zoomFilter";

import { prepareWorkPanelData } from "./utils/preparePanelData";
/**
 * Prepares data for the side panel by collecting expert and work information for a specific location.
 */
// const preparePanelData = (expertIDs, workIDs, expertsMap, worksMap, locationID) => {
//   return expertIDs.map((expertID) => {
//     const expert = expertsMap.get(expertID);
//     if (!expert) return null;

//     // Ensure the URL is a full URL
//     const fullUrl = expert.url.startsWith("http")
//       ? expert.url
//       : `https://experts.ucdavis.edu/${expert.url}`;

//     // Find works associated with this expert and the current location
//     const associatedWorks = workIDs
//       .map((workID) => worksMap.get(workID))
//       .filter(
//         (work) =>
//           work &&
//           work.relatedExpertIDs.includes(expertID) && // Work is associated with this expert
//           work.locationID === locationID // Work matches the current location
//       );

//     return {
//       name: expert.name || "Unknown",
//       url: fullUrl, // Use the full URL
//       works: associatedWorks.map((work) => ({
//         title: work.title || "Untitled Work",
//         issued: work.issued || "Unknown",
//         confidence: work.confidence || "Unknown",
//         matchedFields: work.matchedFields || [],
//       })),
//     };
//   }).filter((expert) => expert); // Filter out null experts
// };

/**
 * Renders polygons on the map.
 */
const renderPolygons = ({
  locationMap,
  map,
  setSelectedWorks,
  setPanelType,
  setPanelOpen,
  polygonLayers,
  polygonMarkers,
  expertsMap,
  worksMap,
}) => {
  const sortedPolygons = Array.from(locationMap.entries())
    .filter(([, value]) => value.geometryType === "Polygon" && value.expertIDs.length > 0) // Skip locations with 0 experts
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
    const flippedCoordinates = locationData.coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng])
    );

    const polygon = L.polygon(flippedCoordinates, {
      color: "#3879C7",
      fillColor: "#4783CB",
      fillOpacity: 0.6,
      weight: 2,
    }).addTo(map);

    polygonLayers.push(polygon);

    // Calculate the center of the polygon
    const polygonCenter = polygon.getBounds().getCenter();

    // Create a marker at the center of the polygon
    const marker = L.marker(polygonCenter, {
      icon: L.divIcon({
        html: `<div style='
          background: #3879C7;
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

    // Track the marker for cleanup
    polygonMarkers.push(marker);

    let workPolyPopup = null;
    let workPolyCT = null; // CT = closeTimeout

    marker.on("mouseover", () => {
      if (workPolyCT) clearTimeout(workPolyCT);

      const matchedFieldsSet = new Set();
      locationData.workIDs.forEach((workID) => {
        const work = worksMap.get(workID);
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiExpertContent(
        locationData.expertIDs.length,
        locationData.name,
        locationData.workIDs.length,
        matchedFields
      );

      if (workPolyPopup) workPolyPopup.remove();

      workPolyPopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(polygon.getBounds().getCenter())
        .setContent(content)
        .openOn(map);

      const popupElement = workPolyPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        popupElement.addEventListener("mouseenter", () => {
          clearTimeout(workPolyCT);
        });

        popupElement.addEventListener("mouseleave", () => {
          workPolyCT = setTimeout(() => {
            if (workPolyPopup) {
              workPolyPopup.close();
              workPolyPopup = null;
            }
          }, 100);
        });

        const viewWPolyExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
        if (viewWPolyExpertsBtn) {
          viewWPolyExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareWorkPanelData(
              locationData.expertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID // Pass the current locationID
            );
            setSelectedWorks(panelData); // Pass the prepared data to the panel
            setPanelType("works");
            setPanelOpen(true);

            if (workPolyPopup) {
              workPolyPopup.close();
              workPolyPopup = null;
            }
          });
        }
      }
    });

    marker.on("mouseout", () => {
      workPolyCT = setTimeout(() => {
        if (workPolyPopup) {
          workPolyPopup.close();
          workPolyPopup = null;
        }
      }, 100);
    });;
  });
};

/**
 * Renders points on the map with clustering logic.
 */
const renderPoints = ({
  locationMap,
  map,
  markerClusterGroup,
  setSelectedWorks,
  setPanelType,
  setPanelOpen,
  expertsMap,
  worksMap,
}) => {
  locationMap.forEach((locationData, locationID) => {
    if (locationData.geometryType !== "Point" || locationData.expertIDs.length === 0) return; // Skip locations with 0 experts

    // Swap [lng, lat] to [lat, lng]
    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #3879C7; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${locationData.expertIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
      expertCount: locationData.expertIDs.length, // Add expertCount to marker options
    });

    let workPointPopup = null;
    let workPointCT = null; // CT = closetimeout

    marker.on("mouseover", () => {
      if (workPointCT) clearTimeout(workPointCT);

      const matchedFieldsSet = new Set();
      locationData.workIDs.forEach((workID) => {
        const work = worksMap.get(workID);
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiExpertContent(
        locationData.expertIDs.length,
        locationData.name,
        locationData.workIDs.length,
        matchedFields
      );


      if (workPointPopup) workPointPopup.remove();
      workPointPopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);
      const popupElement = workPointPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        popupElement.addEventListener("mouseenter", () => {
          clearTimeout(workPointCT);
        });

        popupElement.addEventListener("mouseleave", () => {
          workPointCT = setTimeout(() => {
            if (workPointPopup) {
              workPointPopup.close();
              workPointPopup = null;
            }
          }, 200);
        });

        const viewWPointExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
        if (viewWPointExpertsBtn) {
          viewWPointExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareWorkPanelData(
              locationData.expertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID // Pass the current locationID
            );
            setSelectedWorks(panelData); // Pass the prepared data to the panel
            setPanelType("works");
            setPanelOpen(true);

            if (workPointPopup) {
              workPointPopup.close();
              workPointPopup = null;
            }
          });
        }
      }
    });

    marker.on("mouseout", () => {
      workPointCT = setTimeout(() => {
        if (workPointPopup) {
          workPointPopup.close();
          workPointPopup = null;
        }
      }, 200);
    });

    markerClusterGroup.addLayer(marker);
  });

  map.addLayer(markerClusterGroup);
};

/**
 * WorkLayer Component
 */
const WorkLayer = ({
  locationMap,
  worksMap,
  expertsMap,
  showWorks,
  setSelectedWorks,
  setPanelOpen,
  setPanelType,
}) => {
  const map = useMap();
  

  // Define handleZoomEnd outside the useEffect
  // const handleZoomEnd = () => {
  //   if (!map || !nonOverlappingWorks) return;

  //   const zoomLevel = map.getZoom();
  //   console.log("Zoom level in WorkLayer:", zoomLevel);

  //   const zoomFilteredWorks = filterFeaturesByZoom(nonOverlappingWorks, zoomLevel, "worksFeatures");
  //   console.log("Zoom Filtered Works:", zoomFilteredWorks);

  //   setFilteredWorks(zoomFilteredWorks); // Update the filtered works state
  // };

  // useEffect(() => {
  //   if (!map || !nonOverlappingWorks) {
  //     console.error("Error: No Works found!");
  //     return;
  //   }

  //   const handleZoomEnd = () => {
  //     const zoomLevel = map.getZoom();
  //     console.log("Zoom level in GrantLayer:", zoomLevel);

  //     const zoomFilteredWorks = filterFeaturesByZoom(nonOverlappingWorks, zoomLevel, "worksFeatures");
  //     console.log("Zoom Filtered Works:", zoomFilteredWorks);

  //     setFilteredWorks(zoomFilteredWorks); // Update the filtered works state
  //   };

  //   map.on("zoomend", handleZoomEnd);

  //   // Apply the filter initially
  //   handleZoomEnd();

  //   return () => {
  //     map.off("zoomend", handleZoomEnd);
  //   };
  // }, [map, nonOverlappingWorks]);

  useEffect(() => {
    if (!map || !locationMap || !worksMap || !expertsMap || !showWorks) {
      console.error('Error: No works found!');
      return;
    }
    const polygonLayers = [];
    const polygonMarkers = [];
    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 100,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const totalExperts = cluster
          .getAllChildMarkers()
          .reduce((sum, marker) => sum + marker.options.expertCount, 0);

        return L.divIcon({
          html: `<div style="background: #3879C7; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40),
        });
      },
    });
    // Render polygons
    renderPolygons({
      locationMap,
      map,
      setSelectedWorks,
      setPanelType,
      setPanelOpen,
      polygonLayers,
      polygonMarkers,
      expertsMap,
      worksMap,
    });

    // Render points
    renderPoints({
      locationMap,
      map,
      markerClusterGroup,
      setSelectedWorks,
      setPanelType,
      setPanelOpen,
      expertsMap,
      worksMap,
    });

    // Cleanup function
    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach((p) => map.removeLayer(p));
      polygonMarkers.forEach((m) => map.removeLayer(m));
      // map.off("zoomend", handleZoomEnd);
    };
  }, [
    map,
    locationMap,
    worksMap,
    expertsMap,
    showWorks,
    setSelectedWorks,
    setPanelOpen,
    setPanelType,]);
  return null;
};

export default WorkLayer;