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

//Helper function to style confidence levels.
export const getConfidenceStyle = (confidenceValue) => {
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

// Displays a side panel with a list of works associated with a specific location.
// Includes keyword filtering and expandable lists for works.
export const WorksPanel = ({ works = [], onClose }) => {

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
        width: "100vw",
        maxWidth: "400px",
        marginTop: "140px",
        backgroundColor: "white",
        boxShadow: "-2px 0 5px rgba(0,0,0,0.2)",
        padding: "20px",
        overflowY: "auto",
        zIndex: 2000,
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
        <strong>{works.length} Expert{works.length !== 1 ? "s" : ""} in {works[0].location} </strong>
      </h2>

      {/* List of Experts */}
      <ul style={{ padding: 0, listStyle: "none" }}>
        {works.map((expert, index) => (
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
            <div style={{ marginTop: "10px" }}>
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
                      {expert.works[0].matchedFields.map((f, i) => (
                        <div key={i}>
                          <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                        </div>
                      ))}
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
                    <ul style={{ marginTop: "10px" }}>
                      {expert.works.slice(1).map((work, workIndex) => {
                        const { label, style } = getConfidenceStyle(work.confidence);
                        return (
                          <li key={workIndex} style={{ marginBottom: "10px" }}>
                            <strong>Title:</strong> {work.title} <br />
                            <strong>Issued:</strong> {work.issued} <br />
                            <strong>Confidence:</strong>{" "}
                            <span style={style}>{label}</span>
                            {Array.isArray(expert.works[0].matchedFields) && expert.works[0].matchedFields.length > 0 && (
                              <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                                {expert.works[0].matchedFields.map((f, i) => (
                                  <div key={i}>
                                    <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                                  </div>
                                ))}
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

// Displays a side panel with a list of grants associated with a specific location.
// Includes keyword filtering and expandable lists for grants.
export const GrantsPanel = ({ grants = [], onClose }) => {

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
        width: "100vw",
        maxWidth: "400px",
        marginTop: "140px",
        backgroundColor: "white",
        boxShadow: "-2px 0 5px rgba(0,0,0,0.2)",
        padding: "20px",
        overflowY: "auto",
        zIndex: 2000,
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
        {/* <strong>{grants.length} Expert{grants.length !== 1 ? "s" : ""} in {grants[0].locationID} </strong> */}
        <strong>{grants.length} Expert{grants.length !== 1 ? "s" : ""} in {grants[0]?.location || "Unknown location"}</strong>
      </h2>

      {/* List of Experts */}
      <ul style={{ padding: 0, listStyle: "none" }}>
        {grants.map((expert, index) => (
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
            {Array.isArray(expert.grants[0].matchedFields) && expert.grants[0].matchedFields.length > 0 && (
              <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                {expert.grants[0].matchedFields.map((f, i) => (
                  <div key={i}>
                    <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                  </div>
                ))}
              </div>
            )}

            {/* Show dropdown button if there are more grants */}
            {expert.grants.length > 1 && (
              <button
                onClick={() => toggleGrantDetails(index)}
                style={{
                  marginTop: "10px",
                  padding: "5px 10px",
                  background: "#eda012",
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
              <ul style={{ marginTop: "10px" }}>
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
                    <div style={{ fontSize: "0.85em", color: "#666", marginTop: "2px" }}>
                      (We are {expert.grants[0].confidence}% confident that the extracted location is located in this area of the map.)
                    </div>
                    {Array.isArray(grant.matchedFields) && grant.matchedFields.length > 0 && (
                      <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                        {grant.matchedFields.map((f, i) => (
                          <div key={i}>
                            <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                          </div>
                        ))}
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

// Displays a side panel with two tabs: "Works" and "Grants" for a specific location.
// Includes keyword filtering, confidence level styling, and expandable lists for works and grants
export const CombinedPanel = ({ works, grants, onClose }) => {
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
  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 0,
      bottom: 0,
      width: "100vw",
      maxWidth: "400px",
      marginTop: "140px",
      backgroundColor: "white",
      boxShadow: "-2px 0 5px rgba(0,0,0,0.2)",
      padding: "20px",
      overflowY: "auto",
      zIndex: 2000,
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
    {/* Expert count at Location */}
      <h2 style={{ marginTop: "0", marginBottom: "10px", color: "#659c39" }}>
        {(() => {
          const expertIDs = new Set([
            ...works.map((e) => e.id || e.name),
            ...grants.map((e) => e.id || e.name),
          ]);
          return (
            <strong>
              {expertIDs.size} Expert{expertIDs.size === 1 ? '' : 's'} in {grants[0]?.location || "this area"}
            </strong>
          );
        })()}
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
          Works ({works.length})
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
          Grants ({grants.length})
        </button>
      </div>

      {/* Works Tab Content */}
      {activeTab === "works" && (
        <ul style={{ padding: 0, listStyle: "none" }}>
          {works.map((expert, index) => (

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
                    {Array.isArray(expert.works[0].matchedFields) && expert.works[0].matchedFields.length > 0 && (
                      <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                        {expert.works[0].matchedFields.map((f, i) => (
                          <div key={i}>
                            <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                          </div>
                        ))}
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
                              {Array.isArray(expert.works[0].matchedFields) && expert.works[0].matchedFields.length > 0 && (
                                <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                                  {expert.works[0].matchedFields.map((f, i) => (
                                    <div key={i}>
                                      <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                                    </div>
                                  ))}
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
          {grants.map((expert, index) => (
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
              {Array.isArray(expert.grants[0].matchedFields) && expert.grants[0].matchedFields.length > 0 && (
                <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                  {expert.grants[0].matchedFields.map((f, i) => (
                    <div key={i}>
                      <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                    </div>
                  ))}
                </div>
              )}
              {/* Show dropdown button if there are more grants */}
              {expert.grants.length > 1 && (
                <button
                  onClick={() => toggleGrantDetails(index)}
                  style={{
                    marginTop: "10px",
                    padding: "5px 10px",
                    background: "#eda012",
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
                      {Array.isArray(grant.matchedFields) && grant.matchedFields.length > 0 && (
                        <div style={{ marginTop: "5px", fontStyle: "italic", color: "#555" }}>
                          {grant.matchedFields.map((f, i) => (
                            <div key={i}>
                              <strong>Matched on:</strong> {f.field}{f.match ? ` — "${f.match}"` : ""}
                            </div>
                          ))}
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