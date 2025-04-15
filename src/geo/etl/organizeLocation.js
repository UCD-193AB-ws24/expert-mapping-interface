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
        location_base[entry.location] = {};
      }

      for (const author of entry.authors) {
        // Add new expert if need
        if (!(author in location_base[entry.location])) {
          location_base[entry.location][author] = {
            "confidence": entry.confidence,
            "works": []
          };
        }

        // Append work to expert
        location_base[entry.location][author]["works"].push(entry.title);

        // Update to higher confidence if exist
        const current_confidence = confidence_lvl[location_base[entry.location][author]["confidence"]];
        if (confidence_lvl[entry.confidence] > current_confidence) {
          location_base[entry.location][author]["confidence"] = entry.confidence;
        }
      }
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
        location_base[entry.location] = {};
      }

      // Add new expert if need
      if (!(entry.relatedExpert.name in location_base[entry.location])) {
        location_base[entry.location][entry.relatedExpert.name] = {
          "confidence": entry.confidence,
          "grants": []
        };
      }

      // Append work to expert
      location_base[entry.location][entry.relatedExpert.name]["grants"].push(entry.title);

      // Update to higher confidence if exist
      const current_confidence = confidence_lvl[location_base[entry.location][entry.relatedExpert.name]["confidence"]];
      if (confidence_lvl[entry.confidence] > current_confidence) {
        location_base[entry.location][entry.relatedExpert.name]["confidence"] = entry.confidence;
      }
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(location_base, null, 2));
}


organizeWorks(worksPath, outWorksPath);
organizeGrants(grantsPath, outGrantsPath);