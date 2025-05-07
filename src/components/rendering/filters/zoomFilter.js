const getPlaceRankRange = (zoomLevel) => {
  if (zoomLevel >= 2 && zoomLevel <= 3) return [3, 4];
  if (zoomLevel === 4) return [5, 12];
  if (zoomLevel >= 5) return [13, 30];
  return [Infinity, Infinity];
};

const filterFeaturesByZoom = (features = [], zoomLevel, featureType = "grantsFeatures") => {
  const placeRankRange = getPlaceRankRange(zoomLevel);
  console.log(`Filtering features for zoom level ${zoomLevel}, place rank range: ${placeRankRange}`);

  const filteredArray = []; // Manually construct the final array

  features.forEach((feature) => {
    const hasFeatures = Array.isArray(feature[featureType]);

    if (!hasFeatures) {
      // console.log(`Feature at location ${feature.location} does not have ${featureType}`);
      return; // Skip this feature
    }

    const filteredFeatures = feature[featureType].filter((item) => {
      const placeRank = parseInt(item.properties?.place_rank, 10);
      const isInRange = placeRank >= placeRankRange[0] && placeRank <= placeRankRange[1];

      console.log(
        `Checking feature at location ${feature.location}, place_rank: ${placeRank}, in range: ${isInRange}`
      );

      return isInRange;
    });

    if (filteredFeatures.length > 0) {
      // console.log(
      //   `Including location ${feature.location} with ${filteredFeatures.length} filtered ${featureType}.`
      // );

      // Add the filtered feature to the final array
      filteredArray.push({
        location: feature.location,
        [featureType]: filteredFeatures,
      });
    } else {
      // console.log(`Excluding location ${feature.location} because no features match the place rank range.`);
    }
  });

  return filteredArray; // Return the manually constructed array
};

const filterOverlappingLocationsByZoom = (overlappingLocations = [], zoomLevel) => {
  // Filter worksFeatures
  const filteredWorks = filterFeaturesByZoom(overlappingLocations, zoomLevel, "worksFeatures");

  // Filter grantsFeatures
  const filteredGrants = filterFeaturesByZoom(overlappingLocations, zoomLevel, "grantsFeatures");

  // Combine the results into a single array
  return overlappingLocations
    .map((location) => {
      const worksMatch = filteredWorks.find((work) => work.location === location.location);
      const grantsMatch = filteredGrants.find((grant) => grant.location === location.location);

      if (!worksMatch && !grantsMatch) return null;

      return {
        location: location.location,
        worksFeatures: worksMatch?.worksFeatures || [],
        grantsFeatures: grantsMatch?.grantsFeatures || [],
      };
    })
    .filter((item) => item !== null); // Remove null items
};

export { filterFeaturesByZoom, filterOverlappingLocationsByZoom };