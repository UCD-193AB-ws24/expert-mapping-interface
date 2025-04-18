/* 
*
* populateRedis.js
*
* Purpose:
* Runs fetchFeatures.js to fetch data from PostgreSQL, parses it, and stores it in Redis as the primary database.
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
const { exec } = require('child_process'); // Import exec from child_process

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

    // Run fetchFeatures.js
    await new Promise((resolve, reject) => {
      exec('node ../postgis/fetchFeatures.js', { cwd: path.join(__dirname, '../redis') }, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Error running fetchFeatures.js: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`❌ Error output from fetchFeatures.js: ${stderr}`);
          return reject(new Error(stderr));
        }
        // console.log(`✅ fetchFeatures.js output: ${stdout}`);
        resolve();
      });
    });

    // Helper function to process GeoJSON data
    async function processWorkGeoJSON(filePath) {
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
      const featureKey = `work:${id}`;

      try {
        // Ensure all values are strings or serialized
        await redisClient.hSet(featureKey, {
        id: id || '',
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

        // console.log(`✅ Successfully stored work: ${id}`);

        // Store each entry in the `entries` array as a separate hash
        if (Array.isArray(entries)) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const entryKey = `work:${id}:entry:${i + 1}`;

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

          // console.log(`✅ Successfully stored work entry: ${entryKey}`);
        }
        }
      } catch (error) {
        console.error(`❌ Error storing feature: ${id}`, error);
      }
      }

      // Store metadata in Redis
      const { count, timestamp } = geojson.metadata;
      await redisClient.hSet(`work:metadata`, {
      count: count.toString(),
      timestamp,
      });

      // console.log(`✅ Work metadata stored in Redis.`);
    }
    async function processGrantGeoJSON(filePath) {
      try {
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
          const featureKey = `grant:${id}`;
    
          try {
            // Ensure all values are strings or serialized
            await redisClient.hSet(featureKey, {
              id: id || '',
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
    
            // console.log(`✅ Successfully stored grant: ${id}`);
    
            // Store each entry in the `entries` array as a separate hash
            if (Array.isArray(entries)) {
              for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const entryKey = `grant:${id}:entry:${i + 1}`;
    
                await redisClient.hSet(entryKey, {
                  title: sanitizeString(entry.title) || '',
                  funder: entry.funder || '',
                  end_date: entry.endDate || '',
                  start_date: entry.startDate || '',
                  confidence: entry.confidence || '',
                  related_expert: entry.relatedExpert
                    ? JSON.stringify(entry.relatedExpert)
                    : '[]',
                });
    
                // console.log(`✅ Successfully stored grant entry: ${entryKey}`);
              }
            }
          } catch (error) {
            console.error(`❌ Error storing feature: ${id}`, error);
          }
        }
    
        // Store metadata in Redis
        const { count, timestamp } = geojson.metadata;
        await redisClient.hSet(`grant:metadata`, {
          count: count.toString(),
          timestamp,
        });
    
        // console.log(`✅ Grant metadata stored in Redis.`);
      } catch (error) {
        console.error(`❌ Error processing GeoJSON file at ${filePath}:`, error);
      }
    }

    // Example usage of the helper functions
    await processWorkGeoJSON(path.join(__dirname, '../../components/features/workFeatures.geojson'));
    await processGrantGeoJSON(path.join(__dirname, '../../components/features/grantFeatures.geojson'));
    console.log('✅ Processing data completed!');
    // Delete the GeoJSON files after processing
    await fs.unlink(path.join(__dirname, '../../components/features/workFeatures.geojson'));
    console.log('✅ Deleted workFeatures.geojson');
    await fs.unlink(path.join(__dirname, '../../components/features/grantFeatures.geojson'));
    console.log('✅ Deleted grantFeatures.geojson');

    console.log('✅ Successfully populated Redis with GeoJSON data!');
    
    // Remove generated files in src/components/features
    const generatedFiles = ['workFeatures.geojson', 'grantFeatures.geojson'];
    for (const file of generatedFiles) {
      const filePath = path.join(__dirname, '..', '..', 'components', 'features', file);
      try {
      await fs.unlink(filePath);
      console.log(`✅ Successfully removed file: ${file}`);
      } catch (error) {
      console.error(`❌ Error removing file: ${file}`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error in populateRedis:', error);

  }
}
populateRedis()
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
  })
  .finally(() => {
    console.log('✅ Redis is fully populated.');
    process.exit(0); // End the program without quitting Redis
  });