import React, { useRef, useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import MapWrapper from "./MapContainer";
import ExpertLayer from "./ExpertLayer";
import GrantLayer from "./GrantLayer";
import CombinedLocationLayer from "./CombinedLocations";
import { ExpertsPanel, GrantsPanel } from "./Panels";
import { CombinedPanel } from "./CombinedPanel";

import worksData from "./features/works.json";
import grantsData from "./features/grants.json";

const ResearchMap = ({ showGrants, showWorks, searchKeyword, selectedDate }) => {
  const [geoData, setGeoData] = useState(null);
  const [grantGeoJSON, setGrantGeoJSON] = useState(null);
  const [workGeoJSON, setWorkGeoJSON] = useState(null);
  const [selectedExperts, setSelectedExperts] = useState([]);
  const [selectedPointExperts, setSelectedPointExperts] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [combinedKeys, setCombinedKeys] = useState(new Set());
  const mapRef = useRef(null);

  // useEffect(() => {
  //   const loadGeoData = async () => {
  //     try {
  //       const [grantsRes, worksRes] = await Promise.all([
  //         fetch("/grantFeatures.geojson"),
  //         fetch("/workFeatures.geojson")
  //       ]);
  
  //       const grantData = await grantsRes.json();
  //       const workData = await worksRes.json();
  
  //       setGrantGeoJSON(grantData);
  //       setWorkGeoJSON(workData);
  //       setIsLoading(false);
  
  //       console.log(" Loaded grant features:", grantData.features.length);
  //       console.log(" Loaded work features:", workData.features.length);
  //     } catch (err) {
  //       console.error(" Error loading geojson:", err);
  //       setError("Failed to load map data.");
  //       setIsLoading(false);
  //     }
  //   };
  
  //   loadGeoData();
  // }, []);

useEffect(() => {
    setIsLoading(true);
    const loadGeoData = async () => {
    try {
      // Fetch data from two different APIs concurrently
      Promise.all([
        fetch("http://localhost:3001/api/redis/worksQuery").then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        }),
        fetch("http://localhost:3001/api/redis/grantsQuery").then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
            return response.json();
          }),
          ])
          .then(([worksData, grantsData]) => {
            console.log("Converting data to GeoJSON format...");
            // Extract and process the features array
            const processedWorksData = {
              type: "FeatureCollection",
              features: worksData.features.map((feature) => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  entries: feature.properties.entries || [],
                },
              })),
            };
          
            const processedGrantsData = {
              type: "FeatureCollection",
              features: grantsData.features.map((feature) => ({
                ...feature,
                properties: {
                  ...feature.properties,
                  entries: feature.properties.entries || [],
                },
              })),
            };
          
            setWorkGeoJSON(processedWorksData);
            setGrantGeoJSON(processedGrantsData);
            setIsLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching data:", error);
            setIsLoading(false);
            setError("Failed to load map data. Please ensure the API server is running on port 3001.");
          });
    } catch (err) {
            console.error(" Error loading geojson:", err);
            setError("Failed to load map data.");
            setIsLoading(false);
          }
    };
        loadGeoData();
  }, []);

  // Helper functionto filter works by issued year
  const isWorkInDate = (entry) => {
    if (!selectedDate) return true;
    return String(entry.issued || "").startsWith(selectedDate);
  };  

  // Helper function to filter grants by start/end date
  const isGrantInDate = (entry) => {
    if (!selectedDate) return true;
    return (
      entry.startDate?.startsWith(selectedDate) ||
      entry.endDate?.startsWith(selectedDate)
    );
  };

  // Filter workGeoJSON by date
  const filteredWorkGeoJSON = workGeoJSON
    ? {
        ...workGeoJSON,
        features: workGeoJSON.features
          .map((feature) => {
            const filteredEntries = (feature.properties.entries || []).filter(isWorkInDate);
            return {
              ...feature,
              properties: {
                ...feature.properties,
                entries: filteredEntries,
              },
            };
          })
          .filter((f) => f.properties.entries.length > 0),
      }
    : null;

  // Filter grantGeoJSON by date
  const filteredGrantGeoJSON = grantGeoJSON
    ? {
        ...grantGeoJSON,
        features: grantGeoJSON.features
          .map((feature) => {
            const filteredEntries = (feature.properties.entries || []).filter(isGrantInDate);
            return {
              ...feature,
              properties: {
                ...feature.properties,
                entries: filteredEntries,
              },
            };
          })
          .filter((f) => f.properties.entries.length > 0),
      }
    : null;

  return (
    <div style={{ display: "flex", position: "relative", height: "100%" }}>
      <div id="map" style={{ flex: 1, height: "100%" }}>
        <MapWrapper>
           {/* Combined location layer must come first to handle overlaps */}
          {showWorks && showGrants && (
            <CombinedLocationLayer
              geoData={geoData}
              grantGeoJSON={filteredGrantGeoJSON}
              showWorks={showWorks}
              showGrants={showGrants}
              searchKeyword={searchKeyword}
              setSelectedPointExperts={setSelectedPointExperts}
              setSelectedGrants={setSelectedGrants}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
              setCombinedKeys={setCombinedKeys}
            />
          )}

          {/* Regular works layer */} 
          {(showWorks || searchKeyword) && (
            <ExpertLayer
              geoData={filteredWorkGeoJSON}
              showWorks={showWorks || !showGrants}
              showGrants={showGrants}
              searchKeyword={searchKeyword}
              setSelectedExperts={setSelectedExperts}
              setSelectedPointExperts={setSelectedPointExperts}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
              combinedKeys={combinedKeys}
            />
          )}
          {/* Regular grants layer */}
          {(showGrants || searchKeyword) && (
            <GrantLayer
              grantGeoJSON={filteredGrantGeoJSON}
              showGrants={showGrants || !showWorks}
              searchKeyword={searchKeyword}
              setSelectedGrants={setSelectedGrants}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
              combinedKeys={combinedKeys}
              showWorks={showWorks}
            />
          )}
        </MapWrapper>
      </div>

      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            className="loading-spinner"
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #13639e",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <div>Loading Map Data...</div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            zIndex: 1000,
            textAlign: "center",
            color: "#dc3545",
          }}
        >
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Panels */}
      {panelOpen && panelType === "grants" && (
        <GrantsPanel grants={selectedGrants} onClose={() => setPanelOpen(false)} />
      )}
      {panelOpen && (panelType === "polygon" || panelType === "point") && (
        <ExpertsPanel
          experts={panelType === "polygon" ? selectedExperts : selectedPointExperts}
          onClose={() => setPanelOpen(false)}
          panelType={panelType}
        />
      )}
      {panelOpen && panelType === "combined" && (
        <CombinedPanel
          works={selectedPointExperts}
          grants={selectedGrants}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
};

export default ResearchMap;
