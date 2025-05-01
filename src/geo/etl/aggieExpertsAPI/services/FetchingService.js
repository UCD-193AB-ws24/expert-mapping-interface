/**
* @file FetchingService.js
* @description A consolidated service class for fetching different types of data from Aggie Experts API
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, API_TOKEN } = require('../utils/fetchingUtils');
const { cacheEntities } = require('../utils/cache/entityCache');

/**
 * Service class that handles fetching various types of data from the API
 */
class FetchingService {
  /**
   * Create a new FetchingService
   * @param {string} type - The entity type to fetch ('expert', 'grant', or 'work')
   * @param {number} batchSize - Number of pages to fetch in each batch
   * @param {number} maxPages - Maximum number of pages to fetch
   */
  constructor(type, batchSize = 10, maxPages) {
    this.type = type;
    this.batchSize = batchSize;
    this.maxPages = maxPages;
    this.items = [];
  }

  /**
   * Execute the fetch operation for the specified entity type
   * @returns {Promise<Object>} Results of the fetch operation
   */
  async fetch() {
    switch (this.type) {
      case 'expert':
        return await this.fetchExperts();
      case 'grant':
        return await this.fetchGrants();
      case 'work':
        return await this.fetchWorks();
      default:
        throw new Error(`Unknown entity type: ${this.type}`);
    }
  }

  /**
   * Fetch experts from the API
   * @returns {Promise<Object>} Expert fetch results
   */
  async fetchExperts() {
    try {
      await this.fetchEntities('expert', (expert) => ({
        firstName: expert.contactInfo?.hasName?.given || '',
        middleName: expert.contactInfo?.hasName?.middle || '',
        lastName: expert.contactInfo?.hasName?.family || '',
        fullName: `${expert.contactInfo?.hasName?.given || ''} ${expert.contactInfo?.hasName?.middle || ''} ${expert.contactInfo?.hasName?.family || ''}`.trim(),
        title: expert.contactInfo?.hasTitle?.name || '',
        organizationUnit: expert.contactInfo?.hasOrganizationalUnit?.name || '',
        url: expert['@id'] || ''
      }));
      
      // Cache to Redis
      console.log('\nCaching experts to Redis...');
      const cacheResult = await cacheEntities('expert', this.items);
      
      return {
        experts: this.items,
        totalCount: this.items.length,
        newCount: cacheResult.newCount || 0,
        updatedCount: cacheResult.updatedCount || 0
      };
    } catch (error) {
      console.error('Error fetching experts:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch grants from the API
   * @returns {Promise<Object>} Grant fetch results
   */
  async fetchGrants() {
    try {
      await this.fetchEntities('grant', (grant) => ({
        title: grant.name ? (grant.name.split('§')[0].trim() || 'No Title') : 'No Title',
        funder: grant.assignedBy?.name || '',
        startDate: grant.dateTimeInterval?.start?.dateTime || '',
        endDate: grant.dateTimeInterval?.end?.dateTime || '',
        inheresIn: grant.relatedBy?.[0]?.inheres_in || '',
        url: grant['@id'] || ''
      }));
      
      // Cache to Redis
      console.log('\nCaching grants to Redis...');
      const cacheResult = await cacheEntities('grant', this.items);
      
      return {
        grants: this.items,
        totalCount: this.items.length,
        newCount: cacheResult.newCount || 0,
        updatedCount: cacheResult.updatedCount || 0
      };
    } catch (error) {
      console.error('Error fetching grants:', error.message);
      throw error;
    }
  }
  
  /**
   * Fetch works from the API
   * @returns {Promise<Object>} Work fetch results
   */
  async fetchWorks() {
    try {
      await this.fetchEntities('work', (work) => ({
        title: typeof work.title === 'string' ? work.title.split('§')[0].trim() : ('No Title'),
        authors: (work.author || []).map(author => `${author.given || ''} ${author.family || ''}`.trim()),
        relatedExperts: [],
        issued: work.issued || 'No Issued Date',
        abstract: work.abstract || 'No Abstract',
        name: work.name || 'No Name',
        url: work['@id'] || ''
      }));
      
      // Cache to Redis
      console.log('\nCaching works to Redis...');
      const cacheResult = await cacheEntities('work', this.items);
      
      return {
        works: this.items,
        totalCount: this.items.length,
        newCount: cacheResult.newCount || 0,
        updatedCount: cacheResult.updatedCount || 0
      };
    } catch (error) {
      console.error('Error fetching works:', error.message);
      throw error;
    }
  }
  
  /**
   * Generic method to fetch entities from the Aggie Experts API
   * @param {string} type - Type of entity to fetch ('expert', 'grant', 'work')
   * @param {Function} mapFunction - Function to map API response to desired object structure
   * @returns {Promise<Array>} - Array of fetched entities
   */
  async fetchEntities(type, mapFunction) {
    let page = 0;
    let totalFetched = 0;
    
    try {
      while (page < this.maxPages) {
        const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
          '@type': type,
          page,
          q: 'all'
        }, { 'Authorization': API_TOKEN });
        
        const hits = data.hits;
        if (hits.length === 0) break;
        
        // Map API response to desired object structure
        this.items.push(...hits.map(mapFunction));
        
        totalFetched += hits.length;
        // Intermittent logging of batches
        if (page % this.batchSize === 0) logBatch(type + 's', page, false);
        page++;
      }
      
      logBatch(type + 's', page, true, totalFetched);
      return this.items;
    } catch (error) {
      console.error(`Error fetching ${type}s:`, error.message);
      throw error;
    }
  }
}

module.exports = FetchingService;