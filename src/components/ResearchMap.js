// components/map/ResearchMap.js

import React, { useRef, useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import MapWrapper from "./MapContainer";
import ExpertLayer from "./ExpertLayer";
import GrantLayer from "./GrantLayer";
import { ExpertsPanel, GrantsPanel } from "./Panels";

// import expertGrantsRaw from "../geo/data/expertGrants.json";



const ResearchMap = ({ showGrants, showWorks, searchKeyword }) => {
  const [geoData, setGeoData] = useState(null);
  const [grantGeoJSON, setGrantGeoJSON] = useState(null);
  const [selectedExperts, setSelectedExperts] = useState([]);
  const [selectedPointExperts, setSelectedPointExperts] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    setIsLoading(true);
  
    // change BETWEEN EXPERT DATA (Redis) AND GRANT DATA (mocks)
    const useExpertsFromRedis = false;
  
    if (useExpertsFromRedis) {
      // 🔷 Expert data from Redis
      fetch("http://localhost:3001/api/redis/query")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server did not return JSON data. Please ensure the API server is running.");
          }
          return response.json();
        })
        .then((data) => {
          setGeoData(data); // experts
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching geojson:", error);
          setIsLoading(false);
          setError("Failed to load expert data. Please ensure the Redis API is running.");
        });
    } else {
      // 🟡 Temporary fallback: use mocked grant data as `geoData`
      import("../geo/data/expertGrants.json").then((module) => {
        const grantFeatures = module.default.map((grant, index) => {
          const matches = [...(grant.location?.matchAll(/\* (.+)/g) || [])];
          const primaryLocation = matches.length ? matches[0][1] : "Unknown";
          const lng = -121 + (index % 5) * 1.5;
          const lat = 38 + (index % 4) * 1.2;
  
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
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
              confidence: "low",
              type: "grant"
            }
          };
        });
  
        setGeoData({
          type: "FeatureCollection",
          features: grantFeatures
        });
        setIsLoading(false);
      });
    }
  }, []);
  


  return (
    <div style={{ display: "flex", position: "relative", height: "100%" }}>
      <div id="map" style={{ flex: 1, height: "100%" }}>
        <MapWrapper>
        <ExpertLayer
            geoData={geoData}
            showWorks={showWorks}
            setSelectedExperts={setSelectedExperts}
            setSelectedPointExperts={setSelectedPointExperts}
            setPanelOpen={setPanelOpen}
            setPanelType={setPanelType}
            />
            <GrantLayer
            grantGeoJSON={grantGeoJSON}
            showGrants={showGrants}
            setSelectedGrants={setSelectedGrants}
            setPanelOpen={setPanelOpen}
            setPanelType={setPanelType}
            />
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
            gap: "10px"
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
              animation: "spin 1s linear infinite"
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
            color: "#dc3545"
          }}
        >
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

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
