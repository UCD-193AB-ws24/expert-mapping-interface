// components/map/Panels.js

import React from "react";

// Expert side panel (for points and polygons)
export const ExpertsPanel = ({ experts, onClose, panelType }) => {
  const isFromProperties = panelType === "polygon";

  const totalExperts = experts.flatMap(exp => {
    const entries = isFromProperties ? exp.properties.entries || [] : [exp];
    return entries.flatMap(entry => entry.relatedExperts || []);
  }).length;

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
        {totalExperts} Expert{totalExperts !== 1 ? 's' : ''} at this Location
      </h2>

      <ul style={{ padding: 0, listStyle: 'none' }}>
        {experts.flatMap((feature, featureIndex) => {
          const entries = isFromProperties ? feature.properties.entries || [] : [feature];
          return entries.flatMap((entry, entryIndex) => {
            const relatedExperts = entry.relatedExperts || [];
            return relatedExperts.map((relExpert, relIndex) => {
              const researcherName = relExpert.name || entry.authors?.join(", ") || "Unknown";
              const researcherURL = relExpert.url ? `https://experts.ucdavis.edu/${relExpert.url}` : null;
              const confidenceStyle = getConfidenceStyle(entry.confidence);

              return (
                <div key={`feature-${featureIndex}-entry-${entryIndex}-rel-${relIndex}`} style={{
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
                    {researcherName}
                  </div>
                  <div style={{ marginTop: "5px", color: "#333" }}>
                    <strong>Location:</strong> {feature.properties?.display_name || feature.location_name || "Unknown"}<br />
                    <strong>Issued:</strong> {entry.issued || "Unknown"}
                    {entry.confidence && (
                      <div><strong>Confidence:</strong> <span style={confidenceStyle.style}>{confidenceStyle.label}</span></div>
                    )}
                  </div>
                  <div style={{ marginTop: "10px", color: "#333" }}>
                    <strong>Title:</strong>
                    <div style={{ marginTop: "3px" }}>{entry.title || "Untitled"}</div>
                  </div>
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
                </div>
              );
            });
          });
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
