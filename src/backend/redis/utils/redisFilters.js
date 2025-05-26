const { get } = require("ollama/src/utils.js");

const getPlaceRankLevel = (placeRank) => {
  if (placeRank >= 1 && placeRank <= 6) return "country";
  if (placeRank >= 7 && placeRank <= 11) return "state";
  if (placeRank >= 12 && placeRank <= 13) return "county";
  if (placeRank >= 14 && placeRank <= 24) return "city";
  if (placeRank >= 25 && placeRank <= 30) return "exact";
  return "unknown";
};


module.exports = {
  getPlaceRankLevel,
};
