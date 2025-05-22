/**
 * @file validateLocations.js
 * @description Validates the locations extracted by LLM in locationBasedWorks.json and locationBasedGrants.json by comparing Nominatim API result and LLM's ISO 3166-1 code.
 * @usage node ./src/backend/etl/locationAssignment/processing/validateLocations.js
 *
 * Loc Nguyen, 2025
 */

const axios = require('axios');
const path = require('path');
const fs = require("fs");
require('dotenv').config();
const { Ollama } = require('ollama');

// Config Ollama to VM host address
const ollama = new Ollama({
  host: `http://${process.env.OLLAMA_HOST}:11434`,
});

const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_KEY });

let useGroq = false;
let debugMode = false;

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
  try {
    if (useGroq) {
      const chatCompletion = await groq.chat.completions.create({
        "messages": [
          { "role": "system", "content": `Get one ISO 3166-1 code for this location. Do not provide explanation.` },
          { "role": "user", "content": `Location: ${location}` }
        ],
        "model": "llama-3.3-70b-versatile",
        "temperature": 0,
        "stream": false
      });
      return chatCompletion.choices[0].message.content;
    } else {
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
  } catch {
    return "None";
  }
}

/**
 * Generate Confidence metric based on distance between Nominatim API and Llama's ISO 3166-1 code
 * @param {Object} location_info - Nominatim API's return object of the location
 * @param {String} iso_location - ISO 3166-1 code of location
 * @returns {String} - Confidence metric in percentage
 */
async function calculateConfidence(location_info, iso_location) {
  const MAX_DIST = 12400;

  const lat1 = Number(location_info.lat);
  const lon1 = Number(location_info.lon);

  const val_loc = await getLocationInfo(iso_location);
  const lat2 = Number(val_loc.lat);
  const lon2 = Number(val_loc.lon);

  const dist = findDistance(lat1, lon1, lat2, lon2);
  const percentage = 100 - dist / MAX_DIST * 100;

  return percentage.toFixed(1);
}

/**
 * Helper function: Find distance between 2 coordinate points
 * @param {number} lat1 - 1st location's latitude
 * @param {number} lon1 - 1st location's longitude
 * @param {number} lat2 - 2nd location's latitude
 * @param {number} lon2 - 2nd location's longitude
 * @returns {number} - Distance
 */
function findDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 0.6214;
}

/**
 * Preprocess the location string to clean and normalize it.
 * @param {String} location - location string to preprocess
 * @returns {String}        - preprocessed location string
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
 * @returns   - {name: "Location name", confidence: "Confidence", country: "Country name"}
 */
async function validateLocation(location, llmConfidence) {
  console.log(location);
  // Preprocess the location string
  location = preprocessLocation(location);

  // Ignore if there is no location
  if (location === "N/A" || location === "") {
    return {
      name: "N/A",
      confidence: 0,
      country: "None"
    };
  }

  // Some manual name changes
  const manual_names = {
    "Latin America": "South America",
    "CA": "California",
  };

  if (location in manual_names) {
    location = manual_names[location];
  }

  // Get location info from Nominatim
  let location_info = await getLocationInfo(location);

  // Extract Country code from Nominatim object
  let iso_nominatim;
  if (location_info === null) {
    iso_nominatim = "Fail";
  } else {
    iso_nominatim = location_info.address.country_code;
  }

  // Get location's ISO code using Llama
  const iso_llama = await getISOcode(location);

  // Handle Nominatim API giving too specific location
  if (String(iso_nominatim).toUpperCase() === String(iso_llama).toUpperCase()) {
    if (location_info.place_rank >= 30) {
      if (location.includes("America")) {
        location_info = await getLocationInfo("America");
      } else {
        const simplify_loc = location.replace(/,.*/, "");
        location_info = await getLocationInfo(simplify_loc);
      }
    }
  }

  const special_locations = ["ocean", "sea", "continent"];

  // Compare Nominatim's country code and Llama's ISO to make decision on the location
  try {
    // Can't get Nominatim result, use Llama's ISO
    if (location_info === null) {
      if (countries[iso_llama] === undefined) {
        return {
          name: "N/A",
          confidence: 0,
          country: "None"
        };
      } else {
        return {
          name: countries[iso_llama],
          confidence: (llmConfidence * 0.9).toFixed(1),
          country: countries[iso_llama]
        };
      }
      // If 2 codes are the same, location is good
    } else if (String(iso_nominatim).toUpperCase() === String(iso_llama).toUpperCase()) {
      return {
        name: location_info.name,
        confidence: ((await calculateConfidence(location_info, countries[iso_llama])) * (llmConfidence * 0.01)).toFixed(1),
        country: countries[iso_llama],
      };
      // Special location not linked to a country
    } else if (special_locations.includes(location_info.type)) {
      return {
        name: location_info.name,
        confidence: llmConfidence,
        country: "None"
      };
      // Unable to get Llama's ISO code, bad location
    } else if (String(iso_llama).length > 2) {
      return {
        name: location,
        confidence: 0,
        country: countries[String(iso_nominatim).toUpperCase()]
      };
      // Unmatch codes: Priortize Llama's ISO, use Nominatim if not existed
    } else {
      if (countries[iso_llama] === undefined) {
        return {
          name: location,
          confidence: 0,
          country: countries[String(iso_nominatim).toUpperCase()]
        };
      } else {
        return {
          name: countries[iso_llama],
          confidence: ((await calculateConfidence(location_info, countries[iso_llama])) * (llmConfidence * 0.01)).toFixed(1),
          country: countries[iso_llama]
        };
      }
    }
  } catch (error) {
    return {
      name: "N/A",
      confidence: 0,
      country: "None"
    };
  }
}

/**
 * Validate and organize locations, ensuring no duplicates.
 * Save the results to a JSON file.
 */
async function validateLocations(inputPath, outputPath, debug = false) {
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

    console.log(`Validating locations from ${inputPath}...`);
    for (const entry of data) {
      const result = await validateLocation(entry.location, entry.llmConfidence);
      entry.location = result.name;
      entry.confidence = result.confidence;
      entry.country = result.country;
      if (debug && result.name !== "N/A" && result.name !== "None") {
        console.log(result.name);
      }
    }

    console.log(`Formatting and saving validated locations to ${outputPath}...`);
    const locationMap = new Map();

    data.forEach(entry => {
      const locationKey = entry.location.toLowerCase();
      if (entry.location === "N/A" || entry.location === "None") {
        return; // Skip invalid locations
      }
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

async function validateAllWorks(groq, debug = false) {
  useGroq = groq;
  debugMode = debug;
  try {
    console.log("Validating all works...");
    await validateLocations(worksPath, validWorksPath, debugMode);
    return true;
  } catch (error) {
    console.error(`Error validating works: ${error.message}`);
    throw error;
  }
}

async function validateAllGrants(groq, debug = false) {
  useGroq = groq;
  debugMode = debug;
  try {
    console.log("Validating all grants...");
    await validateLocations(grantsPath, validGrantsPath, debugMode);
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

if (require.main === module) {
  const args = process.argv.slice(2);
  const groq = args.includes('--groq');
  const debug = args.includes('--debug');
  validateAllWorks(groq, debug);
  validateAllGrants(groq, debug);
}
