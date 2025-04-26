/**
* @file fetchWorks.js
* @description Fetches work data from Aggie Experts, processes it, and optionally caches it
* 
* USAGE: node .\src\geo\etl\aggieExpertsAPI\works\fetchWorks.js
* 
* REQUIREMENTS: 
* - A .env file in the project root with API_TOKEN=<your-api-token> for Aggie Experts API authentication
* - Experts data to be fetched first (this module links works to experts)
*
* © Zoey Vo, Loc Nguyen, 2025
*/

const { logBatch, fetchFromApi, manageCacheData, API_TOKEN } = require('../apiUtils');
const { fetchExperts } = require('../experts/fetchExperts');
const { cacheWorks } = require('../redis/redisUtils');

async function fetchWorks(batchSize = 10, maxPages = 10, forceUpdate = true) {
    // First, fetch experts to link to works
    const { experts } = await fetchExperts(batchSize, maxPages, forceUpdate, cacheToRedis);
    
    let works = [];
    let page = 0;
    let totalFetched = 0;
    
    try {
        while (page < maxPages) {
            const data = await fetchFromApi('https://experts.ucdavis.edu/api/search', {
                '@type': 'publication', page
            }, { 'Authorization': API_TOKEN });
            
            const hits = data.hits;
            if (hits.length === 0) break;
            
            const processedWorks = hits.map(work => {
                // Extract and clean up the data
                const workData = {
                    id: work['@id'] || '',
                    title: work.name || '',
                    name: work.name || '',
                    issued: work.datePublished || '',
                    abstract: work.abstract || '',
                    authors: work.authors?.map(author => ({
                        name: author.name || '',
                        id: author['@id'] || ''
                    })) || []
                };
                
                // Find the related experts for this work
                if (workData.authors && workData.authors.length > 0) {
                    workData.relatedExperts = workData.authors
                        .filter(author => author.id)
                        .map(author => {
                            const relatedExpert = experts.find(expert => expert.url === author.id);
                            if (relatedExpert) {
                                return {
                                    firstName: relatedExpert.firstName,
                                    lastName: relatedExpert.lastName,
                                    url: relatedExpert.url
                                };
                            }
                            return null;
                        })
                        .filter(Boolean); // Remove nulls
                }
                
                return workData;
            });
            
            works.push(...processedWorks);
            
            totalFetched += hits.length;
            if (page % batchSize === 0) logBatch('works', page, false);
            page++;
        }
        
        logBatch('works', page, true, totalFetched);
        
        // Skip file caching if cacheToRedis is true
        let cacheResult = { 
            data: works,
            cacheUpdated: false,
            newCount: 0,
            hasNewEntries: false
        };
        
        // If file caching is still needed (when not using Redis)
        if (!cacheToRedis) {
            // Manage cache using the utility for file-based caching
            cacheResult = manageCacheData('works', 'works.json', works, {
                idField: 'id',
                forceUpdate
            });
        } else {
            // Only cache to Redis
            console.log('Caching works to Redis...');
            await cacheWorks(works);
        }
        
        return {
            works: cacheResult.data,
            cacheUpdated: cacheResult.cacheUpdated,
            newCount: cacheResult.newCount,
            hasNewEntries: cacheResult.hasNewEntries
        };
    } catch (error) {
        console.error('Error fetching works:', error.message);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fetchWorks();
}

module.exports = { fetchWorks };