/* 
* testQuery.js
* 
* Purose: 
* This script is used to test the Redis query API endpoint.
* 
* Usage: First run server.js, then populateRedis.js to populate the Redis database with data.
* Then run this script to test the query API endpoint.
*/

const fs = require('fs').promises;

async function testQuery() {
  try {
    // Fetch data from the worksQuery API
    const worksData = await fetch("http://localhost:3001/api/redis/worksQuery").then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    });

    console.log("Works Data fetched successfully.");
    // Write works data to a file
    const worksFilename = 'src/backend/redis/testing/worksFeatures.json';
    await fs.writeFile(worksFilename, JSON.stringify(worksData, null, 2));
    console.log(`✅ Successfully wrote works data to ${worksFilename}`);

    // Fetch data from the grantsQuery API
    const grantsData = await fetch("http://localhost:3001/api/redis/grantsQuery").then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    });

    console.log("Grants Data fetched successfully.");
    // Write grants data to a file
    const grantsFilename = 'src/backend/redis/testing/grantsFeatures.json';
    await fs.writeFile(grantsFilename, JSON.stringify(grantsData, null, 2));
    console.log(`✅ Successfully wrote grants data to ${grantsFilename}`);
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

testQuery();