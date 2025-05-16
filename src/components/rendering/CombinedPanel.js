/**
 * @file CombinedPanel.js
 * @description This component displays a side panel with two tabs: "Works" and "Grants".
 *              It allows users to view detailed information about works and grants related
 *              to a specific location. The panel is interactive and includes features like
 *              tab switching, confidence level styling, and researcher profile links.
 *
 * PROPS:
 * - works: Array of work entries related to the location.
 * - grants: Array of grant entries related to the location.
 * - locationName: String representing the name of the location.
 * - onClose: Function to handle closing the panel.
 * - keyword: String used to filter works and grants.
 *
 * Marina Mata, 2025
 */

import React, { useState } from "react";

export const CombinedPanel = ({ works, grants, locationName, onClose, keyword }) => {
  // Convert the keyword to lowercase for case-insensitive filtering
  const lowerKeyword = (keyword || "").toLowerCase().trim();

  // Filter works and grants based on the keyword
  const filteredWorks = works.filter(entry =>
    JSON.stringify(entry).toLowerCase().includes(lowerKeyword)
  );

  const filteredGrants = grants.filter(entry =>
    JSON.stringify(entry).toLowerCase().includes(lowerKeyword)
  );


  // State to track the currently active tab ("works" or "grants")
  const [activeTab, setActiveTab] = useState("works");

  // State to track which expert's works and grants are expanded
  const [expandedWorkIndex, setExpandedWorkIndex] = useState(null);
  const [expandedGrantIndex, setExpandedGrantIndex] = useState(null);

  // Toggle functions for works and grants
  const toggleWorkDetails = (index) => {
    setExpandedWorkIndex(expandedWorkIndex === index ? null : index);
  };

  const toggleGrantDetails = (index) => {
    setExpandedGrantIndex(expandedGrantIndex === index ? null : index);
  };

  /**
  * getConfidenceStyle
  * @description Determines the style and label for the confidence level of a work or grant entry.
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

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "360px",
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
      <h2 style={{ marginTop: "0", marginBottom: "10px", color: "#659c39" }}>
        <strong>Location: {locationName}</strong>
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
          {filteredWorks.map((expert, index) => (

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
                {expert.name || "Unknown Expert"}
              </div>
              <div style={{ marginTop: "10px", }}>
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
                      <div style={{ fontSize: "0.85em", color: "#666", marginTop: "2px" }}>
                      (We are {expert.works[0].confidence}% confident that the extracted location is located in this area of the map.)
                      </div>
                    </div>
                    {expert.works[0].matchedFields?.length > 0 && (
                      <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                        Matched on: {expert.works[0].matchedFields.join(", ")}
                      </div>
                    )}


                    {/* Show dropdown button if there are more works */}
                    {expert.works.length > 1 && (
                      <button
                        onClick={() => toggleWorkDetails(index)}
                        style={{
                          marginTop: "10px",
                          padding: "5px 10px",
                          background: "#3879C7",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointerexpert",
                          fontSize: "14px",
                        }}
                      >
                        {expandedWorkIndex === index ? "Hide More Works" : "Show More Works"}
                      </button>
                    )}

                    {/* Show additional works if expanded */}
                    {expandedWorkIndex === index && (
                      <ul style={{ marginTop: "10px", }}>
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
      )}

      {/* Grants Tab Content */}
      {activeTab === "grants" && (
        <ul style={{ padding: 0, listStyle: "none" }}>
          {filteredGrants.map((expert, index) => (
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
                <strong>
                  {expert.grants.length === 1 ? "Grant Title" : "Grant Titles"}:
                </strong> {expert.grants[0].title || "Untitled Grant"} <br />
                <strong>Funder:</strong> {expert.grants[0].funder || "Unknown"} <br />
                <strong>Start Date:</strong> {expert.grants[0].startDate || "Unknown"} <br />
                <strong>End Date:</strong> {expert.grants[0].endDate || "Unknown"} <br />
                <strong>Confidence:</strong>{" "}
                <span style={getConfidenceStyle(expert.grants[0].confidence).style}>
                  {getConfidenceStyle(expert.grants[0].confidence).label}
                </span>
                <div style={{ fontSize: "0.85em", color: "#666", marginTop: "2px" }}>
                (We are {expert.grants[0].confidence}% confident that the extracted location is located in this area of the map.)
                </div>
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
                  {expandedGrantIndex === index
                    ? "Hide More Grants"
                    : "Show More Grants"}
                </button>
              )}

              {/* Show additional grants if expanded */}
              {expandedGrantIndex === index && (
                <ul style={{ marginTop: "10px", }}>
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
      )}
    </div>
  );
};