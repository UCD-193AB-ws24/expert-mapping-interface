
/**
 * This file contains the `splitFeaturesByLocation` function, which processes two GeoJSON datasets
 * (workGeoJSON and grantGeoJSON) to determine overlapping and non-overlapping locations
 * based on their polygon features. It dynamically returns data based on the provided flags.
 *
 * Props:
 * - workGeoJSON: A GeoJSON object containing features related to works.
 * - grantGeoJSON: A GeoJSON object containing features related to grants.
 * - showWorks: A boolean flag indicating whether to include works in the output.
 * - showGrants: A boolean flag indicating whether to include grants in the output.
 *
 * Returns:
 * - overlappingLocations: An array of locations where both works and grants overlap.
 * - nonOverlappingWorks: An array of locations where only works exist (or works and overlapping locations if showGrants is false).
 * - nonOverlappingGrants: An array of locations where only grants exist (or grants and overlapping locations if showWorks is false).
 */

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
        if (feature.geometry.type === "Polygon") {
            const location = feature.properties.location || "";
            if (!location) return;
            if (!workPolygons.has(location)) workPolygons.set(location, []);
            workPolygons.get(location).push(feature);
        }
        else
        {
            const location = feature.properties.location || "";
            if (!location) return;
            if (!workPoints.has(location)) workPoints.set(location, []);
            workPoints.get(location).push(feature);
        }
    });

    // Collect grant polygons by location
    grantGeoJSON.features.forEach(feature => {
        if (feature.geometry.type === "Polygon") {
            const location = feature.properties.location || "";
            if (!location) return;
            if (!grantPolygons.has(location)) grantPolygons.set(location, []);
            grantPolygons.get(location).push(feature);
        }
        else{
            const location = feature.properties.location || "";
            if (!location) return;
            if (!grantPoints.has(location)) grantPoints.set(location, []);
            grantPoints.get(location).push(feature);
        }
    });

    // Determine overlapping and non-overlapping locations
    workPolygons.forEach((worksFeatures, location) => {
        if (grantPolygons.has(location)) {
            overlappingLocations.push({
                location,
                worksFeatures,
                grantsFeatures: grantPolygons.get(location),
            });
        } else {
            nonOverlappingWorks.push({ location, worksFeatures });
        }
    });

    grantPolygons.forEach((grantsFeatures, location) => {
        if (!workPolygons.has(location)) {
            nonOverlappingGrants.push({ location, grantsFeatures });
        }
    });

    // Determine overlapping and non-overlapping locations
    workPoints.forEach((worksFeatures, location) => {
        if (grantPoints.has(location)) {
            overlappingLocations.push({
                location,
                worksFeatures,
                grantsFeatures: grantPoints.get(location),
            });
        } else {
            nonOverlappingWorks.push({ location, worksFeatures });
        }
    });

    grantPoints.forEach((grantsFeatures, location) => {
        if (!workPoints.has(location)) {
            nonOverlappingGrants.push({ location, grantsFeatures });
        }
    });

    // Return data dynamically based on flags
    return {
        overlappingLocations: showWorks && showGrants ? overlappingLocations : [],
        nonOverlappingWorks: showWorks && !showGrants ? [...nonOverlappingWorks, ...overlappingLocations] : nonOverlappingWorks,
        nonOverlappingGrants: showGrants && !showWorks ? [...nonOverlappingGrants, ...overlappingLocations] : nonOverlappingGrants,
    };
};

