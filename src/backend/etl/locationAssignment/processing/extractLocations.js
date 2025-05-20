/** 
* @file extractLocations.js
* @description Extracts geopolitical locations from works and grants data using the Llama API.
*              Processes the data and saves the extracted locations into separate JSON files.
* 
* USAGE: node src/geo/etl/locationAssignment/processing/extractLocations.js
* 
* Loc Nguyen, 2025
*/

const path = require('path');
const fs = require("fs");
require('dotenv').config();
const { Ollama } = require('ollama');

// Config Ollama to VM host address
const ollama = new Ollama({
  host: `http://${process.env.OLLAMA_HOST}:11434`,
});

const worksPath = path.join(__dirname, '../../aggieExpertsAPI/formattedFeatures', "worksFeatures.json");
const grantsPath = path.join(__dirname, '../../aggieExpertsAPI/formattedFeatures', "grantsFeatures.json");
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
  try {
    const response = await ollama.chat({
      model: 'llama3.1',
      messages: [
        { "role": "system", "content": `Extract geopolitical entities from provided text. Do not infer. Do not provide explanation.` },
        { "role": "system", "content": `Output answer in the format of "City, Country" or "City, State" or "State, Country" or "Country" or "Location name". If no location was found for the text, return "N/A". Output 1 result if there are multiples.` },
        { "role": "system", "content": `Give your confidence in percentage` },
        { "role": "system", "content": `Provide output in JSON format: {"Location": X, "Confidence": Y}` },
        { "role": "user", "content": `Extract from this text: ${text}` }
      ],
      temperature: 0,
      stream: false
    });
    return response.message.content;

    // const chatCompletion = await groq.chat.completions.create({
    //   "messages": [
    //     { "role": "system", "content": `Extract geopolitical entities from provided text. Do not infer. Do not provide explanation.` },
    //     { "role": "system", "content": `Output answer in the format of "City, Country" or "City, State" or "State, Country" or "Country" or "Location name". If no location was found for the text, return "N/A". Output 1 result if there are multiples.` },
    //     { "role": "system", "content": `Give your confidence in percentage` },
    //     { "role": "system", "content": `Provide output in JSON format: {"Location": X, "Confidence": Y}` },
    //     { "role": "user", "content": `Extract from this text: ${text}` }
    //   ],
    //   "model": "llama-3.3-70b-versatile",
    //   "temperature": 0,
    //   "stream": false
    // });

    // return chatCompletion.choices[0].message.content;
  } catch {
    return null;
  }
}

function parseLlmResult(llmResult) {
  try {
    const resultJSON = JSON.parse(llmResult);

    if (!("Location" in resultJSON) || !("Confidence" in resultJSON)) {
      return {
        location: "N/A",
        confidence: 0
      }
    }

    if (isNaN(Number(resultJSON.Confidence))) {
      return {
        location: "N/A",
        confidence: 0
      }
    } else {
      return {
        location: resultJSON.Location,
        confidence: Number(resultJSON.Confidence)
      }
    }
  } catch {
    return {
      location: "N/A",
      confidence: 0
    }
  }
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

    const result = await extractLocation(work);
    const parsedResult = parseLlmResult(result);

    entry.location = parsedResult.location;
    entry.llmConfidence = parsedResult.confidence;

    console.log(parsedResult.location);
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
    const result = await extractLocation(entry.title);
    const parsedResult = parseLlmResult(result);

    entry.location = parsedResult.location;
    entry.llmConfidence = parsedResult.confidence;

    console.log(parsedResult.location);
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