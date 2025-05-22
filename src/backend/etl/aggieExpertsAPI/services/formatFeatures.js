/**
 * @file formatFeatures.js
 * @description Converts expert profiles into structured formats focused on works and grants, establishing relationship mappings.
 * @usage Used as a module by getExpertFeatures.js and other ETL scripts.
 *
 * Zoey Vo, 2025
 */

/**
 * Format expert profiles into separate work-centric and grant-centric JSON files
 * @param {Array} expertProfiles - Array of expert profiles to format
 * @returns {Object} Object containing formatted works and grants
 */
function formatFeatures(expertProfiles) {
  // Create maps to track unique works and grants by their IDs
  const worksMap = new Map();
  const grantsMap = new Map();

  // Process each expert profile
  expertProfiles.forEach(expert => {
    const expertInfo = {
      expertId: expert.expertId,
      firstName: expert.firstName,
      middleName: expert.middleName,
      lastName: expert.lastName,
      fullName: expert.fullName,
      title: expert.title,
      organizationUnit: expert.organizationUnit,
      url: expert.url
    };

    // Process works
    if (expert.works && Array.isArray(expert.works)) {
      expert.works.forEach(work => {
        const workId = work.id;
        
        // Handle issued field - if it's an array, take the first value
        const processedWork = { ...work };
        if (Array.isArray(processedWork.issued) && processedWork.issued.length > 0) {
          processedWork.issued = processedWork.issued[0];
        }
        
        if (worksMap.has(workId)) {
          // Work already exists, add this expert to relatedExperts
          const existingWork = worksMap.get(workId);
          existingWork.relatedExperts.push(expertInfo);
        } else {
          // Create new work entry with this expert
          const workCopy = { ...processedWork, relatedExperts: [expertInfo] };
          worksMap.set(workId, workCopy);
        }
      });
    }

    // Process grants
    if (expert.grants && Array.isArray(expert.grants)) {
      expert.grants.forEach(grant => {
        const grantId = grant.id;
        
        // Handle issued field for grants if needed
        const processedGrant = { ...grant };
        if (Array.isArray(processedGrant.issued) && processedGrant.issued.length > 0) {
          processedGrant.issued = processedGrant.issued[0];
        }
        
        if (grantsMap.has(grantId)) {
          // Grant already exists, add this expert to relatedExperts
          const existingGrant = grantsMap.get(grantId);
          existingGrant.relatedExperts.push(expertInfo);
        } else {
          // Create new grant entry with this expert
          const grantCopy = { ...processedGrant, relatedExperts: [expertInfo] };
          grantsMap.set(grantId, grantCopy);
        }
      });
    }
  });

  // Convert maps to arrays for JSON output
  const formattedWorks = Array.from(worksMap.values());
  const formattedGrants = Array.from(grantsMap.values());

  return {
    works: formattedWorks,
    grants: formattedGrants
  };
}

module.exports = { formatFeatures };