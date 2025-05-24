/**
 * @file CombinedLayer.js
 * @description This component renders combined polygons and points on a Leaflet map where there is an overlap
 *              between works and grants for specific locations. It handles interactive popups, zoom filtering,
 *              and updates the state for selected experts, grants, and the side panel.
 *
 * Features:
 * - Renders overlapping polygons and points for works and grants.
 * - Displays interactive popups with expert and grant information.
 * - Updates the side panel with detailed data for selected locations.
 * - Handles cleanup of map layers and markers on component unmount.
 *
 * Functions:
 * - renderPolygons: Renders overlapping polygons for works and grants, including interactive popups.
 * - renderPoints: Renders overlapping points for works and grants, including interactive popups.
 * - CombinedLayer: Main component that integrates the rendering logic and manages map layers.
 *
 * Marina Mata, 2025
 */

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { createCombinedPopup, createMatchedCombinedPolygonPopup } from "./Popups";
import { prepareWorkPanelData, prepareGrantPanelData } from "./utils/preparePanelData";


/**
 * Renders overlapping polygons for works and grants on the map.
 * Each polygon represents a location with overlapping works and grants.
 * Interactive popups display expert and grant information.
 **/
const renderPolygons = ({
  locationMap,
  worksMap,
  grantsMap,
  expertsMap,
  map,
  setSelectedGrants,
  setSelectedWorks,
  setLocationName,
  setPanelOpen,
  setPanelType,
  comboLayers,
  comboPolyMarkers
}) => {
  const matchedFieldsSet = new Set();
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

    setLocationName(locationData.name);
    // Initialize sets to count unique experts
    const workExpertIDs = new Set();
    const grantExpertIDs = new Set();

    // Count experts from workIDs
    locationData.workIDs.forEach((workID) => {
      const work = worksMap.get(workID);
      if (!work) {
        console.warn(`Work with ID ${workID} not found in worksMap.`);
        return;
      }

      (work.relatedExpertIDs || []).forEach((expertID) => {
        if (expertsMap.has(expertID)) {
          workExpertIDs.add(expertID);
        }
      });
    });

    // Count experts from grantIDs
    locationData.grantIDs.forEach((grantID) => {
      const grant = grantsMap.get(grantID);
      if (!grant) {
        console.warn(`Grant with ID ${grantID} not found in grantsMap.`);
        return;
      }

      (grant.relatedExpertIDs || []).forEach((expertID) => {
        if (expertsMap.has(expertID)) {
          grantExpertIDs.add(expertID);
        }
      });
    });

    const work2expertCount = workExpertIDs.size;
    const grant2expertCount = grantExpertIDs.size;

    // Skip rendering if no experts are found
    if (work2expertCount === 0 && grant2expertCount === 0) {
      console.warn(`No experts found for locationID: ${locationID}`);
      return;
    }

    //make a set to remove duplicate expertIDs from the total count
    const combinedExpertIDs = new Set([
      ...workExpertIDs,
      ...grantExpertIDs,
    ]);
    const totalExpertCount = combinedExpertIDs.size;


    // Create a polygon for the location
    const polygon = L.polygon(flippedCoordinates, {
      color: "#659c39",
      fillColor: "#96ca6e",
      fillOpacity: 0.5,
      weight: 2,
    }).addTo(map);

    comboLayers.push(polygon);

    // Calculate the center of the polygon
    const polygonCenter = polygon.getBounds().getCenter();

    // Create a marker at the center of the polygon
    const marker = L.marker(polygonCenter, {
      icon: L.divIcon({
        html: `<div style='
          background: #659c39;
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        '>${totalExpertCount}</div>`,
        className: "polygon-center-marker",
        iconSize: [30, 30],
      }),
    }).addTo(map);

    // Track the marker for cleanup
    comboPolyMarkers.push(marker);

    // Handle interactive popups for the marker
    let activePopup = null;
    let closeTimeout = null;

    marker.on("mouseover", () => {
      if (closeTimeout) clearTimeout(closeTimeout);

      // Collect matched fields from works and grants
      locationData.workIDs.forEach((workID) => {
        const work = worksMap.get(workID);
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap.get(grantID);
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      const matchedFields = Array.from(matchedFieldsSet);

      // Create popup content
      const content =
        matchedFields.length > 0
          ? createMatchedCombinedPolygonPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          )
          : createCombinedPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          );

      if (activePopup) activePopup.remove();

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

        // Add event listener for the button in the popup
        const viewPointComboExpertsBtn = popupElement.querySelector(".view-combined-btn");
        if (viewPointComboExpertsBtn) {
          viewPointComboExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const grantPanelData = prepareGrantPanelData(
              Array.from(grantExpertIDs),
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.name
            );
            const workPanelData = prepareWorkPanelData(
              Array.from(workExpertIDs),
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID,
              locationData.name
            );
            setSelectedGrants(grantPanelData);
            setSelectedWorks(workPanelData);
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

    // Handle mouseout event
    marker.on("mouseout", () => {
      closeTimeout = setTimeout(() => {
        if (activePopup) {
          activePopup.close();
          activePopup = null;
        }
      }, 100);
    });

    // Handle click event for mobile/tablet view
    marker.on("click", () => {
      if (activePopup) activePopup.remove();

      // Collect matched fields from works and grants
      locationData.workIDs.forEach((workID) => {
        const work = worksMap.get(workID);
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap.get(grantID);
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      const matchedFields = Array.from(matchedFieldsSet);

      // Create popup content
      const content =
        matchedFields.length > 0
          ? createMatchedCombinedPolygonPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          )
          : createCombinedPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          );

      activePopup = L.popup({
        closeButton: true,
        autoClose: true,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: true,
      })
        .setLatLng(polygon.getBounds().getCenter())
        .setContent(content)
        .openOn(map);

      const popupElement = activePopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        // Add event listener for the button in the popup
        const viewPointComboExpertsBtn = popupElement.querySelector(".view-combined-btn");
        if (viewPointComboExpertsBtn) {
          viewPointComboExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const grantPanelData = prepareGrantPanelData(
              Array.from(grantExpertIDs),
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.name
            );
            const workPanelData = prepareWorkPanelData(
              Array.from(workExpertIDs),
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID,
              locationData.name
            );
            setSelectedGrants(grantPanelData);
            setSelectedWorks(workPanelData);
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
  });
};

/**
 * Renders overlapping points for works and grants on the map.
 * Each point represents a location with overlapping works and grants.
 * Interactive popups display expert and grant information.
 **/
const renderPoints = ({
  locationMap,
  worksMap,
  grantsMap,
  expertsMap,
  map,
  comboMarkerGroup,
  setSelectedGrants,
  setSelectedWorks,
  setLocationName,
  setPanelOpen,
  setPanelType,
}) => {
  const matchedFieldsSet = new Set();
  // Iterate through each location in the location map
  locationMap.forEach((locationData, locationID) => {
    // Skip locations that are not points or have no works or grants
    if (
      locationData.geometryType !== "Point" ||
      !Array.isArray(locationData.grantIDs) || locationData.grantIDs.length === 0 ||
      !Array.isArray(locationData.worksIDs) || locationData.worksIDs.length === 0
    ) return;

    // Flip coordinates for Leaflet compatibility
    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    setLocationName(locationData.name);

    // Get expert count for each work and grant per location
    // Count experts from workIDs
    workIDs.forEach((workID) => {
      const work = worksMap.get(workID);
      if (!work) {
        console.warn(`Work with ID ${workID} not found in worksMap.`);
        return;
      }

      (work.relatedExpertIDs || []).forEach((expertID) => {
        if (expertsMap.has(expertID)) {
          workExpertIDs.add(expertID);
        }
      });
    });
    // Count experts from grantIDs
    grantIDs.forEach((grantID) => {
      const grant = grantsMap.get(grantID);
      if (!grant) {
        console.warn(`Grant with ID ${grantID} not found in grantsMap.`);
        return;
      }

      (grant.relatedExpertIDs || []).forEach((expertID) => {
        if (expertsMap.has(expertID)) {
          grantExpertIDs.add(expertID);
        }
      });
    });

    const work2expertCount = workExpertIDs.size;
    const grant2expertCount = grantExpertIDs.size;

    //make a set to remove duplicate expertIDs from the total count
    const combinedExpertIDs = new Set([
      ...workExpertIDs,
      ...grantExpertIDs,
    ]);
    const totalExpertCount = combinedExpertIDs.size;


    // Create a marker for the location
    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #659c39; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${totalExpertCount}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
    });

    let activePointPopup = null;
    let closePointTimeout = null;

    // Handle mouseover event for the marker
    marker.on("mouseover", () => {
      if (closePointTimeout) clearTimeout(closePointTimeout);


      // Collect matched fields from works
      locationData.workIDs.forEach((workID) => {
        const work = worksMap.get(workID);
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      // Collect matched fields from grants
      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap.get(grantID);
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      const matchedFields = Array.from(matchedFieldsSet);

      // Create popup content
      const content =
        matchedFields.length > 0
          ? createMatchedCombinedPolygonPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          )
          : createCombinedPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          );


      // Remove existing popup if present
      if (activePointPopup) activePointPopup.remove();

      // Create a new popup
      activePointPopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);
      const popupElement = activePointPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        popupElement.addEventListener("mouseenter", () => {
          clearTimeout(closePointTimeout);
        });

        popupElement.addEventListener("mouseleave", () => {
          closePointTimeout = setTimeout(() => {
            if (activePointPopup) {
              activePointPopup.close();
              activePointPopup = null;
            }
          }, 100);
        });

        const viewCombinedExpertsBtn = popupElement.querySelector(".view-combined-btn");
        if (viewCombinedExpertsBtn) {
          viewCombinedExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const grantPanelData = prepareGrantPanelData(
              locationData.grantExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.name
            );
            const workPanelData = prepareWorkPanelData(
              locationData.workExpertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID,
              locationData.name
            );
            setSelectedGrants(grantPanelData);
            setSelectedWorks(workPanelData);
            setPanelType("combined");
            setPanelOpen(true);

            if (activePointPopup) {
              activePointPopup.close();
              activePointPopup = null;
            }
          });
        }
      }
    });

    // Handle mouseout event for the marker
    marker.on("mouseout", () => {
      closePointTimeout = setTimeout(() => {
        if (activePointPopup) {
          activePointPopup.close();
          activePointPopup = null;
        }
      }, 100);
    });

    // Handle click event for tablet/mobile view
    marker.on("click", () => {
      if (activePointPopup) activePointPopup.remove();

      // Collect matched fields from works
      locationData.workIDs.forEach((workID) => {
        const work = worksMap.get(workID);
        if (work?.matchedFields) {
          work.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      // Collect matched fields from grants
      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap.get(grantID);
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });

      const matchedFields = Array.from(matchedFieldsSet);

      // Create popup content
      const content =
        matchedFields.length > 0
          ? createMatchedCombinedPolygonPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          )
          : createCombinedPopup(
            work2expertCount,
            grant2expertCount,
            locationData.name,
            matchedFields
          );

      // Create a new popup
      activePointPopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);
      const popupElement = activePointPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        const viewCombinedExpertsBtn = popupElement.querySelector(".view-combined-btn");
        if (viewCombinedExpertsBtn) {
          viewCombinedExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const grantPanelData = prepareGrantPanelData(
              locationData.grantExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.name
            );
            const workPanelData = prepareWorkPanelData(
              locationData.workExpertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID,
              locationData.name
            );
            setSelectedGrants(grantPanelData);
            setSelectedWorks(workPanelData);
            setPanelType("combined");
            setPanelOpen(true);

            if (activePointPopup) {
              activePointPopup.close();
              activePointPopup = null;
            }
          });
        }
      }
    });

    // Add the marker to the marker group
    comboMarkerGroup.addLayer(marker);
  });
  map.addLayer(comboMarkerGroup);
};

