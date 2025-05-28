/**
 * @file GrantLayer.js
 * @description This component renders grant-related polygons and points on a Leaflet map.
 *              It handles interactive popups, zoom filtering, and updates the state for
 *              selected grants and the side panel.
 *
 * Features:
 * - Renders grant-related polygons and points.
 * - Displays interactive popups with grant and expert information.
 * - Updates the side panel with detailed data for selected grants.
 * - Handles cleanup of map layers and markers on component unmount.
 *
 * Functions:
 * - renderPolygons: Renders grant-related polygons on the map.
 * - renderPoints: Renders grant-related points on the map.
 * - GrantLayer: Main component that integrates the rendering logic and manages map layers.
 *
 * Marina Mata, 2025
 */

import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { createMultiGrantPopup } from "./Popups";
import { prepareGrantPanelData } from "./utils/preparePanelData";

/**
 * Renders grant-related polygons on the map.
 * Each polygon represents a location with grant data.
 * Interactive popups display grant and expert information.
 */
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
  const sortedPolygons = Object.entries(locationMap)
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

    const filteredExpertIDs = locationData.expertIDs.filter(expertID =>
    locationData.grantIDs.some(grantID => {
      const grant = grantsMap[grantID];
      return grant && grant.relatedExpertIDs && grant.relatedExpertIDs.includes(expertID);
    })
  );

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
            '>${filteredExpertIDs.length}</div>`,
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
        const grant = grantsMap[grantID];
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiGrantPopup(
        filteredExpertIDs.length,
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
              filteredExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.display_name
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

    // Handle tablet/mobile view click
    marker.on("click", () => {
        // Remove any existing popup
      if (activePopup) activePopup.remove();
    
      const matchedFieldsSet = new Set();
      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap[grantID];
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiGrantPopup(
        filteredExpertIDs.length,
        locationData.grantIDs.length,
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

        // Add event listener for the button inside the popup
        const viewExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
        if (viewExpertsBtn) {
          viewExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareGrantPanelData(
              filteredExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.display_name
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

  });
};

/**
 * Renders grant-related points on the map.
 * Each point represents a location with grant data.
 * Interactive popups display grant and expert information.
 */
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

  
  const locationEntries = Object.entries(locationMap);

  // Iterate through each location in the location map
  locationEntries.forEach(([locationID, locationData]) => {
    if (
      locationData.geometryType !== "Point" ||
      !Array.isArray(locationData.grantIDs) || locationData.grantIDs.length === 0 ||
      !Array.isArray(locationData.coordinates) || locationData.coordinates.length !== 2
    ) return;

    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    const filteredExpertIDs = locationData.expertIDs.filter(expertID =>
    locationData.grantIDs.some(grantID => {
      const grant = grantsMap[grantID];
      return grant && grant.relatedExpertIDs && grant.relatedExpertIDs.includes(expertID);
    })
  );
    // Create a marker for the location
    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #eda012; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${filteredExpertIDs.length}</div>`,
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
        const grant = grantsMap[grantID];
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiGrantPopup(
        filteredExpertIDs.length,
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
              filteredExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.display_name
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

    // Handle click event for tablet/mobile view
    marker.on("click", () => {
      if (grantPointPopup) grantPointPopup.remove();

      const matchedFieldsSet = new Set();
      locationData.grantIDs.forEach((grantID) => {
        const grant = grantsMap[grantID];
        if (grant?.matchedFields) {
          grant.matchedFields.forEach((f) => matchedFieldsSet.add(f));
        }
      });
      const matchedFields = Array.from(matchedFieldsSet);

      const content = createMultiGrantPopup(
        filteredExpertIDs.length,
        locationData.grantIDs.length,
        locationData.name,
        matchedFields
      );

      // Create a new popup
      grantPointPopup = L.popup({
        closeButton: true,
        autoClose: true,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: true,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);

      const popupElement = grantPointPopup.getElement();
      if (popupElement) {
        popupElement.style.pointerEvents = "auto";

        // Add event listener for the button inside the popup
        const viewWPointExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
        if (viewWPointExpertsBtn) {
          viewWPointExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = prepareGrantPanelData(
              filteredExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID,
              locationData.display_name
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

    grantMarkerGroup.addLayer(marker);
  });
  map.addLayer(grantMarkerGroup);
};

/**
 * The `GrantLayer` component renders grant-related polygons and points on a Leaflet map.
 * It integrates the rendering logic for polygons and points and manages map layers and markers.
 */
const GrantLayer = ({
  locationMap,
  grantsMap,
  expertsMap,
  showGrants,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
}) => {
  const map = useMap();

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
    };
  }, [map, locationMap, grantsMap, expertsMap, showGrants, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;