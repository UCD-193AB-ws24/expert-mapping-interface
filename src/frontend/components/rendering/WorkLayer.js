/**
 * @file WorkLayer.js
 * @description This file contains the implementation of the `WorkLayer` component, which is responsible for rendering
 *              works-related data on a Leaflet map. It includes logic for rendering polygons and points, clustering markers,
 *              and handling interactions such as hover and click events. The component also filters works based on zoom level
 *              and search keywords.
 *
 * Features:
 * - Renders polygons and points for works-related data.
 * - Displays interactive popups with expert and work information.
 * - Updates the side panel with detailed data for selected works.
 * - Handles cleanup of map layers and markers on component unmount.
 *
 * Functions:
 * - renderPolygons: Renders polygons on the map for locations with works.
 * - renderPoints: Renders points on the map with clustering logic for locations with works.
 * - WorkLayer: Main component that integrates the rendering logic and manages map layers.
 *
 * Marina Mata, 2025
 */

import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import { createMultiExpertContent } from "./Popups";
import { prepareWorkPanelData } from "./utils/preparePanelData";
import { getMatchedFields } from "./filters/searchFilter";

/**
 * Renders polygons on the map for locations with works.
 * Each polygon represents a location with works-related data.
 * Interactive popups display expert and work information.
 */
