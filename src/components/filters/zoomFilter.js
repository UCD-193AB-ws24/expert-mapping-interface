
const getPlaceRankRange = (zoomLevel) => {
    if (zoomLevel === 2) return [2, 4];
    if (zoomLevel >= 3 && zoomLevel <= 4) return [5, 8];
    if (zoomLevel >= 5 && zoomLevel <= 6) return [9, 16];
    if (zoomLevel >= 7) return [17, Infinity];
    return [Infinity, Infinity];
  };
  
  const filterFeaturesByZoom = (features = [], zoomLevel) => {
    // Get the place_rank range for the current zoom level
    const placeRankRange = getPlaceRankRange(zoomLevel);
  
    // Filter features by place_rank
    return features.filter(
      (feature) =>
        feature.properties &&
        feature.properties.place_rank >= placeRankRange[0] &&
        feature.properties.place_rank <= placeRankRange[1]
    );
  };
  
  export default filterFeaturesByZoom;