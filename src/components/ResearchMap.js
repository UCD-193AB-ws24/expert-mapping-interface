import React, { useRef, useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapWrapper from "./MapContainer";
import processGeoJSONData from "./rendering/ProcessGeoJSON";
import WorkLayer from "./rendering/WorkLayer";
import GrantLayer from "./rendering/GrantLayer";
import CombinedLayer from "./rendering/CombinedLayer";
import { WorksPanel, GrantsPanel } from "./rendering/Panels";
import { CombinedPanel } from "./rendering/CombinedPanel";

/**
 * ResearchMap Component
 * 
 * This component serves as the main map interface for visualizing research-related data.
 * It integrates multiple layers (e.g., experts, grants, combined locations) and provides
 * interactive panels for detailed information about the data.
 * 
 * Props:
 * - showGrants: Boolean to toggle the display of grant-related data.
 * - showWorks: Boolean to toggle the display of works-related data.
 * - searchKeyword: String used to filter data based on a search term.
 * - selectedDate: String representing the selected year for filtering data by date.
 * 
 * Features:
 * - Fetches and processes GeoJSON data for works and grants from APIs.
 * - Filters data based on the selected date and search keyword.
 * - Displays interactive map layers for works, grants, and combined locations.
 * - Provides side panels for detailed information about experts, grants, or combined data.
 * - Handles loading and error states during data fetching.
 */

const ResearchMap = ({ showGrants, showWorks, searchKeyword, selectedDateRange }) => {
  const [geoData, setGeoData] = useState(null);
  const [grantGeoJSON, setGrantGeoJSON] = useState(null);
  const [workGeoJSON, setWorkGeoJSON] = useState(null);
  const [selectedWorks, setSelectedWorks] = useState([]);
  // const [selectedPointExperts, setSelectedPointExperts] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [combinedKeys, setCombinedKeys] = useState(new Set());
  const mapRef = useRef(null);
  const [locationName, setLocationName] = useState("Unknown");

  /**
     * useEffect: Fetch GeoJSON data for works and grants.
     * - Fetches data from two APIs concurrently.
     * - Processes the data into GeoJSON format and updates state variables.
     * - Handles errors and updates the loading state.
     */

  useEffect(() => {
    setIsLoading(true);
    const loadGeoData = async () => {
      try {
        // Fetch data from two different APIs concurrently
        Promise.all([
          fetch(`${process.env.PUBLIC_URL}/features/worksFeatures.json`).then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          }),
          fetch(`${process.env.PUBLIC_URL}/features/grantsFeatures.json`).then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          }),
        ])
          .then(([worksData, grantsData]) => {
            // Process works data into GeoJSON format.
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
            // Process grants data into GeoJSON format.
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
            setError("Failed to load map data. Please ensure the files exist in the public/features folder.");
          });
      } catch (err) {
        console.error(" Error loading geojson:", err);
        setError("Failed to load map data.");
        setIsLoading(false);
      }
    };
    loadGeoData();
  }, []);

  /**
   * Helper function to filter works by issued year.
   * 
   * @param {object} entry - A work entry object.
   * @returns {boolean} True if the work matches the selected date, otherwise false.
   */
  const isWorkInDate = (entry) => {
    if (!selectedDateRange || selectedDateRange.length !== 2) return true;
    const issuedYear = parseInt(entry.issued, 10);
    return issuedYear >= selectedDateRange[0] && issuedYear <= selectedDateRange[1];
  };
  
  /**
   * Helper function to filter grants by start or end date.
   * 
   * @param {object} entry - A grant entry object.
   * @returns {boolean} True if the grant matches the selected date, otherwise false.
   */
  const isGrantInDate = (entry) => {
    if (!selectedDateRange || selectedDateRange.length !== 2) return true;
    const start = parseInt(entry.start_date, 10);
    const end = parseInt(entry.end_date, 10);
    const [minYear, maxYear] = selectedDateRange;
    return (
      (!isNaN(start) && start >= minYear && start <= maxYear) ||
      (!isNaN(end) && end >= minYear && end <= maxYear)
    );
  };
  // Filter workGeoJSON by date
  const dateFilteredWorkGeoJSON = workGeoJSON
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
  const dateFilteredGrantGeoJSON = grantGeoJSON
    ? {
      ...grantGeoJSON,
      features: grantGeoJSON.features
        .map((feature) => {
          // pass isGrantInDate directly
          const filteredEntries = (feature.properties.entries || []).filter(isGrantInDate);
          return {
            ...feature,
            properties: {
              ...feature.properties,
              entries: filteredEntries,
            },
          };
        })
        .filter(f => f.properties.entries && f.properties.entries.length > 0)
    }
    : null;
  ;

    // Validate filtered GeoJSON data before passing to processGeoJSONData
    const validWorkGeoJSON = dateFilteredWorkGeoJSON || { type: "FeatureCollection", features: [] };
    const validGrantGeoJSON = dateFilteredGrantGeoJSON || { type: "FeatureCollection", features: [] };

    // Debugging logs to check the structure of the filtered data
    // console.log("Filtered Work GeoJSON:", validWorkGeoJSON);
    // console.log("Filtered Grant GeoJSON:", validGrantGeoJSON);

    // Call processGeoJSONData with validated inputs
    const { overlappingLocations, nonOverlappingWorks, nonOverlappingGrants } = processGeoJSONData(
        validWorkGeoJSON,
        validGrantGeoJSON,
        showWorks,
        showGrants
    );
    // console.log("Non-overlapping work features:",  nonOverlappingWorks);
    // console.log("Non-overlapping grant features:",  nonOverlappingGrants);
    // console.log('Overlapping Locations:', overlappingLocations);
  return (
    <div style={{ display: "flex", position: "relative", height: "100%" }}>
      <div id="map" style={{ flex: 1, height: "100%" }}>
        <MapWrapper>
          {/* Combined location layer must come first to handle overlaps */}
          {showWorks && showGrants && (
            <CombinedLayer
            overlappingLocations={overlappingLocations}
            showWorks={showWorks}
            showGrants={showGrants}
            setSelectedWorks={setSelectedWorks}
            setSelectedGrants={setSelectedGrants}
            setPanelOpen={setPanelOpen}
            setPanelType={setPanelType}
            setCombinedKeys={setCombinedKeys}
            combinedKeys={combinedKeys}
            setLocationName={setLocationName}
            searchKeyword={searchKeyword}
            />
          )}
          {/* <CombinedLayer
            workGeoJSON={dateFilteredWorkGeoJSON}
            grantGeoJSON={dateFilteredGrantGeoJSON}
            showWorks={showWorks}
            showGrants={showGrants}
            setSelectedWorks={setSelectedWorks}
            setSelectedGrants={setSelectedGrants}
            setPanelOpen={setPanelOpen}
            setPanelType={setPanelType}
            setCombinedKeys={setCombinedKeys}
            combinedKeys={combinedKeys}
            setLocationName={setLocationName}
            searchKeyword={searchKeyword}
          /> */}
          {/* Regular works layer */}
          {(showWorks || searchKeyword) && (
            <WorkLayer
              nonOverlappingWorks={nonOverlappingWorks}
              showWorks={showWorks || !showGrants}
              showGrants={showGrants}
              searchKeyword={searchKeyword}
              setSelectedWorks={setSelectedWorks}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
              combinedKeys={combinedKeys}
              
            />
          )}
          {/* Regular grants layer */}
          {(showGrants || searchKeyword) && (
            <GrantLayer
              nonOverlappingGrants={nonOverlappingGrants}
              showWorks={showWorks}
              showGrants={showGrants || !showWorks}
              searchKeyword={searchKeyword}
              setSelectedGrants={setSelectedGrants}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
              combinedKeys={combinedKeys}
            />
          )}
        </MapWrapper>
      </div>
      {/* Loading spinner */}
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
              borderTop: "4px solid #3879C7",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <div>Loading Map Data...</div>
        </div>
      )}
      {/* Error message */}
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
      {panelOpen && (panelType === "grants" || panelType === "grant-polygon") && (
        <GrantsPanel grants={selectedGrants} onClose={() => setPanelOpen(false)} keyword={searchKeyword} />
      )}

      {panelOpen && panelType === "works" && (
        <>
          {/* {console.log("Selected Works Data:", selectedWorks)} Debugging log */}
          <WorksPanel
            works={selectedWorks} // Pass the array of work objects
            onClose={() => setPanelOpen(false)}
            panelType={panelType}
            keyword={searchKeyword}
          />
        </>
      )}
      {panelOpen && panelType === "combined" && (
        <CombinedPanel
          works={selectedWorks}
          grants={selectedGrants}
          locationName={locationName}
          onClose={() => setPanelOpen(false)}
          keyword={searchKeyword}
        />
      )}
    </div>
  );
};

export default ResearchMap;
