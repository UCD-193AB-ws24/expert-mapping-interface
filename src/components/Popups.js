// components/map/Popups.js

export const createSingleResearcherContent = (researcher, isPopup = true) => {
    let workTitles = [];
    try {
      const titles = researcher.work_titles || researcher.properties?.work_titles;
      console.log('Raw work titles in createSingleResearcherContent:', titles);
      console.log('Type of work titles in createSingleResearcherContent:', typeof titles);
      
      if (Array.isArray(titles)) {
        console.log('Titles is already an array:', titles);
        workTitles = titles;
      } else if (typeof titles === 'string') {
        console.log('Titles is a string:', titles);
        try {
          workTitles = JSON.parse(titles);
          console.log('Successfully parsed work titles:', workTitles);
        } catch (e) {
          console.error('Error parsing work titles string:', e);
          workTitles = [];
        }
      }
    } catch (e) {
      console.error('Error in createSingleResearcherContent:', e);
      workTitles = [];
    }
  
    const confidence = researcher.confidence || researcher.properties?.confidence;
  
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
  
    return `
      <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
        <div style="font-weight: bold; font-size: 16px; color: #13639e;">
          ${researcher.researcher_name || researcher.properties?.researcher_name || "Unknown"}
        </div>
        <div style="font-size: 14px; color: #333; margin-top: 5px;">
          <strong>Location:</strong> ${researcher.location_name || researcher.properties?.location_name || "Unknown"}
          ${confidence ? 
            `<div><strong>Confidence:</strong> <span style="${confidenceStyle.style}">${confidenceStyle.label}</span></div>` 
            : ''}
        </div>
        <div style="font-size: 14px; color: #333; margin-top: 5px;">
          <strong>Related Works ${researcher.work_count || researcher.properties?.work_count || 0}:</strong>
          ${workTitles && workTitles.length > 0 ? `
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${workTitles.slice(0, 3).map(title => 
                `<li style="margin-bottom: 3px;">${title}</li>`
              ).join('')}
              ${workTitles.length > 3 ? 
                `<li style="list-style: none; font-style: italic;">... and ${workTitles.length - 3} more</li>` : ''}
            </ul>
          ` : '<div style="margin-top: 3px;">No works found</div>'}
        </div>
        <a href='${researcher.researcher_url || researcher.properties?.researcher_url || "#"}' 
           target='_blank'
           rel="noopener noreferrer"
           style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; opacity: ${(researcher.researcher_url || researcher.properties?.researcher_url) ? '1' : '0.6'}; cursor: ${(researcher.researcher_url || researcher.properties?.researcher_url) ? 'pointer' : 'default'}">
          ${(researcher.researcher_url || researcher.properties?.researcher_url) ? "View Profile" : "No Profile Found"}
        </a>
      </div>
    `;
  };
  
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
  
  export const createGrantPopupContent = (grant) => {
    const rawTitle = grant.title || "";
    const cleanTitle = rawTitle.split("§")[0].trim().replace(/^"+|"+$/g, ""); // remove leading/trailing quotes
  
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
  