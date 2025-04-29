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
 * Debug function to log name matching information
 * @param {string} authorName - The author name being matched
 * @param {Array} variations - Name variations generated for the author
 * @param {Array} matchedExperts - The experts matched with this author
 */
function debugNameMatch(authorName, variations, matchedExperts) {
  console.log(`\n=== NAME MATCHING DEBUG ===`);
  console.log(`Original author name: "${authorName}"`);
  console.log(`Generated variations (${variations.length}):`);
  variations.forEach((v, i) => console.log(`  ${i+1}. "${v}"`));
  
  console.log(`Matched experts (${matchedExperts.length}):`);
  if (matchedExperts.length > 0) {
    matchedExperts.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log(`  No matches found`);
  }
  console.log(`=== END NAME MATCHING DEBUG ===\n`);
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
 * Match works with experts based on author names
 * @param {Object} options - Configuration options
 * @returns {Object} Map of expert IDs to their matched works
 */
async function matchWorks(options = {}) {
  const {
    saveToFile = true,
    updateRedis = false,
    experts: providedExperts = null,
    debug = false
  } = options;

  console.log("Starting to match works with experts...");
  
  try {
    // Retrieve all experts and works from Redis
    const experts = providedExperts || await getCachedExperts();
    const works = await getCachedWorks();
    
    console.log(`Found ${experts.length} experts and ${works.length} works`);
    
    // Create a map to store expert name variations
    const expertNameMap = new Map();
    
    // Create a map to store expert IDs mapped to their works
    const expertWorksMap = new Map();
    
    // Store experts by ID for quick lookup
    const expertsById = {};
    
    // Process all experts and create name variations
    for (const expert of experts) {
      if (expert && expert.fullName) {
        // Extract expert ID from URL
        const expertId = expert.url ? extractExpertIdFromUrl(expert.url) : null;
        if (!expertId) continue;
        
        // Store expert by ID for easy lookup
        expertsById[expertId] = expert;
        
        const nameVariations = createNameVariations(expert.fullName);
        
        // Store all name variations for this expert
        nameVariations.forEach(variation => {
          if (!expertNameMap.has(variation)) {
            expertNameMap.set(variation, []);
          }
          expertNameMap.get(variation).push(expertId);
        });
        
        // Initialize the expert's work list
        expertWorksMap.set(expertId, []);
      }
    }
    
    // Debug output for expert name variations if enabled
    if (debug) {
      console.log(`\nCreated ${expertNameMap.size} unique name variations for ${experts.length} experts`);
      
      // Sample some expert name variations
      if (expertNameMap.size > 0) {
        console.log("\nSample expert name variations:");
        let count = 0;
        for (const [variation, expertIds] of expertNameMap.entries()) {
          if (count >= 5) break;
          console.log(`  "${variation}" -> ${expertIds.join(', ')}`);
          count++;
        }
      }
    }
    
    let matchCount = 0;
    let skippedCount = 0;
    let authorCount = 0;
    
    // Store matched works with their related experts
    const matchedWorks = [];
    
    // Process all works
    for (const work of works) {
      // Extract work ID from URL
      const workId = work.url ? extractExpertIdFromUrl(work.url) : work.id;
      if (!workId) {
        skippedCount++;
        continue;
      }
      
      // Parse authors from the work data
      const normalizedAuthors = parseAuthors(work.authors);
      
      if (debug) {
        console.log(`\nWork: ${work.title || 'Untitled'}`);
        console.log(`  ID: ${workId}`);
        console.log(`  Found ${normalizedAuthors.length} authors`);
        normalizedAuthors.forEach((author, i) => 
          console.log(`  Author ${i+1}: ${author.fullName || 'Unknown'}`)
        );
      }
      
      // Track experts matched to this work
      const matchedExpertsForWork = new Set();
      
      if (normalizedAuthors.length > 0) {
        // For each author of the work
        for (const author of normalizedAuthors) {
          if (author.fullName) {
            authorCount++;
            
            // Create name variations for the author
            const authorNameVariations = createNameVariations(author.fullName);
            
            // Collection of experts matched for this author
            const matchedExpertsForAuthor = new Set();
            
            // Check if any variation matches an expert
            for (const variation of authorNameVariations) {
              const matchingExperts = expertNameMap.get(variation) || [];
              
              // Add the work to all matching experts
              for (const expertId of matchingExperts) {
                if (expertWorksMap.has(expertId)) {
                  expertWorksMap.get(expertId).push(workId);
                  matchedExpertsForAuthor.add(expertId);
                  matchedExpertsForWork.add(expertId);
                }
              }
            }
            
            // Debug name matching if enabled
            if (debug && (matchedExpertsForAuthor.size > 0 || authorCount % 5 === 0)) {
              debugNameMatch(
                author.fullName,
                authorNameVariations,
                Array.from(matchedExpertsForAuthor)
              );
            }
            
            // Update match count
            if (matchedExpertsForAuthor.size > 0) {
              matchCount++;
            }
          }
        }
      } else {
        skippedCount++;
      }
      
      // If work was matched to any expert, add it to matchedWorks with related experts
      if (matchedExpertsForWork.size > 0) {
        // Convert the set of expertIds to an array of related expert objects
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
        
        // Add the work with related experts to the output array
        matchedWorks.push({
          ...work,
          relatedExperts
        });
      }
    }
    
    // Convert map to object for JSON serialization and deduplicate works
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
      expertId => result[expertId] && result[expertId].length > 0
    ).length;
    
    console.log(`Successfully matched ${matchedWorks.length} works to ${expertsWithWorks} experts`);
    console.log(`Authors processed: ${authorCount}, matches found: ${matchCount}, skipped works: ${skippedCount}`);
    
    // Save the results to JSON files
    if (saveToFile) {
      const jsonDir = path.join(__dirname, 'json');
      if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true });
      }
      
      // Save matched works with their related experts
      const matchedWorksPath = path.join(jsonDir, 'matchedWorks.json');
      fs.writeFileSync(matchedWorksPath, JSON.stringify(matchedWorks, null, 2));
      
      // Also save the expert-to-works mapping for reference
      const mappingPath = path.join(jsonDir, 'expertMatchedWorks.json');
      fs.writeFileSync(mappingPath, JSON.stringify(result, null, 2));
      
      console.log(`Matching complete. ${matchedWorks.length} matched works saved to ${matchedWorksPath}`);
      console.log(`Expert-to-works mapping saved to ${mappingPath}`);
    }
    
    return {
      expertWorksMap: result,
      matchedWorks,
      matchCount,
      skippedCount,
      totalWorksMatched,
      expertsWithWorks
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
  
  // Extract ID from URL patterns like "expert/83x5AQ8a"
  const expertMatch = url.match(/expert\/([^\/\s]+)/);
  if (expertMatch && expertMatch[1]) {
    return expertMatch[1];
  }
  
  // Extract ID patterns like "w1" directly
  const workMatch = url.match(/^w\d+$/);
  if (workMatch) {
    return workMatch[0];
  }
  
  // Fallback: Extract the last part of the URL as a fallback
  const parts = url.split('/');
  return parts[parts.length - 1] || null;
}

module.exports = {
  matchWorks,
  createNameVariations,
  extractExpertIdFromUrl
};

// Main execution
if (require.main === module) {
    matchWorks({ debug: true });
}