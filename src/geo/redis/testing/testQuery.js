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
    // Fetch data from two different APIs concurrently
    const [worksData, grantsData] = await Promise.all([
      fetch("http://localhost:3001/api/redis/worksQuery").then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      }),
      fetch("http://localhost:3001/api/redis/grantsQuery").then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
  
        }
        return response.json();
      }),
    ]);

    console.log("Works Data and Grants Data fetched successfully.");
    console.log("Works Data:", worksData);
    console.log("Grants Data:", grantsData);
    // Write works data to a file
    const worksFilename = 'src/components/features/worksFeature.json';
    await fs.writeFile(worksFilename, JSON.stringify(worksData, null, 2));
    console.log(`✅ Successfully wrote works data to ${worksFilename}`);

    // Write grants data to a file
    const grantsFilename = 'src/components/features/grantsFeature.json';
    await fs.writeFile(grantsFilename, JSON.stringify(grantsData, null, 2));
    console.log(`✅ Successfully wrote grants data to ${grantsFilename}`);

    // console.log("Works Data:", worksData);
    // console.log("Grants Data:", grantsData);
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

testQuery();