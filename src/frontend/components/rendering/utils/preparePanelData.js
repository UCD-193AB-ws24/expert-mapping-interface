
/**
 * @file preparePanelData.js
 * @description
 * Utility functions for preparing panel data for grants and works.
 * 
 * - prepareGrantPanelData: Prepares data for displaying grants associated with experts at a specific location.
 * - prepareWorkPanelData: Prepares data for displaying works associated with experts at a specific location.
 * 
 * These functions process expert, grant, and work data to generate structured information
 * for display in panels, filtering out invalid or incomplete entries.
 * 
 * Functions:
 * - prepareGrantPanelData: Filters and structures grant data for experts.
 * - prepareWorkPanelData: Filters and structures work data for experts.
 * 
 * Marina Mata, Alyssa Vallejo 2025
 */

export const prepareGrantPanelData = (expertIDs, grantIDs, grantsMap, expertsMap, locationID, locationName) => {
  // Process experts
  return expertIDs.map((expertID) => {
    const expert = expertsMap[expertID];
    if (!expert) {
      console.warn(`Expert with ID ${expertID} not found in expertsMap.`);
      return null;
    }

    // Ensure the URL is a full URL
    let fullUrl = "";
    if (typeof expert.url === "string" && expert.url.startsWith("http")) {
      fullUrl = expert.url;
    } else if (typeof expert.url === "string" && expert.url.trim() !== "") {
      fullUrl = `https://experts.ucdavis.edu/${expert.url}`;
    } else {
      fullUrl = "";
    }

    // Find grants associated with this expert and the current location
    const associatedGrants = grantIDs
      .map((grantID) => {
        const grant = grantsMap[grantID];
        if (!grant) {
          return null;
        }
        return grant;
      })
      .filter((grant) => {
        if (!grant) return false;
        if (!grant.relatedExpertIDs) {
          return false;
        }
        if (!grant.relatedExpertIDs.includes(expertID)) {
          return false;
        }
        if (!grant.locationIDs.includes(locationID)) {
          console.warn(
            `Grant with ID ${grant.grantID} has does not have locationID ${locationID}.`
          );
          return false;
        }
        return true;
      });
    if (associatedGrants.length === 0) {
      console.warn(`No works found for expertID ${expertID} at location ${locationID}.`);
      return null;
    }
    return {
      location: locationName,
      name: expert.name || "Unknown",
      url: fullUrl, // Use the full URL
      grants: associatedGrants
        .map((grant) => ({
          title: grant.title || "Untitled Grant",
          funder: grant.funder || "Unknown",
          startDate: grant.startDate || "Unknown",
          endDate: grant.endDate || "Unknown",
          confidence: grant.confidence || "Unknown",
          matchedFields: grant.matchedFields || [],
        })),
    };
  }).filter((expert) => expert); // Filter out null experts
};


export const prepareWorkPanelData = (expertIDs, workIDs, expertsMap, worksMap, locationID, locationName) => {
  return expertIDs.map((expertID) => {
    const expert = expertsMap[expertID];
    if (!expert) return null;

    // Defensive: check if expert.url exists and is a string
    let fullUrl = "";
    if (typeof expert.url === "string" && expert.url.startsWith("http")) {
      fullUrl = expert.url;
    } else if (typeof expert.url === "string" && expert.url.trim() !== "") {
      fullUrl = `https://experts.ucdavis.edu/${expert.url}`;
    } else {
      fullUrl = "";
    }

    // Find works associated with this expert and the current location
    const associatedWorks = workIDs
      .map((workID) => worksMap[workID])
      .filter(work => {
        if (!work) return false;
        if (!work.relatedExpertIDs) {
          // console.warn(`Work with ID ${work.workID} has no relatedExpertIDs.`);
          return false;
        }
        if (!work.relatedExpertIDs.includes(expertID)) {
          return false;
        }
        if (!work.locationIDs.includes(locationID)) {
          console.warn(
            `Work with ID ${work.workID} has does not have locationID ${locationID}.`
          );
        }
        return true;
      });
    if (associatedWorks.length === 0) {
      console.warn(`No works found for expertID ${expertID} at location ${locationID}.`);
      return null;
    }
    return {
      location: locationName,
      name: expert.name || "Unknown",
      url: fullUrl, // Use the full URL
      works: associatedWorks
        .map((work) => ({
          title: work.title || "Untitled Work",
          issued: work.issued || "Unknown",
          confidence: work.confidence || "Unknown",
          matchedFields: work.matchedFields || [],
        })),
    };
  }).filter((expert) => expert); // Filter out null experts
};