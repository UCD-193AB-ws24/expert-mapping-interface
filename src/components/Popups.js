/**
 * Utility functions for creating HTML content for Leaflet popups.
 * These functions generate dynamic content for popups associated with experts and grants.
 */

/**
 * createSingleExpertContent [DEPRECATED]
 * 
 * Generates HTML content for a popup displaying details about a single expert.
 * 
 * @param {object} expert - The expert object containing details such as name, location, confidence, and works.
 * @param {boolean} isPopup - Indicates whether the content is for a popup (default: true).
 * @returns {string} HTML string for the popup content.
 */

export const createSingleResearcherContent = (expertObj, locationName) => {
  if (!expertObj) return "<div>No expert data available</div>";

  const confidenceLabel = expertObj.works?.[0]?.confidence || "Unknown";
  const confidenceStyle =
    confidenceLabel.toLowerCase() === "high"
      ? "background: #e8f5e9; color: #2e7d32;"
      : confidenceLabel.toLowerCase() === "low"
        ? "background: #ffebee; color: #c62828;"
        : "background: #f5f5f5; color: #757575;";
  return `
    <div style="position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px; background: white; border-radius: 8px;">
      <div style="font-weight: bold; font-size: 16px; color: #13639e;">
        ${expertObj.name || "Unknown Expert"}
      </div>
      <div style="margin-top: 5px; color: #333;">
        <strong>Location:</strong> ${locationName || "Unknown"}
      </div>
      <a href="#" class="view-experts-btn"
   style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
  View Profile
</a>

    </div>
  `;
};


/**
 * createMultiExpertContent
 * 
 * Generates HTML content for a popup displaying details about multiple experts at a location.
 * 
 * @param {number} expertCount - The number of experts at the location.
 * @param {string} locationName - The name of the location.
 * @param {number} totalWorks - The total number of works associated with the experts.
 * @returns {string} HTML string for the popup content.
 */
export const createMultiExpertContent = (expertCount, locationName, totalWorks) => `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
    <div style="font-weight: bold; font-size: 16px; color: #13639e;">
      ${expertCount} Experts at this Location
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Location:</strong> ${locationName || "Unknown"}
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Related Works:</strong> ${totalWorks}
    </div>
    <a href='#'
       class="view-experts-btn"
       style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
      View Experts
    </a>
  </div>
`;


/**
 * noExpertContent
 * 
 * Generates HTML content for a popup displaying details about locations with no experts.
 * 
*/

export const noExpertContent = (expertCount, locationName, totalWorks) => `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
    <div style="font-weight: bold; font-size: 16px; color: #13639e;">
      No experts found at this Location
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Location:</strong> ${locationName || "Unknown"}
    </div>
  </div>
`;

/**
 * createGrantPopupContent
 * 
 * Generates HTML content for a popup displaying details about a single grant.
 * 
 * @param {object} grant - The grant object containing details such as title, expert, location, and funder.
 * @returns {string} HTML string for the popup content.
 */
export const createGrantPopupContent = (grant) => {
  const rawTitle = grant.title || "";
  const cleanTitle = rawTitle.split("ยง")[0].trim().replace(/^"+|"+$/g, ""); // remove leading/trailing quotes
  return `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
<div style="margin-top: 4px;">
        <strong>Grant:</strong> ${cleanTitle || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Expert:</strong> ${grant.expert_name || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Location:</strong> ${grant.location_name || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Funder:</strong> ${grant.funder || "Unknown"}
      </div>
      <a href='${grant.expert_url || "#"}' 
         target='_blank'
         rel="noopener noreferrer"
         style="display: block; margin-top: 12px; padding: 8px 10px; background: #f59e0b; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; opacity: ${(grant.expert_url) ? '1' : '0.6'}; cursor: ${(grant.expert_url) ? 'pointer' : 'default'}">
        ${grant.expert_url ? "View Expert Profile" : "No Profile Found"}
      </a>
    </div>
  `;
};

/**
 * createMultiGrantPopup
 * 
 * Generates HTML content for a popup displaying number of grants at a location.
 * 
 * @param {number} grantCount - Number of grants at the location.
 * @param {string} locationName - The name of the location.
 * @returns {string} HTML string for the popup content.
 */
export const createMultiGrantPopup = (grantCount, locationName) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #f59e0b;'>
      ${grantCount} Grant${grantCount !== 1 ? 's' : ''} at this Location
    </div>
    <div style='margin-top: 8px; color: #333;'>
      <strong>Location:</strong> ${locationName || "Unknown"}
    </div>
    <a href='#'
       class='view-grants-btn'
       style='display: block; margin-top: 12px; padding: 8px 10px; background: #f59e0b; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
      View Grants
    </a>
  </div>
`;


/**
 * noGrantContent
 * 
 * Generates HTML content for locations with no grants.
 * 
 * @param {string} locationName - The name of the location.
 * @returns {string} HTML string for the popup content.
 */
export const noGrantContent = (locationName) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #f59e0b;'>
      No Grants at this Location
    </div>
    <div style='margin-top: 8px; color: #333;'>
      <strong>Location:</strong> ${locationName || "Unknown"}
    </div>
  </div>
`;

export const createCombinedPolygonPopup = (worksCount, grantsCount, locationName) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #10b981;'>Combined Polygon</div>
    <div style='margin-top: 8px; color: #333;'><strong>Location:</strong> ${locationName}</div>
    <div style='margin-top: 5px;'>
      <div style='color: #13639e; display: inline-block; margin-right: 10px;'>
        <strong>${worksCount}</strong> Works
      </div>
      <div style='color: #f59e0b; display: inline-block;'>
        <strong>${grantsCount}</strong> Grants
      </div>
    </div>
    <a href='#'
      class='view-combined-polygon-btn'
      style='display: block; margin-top: 12px; padding: 8px 10px; background: #10b981; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
      Open Panel
    </a>
  </div>
`;

export const createMatchedGrantPopup = (grantCount, locationName) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='margin-top: 5px; color: green;'>🔍 Match found</div>
    <div style='margin-top: 8px; color: #333;'>
      <strong>Location:</strong> ${locationName || "Unknown"}
    </div>
    <a href='#'
       class='view-grants-btn'
       style='display: block; margin-top: 12px; padding: 8px 10px; background: #f59e0b; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
      View Grants
    </a>
  </div>
`;

export const createMatchedExpertPopup = (expertCount, locationName, totalWorks) => `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
    <div style="margin-top: 5px; color: green;">🔍 ${expertCount} ${expertCount === 1 ? 'Match Found' : 'Matches Found'}</div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Location:</strong> ${locationName || "Unknown"}
    </div>
    <a href='#'
       class="view-experts-btn"
       style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
      View Experts
    </a>
  </div>
`;

export const createMatchedCombinedPolygonPopup = (worksCount, grantsCount, locationName) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #10b981;'>Combined Polygon</div>
    <div style='margin-top: 5px; color: green;'>🔍 Match found</div> 
    <div style='margin-top: 8px; color: #333;'><strong>Location:</strong> ${locationName}</div>
    <a href='#'
      class='view-combined-polygon-btn'
      style='display: block; margin-top: 12px; padding: 8px 10px; background: #10b981; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
      Open Panel
    </a>
  </div>
`;

