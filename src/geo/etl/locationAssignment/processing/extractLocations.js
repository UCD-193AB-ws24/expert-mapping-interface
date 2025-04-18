/**
 * This script extracts geopolitical locations from works and grants data using the Llama API.
 * It processes the data and saves the extracted locations into separate JSON files.
 */

const path = require('path');
const fs = require("fs");
const { default: ollama } = require('ollama');

const worksPath = path.join(__dirname, '../../aggieExpertsAPI/works', "expertMatchedWorks.json");
const grantsPath = path.join(__dirname, '../../aggieExpertsAPI/grants', "expertMatchedGrants.json");
const geoWorksPath = path.join(__dirname, '../works', "locationBasedWorks.json");
const geoGrantsPath = path.join(__dirname, '../grants', "locationBasedGrants.json");

const ensureFileExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2));
  }
};

// Ensure output files exist before processing
ensureFileExists(geoWorksPath);
ensureFileExists(geoGrantsPath);

/**
 * Extract location using the Llama API
 * @param {String} text - Text to extract location from
 * @returns {String} - Extracted location in the format "City, Country" or similar
 */
async function extractLocation(text) {
  const response = await ollama.chat({
    model: 'llama3.1',
    messages: [
      { "role": "system", "content": `Extract geopolitical entities from provided text. Do not infer. Do not provide explanation.` },
      { "role": "system", "content": `Output answer in the format of "City, Country" or "City, State" or "State, Country" or "Country" or "Location name". If no location was found for the text, return "N/A". Output 1 result if there are multiples.` },
      { "role": "user", "content": `Extract from this text: ${text}` }
    ],
    temperature: 0,
    stream: false
  });
  return response.message.content;
}

/**
 * Process all works data to extract locations
 * Calls extractLocation() on each work and saves the results to geoExpertWorks.json
 */
async function processAllWorks() {
  const data = JSON.parse(fs.readFileSync(worksPath, "utf-8"));
  console.log("Extracting works...");

  for (const entry of data) {
    const title = entry.title;
    const abstract = entry.abstract;
    const work = title + ". " + abstract;

    const location = await extractLocation(work);
    console.log(location);

    entry.location = location;
  }

  fs.writeFileSync(geoWorksPath, JSON.stringify(data, null, 2));
}

/**
 * Process all grants data to extract locations
 * Calls extractLocation() on each grant and saves the results to geoExpertGrants.json
 */
async function processAllGrants() {
  const data = JSON.parse(fs.readFileSync(grantsPath, "utf-8"));
  console.log("Extracting grants...");

  for (const entry of data) {
    const location = await extractLocation(entry.title);
    console.log(location);

    entry.location = location;
  }

  fs.writeFileSync(geoGrantsPath, JSON.stringify(data, null, 2));
}

if (module === require.main) {
  processAllGrants();
  processAllWorks();
}

// Removed the main function to prevent duplicate execution of processAllWorks and processAllGrants.
// These functions will now only be executed when explicitly called from another module.

// Export all functions for external use
module.exports = {
  extractLocation,
  processAllWorks,
  processAllGrants
};