/**
 * Utility functions for creating HTML content for Leaflet popups.
 * These functions generate dynamic content for popups associated with researchers and grants.
 */

/**
 * createSingleResearcherContent
 * 
 * Generates HTML content for a popup displaying details about a single researcher.
 * 
 * @param {object} researcher - The researcher object containing details such as name, location, confidence, and works.
 * @param {boolean} isPopup - Indicates whether the content is for a popup (default: true).
 * @returns {string} HTML string for the popup content.
 */

export const createSingleResearcherContent = (properties, researcher, workCount, isPopup = true) => {
  let workTitles = [];
  const researcherName = researcher.researcher_name || "Unknown";
  const locationName = researcher.location_name || "Unknown";
  const researcherUrl = researcher.researcher_url || "#";
  try {
    
     // Extract work titles from the researcher object.
    const titles = properties.work_titles || '[]';
    
    if (Array.isArray(titles)) {
       // If titles are already an array, use them directly.
      workTitles = titles;
    } else if (typeof titles === 'string') {
     // If titles are a string, attempt to parse them as JSON.
      try {
        workTitles = JSON.parse(titles);
      } catch (e) {
        console.error('Error parsing work titles string:', e);
        workTitles = [];
      }
    }
  } catch (e) {
    console.error('Error in createSingleResearcherContent:', e);
    workTitles = [];
  }

  // Extract confidence level from the researcher object.
  const confidence = properties.confidence || '';

   // Helper function to style the confidence level.
  const getConfidenceStyle = (confidenceValue) => {
    if (!confidenceValue) return { label: '', style: {} };
    if (confidenceValue === 'high' || confidenceValue === 'High') {
      return { 
        label: 'High',
        style: 'background-color: #e8f5e9; color: #2e7d32; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
      };
    } else if (confidenceValue === 'low' || confidenceValue === 'Low') {
      return { 
        label: 'Low',
        style: 'background-color: #ffebee; color: #c62828; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
      };
    } else {
      return { 
        label: confidenceValue,
        style: 'background-color: #f5f5f5; color: #757575; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
      };
    }
  };

  const confidenceStyle = getConfidenceStyle(confidence);

  // Generate the HTML content for the popup.
  return `
    <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
      <div style="font-weight: bold; font-size: 16px; color: #13639e;">
      ${researcherName || "Unknown"}
      </div>
      <div style="font-size: 14px; color: #333; margin-top: 5px;">
        <strong>Location:</strong> ${locationName || "Unknown"}
        ${confidence ? 
          `<div><strong>Confidence:</strong> <span style="${confidenceStyle.style}">${confidenceStyle.label}</span></div>` 
          : ''}
      </div>
      <div style="font-size: 14px; color: #333; margin-top: 5px;">
        <strong>Related Works ${workCount ||  0}:</strong>
        ${ workTitles.length > 0 ? `
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${workTitles.slice(0, 3).map(title => 
              `<li style="margin-bottom: 3px;">${title}</li>`
            ).join('')}
            ${workTitles.length > 3 ? 
              `<li style="list-style: none; font-style: italic;">... and ${workTitles.length - 3} more</li>` : ''}
          </ul>
        ` : '<div style="margin-top: 3px;">No works found</div>'}
      </div>
      <a href='${researcherUrl}' 
 target='_blank'
 rel="noopener noreferrer"
 style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; opacity: ${researcher.researcher_url ? '1' : '0.6'}; cursor: ${researcher.researcher_url ? 'pointer' : 'default'}">
${researcherUrl  ? "View Profile" : "No Profile Found"}
</a>
    </div>
  `;
};

/**
 * createMultiResearcherContent
 * 
 * Generates HTML content for a popup displaying details about multiple researchers at a location.
 * 
 * @param {number} expertCount - The number of researchers at the location.
 * @param {string} locationName - The name of the location.
 * @param {number} totalWorks - The total number of works associated with the researchers.
 * @returns {string} HTML string for the popup content.
 */
export const createMultiResearcherContent = (expertCount, locationName, totalWorks) => `
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
 * createGrantPopupContent
 * 
 * Generates HTML content for a popup displaying details about a single grant.
 * 
 * @param {object} grant - The grant object containing details such as title, researcher, location, and funder.
 * @returns {string} HTML string for the popup content.
 */
export const createGrantPopupContent = (grant) => {
  const rawTitle = grant.title || "";
  const cleanTitle = rawTitle.split("ยง")[0].trim().replace(/^"+|"+$/g, ""); // remove leading/trailing quotes

  return `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
<div style="margin-top: 4px;">
        <strong>Grant:</strong> ${cleanTitle  || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Researcher:</strong> ${grant.researcher_name || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Location:</strong> ${grant.location_name || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Funder:</strong> ${grant.funder || "Unknown"}
      </div>
      <a href='${grant.researcher_url || "#"}' 
         target='_blank'
         rel="noopener noreferrer"
         style="display: block; margin-top: 12px; padding: 8px 10px; background: #f59e0b; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; opacity: ${(grant.researcher_url) ? '1' : '0.6'}; cursor: ${(grant.researcher_url) ? 'pointer' : 'default'}">
        ${grant.researcher_url ? "View Researcher Profile" : "No Profile Found"}
      </a>
    </div>
  `;
};

/**
 * createMultiGrantPopup
 * 
 * Generates HTML content for a popup displaying details about multiple grants at a location.
 * 
 * @param {array} grants - Array of grant objects.
 * @param {string} locationName - The name of the location.
 * @returns {string} HTML string for the popup content.
 */
export const createMultiGrantPopup = (grants, locationName) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #f59e0b;'>
      ${grants.length} Grants at this Location
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
