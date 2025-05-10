/**
 * @file Panels.js
 * @description This file contains components for rendering side panels that display detailed
 *              information about works, grants, and combined data for a specific location.
 *              The panels include features like keyword filtering, confidence level styling,
 *              and expandable lists for works and grants.
 *
 * COMPONENTS:
 * - WorksPanel: Displays a list of works associated with a location.
 * - GrantsPanel: Displays a list of grants associated with a location.
 * - CombinedPanel: Displays a side panel with two tabs: "Works" and "Grants".
 *
 * Marina Mata, 2025
 */
import React, { useState } from "react";

/**
 * Helper function to style confidence levels.
 * @param {string} confidenceValue - The confidence level (e.g., "High", "Low").
 * @returns {object} An object containing the label and style for the confidence level.
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
 * @description Displays a side panel with a list of works associated with a specific location.
 *              Includes keyword filtering and expandable lists for works.
 * @param {Array} works - Array of work entries.
 * @param {Function} onClose - Function to handle closing the panel.
 * @param {string} panelType - Type of the panel (e.g., "works").
 * @param {string} keyword - Keyword used for filtering works.
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
          color: "#666",
        }}
      >
        ×
      </button>

       {/* Panel Header */}
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#3879C7" }}>
        <strong>{filteredExperts.length} Expert{filteredExperts.length !== 1 ? "s" : ""} at this Location</strong>
      </h2>

      {/* List of Experts */}
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
            {/* Expert Name */}
            <div
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                color: "#3879C7",
              }}
            >
              {expert.name}
            </div>

            {/* Display the first work */}
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
                  {expert.works[0].matchedFields?.length > 0 && (
                    <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                      Matched on: {expert.works[0].matchedFields.join(", ")}
                    </div>
                  )}


                  {/* Show dropdown button if there are more works */}
                  {expert.works.length > 1 && (
                    <button
                      onClick={() => toggleWorksVisibility(index)}
                      style={{
                        marginTop: "10px",
                        padding: "5px 10px",
                        background: "#3879C7",
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
                            {work.matchedFields?.length > 0 && (
                              <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                                Matched on: {work.matchedFields.join(", ")}
                              </div>
                            )}
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
                background: "#3879C7",
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
 * @description Displays a side panel with a list of grants associated with a specific location.
 *              Includes keyword filtering and expandable lists for grants.
 * @param {Array} grants - Array of grant entries.
 * @param {Function} onClose - Function to handle closing the panel.
 * @param {string} keyword - Keyword used for filtering grants.
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
          color: "#666",
        }}
      >
        ×
      </button>

      {/* Panel Header */}
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#eda012" }}>
        <strong>{filteredExperts.length} Expert{filteredExperts.length !== 1 ? "s" : ""} at this Location </strong>
      </h2>

      {/* List of Experts */}
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
            {/* Expert Name */}
            <div
              style={{
                fontWeight: "bold",
                fontSize: "16px",
                color: "#eda012",
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
            {expert.grants[0].matchedFields?.length > 0 && (
              <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                Matched on: {expert.grants[0].matchedFields.join(", ")}
              </div>
            )}


            {/* Show dropdown button if there are more grants */}
            {expert.grants.length > 1 && (
              <button
                onClick={() => toggleGrantDetails(index)}
                style={{
                  marginTop: "10px",
                  padding: "5px 10px",
                  background: "#3879C7",
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
                    {grant.matchedFields?.length > 0 && (
                      <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                        Matched on: {grant.matchedFields.join(", ")}
                      </div>
                    )}
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
                background: "#eda012",
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
 * @description Displays a side panel with two tabs: "Works" and "Grants" for a specific location.
 *              Includes keyword filtering, confidence level styling, and expandable lists for works and grants.
 * @param {Array} works - Array of work entries related to the location.
 * @param {Array} grants - Array of grant entries related to the location.
 * @param {string} locationName - Name of the location being displayed.
 * @param {Function} onClose - Function to handle closing the panel.
 * @param {string} keyword - Keyword used for filtering works and grants.
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
            background: activeTab === "works" ? "#3879C7" : "#e5e7eb",
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
            background: activeTab === "grants" ? "#eda012" : "#e5e7eb",
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
                  color: "#3879C7",
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
                          background: "#3879C7",
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
                  background: "#3879C7",
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
      )}

      {/* Grants Tab Content */}
      {activeTab === "grants" && (
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
                  color: "#eda012",
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
                    background: "#3879C7",
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
                  background: "#eda012",
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
      )}
    </div>
  );
};