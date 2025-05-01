const fs = require('fs');
const path = require('path');
const { getCachedExperts } = require('../redis/expertCache');
const { getCachedWorks } = require('../redis/workCache');

/**
 * Creates name variations for matching author names with expert names
 * @param {string} fullName - The full name to create variations for
 * @returns {Array} - Array of name variations
 */
function createNameVariations(fullName) {
  if (!fullName) return [];
  
  // Remove any non-alphanumeric characters except spaces and dots
  const cleanedName = fullName.replace(/[^\w\s.-]/g, '').trim();
  
  // Split the name into parts
  const nameParts = cleanedName.split(/\s+/);
  const variations = [];
  
  // Add the full name as is
  variations.push(cleanedName.toLowerCase());
  
  // If we have at least first and last name
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    
    // For middle names (if any)
    if (nameParts.length > 2) {
      // Get all middle names
      const middleNames = nameParts.slice(1, -1);
      
      // Create variations with middle initials
      // Example: "John L Smith"
      variations.push(`${firstName} ${middleNames.map(name => name[0]).join(' ')} ${lastName}`.toLowerCase());
      
      // Create variations with middle initials with dots
      // Example: "John L. Smith"
      variations.push(`${firstName} ${middleNames.map(name => name[0] + '.').join(' ')} ${lastName}`.toLowerCase());
    }
    
    // Add first and last name only
    variations.push(`${firstName} ${lastName}`.toLowerCase());
  }
  
  return [...new Set(variations)]; // Remove any duplicates
}

/**
 * Normalizes author data to ensure consistent structure
 * @param {Object|string} authorData - Author data which could be an object or string
 * @returns {Object} - Normalized author object with fullName property
 */
function normalizeAuthorData(authorData) {
  // If author is a string, create an author object
  if (typeof authorData === 'string') {
    return { fullName: authorData };
  }
  
  // If author is already an object with fullName, return it
  if (authorData && typeof authorData === 'object' && authorData.fullName) {
    return authorData;
  }
  
  // If author is an object but missing fullName, try to construct it
  if (authorData && typeof authorData === 'object') {
    const firstName = authorData.firstName || authorData.first_name || '';
    const middleName = authorData.middleName || authorData.middle_name || '';
    const lastName = authorData.lastName || authorData.last_name || '';
    
    if (firstName || lastName) {
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      return { ...authorData, fullName };
    }
  }
  
  // Return empty object if we can't normalize
  return { fullName: '' };
}

/**
 * Parse author data from Redis which might be stored as a JSON string
 * @param {string|Array} authors - Authors data from Redis
 * @returns {Array} - Normalized array of author objects
 */
function parseAuthors(authors) {
  if (!authors) {
    return [];
  }
  
  // If authors is a string, try to parse it as JSON
  if (typeof authors === 'string') {
    try {
      const parsedAuthors = JSON.parse(authors);
      
      // Handle array of strings or array of objects
      if (Array.isArray(parsedAuthors)) {
        return parsedAuthors.map(normalizeAuthorData);
      }
      
      // Handle single object
      return [normalizeAuthorData(parsedAuthors)];
    } catch (e) {
      // If parsing fails, treat the string as a single author name
      return [{ fullName: authors }];
    }
  }
  
  // If authors is already an array, normalize each entry
  if (Array.isArray(authors)) {
    return authors.map(normalizeAuthorData);
  }
  
  // If authors is an object, treat it as a single author
  if (typeof authors === 'object') {
    return [normalizeAuthorData(authors)];
  }
  
  return [];
}

/**
 * Creates expert name maps for efficient lookups
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Object containing maps for expert lookups
 */
function prepareExpertMaps(experts) {
  const expertNameMap = new Map();
  const expertWorksMap = new Map();
  const expertsById = {};
  
  for (const expert of experts) {
    if (!expert?.fullName) continue;
    
    const expertId = expert.url ? extractExpertIdFromUrl(expert.url) : null;
    if (!expertId) continue;
    
    // Store expert by ID and initialize work list
    expertsById[expertId] = expert;
    expertWorksMap.set(expertId, []);
    
    // Create and store name variations
    const nameVariations = createNameVariations(expert.fullName);
    for (const variation of nameVariations) {
      if (!expertNameMap.has(variation)) {
        expertNameMap.set(variation, []);
      }
      expertNameMap.get(variation).push(expertId);
    }
  }
  
  return { expertNameMap, expertWorksMap, expertsById };
}

/**
 * Find matching experts for an author name
 * @param {string} authorName - Author's name
 * @param {Map} expertNameMap - Map of name variations to expert IDs
 * @returns {Array} Array of matching expert IDs
 */
function findMatchingExperts(authorName, expertNameMap) {
  const authorVariations = createNameVariations(authorName);
  const matchedExperts = new Set();
  
  for (const variation of authorVariations) {
    const experts = expertNameMap.get(variation) || [];
    for (const expertId of experts) {
      matchedExperts.add(expertId);
    }
  }
  
  return Array.from(matchedExperts);
}

