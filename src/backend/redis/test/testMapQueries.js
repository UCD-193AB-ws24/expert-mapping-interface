const fs = require('fs');
const fetch = require('node-fetch'); // If using Node 18+, you can use global fetch

const RAW_MAPS_API_URL = 'http://localhost:3001/api/redis/getRawMaps';
const RAW_MAPS_OUTPUT_FILE = 'src/backend/redis/test/JSONFiles/rawMapsOutput.json';

const BASE_NONOVERLAP = 'http://localhost:3001/api/redis/nonoverlap';
const BASE_OVERLAP = 'http://localhost:3001/api/redis/overlap';

const LEVELS = [
  'CountryLevelMaps',
  'StateLevelMaps',
  'CountyLevelMaps',
  'CityLevelMaps',
  'ExactLevelMaps',
];

const OUTPUT_DIR = 'src/backend/redis/test/JSONFiles';

async function fetchAndSaveRawMaps() {
  try {
    const response = await fetch(RAW_MAPS_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    fs.writeFileSync(RAW_MAPS_OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Raw maps saved to ${RAW_MAPS_OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Error fetching or saving raw maps:', err);
  }
}

async function fetchAndSaveNonOverlapAll(level) {
  const url = `${BASE_NONOVERLAP}/getAll${level}`;
  const outFile = `${OUTPUT_DIR}/nonoverlap_all_${level}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Saved ${url} to ${outFile}`);
  } catch (err) {
    console.error(`❌ Error fetching ${url}:`, err);
  }
}

async function fetchAndSaveOverlap(level, type) {
  const url = `${BASE_OVERLAP}/get${level}?type=${type}`;
  const outFile = `${OUTPUT_DIR}/overlap_${type}_${level}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Saved ${url} to ${outFile}`);
  } catch (err) {
    console.error(`❌ Error fetching ${url}:`, err);
  }
}

async function runAll() {
  await fetchAndSaveRawMaps();
  for (const level of LEVELS) {
    await fetchAndSaveNonOverlapAll(level);
    await fetchAndSaveOverlap(level, 'works');
    await fetchAndSaveOverlap(level, 'grants');
  }
}

runAll();