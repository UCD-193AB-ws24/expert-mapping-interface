const fetch = require('node-fetch');

const NONOVERLAP_ALL_COUNTRY_URL = 'http://localhost:3001/api/redis/nonoverlap/getAllCountryLevelMaps';
const OVERLAP_WORK_COUNTRY_URL = 'http://localhost:3001/api/redis/overlap/getCountryLevelMaps?type=works';
const OVERLAP_GRANT_COUNTRY_URL = 'http://localhost:3001/api/redis/overlap/getCountryLevelMaps?type=grants';

async function testStoreCountryLevelAllNonoverlapMaps() {
  try {
    const response = await fetch(NONOVERLAP_ALL_COUNTRY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    // Destructure the returned maps
    const { worksMap, grantsMap, combinedMap } = data;

    // Convert to Map objects for fast lookup if needed
    const worksMemoMap = new Map(Object.entries(worksMap));
    const grantsMemoMap = new Map(Object.entries(grantsMap));
    const combinedMemoMap = new Map(Object.entries(combinedMap));

    // Log sizes and a few keys for verification
    console.log('Country Level Nonoverlap Works Map size:', worksMemoMap.size);
    console.log('First 5 work keys:', Array.from(worksMemoMap.keys()).slice(0, 5));
    console.log('Country Level Nonoverlap Grants Map size:', grantsMemoMap.size);
    console.log('First 5 grant keys:', Array.from(grantsMemoMap.keys()).slice(0, 5));
    console.log('Country Level Combined Map size:', combinedMemoMap.size);
    console.log('First 5 combined keys:', Array.from(combinedMemoMap.keys()).slice(0, 5));

  } catch (err) {
    console.error('❌ Error fetching or storing country level nonoverlap maps:', err);
  }
}

async function testStoreCountryLevelOverlapWorks() {
  try {
    const response = await fetch(OVERLAP_WORK_COUNTRY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const worksMap = await response.json();

    const worksMemoMap = new Map(Object.entries(worksMap));
    console.log('Country Level Overlap Works Map size:', worksMemoMap.size);
    console.log('First 5 overlap work keys:', Array.from(worksMemoMap.keys()).slice(0, 5));
  } catch (err) {
    console.error('❌ Error fetching or storing country level overlap works map:', err);
  }
}

async function testStoreCountryLevelOverlapGrants() {
  try {
    const response = await fetch(OVERLAP_GRANT_COUNTRY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const grantsMap = await response.json();

    const grantsMemoMap = new Map(Object.entries(grantsMap));
    console.log('Country Level Overlap Grants Map size:', grantsMemoMap.size);
    console.log('First 5 overlap grant keys:', Array.from(grantsMemoMap.keys()).slice(0, 5));
  } catch (err) {
    console.error('❌ Error fetching or storing country level overlap grants map:', err);
  }
}

testStoreCountryLevelAllNonoverlapMaps();
testStoreCountryLevelOverlapWorks();
testStoreCountryLevelOverlapGrants();