import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { createMultiGrantPopup, createMatchedGrantPopup } from "./Popups";

/**
 * Helper function to prepare panel data for grants.
 */
// locationData.expertIDs,
//         locationData.grantIDs,
//         grantsMap,
//         expertsMap,
//         locationID
const prepareGrantPanelData = (expertIDs, grantIDs, grantsMap, expertsMap, locationID) => {
  console.log("Preparing panel data...");
  console.log("expertIDs:", expertIDs);
  console.log("grantIDs:", grantIDs);
  console.log("expertsMap:", expertsMap);
  console.log("grantsMap:", grantsMap);
  console.log("locationID:", locationID)

  // Process experts
  return expertIDs.map((expertID) => {
    grantIDs.forEach((grantID) => {
      console.log(`Grant ID: ${grantID}, Grant:`, grantsMap.get(grantID));
    });
    expertIDs.forEach((expertID) => {
      console.log(`Expert ID: ${expertID}, Expert:`, expertsMap.get(expertID));
    });
    console.log("Are all grantIDs valid?", grantIDs.every((id) => id !== undefined && id !== null));
    console.log("Are all expertIDs valid?", expertIDs.every((id) => id !== undefined && id !== null));
    
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
    if (!grant.relatedExpert) {
      console.warn(`Grant with ID ${grant.grantID} has no relatedExpert.`);
      return false;
    }
    if (grant.relatedExpertID !== expertID) {
      console.warn(
        `Grant with ID ${grant.grantID} has relatedExpertID ${grant.relatedExpertID}, which does not match expertID ${expertID}.`
      );
      return false;
    }
    if (grant.locationID !== locationID) {
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
      color: "darkblue",
      fillColor: "orange",
      fillOpacity: 0.5,
      weight: 2,
    }).addTo(map);

    polygonLayers.push(polygon);

    polygon.on("mouseover", () => {
      const content = createMultiGrantPopup(
        locationData.grantIDs.length,
        locationData.name
      );

      const popup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(polygon.getBounds().getCenter())
        .setContent(content)
        .openOn(map);

      polygon.on("mouseout", () => {
        popup.close();
      });
    });

    polygon.on("click", () => {
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
    });
  });
};

/**
 * Renders points on the map.
 */
const renderPoints = ({
  locationMap,
  map,
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
        html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${locationData.grantIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
    });

    marker.on("mouseover", () => {
      const content = createMultiGrantPopup(
        locationData.grantIDs.length,
        locationData.name
      );

      const popup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);

      marker.on("mouseout", () => {
        popup.close();
      });
    });

    marker.on("click", () => {
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
    });

    marker.addTo(map);
  });
};

/**
 * GrantLayer Component
 */
const GrantLayer = ({
  grantGeoJSON,
  showGrants,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !grantGeoJSON || !showGrants) return;

    const locationMap = new Map();
    const grantsMap = new Map();
    const expertsMap = new Map();

    const polygonLayers = [];

    let grantIDCounter = 1;
    let expertIDCounter = 1;

    // Populate locationMap, grantsMap, and expertsMap
    grantGeoJSON.features.forEach((feature) => {
    const geometry = feature.geometry;
    const entries = feature.properties.entries || [];
    const location = feature.properties.location || "Unknown";

      // Generate a unique location ID
      const locationID = feature.id;

      // Initialize locationMap entry if it doesn't exist
      if (!locationMap.has(locationID)) {
        locationMap.set(locationID, {
          name: location, // Store the name of the location
          geometryType: geometry.type,
          coordinates: geometry.coordinates,
          grantIDs: [],
          expertIDs: [],
        });
      }

      // Process each grant entry
      entries.forEach((entry) => {
        // Generate a unique grant ID
        const grantID = `grant_${grantIDCounter++}`;

        // Add grant to grantsMap
        grantsMap.set(grantID, {
          title: entry.title || "Untitled Grant",
          funder: entry.funder || "Unknown",
          startDate: entry.startDate || "Unknown",
          endDate: entry.endDate || "Unknown",
          confidence: entry.confidence || "Unknown",
          locationID,
          relatedExpert: entry.relatedExpert || null,
        });

        // Add grant ID to locationMap
        locationMap.get(locationID).grantIDs.push(grantID);

        // Process related expert
        if (entry.relatedExpert) {
          const expertName = entry.relatedExpert.name;
          const expertURL = entry.relatedExpert.url;

          // Generate a unique expert ID if the expert doesn't already exist
          let expertID = Array.from(expertsMap.entries()).find(
            ([, value]) => value.name === expertName
          )?.[0];

          if (!expertID) {
            expertID = `expert_${expertIDCounter++}`;
            expertsMap.set(expertID, {
              name: expertName || "Unknown",
              url: expertURL || "#",
              locationIDs: [],
              grantIDs: [],
            });
          }
          
          
          
          // Add expert ID to grantsMap
          grantsMap.get(grantID).relatedExpertID = expertID;

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
        }
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
      grantsMap,
      expertsMap,
    });

    // Render points
    renderPoints({
      locationMap,
      map,
      setSelectedGrants,
      setPanelOpen,
      setPanelType,
      grantsMap,
      expertsMap,
    });

    // Cleanup function
    return () => {
      polygonLayers.forEach((p) => map.removeLayer(p));
    };
  }, [map, grantGeoJSON, showGrants, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;








