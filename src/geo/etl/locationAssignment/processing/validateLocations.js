/*
 * USAGE: node src/geo/etl/locationAssignment/processing/validateLocations.js
 * 
 * Validate the locations extracted by Llama in geoExpertWorks.json and geoExpertGrants.json by
 * comparing Nominatim API and Llama's ISO 3166-1 code.
 * 
 * Standardize location names with the following priority:
 * 1) Nominatim API's "name" property
 * 2) ISO code
 * 3) Original name
 */

const axios = require('axios');
const path = require('path');
const fs = require("fs");
const { default: ollama } = require('ollama');

const worksPath = path.join(__dirname, '../works', "locationBasedWorks.json");
const grantsPath = path.join(__dirname, '../grants', "locationBasedGrants.json");
const validWorksPath = path.join(__dirname, '../works', "validatedWorks.json");
const validGrantsPath = path.join(__dirname, '../grants', "validatedGrants.json");
const countries_csv = path.join(__dirname, '../locations', "countries.csv");

// Ensure directory exists before creating file
const ensureDirectoryExists = (filePath) => {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
    console.log(`Created directory: ${dirname}`);
  }
};

// Ensure directories exist
ensureDirectoryExists(worksPath);
ensureDirectoryExists(grantsPath);
ensureDirectoryExists(validWorksPath);
ensureDirectoryExists(validGrantsPath);

// Load standardized countries
const countries = {};
const csv = fs.readFileSync(countries_csv, 'utf8');
const rows = csv.split('\n').map(row => row.split(','));
for (const row of rows) {
  countries[row[1].trim()] = row[0];
}

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
      return null;
    }
  } catch (error) {
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
      confidence: "",
      country: "None"
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

  let location_info = await getLocationInfo(location);
  let iso_nominatim;
  if (location_info === null) {
    iso_nominatim = "Fail";
  } else {
    iso_nominatim = location_info.address.country_code;
  }

  const iso_llama = await getISOcode(location);

  // Handle API giving too specific location
  if (String(iso_nominatim).toUpperCase() === String(iso_llama).toUpperCase()) {
    if (location_info.place_rank >= 30) {
      const simplify_loc = location.replace(/,.*/, '');
      location_info = await getLocationInfo(simplify_loc);
    }
  }

  const special_locations = ["ocean", "sea", "continent"];

  // Considerations:
  // - Run ISO through geocode instead of searching in dict?
  // - Else branch: iso_llama undefined - use Nominatim instead of N/A

  // If codes are the same, location is good
  if (String(iso_nominatim).toUpperCase() === String(iso_llama).toUpperCase()) {
    return {
      name: location_info.name,
      confidence: "High",
      country: countries[iso_llama]
    };
    // Unable to use Nominatim, use ISO if exists
  } else if (location_info === null) {
    if (countries[iso_llama] === undefined) {
      return {
        name: "N/A",
        confidence: "",
        country: "None"
      };
    } else {
      return {
        name: countries[iso_llama],
        confidence: "Mid",
        country: countries[iso_llama]
      };
    }
    // Natural or international location without ISO
  } else if (special_locations.includes(location_info.type)) {
    return {
      name: location_info.name,
      confidence: "Kinda High",
      country: "None"
    };
    // Unable to get ISO code, bad location
  } else if (String(iso_llama).length > 2) {
    return {
      name: location,
      confidence: "Low",
      country: countries[String(iso_nominatim).toUpperCase()]
    };
    // Unmatch codes, priortize ISO
  } else {
    if (countries[iso_llama] === undefined) {
      return {
        name: "N/A",
        confidence: "",
        country: "None"
      };
    } else {
      return {
        name: countries[iso_llama],
        confidence: "Mid",
        country: countries[iso_llama]
      };
    }
  }
}

/**
 * Validate and organize locations, ensuring no duplicates.
 * Save the results to a JSON file.
 */
async function validateLocations(inputPath, outputPath) {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

    console.log(`Validating locations from ${inputPath}...`);
    for (const entry of data) {
      const result = await validateLocation(entry.location);
      entry.location = result.name;
      entry.confidence = result.confidence;
      entry.country = result.country;
    }

    console.log(`Formatting and saving validated locations to ${outputPath}...`);
    const locationMap = new Map();

    data.forEach(entry => {
      const locationKey = entry.location.toLowerCase();

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          location: entry.location,
          country: entry.country,
          entries: []
        });
      }

      delete entry.location;
      delete entry.country;

      locationMap.get(locationKey).entries.push(entry);
    });

    const organizedData = Array.from(locationMap.values());

    // Ensure output directory exists before writing file
    ensureDirectoryExists(outputPath);
    fs.writeFileSync(outputPath, JSON.stringify(organizedData, null, 2));

    console.log(`Validated and formatted locations saved to ${outputPath}.`);
  } catch (error) {
    console.error(`Error in validateLocations: ${error.message}`);
    throw error;
  }
}

async function validateAllWorks() {
  try {
    console.log("Validating all works...");
    await validateLocations(worksPath, validWorksPath);
    return true;
  } catch (error) {
    console.error(`Error validating works: ${error.message}`);
    throw error;
  }
}

async function validateAllGrants() {
  try {
    console.log("Validating all grants...");
    await validateLocations(grantsPath, validGrantsPath);
    return true;
  } catch (error) {
    console.error(`Error validating grants: ${error.message}`);
    throw error;
  }
}

// Export all functions for external use
module.exports = {
  validateAllWorks,
  validateAllGrants
};
