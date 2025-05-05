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
            {/* View Experts Button */}
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
 */


export const GrantsPanel = ({ grants = [], onClose, keyword = "" }) => {
  const lowerKeyword = (keyword || "").toLowerCase().trim();

  // Apply keyword filtering
  const filteredExperts = grants.filter((expert) => {
    if (!keyword) return true;
    const searchableText = [
      expert.name,
      ...expert.grants.map((grant) => grant.title),
    ]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(lowerKeyword);
  });

  // State to track which expert's grants are expanded
  const [expandedExpertIndex, setExpandedExpertIndex] = useState(null);

  const toggleGrantDetails = (index) => {
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
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#f59e0b" }}>
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
              border: "1px solid #ddd",
              borderRadius: "5px",
              marginBottom: "15px",
              background: "#f9f9f9",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                color: "#f59e0b",
              }}
            >
              {expert.name || "Unknown Expert"}
            </div>

            {/* Show the first grant by default */}
            <div style={{ marginTop: "10px", color: "#333" }}>
              <strong>Title:</strong> {expert.grants[0].title || "Untitled Grant"} <br />
              <strong>Funder:</strong> {expert.grants[0].funder || "Unknown"} <br />
              <strong>Start Date:</strong> {expert.grants[0].startDate || "Unknown"} <br />
              <strong>End Date:</strong> {expert.grants[0].endDate || "Unknown"} <br />
              <strong>Confidence:</strong>{" "}
              <span style={getConfidenceStyle(expert.grants[0].confidence).style}>
                {getConfidenceStyle(expert.grants[0].confidence).label}
              </span>
            </div>

            {/* Show dropdown button if there are more grants */}
            {expert.grants.length > 1 && (
              <button
                onClick={() => toggleGrantDetails(index)}
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
                {expandedExpertIndex === index
                  ? "Hide More Grants"
                  : "Show More Grants"}
              </button>
            )}

            {/* Show additional grants if expanded */}
            {expandedExpertIndex === index && (
              <ul style={{ marginTop: "10px", paddingLeft: "20px" }}>
                {expert.grants.slice(1).map((grant, grantIndex) => (
                  <li key={grantIndex} style={{ marginBottom: "10px" }}>
                    <strong>Title:</strong> {grant.title || "Untitled Grant"} <br />
                    <strong>Funder:</strong> {grant.funder || "Unknown"} <br />
                    <strong>Start Date:</strong> {grant.startDate || "Unknown"} <br />
                    <strong>End Date:</strong> {grant.endDate || "Unknown"} <br />
                    <strong>Confidence:</strong>{" "}
                    <span style={getConfidenceStyle(grant.confidence).style}>
                      {getConfidenceStyle(grant.confidence).label}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* View Profile Button */}
            <a
              href={expert.url || "#"}
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
 * CombinedPanel Component
 * 
 * This component displays a side panel with two tabs: "Works" and "Grants".
 * It allows users to view detailed information about works and grants related
 * to a specific location. The panel is interactive and includes features like
 * tab switching, confidence level styling, and researcher profile links.
 * 
 * Props:
 * - works: Array of work entries related to the location.
 * - grants: Array of grant entries related to the location.
 * - locationName: String representing the name of the location.
 * - onClose: Function to handle closing the panel.
 */
export const CombinedPanel = ({ works, grants, locationName, onClose, keyword }) => {
  const lowerKeyword = (keyword || "").toLowerCase().trim();

  const filteredWorks = works.filter(entry =>
    JSON.stringify(entry).toLowerCase().includes(lowerKeyword)
  );

  const filteredGrants = grants.filter(entry =>
    JSON.stringify(entry).toLowerCase().includes(lowerKeyword)
  );


  // State to track the currently active tab ("works" or "grants")
  const [activeTab, setActiveTab] = useState("works");

  /**
   * getConfidenceStyle
   * 
   * Determines the style and label for the confidence level of a work entry.
   * 
   * @param {string} confidenceValue - The confidence level (e.g., "High", "Low").
   * @returns {object} An object containing the label and style for the confidence level.
   */

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
      {/* Close Button */}
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

      {/* Location Header */}
      <h2 style={{ marginTop: "0", marginBottom: "10px", color: "#6CCA98" }}>
        Location: {locationName}
      </h2>

      {/* Tab Navigation */}
      <div style={{ display: "flex", marginBottom: "15px", borderBottom: "1px solid #eaeaea" }}>
        {/* Works Tab Button */}
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
          Works ({filteredWorks.length})
        </button>

        {/* Grants Tab Button */}
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
          Grants ({filteredGrants.length})
        </button>
      </div>

      {/* Works Tab Content */}
      {activeTab === "works" && (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {filteredWorks.map((entry, index) => {
            const relatedExpert = entry.relatedExperts?.[0] || {};
            console.log(relatedExpert);
            const researcherName = relatedExpert.fullName || entry.authors?.join(", ") || "Unknown";
            console.log(researcherName);
            const researcherURL = relatedExpert.url ? `https://experts.ucdavis.edu/${relatedExpert.url}` : null;
            const confidenceStyle = getConfidenceStyle(entry.confidence);

            return (
              <li key={index} style={{
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
                {/* Researcher Name */}
                <div style={{ fontWeight: "bold", fontSize: "16px", color: "#13639e" }}>
                  {researcherName}
                </div>
                {/* Issued Date and Confidence */}
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Issued:</strong> {entry.issued || "Unknown"}
                  {entry.confidence && (
                    <div><strong>Confidence:</strong> <span style={confidenceStyle.style}>{confidenceStyle.label}</span></div>
                  )}
                </div>
                {/* Work Title */}
                <div style={{ marginTop: "10px", color: "#333" }}>
                  <strong>Title:</strong>
                  <div style={{ marginTop: "3px" }}>{entry.title || "Untitled"}</div>
                </div>
                {/* Researcher Profile Link */}
                <a
                  href={researcherURL || "#"}
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
                    opacity: researcherURL ? '1' : '0.6',
                    cursor: researcherURL ? 'pointer' : 'default'
                  }}
                >
                  {researcherURL ? "View Profile" : "No Profile Found"}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/* Grants Tab Content */}
      {activeTab === "grants" && (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {filteredGrants.map((grant, index) => {
            console.log(grant);
            const relatedExpert = grant.relatedExperts?.[0] || {};
            console.log(relatedExpert);
            const expertName = relatedExpert.fullName || "Unknown";
            console.log(expertName);
            const expertURL = relatedExpert.url ? `https://experts.ucdavis.edu/${relatedExpert.url}` : null;
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
                {/* Researcher Name */}
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Researcher: </strong>{expertName}
                </div>
                {/* Grant Title */}
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Grant: </strong>{grant.title || "Untitled Grant"}
                </div>
                {/* Funder */}
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Funder:</strong> {grant.funder || "Unknown"}
                </div>
                {/* Researcher Profile Link */}
                <a
                  href={expertURL || "#"}
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
                    opacity: expertURL ? '1' : '0.6',
                    cursor: expertURL  ? 'pointer' : 'default'
                  }}
                >
                  {expertURL ? "View Researcher Profile" : "No Profile Found"}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};