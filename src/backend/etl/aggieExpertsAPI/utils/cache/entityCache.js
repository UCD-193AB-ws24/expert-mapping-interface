/**
 * @file entityCache.js
 * @description Unified module for caching and retrieving experts, grants, and works in Redis
 *
 * USAGE: Import this module to cache or retrieve any entity type (expert, grant, work)
 *
 * Zoey Vo, 2025
 */

const { sanitizeString, cacheItems, getCachedItems } = require('./redisUtils');

// ===== Entity-specific Configurations =====

const entityConfigs = {
  expert: {
    getItemId: (expert, index) => {
      const id = expert.url ? expert.url.split('/').pop() : index.toString();
      return id;
    },
    isItemUnchanged: (expert, existingExpert) => {
      const fullName = `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim();
      return (
        expert.firstName === existingExpert.first_name &&
        expert.middleName === existingExpert.middle_name &&
        expert.lastName === existingExpert.last_name &&
        fullName === existingExpert.full_name &&
        expert.title === existingExpert.title &&
        expert.organizationUnit === existingExpert.organization_unit
      );
    },
    formatItemForCache: (expert, sessionId) => ({
      id: expert.url.split('/').pop() || '',
      first_name: expert.firstName || '',
      middle_name: expert.middleName || '',
      last_name: expert.lastName || '',
      full_name: `${expert.firstName} ${expert.middleName ? expert.middleName + ' ' : ''}${expert.lastName}`.trim(),
      title: expert.title || '',
      organization_unit: expert.organizationUnit || '',
      url: expert.url || '',
      cache_session: sessionId,
      cached_at: new Date().toISOString()
    }),
    formatItemFromCache: (expertData) => ({
      firstName: expertData.first_name || '',
      middleName: expertData.middle_name || '',
      lastName: expertData.last_name || '',
      fullName: expertData.full_name || '',
      title: expertData.title || '',
      organizationUnit: expertData.organization_unit || '',
      url: expertData.url || ''
    })
  },
  grant: {
    getItemId: (grant, index) => `g${index + 1}`,
    isItemUnchanged: (grant, existingGrant) => (
      sanitizeString(grant.title) === existingGrant.title &&
      grant.funder === existingGrant.funder &&
      grant.startDate === existingGrant.start_date &&
      grant.endDate === existingGrant.end_date
    ),
    formatItemForCache: (grant, sessionId) => ({
      id: grant.cachedId || `g${grant.index + 1}`,
      title: sanitizeString(grant.title) || '',
      funder: grant.funder ? String(grant.funder) : '',
      start_date: grant.startDate ? String(grant.startDate) : '',
      end_date: grant.endDate ? String(grant.endDate) : '',
      inheres_in: grant.inheresIn ? String(grant.inheresIn) : '',
      url: grant.url ? String(grant.url) : '',
      cache_session: sessionId,
      cached_at: new Date().toISOString()
    }),
    formatItemFromCache: (grantData) => {
      let relatedExperts = null;
      try {
        if (grantData.related_expert) {
          relatedExperts = JSON.parse(grantData.related_experts);
        }
      } catch (e) {
        console.error(`Error parsing related expert for grant ${grantData.id}:`, e.message);
      }
      return {
        id: grantData.id || '',
        title: grantData.title || '',
        funder: grantData.funder || '',
        startDate: grantData.start_date || '',
        endDate: grantData.end_date || '',
        inheresIn: grantData.inheres_in || '',
        url: grantData.url || '',
        relatedExperts: relatedExperts
      };
    }
  },
  work: {
    getItemId: (work, index) => `w${index + 1}`,
    isItemUnchanged: (work, existingWork) => (
      sanitizeString(String(work.title || '')) === existingWork.title &&
      sanitizeString(String(work.name || '')) === existingWork.name &&
      (work.issued || '') === existingWork.issued &&
      sanitizeString(String(work.abstract || '')) === existingWork.abstract &&
      JSON.stringify(work.authors || []) === existingWork.authors
    ),
    formatItemForCache: (work, sessionId) => {
      const formattedItem = {
        id: work.cachedId || `w${work.index + 1}`,
        title: sanitizeString(String(work.title || '')),
        name: sanitizeString(String(work.name || '')),
        issued: work.issued || '',
        abstract: sanitizeString(String(work.abstract || '')),
        authors: JSON.stringify(work.authors || []),
        cache_session: sessionId,
        cached_at: new Date().toISOString()
      };
      if (work.relatedExperts && work.relatedExperts.length > 0) {
        formattedItem.related_experts = JSON.stringify(work.relatedExperts);
      }
      return formattedItem;
    },
    formatItemFromCache: (workData) => {
      let authors = [];
      try {
        if (workData.authors) {
          authors = JSON.parse(workData.authors);
        }
      } catch (e) {
        console.error(`Error parsing authors for work ${workData.id}:`, e.message);
      }
      let relatedExperts = [];
      try {
        if (workData.related_experts) {
          relatedExperts = JSON.parse(workData.related_experts);
        }
      } catch (e) {
        console.error(`Error parsing related experts for work ${workData.id}:`, e.message);
      }
      return {
        id: workData.id || '',
        title: workData.title || '',
        name: workData.name || '',
        issued: workData.issued || '',
        abstract: workData.abstract || '',
        authors: authors,
        relatedExperts: relatedExperts
      };
    }
  }
};

// ===== Unified Cache Functions =====

async function cacheEntities(entityType, items) {
  const config = entityConfigs[entityType];
  if (!config) throw new Error(`Unknown entity type: ${entityType}`);
  // Filter out undefined/null/empty items
  const validItems = (items || []).filter(item => item && typeof item === 'object');
  if (validItems.length !== items.length) {
    console.warn(`⚠️ Skipping ${items.length - validItems.length} invalid or undefined entries for entity type '${entityType}'.`);
  }
  // Pre-process for sequential IDs if needed
  if (entityType === 'grant' || entityType === 'work') {
    for (let i = 0; i < validItems.length; i++) {
      validItems[i].cachedId = config.getItemId(validItems[i], i);
      validItems[i].index = i;
    }
  }
  return cacheItems(validItems, { ...config, entityType });
}

async function getCachedEntities(entityType) {
  const config = entityConfigs[entityType];
  if (!config) throw new Error(`Unknown entity type: ${entityType}`);
  return getCachedItems({
    entityType,
    formatItemFromCache: config.formatItemFromCache
  });
}

module.exports = {
  cacheEntities,
  getCachedEntities
};
