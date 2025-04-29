const fs = require('fs');
const path = require('path');
const { getCachedExperts } = require('../redis/expertCache');
const { getCachedGrants } = require('../redis/grantCache');

/**
 * Extract the expert ID from a URL
 * @param {string} url - The URL to extract from
 * @returns {string|null} - The extracted expert ID or null if not found
 */
function extractExpertIdFromUrl(url) {
  if (!url) return null;
  
  // Extract ID from URL patterns like "expert/83x5AQ8a"
  const expertMatch = url.match(/expert\/([^\/\s]+)/);
  if (expertMatch && expertMatch[1]) {
    return expertMatch[1];
  }
  
  // Fallback: Extract the last part of the URL which should be the ID
  const parts = url.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Match grants with experts based on the inheresIn URL
 * @param {Object} options - Configuration options
 * @returns {Object} Map of expert IDs to their matched grants
 */
async function matchGrants(options = {}) {
  const {
    saveToFile = true,
    experts: providedExperts = null,
  } = options;

  console.log("Starting to match grants with experts...");
  
  try {
    // Retrieve all experts and grants from Redis
    const experts = providedExperts || await getCachedExperts();
    const grants = await getCachedGrants();
        
    // Create a map to store expert URLs mapped to expert IDs
    const expertUrlMap = new Map();
    const expertIdMap = new Map();
    
    // Create a map to store expert IDs mapped to their grants
    const expertGrantsMap = {};
    
    // Create map to store experts by their ID for quicker lookups
    const expertsById = {};
    
    // Process all experts
    for (const expert of experts) {
      if (expert && expert.url) {
        // Extract expert ID from URL
        const expertId = extractExpertIdFromUrl(expert.url);
        if (!expertId) continue;
        
        // Store the expert ID for mapping
        expertUrlMap.set(expert.url, expertId);
        expertIdMap.set(expertId, expertId);
        
        // Store the expert by ID for easy lookup
        expertsById[expertId] = expert;
        
        // Initialize the expert's grant list
        expertGrantsMap[expertId] = [];
      }
    }
    
    let matchCount = 0;
    let skippedCount = 0;
    
    // Store matched grants with their related experts
    const matchedGrants = [];
    
    // Process all grants
    for (const grant of grants) {
      if (!grant || !grant.inheresIn) {
        skippedCount++;
        continue;
      }
      
      // Use the grant's ID from Redis (should be in gX format)
      const grantId = grant.id || '';
      if (!grantId) {
        skippedCount++;
        continue;
      }
      
      // Extract expert ID from the inheresIn property
      const expertIdFromUrl = extractExpertIdFromUrl(grant.inheresIn);
      
      // Skip if we can't extract an expert ID
      if (!expertIdFromUrl) {
        skippedCount++;
        continue;
      }
      
      let matchedExpertId = null;
      
      // Try direct match with expert ID - this is the most likely match
      if (expertIdMap.has(expertIdFromUrl)) {
        matchedExpertId = expertIdMap.get(expertIdFromUrl);
        expertGrantsMap[matchedExpertId].push(grantId);
        matchCount++;
      } else {
        // If direct match fails, try looking for expert IDs in the inheresIn URL
        let matched = false;
        for (const expertId of expertIdMap.keys()) {
          if (grant.inheresIn.includes(expertId)) {
            matchedExpertId = expertId;
            expertGrantsMap[expertId].push(grantId);
            matchCount++;
            matched = true;
            break;
          }
        }
        
        if (!matched) {
          skippedCount++;
          continue; // Skip to next grant if no match found
        }
      }
      
      // Only add grants that were successfully matched
      if (matchedExpertId) {
        // Get the matched expert
        const matchedExpert = expertsById[matchedExpertId];
        
        // Format the expert data
        const relatedExpert = matchedExpert ? {
          id: matchedExpertId,
          firstName: matchedExpert.firstName || '',
          lastName: matchedExpert.lastName || '',
          fullName: `${matchedExpert.firstName || ''} ${matchedExpert.lastName || ''}`.trim(),
          url: matchedExpert.url || ''
        } : 'N/A';
        
        // Add the grant with related expert to the output array
        matchedGrants.push({
          ...grant,
          relatedExpert
        });
      }
    }
    
    console.log(`Successfully matched ${matchCount} grants to experts (${skippedCount} grants skipped)`);
    
    // Count experts with at least one grant
    const expertsWithGrants = Object.keys(expertGrantsMap).filter(expertId => 
      expertGrantsMap[expertId] && expertGrantsMap[expertId].length > 0
    ).length;
    console.log(`Experts with at least one grant: ${expertsWithGrants} of ${experts.length}`);
    
    // Save the results to a JSON file if requested
    if (saveToFile) {
      const jsonDir = path.join(__dirname, 'json');
      if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
      }
      
      // Save only matched grants with their related experts
      const outputPath = path.join(jsonDir, 'matchedGrants.json');
      fs.writeFileSync(outputPath, JSON.stringify(matchedGrants, null, 2));
      
      // Also save the expert-to-grants mapping for reference
      const mappingPath = path.join(jsonDir, 'expertMatchedGrants.json');
      fs.writeFileSync(mappingPath, JSON.stringify(expertGrantsMap, null, 2));
      
      console.log(`Matching complete. ${matchedGrants.length} matched grants saved to ${outputPath}`);
      console.log(`Expert-to-grants mapping saved to ${mappingPath}`);
    }
    
    return {
      expertGrantsMap,
      matchedGrants,
      matchCount,
      skippedCount,
      expertsWithGrants
    };
    
  } catch (error) {
    console.error("Error matching grants with experts:", error);
    throw error;
  }
}

module.exports = {
  matchGrants,
  extractExpertIdFromUrl
};

// Main execution
if (require.main === module) {
    matchGrants();
}