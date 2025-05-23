
export const prepareGrantPanelData = (expertIDs, grantIDs, grantsMap, expertsMap, locationID, locationName) => {
  // Process experts
  return expertIDs.map((expertID) => {
    const expert = expertsMap.get(expertID);
    if (!expert) {
      console.warn(`Expert with ID ${expertID} not found in expertsMap.`);
      return null;
    }

    // Ensure the URL is a full URL
    const fullUrl = expert.url.startsWith("http")
      ? expert.url
      : `https://experts.ucdavis.edu/${expert.url}`;

    // Find grants associated with this expert and the current location
    const associatedGrants = grantIDs
      .map((grantID) => {
        const grant = grantsMap.get(grantID);
        if (!grant) {
          console.warn(`Grant with ID ${grantID} not found in grantsMap.`);
          return null;
        }
        return grant;
      })
      .filter((grant) => {
        if (!grant) return false;
        if (!grant.relatedExpertIDs) {
          console.warn(`Grant with ID ${grant.grantID} has no relatedExpertIDs.`);
          return false;
        }
        if (!grant.relatedExpertIDs.includes(expertID)) {
          console.warn(
            `Grant with ID ${grant.grantID} has relatedExpertID ${grant.relatedExpertIDs}, which does not match expertID ${expertID}.`
          );
          return false;
        }
        if (!grant.locationID.includes(locationID)) {
          console.warn(
            `Grant with ID ${grant.grantID} has locationID ${grant.locationID}, which does not match locationID ${locationID}.`
          );
          return false;
        }
        return true;
      });

    return {
      location: locationName,
      name: expert.name || "Unknown",
      url: fullUrl, // Use the full URL
      grants: associatedGrants.map((grant) => ({
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
    const expert = expertsMap.get(expertID);
    if (!expert) return null;

    // Ensure the URL is a full URL
    const fullUrl = expert.url.startsWith("http")
      ? expert.url
      : `https://experts.ucdavis.edu/${expert.url}`;

    // Find works associated with this expert and the current location
    const associatedWorks = workIDs
      .map((workID) => worksMap.get(workID))
      .filter(
        (work) =>
          work &&
          work.relatedExpertIDs.includes(expertID) && // Work is associated with this expert
          work.locationID === locationID // Work matches the current location
      );

    return {
      location: locationName, 
      name: expert.name || "Unknown",
      url: fullUrl, // Use the full URL
      works: associatedWorks.map((work) => ({
        title: work.title || "Untitled Work",
        issued: work.issued || "Unknown",
        confidence: work.confidence || "Unknown",
        matchedFields: work.matchedFields || [],
      })),
    };
  }).filter((expert) => expert); // Filter out null experts
};