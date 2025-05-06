import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { createMultiGrantPopup, createMatchedGrantPopup } from "./Popups";

/**
 * Helper function to prepare panel data for grants.
 */

const prepareGrantPanelData = (expertIDs, grantIDs, grantsMap, expertsMap, locationID) => {
  // Process experts
  return expertIDs.map((expertID) => {
    const expert = expertsMap.get(expertID);
    if (!expert) {
      console.warn(`Expert with ID ${expertID} not found in expertsMap.`);
      return null;
    }

    // Ensure the URL is a full URL
    const fullUrl = expert.url.startsWith("http")
      ? expert.url
      : `https://experts.ucdavis.edu/${expert.url}`;

    // Find grants associated with this expert and the current location
    const associatedGrants = grantIDs
  .map((grantID) => {
    const grant = grantsMap.get(grantID);
    if (!grant) {
      console.warn(`Grant with ID ${grantID} not found in grantsMap.`);
      return null;
    }
    return grant;
  })
  .filter((grant) => {
    if (!grant) return false;
    if (!grant.relatedExpertIDs) {
      console.warn(`Grant with ID ${grant.grantID} has no relatedExpertIDs.`);
      return false;
    }
    if (!grant.relatedExpertIDs.includes(expertID)) {
      console.warn(
        `Grant with ID ${grant.grantID} has relatedExpertID ${grant.relatedExpertIDs}, which does not match expertID ${expertID}.`
      );
      return false;
    }
    if (!grant.locationID.includes(locationID)) {
      console.warn(
        `Grant with ID ${grant.grantID} has locationID ${grant.locationID}, which does not match locationID ${locationID}.`
      );
      return false;
    }
    return true;
  });

    return {
      name: expert.name || "Unknown",
      url: fullUrl, // Use the full URL
      grants: associatedGrants.map((grant) => ({
        title: grant.title || "Untitled Grant",
        funder: grant.funder || "Unknown",
        startDate: grant.startDate || "Unknown",
        endDate: grant.endDate || "Unknown",
        confidence: grant.confidence || "Unknown",
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
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  polygonLayers,
  polygonMarkers,
  grantsMap,
  expertsMap,
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
    const flippedCoordinates = locationData.coordinates.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng])
    );

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
    
        // Track the marker for cleanup
    polygonMarkers.push(marker);

    let activePopup = null;
    let closeTimeout = null;

    marker.on("mouseover", () => {
      if (closeTimeout) clearTimeout(closeTimeout);
      const content = createMultiGrantPopup(
        locationData.expertIDs.length,
        locationData.grantIDs.length,
        locationData.name
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

/**
 * Renders points on the map.
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
  locationMap.forEach((locationData, locationID) => {
    if (locationData.geometryType !== "Point" || locationData.grantIDs.length === 0) return;

    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #eda012; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${locationData.grantIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
    });

    let grantPointPopup = null;
    let grantPointCT = null; // CT = closetimeout

    marker.on("mouseover", () => {
      if (grantPointCT) clearTimeout(grantPointCT);
      const content = createMultiGrantPopup(
        locationData.grantIDs.length,
        locationData.name
      );
      if (grantPointPopup) grantPointPopup.remove();
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
  
          const viewWPointExpertsBtn = popupElement.querySelector(".view-g-experts-btn");
          if (viewWPointExpertsBtn) {
            // // console.log('View Experts was pushed on a point!');
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

/**
 * grantLayer Component
 */
const GrantLayer = ({
  nonOverlappingGrants,
  showWorks,
  showGrants,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  combinedKeys,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !nonOverlappingGrants) {
      console.error('Error: No grants found!');
      return;
    }

    const locationMap = new Map();
    const grantsMap = new Map();
    const expertsMap = new Map();

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

    // let grantIDCounter = 1;
    // let expertIDCounter = 1;


    // Populate locationMap, grantsMap, and expertsMap
    // console.log('Entering Grant Processing...');
    nonOverlappingGrants.forEach((grantLocation) => {
      const { location, grantsFeatures } = grantLocation; // Destructure the object
      // console.log(`Location: ${location}`);
      // console.log(`Works Features:`, grantsFeatures);
      
      // Iterate over worksFeatures if needed
      grantsFeatures.forEach((grantFeature) => {
        // console.log(`Work Feature:`, grantFeature);
        const geometry = grantFeature.geometry;
        const entries = grantFeature.properties.entries || [];
        const location = grantFeature.properties.location || "Unknown";
        if(!showGrants) return;
        if (showWorks && showGrants && [...combinedKeys].some(key => key === location)) {
          // console.log(`grantLayer - Skipping popup for overlapping location: ${location}`);
          return;
        }
          // Generate a unique location ID
          const locationID = grantFeature.id;

          // Initialize locationMap entry if it doesn't exist
          if (!locationMap.has(locationID)) {
            locationMap.set(locationID, {
              name: location, // Store the name of the location
              display_name: grantFeature.properties.display_name,
              country: grantFeature.properties.country,
              place_rank: grantFeature.properties.place_rank,
              geometryType: geometry.type,
              coordinates: geometry.coordinates,
              grantIDs: [],
              expertIDs: [],
            });
          }

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
                if (!locationMap.get(locationID).expertIDs.includes(expertID)) {
                  locationMap.get(locationID).expertIDs.push(expertID);
                }
                
          });
        }
          });
        });
    });
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
  }, [map, nonOverlappingGrants, showGrants, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;








