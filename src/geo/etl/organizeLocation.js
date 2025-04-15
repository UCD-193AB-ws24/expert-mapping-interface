/**
 * Organize locExpertWorks.json and locExpertGrants.json
 * into location_based_works.json and location_based_grants.json
 */

const path = require('path');
const fs = require("fs");

const worksPath = path.join(__dirname, '/json', "locExpertWorks.json");
const grantsPath = path.join(__dirname, '/json', "locExpertGrants.json");
const outWorksPath = path.join(__dirname, '/json', "location_based_works.json");
const outGrantsPath = path.join(__dirname, '/json', "location_based_grants.json");

const confidence_lvl = {
  "High": 5,
  "Kinda High": 4,
  "Mid": 3,
  "Low": 2
}

/**
 * Organize locExpertWorks.json into location_based_works.json
 * @param {*} inPath   - locExpertWorks.json
 * @param {*} outPath  - location_based_works.json
 */
async function organizeWorks(inPath, outPath) {
  const data = JSON.parse(fs.readFileSync(inPath, "utf-8"));

  // This dict will be write to output file later
  const location_base = {};

  for (const entry of data) {
    if (entry.location != "N/A") {
      // Add new location if need
      if (!(entry.location in location_base)) {
        location_base[entry.location] = [];
      }

      location_base[entry.location].push({
        "title": entry.title,
        "authors": entry.authors,
        "relatedExperts": entry.relatedExperts,
        "issued": entry.issued,
        "abstract": entry.abstract,
        "name": entry.name,
        "confidence": entry.confidence
      })
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(location_base, null, 2));
}

/**
 * Organize locExpertGrants.json into location_based_grants.json
 * @param {*} inPath   - locExpertGrants.json
 * @param {*} outPath  - location_based_grants.json
 */
async function organizeGrants(inPath, outPath) {
  const data = JSON.parse(fs.readFileSync(inPath, "utf-8"));

  // This dict will be write to output file later
  const location_base = {};

  for (const entry of data) {
    if (entry.location != "N/A") {
      // Add new location if need
      if (!(entry.location in location_base)) {
        location_base[entry.location] = [];
      }

      location_base[entry.location].push({
        "title": entry.title,
        "funder": entry.funder,
        "startDate": entry.startDate,
        "endDate": entry.endDate,
        "relatedExpert": entry.relatedExpert,
        "confidence": entry.confidence
      })
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(location_base, null, 2));
}


organizeWorks(worksPath, outWorksPath);
organizeGrants(grantsPath, outGrantsPath);