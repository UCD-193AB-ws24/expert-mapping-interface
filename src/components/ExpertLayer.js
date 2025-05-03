import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";

import {
  createMultiExpertContent,
} from "./Popups";

/**
 * Renders polygons on the map.
 */
/**
 * Renders polygons on the map.
 */
const renderPolygons = ({
  locationMap,
  map,
  setSelectedExperts,
  setPanelType,
  setPanelOpen,
  polygonLayers,
}) => {
  const sortedPolygons = Array.from(locationMap.entries())
    .filter(([, value]) => value.geometryType === "Polygon")
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
      color: "blue",
      fillColor: "#dbeafe",
      fillOpacity: 0.6,
      weight: 2,
    }).addTo(map);

    polygonLayers.push(polygon);

    let activePopup = null;

    polygon.on("mouseover", () => {
      const content = createMultiExpertContent(
        locationData.expertIDs.length,
        locationData.name,
        locationData.workIDs.length
      );

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
    });

    polygon.on("mouseout", () => {
      if (activePopup) {
        activePopup.close();
        activePopup = null;
      }
    });

    polygon.on("click", () => {
      setSelectedExperts(locationData.expertIDs);
      setPanelType("polygon");
      setPanelOpen(true);
    });
  });
};

/**
 * Renders points on the map.
 */
const renderPoints = ({
  locationMap,
  map,
  markerClusterGroup,
  setSelectedPointExperts,
  setPanelType,
  setPanelOpen,
}) => {
  locationMap.forEach((locationData, locationID) => {
    if (locationData.geometryType !== "Point") return;

    // Swap [lng, lat] to [lat, lng]
    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${locationData.expertIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
    });

    let activePopup = null;

    marker.on("mouseover", () => {
      const content = createMultiExpertContent(
        locationData.expertIDs.length,
        locationData.name,
        locationData.workIDs.length
      );

      activePopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);
    });

    marker.on("mouseout", () => {
      if (activePopup) {
        activePopup.close();
        activePopup = null;
      }
    });

    marker.on("click", () => {
      setSelectedPointExperts(locationData.expertIDs);
      setPanelType("point");
      setPanelOpen(true);
    });

    markerClusterGroup.addLayer(marker);
  });

  map.addLayer(markerClusterGroup);
};

/**
 * ExpertLayer Component
 */
const ExpertLayer = ({
  geoData,
  showWorks,
  showGrants,
  setSelectedExperts,
  setSelectedPointExperts,
  setPanelOpen,
  setPanelType,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !geoData) return;

    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
    });

    const locationMap = new Map();
    const worksMap = new Map();
    const expertsMap = new Map();
    const polygonLayers = [];

    // Generate unique IDs for works and experts
    let workIDCounter = 1;
    let expertIDCounter = 1;

    // Populate locationMap, worksMap, and expertsMap
    geoData.features.forEach((feature) => {
      const geometry = feature.geometry;
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";

      // Skip processing if showWorks is false
      if (!showWorks) return;

      // Generate a unique location ID
      const locationID = location.toLowerCase().replace(/\s+/g, "_");

      // Initialize locationMap entry if it doesn't exist
      if (!locationMap.has(locationID)) {
        locationMap.set(locationID, {
          name: location, // Store the name of the location
          geometryType: geometry.type,
          coordinates: geometry.coordinates,
          workIDs: [],
          expertIDs: [],
        });
      }

      // Process each work entry
      entries.forEach((entry) => {
        // Generate a unique work ID
        const workID = `work_${workIDCounter++}`;

        // Add work to worksMap
        worksMap.set(workID, {
          title: entry.title || "No Title",
          abstract: entry.abstract || "No Abstract",
          issued: entry.issued || "Unknown",
          confidence: entry.confidence || "Unknown",
          locationID,
          relatedExpertIDs: [],
        });

        // Add work ID to locationMap
        locationMap.get(locationID).workIDs.push(workID);

        // Process related experts
        (entry.relatedExperts || []).forEach((expert) => {
          // Generate a unique expert ID if the expert doesn't already exist
          let expertID = Array.from(expertsMap.entries()).find(
            ([, value]) => value.name === expert.name
          )?.[0];

          if (!expertID) {
            expertID = `expert_${expertIDCounter++}`;
            expertsMap.set(expertID, {
              name: expert.name || "Unknown",
              url: expert.url || "#",
              locationIDs: [],
              workIDs: [],
            });
          }

          // Add expert ID to worksMap
          worksMap.get(workID).relatedExpertIDs.push(expertID);

          // Add location ID and work ID to expertsMap
          const expertEntry = expertsMap.get(expertID);
          if (!expertEntry.locationIDs.includes(locationID)) {
            expertEntry.locationIDs.push(locationID);
          }
          if (!expertEntry.workIDs.includes(workID)) {
            expertEntry.workIDs.push(workID);
          }

          // Add expert ID to locationMap
          if (!locationMap.get(locationID).expertIDs.includes(expertID)) {
            locationMap.get(locationID).expertIDs.push(expertID);
          }
        });
      });
    });

    console.log("Location Map:", Array.from(locationMap.entries()));
    console.log("Works Map:", Array.from(worksMap.entries()));
    console.log("Experts Map:", Array.from(expertsMap.entries()));

    // Render polygons
    renderPolygons({
      locationMap,
      map,
      setSelectedExperts,
      setPanelType,
      setPanelOpen,
      polygonLayers,
    });

    // Render points
    renderPoints({
      locationMap,
      map,
      markerClusterGroup,
      setSelectedPointExperts,
      setPanelType,
      setPanelOpen,
    });

    // Cleanup function
    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach((p) => map.removeLayer(p));
    };
  }, [
    map,
    geoData,
    showWorks,
    showGrants,
    setSelectedExperts,
    setSelectedPointExperts,
    setPanelOpen,
    setPanelType,
  ]);

  return null;
};

export default ExpertLayer;