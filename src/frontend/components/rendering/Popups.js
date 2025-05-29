/**
 * @file Popups.js
 * @description This file contains utility functions for creating HTML content for Leaflet popups.
 *              These functions generate dynamic content for popups associated with experts, grants,
 *              and combined data for specific locations. The popups include features like confidence
 *              level styling, expert and grant details, and interactive buttons for viewing profiles
 *              or opening panels.
 * 
 * Marina Mata, 2025
 */

// Generates HTML content for a popup displaying details about a single expert.
export const createSingleExpertContent = (locationName, entries, isPopup = true) => {
  try {
    // Ensure entries array is not empty
    if (!entries || entries.length === 0) {
      throw new Error("No entries available for this expert.");
    }

    // Extract the first entry
    const entry = entries[0];

    // Extract required fields from the entry
    const title = entry?.title || "No Title Available";
    const confidence = entry?.confidence || "Unknown";
    const issueDate = entry?.issued || "Unknown";
    const abstract = entry?.abstract || "No Abstract Available";

    // Extract related expert details
    const relatedExpert = entry?.relatedExperts?.[0];
    const expertName = relatedExpert?.name || "Unknown Expert";
    const expertURL = relatedExpert?.url || "#";

    // Helper function to style the confidence level
    const getConfidenceStyle = (confidenceValue) => {
      if (!confidenceValue) return { label: '', style: {} };
      if (confidenceValue.toLowerCase() === 'high') {
        return {
          label: 'High',
          style: 'background-color: #e8f5e9; color: #2e7d32; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        };
      } else if (confidenceValue.toLowerCase() === 'low') {
        return {
          label: 'Low',
          style: 'background-color: #ffebee; color: #c62828; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        };
      } else {
        return {
          label: confidenceValue,
          style: 'background-color: #f5f5f5; color: #757575; font-weight: bold; padding: 2px 5px; border-radius: 3px;',
        };
      }
    };

    const confidenceStyle = getConfidenceStyle(confidence);

    // Generate the HTML content for the popup
    return `
      <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
        <div style="font-weight: bold; font-size: 16px; color: #3879C7;">
          ${expertName}
        </div>
        <div style="font-size: 14px; color: #333; margin-top: 5px;">
          <strong>Location:</strong> ${locationName || "Unknown"}
        </div>
        <div style="font-size: 14px; color: #333; margin-top: 5px;">
          <strong>Confidence:</strong> <span style="${confidenceStyle.style}">${confidenceStyle.label}</span>
        </div>
        <div style="font-size: 14px; color: #333; margin-top: 5px;">
          <strong>Title:</strong> ${title}
        </div>
        <div style="font-size: 14px; color: #333; margin-top: 5px;">
          <strong>Issue Date:</strong> ${issueDate}
        </div>
        <a href='${expertURL}' 
           target='_blank'
           rel="noopener noreferrer"
           style="display: block; margin-top: 12px; padding: 8px 10px; background: #3879C7; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; opacity: ${expertURL !== "#" ? '1' : '0.6'}; cursor: ${expertURL !== "#" ? 'pointer' : 'default'}">
          ${expertURL !== "#" ? "View Profile" : "No Profile Found"}
        </a>
      </div>
    `;
  } catch (e) {
    console.error('Error in createSingleExpertContent:', e);
    return `
      <div style="color: red; font-size: 14px; padding: 15px;">
        Error generating content: ${e.message}
      </div>
    `;
  }
};

//Generates HTML content for a popup displaying details about multiple experts at a location.
export const createMultiExpertContent = (expertCount, locationName, totalWorks, matchedFields = []) => `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
    <div style="font-weight: bold; font-size: 16px; color: #3879C7;">
      ${expertCount} Expert${expertCount === 1 ? '' : 's'} in ${locationName}
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Related Works:</strong> ${totalWorks}
    </div>
    <a href='#'
       class="view-w-experts-btn"
       style="display: block; margin-top: 12px; padding: 8px 10px; background: #3879C7; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
      View Expert${expertCount === 1 ? '' : 's'}
    </a>
  </div>
`;

// Generates HTML content for a popup displaying the number of grants at a specific location.
export const createMultiGrantPopup = (expertCount, grantCount, locationName = []) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #eda012;'>
      ${expertCount} Expert${expertCount !== 1 ? 's' : ''} in ${locationName}
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Related Grants:</strong> ${grantCount}
    </div>
    <a href='#'
       class='view-g-experts-btn'
       style='display: block; margin-top: 12px; padding: 8px 10px; background: #eda012; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
      View Expert${expertCount === 1 ? '' : 's'}
    </a>
  </div>
`;


export const createCombinedPopup = (
  works2ExpertCount,
  grants2ExpertCount,
  locationName,
  totalWorks,
  totalGrants,
  combinedExpertCount
) => `
  <div style='padding: 15px; font-size: 14px; width: 250px;'>
    <div style='font-weight: bold; font-size: 16px; color: #659c39;'>
      ${combinedExpertCount} Expert${combinedExpertCount === 1 ? '' : 's'} in ${locationName}
    </div>
    <div style='margin-top: 5px;'>
      <div style='color: #555;'>
        <strong>Related Work${totalWorks > 1 ? 's' : ''}:</strong> ${totalWorks}
      </div>
      <div style='color: #555;'>
        <strong>Related Grant${totalGrants > 1 ? 's' : ''}:</strong> ${totalGrants}
      </div>
    </div>
    <a href='#'
      class='view-combined-btn'
      style='display: block; margin-top: 12px; padding: 8px 10px; background: #659c39; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;'>
      Open Panel
    </a>
  </div>
`;
