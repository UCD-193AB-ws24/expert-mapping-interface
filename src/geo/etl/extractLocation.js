const axios = require('axios');
const path = require('path');
const fs = require("fs");
const Groq = require('groq-sdk');

const worksPath = path.join(__dirname, '/json', "expertWorks.json");
const grantsPath = path.join(__dirname, '/json', "expertGrants.json");
const geoWorksPath = path.join(__dirname, '/json', "geoExpertWorks.json");
const geoGrantsPath = path.join(__dirname, '/json', "geoExpertGrants.json");

const groq = new Groq({ apiKey: "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" });

async function extractLocation(text) {
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