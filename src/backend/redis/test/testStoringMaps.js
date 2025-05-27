const fetch = require('node-fetch');
const RAW_MAPS_API_URL = 'http://localhost:3001/api/redis/getRawMaps';

async function testStoreMaps() {
  try {
    const response = await fetch(RAW_MAPS_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    // Convert plain objects to Map objects for fast lookup
    const worksMemoMap = new Map(Object.entries(data.worksMap));
    const grantsMemoMap = new Map(Object.entries(data.grantsMap));
    const expertsMemoMap = new Map(Object.entries(data.expertsMap));

    // Example: Get a specific work by ID
    const sampleWorkId = 'work:4828362';
    const sampleWork = worksMemoMap.get(sampleWorkId);
    console.log(`Sample work (${sampleWorkId}):`, sampleWork);

    // Log sizes and a few keys
    console.log('worksMemoMap size:', worksMemoMap.size);
    console.log('First 5 work keys:', Array.from(worksMemoMap.keys()).slice(0, 5));

    // --- New logic: Lookup related experts for this work ---
    if (sampleWork) {
      const relatedExpertIDs = sampleWork.relatedExpertIDs || sampleWork.relatedExperts || [];
      if (Array.isArray(relatedExpertIDs) && relatedExpertIDs.length > 0) {
        console.log(`Related experts for ${sampleWorkId}:`, relatedExpertIDs);
        relatedExpertIDs.forEach(expertId => {
          const expert = expertsMemoMap.get(expertId);
          if (expert) {
            console.log(`Expert (${expertId}):`, expert);
          } else {
            console.log(`Expert (${expertId}) not found in expertsMap.`);
          }
        });
      } else {
        console.log(`No related experts found for ${sampleWorkId}.`);
      }
    }

    // You can do the same for grants and experts if needed
    // const sampleGrant = grantsMemoMap.get('grant:12345');
    // const sampleExpert = expertsMemoMap.get('expert:67890');

  } catch (err) {
    console.error('❌ Error fetching or storing maps:', err);
  }
}

testStoreMaps();