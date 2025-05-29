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
function readExpertIdsFromCSV(numExperts) {
  // Use test-expected file name and encoding
  const csvPath = path.join(__dirname, '../utils/expert_ids.csv');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  // Remove header, parse only first column, trim, skip empty
  let ids = lines.slice(1)
    .map(line => line.split(',')[0].replace(/^expert\//, '').trim())
    .filter(id => id.length > 0);
  // Treat 0, negative, or non-numeric as 'no limit'
  if (!numExperts || isNaN(numExperts) || numExperts <= 0) return ids;
  return ids.slice(0, numExperts);
}

/**
 * Main function to fetch and process expert profiles using IDs from CSV
 * @returns {Promise<Array>} - Array of expert profiles with their works and grants
 */
async function fetchExpertProfiles(numExperts, worksLimit=5, grantsLimit=5) {
  try {
    // Step 1: Get all expert IDs from CSV
    console.log('\nReading expert IDs from CSV...');
    const allExpertIds = readExpertIdsFromCSV(numExperts);
    if (!allExpertIds || allExpertIds.length === 0) return [];
    // Step 2: Get detailed profile for each expert (concurrently)
    console.log('\nFetching associated profiles...');
    const results = await Promise.allSettled(
      allExpertIds.map(expertId =>
        getExpertData(expertId, worksLimit, grantsLimit)
      )
    );
    const expertProfiles = [];
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value) {
        expertProfiles.push(res.value);
      } else if (res.status === 'rejected') {
        console.error(`❌ Error fetching profile for expert ${allExpertIds[idx]}:`, res.reason && res.reason.message ? res.reason.message : res.reason);
      }
    });
    console.log(`✅ Successfully fetched ${expertProfiles.length} expert profiles`);
    return expertProfiles;
  } catch (error) {
    console.error('❌ Error in fetchAllExpertProfiles:', error);
    throw error;
  }
}

module.exports = { fetchExpertProfiles };