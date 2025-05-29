
export const prepareGrantPanelData = (expertIDs, grantIDs, grantsMap, expertsMap, locationID, locationName) => {
  // Process experts
  return expertIDs.map((expertID) => {
    const expert = expertsMap[expertID];
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
        const grant = grantsMap[grantID];
        if (!grant) {
          // console.warn(`Grant with ID ${grantID} not found in grantsMap.`);
          return null;
        }
        return grant;
      })
      .filter((grant) => {
        if (!grant) return false;
        if (!grant.relatedExpertIDs) {
          // console.warn(`Grant with ID ${grant.grantID} has no relatedExpertIDs.`);
          return false;
        }
        if (!grant.relatedExpertIDs.includes(expertID)) {
          // console.warn(
          //   `Grant with ID ${grant.grantID} has relatedExpertID ${grant.relatedExpertIDs}, which does not match expertID ${expertID}.`
          // );
          return false;
        }
        // if (!grant.locationID.includes(locationID)) {
        //   console.warn(
        //     `Grant with ID ${grant.grantID} has locationID ${grant.locationID}, which does not match locationID ${locationID}.`
        //   );
        // }
        return true;
      });

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
      } else if (typeof expert.url === "string") {
        fullUrl = `https://experts.ucdavis.edu/${expert.url}`;
      } else {
        fullUrl = ""; // or some fallback URL
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
          // console.warn(
          //   `Work with ID ${work.workID} has relatedExpertID ${work.relatedExpertIDs}, which does not match expertID ${expertID}.`
          // );
          return false;
        }
        // if (!work.locationID.includes(locationID)) {
        //   console.warn(
        //     `Work with ID ${work.workID} has locationID ${work.locationID}, which does not match locationID ${locationID}.`
        //   );
        // }
        return true;
      });

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