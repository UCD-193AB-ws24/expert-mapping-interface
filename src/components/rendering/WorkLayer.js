import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import { createMultiExpertContent } from "./Popups";
import { filterFeaturesByZoom } from "./filters/zoomFilter";
import { getMatchedFields } from "./filters/searchFilter";


/**
 * Helper function to prepare panel data.
 * Collects expert and work information for the side panel.
 */
const preparePanelData = (expertIDs, workIDs, expertsMap, worksMap, locationID) => {
  return expertIDs.map((expertID) => {
    const expert = expertsMap.get(expertID);
    if (!expert) return null;

    // Ensure the URL is a full URL
    const fullUrl = expert.url.startsWith("http")
      ? expert.url
      : `https://experts.ucdavis.edu/${expert.url}`;

    // Find works associated with this expert and the current location
    const associatedWorks = workIDs
      .map((workID) => worksMap.get(workID))
      .filter(
        (work) =>
          work &&
          work.relatedExpertIDs.includes(expertID) && // Work is associated with this expert
          work.locationID === locationID // Work matches the current location
      );

    return {
      name: expert.name || "Unknown",
      url: fullUrl, // Use the full URL
      works: associatedWorks.map((work) => ({
        title: work.title || "Untitled Work",
        issued: work.issued || "Unknown",
        confidence: work.confidence || "Unknown",
      })),
    };
  }).filter((expert) => expert); // Filter out null experts
};

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
        locationData.display_name,
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
          // // console.log('View Experts was pushed on a polygon!');
          viewWPolyExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = preparePanelData(
              locationData.expertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID // Pass the current locationID
            );
            // console.log("Panel Data for Polygon:", panelData); // Debugging log
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
          // // console.log('View Experts was pushed on a point!');
          viewWPointExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const panelData = preparePanelData(
              locationData.expertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID // Pass the current locationID
            );
            // console.log("Panel Data for Marker:", panelData); // Debugging log
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
  nonOverlappingWorks = [],
  showWorks,
  showGrants,
  setSelectedWorks,
  setPanelOpen,
  setPanelType,
  combinedKeys,
  searchKeyword,
}) => {
  const map = useMap();
  const [filteredWorks, setFilteredWorks] = useState(nonOverlappingWorks);

  // Define handleZoomEnd outside the useEffect
  const handleZoomEnd = () => {
    if (!map || !nonOverlappingWorks) return;

    const zoomLevel = map.getZoom();
    console.log("Zoom level in WorkLayer:", zoomLevel);

    const zoomFilteredWorks = filterFeaturesByZoom(nonOverlappingWorks, zoomLevel, "worksFeatures");
    console.log("Zoom Filtered Works:", zoomFilteredWorks);

    setFilteredWorks(zoomFilteredWorks); // Update the filtered works state
  };

  useEffect(() => {
    if (!map || !nonOverlappingWorks) {
      console.error("Error: No Works found!");
      return;
    }

    const handleZoomEnd = () => {
      const zoomLevel = map.getZoom();
      console.log("Zoom level in GrantLayer:", zoomLevel);

      const zoomFilteredWorks = filterFeaturesByZoom(nonOverlappingWorks, zoomLevel, "worksFeatures");
      console.log("Zoom Filtered Works:", zoomFilteredWorks);

      setFilteredWorks(zoomFilteredWorks); // Update the filtered works state
    };

    map.on("zoomend", handleZoomEnd);

    // Apply the filter initially
    handleZoomEnd();

    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, nonOverlappingWorks]);

  useEffect(() => {
    if (!map || !filteredWorks || !filteredWorks.length) {
      console.error('Error: No works found!');
      return;
    }

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

    // console.log("WorkLayer - combinedKeys:", Array.from(combinedKeys));

    const locationMap = new Map();
    const worksMap = new Map();
    const expertsMap = new Map();
    const polygonLayers = [];
    const polygonMarkers = [];

    // let workIDCounter = 1;
    // let expertIDCounter = 1;

    filteredWorks.forEach((workLocation) => {
      const { location, worksFeatures } = workLocation; // Destructure the object
      // console.log(`Location: ${location}`);
      // console.log(`Works Features:`, worksFeatures);

      // Iterate over worksFeatures if needed
      worksFeatures.forEach((workFeature) => {
        // console.log(`Work Feature:`, workFeature);
        // Add any additional processing logic here
        const geometry = workFeature.geometry;
        const entries = workFeature.properties.entries || [];
        const location = workFeature.properties.location || "Unknown";

        if (!showWorks) return;
        // Skip rendering if the location overlaps with combinedKeys
        if (showWorks && showGrants && [...combinedKeys].some(key => key === location)) {
          // console.log(`WorkLayer - Skipping popup for overlapping location: ${location}`);
          return;
        }
        // Generate a unique location ID
        const locationID = workFeature.properties.locationID;

        // Initialize locationMap entry if it doesn't exist
        if (!locationMap.has(locationID)) {
          locationMap.set(locationID, {
            name: location, // Store the name of the location
            display_name: workFeature.properties.display_name || 'Unknown Name',
            country: workFeature.properties.country || 'Unknown Country',
            place_rank: workFeature.properties.place_rank || 'Unknown Rank',
            geometryType: geometry.type,
            coordinates: geometry.coordinates,
            workIDs: [],
            expertIDs: [],
          });
        }



        // Process each work entry
        entries.forEach((entry) => {
          const matchedFields = getMatchedFields(searchKeyword, entry);
          if (searchKeyword && matchedFields.length === 0) return;
          // Generate a unique work ID
          const workID = `work_${entry.id}`;

          // Add work to worksMap
          worksMap.set(workID, {
            workID: entry.id,
            title: entry.title || "No Title",
            abstract: entry.abstract || "No Abstract",
            issued: entry.issued || "Unknown",
            confidence: entry.confidence || "Unknown",
            locationID,
            relatedExpertIDs: [],
            matchedFields,
          });

          // Add work ID to locationMap
          locationMap.get(locationID).workIDs.push(workID);

          // Process related experts
          (entry.relatedExperts || []).forEach((expert) => {
            // Generate a unique expert ID if the expert doesn't already exist
            let expertID = Array.from(expertsMap.entries()).find(
              ([, value]) => value.fullName === expert.fullName
            )?.[0];

            if (!expertID) {
              expertID = `expert_${expert.id}`;
              expertsMap.set(expertID, {
                id: expert.id,
                name: expert.fullName || "Unknown",
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
      map.off("zoomend", handleZoomEnd);
    };
  }, [
    map,
    filteredWorks,
    showWorks,
    showGrants,
    setSelectedWorks,
    setPanelOpen,
    setPanelType,]);
  return null;
};

export default WorkLayer;