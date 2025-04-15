/**
 * ResearchMap Component
 *
 * This React component renders an interactive Leaflet map that visualizes researcher data 
 * from a geospatial API. It integrates clustering, polygon styling, and popups to allow 
 * users to explore expert profiles based on geographic regions and confidence levels.
 *
 * Key Features:
 * - Initializes a Leaflet map with base tiles
 * - Fetches and parses GeoJSON features from a Redis-backed API
 * - Distinguishes between point and polygon features
 * - Uses leaflet.markercluster to group researchers located in the same place
 * - Displays popups with detailed researcher info (confidence level, top works)
 * - Styles polygons based on confidence level (high, medium, low)
 * - Opens a side panel for locations with multiple researchers
 */

// React and Leaflet imports
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import expertGrantsRaw from "../geo/data/expertGrants.json";


// TEMP: Convert expertGrantsRaw into mock GeoJSON format for grant testing no redis yet
const grantGeoJSON = {
  type: "FeatureCollection",
  features: expertGrantsRaw.map((grant, index) => {
    // Extract name(s) from the location field
    const matches = [...(grant.location?.matchAll(/\* (.+)/g) || [])];
    const primaryLocation = matches.length ? matches[0][1] : "Unknown";

    // Fake coordinates based on index to spread markers out for now
    const lng = -121 + (index % 5) * 1.5; // just to space them out
    const lat = 38 + (index % 4) * 1.2;

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat]
      },
      properties: {
        ...grant,
        location_id: `grant-${index}`,
        location_name: primaryLocation,
        researcher_name: grant.relatedExpert?.name || "Unknown",
        researcher_url: grant.relatedExpert?.url
          ? `https://experts.ucdavis.edu/${grant.relatedExpert.url}`
          : null,
        work_titles: [grant.title],
        work_count: 1,
        confidence: "low", // or use something else to style
        type: "grant" // ✅ mark as grant for filtering
      }
    };
  })
};


