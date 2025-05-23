/**
 * @file fetchExpertProfiles.js
 * @description Fetches and processes expert profiles using IDs from CSV, including works and grants.
 * @usage Used as a module by persistExpertProfiles.js and other ETL scripts.
 *
 * Zoey Vo, 2025
 */

const fs = require('fs');
const path = require('path');
const { getExpertData } = require('./fetchProfileByID');

/**
 * Reads expert IDs from the CSV file and returns an array of IDs (without the 'expert/' prefix if needed)
 * @param {number} numExperts - Maximum number of experts to return
 * @returns {Array<string>} Array of expert IDs
 */
function readExpertIdsFromCSV(numExperts = 1) {
  const csvPath = path.join(__dirname, '../utils/expertIds.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  // Remove header and extract just the ID part (after 'expert/')
  const ids = lines.slice(1).map(line => line.replace(/^expert\//, '').trim());
  return ids.slice(0, numExperts);
}

/**
 * Main function to fetch and process expert profiles using IDs from CSV
 * @returns {Promise<Array>} - Array of expert profiles with their works and grants
 */
async function fetchExpertProfiles(numExperts=1, worksLimit=5, grantsLimit=5) {
  try {
    // Step 1: Get all expert IDs from CSV
    console.log('\nReading expert IDs from CSV...');
    const allExpertIds = readExpertIdsFromCSV(numExperts);
    
    // Step 2: Get detailed profile for each expert
    console.log('\nFetching associated profiles...');
    const expertProfiles = [];
    
    for (let i = 0; i < allExpertIds.length; i++) {
      const expertId = allExpertIds[i];

      try {
        // Get detailed data with works and grants
        const expertData = await getExpertData(expertId, worksLimit, grantsLimit);
          // Add to profiles collection
        expertProfiles.push(expertData);
        
        // Log progress for every 1000 experts (but not for 0)
        if (expertProfiles.length % 1000 === 0 && expertProfiles.length > 0) {
          console.log(`[fetched ${expertProfiles.length} experts]`);
        }
      } catch (error) {
        console.error(`❌ Error fetching profile for expert ${expertId}:`, error.message);
        // Continue with the next expert
      }
    }
    
    console.log(`✅ Successfully fetched ${expertProfiles.length} expert profiles`);
    return expertProfiles;
    
  } catch (error) {
    console.error('❌ Error in fetchAllExpertProfiles:', error);
    throw error;
  }
}

module.exports = { fetchExpertProfiles };