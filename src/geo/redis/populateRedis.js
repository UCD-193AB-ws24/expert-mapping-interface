/* 
*
* populateRedis.js
*
* Problem: Need a script that can populate a Redis database to act as a man-in-the-middle between 
* PostgreSQL and the frontend.
* 
* Solution:
* Runs fetchFeatures.js to fetch data from PostgreSQL, parses (and sanitizes) it, and stores it in Redis as the primary database and cache.
*
* Usage: First run: 
* `node src/server.js` to start the server, 
* run entire pipeline up until fetchFeatures.js,
* then run this script:
* `node src/geo/redis/populateRedis.js`
*
*/

const { createClient } = require('redis');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process'); 

// Helper function to sanitize strings
function sanitizeString(input) {
  if (!input) return '';
  return input
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word characters, spaces, hyphens, and periods
    .replace(/\s+/g, ' ')      // Replace multiple spaces with a single space
    .trim();                   
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

    // Purpose of different functions: workFeatures.json and grantFeatures.json have different entry structures.
    async function processWorkGeoJSON(filePath) {
      const workGeoData = await fs.readFile(filePath, 'utf8');
      const workGeoJson = JSON.parse(workGeoData);

      for (const workFeature of workGeoJson.features) {
      const { geometry, properties } = workFeature;
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

      const workFeatureKey = `work:${id}`;

      try {
        await redisClient.hSet(workFeatureKey, {
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

        if (Array.isArray(entries)) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const entryKey = `work:${id}:entry:${i + 1}`;

          await redisClient.hSet(entryKey, {
          name: sanitizeString(entry.name) || '',
          title: sanitizeString(entry.title) || '',
          issued: Array.isArray(entry.issued)
                ? JSON.stringify(entry.issued) || '[]'
                : entry.issued || '',
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
        console.error(`❌ Error storing work: ${id}`, error);
      }
      }

      const { count, timestamp } = workGeoJson.metadata;
      await redisClient.hSet(`work:metadata`, {
      count: count.toString(),
      timestamp,
      });

      // console.log(`✅ Work metadata stored in Redis.`);
    }
    async function processGrantGeoJSON(filePath) {
      try {
        const grantGeoData = await fs.readFile(filePath, 'utf8');
        const grantGeoJson = JSON.parse(grantGeoData);
    
        for (const grantFeature of grantGeoJson.features) {
          const { geometry, properties } = grantFeature;
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
    
          
          const grantFeatureKey = `grant:${id}`;
    
          try {
            await redisClient.hSet(grantFeatureKey, {
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
            console.error(`❌ Error storing grant: ${id}`, error);
          }
        }
    
        const { count, timestamp } = grantGeoJson.metadata;
        await redisClient.hSet(`grant:metadata`, {
          count: count.toString(),
          timestamp,
        });
    
        console.log(`✅ Metadata stored in Redis for ${prefix}`);
      } catch (error) {
        console.error(`❌ Error processing GeoJSON file at ${filePath}:`, error);
      }
    }

    // After fetchFeatures.js has run, the produced files will be located in `src/components/features/`.
    // This function will process the GeoJSON files and store the data in Redis.

    console.log('⏳ Processing data...');
    await processWorkGeoJSON(path.join(__dirname, '../../components/features/workFeatures.geojson'));
    await processGrantGeoJSON(path.join(__dirname, '../../components/features/grantFeatures.geojson'));
    console.log('⌛ Processing data completed!');
    // Delete the GeoJSON files after processing (security measure)
    await fs.unlink(path.join(__dirname, '../../components/features/workFeatures.geojson'));
    console.log('✅ Deleted workFeatures.geojson');
    await fs.unlink(path.join(__dirname, '../../components/features/grantFeatures.geojson'));
    console.log('✅ Deleted grantFeatures.geojson');

    console.log('✅ Successfully populated Redis with GeoJSON data!');
  } catch (error) {
    console.error('❌ Error in populateRedis:', error);

  }
}

populateRedis().catch((error) => {
  console.error('❌ Unhandled error:', error);
});