/**
 * Format expert data for output
 * @param {string} expertId - Expert ID
 * @param {Object} expertsById - Map of expert IDs to expert objects
 * @returns {Object} Formatted expert data
 */
function formatExpertForOutput(expertId, expertsById) {
  const expert = expertsById[expertId];
  if (!expert) return null;
  
  return {
    id: expertId,
    firstName: expert.firstName || '',
    lastName: expert.lastName || '',
    fullName: `${expert.firstName || ''} ${expert.lastName || ''}`.trim(),
    url: expert.url || ''
  };
}

/**
 * Match works with experts based on author names
 * @param {Object} options - Configuration options
 * @returns {Object} Map of expert IDs to their matched works
 */
async function matchWorks(options = {}) {
  const {
    saveToFile = true,
    experts: providedExperts = null,
  } = options;

  console.log("Starting to match works with experts...");
  
  try {
    // Retrieve all experts and works
    const experts = providedExperts || await getCachedExperts();
    const works = await getCachedWorks();
    
    console.log(`Found ${experts.length} experts and ${works.length} works`);
    
    // Prepare data structures for efficient lookups
    const { expertNameMap, expertWorksMap, expertsById } = prepareExpertMaps(experts);
    
    // Process works
    const matchedWorks = [];
    let matchCount = 0;
    let skippedCount = 0;
    let authorCount = 0;
    
    for (const work of works) {
      // Extract work ID
      const workId = work.url ? extractExpertIdFromUrl(work.url) : work.id;
      if (!workId) {
        skippedCount++;
        continue;
      }
      
      // Parse authors
      const authors = parseAuthors(work.authors);
      if (authors.length === 0) {
        skippedCount++;
        continue;
      }
      
      // Track experts matched to this work
      const matchedExpertsForWork = new Set();
      authorCount += authors.length;
      
      // For each author, find matching experts
      for (const author of authors) {
        if (!author.fullName) continue;
        
        const matchedExpertIds = findMatchingExperts(author.fullName, expertNameMap);
        
        if (matchedExpertIds.length > 0) {
          matchCount++;
          
          // Add the work to each matching expert
          for (const expertId of matchedExpertIds) {
            if (expertWorksMap.has(expertId)) {
              expertWorksMap.get(expertId).push(workId);
              matchedExpertsForWork.add(expertId);
            }
          }
        }
      }
      
      // If work matched any experts, add to results
      if (matchedExpertsForWork.size > 0) {
        const relatedExperts = Array.from(matchedExpertsForWork)
          .map(expertId => formatExpertForOutput(expertId, expertsById))
          .filter(Boolean);
        
        matchedWorks.push({ ...work, relatedExperts });
      }
    }
    
    // Deduplicate works for each expert
    const result = {};
    let totalWorksMatched = 0;
    
    for (const [expertId, works] of expertWorksMap.entries()) {
      const uniqueWorks = [...new Set(works)];
      result[expertId] = uniqueWorks;
      totalWorksMatched += uniqueWorks.length;
    }
    
    // Count experts with works
    const expertsWithWorks = Object.keys(result).filter(
      expertId => result[expertId]?.length > 0
    ).length;
    
    console.log(`Successfully matched ${matchedWorks.length}/${works.length} works to ${expertsWithWorks} experts`);
    
    // Save results to file if requested
    if (saveToFile) {
      const jsonDir = path.join(__dirname, 'json');
      if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
      }
      
      const matchedWorksPath = path.join(jsonDir, 'expertMatchedWorks.json');
      fs.writeFileSync(matchedWorksPath, JSON.stringify(matchedWorks, null, 2));
      console.log(`Matching complete. ${matchedWorks.length} matched works saved to ${matchedWorksPath}`);
    }
    
    return {
      expertWorksMap: result,
      matchedWorks,
      matchCount,
      skippedCount,
      totalWorksMatched,
      expertsWithWorks,
      totalProcessed: works.length
    };
    
  } catch (error) {
    console.error("Error matching works with experts:", error);
    throw error;
  }
}

/**
 * Extract the expert ID from a URL
 * @param {string} url - The URL to extract from
 * @returns {string|null} - The extracted expert ID or null if not found
 */
function extractExpertIdFromUrl(url) {
  if (!url) return null;
  
  // Check for "expert/ID" pattern
  const expertMatch = url.match(/expert\/([^\/\s]+)/);
  if (expertMatch) return expertMatch[1];
  
  // Check for "wX" work ID pattern
  if (/^w\d+$/.test(url)) return url;
  
  // Fallback: get the last segment of the URL
  const lastSegment = url.split('/').pop();
  return lastSegment || null;
}

module.exports = {
  matchWorks,
};

// Main execution
if (require.main === module) {
    matchWorks();
}