/**
 * The `CombinedLayer` component renders overlapping polygons and points for works and grants on a Leaflet map.
 * It integrates the rendering logic for polygons and points and manages map layers and markers.
 **/
const CombinedLayer = ({
  locationMap,
  grantsMap,
  worksMap,
  expertsMap,
  showWorks,
  showGrants,
  setSelectedWorks,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  setLocationName,

}) => {
  const map = useMap();

  useEffect(() => {
    // Exit early if map or overlappingLocations is not available
    if (!map || !locationMap || !expertsMap || !worksMap || !grantsMap) return;

    const comboMarkerGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const totalExperts = cluster
          .getAllChildMarkers()
          .reduce((sum, marker) => sum + marker.options.expertCount, 0);

        return L.divIcon({
          html: `<div style="background: #659c39; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40),
        });
      },
    });

    const comboLayers = [];
    const comboPolyMarkers = [];

    if (showWorks && showGrants) {
      // Render overlapping locations
      renderPolygons({
        locationMap,
        worksMap,
        grantsMap,
        expertsMap,
        map,
        setSelectedGrants,
        setSelectedWorks,
        setLocationName,
        setPanelOpen,
        setPanelType,
        comboLayers,
        comboPolyMarkers,
      });

      renderPoints({
        locationMap,
        worksMap,
        grantsMap,
        expertsMap,
        map,
        comboMarkerGroup,
        setSelectedGrants,
        setSelectedWorks,
        setLocationName,
        setPanelOpen,
        setPanelType,
      });
    }

    // Cleanup function to remove layers and markers
    return () => {
      map.removeLayer(comboMarkerGroup);
      comboLayers.forEach((layer) => map.removeLayer(layer));
      comboPolyMarkers.forEach((marker) => map.removeLayer(marker));
      // map.off("zoomend", handleZoomEnd);
    };
  }, [
    map,
    locationMap,
    grantsMap,
    worksMap,
    expertsMap,
    showWorks,
    showGrants,
    setSelectedWorks,
    setSelectedGrants,
    setPanelOpen,
    setPanelType,
    setLocationName,
  ]);
  return null;
};

export default CombinedLayer;