const renderPolygons = ({
  searchKeyword,
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
  
  const sortedPolygons = Object.entries(locationMap)
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

    const filteredExpertIDs = locationData.expertIDs.filter(expertID =>
    locationData.workIDs.some(workID => {
      const work = worksMap[workID];
      return work && work.relatedExpertIDs && work.relatedExpertIDs.includes(expertID);
    })
  );
  
    // Calculate the center of the polygon
    const polygonCenter = polygon.getCenter();

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
        '>${filteredExpertIDs.length}</div>`,
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
      // Collect matched fields from works and grants
      locationData.workIDs.forEach((workID) => {
        const work = worksMap[workID];
        if (!work.matchedFields || work.matchedFields.length === 0) {
          // Compute matchedFields if missing or empty
          work.matchedFields = getMatchedFields(searchKeyword,work);
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      
      const matchedFields = Array.from(matchedFieldsSet);
      
      
      // Create content for the popup

      const content = createMultiExpertContent(
        filteredExpertIDs.length,
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
        .setLatLng(polygon.getCenter())
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
              filteredExpertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID, // Pass the current locationID
              locationData.name
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
    });

    marker.on("click", () => {
      // Remove any existing popup
      if (workPolyPopup) workPolyPopup.remove();

    const matchedFieldsSet = new Set();
      // Collect matched fields from works and grants
    locationData.workIDs.forEach((workID) => {
      const work = worksMap[workID];
      if (!work.matchedFields || work.matchedFields.length === 0) {
        // Compute matchedFields if missing or empty
        console.log("Computing matchedFields for work:", workID);
        work.matchedFields = getMatchedFields(searchKeyword,work);
        work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        console.log("Matched fields for work:", work.matchedFields);
      }
      if (work?.matchedFields) {
        work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
      }
    });
    
    const matchedFields = Array.from(matchedFieldsSet);

    const content = createMultiExpertContent(
      filteredExpertIDs.length,
      locationData.name,
      locationData.workIDs.length,
      matchedFields
    );

      workPolyPopup = L.popup({
        closeButton: true,      // Show close button for mobile/tablet
        autoClose: true,        // Close when clicking elsewhere
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: true,          // Pan to popup if needed
      })
        .setLatLng(polygon.getBounds().getCenter())
        .setContent(content)
        .openOn(map);

      const popupElement = workPolyPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

      // Only add the button click handler
      const viewWPolyExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
      if (viewWPolyExpertsBtn) {
        viewWPolyExpertsBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          
          const panelData = prepareWorkPanelData(
            filteredExpertIDs,
            locationData.workIDs,
            expertsMap,
            worksMap,
            locationID,
            locationData.display_name
          );
          setSelectedWorks(panelData);
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
  });
};

/**
 * Renders points on the map with clustering logic.
 * Each point represents a location with works-related data.
 * Interactive popups display expert and work information.
 */
const renderPoints = ({
  searchKeyword,
  locationMap,
  map,
  markerClusterGroup,
  setSelectedWorks,
  setPanelType,
  setPanelOpen,
  expertsMap,
  worksMap,
}) => {

  
  const locationEntries = Object.entries(locationMap);

  // Iterate through each location in the location map
  locationEntries.forEach(([locationID, locationData]) => {
    if (
      locationData.geometryType !== "Point" ||
      !Array.isArray(locationData.workIDs) || locationData.workIDs.length === 0 ||
      !Array.isArray(locationData.coordinates) || locationData.coordinates.length !== 2
    ) return;

    // Swap [lng, lat] to [lat, lng]
    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];
    
    // Filter expertIDs to only those with at least one work in this location
    const filteredExpertIDs = locationData.expertIDs.filter(expertID =>
      locationData.workIDs.some(workID => {
        const work = worksMap[workID];
        return work && work.relatedExpertIDs && work.relatedExpertIDs.includes(expertID);
      })
    );
    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #3879C7; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${filteredExpertIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
      expertCount: filteredExpertIDs.length, // Add expertCount to marker options
    });

    let workPointPopup = null;
    let workPointCT = null; // CT = closetimeout

    marker.on("mouseover", () => {
      if (workPointCT) clearTimeout(workPointCT);

      const matchedFieldsSet = new Set();
      // Collect matched fields from works and grants
      locationData.workIDs.forEach((workID) => {
        const work = worksMap[workID];
        if (!work.matchedFields || work.matchedFields.length === 0) {
          // Compute matchedFields if missing or empty
          console.log("Computing matchedFields for work:", workID);
          work.matchedFields = getMatchedFields(searchKeyword,work);
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
          console.log("Matched fields for work:", work.matchedFields);
        }
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiExpertContent(
        filteredExpertIDs.length,
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
              filteredExpertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID, // Pass the current locationID
              locationData.name
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

    marker.on("click", () => {

      if (workPointPopup) workPointPopup.remove();

      const matchedFieldsSet = new Set();
      // Collect matched fields from works and grants
      locationData.workIDs.forEach((workID) => {
        const work = worksMap[workID];
        if (!work.matchedFields || work.matchedFields.length === 0) {
          // Compute matchedFields if missing or empty
          console.log("Computing matchedFields for work:", workID);
          work.matchedFields = getMatchedFields(searchKeyword,work);
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
          console.log("Matched fields for work:", work.matchedFields);
        }
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiExpertContent(
        filteredExpertIDs.length,
        locationData.name,
        locationData.workIDs.length,
        matchedFields
      );

      workPointPopup = L.popup({
        closeButton: true,
        autoClose: true,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: true,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);

      const popupElement = workPointPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        const viewWPointExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
        if (viewWPointExpertsBtn) {
          viewWPointExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareWorkPanelData(
              filteredExpertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID, // Pass the current locationID
              locationData.name
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

    markerClusterGroup.addLayer(marker);
  });

  map.addLayer(markerClusterGroup);
};

/**
 * The `WorkLayer` component renders works-related polygons and points on a Leaflet map.
 * It integrates the rendering logic for polygons and points and manages map layers and markers.
 */
const WorkLayer = ({
  searchKeyword,
  locationMap,
  worksMap,
  expertsMap,
  showWorks,
  setSelectedWorks,
  setPanelOpen,
  setPanelType,
}) => {
  const map = useMap();

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
      searchKeyword,
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
      searchKeyword,
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
    };
  }, [
    map,
    searchKeyword,
    locationMap,
    worksMap,
    expertsMap,
    showWorks,
    setSelectedWorks,
    setPanelOpen,
    setPanelType,
  ]);

  return null;
};

export default WorkLayer;