/**
 * @file matchingUtils.js
 * @description Utility functions for matching experts with works and grants
 * 
 * Zoey Vo, 2025
 */

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
 * Creates expert name maps for efficient lookups
 * @param {Array} experts - Array of expert objects
 * @returns {Object} Object containing maps for expert lookups
 */
function prepareExpertMaps(experts) {
  const expertNameMap = new Map();
  const expertItemsMap = new Map();
  const expertsById = {};
  
  for (const expert of experts) {
    if (!expert?.fullName) continue;
    
    const expertId = expert.url ? extractExpertIdFromUrl(expert.url) : null;
    if (!expertId) continue;
    
    // Store expert by ID and initialize work list
    expertsById[expertId] = expert;
    expertItemsMap.set(expertId, []);
    
    // Create and store name variations
    const nameVariations = createNameVariations(expert.fullName);
    for (const variation of nameVariations) {
      if (!expertNameMap.has(variation)) {
        expertNameMap.set(variation, []);
      }
      expertNameMap.get(variation).push(expertId);
    }
  }
  
  return { expertNameMap, expertItemsMap, expertsById };
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

module.exports = {
  extractExpertIdFromUrl,
  createNameVariations,
  normalizeAuthorData,
  parseAuthors,
  formatExpertForOutput,
  prepareExpertMaps,
  findMatchingExperts
};