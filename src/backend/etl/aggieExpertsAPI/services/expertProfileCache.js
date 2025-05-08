/**
 * @file expertProfileCache.js
 * @description Module for caching expert profiles in Redis
 *
 * Zoey Vo, 2025
 */

const { cacheItems } = require('../utils/redisUtils');

// ===== Expert Profile Cache Configuration =====
const expertConfig = {
  getItemId: (expert, index) => {
    const id = expert.url ? expert.url.split('/').pop() : index.toString();
    return id;
  },
  isItemUnchanged: (expert, existingExpert) => {
    // Compare content directly
    const currentContent = JSON.stringify({
      firstName: expert.firstName,
      lastName: expert.lastName,
      title: expert.title,
      organizationUnit: expert.organizationUnit,
      works: Array.isArray(expert.works) ? expert.works.length : 0,
      grants: Array.isArray(expert.grants) ? expert.grants.length : 0,
      lastModified: expert.lastModified
    });
    
    const existingContent = JSON.stringify({
      firstName: existingExpert.first_name,
      lastName: existingExpert.last_name,
      title: existingExpert.title,
      organizationUnit: existingExpert.organization_unit,
      works: Array.isArray(existingExpert.works) ? existingExpert.works.length : 
             (typeof existingExpert.works === 'string' ? JSON.parse(existingExpert.works || '[]').length : 0),
      grants: Array.isArray(existingExpert.grants) ? existingExpert.grants.length : 
              (typeof existingExpert.grants === 'string' ? JSON.parse(existingExpert.grants || '[]').length : 0),
      lastModified: existingExpert.last_modified
    });

    return currentContent === existingContent;
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
    works: Array.isArray(expert.works) ? expert.works.map(work => ({
      ...work,
      type: work.type ? work.type.replace(/([A-Z])/g, ' $1').trim() : work.type
    })) : [],
    grants: Array.isArray(expert.grants) ? expert.grants.map(grant => ({
      ...grant,
      grantRole: grant.grantRole ? 
        (typeof grant.grantRole === 'string' ? 
          grant.grantRole.replace(/([A-Z])/g, ' $1').trim() : 
          grant.grantRole) : 
        grant.grantRole
    })) : [],
    last_modified: expert.lastModified || new Date().toISOString(),
    cache_session: sessionId,
    cached_at: new Date().toISOString()
  })
};

async function cacheEntities(entityType, items) {
  if (entityType !== 'expert') {
    throw new Error('This module only supports caching expert profiles');
  }
  
  const validItems = (items || []).filter(item => item && typeof item === 'object');
  if (validItems.length !== items.length) {
    console.warn(`⚠️ Skipping ${items.length - validItems.length} invalid or undefined expert profiles`);
  }
  
  return cacheItems(validItems, { ...expertConfig, entityType });
}

module.exports = {
  cacheEntities
};
