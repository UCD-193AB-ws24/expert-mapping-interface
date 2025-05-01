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
  if (expertMatch && expertMatch[1]) return expertMatch[1];
  
  // Fallback: Extract the last part of the URL
  return url.split('/').pop() || null;
}

/**
 * Match grants with experts based on the inheresIn URL
 * @param {Object} options - Configuration options
 * @returns {Object} Result object with matching data
 */
async function matchGrants(options = {}) {
  const { saveToFile = true, experts: providedExperts = null } = options;

  console.log("Starting to match grants with experts...");
  
  try {
    // Retrieve experts and grants
    const experts = providedExperts || await getCachedExperts();
    const grants = await getCachedGrants();
    
    console.log(`Found ${experts.length} experts and ${grants.length} grants`);
    
    // Maps for tracking relationships
    const expertIdMap = new Map();
    const expertGrantsMap = {};
    const expertsById = {};
    
    // Process all experts
    for (const expert of experts) {
      if (!expert?.url) continue;
      
      const expertId = extractExpertIdFromUrl(expert.url);
      if (!expertId) continue;
      
      expertIdMap.set(expertId, expertId);
      expertsById[expertId] = expert;
      expertGrantsMap[expertId] = [];
    }
    
    // Process all grants
    let matchCount = 0;
    let skippedCount = 0;
    const matchedGrants = [];
    
    for (const grant of grants) {
      if (!grant?.inheresIn || !grant.id) {
        skippedCount++;
        continue;
      }
      
      const matchedExpertId = extractExpertIdFromUrl(grant.inheresIn);
      
      // Skip if no match found
      if (!matchedExpertId || !expertIdMap.has(matchedExpertId)) {
        skippedCount++;
        continue;
      }

      // Add grant to expert's list
      expertGrantsMap[matchedExpertId].push(grant.id);
      matchCount++;
      
      // Format the expert data for output
      const matchedExpert = expertsById[matchedExpertId];
      const relatedExpert = matchedExpert ? {
        id: matchedExpertId,
        firstName: matchedExpert.firstName || '',
        lastName: matchedExpert.lastName || '',
        fullName: `${matchedExpert.firstName || ''} ${matchedExpert.lastName || ''}`.trim(),
        url: matchedExpert.url || ''
      } : 'N/A';
      
      // Add to matched results
      matchedGrants.push({ ...grant, relatedExpert });
    }
    
    console.log(`Successfully matched ${matchedGrants.length}/${grants.length} grants to experts (${skippedCount} grants with no associated expert)`);
    
    // Count experts with at least one grant
    const expertsWithGrants = Object.keys(expertGrantsMap).filter(id => 
      expertGrantsMap[id]?.length > 0
    ).length;
    
    // Save results if requested
    if (saveToFile) {
      const jsonDir = path.join(__dirname, 'json');
      if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });
      
      const outputPath = path.join(jsonDir, 'expertMatchedGrants.json');
      fs.writeFileSync(outputPath, JSON.stringify(matchedGrants, null, 2));
      console.log(`Matching complete. ${matchedGrants.length} matched grants saved to ${outputPath}`);
    }
    
    return {
      expertGrantsMap,
      matchedGrants,
      matchCount,
      skippedCount,
      expertsWithGrants,
      totalProcessed: grants.length
    };
    
  } catch (error) {
    console.error("Error matching grants with experts:", error);
    throw error;
  }
}

if (require.main === module) {
    matchGrants();
}

module.exports = { matchGrants };