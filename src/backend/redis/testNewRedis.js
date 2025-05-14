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
    const id = String(idCounters[keyword]).padStart(8, '0'); // Pad the number to 4 digits
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
        console.log(`📂 Reading GeoJSON file from: ${filePath}`);
        const geoData = await fs.readFile(filePath, 'utf8');
        const GeoJson = JSON.parse(geoData);
        console.log(`📊 Parsed GeoJSON data. Number of features/locations: ${GeoJson.features.length}`);
    
        for (const feature of GeoJson.features) {
            const { geometry, properties } = feature;
            const { coordinates, type: geometryType } = geometry;
            const { entries, location, display_name } = properties;
    
            // console.log(`📍 Processing feature with location: ${location}, display name: ${display_name}`);
            const locationName = location || ''; // Use the location name if available
            const locationID = await getOrCreateLocation(locationName, display_name, geometryType, coordinates);
    
            for (const entry of entries) {
                const workTitle = sanitizeString(entry.title) || ''; // Sanitize the work title
                // console.log(`📜 Processing work entry with title: ${workTitle}`);
                if (processedWorks.has(workTitle)) {
                    console.log(`📜 Work ${workTitle} already processed. Handing repeat...`);
                    const workID = await handleRepeatWork(workTitle, locationID); // Handle repeat work
                    await updateLocationField(`locationMap:${locationID}`, 'works', workID); // Update the location with the new work ID
                    // check if new locationID has the same expertID as this repeat work
                    if (entry.relatedExperts && entry.relatedExperts.length > 0)
                    {
                        for (const relatedExpert of entry.relatedExperts) {
                            const expertName = sanitizeString(relatedExpert.name) || '';
                            console.log(`👩‍🏫 Processing expert: ${expertName}`);
                            
                            let expertID; // Default expert ID if not found
                            if (processedExperts.has(expertName)) {
                                console.log(`👩‍🏫 Expert ${expertName} already processed. Handling repeat expert...`);
                                // Handle the repeat expert
                                expertID = await handleRepeatExpert(expertName, workID, locationID, '[]');
                                await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                            } else {
                                // this event should not happen, but if it does, we need to handle it
                                console.log(`⚠️ [UNUSUAL ACTIVITY!] Expert ${expertName} not processed yet. Storing new expert.`);
                                // Handle a new expert
                                try {
                                    expertID = await newExpertHash(expertName, relatedExpert, workID, '[]', locationID);
                                    await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                                } catch (error) {
                                    console.error(`❌ Error storing new expert ${expertName}:`, error);
                                }
                            }
                        }
                    }
                }
                else {
                    const workID = await newWorkHash(workTitle, entry, locationID);
                    await updateLocationField(`locationMap:${locationID}`, 'works', workID); // Update the location with the new work ID
                    
                    if (entry.relatedExperts && entry.relatedExperts.length > 0) {
                        // console.log(`👩‍🏫 Found ${entry.relatedExperts.length} related experts for work: ${workTitle}`);
                        const relatedExpertIDs = []; // Collect expert IDs for this work
                            
                        for (const relatedExpert of entry.relatedExperts) {
                            const expertName = sanitizeString(relatedExpert.name) || '';
                            // console.log(`👩‍🏫 Processing expert: ${expertName}`);
                            
                            let expertID; // Default expert ID if not found
                            if (processedExperts.has(expertName)) {
                                console.log(`👩‍🏫 Expert ${expertName} already processed. Handling repeat expert...`);
                                // Handle the repeat expert
                                expertID = await handleRepeatExpert(expertName, workID, locationID, '[]');
                                await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                            } else {
                                // console.log(`👩‍🏫 Expert ${expertName} not processed yet. Storing new expert.`);
                                // Handle a new expert
                                try {
                                    expertID = await newExpertHash(expertName, relatedExpert, workID, '[]', locationID);
                                    await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                                } catch (error) {
                                    console.error(`❌ Error storing new expert ${expertName}:`, error);
                                }
                                }
                                relatedExpertIDs.push(String(expertID));
                                // console.log(`🆔 Added expert ID ${expertID} to relatedExpertIDs: ${relatedExpertIDs}`);
                            }
                        const workFeatureKey = `worksMap:${workID}`;
                        const existingRelatedExperts = await redisClient.hGet(workFeatureKey, 'relatedExperts');
                        const relatedExpertsInCurrWork = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];
                        // console.log(`👩‍🏫 Related experts in current work: ${relatedExpertsInCurrWork}`);
                        if (relatedExpertIDs && relatedExpertIDs.length > 0) {
                            for (const expert_ID of relatedExpertIDs) {
                            // Add each expert ID to the relatedExperts field in the work's hash key
                            if(!relatedExpertsInCurrWork.includes(expert_ID)){
                                relatedExpertsInCurrWork.push(expert_ID);
                                // console.log(`👩‍🏫 Successfully added expert ID ${expert_ID} to work${workFeatureKey}`);
                            }
                            }
                            try {
                                    await redisClient.hSet(workFeatureKey, {
                                        relatedExperts: JSON.stringify(relatedExpertsInCurrWork),
                                        });
                                    }
                                catch (error) {
                                    console.error(`❌ Error updating relatedExperts for ${workFeatureKey}:`, error);
                                }
                            }
                        else {
                            console.error(`❌ relatedExpertIDs is not an array:`, relatedExpertIDs);
                        }
                        // console.log(`👩‍🏫 Successfully updated relatedExperts for ${workFeatureKey}:`, relatedExpertIDs);
                        } 
                    else {
                        console.log(`👩‍🏫 No related experts found for work: ${workTitle}`);
                    }
                }
                
                
            }


        }
        
        console.log(`✅ Finished processing GeoJSON file: ${filePath}`);
    }

    async function getOrCreateLocation(locationName, displayName, geometryType, coordinates) {
        if (processedLocations.has(locationName)) {
            // console.log(`📍 Location ${locationName} already processed. Skipping...`);
            return processedLocations.get(locationName);
        }

        const locationID = generateID('location');
        const locationFeatureKey = `locationMap:${locationID}`;
        try {
            await redisClient.hSet(locationFeatureKey, {
                locationID: locationID || '',
                locationName: locationName || '',
                displayName: displayName || '',
                geometryType: geometryType || '',
                coordinates: JSON.stringify(coordinates) || '[]',
                country: 'Blank' || '',
                rank: '0' || '',
                relatedExperts: '[]', // fill in later
                works: '[]', // fill in later
                grants: '[]', // fill in later
            });
            processedLocations.set(locationName, locationID);
            // console.log(`📍 Location ${locationName} and locationID: ${locationID} added to processed locations.`); // Log the location name for debugging
            // console.log(`📍 Successfully stored ${locationFeatureKey}!`);
        } catch (error) {
            console.error(`❌ Error storing ${locationFeatureKey}`, error);
        }
        return locationID;
    }

    async function newWorkHash(workTitle, entry, locationID) {
        const workID = generateID('work');
        const workFeatureKey = `worksMap:${workID}`;
            try {
                await redisClient.hSet(workFeatureKey, {
                    workID: workID || '',
                    title: sanitizeString(entry.title) || '',
                    displayTitle: entry.title || '',
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
                processedWorks.set(workTitle, workID);
                // console.log(`📜 Work ${workTitle} and workID: ${workID} added to processed works.`); // Log the work title for debugging
                // console.log(`📜 Successfully stored ${workFeatureKey}!`);
            } catch (error) {
                console.error(`❌ Error storing ${workFeatureKey}`, error);
            }
        
        return workID;  
    }

    async function handleRepeatWork(workTitle, locationID){
        // If this work has been processed before and this is a new locationID, add the new locationID to the existing work.
        // There shouldn't be multiple locationIDs for the same work, but it is possible.
        // Since it is the same work, we don't need to check for new experts.
        const workID = processedWorks.get(workTitle);
        const workFeatureKey = `worksMap:${workID}`;
        const existingLocation = await redisClient.hGet(workFeatureKey, 'location');
        const existingLocationIDs = existingLocation ? JSON.parse(existingLocation) : [];
            
        if (!existingLocationIDs.includes(locationID)) {
            existingLocationIDs.push(locationID);
            await redisClient.hSet(workFeatureKey, {
                location: JSON.stringify(existingLocationIDs),
            });
            // console.log(`📍 Successfully added location ${locationID} to work ${workFeatureKey}!`);
        }
        // const workData = await redisClient.hGetAll(workFeatureKey);
        // console.log(`📜 Current workFeatureKey hash:`, workData);
        // return workID; // Return the work ID for further processing if needed
    }

    async function newExpertHash(expertName, relatedExpert, workID, grantID, locationID) {
            const expertID = generateID('expert');
            const expertFeatureKey = `expertsMap:${expertID}`;
            
            try {
                await redisClient.hSet(expertFeatureKey, {
                    expertID: expertID || '',
                    name: sanitizeString(relatedExpert.name) || '',
                    expertURL: relatedExpert.url || '',
                    title: 'Temp Professor' || '',
                    email: 'fake.email@blah.com' || '',
                    pronouns: 'they/them' || '',
                    organization: relatedExpert.organization || '',
                    works: workID === '[]' ? '[]' : JSON.stringify([workID]),
                    grants: grantID === '[]' ? '[]' : JSON.stringify([grantID]),
                    location: locationID === '[]' ? '[]' : JSON.stringify([locationID]),
                });
                processedExperts.set(expertName, expertID);
                // console.log(`👩‍🏫 Expert ${expertName} and ExpertID: ${expertID} added to processed experts.`); // Log the expert name for debugging
                // console.log(`👩‍🏫 Successfully stored ${expertFeatureKey}!`);
            } catch (error) {
                console.error(`❌ Error storing ${expertFeatureKey}`, error);
            }
            if (workID != '[]'){
                const workFeatureKey = `worksMap:${workID}`;
                const existingRelatedExperts = await redisClient.hGet(workFeatureKey, 'relatedExperts');
                const relatedExpertsInCurrWork = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];

                if (!relatedExpertsInCurrWork.includes(expertID)) {
                    relatedExpertsInCurrWork.push(expertID);
                    await redisClient.hSet(workFeatureKey, {
                        relatedExperts: JSON.stringify(relatedExpertsInCurrWork),
                    });
                    // console.log(`👩‍🏫 Successfully added expert ${expertID} to work${workID}!`);
                } 
            }
            else if (grantID != '[]'){
                const grantFeatureKey = `grantsMap:${grantID}`;
                const existingRelatedExperts = await redisClient.hGet(grantFeatureKey, 'relatedExpert');
                const relatedExpertsInCurrWork = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];

                if (!relatedExpertsInCurrWork.includes(expertID)) {
                    relatedExpertsInCurrWork.push(expertID);
                    await redisClient.hSet(grantFeatureKey, {
                        relatedExperts: JSON.stringify(relatedExpertsInCurrWork),
                    });
                    // console.log(`👩‍🏫 Successfully added expert ${expertID} to work${grantID}!`);
                } 
            }
        return expertID;
    }
    
    async function handleRepeatExpert(expertName, workID, locationID, grantID) {
        // Get the expert's ID and Redis key
        const expertID = processedExperts.get(expertName);
        // console.log(`👩‍🏫 Repeat expert ID: ${expertID}`);
        const expertFeatureKey = `expertsMap:${expertID}`;

        // check if grantID is not '0000' (indicating a grant)
        if(grantID != '[]'){
            console.log(`👩‍🏫 Handling repeat expert ${expertName} for grant ${grantID}...`);
            const exisitngGrants = await redisClient.hGet(expertFeatureKey, 'grants');
            const grantListInExpert = exisitngGrants ? JSON.parse(exisitngGrants) : [];
            if (!grantListInExpert.includes(grantID)) {
                grantListInExpert.push(grantID);
                await redisClient.hSet(expertFeatureKey, {
                    grants: JSON.stringify(grantListInExpert),
                });
                // console.log(`📜 Successfully added grant ${grantID} to expert ${expertFeatureKey}!`);
            }
        }
        else if (workID != '[]'){
            // Fetch the current works and locations from Redis
            // console.log(`👩‍🏫 Handling repeat expert ${expertName} for work ${workID}...`);
            const existingWorks = await redisClient.hGet(expertFeatureKey, 'works');
            const workListInExpert = existingWorks ? JSON.parse(existingWorks) : [];
            // Add the new workID if it doesn't already exist
            if (!workListInExpert.includes(workID)) {
                workListInExpert.push(workID);
                await redisClient.hSet(expertFeatureKey, {
                    works: JSON.stringify(workListInExpert),
                });
                // console.log(`📜 Successfully added work ${workID} to expert ${expertFeatureKey}!`);
            }
        }

        const existingLocations = await redisClient.hGet(expertFeatureKey, 'location');
        const locationListInExpert = existingLocations ? JSON.parse(existingLocations) : [];
        // Add the new locationID if it doesn't already exist
        if (!locationListInExpert.includes(locationID)) {
            locationListInExpert.push(locationID);
            await redisClient.hSet(expertFeatureKey, {
                location: JSON.stringify(locationListInExpert),
            });
            // console.log(`📍 Successfully added location ${locationID} to expert ${expertFeatureKey}!`);
            }
    // console.log(expertID);    
    return expertID; // Return the expert ID for further processing if needed
}
    async function updateLocationField(locationFeatureKey, field, id) {
        // Fetch the current field data from Redis
        const existingData = await redisClient.hGet(locationFeatureKey, field);
        const dataInLocation = existingData ? JSON.parse(existingData) : [];

        // Add the new ID if it doesn't already exist
        if (!dataInLocation.includes(id)) {
            dataInLocation.push(id);
            await redisClient.hSet(locationFeatureKey, {
                [field]: JSON.stringify(dataInLocation),
            });
            // console.log(`✅ Successfully added ${id} to ${field} in location ${locationFeatureKey}!`);
        }
}
    async function processGrantGeoJSON(filePath) {
    console.log(`📂 Reading GeoJSON file from: ${filePath}`);
    const geoData = await fs.readFile(filePath, 'utf8');
    const GeoJson = JSON.parse(geoData);
    console.log(`📊 Parsed GeoJSON data. Number of features/locations: ${GeoJson.features.length}`);

    for (const feature of GeoJson.features) {
        const { geometry, properties } = feature;
        const { coordinates, type: geometryType } = geometry;
        const { entries, location, display_name } = properties;

        // console.log(`📍 Processing feature with location: ${location}, display name: ${display_name}`);
        const locationName = location || ''; // Use the location name if available
        const locationID = await getOrCreateLocation(locationName, display_name, geometryType, coordinates);

        for (const entry of entries) {
            const grantTitle = sanitizeString(entry.title) || ''; // Sanitize the grant title
            // console.log(`📜 Processing grant entry with title: ${grantTitle}`);
            // repeat grant
            if (processedGrants.has(grantTitle)) {
                console.log(`📜 grant ${grantTitle} already processed. Handling repeat...`);
                const grantID = await handleRepeatGrant(grantTitle, locationID); // Handle repeat grant
                await updateLocationField(`locationMap:${locationID}`, 'grants', grantID); // Update the location with the new expert ID
                // check if new locationID has the same expertID as this repeat grant
                const expertName = sanitizeString(entry.relatedExpert.name) || '';
                if (Array.isArray(entry.relatedExpert)) {
                    console.log(`⚠️ [UNUSUAL ACTIVITY] Found ${entry.relatedExpert.length} related experts for grant: ${grantTitle}`);
                    for (const relatedExpert of entry.relatedExpert) {
                        if(processedExperts.has(expertName)){
                            console.log(`👩‍🏫 Expert ${expertName} already processed. Handling repeat expert...`);
                            const repeatExpertID = await handleRepeatExpert(expertName, '[]' , locationID, grantID); // Handle repeat expert
                            await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', repeatExpertID); // Update the location with the new expert ID
                        }
                        else if (entry.relatedExpert.name){
                            // this event should not happen, but if it does, we need to handle it
                            console.log(`⚠️ [UNUSUAL ACTIVITY] Expert ${entry.relatedExpert.name} not processed yet. Storing new expert.`);
                            
                            let expertID; // Default expert ID if not found
                            
                            const expertName = sanitizeString(entry.relatedExpert.name) || '';
                            const expertURL = entry.relatedExpert.url || '';
                            const relatedExpert = { name: expertName, url: expertURL };
                            // Handle a new expert
                            try {
                                expertID = await newExpertHash(expertName, relatedExpert, '[]', grantID, locationID);
                                await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                                } catch (error) {
                                    console.error(`❌ Error storing new expert ${expertName}:`, error);
                                }
                        }
                    }
                }
                else if(processedExperts.has(expertName)){
                    console.log(`👩‍🏫 Expert ${expertName} already processed. Handling repeat expert...`);
                    const repeatExpertID = await handleRepeatExpert(expertName, '[]' , locationID, grantID); // Handle repeat expert
                    await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', repeatExpertID); // Update the location with the new expert ID
                }
                else if (expertName){
                    // this event should not happen, but if it does, we need to handle it
                    console.log(`⚠️ [UNUSUAL ACTIVITY] Expert ${entry.relatedExpert.name} not processed yet. Storing new expert.`);
                    
                    let expertID; // Default expert ID if not found
                    
                    const expertName = sanitizeString(entry.relatedExpert.name) || '';
                    const expertURL = entry.relatedExpert.url || '';
                    const relatedExpert = { name: expertName, url: expertURL };
                    // Handle a new expert
                    try {
                        expertID = await newExpertHash(expertName, relatedExpert, '[]', grantID, locationID);
                        await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                        } catch (error) {
                            console.error(`❌ Error storing new expert ${expertName}:`, error);
                        }
                }
                else {
                    console.log(`👩‍🏫 No related experts found for grant: ${grantTitle}`);
                }
            }
            else {
                // new grant
                const grantID = await newGrantHash(grantTitle, entry, locationID);
                await updateLocationField(`locationMap:${locationID}`, 'grants', grantID); // Update the location with the new expert ID
                if (Array.isArray(entry.relatedExpert)) {
                    console.log(`⚠️ [UNUSAL ACTIVITY] Found ${entry.relatedExpert.length} related experts for grant: ${grantTitle}`);
                    
                    const relatedExpertIDs = []; // Collect expert IDs for this grant

                    // usually a grant will have one expert, but it is possible to have multiple    
                    for (const relatedExpert of entry.relatedExpert) {
                        const expertName = sanitizeString(relatedExpert.name) || '';
                        // console.log(`👩‍🏫 Processing expert: ${expertName}`);
        
                        let expertID; // Default expert ID if not found
                        if (processedExperts.has(expertName)) {
                            console.log(`👩‍🏫 Expert ${expertName} already processed. Handling repeat expert...`);
                            // Handle the repeat expert
                            expertID = await handleRepeatExpert(expertName, '[]', locationID, grantID);
                            await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID

                        } else {
                            // console.log(`👩‍🏫 Expert ${expertName} not processed yet. Storing new expert.`);
                            // Handle a new expert
                            try {
                                expertID = await newExpertHash(expertName, relatedExpert, '[]', grantID, locationID);
                                await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                            } catch (error) {
                                console.error(`❌ Error storing new expert ${expertName}:`, error);
                            }
                            }
                            if(!relatedExpertIDs.includes(expertID)){
                            relatedExpertIDs.push(String(expertID));
                            // console.log(`🆔 Added expert ID ${expertID} to relatedExpertIDs: ${relatedExpertIDs}`);
                            }
                        }

                    const grantFeatureKey = `grantsMap:${grantID}`;
                    const existingRelatedExperts = await redisClient.hGet(grantFeatureKey, 'relatedExpert');
                    const relatedExpertsInCurrgrant = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];
                    // console.log(`👩‍🏫 Related experts in current grant: ${relatedExpertsInCurrgrant}`);
                    if (Array.isArray(relatedExpertIDs) && relatedExpertIDs.length > 0) {
                        console.log(`⚠️ [UNUSUAL ACTIVITY] Found ${relatedExpertIDs.length} related experts for grant: ${grantTitle}`);
                        for (const expert_ID of relatedExpertIDs) {
                        // Add each expert ID to the relatedExperts field in the grant's hash key
                        if (!relatedExpertsInCurrgrant.includes(expert_ID)) {
                            relatedExpertsInCurrgrant.push(expert_ID);
                            // console.log(`👩‍🏫 Successfully added expert ID ${expert_ID} to grant${grantFeatureKey}`);
                            }
                        }
                        try {
                            await redisClient.hSet(grantFeatureKey, {
                                relatedExperts: JSON.stringify(relatedExpertsInCurrgrant),
                                });
                            }
                            catch (error) {
                                console.error(`❌ Error updating relatedExperts for ${grantFeatureKey}:`, error);
                            }
                        }
                    else {
                        console.error(`❌ relatedExpertIDs is not an array:`, relatedExpertIDs);
                    }
                    // console.log(`👩‍🏫 Successfully updated relatedExperts for ${grantFeatureKey}:`, relatedExpertIDs);
                } 
                else if (entry.relatedExpert.name){
                    // console.log(`👩‍🏫 Found 1 related expert for grant: ${grantTitle}`);
                    let relatedExpertID = '';
                    const expertName = sanitizeString(entry.relatedExpert.name) || '';
                    const expertURL = entry.relatedExpert.url || '';
                    const relatedExpert = { name: expertName, url: expertURL };
                    // console.log(`👩‍🏫 Processing expert: ${expertName}`);       
                        
                    let expertID; // Default expert ID if not found
                    if (processedExperts.has(expertName)) {
                        console.log(`👩‍🏫 Expert ${expertName} already processed. Handling repeat expert...`);
                        // Handle the repeat expert
                        expertID = await handleRepeatExpert(expertName, '[]', locationID, grantID);
                        await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID

                    } else {
                        // console.log(`👩‍🏫 Expert ${expertName} not processed yet. Storing new expert.`);
                        // Handle a new expert
                        try {
                            expertID = await newExpertHash(expertName, relatedExpert, '[]', grantID, locationID);
                            await updateLocationField(`locationMap:${locationID}`, 'relatedExperts', expertID); // Update the location with the new expert ID
                        } catch (error) {
                            console.error(`❌ Error storing new expert ${expertName}:`, error);
                        }
                    }
                        relatedExpertID = String(expertID);
                        if (relatedExpertID) {
                            // console.log(`🆔 This grant has related expert ID: ${relatedExpertID}`);
                            const grantFeatureKey = `grantsMap:${grantID}`;
                            const existingRelatedExperts = await redisClient.hGet(grantFeatureKey, 'relatedExpert');
                            const relatedExpertsInCurrgrant = existingRelatedExperts ? JSON.parse(existingRelatedExperts) : [];
                            // console.log(`👩‍🏫 Related experts in current grant: ${relatedExpertsInCurrgrant}`);
                            if(!relatedExpertsInCurrgrant.includes(relatedExpertID)){
                                relatedExpertsInCurrgrant.push(relatedExpertID);
                                // console.log(`👩‍🏫 Successfully added expert ID ${relatedExpertID} to ${grantFeatureKey}`);
                                try {
                                    await redisClient.hSet(grantFeatureKey, {
                                        relatedExpert: JSON.stringify(relatedExpertID),
                                        });
                                    }
                                    catch (error) {
                                        console.error(`❌ Error updating relatedExperts for ${grantFeatureKey}:`, error);
                                    }    
                                }
                            }
                            else {
                                console.error(`❌ relatedExpertIDs is not an array:`, relatedExpertIDs);
                            }
                    }
                else {
                    console.log(`👩‍🏫 No related experts found for grant: ${grantID}`);
                } 
            }
        }
                
    }
    console.log(`✅ Finished processing GeoJSON file: ${filePath}`);
}
    async function handleRepeatGrant(grantTitle, locationID){
        // If this grant has been processed before and this is a new locationID, add the new locationID to the existing grant.
        // There shouldn't be multiple locationIDs for the same grant, but it is possible.
        // Since it is the same grant, we don't need to check for new experts.
        const grantID = processedGrants.get(grantTitle);
        const grantFeatureKey = `grantsMap:${grantID}`;
        const existingLocation = await redisClient.hGet(grantFeatureKey, 'location');
        const existingLocationIDs = existingLocation ? JSON.parse(existingLocation) : [];
            
        if (!existingLocationIDs.includes(locationID)) {
            existingLocationIDs.push(locationID);
            await redisClient.hSet(grantFeatureKey, {
                location: JSON.stringify(existingLocationIDs),
            });
            // console.log(`📍 Successfully added location ${locationID} to grant ${grantFeatureKey}!`);
        }
        return grantID; // Return the grant ID for further processing if needed
}
    async function newGrantHash(grantTitle, entry, locationID) {
        const grantID = generateID('grant');
        const grantFeatureKey = `grantsMap:${grantID}`;
            try {
                await redisClient.hSet(grantFeatureKey, {
                    grantID: grantID || '',
                    title: sanitizeString(entry.title) || '',
                    displayTitle: entry.name || '',
                    funder: entry.funder || '',
                    end_date: entry.endDate || '',
                    start_date: entry.startDate || '',
                    confidence: entry.confidence || '',
                    relatedExpert: '[]',
                    location: JSON.stringify([locationID]) || '[]',
                });
                processedGrants.set(grantTitle, grantID);
                // console.log(`📜 Grant ${grantTitle} and grantID: ${grantID} added to processed grants.`); // Log the grant title for debugging
                // console.log(`📜 Successfully stored ${grantFeatureKey}!`);
            } catch (error) {
                console.error(`❌ Error storing ${grantFeatureKey}`, error);
            }
        
        return grantID;  
}
    console.log(`\nDetailed log of the processWorkGeoJSON function below:\n`);
    await processWorkGeoJSON(path.join(__dirname, '../../components/features/workFeatures1.geojson'));
    console.log(`\nDetailed log of the processGrantGeoJSON function below:\n`);
    await processGrantGeoJSON(path.join(__dirname, '../../components/features/grantFeatures1.geojson'));
    // Log every locationMap, expertsMap, and worksMap entry
    // console.log('\n📋 Logging all Redis entries for locationMap..\n');

    const locationMapFilePath = path.join(__dirname, './testing/locationMap.txt');
    const locationMapData = [];

    for await (const key of redisClient.scanIterator({ MATCH: 'locationMap:*' })) {
        const locationData = await redisClient.hGetAll(key);
        locationMapData.push({ key, data: locationData });
        // console.log(`📍 ${key}:`, locationData);
    }
    const locationCounter = locationMapData.length;
    locationMapData.push({ totalLocations: locationCounter }); // Add the location count as a field
    console.log(`📊 Total number of locations: ${locationCounter}`);

    try {
        await fs.writeFile(locationMapFilePath, JSON.stringify(locationMapData, null, 2), 'utf8');
        console.log(`✅ Location map data written to ${locationMapFilePath}`);
    } catch (error) {
        console.error(`❌ Error writing location map data to file:`, error);
    }
    
    const expertsMapFilePath = path.join(__dirname, './testing/expertsMap.txt');
    const expertsMapData = [];

    for await (const key of redisClient.scanIterator({ MATCH: 'expertsMap:*' })) {
        const expertData = await redisClient.hGetAll(key);
        expertsMapData.push({ key, data: expertData });
        // console.log(`👩‍🏫 ${key}:`, expertData);
    }
    const expertCounter = expertsMapData.length;
    expertsMapData.push({ totalExperts: expertCounter }); // Add the expert count as a field
    console.log(`📊 Total number of experts: ${expertCounter}`);

    try {
        await fs.writeFile(expertsMapFilePath, JSON.stringify(expertsMapData, null, 2), 'utf8');
        console.log(`✅ Experts map data written to ${expertsMapFilePath}`);
    } catch (error) {
        console.error(`❌ Error writing experts map data to file:`, error);
    }
    const worksMapFilePath = path.join(__dirname, './testing/worksMap.txt');
    const worksMapData = [];

    for await (const key of redisClient.scanIterator({ MATCH: 'worksMap:*' })) {
        const workData = await redisClient.hGetAll(key);
        worksMapData.push({ key, data: workData });
        // console.log(`📜 ${key}:`, workData);
    }
    const workCounter = worksMapData.length;
    worksMapData.push({ totalWorks: workCounter }); // Add the work count as a field
    console.log(`📊 Total number of works: ${workCounter}`);

    try {
        await fs.writeFile(worksMapFilePath, JSON.stringify(worksMapData, null, 2), 'utf8');
        console.log(`✅ Works map data written to ${worksMapFilePath}`);
    } catch (error) {
        console.error(`❌ Error writing works map data to file:`, error);
    }
    const grantsMapFilePath = path.join(__dirname, './testing/grantsMap.txt');
    const grantsMapData = [];

    for await (const key of redisClient.scanIterator({ MATCH: 'grantsMap:*' })) {
        const grantData = await redisClient.hGetAll(key);
        grantsMapData.push({ key, data: grantData });
        // console.log(`📜 ${key}:`, grantData);
    }
    const grantsCounter = grantsMapData.length;
    grantsMapData.push({ totalGrants: grantsCounter }); // Add the grant count as a field
    console.log(`📊 Total number of grants: ${grantsCounter}`);

    try {
        await fs.writeFile(grantsMapFilePath, JSON.stringify(grantsMapData, null, 2), 'utf8');
        console.log(`✅ Grants map data written to ${grantsMapFilePath}`);
    } catch (error) {
        console.error(`❌ Error writing grants map data to file:`, error);
    }
}catch (error) {
    console.error('❌ Error populating Redis:', error);
} finally {
    await redisClient.quit(); // Close the Redis connection
    console.log('✅ Redis connection closed.');
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

