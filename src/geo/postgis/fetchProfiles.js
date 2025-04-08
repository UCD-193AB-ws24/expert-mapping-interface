/**
 * fetchProfiles.js
 * 
 * Purpose:
 * Fetches researcher profiles from the server and outputs as GeoJSON.
 * Includes both API client functions and data conversion utilities.
 *
 * USAGE: node path_to_file/fetchProfiles.js [name] [limit] [output file]
 */

const fs = require('fs').promises;

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Fetch researcher profiles with optional filters
 * @param {Object} options - Search options
 * @param {string} options.name - Filter by researcher name
 * @param {string} options.location - Filter by location name
 * @param {number} options.limit - Maximum number of results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} Researcher profiles and count
 */
async function fetchResearcherProfiles(options = {}) {
    const { name, location, limit = 50, offset = 0 } = options;
    
    // Build query string
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (location) params.append('location', location);
    params.append('limit', limit);
    params.append('offset', offset);

    try {
        const response = await fetch(`${API_BASE_URL}/researchers?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching researcher profiles:', error);
        throw error;
    }
}

/**
 * Fetch detailed information for a specific researcher
 * @param {string} name - Exact researcher name
 * @returns {Promise<Object>} Detailed researcher information
 */
async function fetchResearcherDetails(name) {
    try {
        const response = await fetch(`${API_BASE_URL}/researchers/${encodeURIComponent(name)}`);
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching researcher details:', error);
        throw error;
    }
}

/**
 * Fetch all research locations
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
async function fetchResearchLocations() {
    try {
        const response = await fetch(`${API_BASE_URL}/research-locations`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching research locations:', error);
        throw error;
    }
}

async function displayResearcherStats(researchers) {
    console.log('\nResearcher Summary:');
    console.log('-------------------');
    console.log(`Total Researchers: ${researchers.length}`);

    // Calculate work statistics
    const workCounts = researchers.map(r => r.work_count);
    const totalWorks = workCounts.reduce((a, b) => a + b, 0);
    const avgWorks = totalWorks / researchers.length;
    const maxWorks = Math.max(...workCounts);

    console.log(`Total Works: ${totalWorks}`);
    console.log(`Average Works per Researcher: ${avgWorks.toFixed(2)}`);
    console.log(`Maximum Works by a Researcher: ${maxWorks}`);
}

async function displayResearcherDetails(name) {
    console.log(`\n🔍 Looking up details for: ${name}`);
    try {
        const details = await fetchResearcherDetails(name);
        if (!details) {
            console.log('❌ Researcher not found');
            return;
        }

        console.log('\nResearcher Details:');
        console.log('------------------');
        console.log(`Name: ${details.researcher_name}`);
        console.log(`URL: ${details.researcher_url}`);
        console.log(`Number of works: ${details.works.length}`);
        console.log('\nLocations:');
        details.locations.forEach(loc => {
            console.log(`- ${loc.name} (${loc.type})`);
        });

        console.log('\nWorks:');
        details.works.forEach((work, index) => {
            console.log(`${index + 1}. ${work.title} (${work.year || 'Year unknown'})`);
        });

        return details;
    } catch (error) {
        console.error('Error fetching researcher details:', error);
        return null;
    }
}

async function fetchAllResearchers() {
    const batchSize = 100;
    let allResearchers = [];
    let offset = 0;
    let totalFetched = 0;
    let totalAvailable = null;

    console.log('📊 Fetching all researcher profiles...');

    while (true) {
        const result = await fetchResearcherProfiles({
            limit: batchSize,
            offset: offset
        });

        if (!result.researchers || result.researchers.length === 0) {
            break;
        }

        // Debug log for first researcher's works
        if (result.researchers[0]) {
            console.log('Sample works structure:', {
                works: result.researchers[0].works,
                type: typeof result.researchers[0].works,
                isArray: Array.isArray(result.researchers[0].works)
            });
        }

        allResearchers = allResearchers.concat(result.researchers);
        totalFetched += result.researchers.length;
        totalAvailable = result.total;
        offset += batchSize;

        console.log(`📥 Fetched ${totalFetched} of ${totalAvailable} researchers (${Math.round(totalFetched/totalAvailable * 100)}%)...`);

        // Break if we've fetched all available researchers
        if (!result.has_more || totalFetched >= totalAvailable) {
            break;
        }
    }

    console.log(`✅ Completed fetching all ${totalFetched} researchers`);
    return allResearchers;
}

function convertToGeoJSON(researchers) {
    // Create a feature for each researcher-location combination
    const features = researchers.flatMap(researcher => {
        return researcher.locations.map(location => {
            const geometry = location.geometry;
            // Handle works as a list of strings
            const workTitles = researcher.works || [];

            return {
                type: 'Feature',
                geometry: geometry,
                properties: {
                    researcher_name: researcher.researcher_name,
                    researcher_url: researcher.researcher_url,
                    work_count: researcher.work_count,
                    work_titles: workTitles,
                    confidence: location.confidence,
                    location_name: location.name,
                    location_type: location.type,
                    location_id: location.location_id
                }
            };
        });
    });

    return {
        type: 'FeatureCollection',
        features: features,
        metadata: {
            total_researchers: researchers.length,
            total_locations: features.length,
            generated_at: new Date().toISOString()
        }
    };
}

async function saveGeoJSON(geojson, filename) {
    try {
        await fs.writeFile(filename, JSON.stringify(geojson, null, 2));
        console.log(`\n✅ GeoJSON saved to ${filename}`);
    } catch (error) {
        console.error('Error saving GeoJSON:', error);
    }
}

async function main() {
    const startTime = Date.now();
    try {
        // Parse command line arguments
        const searchName = process.argv[2];
        const limit = process.argv[3] ? parseInt(process.argv[3]) : 0;
        const outputFile = process.argv[4] || 'researcher_locations.geojson';

        if (searchName) {
            // If name provided, show detailed info and save specific researcher
            const details = await displayResearcherDetails(searchName);
            if (details) {
                const geojson = convertToGeoJSON([details]);
                await saveGeoJSON(geojson, outputFile);
            }
        } else {
            // Otherwise show general statistics and save all researchers
            let researchers;
            if (limit > 0) {
                // If limit specified, fetch just that amount
                const result = await fetchResearcherProfiles({ limit });
                researchers = result.researchers;
                console.log(`\n✅ Fetched ${researchers.length} researchers (limited to ${limit})`);
            } else {
                // Otherwise fetch all researchers
                researchers = await fetchAllResearchers();
                console.log(`\n✅ Fetched all ${researchers.length} researchers`);
            }

            if (researchers.length > 0) {
                await displayResearcherStats(researchers);
                const geojson = convertToGeoJSON(researchers);
                await saveGeoJSON(geojson, outputFile);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
    finally {
        const endTime = Date.now();
        console.log(`⏳ Total execution time: ${(endTime - startTime) / 1000} seconds`);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

// Export all functions for use as a module
module.exports = {
    fetchResearcherProfiles,
    fetchResearcherDetails,
    fetchResearchLocations,
    fetchAllResearchers,
    displayResearcherStats,
    displayResearcherDetails,
    convertToGeoJSON,
    saveGeoJSON
};
