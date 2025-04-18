/**
 * Validate the locations extracted by Llama in geoExpertWorks.json and geoExpertGrants.json by
 * comparing Nominatim API and Llama's ISO 3166-1 code.
 * 
 * Standardize location names with the following priority:
 * 1) Nominatim API's "name" property
 * 2) ISO code
 * 3) Original name
 * 
 * Save to locExpertWorks.json and locExpertGrants.json
**/

const axios = require('axios');
const path = require('path');
const fs = require("fs");
const { default: ollama } = require('ollama');

const worksPath = path.join(__dirname, '../works', "locationBasedWorks.json");
const grantsPath = path.join(__dirname, '../grants', "locationBasedGrants.json");
const validWorksPath = path.join(__dirname, '../works', "/validatedWorks.json");
const validGrantsPath = path.join(__dirname, '../grants', "/validatedGrants.json");

/**
 * Get location's information using Nominatim API
 * @param {String} location  - location 
 * @returns                  - Nominatim object or null 
 */
async function getLocationInfo(location) {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
      params: {
        q: location,
        format: 'json',
        addressdetails: 1,
        limit: 10,
        featuretype: 'city,state,country,town',
        "accept-language": "en"
      },
      headers: {
        'User-Agent': 'Research_Profile_Generator'
      }
    });

    if (response.data.length != 0) {
      let result;
      let importance_val = 0;
      for (let d of response.data) {
        if (d.importance > importance_val) {
          importance_val = d.importance;
          result = d;
        }
      }
      return result;
    } else {
      console.log(`Unable to get location: ${location}`);
      return null;
    }
  } catch (error) {
    console.log(`Error getting location: ${location}`);
    return null;
  }
}

/**
 * Use Llama to get location's ISO code if possible
 * @param {String} location   - location
 * @returns {String}          - Llama's response
 */
async function getISOcode(location) {
  const response = await ollama.chat({
    model: 'llama3.1',
    messages: [
      { "role": "system", "content": `Get one ISO 3166-1 code for this location. Do not provide explanation.` },
      { "role": "user", "content": `Location: ${location}` }
    ],
    temperature: 0,
    stream: false
  });
  return response.message.content;
}

/**
 * Preprocess the location string to clean and normalize it.
 * @param {String} location - location string to preprocess
 * @returns {String} - preprocessed location string
 */
function preprocessLocation(location) {
  // Remove URLs or invalid characters from the location string
  const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/g;
  location = location.replace(urlPattern, '').trim();

  // Additional normalization rules can be added here
  return location;
}

/**
 * Using Nominatim API and Llama's ISO code to make decision on the location
 * @param {String} location  - location
 * @returns                  - {name: "Location name", confidence: "Confidence"}
 */
async function validateLocation(location) {
  // Preprocess the location string
  location = preprocessLocation(location);

  // Ignore if there is no location
  if (location === "N/A" || location === "") {
    return {
      name: "N/A",
      confidence: ""
    };
  }

  // Some manual name changes
  const manual_names = {
    "Latin America": "South America",
    "South America": "South America",
    "North America": "North America",
    "CA": "California",
  };

  if (location in manual_names) {
    location = manual_names[location];
  } else if (location.includes("America")) {
    location = "America";
  }

  const location_info = await getLocationInfo(location);
  let iso_nominatim;
  if (location_info === null) {
    iso_nominatim = "Fail";
  } else {
    iso_nominatim = location_info.address.country_code;
  }

  const iso_llama = await getISOcode(location);

  const special_locations = ["ocean", "sea"];

  // TODO:
  // - Continents
  // - Case: Fail geocode, pass ISO

  // If codes are the same, location is good
  if (String(iso_nominatim).toUpperCase() === String(iso_llama).toUpperCase()) {
    return {
      name: location_info.name,
      confidence: "High"
    };
    // Unable to use Nominatim, use ISO if exists
  } else if (location_info === null) {
    return {
      name: iso_llama,
      confidence: "Mid"
    };
    // Natural or international location without ISO
  } else if (special_locations.includes(location_info.type)) {
    return {
      name: location_info.name,
      confidence: "Kinda High"
    };
    // Unable to get ISO code, bad location
  } else if (String(iso_llama).length > 2) {
    return {
      name: location,
      confidence: "Low"
    };
    // Unmatch codes, priortize ISO
  } else {
    return {
      name: iso_llama,
      confidence: "Mid"
    };
  }
}

/**
 * Validate and organize locations, ensuring no duplicates.
 * Save the results to a JSON file.
 */
async function validateLocations(inputPath, outputPath) {
  const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

  console.log(`Validating locations from ${inputPath}...`);
  for (const entry of data) {
    const result = await validateLocation(entry.location);
    entry.location = result.name;
    entry.confidence = result.confidence;
  }

  console.log(`Formatting and saving validated locations to ${outputPath}...`);
  const locationMap = new Map();

  data.forEach(entry => {
    const locationKey = entry.location.toLowerCase();

    if (!locationMap.has(locationKey)) {
      locationMap.set(locationKey, {
        location: entry.location,
        entries: []
      });
    }

    delete entry.location;

    locationMap.get(locationKey).entries.push(entry);
  });

  const organizedData = Array.from(locationMap.values());
  fs.writeFileSync(outputPath, JSON.stringify(organizedData, null, 2));

  console.log(`Validated and formatted locations saved to ${outputPath}.`);
}

async function validateAllWorks() {
  console.log("Validating all works...");
  await validateLocations(worksPath, validWorksPath);
  return true;
}

async function validateAllGrants() {
  console.log("Validating all grants...");
  await validateLocations(grantsPath, validGrantsPath);
  return true;
}

// Export all functions for external use
module.exports = {
  validateAllWorks,
  validateAllGrants
};
