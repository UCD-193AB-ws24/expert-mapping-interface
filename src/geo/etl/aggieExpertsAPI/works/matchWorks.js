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
 * Creates a map of expert name variations to expert IDs
 * @param {Array} experts - List of experts
 * @returns {Object} - Maps containing expert data for lookups
 */
function prepareExpertMaps(experts) {
  const expertNameMap = new Map();
  const expertWorksMap = new Map();
  const expertsById = {};
  
  for (const expert of experts) {
    if (!expert?.fullName) continue;
    
    const expertId = expert.url ? extractExpertIdFromUrl(expert.url) : null;
    if (!expertId) continue;
    
    // Store expert by ID for easy lookup
    expertsById[expertId] = expert;
    
    // Create and store name variations
    const nameVariations = createNameVariations(expert.fullName);
    nameVariations.forEach(variation => {
      if (!expertNameMap.has(variation)) {
        expertNameMap.set(variation, []);
      }
      expertNameMap.get(variation).push(expertId);
    });
    
    // Initialize the expert's work list
    expertWorksMap.set(expertId, []);
  }
  
  return { expertNameMap, expertWorksMap, expertsById };
}

/**
 * Find experts matching an author name
 * @param {string} fullName - Author's full name
 * @param {Map} expertNameMap - Map of name variations to expert IDs
 * @returns {Array} - List of matching expert IDs
 */
function findMatchingExperts(fullName, expertNameMap) {
  const authorNameVariations = createNameVariations(fullName);
  const matchingExperts = new Set();
  
  // Check all name variations for matches
  for (const variation of authorNameVariations) {
    const experts = expertNameMap.get(variation) || [];
    experts.forEach(id => matchingExperts.add(id));
  }
  
  return Array.from(matchingExperts);
}

/**
 * Process a single work and find matching experts
 * @param {Object} work - Work data object
 * @param {Map} expertNameMap - Map of name variations to expert IDs
 * @param {Map} expertWorksMap - Map of expert IDs to their works
 * @param {Object} expertsById - Experts indexed by ID for quick lookup
 * @returns {Object} - Processing results
 */
function processWork(work, expertNameMap, expertWorksMap, expertsById) {
  // Extract work ID
  const workId = work.url ? extractExpertIdFromUrl(work.url) : work.id;
  if (!workId) return { skipped: true };
  
  // Parse authors
  const normalizedAuthors = parseAuthors(work.authors);
  if (normalizedAuthors.length === 0) return { skipped: true };
  
  // Track experts matched to this work
  const matchedExpertsForWork = new Set();
  let authorMatches = 0;
  
  // Process each author
  for (const author of normalizedAuthors) {
    if (!author.fullName) continue;
    
    // Find matching experts for this author
    const matchedExperts = findMatchingExperts(author.fullName, expertNameMap);
    
    // Record matches
    if (matchedExperts.length > 0) {
      authorMatches++;
      
      // Add the work to all matching experts
      for (const expertId of matchedExperts) {
        if (expertWorksMap.has(expertId)) {
          expertWorksMap.get(expertId).push(workId);
          matchedExpertsForWork.add(expertId);
        }
      }
    }
  }
  
  // If no experts matched, we're done
  if (matchedExpertsForWork.size === 0) return { 
    authorCount: normalizedAuthors.length,
    authorMatches,
    skipped: false 
  };
  
  // Create related experts array for this work
  const relatedExperts = Array.from(matchedExpertsForWork).map(expertId => {
    const expert = expertsById[expertId];
    return expert ? {
      id: expertId,
      firstName: expert.firstName || '',
      lastName: expert.lastName || '',
      fullName: `${expert.firstName || ''} ${expert.lastName || ''}`.trim(),
      url: expert.url || ''
    } : 'N/A';
  });
  
  // Return the work with its matched data
  return {
    workWithExperts: { ...work, relatedExperts },
    authorCount: normalizedAuthors.length,
    authorMatches,
    skipped: false
  };
}

/**
 * Save results to file
 * @param {Array} matchedWorks - Works with their matched experts
 */
function saveResults(matchedWorks) {
  const jsonDir = path.join(__dirname, 'json');
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }
  
  const matchedWorksPath = path.join(jsonDir, 'expertMatchedWorks.json');
  fs.writeFileSync(matchedWorksPath, JSON.stringify(matchedWorks, null, 2));
  console.log(`Matching complete. ${matchedWorks.length} matched works saved to ${matchedWorksPath}`);
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
    // Retrieve all experts and works from Redis
    const experts = providedExperts || await getCachedExperts();
    const works = await getCachedWorks();
    
    console.log(`Found ${experts.length} experts and ${works.length} works`);
    
    // Prepare expert data structures for efficient lookups
    const { expertNameMap, expertWorksMap, expertsById } = prepareExpertMaps(experts);
    
    // Process all works
    const matchedWorks = [];
    let matchCount = 0;
    let skippedCount = 0;
    let authorCount = 0;
    
    for (const work of works) {
      const result = processWork(work, expertNameMap, expertWorksMap, expertsById);
      
      if (result.skipped) {
        skippedCount++;
      } else {
        authorCount += result.authorCount || 0;
        matchCount += result.authorMatches || 0;
        
        if (result.workWithExperts) {
          matchedWorks.push(result.workWithExperts);
        }
      }
    }
    
    // Prepare result object with unique works per expert
    const result = {};
    let totalWorksMatched = 0;
    
    for (const [expertId, works] of expertWorksMap.entries()) {
      // Remove duplicate works
      const uniqueWorks = [...new Set(works)];
      result[expertId] = uniqueWorks;
      totalWorksMatched += uniqueWorks.length;
    }
    
    // Calculate experts with at least one work
    const expertsWithWorks = Object.keys(result).filter(
      expertId => result[expertId]?.length > 0
    ).length;
    
    console.log(`Successfully matched ${matchedWorks.length}/${works.length} works to ${expertsWithWorks} experts`);
    
    // Save the results to JSON file if requested
    if (saveToFile) {
      saveResults(matchedWorks);
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
  createNameVariations,
  extractExpertIdFromUrl
};

// Main execution
if (require.main === module) {
    matchWorks();
}