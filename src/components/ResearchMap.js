import React, { useRef, useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import MapWrapper from "./MapContainer";
import ExpertLayer from "./ExpertLayer";
import GrantLayer from "./GrantLayer";
import CombinedLocationLayer from "./CombinedLocations";
import { ExpertsPanel, GrantsPanel } from "./Panels";
import { CombinedPanel } from "./CombinedPanel";

import worksData from "../geo/data/works.json";
import grantsData from "../geo/data/grants.json";

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
  const [combinedKeys, setCombinedKeys] = useState(new Set()); // ✅ New state
  const mapRef = useRef(null);

  useEffect(() => {
    setGeoData(worksData);
    setGrantGeoJSON({
      type: "FeatureCollection",
      features: grantsData.features
    });
    setIsLoading(false);
  }, []);

  return (
    <div style={{ display: "flex", position: "relative", height: "100%" }}>
      <div id="map" style={{ flex: 1, height: "100%" }}>
        <MapWrapper>
          {/* Combined location layer must come first to handle overlaps */}
          {showWorks && showGrants && (
            <CombinedLocationLayer
              geoData={geoData}
              grantGeoJSON={grantGeoJSON}
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
              geoData={geoData}
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
            grantGeoJSON={grantGeoJSON}
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

      {/* Panels */}
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
