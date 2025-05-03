/**
 * WorksPanel Component
 * 
 * This component renders a side panel displaying a list of experts associated with a specific location.
 * It supports both point and polygon data and provides detailed information about each expert, including
 * their name, location, confidence level, and related works.
 * 
 * Props:
 * - experts: Array of expert-related data to display in the panel.
 * - onClose: Function to handle closing the panel.
 * - panelType: String indicating the type of data ("polygon" or "point").
 */

import React, { useState } from "react";

/**
 * Helper function to style confidence levels.
 */
const getConfidenceStyle = (confidenceValue) => {
  if (!confidenceValue) return { label: '', style: {} };

  if (confidenceValue.toLowerCase() === 'high') {
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
  } else if (confidenceValue.toLowerCase() === 'low') {
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


/**
 * WorksPanel Component
 */
export const WorksPanel = ({ works = [], onClose, panelType, keyword = "" }) => {
  const lowerKeyword = (keyword || "").toLowerCase().trim();

  // Apply keyword filtering
  const filteredExperts = works.filter((expert) => {
    if (!keyword) return true;
    const searchableText = [
      expert.name,
      ...expert.works.map((work) => work.title),
    ]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(lowerKeyword);
  });

  // State to track which expert's works are expanded
  const [expandedExpertIndex, setExpandedExpertIndex] = useState(null);

  const toggleWorksVisibility = (index) => {
    setExpandedExpertIndex(expandedExpertIndex === index ? null : index);
  };

  return (
    <div
      style={{
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
        zIndex: 1001,
      }}
    >
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
          color: "#666",
        }}
      >
        ×
      </button>
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#13639e" }}>
        {filteredExperts.length} Expert{filteredExperts.length !== 1 ? "s" : ""} at this Location
      </h2>

      <ul style={{ padding: 0, listStyle: "none" }}>
        {filteredExperts.map((expert, index) => (
          <li
            key={index}
            style={{
              position: "relative",
              padding: "15px",
              fontSize: "14px",
              lineHeight: "1.5",
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: "5px",
              marginBottom: "15px",
              background: "#f9f9f9",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                color: "#13639e",
              }}
            >
              {expert.name}
            </div>
            <div style={{ marginTop: "10px", paddingLeft: "10px" }}>
              {expert.works.length > 0 && (
                <>
                  {/* Show the first work by default */}
                  <div>
                    <strong>Title:</strong> {expert.works[0].title} <br />
                    <strong>Issued:</strong> {expert.works[0].issued} <br />
                    <strong>Confidence:</strong>{" "}
                    <span style={getConfidenceStyle(expert.works[0].confidence).style}>
                      {getConfidenceStyle(expert.works[0].confidence).label}
                    </span>
                  </div>

                  {/* Show dropdown button if there are more works */}
                  {expert.works.length > 1 && (
                    <button
                      onClick={() => toggleWorksVisibility(index)}
                      style={{
                        marginTop: "10px",
                        padding: "5px 10px",
                        background: "#13639e",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      {expandedExpertIndex === index ? "Hide More Works" : "Show More Works"}
                    </button>
                  )}

                  {/* Show additional works if expanded */}
                  {expandedExpertIndex === index && (
                    <ul style={{ marginTop: "10px", paddingLeft: "20px" }}>
                      {expert.works.slice(1).map((work, workIndex) => {
                        const { label, style } = getConfidenceStyle(work.confidence);
                        return (
                          <li key={workIndex} style={{ marginBottom: "10px" }}>
                            <strong>Title:</strong> {work.title} <br />
                            <strong>Issued:</strong> {work.issued} <br />
                            <strong>Confidence:</strong>{" "}
                            <span style={style}>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
            <a
              href={expert.url || "#"}
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
                opacity: expert.url ? "1" : "0.6",
                cursor: expert.url ? "pointer" : "default",
              }}
            >
              {expert.url ? "View Profile" : "No Profile Found"}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * GrantsPanel Component
 * 
 * This component renders a side panel displaying a list of grants associated with a specific location.
 * It provides detailed information about each grant, including the title, researcher, location, and funder.
 * 
 * Props:
 * - grants: Array of grant-related data to display in the panel.
 * - onClose: Function to handle closing the panel.
 */
export const GrantsPanel = ({ grants, onClose, keyword }) => {
  const grantEntries = grants.flatMap(g => g.properties.entries || []);
  console.log(grantEntries);
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
      {/* Close button for the panel */}
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

      {/* Header displaying the total number of grants */}
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#f59e0b" }}>
      <h2>{grantEntries.length} Grant{grantEntries.length !== 1 ? 's' : ''} at this Location</h2>
      </h2>
      {/* List of grants */}
      <ul style={{ padding: 0, listStyle: 'none' }}>
        {grants.map((feature, index) => (
          feature.properties.entries.map((entry, subIndex) => (
            <li key={`${index}-${subIndex}`} style={{
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
                <strong>Researcher:</strong> {entry.relatedExperts?.[0].fullName || "Unknown"}<br />
                <strong>Location:</strong> {feature.properties.location || "Unknown"}<br />
                <strong>Funder:</strong> {entry.funder || "Unknown"}<br />
                <strong>Grant Title:</strong> {entry.title || "Untitled Grant"}<br />
              </div>
              <a
                href={entry.relatedExperts?.[0].url ? `https://experts.ucdavis.edu/${entry.relatedExperts?.[0].url}` : "#"}
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
                  opacity: entry.relatedExperts?.[0].url ? '1' : '0.6',
                  cursor: entry.relatedExperts?.[0].url ? 'pointer' : 'default'
                }}
              >
                {entry.relatedExperts?.[0].url ? "View Researcher Profile" : "No Profile Found"}
              </a>
            </li>
          ))
        )
          )}
      </ul>

    </div>
  );
};