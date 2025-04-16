/* 
*
* populateRedis.js
*
* Purpose:
* Runs fetchPostgis.js to fetch data from PostgreSQL, parses it, and stores it in Redis as the primary database.
*
* Usage: First run: 
* `node src/server.js` to start the server, 
* then run this script:
* `node src/geo/redis/populateRedis.js`
*
*/



const { createClient } = require('redis');
const fs = require('fs').promises;
const path = require('path');

// Helper function to sanitize strings
function sanitizeString(input) {
  if (!input) return '';
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word characters, spaces, hyphens, and periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   // Trim leading and trailing spaces
}

const redisClient = createClient();

async function populateRedis() {
  try {
    await redisClient.connect();

    // Run fetchPostgis.js
    // await new Promise((resolve, reject) => {
    //   exec('node ../postgis/fetchPostgis.js', { cwd: path.join(__dirname, '../redis') }, (error, stdout, stderr) => {
    //     if (error) {
    //       console.error(`❌ Error running fetchPostgis.js: ${error.message}`);
    //       return reject(error);
    //     }
    //     if (stderr) {
    //       console.error(`❌ Error output from fetchPostgis.js: ${stderr}`);
    //       return reject(new Error(stderr));
    //     }
    //     console.log(`✅ fetchPostgis.js output: ${stdout}`);
    //     resolve();
    //   });
    // });

    // Helper function to process GeoJSON data
    async function processGeoJSON(filePath, prefix) {
      const geojsonData = await fs.readFile(filePath, 'utf8');
      const geojson = JSON.parse(geojsonData);

      // Iterate over each feature in the GeoJSON
      for (const feature of geojson.features) {
      const { geometry, properties } = feature;
      const { coordinates, type: geometryType } = geometry;
      const {
        name,
        type,
        class: featureClass,
        entries,
        location,
        osm_type,
        display_name,
        id,
        source,
      } = properties;

      // Generate a unique key for each feature
      const featureKey = `${prefix}:${id}`;

      try {
        // Ensure all values are strings or serialized
        await redisClient.hSet(featureKey, {
        geometry_type: geometryType || '',
        coordinates: JSON.stringify(coordinates) || '[]',
        name: name || '',
        type: type || '',
        class: featureClass || '',
        location: location || '',
        osm_type: osm_type || '',
        display_name: display_name || '',
        source: source || '',
        });

        console.log(`✅ Successfully stored feature: ${id}`);

        // Store each entry in the `entries` array as a separate hash
        if (Array.isArray(entries)) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const entryKey = `${prefix}:${id}:entry:${i + 1}`;

          await redisClient.hSet(entryKey, {
          name: sanitizeString(entry.name) || '',
          title: sanitizeString(entry.title) || '',
          issued: entry.issued || '',
          authors: entry.authors ? JSON.stringify(entry.authors) : '[]',
          abstract: sanitizeString(entry.abstract) || '',
          confidence: entry.confidence || '',
          related_experts: entry.relatedExperts
            ? JSON.stringify(entry.relatedExperts)
            : '[]',
          });

          console.log(`✅ Successfully stored entry: ${entryKey}`);
        }
        }
      } catch (error) {
        console.error(`❌ Error storing feature: ${id}`, error);
      }
      }

      // Store metadata in Redis
      const { count, timestamp } = geojson.metadata;
      await redisClient.hSet(`${prefix}:metadata`, {
      count: count.toString(),
      timestamp,
      });

      console.log(`✅ Metadata stored in Redis for ${prefix}`);
    }

    // Process works.geojson
    const worksFilePath = path.join(__dirname, 'testing', 'works.geojson');
    await processGeoJSON(worksFilePath, 'works');

    // Process grants.geojson
    const grantsFilePath = path.join(__dirname, 'testing', 'grants.geojson');
    await processGeoJSON(grantsFilePath, 'grants');

  } catch (error) {
    console.error('❌ Error populating Redis:', error);
  } finally {
    await redisClient.disconnect();
  }
}

populateRedis().catch((error) => {
  console.error('❌ Unhandled error:', error);
});
