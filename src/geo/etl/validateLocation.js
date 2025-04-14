/**
 * Validate the locations extracted by Llama in geoExpertWorks.json and geoExpertGrants.json by
 * using Nominatim API and using Llama to get ISO 3166-1 code.
 * 
 * Standardize location names with the following priority:
 * 1) Nominatim API's "name" property
 * 2) ISO code
 * 3) Original name
**/

const axios = require('axios');
const path = require('path');
const fs = require("fs");
const Groq = require('groq-sdk');
const { error } = require('console');

const worksPath = path.join(__dirname, '/json', "geoExpertWorks.json");
const grantsPath = path.join(__dirname, '/json', "geoExpertGrants.json");
const locWorksPath = path.join(__dirname, '/json', "locExpertWorks.json");
const locGrantsPath = path.join(__dirname, '/json', "locExpertGrants.json");

// Get location's information using Nominatim API
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

// Use Llama to get location's ISO code if possible
const groq = new Groq({ apiKey: "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" });
async function getISOcode(location) {
  // // Ollama
  // const response = await ollama.chat({
  //   model: 'llama3.1',
  //   messages: [
  //     { "role": "system", "content": `Get one ISO 3166-1 code for this location. Do not provide explaination.` },
  //     { "role": "system", "content": `Location: ${location}` }
  //   ],
  //   temperature: 0,
  //   stream: false
  // });
  // return response.message.content;

  // Groq API
  const chatCompletion = await groq.chat.completions.create({
    "messages": [
      { "role": "system", "content": `Get one ISO 3166-1 code for this location. Do not provide explaination.` },
      { "role": "system", "content": `Location: ${location} ` }
    ],
    "model": "llama-3.3-70b-versatile",
    "temperature": 0,
    "stream": false
  });

  return chatCompletion.choices[0].message.content;
}

async function validateLocation(location) {
  // Ignore if there is no location
  if (location === "N/A") {
    return {
      name: "N/A",
      confidence: ""
    }
  }

  // Some manual name changes
  const manual_names = {
    "Latin America": "South America",
    "South America": "South America",
    "North America": "North America",
    "CA": "California",
  }

  if (location in manual_names) {
    location = manual_names[location];
  } else if (location.includes("America")) {
    location = "America";
  }

  const location_info = await getLocationInfo(location);
  if (location_info === null) {
    return {
      name: "N/A",
      confidence: ""
    }
  }

  const country_code = location_info.address.country_code;
  const location_iso = await getISOcode(location);

  const special_locations = ["ocean", "sea"];

  // TODO:
  // - Continents
  // - Case: Fail geocode, pass ISO

  // If codes are the same, location is good
  if (String(country_code).toUpperCase() === String(location_iso).toUpperCase()) {
    return {
      name: location_info.name,
      confidence: "High"
    }
    // Natural or international location without ISO
  } else if (special_locations.includes(location_info.type)) {
    return {
      name: location_info.name,
      confidence: "Kinda High"
    }
    // Unable to get ISO code, bad location
  } else if (String(location_iso).length > 2) {
    return {
      name: location,
      confidence: "Low"
    }
    // Unable to use Nominatim, use ISO if exists
  } else if (location_info === null) {
    return {
      name: location_iso,
      confidence: "Mid"
    }
    // Unmatch codes, priortize ISO
  } else {
    return {
      name: location_iso,
      confidence: "Mid"
    }
  }
}

async function validateAllWorks() {
  const data = JSON.parse(fs.readFileSync(worksPath, "utf-8"));
  console.log("Validating works' locations...");

  for (const entry of data) {
    const result = await validateLocation(entry.location);

    entry.location = result.name;
    entry.confidence = result.confidence;
  }

  fs.writeFileSync(locWorksPath, JSON.stringify(data, null, 2));
}

async function validateAllGrants() {
  const data = JSON.parse(fs.readFileSync(grantsPath, "utf-8"));
  console.log("Validating grants' locations...");

  for (const entry of data) {
    const result = await validateLocation(entry.location);

    entry.location = result.name;
    entry.confidence = result.confidence;
  }

  fs.writeFileSync(locGrantsPath, JSON.stringify(data, null, 2));
}

async function main() {
  await validateAllWorks();
  await validateAllGrants();
}

main();


// ---------Testing------------------------------

// const readline = require('readline');

// async function test() {
//   const file = path.join(__dirname, '/json', "llama_geo_results.jsonl");
//   const out = path.join(__dirname, '/json', "test.json");

//   const fileStream = fs.createReadStream(file);

//   const rl = readline.createInterface({
//     input: fileStream,
//     crlfDelay: Infinity
//   });

//   const data = {};

//   let i = 0;
//   for await (const line of rl) {
//     const obj = JSON.parse(line);
//     const geo = obj.response.body.choices[0].message.content;
//     const val = await validateLocation(geo);

//     data[geo] = {
//       name: val.name,
//       con: val.confidence
//     }

//     console.log(i);
//     i += 1;
//   }

//   fs.writeFileSync(out, JSON.stringify(data, null, 2));
// }

// test();
