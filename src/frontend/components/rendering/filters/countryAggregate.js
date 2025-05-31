export function aggregateToCountryLevel(featuresOrCollection, featureType) {
  const features = Array.isArray(featuresOrCollection)
    ? featuresOrCollection
    : featuresOrCollection?.features;
  if (!Array.isArray(features)) return { type: "FeatureCollection", features: [] };

  const countryMap = new Map();

  // Identify country-level features and log their original count
  features.forEach(feature => {
    const props = feature.properties || {};
    const originalCount = (props[featureType] || props.entries || []).length;
    if (props.name && props.country && props.name === props.country) {
      countryMap.set(props.country, {
        mainLocation: feature,
        subFeatures: [],
        originalCount,
      });
      // console.log(`[CountryAggregate] Country-level location found: ${props.name} with ${originalCount} original ${featureType}`);
    }
  });

  // Assign sub-location features to their country and log their original count
  features.forEach(feature => {
    const props = feature.properties || {};
    const originalCount = (props[featureType] || props.entries || []).length;
    if (
      props.country &&
      countryMap.has(props.country) &&
      !(props.name === props.country)
    ) {
      countryMap.get(props.country).subFeatures.push(feature);
      // console.log(`[CountryAggregate] Sub-location "${props.name}" assigned to country "${props.country}" with ${originalCount} original ${featureType}`);
    }
  });

  // Aggregate features
  const aggregatedFeatures = [];
  countryMap.forEach(({ mainLocation, subFeatures, originalCount }) => {
  const getEntries = f =>
    f.properties[featureType] ||
    f.properties.entries ||
    [];
  const allEntries = [
    ...getEntries(mainLocation),
    ...subFeatures.flatMap(getEntries),
  ];

  // Deduplicate by entry.id (or another unique property)
  const seen = new Set();
  const dedupedEntries = allEntries.filter(entry => {
    if (!entry || !entry.id) return false;
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });

  mainLocation.properties[featureType] = dedupedEntries;
  mainLocation.properties.entries = dedupedEntries;
  aggregatedFeatures.push(mainLocation);
  console.log(
    `[CountryAggregate] Aggregated "${mainLocation.properties.name}": started with ${originalCount}, added ${dedupedEntries.length - originalCount} from sub-locations, total ${dedupedEntries.length} ${featureType}`
  );
});

  return {
    type: "FeatureCollection",
    features: aggregatedFeatures,
  };
}