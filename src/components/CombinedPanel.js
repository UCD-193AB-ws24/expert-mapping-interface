// componentsCombinedPanel.js
import React, { useState } from "react";

export const CombinedPanel = ({ works, grants, onClose }) => {
  const [activeTab, setActiveTab] = useState("works");
  const locationName = works[0]?.location_name || grants[0]?.location_name || "Unknown";

  // Helper function to get work titles with error handling
  const getWorkTitles = (expert) => {
    try {
      const titles = expert.work_titles;
      
      if (!titles) return [];
      
      if (Array.isArray(titles)) {
        return titles;
      }

      if (typeof titles === 'string') {
        try {
          const parsed = JSON.parse(titles);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      }

      return [];
    } catch (e) {
      return [];
    }
  };

  // Helper function for confidence styling
  const getConfidenceStyle = (confidenceValue) => {
    if (!confidenceValue) return { label: '', style: {} };

    if (confidenceValue === 'high' || confidenceValue === 'High') {
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

      <h2 style={{ marginTop: "0", marginBottom: "10px", color: "#10b981" }}>
        Location: {locationName}
      </h2>

      {/* Tab navigation */}
      <div style={{ display: "flex", marginBottom: "15px", borderBottom: "1px solid #eaeaea" }}>
        <button 
          onClick={() => setActiveTab("works")}
          style={{
            flex: 1,
            padding: "8px",
            background: activeTab === "works" ? "#13639e" : "#e5e7eb",
            color: activeTab === "works" ? "white" : "#333",
            border: "none",
            borderTopLeftRadius: "5px",
            borderBottomLeftRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Works ({works.length})
        </button>
        <button 
          onClick={() => setActiveTab("grants")}
          style={{
            flex: 1,
            padding: "8px",
            background: activeTab === "grants" ? "#f59e0b" : "#e5e7eb",
            color: activeTab === "grants" ? "white" : "#333",
            border: "none",
            borderTopRightRadius: "5px",
            borderBottomRightRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Grants ({grants.length})
        </button>
      </div>

      {/* Works tab content */}
      {activeTab === "works" && (
        <div>
          <ul style={{ padding: 0, listStyle: 'none' }}>
            {works
              .sort((a, b) => a.researcher_name.localeCompare(b.researcher_name))
              .map((expert, index) => {
                const workTitles = getWorkTitles(expert);
                const confidence = expert.confidence;
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
                      {expert.researcher_name}
                    </div>
                    <div style={{ marginTop: "5px", color: "#333" }}>
                      {confidence && (
                        <div><strong>Confidence:</strong> <span style={confidenceStyle.style}>{confidenceStyle.label}</span></div>
                      )}
                    </div>
                    <div style={{ marginTop: "10px", color: "#333" }}>
                      <strong>Related Works {expert.work_count}:</strong>
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
                      href={expert.researcher_url || "#"}
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
                        opacity: expert.researcher_url ? '1' : '0.6',
                        cursor: expert.researcher_url ? 'pointer' : 'default'
                      }}
                    >
                      {expert.researcher_url ? "View Profile" : "No Profile Found"}
                    </a>
                  </div>
                );
              })}
          </ul>
        </div>
      )}

      {/* Grants tab content */}
      {activeTab === "grants" && (
        <div>
          <ul style={{ padding: 0, listStyle: 'none' }}>
            {grants.map((grant, index) => {
              const rawTitle = grant.title || "";
              const cleanTitle = rawTitle.split("§")[0].trim().replace(/^"+|"+$/g, "");
              
              return (
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
                    <strong>Researcher: </strong>{grant.researcher_name || "Unknown"}
                  </div>

                  <div style={{ marginTop: "5px", color: "#333" }}>
                    <strong>Grant: </strong>{cleanTitle || "Untitled Grant"}
                  </div>

                  <div style={{ marginTop: "5px", color: "#333" }}>
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
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};