// For single researcher display (used in markers, polygons, and side panel)
const createSingleResearcherContent = (researcher, isPopup = true) => {
  let workTitles = [];
  try {
    const titles = researcher.work_titles || researcher.properties?.work_titles;
    console.log('Raw work titles in createSingleResearcherContent:', titles);
    console.log('Type of work titles in createSingleResearcherContent:', typeof titles);
    
    // If it's already an array, use it
    if (Array.isArray(titles)) {
      console.log('Titles is already an array:', titles);
      workTitles = titles;
    }
    // If it's a string, try to parse it
    else if (typeof titles === 'string') {
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


  // Get confidence rating and add proper styling based on confidence level
  const confidence = researcher.confidence || researcher.properties?.confidence;
  
  // Use the same function that ExpertsPanel uses for consistency
  const getConfidenceStyle = (confidenceValue) => {
    if (!confidenceValue) return { label: '', style: {} };
    
    // Direct comparison with high/low values
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
      // For any other value, use as is with neutral styling
      return { 
        label: confidenceValue,
        style: 'background-color: #f5f5f5; color: #757575; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
      };
    }
  };
  
  const confidenceStyle = getConfidenceStyle(confidence);

  //// Return a styled HTML string for the researcher's popup with location, researcher, url and work
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



// For multiple researchers display (used in markers and polygons)
const createMultiResearcherContent = (expertCount, locationName, totalWorks) => `
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

const ExpertsPanel = ({ experts, onClose, panelType }) => {
  const isFromProperties = panelType === "polygon";

  // Depending on whether the data comes from a polygon or point, access titles differently
  const getWorkTitles = (expert) => {
    try {
      const titles = isFromProperties ? expert.properties.work_titles : expert.work_titles;
      console.log('Raw work titles in ExpertsPanel:', titles);
      console.log('Type of work titles in ExpertsPanel:', typeof titles);
      
      if (!titles) return [];
      
      // If it's already an array, return it
      if (Array.isArray(titles)) {
        console.log('Titles is already an array:', titles);
        return titles;
      }
      
      // If it's a string that looks like a JSON array, parse it
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
      
      // Otherwise return an empty array
      return [];
    } catch (e) {
      console.error('Error in getWorkTitles:', e);
      return [];
    }
  };

  /* The function normalizes and styles confidence levels for consistent UI rendering.
  * - "High" confidence gets a green badge
  * - "Low" confidence gets a red badge
  * - All other values (including unknowns) get a neutral gray badge
  */

  const getConfidenceStyle = (confidenceValue) => {
    console.log('Raw confidence in getConfidenceStyle:', confidenceValue, typeof confidenceValue);
    
    if (!confidenceValue) return { label: '', style: {} };
    
    // Direct comparison with high/low values
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
      // For any other value, use as is with neutral styling
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

  return ( //side pannel fixing
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
      zIndex:1001
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
       {/* Panel title showing expert count */}
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#13639e" }}>
        {experts.length} Expert{experts.length !== 1 ? 's' : ''} at this Location
      </h2>
      {/*List of experts */}
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
              // Individual expert card
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
                {/*Researcher name */}
                <div style={{ fontWeight: "bold", fontSize: "16px", color: "#13639e" }}>
                  {isFromProperties ? expert.properties.researcher_name : expert.researcher_name}
                </div>
                {/* Location + confidence */}
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Location:</strong> {isFromProperties ? expert.properties.location_name : expert.location_name}
                  {confidence && (
                    <div><strong>Confidence:</strong> <span style={confidenceStyle.style}>{confidenceStyle.label}</span></div>
                  )}
                </div>
                {/* Work titles */}
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

                {/* Link to profile */}
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

/*Core Responsibilities:
 * - Load and store GeoJSON features from the backend API
 * - Distinguish between polygon and point features
 * - Cluster point markers using leaflet.markercluster
 * - Show styled polygon overlays with opacity scaled by expert count
 * - Handle user interactions: popup hover, click-to-open panel, and close logic
 */
// const ResearchMap = () => {
  const ResearchMap = ({ showGrants, showWorks }) => {
  const [geoData, setGeoData] = useState(null);
  const [selectedExperts, setSelectedExperts] = useState([]);
  const [selectedPointExperts, setSelectedPointExperts] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const mapRef = useRef(null);
  const markerClusterGroupRef = useRef(null);
  const popupTimeoutRef = useRef(null);
  let activePopup = null;
  let closeTimeout = null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Calculates polygon fill opacity based on expert count.
   * Used to visually scale polygon visibility based on how populated it is.
   * 
   * @param {number} expertCount - The number of researchers in the region
   * @returns {number} Opacity value between minOpacity and maxOpacity
   */

  const calculateOpacity = (expertCount) => {
    const minOpacity = 0.3;
    const maxOpacity = 0.7;
    const maxExperts = 25; 
    
    return Math.min(
      minOpacity + (maxOpacity - minOpacity) * (expertCount / maxExperts),
      maxOpacity
    );
  };

  const isGrant = (feature) => {
    const props = feature?.properties || {};
    return "funder" in props || "startDate" in props;
  };
  
  const isExpert = (feature) => {
    const props = feature?.properties || {};
    return "researcher_name" in props || "firstName" in props || "work_titles" in props;
  };
  
  //initial GeoJSON Data Fetch
  useEffect(() => {
    setIsLoading(true);
    fetch("http://localhost:3001/api/redis/query")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        // Ensure the response is JSON
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server did not return JSON data. Please ensure the API server is running.");
        }
        return response.json();
      })
      .then((data) => {
        //commenting this out if want to work on grants for right now, since no redis access, else this will show works
        setGeoData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching geojson:", error);
        setIsLoading(false);
        setError("Failed to load map data. Please ensure the API server is running on port 3001.");
      });
  }, []);

    //To make grant layout: Use  grant data instead of Redis result, since no access ot redis updates yet. 
//     setGeoData({
//       type: "FeatureCollection",
//       features: [...grantGeoJSON.features]
//     });
//     setIsLoading(false);
//   })
// }, []);

//grant pop up content
const createGrantPopupContent = (grant) => {
  const rawTitle = grant.title || "";
  const cleanTitle = rawTitle.split("§")[0].trim().replace(/^"+|"+$/g, ""); // remove leading/trailing quotes

  return `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
 <div style="margin-top: 4px;">
  <strong>Grant:</strong> <span style="color: #f59e0b;">${cleanTitle || "Unknown"}</span>
</div>
      <div style="margin-top: 4px;">
        <strong>Researcher:</strong> ${grant.researcher_name || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Location:</strong> ${grant.location_name || "Unknown"}
      </div>
      <div style="margin-top: 4px;">
        <strong>Funding:</strong> ${grant.funder || "Unknown"}
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


// 🔶 GrantsPanel – Side panel for displaying multiple grants at a location
const GrantsPanel = ({ grants, onClose }) => {
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
      {/* Close button */}
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

      {/* Title */}
      <h2 style={{ marginTop: "0", marginBottom: "20px", color: "#f59e0b" }}>
        {grants.length} Grant{grants.length !== 1 ? 's' : ''} at this Location
      </h2>

      {/* List of grant cards */}
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
            background: "#fefce8" // Light yellow background
          }}>
            {/* Researcher Name */}
            <div style={{ fontWeight: "bold", fontSize: "16px", color: "#f59e0b" }}>
              {grant.researcher_name || "Unknown"}
            </div>

            {/* Grant title */}
            <div style={{ marginTop: "5px", color: "#333" }}>
              {grant.title || "Untitled Grant"}
            </div>

            {/* Location + funder */}
            <div style={{ marginTop: "5px", color: "#333" }}>
              <strong>Location:</strong> {grant.location_name || "Unknown"}
              <br />
              <strong>Funder:</strong> {grant.funder || "Unknown"}
            </div>

            {/* Profile link */}
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

const createMultiGrantPopup = (grants, locationName) => `
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



  useEffect(() => {
    if (!mapRef.current) {
      // Create the Leaflet map instance
        mapRef.current = L.map("map", {
          minZoom: 2,
          maxZoom: 4,
          maxBounds: [
            [-80, -200], // Southwest corner
            [85, 200]    // Northeast corner
          ],
          maxBoundsViscosity: 1.0, // Controls the "snap-back" effect when hitting the boundary
        }).setView([30, 0], 2);

      // Add OpenStreetMap base tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        
      }).addTo(mapRef.current);

      // Initialize the cluster group for expert markers
      markerClusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
        // Customize cluster icons to show expert totals
        iconCreateFunction: function(cluster) {
          const markers = cluster.getAllChildMarkers();
          const totalExperts = markers.reduce((sum, marker) => sum + marker.options.expertCount, 0);

          return L.divIcon({
            html: `
              <div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                ${totalExperts}
              </div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40)
          });
        }
      });
      // Add cluster layer to the map
      mapRef.current.addLayer(markerClusterGroupRef.current);
    }

    if (geoData) {
      markerClusterGroupRef.current.clearLayers();
      const locationMap = new Map();
      const locationExpertCounts = new Map();

      geoData.features.forEach((feature) => {
        // 🔍 Skip features based on toggles
        if (!showGrants && isGrant(feature)) return;  // don't render grants if toggle is off
        if (!showWorks && isExpert(feature)) return;  // don't render experts if toggle is off
        if (!showGrants && !showWorks) return;        // if both off, skip all
      
        const locationId = feature.properties?.location_id;
        if (locationId) {
          locationExpertCounts.set(
            locationId,
            (locationExpertCounts.get(locationId) || 0) + 1
          );
        }
      });
      
      

      // Find the farthest expert (Point) from a fixed reference point
      const referencePoint = L.latLng(20, 0); // Arbitrary center of map
      let farthestExpert = null;
      let maxDistance = 0;

      
      geoData.features.forEach((feature) => {
        // Skip features if toggles are OFF for their type
        if (!showGrants && isGrant(feature)) return;
        if (!showWorks && isExpert(feature)) return;
        if (!showGrants && !showWorks) return;
      
        // ✅ Only run this logic for experts with geometry
        const geometry = feature.geometry;
        if (!geometry || geometry.type !== "Point") return;
      
        const [lng, lat] = geometry.coordinates;
        const expertLocation = L.latLng(lat, lng);
        const distance = referencePoint.distanceTo(expertLocation); // Calculate distance
      
        if (distance > maxDistance) {
          maxDistance = distance;
          farthestExpert = feature;
        }
      });
      
      

      // 🧭 Remove the polygon for that farthest expert (if it exists)
if (farthestExpert && showWorks) {
  const locationId = farthestExpert.properties.location_id;

  geoData.features.forEach((feature) => {
    const geometry = feature.geometry;

    if (
      geometry.type === "Polygon" &&
      feature.properties.location_id === locationId
    ) {
      const coordinates = geometry.coordinates[0];
      const flippedCoordinates = coordinates.map(([lng, lat]) => [lat, lng]);
      const polygon = L.polygon(flippedCoordinates, {
        color: '#13639e',
        weight: 2,
        fillColor: '#d8db9a',
        fillOpacity: 0.3,
      });

      // 🧽 Remove the polygon from the map
      mapRef.current.removeLayer(polygon);
    }
  });
}


      // Sort polygons by area in descending order (largest first)
      const polygonsToRender = new Set(); 

      const sortedPolygons = geoData.features
      .filter(feature => feature.geometry.type === "Polygon")
      .sort((a, b) => {
        const boundsA = L.polygon(a.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
        const boundsB = L.polygon(b.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();

        const areaA = (boundsA.getEast() - boundsA.getWest()) * (boundsA.getNorth() - boundsA.getSouth());
        const areaB = (boundsB.getEast() - boundsB.getWest()) * (boundsB.getNorth() - boundsB.getSouth());

        return areaB - areaA; // Sort in descending order (largest first)
      });

      // Render each unique polygon
      sortedPolygons.forEach((feature) => {
        const geometry = feature.geometry;
        const locationId = feature.properties.location_id;

        // Check if this location has already been added
        if (!polygonsToRender.has(locationId)) {
          polygonsToRender.add(locationId);

          const coordinates = geometry.coordinates[0];
          if (Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
            const flippedCoordinates = coordinates.map(([lng, lat]) => [lat, lng]);
            const expertCount = locationExpertCounts.get(locationId) || 0;
            const dynamicOpacity = calculateOpacity(expertCount);

            // Draw polygon on map
            const polygon = L.polygon(flippedCoordinates, {
              color: '#13639e',
              weight: 2,
              fillColor: '#d8db9a',
              fillOpacity: dynamicOpacity,
            }).addTo(mapRef.current);

            let isPolygonPopupPinned = false;

            // Store polygon reference for event handlers
            const currentPolygon = polygon;

            // Hover in → show popup
            currentPolygon.on("mouseover", (event) => {
              //if (!showWorks && !showGrants) return; // ensure no hovering before a toggle is selected. 
              if (!(showGrants || showWorks)) return;

              if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
              }

              const experts = geoData.features.filter(f => f.properties.location_id === locationId);
              const totalWorks = experts.reduce((sum, expert) => {
                return sum + (parseInt(expert.properties.work_count) || 0);
              }, 0);
              
              const popupContent = experts.length === 1 
                ? createSingleResearcherContent(experts[0].properties)
                : createMultiResearcherContent(experts.length, feature.properties.location_name, totalWorks);

              if (activePopup) {
                activePopup.close();
              }

              activePopup = L.popup({
                closeButton: false,
                autoClose: false,
                maxWidth: 300,
                className: 'hoverable-popup',
                autoPan: false,
                keepInView: false,
                interactive: true
              })
                .setLatLng(currentPolygon.getBounds().getCenter())
                .setContent(popupContent)
                .openOn(mapRef.current);

              // Add hover handlers to the popup
              const popupElement = activePopup.getElement();
              if (popupElement) {
                // Enable pointer events immediately
                popupElement.style.pointerEvents = 'auto';
                
                popupElement.addEventListener('mouseenter', () => {
                  if (closeTimeout) {
                    clearTimeout(closeTimeout);
                    closeTimeout = null;
                  }
                  // Ensure pointer events stay enabled
                  popupElement.style.pointerEvents = 'auto';
                });

                popupElement.addEventListener('mouseleave', () => {
                  closeTimeout = setTimeout(() => {
                    if (activePopup) {
                      activePopup.close();
                      activePopup = null;
                    }
                  }, 300);
                });

                // Add event listener for view experts button immediately
                const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
                if (viewExpertsBtn) {
                  viewExpertsBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Update the selected experts and panel type immediately
                    setSelectedExperts(experts);
                    setPanelType("polygon");
                    setPanelOpen(true);

                    if (activePopup) {
                      activePopup.close();
                      activePopup = null;
                    }

                    const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
                    if (viewGrantsBtn) {
                      viewGrantsBtn.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    
                        setSelectedExperts(grants); // ✅ or setSelectedGrants if you made a new state
                        setPanelType("polygon");
                        setPanelOpen(true);
                    
                        if (activePopup) {
                          activePopup.close();
                          activePopup = null;
                        }
                      });
                    }
                    
                  });
                }
              }
            });

            currentPolygon.on("mouseout", (event) => {
              closeTimeout = setTimeout(() => {
                if (activePopup) {
                  activePopup.close();
                  activePopup = null;
                }
              }, 300);
            });
          }
        }
      });

      
      geoData.features.forEach((feature) => {
        const isExpertFeature = isExpert(feature);
        const isGrantFeature = isGrant(feature);
      
        //  If neither toggle is on, skip everything
        if (!showGrants && !showWorks) return;
      
        //  If showing only grants and this is not a grant, skip
        if (showGrants && !showWorks && !isGrantFeature) return;
      
        //  If showing only works and this is not an expert, skip
        if (showWorks && !showGrants && !isExpertFeature) return;
      
        // If both are on, allow both expert and grant features
        //  If it's valid per above, proceed...
      
        const geometry = feature.geometry;
        if (!geometry) return;
      
        if (geometry.type === "Point" || geometry.type === "MultiPoint") {
          const coordinates = geometry.coordinates;
      
          if (geometry.type === "Point" && Array.isArray(coordinates) && coordinates.length === 2) {
            const [lng, lat] = coordinates;
            const key = `${lat},${lng}`;
      
            if (!locationMap.has(key)) {
              locationMap.set(key, []);
            }
            locationMap.get(key).push(feature.properties);
      
          } else if (geometry.type === "MultiPoint" && Array.isArray(coordinates)) {
            coordinates.forEach(coord => {
              const [lng, lat] = coord;
              const key = `${lat},${lng}`;
      
              if (!locationMap.has(key)) {
                locationMap.set(key, []);
              }
              locationMap.get(key).push(feature.properties);
            });
          }
        }
      });
      
      // Render each unique marker
      locationMap.forEach((experts, key) => {
        const [lat, lng] = key.split(",").map(Number);
        const count = experts.length;

        // Total works shown in popup for clusters
        const totalWorks = experts.reduce((sum, expert) => {
          return sum + (parseInt(expert.work_count) || 0);
        }, 0);

         // Create custom circle-style icon
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: count === 1 
              ? `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>1</div>`
              : `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${count}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30],
          }),
          experts: experts,
          expertCount: count,
        });

        // Define shared popup for hover interaction
        const popup = L.popup({
          closeButton: false,
          autoClose: false,
          maxWidth: 250,
          className: 'hoverable-popup',
          autoPan: false,
          keepInView: false,
          interactive: true
        });

         // Hover in → show expert popup
        marker.on("mouseover", (event) => {
          if (!(showGrants || showWorks)) return; //ensure no hovering when toggles arent selected
          if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
          }


            const popupContent = count === 1 
              ? (experts[0].type === "grant"
              ? createGrantPopupContent(experts[0])
              : createSingleResearcherContent(experts[0]))
              : createMultiResearcherContent(
                  count,
                  experts[0]?.location_name || "Unknown",
                  totalWorks
                );


          if (activePopup) {
            activePopup.close();
          }

          popup.setLatLng(marker.getLatLng())
            .setContent(popupContent)
            .openOn(mapRef.current);
          
          activePopup = popup;

          const popupElement = popup.getElement();
          if (popupElement) {
            popupElement.style.pointerEvents = 'auto';

            popupElement.addEventListener('mouseenter', () => {
              if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
              }
              popupElement.style.pointerEvents = 'auto';
            });

            popupElement.addEventListener('mouseleave', () => {
              closeTimeout = setTimeout(() => {
                if (activePopup) {
                  activePopup.close();
                  activePopup = null;
                }
              }, 500);
            });

             // Handle click to open side panel
            const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
            if (viewExpertsBtn) {
              viewExpertsBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Update the selected experts and panel type immediately
                setSelectedPointExperts(experts);
                setPanelType("point");
                setPanelOpen(true);

                if (activePopup) {
                  activePopup.close();
                  activePopup = null;
                }
                const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
if (viewGrantsBtn) {
  viewGrantsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedExperts(grants); // ✅ or setSelectedGrants if you made a new state
    setPanelType("polygon");
    setPanelOpen(true);

    if (activePopup) {
      activePopup.close();
      activePopup = null;
    }
  });
}


              });
            }
          }
        });

        // Hover out → close with delay
        marker.on("mouseout", (event) => {
          closeTimeout = setTimeout(() => {
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          }, 500);
        });

        // Add marker to cluster group
        marker.addTo(markerClusterGroupRef.current);
      });
    }
  }, [geoData, showGrants, showWorks]); 

  
  /* This block renders the main visual structure of the map interface:
  * - A full-screen Leaflet map inside a flex container
  * - A centered loading spinner while data is being fetched
  * - An error message overlay if the fetch fails
  * - The dynamic ExpertsPanel, conditionally shown based on user interaction
  */

  return (
    <div style={{ display: 'flex', position: 'relative', height: '100%' }}>
    <div id="map" style={{ flex: 1, height: '100%' }}></div>
      {isLoading && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <div className="loading-spinner" 
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #13639e',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <div>Loading Map Data...</div>
        </div>
      )}
      {error && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 1000,
            textAlign: 'center',
            color: '#dc3545'
          }}
        >
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}
      {/* {panelOpen && (
        <ExpertsPanel
          experts={panelType === "polygon" ? selectedExperts : selectedPointExperts}
          onClose={() => setPanelOpen(false)}
          panelType={panelType}
        />
      )} */}
      {panelOpen && panelType === "grants" && (
  <GrantsPanel
    grants={selectedGrants}
    onClose={() => setPanelOpen(false)}
  />
)}
{panelOpen && (panelType === "polygon" || panelType === "point") && (
  <ExpertsPanel
    experts={panelType === "polygon" ? selectedExperts : selectedPointExperts}
    onClose={() => setPanelOpen(false)}
    panelType={panelType}
  />
)}


    </div>
  );
};

export default ResearchMap;