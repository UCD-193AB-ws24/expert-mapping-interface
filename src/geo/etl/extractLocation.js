/** 
 * Use Llama to extract locations from
 * - Works: "title" and "abstract" from expertWorks.json
 * - Grants: "title" from expertGrants.json
 * 
 * Store each result into "location" field and save to geoExpertWorks.json and geoExpertGrants.json
 */

const axios = require('axios');
const path = require('path');
const fs = require("fs");
const Groq = require('groq-sdk');
const { default: ollama } = require('ollama');

const worksPath = path.join(__dirname, '/json', "expertWorks.json");
const grantsPath = path.join(__dirname, '/json', "expertGrants.json");
const geoWorksPath = path.join(__dirname, '/json', "geoExpertWorks.json");
const geoGrantsPath = path.join(__dirname, '/json', "geoExpertGrants.json");

const groq = new Groq({ apiKey: "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" });

/**
 * Get location from text using Llama
 * @param {String} text  - text to be extracted 
 * @returns {String}     - location
 */
async function extractLocation(text) {
  // // Ollama
  // const response = await ollama.chat({
  //   model: 'llama3.1',
  //   messages: [
  //     { "role": "system", "content": `Extract geopolitical entites from provided text. Do not infer. Do not provide explaination.` },
  //     { "role": "system", "content": `Output answer in the format of "City, Country" or "City, State" or "State, Country" or "Country" or "Location name". If no location was found for the text, return "N/A". Output 1 result if there are multiples.` },
  //     { "role": "user", "content": `Extract from this text: ${text}` }
  //   ],
  //   temperature: 0,
  //   stream: false
  // });
  // return response.message.content;

  // Groq API
  const chatCompletion = await groq.chat.completions.create({
    "messages": [
      { "role": "system", "content": `Extract geopolitical entites from provided text. Do not infer. Do not provide explaination.` },
      { "role": "system", "content": `Output answer in the format of "City, Country" or "City, State" or "State, Country" or "Country" or "Location name". If no location was found for the text, return "N/A". Output 1 result if there are multiples.` },
      { "role": "user", "content": `Extract from this text: ${text}` }
    ],
    "model": "llama-3.3-70b-versatile",
    "temperature": 0,
    "stream": false
  });
  return chatCompletion.choices[0].message.content
}

/**
 * Call extractLocation() on each work
 * Save to geoExpertWorks.json
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
 * Call extractLocation() on each grant
 * Save to geoExpertGrants.json
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


async function main() {
  await processAllWorks();
  await processAllGrants();
}

main();