import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { createCombinedPopup, createMatchedCombinedPolygonPopup } from "./Popups";
import { prepareWorkPanelData, prepareGrantPanelData } from "./utils/preparePanelData";
import { filterOverlappingLocationsByZoom } from "./filters/zoomFilter";
/**
 * CombinedLayer Component
 * 
 * This component renders combined polygons on a Leaflet map where there is an overlap
 * between works and grants for specific locations. It handles interactive popups and
 * updates the state for selected experts, grants, and the side panel.
 * 
 * Props:
 * - workGeoJSON: GeoJSON object containing work-related data.
 * - grantGeoJSON: GeoJSON object containing grant-related data.
 * - showWorks: Boolean indicating whether to display work polygons.
 * - showGrants: Boolean indicating whether to display grant polygons.
 * - setSelectedWorks: Function to update the selected experts for the side panel.
 * - setSelectedGrants: Function to update the selected grants for the side panel.
 * - setPanelOpen: Function to control whether the side panel is open.
 * - setPanelType: Function to set the type of content displayed in the side panel.
 * - setCombinedKeys: Function to update the set of overlapping locations.
 * - combinedKeys: Set of currently overlapping locations.
 * - setLocationName: Function to set the name of the location for the side panel.
 */



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
  comboPolyMarkers,
}) => {
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
    // console.log("Processing locationData:", locationData);
    const flippedCoordinates = locationData.coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng])
    );

    setLocationName(locationID);
    // Initialize sets to count unique experts
    const workExpertSet = new Set();
    const grantExpertSet = new Set();

    // Count experts from workIDs
    locationData.workIDs.forEach((workID) => {
      const work = worksMap.get(workID);
      if (!work) {
        console.warn(`Work with ID ${workID} not found in worksMap.`);
        return;
      }

      (work.relatedExpertIDs || []).forEach((expertID) => {
        if (expertsMap.has(expertID)) {
          workExpertSet.add(expertID);
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
          grantExpertSet.add(expertID);
        }
      });
    });

    const work2expertCount = workExpertSet.size;
    const grant2expertCount = grantExpertSet.size;

    if ((locationData.workExpertIDs.length + locationData.grantExpertIDs.length) !== (work2expertCount + grant2expertCount)) {
      console.log('Num of experts w/ works:', locationData.workExpertIDs.length);
      console.log('Num of experts w/ grants:', locationData.grantExpertIDs.length);
      console.log('workExpertSet:', work2expertCount);
      console.log('grantExpertSet:', grant2expertCount);
      console.warn(`Error in data consistency for locationID: ${locationID}`);
      return;
    }
    
    if(work2expertCount === 0 && grant2expertCount === 0 || locationData.workExpertIDs.length === 0 && locationData.grantExpertIDs.length === 0) {
      console.warn(`No experts found for locationID: ${locationID}`);
      return;
    }

    const totalExpertCount = work2expertCount + grant2expertCount;

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

    let activePopup = null;
    let closeTimeout = null;

    marker.on("mouseover", () => {
      if (closeTimeout) clearTimeout(closeTimeout);
      const content = createCombinedPopup(
        work2expertCount,
        grant2expertCount,
        locationData.display_name
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

        const viewPointComboExpertsBtn = popupElement.querySelector(".view-combined-btn");
        if (viewPointComboExpertsBtn) {
          viewPointComboExpertsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const grantPanelData = prepareGrantPanelData(
              locationData.grantExpertIDs,
              locationData.grantIDs,
              grantsMap,
              expertsMap,
              locationID
            );
            const workPanelData = prepareWorkPanelData(
              locationData.workExpertIDs,
              locationData.workIDs,
              expertsMap,
              worksMap,
              locationID
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
  locationMap.forEach((locationData, locationID) => {
    if (locationData.geometryType !== "Point" || locationData.grantIDs.length === 0 || locationData.worksIDs.length === 0) return;

    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    setLocationName(locationID);
    
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
          workExpertSet.add(expertID);
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
          grantExpertSet.add(expertID);
        }
      });
    });

    const work2expertCount = workExpertSet.size;
    const grant2expertCount = grantExpertSet.size;
    const totalExpertCount = work2expertCount + grant2expertCount;

    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #659c39; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${totalExpertCount}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
    });

    let activePointPopup = null;
    let closePointTimeout = null; // CT = closetimeout

    marker.on("mouseover", () => {
      if (closePointTimeout) clearTimeout(closePointTimeout);
      const content = createCombinedPopup(
        work2expertCount,
        grant2expertCount,
        locationData.display_name
      );
      if (activePointPopup) activePointPopup.remove();
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
            // console.log('View Experts was pushed on a point!');
            viewCombinedExpertsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
  
              const grantPanelData = prepareGrantPanelData(
                locationData.grantExpertIDs,
                locationData.grantIDs,
                grantsMap,
                expertsMap,
                locationID
              );
              const workPanelData = prepareWorkPanelData(
                locationData.workExpertIDs,
                locationData.workIDs,
                expertsMap,
                worksMap,
                locationID
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

    marker.on("mouseout", () => {
      closePointTimeout = setTimeout(() => {
        if (activePointPopup) {
          activePointPopup.close();
          activePointPopup = null;
        }
      }, 100);
    });

    comboMarkerGroup.addLayer(marker);
  });
  map.addLayer(comboMarkerGroup);
};

