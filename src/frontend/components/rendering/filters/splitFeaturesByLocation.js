export const splitFeaturesByLocation = (workGeoJSON, grantGeoJSON, showWorks, showGrants) => {
    // Validate inputs and provide default values
    if (!workGeoJSON || !workGeoJSON.features) {
        console.warn("Invalid or missing workGeoJSON. Defaulting to an empty GeoJSON object.");
        workGeoJSON = { features: [] };
    }
    if (!grantGeoJSON || !grantGeoJSON.features) {
        console.warn("Invalid or missing grantGeoJSON. Defaulting to an empty GeoJSON object.");
        grantGeoJSON = { features: [] };
    }
    
    const workPolygons = new Map();
    const grantPolygons = new Map();
    const workPoints = new Map();
    const grantPoints = new Map();
    const overlappingLocations = [];
    const nonOverlappingWorks = [];
    const nonOverlappingGrants = [];

    // Collect work polygons by location
    workGeoJSON.features.forEach(feature => {
        const location = feature.properties.location || "";
        if (!location) {
            console.log("[splitFeaturesByLocation] Work feature with missing location:", feature);
            return;
        }
        if (feature.geometry.type === "Polygon") {
            if (!workPolygons.has(location)) workPolygons.set(location, []);
            workPolygons.get(location).push(feature);
        } else {
            if (!workPoints.has(location)) workPoints.set(location, []);
            workPoints.get(location).push(feature);
        }
    });

    // Collect grant polygons by location
    grantGeoJSON.features.forEach(feature => {
        const location = feature.properties.location || "";
        if (!location) {
            //console.log("[splitFeaturesByLocation] Grant feature with missing location:", feature);
            return;
        }
        if (feature.geometry.type === "Polygon") {
            if (!grantPolygons.has(location)) grantPolygons.set(location, []);
            grantPolygons.get(location).push(feature);
        } else {
            if (!grantPoints.has(location)) grantPoints.set(location, []);
            grantPoints.get(location).push(feature);
        }
    });

    // Determine overlapping and non-overlapping locations (polygons)
    workPolygons.forEach((worksFeatures, location) => {
        if (grantPolygons.has(location)) {
            overlappingLocations.push({
                location,
                worksFeatures,
                grantsFeatures: grantPolygons.get(location),
            });
            //console.log(`[splitFeaturesByLocation] Overlapping polygon location: ${location}`);
        } else {
            nonOverlappingWorks.push({ location, worksFeatures });
            //console.log(`[splitFeaturesByLocation] Non-overlapping work polygon location: ${location}`, worksFeatures);
        }
    });

    grantPolygons.forEach((grantsFeatures, location) => {
        if (!workPolygons.has(location)) {
            nonOverlappingGrants.push({ location, grantsFeatures });
            //console.log(`[splitFeaturesByLocation] Non-overlapping grant polygon location: ${location}`, grantsFeatures);
        }
    });

    // Determine overlapping and non-overlapping locations (points)
    workPoints.forEach((worksFeatures, location) => {
        if (grantPoints.has(location)) {
            overlappingLocations.push({
                location,
                worksFeatures,
                grantsFeatures: grantPoints.get(location),
            });
            //console.log(`[splitFeaturesByLocation] Overlapping point location: ${location}`);
        } else {
            nonOverlappingWorks.push({ location, worksFeatures });
            //console.log(`[splitFeaturesByLocation] Non-overlapping work point location: ${location}`, worksFeatures);
        }
    });

    grantPoints.forEach((grantsFeatures, location) => {
        if (!workPoints.has(location)) {
            nonOverlappingGrants.push({ location, grantsFeatures });
            //console.log(`[splitFeaturesByLocation] Non-overlapping grant point location: ${location}`, grantsFeatures);
        }
    });

    // Final summary
    // console.log(`[splitFeaturesByLocation] Total overlapping locations:`, overlappingLocations.length);
    // console.log(`[splitFeaturesByLocation] Total non-overlapping work locations:`, nonOverlappingWorks.length);
    // console.log(`[splitFeaturesByLocation] Total non-overlapping grant locations:`, nonOverlappingGrants.length);

    // Return data dynamically based on flags
    return {
        overlappingLocations: showWorks && showGrants ? overlappingLocations : [],
        nonOverlappingWorks: showWorks && !showGrants ? [...nonOverlappingWorks, ...overlappingLocations] : nonOverlappingWorks,
        nonOverlappingGrants: showGrants && !showWorks ? [...nonOverlappingGrants, ...overlappingLocations] : nonOverlappingGrants,
    };
};