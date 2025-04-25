// geoJsonProcessor.js

// Purpose: This module processes GeoJSON data to extract relevant information for visualization.

export const processWorkData = (geoData) => {
    const expertsMap = new Map();
    const locationMap = new Map();
    const worksMap = new Map();
    const filteredWorks = geoData?.features || [];
    let expertIDCounter = 1; // Initialize a counter for unique expert IDs
    const generateExpertID = () => `expert-${String(expertIDCounter++).padStart(4, '0')}`;
    filteredWorks.forEach((feature) => {
      
      const entries = feature.properties.entries || [];
      const coords = feature.geometry.type === "Point"
        ? [[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]]
        : feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
      const location = feature.properties.location || "Unknown";
      entries.forEach((entry) => {
        const relatedExperts = entry.relatedExperts || [];
        relatedExperts.forEach((relatedExpert) => {
          const expertName = relatedExpert.name || "Unknown";
          const expertUrl = relatedExpert.url || "#";

          // Update locationMap
          if(location === "Unknown") return; // Skip if location is unknown
          
          coords.forEach((coord) => {
            if (!locationMap.has(location)) {
              locationMap.set(location, { experts: new Set(), coords: [] });
            }
            const locationData = locationMap.get(location);
            if (Array.isArray(coord[0])) {
              // If coord is an array of [lat, lng] pairs, merge them
              locationData.coords.push(...coord);
            } else {
              // If coord is a single [lat, lng] pair, add it
              locationData.coords.push(coord);
            }
            locationData.experts.add(expertName);
          });
  
          // Update expertsMap
          
        });
      });
    });
  
    return { filteredWorks, locationMap, expertsMap };
  };