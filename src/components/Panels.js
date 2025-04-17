// components/map/Panels.js

import React from "react";

// 🔷 Expert side panel (for points and polygons)
export const ExpertsPanel = ({ experts, onClose, panelType }) => {
  const isFromProperties = panelType === "polygon";

  const getWorkTitles = (expert) => {
    try {
      const titles = isFromProperties ? expert.properties.work_titles : expert.work_titles;
      console.log('Raw work titles in ExpertsPanel:', titles);
      console.log('Type of work titles in ExpertsPanel:', typeof titles);
      
      if (!titles) return [];
      
      if (Array.isArray(titles)) {
        console.log('Titles is already an array:', titles);
        return titles;
      }

      if (typeof titles === 'string') {
        console.log('Titles is a string:', titles);
        try {
          const parsed = JSON.parse(titles);
          console.log('Successfully parsed work titles:', parsed);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.error('Error parsing work titles string:', e);
          return [];
        }
      }

      return [];
    } catch (e) {
      console.error('Error in getWorkTitles:', e);
      return [];
    }
  };

  const getConfidenceStyle = (confidenceValue) => {
    console.log('Raw confidence in getConfidenceStyle:', confidenceValue, typeof confidenceValue);

    if (!confidenceValue) return { label: '', style: {} };

    if (confidenceValue === 'high' || confidenceValue === 'High') {
      console.log('Using HIGH confidence styling in panel');
      return {
        label: 'High',
        style: {
          backgroundColor: '#e8f5e9',
          color: '#2e7d32',
          fontWeight: 'bold',
          padding: '2px 5px',
          borderRadius: '3px',
          display: 'inline-block'
        }
      };
    } else if (confidenceValue === 'low' || confidenceValue === 'Low') {
      console.log('Using LOW confidence styling in panel');
      return {
        label: 'Low',
        style: {
          backgroundColor: '#ffebee',
          color: '#c62828',
          fontWeight: 'bold',
          padding: '2px 5px',
          borderRadius: '3px',
          display: 'inline-block'
        }
      };
    } else {
      console.log('No specific confidence styling for:', confidenceValue);
      return {
        label: confidenceValue,
        style: {
          backgroundColor: '#f5f5f5',
          color: '#757575',
          fontWeight: 'bold',
          padding: '2px 5px',
          borderRadius: '3px',
          display: 'inline-block'
        }
      };
    }
  };

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "300px",
      marginTop: "140px",
      backgroundColor: "white",
      boxShadow: "-2px 0 5px rgba(0,0,0,0.2)",
      padding: "20px",
      overflowY: "auto",
      zIndex: 1001
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          right: "10px",
          top: "10px",
          border: "none",
          background: "none",
          fontSize: "20px",
          cursor: "pointer",
          color: "#666"
        }}
      >
        ×
      </button>

      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#13639e" }}>
        {experts.length} Expert{experts.length !== 1 ? 's' : ''} at this Location 
        
      </h2>

      <ul style={{ padding: 0, listStyle: 'none' }}>
        {experts
          .sort((a, b) => {
            const nameA = isFromProperties ? a.properties.researcher_name : a.researcher_name;
            const nameB = isFromProperties ? b.properties.researcher_name : b.researcher_name;
            return nameA.localeCompare(nameB);
          })
          .map((expert, index) => {
            const workTitles = getWorkTitles(expert);
            const confidence = isFromProperties ? expert.properties.confidence : expert.confidence;
            const confidenceStyle = getConfidenceStyle(confidence);

            return (
              <div key={index} style={{
                position: "relative",
                padding: "15px",
                fontSize: "14px",
                lineHeight: "1.5",
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "5px",
                marginBottom: "15px",
                background: "#f9f9f9"
                
              }}>
                <div style={{ fontWeight: "bold", fontSize: "16px", color: "#13639e" }}>
                  {isFromProperties ? expert.properties.researcher_name : expert.researcher_name}
                </div>
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Location:</strong> {isFromProperties ? expert.properties.location_name : expert.location_name}
                  {confidence && (
                    <div><strong>Confidence:</strong> <span style={confidenceStyle.style}>{confidenceStyle.label}</span></div>
                  )}
                </div>
                <div style={{ marginTop: "10px", color: "#333" }}>
                  <strong>Related Works {isFromProperties ? expert.properties.work_count : expert.work_count}:</strong>
                  {workTitles.length > 0 ? (
                    <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                      {workTitles.slice(0, 3).map((title, i) => (
                        <li key={i} style={{ marginBottom: "3px" }}>{title}</li>
                      ))}
                      {workTitles.length > 3 && (
                        <li style={{ listStyle: "none", fontStyle: "italic" }}>
                          ... and {workTitles.length - 3} more
                        </li>
                      )}
                    </ul>
                  ) : (
                    <div style={{ marginTop: "3px" }}>No works found</div>
                  )}
                </div>
                <a
                  href={isFromProperties ? expert.properties.researcher_url : expert.researcher_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    marginTop: "12px",
                    padding: "8px 10px",
                    background: "#13639e",
                    color: "white",
                    textAlign: "center",
                    borderRadius: "5px",
                    textDecoration: "none",
                    fontWeight: "bold",
                    opacity: (isFromProperties ? expert.properties.researcher_url : expert.researcher_url) ? '1' : '0.6',
                    cursor: (isFromProperties ? expert.properties.researcher_url : expert.researcher_url) ? 'pointer' : 'default'
                  }}
                >
                  {(isFromProperties ? expert.properties.researcher_url : expert.researcher_url) ? "View Profile" : "No Profile Found"}
                </a>
              </div>
            );
          })}
      </ul>
    </div>
  );
};


// 🟡 Grant side panel
export const GrantsPanel = ({ grants, onClose }) => {
  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "300px",
      marginTop: "140px",
      backgroundColor: "white",
      boxShadow: "-2px 0 5px rgba(0,0,0,0.2)",
      padding: "20px",
      overflowY: "auto",
      zIndex: 1001
    }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          right: "10px",
          top: "10px",
          border: "none",
          background: "none",
          fontSize: "20px",
          cursor: "pointer",
          color: "#666"
        }}
      >
        ×
      </button>

      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#f59e0b" }}>
        {grants.length} Grant{grants.length !== 1 ? 's' : ''} at this Location 
        
      </h2>

      <ul style={{ padding: 0, listStyle: 'none' }}>
        {grants.map((grant, index) => (
          <li key={index} style={{
            position: "relative",
            padding: "15px",
            fontSize: "14px",
            lineHeight: "1.5",
            width: "100%",
            border: "1px solid #ddd",
            borderRadius: "5px",
            marginBottom: "15px",
            background: "#f9f9f9"
          }}>

            <div style={{ marginTop: "5px", color: "#333" }}>
              <strong>Grant:</strong> {grant.title || "Untitled Grant"}<br />
              <strong>Researcher:</strong> {grant.researcher_name  || "Unknown"}<br />
              <strong>Location:</strong> {grant.location_name || "Unknown"}<br />
              <strong>Funder:</strong> {grant.funder || "Unknown"}
            </div>

            <a
              href={grant.researcher_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                marginTop: "12px",
                padding: "8px 10px",
                background: "#f59e0b",
                color: "white",
                textAlign: "center",
                borderRadius: "5px",
                textDecoration: "none",
                fontWeight: "bold",
                opacity: grant.researcher_url ? '1' : '0.6',
                cursor: grant.researcher_url ? 'pointer' : 'default'
              }}
            >
              {grant.researcher_url ? "View Researcher Profile" : "No Profile Found"}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};
