/**
 * @file fetchFeatures.js
 * @description This module provides functions to retrieve and profile associated with
 * a given expert ID
 * @usage Used as a module by fetchExpertProfiles.js and other ETL scripts.
 * 
 * Zoey Vo, Loc Nguyen, 2025
 */

const { postRequestApi } = require('../utils/fetchingUtils');

/**
 * Fetches expert data with works and grants
 * @param {string} expertId - Expert ID to fetch
 * @param {number} limit - Number of works/grants default is 1
 * @returns {Object} Expert data with works and grants
 */
async function getExpertData(expertId, worksLimit = 5, grantsLimit = 5) {
  if (!expertId) throw new Error('Expert ID required');

  try {
    const params = {
      "is-visible": true,
      "expert": { "include": true },
      "grants": { "include": true, "page": 1, "size": grantsLimit, "exclude": ["totalAwardAmount"], "includeMisformatted": false, "sort": [{ "field": "dateTimeInterval.end.dateTime", "sort": "desc", "type": "date" }, { "field": "name", "sort": "asc", "type": "string" }] },
      "works": { "include": true, "page": 1, "size": worksLimit, "exclude": [], "includeMisformatted": false, "sort": [{ "field": "issued", "sort": "desc", "type": "year" }, { "field": "title", "sort": "asc", "type": "string" }] }
    };

    const data = await postRequestApi(`https://experts.ucdavis.edu/api/expert/${expertId}`, params, null);
    if (!data || typeof data !== 'object') throw new Error(`Invalid data for expert ${expertId}`);

    // Basic expert info
    const result = {
      expertId,
      type: data["@type"] || '',
      firstName: data.contactInfo?.hasName?.given || '',
      middleName: data.contactInfo?.hasName?.middle || '',
      lastName: data.contactInfo?.hasName?.family || '',
      fullName: formatName(data.contactInfo?.hasName),
      title: data.contactInfo?.hasTitle?.name || '',
      organizationUnit: data.contactInfo?.hasOrganizationalUnit?.name || '',
      lastModified: data['modified-date'],
      url: data['@id'] || '',
      works: [],
      grants: []
    };
    // Process graph data if available
    if (data["@graph"]?.length) {
      const items = data["@graph"];

      // Extract works and grants
      const works = items.filter(item =>
        item["@type"] && Array.isArray(item["@type"]) && item["title"] &&
        (item["@type"].includes("ScholarlyArticle") || item["@type"].includes("Article"))
      );

      const grants = items.filter(item =>
        item["@type"] && Array.isArray(item["@type"]) &&
        item["@type"].includes("Grant")
      );

      // Process with limit
      result.works = processItems(works, worksLimit, processWork);
      result.grants = processItems(grants, grantsLimit, processGrant);

      //console.log(`Expert ${expertId}: ${works.length} works (${result.works.length} processed), ${grants.length} grants (${result.grants.length} processed)`);
    }

    // Debug: print returned data
    // Remove or comment out after debugging
    console.log('getExpertData result:', JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error(`Error fetching expert ${expertId}:`, error.message);
    throw error;
  }
}

// Format full name from components
function formatName(nameData) {
  if (!nameData) return '';
  return `${nameData.given || ''} ${nameData.middle || ''} ${nameData.family || ''}`.replace(/\s+/g, ' ').trim();
}

// Generic processor for works or grants
function processItems(items, limit, processFn) {
  const limitedItems = limit > 0 ? items.slice(0, limit) : items;
  return limitedItems.map(processFn);
}

// Process a single work item
function processWork(work) {
  const { title = '', abstract = '', issued = '', author = [], '@id': id = '' } = work;

  // Format publication details
  const publicationTitle = work.hasPublicationVenue?.name || work['container-title'] || '';
  const authorName = author[0]?.family || '';
  const identifier = work.eissn || work.ISSN || '';

  // Create name
  const name = publicationTitle
    ? `${title} Published ${work.type || ''} ${issued} ${authorName} ${publicationTitle} ${identifier}`.trim().replace(/\s+/g, ' ')
    : title;

  // Get specific work type
  const typeData = work['@type'];
  let type = !typeData ? '' : (
    Array.isArray(typeData)
      ? (typeData.find(t => t && t !== 'Work') || '')
      : (typeof typeData === 'string' && typeData.includes('Work,') ? typeData.replace('Work,', '').trim() : typeData)
  );
  type = splitCamelPascal(String(type));
  return {
    title,
    name,
    issued,
    abstract,
    authors: author ? author.map(a => `${a.given || ''} ${a.family || ''}`.trim()) : [],
    id: id ? id.split('/').pop() : null,
    type
  };
}

// Process a single grant item
function processGrant(grant) {
  const {
    '@id': id = '',
    name: grantName = '',
    assignedBy = {},
    status = '',
    dateTimeInterval = {},
    relatedBy = []
  } = grant;

  // Extract title from name if needed
  let title = grantName;
  if (typeof grantName === 'string' && grantName.includes('§')) {
    title = grantName.split('§')[0].trim();
  }

  // Get grant role
  let grantRole = !relatedBy || !Array.isArray(relatedBy) ? '' :
    relatedBy.find(rel => rel?.['@type'])?.['@type'] || '';
  grantRole = splitCamelPascal(String(grantRole));
  return {
    id: id ? id.split('/').pop() : null,
    title,
    name: grantName,
    funder: assignedBy?.name || '',
    status,
    startDate: dateTimeInterval?.start?.dateTime || '',
    endDate: dateTimeInterval?.end?.dateTime || '',
    grantRole: Array.isArray(grantRole) ? grantRole.join(', ') : String(grantRole || '')
  };
}

function splitCamelPascal(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase → space before capitals
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // PascalCase → split capital pairs
    .replace(/^./, match => match.toUpperCase()); // capitalize first letter
}

module.exports = { getExpertData };