const CombinedLayer = ({
  overlappingLocations,
  showWorks,
  showGrants,
  setSelectedWorks,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  setCombinedKeys,
  combinedKeys,
  searchKeyword,
  setLocationName,

}) => {
  // Access the Leaflet map instance from react-leaflet's useMap hook
  const map = useMap();
  const [filteredOverlappingLocations, setFilteredOverlappingLocations] = useState(overlappingLocations);

  // Define handleZoomEnd outside the useEffect
  const handleZoomEnd = () => {
    const zoomLevel = map.getZoom();
    console.log("Zoom level in GrantLayer:", zoomLevel);

    const zoomFilteredFeatures = filterOverlappingLocationsByZoom(overlappingLocations, zoomLevel);
    console.log("Zoom Filtered Works:", zoomFilteredFeatures);

    setFilteredOverlappingLocations(zoomFilteredFeatures); // Update the filtered works state
  };

  useEffect(() => {
    if (!map || !overlappingLocations) {
      console.error("Error: No Works found!");
      return;
    }

    const handleZoomEnd = () => {
      const zoomLevel = map.getZoom();
      console.log("Zoom level in GrantLayer:", zoomLevel);

      const zoomFilteredFeatures = filterOverlappingLocationsByZoom(overlappingLocations, zoomLevel);
      console.log("Zoom Filtered Works:", zoomFilteredFeatures);

      setFilteredOverlappingLocations(zoomFilteredFeatures); // Update the filtered works state
    };
    
    map.on("zoomend", handleZoomEnd);

    // Apply the filter initially
    handleZoomEnd();

    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, overlappingLocations]);


  useEffect(() => {
    // Exit early if map or overlappingLocations is not available
    if (!map || !filteredOverlappingLocations) return;
    // console.log('Entering the CombinedLayer...');
    // Update the combinedKeys state if overlapping locations have changed
    const newCombinedKeys = new Set(overlappingLocations);
    const currentKeysString = JSON.stringify(Array.from(newCombinedKeys));
    const existingKeysString = JSON.stringify(Array.from(combinedKeys));

    if (currentKeysString !== existingKeysString) {
      console.log("Updating combinedKeys:", overlappingLocations);
      setCombinedKeys(newCombinedKeys);
    } else {
      console.log("CombinedKeys unchanged.");
    }

    const locationMap = new Map();
    const grantsMap = new Map();
    const expertsMap = new Map();
    const worksMap = new Map();
  
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
      filteredOverlappingLocations.forEach((locationData) => {
        const { location, worksFeatures, grantsFeatures } = locationData;
        const locationID = location;
        // console.log('Processing locationID: ', locationID, '...');
        
        // Check if workFeatures and grantFeatures are defined and not empty
        if (!worksFeatures || worksFeatures.length === 0) {
          console.warn(`No workFeatures found for locationID: ${locationID}`);
          return;
        }
        if (!grantsFeatures || grantsFeatures.length === 0) {
          console.warn(`No grantFeatures found for locationID: ${locationID}`);
          return;
        }

        if(!locationMap.has(locationID)) {
          locationMap.set(locationID, {
            geometryType:  worksFeatures[0].geometry.type,
            coordinates: worksFeatures[0].geometry.coordinates,
            locationID: worksFeatures[0].properties.locationID,
            location: locationID,
            display_name: worksFeatures[0].properties.display_name,
            country: worksFeatures[0].properties.country,
            place_rank: worksFeatures[0].properties.place_rank,
            workIDs: [],
            grantIDs: [],
            grantExpertIDs: [],
            workExpertIDs: [],
          });
        }
        
        worksFeatures.forEach((workFeature) => {
          const entries = workFeature.properties.entries || [];
  
          if(!showWorks || !showGrants) return;

          // Process each work entry
          entries.forEach((entry) => {
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
                  grantIDs: [],
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
              if (!locationMap.get(locationID).workExpertIDs.includes(expertID)) {
                locationMap.get(locationID).workExpertIDs.push(expertID);
              }
          });
          });
        });

        grantsFeatures.forEach((grantFeature) => {
          const entries = grantFeature.properties.entries || [];

          if(!showWorks || !showGrants) return;
  
            // Process each grant entry
            entries.forEach((entry) => {
              // Generate a unique grant ID
              const grantID = `grant_${entry.id}`;
              // console.log(`Now storing ${grantID}`);
              // Add grant to grantsMap
              grantsMap.set(grantID, {
                grantID: entry.id || 'Unknown grantID',
                title: entry.title || "Untitled Grant",
                funder: entry.funder || "Unknown",
                startDate: entry.start_date || "Unknown",
                endDate: entry.end_date || "Unknown",
                confidence: entry.confidence || "Unknown",
                locationID,
                relatedExpertIDs: [],
              });
  
              // Add grant ID to locationMap
              locationMap.get(locationID).grantIDs.push(grantID);
  
              // Process related expert
              if (entry.relatedExperts) {
                entry.relatedExperts.forEach((expert) => {
                  const expertName = expert.fullName;
                  const expertURL = expert.url;
  
                  // Generate a unique expert ID if the expert doesn't already exist
                  let expertID = Array.from(expertsMap.entries()).find(
                    ([, value]) => value.name === expertName
                  )?.[0];
  
                  if (!expertID) {
                    expertID = `expert_${expert.id}`;
                    expertsMap.set(expertID, {
                    id: expert.id || 'Unknown ID',
                    name: expertName || "Unknown",
                    url: expertURL || "#",
                    locationIDs: [],
                    grantIDs: [],
                    });
                  }
  
                  // Add expert ID to grantsMap
                  if (!grantsMap.get(grantID).relatedExpertIDs.includes(expertID)) {
                    grantsMap.get(grantID).relatedExpertIDs.push(expertID);
                  }
                  // Add location ID and grant ID to expertsMap
                  const expertEntry = expertsMap.get(expertID);
                  if (!expertEntry.locationIDs.includes(locationID)) {
                    expertEntry.locationIDs.push(locationID);
                  }
                  if (!expertEntry.grantIDs.includes(grantID)) {
                    expertEntry.grantIDs.push(grantID);
                  }
  
                  // Add expert ID to locationMap
                  if (!locationMap.get(locationID).grantExpertIDs.includes(expertID)) {
                    locationMap.get(locationID).grantExpertIDs.push(expertID);
                  }
                  
            });
          }
            });
          });

      });
      
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

      
      //   locationMap,
      //   worksMap,
      //   grantsMap,
      //   expertsMap,
      //   map,
      //   comboMarkerGroup,
      //   setSelectedGrants,
      //   setSelectedWorks,
      //   setPanelOpen,
      //   setPanelType,
      // });
    }
    
    // Cleanup function to remove layers and markers
    return () => {
      map.removeLayer(comboMarkerGroup);
      comboLayers.forEach((layer) => map.removeLayer(layer));
      comboPolyMarkers.forEach((marker) => map.removeLayer(marker));
      map.off("zoomend", handleZoomEnd);
    };
  }, [
    map,
    filteredOverlappingLocations,
    showWorks,
    showGrants,
    setCombinedKeys,
    combinedKeys,
    setLocationName,
  ]);
  
  // This component does not render any JSX
  return null;
};

export default CombinedLayer;