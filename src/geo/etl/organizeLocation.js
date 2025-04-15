const axios = require('axios');
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

async function organizeWorks(inPath, outPath) {
  const data = JSON.parse(fs.readFileSync(inPath, "utf-8"));

  const location_base = {};

  for (const entry of data) {
    if (entry.location != "N/A") {
      if (!(entry.location in location_base)) {
        location_base[entry.location] = {};
      }

      for (const author of entry.authors) {
        if (!(author in location_base[entry.location])) {
          location_base[entry.location][author] = {
            "confidence": entry.confidence,
            "works": []
          };
        }

        location_base[entry.location][author]["works"].push(entry.title);

        const current_confidence = confidence_lvl[location_base[entry.location][author]["confidence"]];
        if (confidence_lvl[entry.confidence] > current_confidence) {
          location_base[entry.location][author]["confidence"] = entry.confidence;
        }
      }
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(location_base, null, 2));
}

async function organizeGrants(inPath, outPath) {
  const data = JSON.parse(fs.readFileSync(inPath, "utf-8"));

  const location_base = {};

  for (const entry of data) {
    if (entry.location != "N/A") {
      if (!(entry.location in location_base)) {
        location_base[entry.location] = {};
      }

      if (!(entry.relatedExpert.name in location_base[entry.location])) {
        location_base[entry.location][entry.relatedExpert.name] = {
          "confidence": entry.confidence,
          "grants": []
        };
      }

      location_base[entry.location][entry.relatedExpert.name]["grants"].push(entry.title);

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