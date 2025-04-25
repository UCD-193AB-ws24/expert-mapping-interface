/* 
*
* nuRedis.js
*
* Problem: Fix the Redis database so that it can actually sort the data and return it in a way that is useful for the frontend.
* 
* Solution:
* Runs fetchFeatures.js to fetch data from PostgreSQL, parses (and sanitizes) it, and stores it in Redis as the primary database and cache.
*
* Usage: First run: 
* `node src/server.js` to start the server, 
* run entire pipeline up until fetchFeatures.js,
* then run this script:
* `node src/geo/redis/testNewRedis.js`
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


let idCounters = {}; // Object to keep track of counters for each keyword

function generateID(keyword) {
    if (!idCounters[keyword]) {
        idCounters[keyword] = 1; // Initialize counter for the keyword
    }
    const id = String(idCounters[keyword]).padStart(4, '0'); // Pad the number to 4 digits
    idCounters[keyword]++; // Increment the counter
    return `${id}`;
}

const processedExperts = new Map(); // Set to keep track of processed experts
const processedLocations = new Map(); // Set to keep track of processed locations
const processedWorks = new Map(); // Set to keep track of processed works
const processedGrants = new Map(); // Set to keep track of processed grants

const redisClient = createClient();

async function populateRedis() {
try {

    await redisClient.connect();
    // Run fetchFeatures.js
    // await new Promise((resolve, reject) => {
    //   exec('node ../postgis/fetchFeatures.js', { cwd: path.join(__dirname, '../redis') }, (error, stdout, stderr) => {
    //     if (error) {
    //       console.error(`❌ Error running fetchFeatures.js: ${error.message}`);
    //       return reject(error);
    //     }
    //     if (stderr) {
    //       console.error(`❌ Error output from fetchFeatures.js: ${stderr}`);
    //       return reject(new Error(stderr));
    //     }
    //     // console.log(`✅ fetchFeatures.js output: ${stdout}`);
    //     resolve();
    //   });
    // });

    // Purpose of different functions: workFeatures.json and grantFeatures.json have different entry structures.
    async function processWorkGeoJSON(filePath) {
      const geoData = await fs.readFile(filePath, 'utf8');
      const GeoJson = JSON.parse(geoData);
      
      for (const feature of GeoJson.features) {
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

      
      
      const locationName = location || ''; // Use the location name if available
      let locationID = '0000'; // Default location ID if not found
      if (processedLocations.has(locationName)) {
        console.log(`📍 Location ${locationName} already processed. Skipping...`);
        locationID = processedLocations.get(locationName); 
        const locationFeatureKey = `locationMap:${locationID}`; // Use the existing ID for the key
        console.log(`Repeat locationFeatureKey hash:`, await redisClient.hGetAll(locationFeatureKey)); // Log the expert data for debugging
        
      }
      else{
        locationID = generateID('location'); // Generate a unique ID for the location
        const locationFeatureKey = `locationMap:${locationID}`; // Use the generated ID for the key
        // console.log(`📍 Processing location ${locationName}...`);
        try {
            await redisClient.hSet(locationFeatureKey, {
                locationID: locationID || '',
                locationName: locationName || '',
                displayName: display_name || '',
                geometryType: geometryType || '',
                coordinates: JSON.stringify(coordinates) || '[]',
                country: 'Blank' || '',
                rank: '0' || '',
            });
            } 
          catch (error) {console.error(`❌ Error storing ${locationFeatureKey}`, error);}
          processedLocations.set(locationName, locationID); // Map the location name to the location ID
          console.log(`📍 Successfully stored ${locationFeatureKey}!`);
          const locationData = await redisClient.hGetAll(locationFeatureKey);
          console.log(`📍 Current locationFeatureKey hash:`, locationData);
      }
      
      for (const entry of entries) {
        const workTitle = sanitizeString(entry.title) || ''; // Sanitize the work title
        if(processedWorks.has(workTitle)){
            console.log(`📜 Work ${workTitle} already processed. Skipping...`);
            const workID = processedWorks.get(workTitle); // Get the work ID from the map
            const workFeatureKey = `worksMap:${workID}`; // Use the existing ID for the key
            
            // If this is a repeat work, check the locationID with current locationID
            // It is strange that one work would have multiple locationIDs, but it is possible.
            const existingLocation = await redisClient.hGet(workFeatureKey, 'location');
            const existingLocationIDs = existingLocation ? JSON.parse(existingLocation) : [];
            if (!existingLocationIDs.includes(locationID)) {
                existingLocationIDs.push(locationID); // Add the new location ID to the list
                await redisClient.hSet(workFeatureKey, {
                    location: JSON.stringify(existingLocationIDs),
                });
                console.log(`📍 Successfully added location ${locationID} to work ${workFeatureKey}!`);
            }
            const workData = await redisClient.hGetAll(workFeatureKey);
            console.log(`📜 Current workFeatureKey hash:`, workData); // Log the expert data for debugging
        }
        else{
            const workID = generateID('work'); // Generate a unique ID for the work
            const workFeatureKey = `worksMap:${workID}`; // Use the generated ID for the key

            try {
            await redisClient.hSet(workFeatureKey, {
            workID: workID || '',
            title: sanitizeString(entry.title) || '',
            issued: Array.isArray(entry.issued)
                        ? JSON.stringify(entry.issued.map(sanitizeString)) || '[]'
                        : sanitizeString(entry.issued) || '',
            authors: entry.authors
                        ? JSON.stringify(entry.authors.map(sanitizeString)) || '[]'
                        : '[]',
            abstract: sanitizeString(entry.abstract) || '',
            confidence: sanitizeString(entry.confidence) || '',
            relatedExperts: '[]',
            location: JSON.stringify([locationID]) || '[]',
            });
            processedWorks.set(workTitle, workID); // Map the work title to the work ID
            // console.log(`📜 Successfully stored ${workFeatureKey}!`);
            } catch (error) {console.error(`❌ Error storing ${workFeatureKey}`, error);}
                
                if (Array.isArray(entry.relatedExperts)) {
                    for (const relatedExpert of entry.relatedExperts) {
                    
                    const expertName = sanitizeString(relatedExpert.name) || ''; // Sanitize the expert name
                    console.log(`👩‍🏫 Processing expert ${expertName}...`);
                    // If the expert has already been processed, add the workID to their works list
                    if (processedExperts.has(expertName)) {
                        console.log(`👩‍🏫 Expert ${expertName} already processed. Adding workID and locationID to established expert...`);
                        const expertID = processedExperts.get(expertName); // Get the expert ID from the map
                        const expertFeatureKey = `expertsMap:${expertID}`; // Use the expert ID for the key
                        const nuExpert = await redisClient.hGet(expertFeatureKey, 'works');
                        const workListinExpert = nuExpert ? JSON.parse(nuExpert) : [];
                        const nuLoc = await redisClient.hGet(expertFeatureKey, 'location');
                        const LocsinExpert = nuLoc ? JSON.parse(nuLoc) : [];
                        const expertsInCurrWork = await redisClient.hGet(workFeatureKey, 'relatedExperts');
                        const expertListinCurrWork = expertsInCurrWork ? JSON.parse(expertsInCurrWork) : [];

                        if (!workListinExpert.includes(workID)) {
                            workListinExpert.push(workID);
                            await redisClient.hSet(expertFeatureKey, {
                                works: JSON.stringify(workListinExpert),
                            });
                            console.log(`📜 Successfully added work ${workID} to expert ${expertFeatureKey}!`);
                        }
                        if (!LocsinExpert.includes(locationID)) {
                            LocsinExpert.push(locationID);
                            await redisClient.hSet(expertFeatureKey, {
                                location: JSON.stringify(workListinExpert),
                            });
                            //console.log(`📍 Successfully added location ${locationID} to expert ${expertFeatureKey}!`);
                        }
                        if (!expertListinCurrWork.includes(expertID)) {
                            expertListinCurrWork.push(expertID);
                            await redisClient.hSet(workFeatureKey, {
                                relatedExperts: JSON.stringify(expertListinCurrWork),
                            });
                            console.log(`🧑‍🎓 Successfully added expert ${expertID} to ${workFeatureKey}!`);
                        }
                        console.log(`👩‍🏫 Repeat expertFeatureKey hash:`, await redisClient.hGetAll(expertFeatureKey));
                        console.log(`Current workFeatureKey hash:`, await redisClient.hGetAll(workFeatureKey)); // Log the expert data for debugging
                        
                    }
                    // If the expert has not been processed yet...
                    else {
                        const expertID = generateID('expert'); // Generate a unique ID for the expert
                        const expertFeatureKey = `expertsMap:${expertID}`; // Use the generated ID for the key
                        try {
                        await redisClient.hSet(expertFeatureKey, {
                            expertID: expertID || '',
                            name: sanitizeString(relatedExpert.name) || '',
                            expertURL: relatedExpert.url || '',
                            title: 'Temp Professor' || '',
                            email: 'fake.email@blah.com' || '',
                            pronouns: 'they/them' || '',
                            organization: relatedExpert.organization || '',
                            works: JSON.stringify([workID]) || '[]',
                            grants: '[]', // Assuming no grants for now...
                            location: JSON.stringify([locationID]) || '[]',
                            });
                        processedExperts.set(expertName,expertID); // Add the expert name to the set of processed experts
                        // console.log(`👩‍🏫 Successfully stored ${expertFeatureKey}!`);
                        } catch (error) {
                        console.error(`❌ Error storing ${expertFeatureKey}`, error);
                        }
                        
                        // check if the expertID is already in the works list of the current work
                        // put the expertID in the works list of the current work
                        const exisitingExpertWorks = await redisClient.hGet(expertFeatureKey, 'works');
                        const worksInCurrExpert = exisitingExpertWorks ? JSON.parse(exisitingExpertWorks) : [];

                        // Add the expertID to the relatedExperts field of the current work
                        const existingRelatedExperts = await redisClient.hGet(workFeatureKey, 'relatedExperts');
                        const relatedExpertsInCurrWork = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];                      
                        
                        if(worksInCurrExpert.includes(workID)) {
                            if (!relatedExpertsInCurrWork.includes(expertID)) {
                                relatedExpertsInCurrWork.push(expertID);
                                await redisClient.hSet(workFeatureKey, {
                                    relatedExperts: JSON.stringify(relatedExpertsInCurrWork),
                                });
                                // console.log(`🧑‍🎓 Successfully added expert${expertID} to ${workFeatureKey}!`);
                            }
                        
                        }
                        console.log(`👩‍🏫 Current workFeatureKey hash:`, await redisClient.hGetAll(workFeatureKey));
                        console.log(`👩‍🏫 Current expertFeatureKey hash:`, await redisClient.hGetAll(expertFeatureKey));    
                    }}
                const workID = generateID('work'); // Generate a unique ID for the work
                const workFeatureKey = `worksMap:${workID}`; // Use the generated ID for the key
                // console.log(`📜 Processing work ${workID}...`);
        
            }
        }
      }
    }
}
    async function processGrantGeoJSON(filePath) {
        const geoData = await fs.readFile(filePath, 'utf8');
        const GeoJson = JSON.parse(geoData);
        
        for (const feature of GeoJson.features) {

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

        
        let locationID = '0000'; // Default location ID if not found
        const locationName = location || ''; // Use the location name if available
        console.log(`📍 Processing location ${locationName}...`);
        if (processedLocations.has(locationName)) {
            console.log(`📍 Location ${locationName} already processed. Skipping...`);
            locationID = processedLocations.get(locationName); // Get the location ID from the map
            const locationFeatureKey = `locationMap:${locationID}`; // Use the existing ID for the key
            const locationData = await redisClient.hGetAll(locationFeatureKey);
            console.log(`📍 Current locationFeatureKey hash:`, locationData); // Log the location data for debugging
        } else {
            locationID = generateID('location'); // Generate a unique ID for the location
            const locationFeatureKey = `locationMap:${locationID}`; // Use the generated ID for the key
            try {
                await redisClient.hSet(locationFeatureKey, {
                locationID: locationID || '',
                locationName: locationName || '',
                displayName: display_name || '',
                geometryType: geometryType || '',
                coordinates: JSON.stringify(coordinates) || '[]',
                country: 'Blank' || '',
                rank: '0' || '',
                });
                processedLocations.set(locationName, locationID); // Add the location name to the set of processed locations
                console.log(`📍 Successfully stored ${locationFeatureKey}!`);
            } catch (error) {
                console.error(`❌ Error storing ${locationFeatureKey}`, error);
            }
        }
        
        for (const entry of entries) {
            const grantTitle = sanitizeString(entry.title) || ''; // Sanitize the grant title
            if(processedGrants.has(grantTitle)){
                console.log(`📜 Grant ${grantTitle} already processed. Skipping...`);
                const grantID = processedGrants.get(grantTitle); // Get the grant ID from the map
                const grantFeatureKey = `grantsMap:${grantID}`; // Use the existing ID for the key
                
                // If this is a repeat work, check the locationID with current locationID
                // It is strange that one work would have multiple locationIDs, but it is possible.
                const existingLocation = await redisClient.hGet(grantFeatureKey, 'location');
                const existingLocationIDs = existingLocation ? JSON.parse(existingLocation) : [];
                if (!existingLocationIDs.includes(locationID)) {
                    existingLocationIDs.push(locationID); // Add the new location ID to the list
                    await redisClient.hSet(grantFeatureKey, {
                        location: JSON.stringify(existingLocationIDs),
                    });
                    console.log(`📍 Successfully added location ${locationID} to grant ${grantFeatureKey}!`);
                }
                const grantData = await redisClient.hGetAll(grantFeatureKey);
                console.log(`📜 Current grantFeatureKey hash:`, grantData); // Log the expert data for debugging
            }
            else{
                const grantID = generateID('grant'); // Generate a unique ID for the work
                const grantFeatureKey = `grantsMap:${grantID}`; // Use the generated ID for the key
                console.log(`📜 Processing grant ${grantID}...`);
                try {
                await redisClient.hSet(grantFeatureKey, {
                    grantID: grantID || '',
                    title: sanitizeString(entry.title) || '',
                    funder: entry.funder || '',
                    end_date: entry.endDate || '',
                    start_date: entry.startDate || '',
                    confidence: entry.confidence || '',
                    relatedExpert: '[]',
                    location: JSON.stringify([locationID]) || '[]',
                });
                console.log(`📜 Successfully stored ${grantFeatureKey}!`);
                processedGrants.set(grantTitle, grantID); // Map the grant title to the grant ID
                } catch (error) {console.error(`❌ Error storing ${grantFeatureKey}`, error);}
                console.log(`Related Expert: ${entry.relatedExpert.name}`); // Log the related experts for debugging
                if (entry.relatedExpert) {
                    const expertName = sanitizeString(entry.relatedExpert.name) || ''; // Sanitize the expert name
                    console.log(`👩‍🏫 Processing expert ${expertName}...`);
                    if (processedExperts.has(expertName)) {
                        const expertID = processedExperts.get(expertName); // Get the expert ID from the map
                        const expertFeatureKey = `expertsMap:${expertID}`; // Use the expert ID for the key
                        console.log(`👩‍🏫 Expert ${expertName} already processed. Adding grant data to establised expert...`);
                        
                        const currExpert = await redisClient.hGet(expertFeatureKey, 'grants');
                        const grantsInCurrExpert = currExpert ? JSON.parse(currExpert) : [];

                        const exExpert = await redisClient.hGet(expertFeatureKey, 'location');
                        const locInexExpert = exExpert ? JSON.parse(exExpert) : [];

                        if (!grantsInCurrExpert.includes(grantID)) {
                            grantsInCurrExpert.push(grantID);
                            await redisClient.hSet(expertFeatureKey, {
                            grants: JSON.stringify(grantsInCurrExpert),
                            });
                            console.log(`🎓 Successfully added grant ${grantID} to expert ${expertFeatureKey}!`);
                        }
                        if (!locInexExpert.includes(locationID)) {
                            locInexExpert.push(locationID);
                            await redisClient.hSet(expertFeatureKey, {
                            location: JSON.stringify(grantsInCurrExpert),
                            });
                            console.log(`📍 Successfully added location ${locationID} to expert ${expertFeatureKey}!`);
                        }
                        const currGrant = await redisClient.hGet(grantFeatureKey, 'relatedExpert');
                        const relatedExpertsInCurrGrant = currGrant ? JSON.parse(currGrant) : [];
                        if (!relatedExpertsInCurrGrant.includes(expertID)) {
                            relatedExpertsInCurrGrant.push(expertID);
                            await redisClient.hSet(grantFeatureKey, {
                                relatedExpert: JSON.stringify(relatedExpertsInCurrGrant),
                            });
                            console.log(`🧑‍🎓 Successfully added expert ${expertID} to ${grantFeatureKey}!`);
                        }
                        const expertsInCurrGrant = await redisClient.hGet(grantFeatureKey, 'relatedExpert');
                        const expertListinCurrGrant = expertsInCurrGrant ? JSON.parse(expertsInCurrGrant) : [];
                        if (!expertListinCurrGrant.includes(expertID)) {
                            expertListinCurrGrant.push(expertID);
                            await redisClient.hSet(grantFeatureKey, {
                                relatedExpert: JSON.stringify(expertListinCurrGrant),
                            });
                            console.log(`🧑‍🎓 Successfully added expert ${expertID} to ${grantFeatureKey}!`);
                        }
                        console.log(`👩‍🏫 Repeat expertFeatureKey hash:`, await redisClient.hGetAll(expertFeatureKey));
                        console.log(`👩‍🏫 Current grantFeatureKey hash:`, await redisClient.hGetAll(grantFeatureKey)); // Log the expert data for debugging
                    }
                    else {
                        console.log(`👩‍🏫 Expert ${entry.relatedExpert.name} not processed yet. Storing new expert...`);
                        const expertName = sanitizeString(entry.relatedExpert.name) || ''; // Sanitize the expert name
                        const expertID = generateID('expert'); // Generate a unique ID for the expert
                        const expertFeatureKey = `expertsMap:${expertID}`; // Use the generated ID for the key
                            try {
                                await redisClient.hSet(expertFeatureKey, {
                                expertID: expertID || '',
                                name: expertName,
                                expertURL: entry.relatedExpert.url || '',
                                title: 'Temp Professor' || '',
                                email: 'fake.email@blah.com' || '',
                                pronouns: 'they/them' || '',
                                organization: 'relatedExpert.organization' || '',
                                works: '[]', // Assuming no grants for now...
                                grants: JSON.stringify([grantID]), 
                                location: JSON.stringify([locationID]) || '[]',
                                });
                                processedExperts.set(expertName, expertID); // Add the expert name to the set of processed experts
                                console.log(`👩‍🏫 Successfully stored ${expertFeatureKey}!`);
                                console.log(`${expertName} added to processed experts.`); // Log the expert name for debugging
                                } catch (error) {
                                console.error(`❌ Error storing ${expertFeatureKey}`, error);
                                }
                                const exisitingExpertGrants = await redisClient.hGet(expertFeatureKey, 'grants');
                                const grantInCurrExpert = exisitingExpertGrants ? JSON.parse(exisitingExpertGrants) : [];
                                // console.log(`GrantIDs in experMap: ${grantInCurrExpert}`); // Log the works for debugging
                                // console.log(`Grant ID: ${grantID}`); // Log the work ID for debugging
                                // console.log(`ExpertID: ${expertID}`); // Log the expert ID for debugging
        
                                // Add the expertID to the relatedExperts field of the current work
                                const existingRelatedExperts = await redisClient.hGet(grantFeatureKey, 'relatedExpert');
                                const relatedExpertsInCurrWork = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];
                                // console.log(`Related Experts in current work: ${relatedExpertsInCurrWork}`); // Log the related experts for debugging
                                // if this expert has the workID in their works, add this expert as a related expert to the work
                                if(grantInCurrExpert.includes(grantID)) {
                                    if (!relatedExpertsInCurrWork.includes(expertID)) {
                                        relatedExpertsInCurrWork.push(expertID);
                                        await redisClient.hSet(grantFeatureKey, {
                                            relatedExpert: JSON.stringify(relatedExpertsInCurrWork),
                                        });
                                        console.log(`🧑‍🎓 Successfully added expert${expertID} to ${grantFeatureKey}!`);
                                    }   
                                }
                                console.log(`👩‍🏫 Repeat expertFeatureKey hash:`, await redisClient.hGetAll(expertFeatureKey));
                                console.log(`👩‍🏫 Current grantFeatureKey hash:`, await redisClient.hGetAll(grantFeatureKey)); // Log the expert data for debugging   
                            }   
                        }        
                    }
   
    }
    
    }
}
    console.log('⏳ Processing data...');
    await processWorkGeoJSON(path.join(__dirname, '../../components/features/workFeatures1.geojson'));
    await processGrantGeoJSON(path.join(__dirname, '../../components/features/grantFeatures1.geojson'));
    console.log('⌛ Processing data completed!');
}
    catch (error) {
    console.error(`❌ Error populating Redis: ${error.message}`);
}
}

// Call the function to populate Redis
populateRedis()
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
  })
  .finally(() => {
    console.log('✅ Third Round of testing done.');
    process.exit(0); // End the program without quitting Redis
  });

