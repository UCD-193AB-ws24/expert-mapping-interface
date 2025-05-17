/**
 * @file ResearchMap.js
 * @description This file contains the implementation of the `ResearchMap` component, which serves as the main interface
 *              for visualizing research-related data on a Leaflet map. It integrates multiple layers (works, grants, and combined data)
 *              and provides interactive panels for detailed information about the data.
 *
 * Features:
 * - Fetches and processes GeoJSON data for works and grants from APIs.
 * - Filters data based on the selected date range and search keyword.
 * - Displays interactive map layers for works, grants, and combined locations.
 * - Provides side panels for detailed information about experts, grants, or combined data.
 * - Handles loading and error states during data fetching.
 *
 * Props:
 * - showGrants: Boolean to toggle the display of grant-related data.
 * - showWorks: Boolean to toggle the display of works-related data.
 * - searchKeyword: String used to filter data based on a search term.
 * - selectedDateRange: Array of two numbers representing the selected year range for filtering data by date.
 *
 * Marina Mata, Alyssa Vallejo 2025
 */

import React, { useRef, useState, useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapWrapper from "./MapContainer";
import WorkLayer from "./rendering/WorkLayer";
import GrantLayer from "./rendering/GrantLayer";
import CombinedLayer from "./rendering/CombinedLayer";
import { WorksPanel, GrantsPanel } from "./rendering/Panels";
import { CombinedPanel } from "./rendering/CombinedPanel";
import { matchesKeyword } from "./rendering/filters/searchFilter";
import { organizeAllMaps } from "./rendering/filters/organizeAllMaps";
import { filterFeaturesByZoom, filterOverlappingLocationsByZoom } from "./rendering/filters/zoomFilter";
import { isGrantInDate, isWorkInDate } from "./rendering/filters/dateFilter";
import { splitFeaturesByLocation } from "./rendering/filters/splitFeaturesByLocation";
/**
 * ResearchMap Component
 * @description Main map interface for visualizing research-related data.
 * @param {boolean} showGrants - Whether to display grant-related data.
 * @param {boolean} showWorks - Whether to display works-related data.
 * @param {string} searchKeyword - Keyword used to filter data.
 * @param {Array<number>} selectedDateRange - Array of two numbers representing the selected year range for filtering data.
 */
const ResearchMap = ({ showGrants, showWorks, searchKeyword, selectedDateRange }) => {

  const [rawGrantGeoJSON, setRawGrantGeoJSON] = useState(null);
  const [rawWorkGeoJSON, setRawWorkGeoJSON] = useState(null);
  const [selectedWorks, setSelectedWorks] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [combinedKeys, setCombinedKeys] = useState(new Set());
  const mapRef = useRef(null);
  const [locationName, setLocationName] = useState("Unknown");
  const [zoomLevel, setZoomLevel] = useState(2);


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
          fetch(`${process.env.PUBLIC_URL}/features/workFeatures.geojson`).then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          }),
          fetch(`${process.env.PUBLIC_URL}/features/grantFeatures.geojson`).then((response) => {
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
            setRawWorkGeoJSON(processedWorksData);
            setRawGrantGeoJSON(processedGrantsData);
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

  /**
   * useEffect: Attach a zoom event listener to the map.
   * - Updates the zoom level state whenever the map's zoom level changes. Needed for reset Map button.
   */
  useEffect(() => {
  const map = mapRef.current;
  if (!map) return;

  const handleZoom = () => {
    setZoomLevel(map.getZoom());
    console.log("Current zoom level:", map.getZoom());
  };

  map.on("zoomend", handleZoom);

  // Set initial zoom level
  setZoomLevel(map.getZoom());

  // Cleanup
  return () => {
    map.off("zoomend", handleZoom);
  };
}, [mapRef.current]);


  // 2. Apply filters in memory
  const filteredWorkGeoJSON = useMemo(() => {
    if (!rawWorkGeoJSON) return null;
    // Apply date and keyword filters
    return {
      ...rawWorkGeoJSON,
      features: rawWorkGeoJSON.features
        .map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            entries: (feature.properties.entries || [])
              .filter(entry => isWorkInDate(entry, selectedDateRange))
              .filter(entry => matchesKeyword(searchKeyword, entry))
          }
        }))
        .filter(f => f.properties.entries.length > 0)
    };
  }, [rawWorkGeoJSON, selectedDateRange, searchKeyword]);

  const filteredGrantGeoJSON = useMemo(() => {
  if (!rawGrantGeoJSON) return null;
  // Apply date and keyword filters
    return {
      ...rawGrantGeoJSON,
      features: rawGrantGeoJSON.features
        .map(feature => ({
          ...feature,
          properties: {
            ...feature.properties,
            entries: (feature.properties.entries || [])
              .filter(entry => isGrantInDate(entry, selectedDateRange))
              .filter(entry => matchesKeyword(searchKeyword, entry))
          }
        }))
        .filter(f => f.properties.entries.length > 0)
    };
  }, [rawGrantGeoJSON, selectedDateRange, searchKeyword]);

 // 3. Filter data based on grants or works, or both
  const {
    overlappingLocations, // features with both works and grants
    nonOverlappingWorks,  // features with only works
    nonOverlappingGrants, // features with only grants
    // ...any maps you need
  } = useMemo(() => splitFeaturesByLocation(
    filteredWorkGeoJSON,
    filteredGrantGeoJSON,
    showWorks,
    showGrants
  ), [filteredWorkGeoJSON, filteredGrantGeoJSON, showWorks, showGrants]);
  

  // 4. Filter data based on zoom level
  const zoomFilteredNonOverlappingGrants = useMemo(() =>
  filterFeaturesByZoom(nonOverlappingGrants, zoomLevel),
  [nonOverlappingGrants, zoomLevel]
  );

  const zoomFilteredNonOverlappingWorks = useMemo(() =>
  filterFeaturesByZoom(nonOverlappingWorks, zoomLevel, "worksFeatures"),
  [nonOverlappingWorks, zoomLevel]
  );
  
  const zoomFilteredOverlappingLocations = useMemo(() =>
  filterOverlappingLocationsByZoom(overlappingLocations, zoomLevel, "workFeatures"),
  [overlappingLocations, zoomLevel]
  );

  // 5. Organize Data into locationMap, grantsMap, worksMap, and expertsMap
  const {
    combined, // { locationMap, worksMap, grantsMap, expertsMap }
    works,    // { locationMap, worksMap, expertsMap }
    grants,   // { locationMap, grantsMap, expertsMap }
  } = organizeAllMaps({
    overlappingFeatures: zoomFilteredOverlappingLocations || [],
    workOnlyFeatures: zoomFilteredNonOverlappingWorks || [],
    grantOnlyFeatures: zoomFilteredNonOverlappingGrants || [],
    searchKeyword,
  });
  
  return (
    <div style={{ display: "flex", position: "relative", height: "100%" }}>
      <div id="map" style={{ flex: 1, height: "100%" }}>
        <button
          onClick={() => {
            const map = mapRef.current;
            if (map) {
              map.setView([30, 0], 2); // or use your constants if you prefer
              setZoomLevel(2);
            }
          }}
          style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            zIndex: 1002,
            padding: "8px 14px",
            backgroundColor: "#2f6bb3", // Slightly deeper shade
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "500",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
          }}
        >
          Reset Map
        </button>

        <MapWrapper mapRef={mapRef}>
          {/* Combined location layer */}
          {((showWorks && showGrants) || searchKeyword) && (
            <CombinedLayer
              locationMap={combined.locationMap}
              worksMap={combined.worksMap}
              grantsMap={combined.grantsMap}
              expertsMap={combined.expertsMap}
              showWorks={showWorks}
              showGrants={showGrants}
              setSelectedWorks={setSelectedWorks}
              setSelectedGrants={setSelectedGrants}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
              setLocationName={setLocationName}
            />
          )}

          {/* Works layer */}
          {(showWorks) && (
            <WorkLayer
              locationMap={works.locationMap}
              worksMap={works.worksMap}
              expertsMap={works.expertsMap}
              showWorks={showWorks || !showGrants}
              showGrants={showGrants}
              setSelectedWorks={setSelectedWorks}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
            />
          )}

          {/* Grants layer */}
          {(showGrants) && (
            <GrantLayer
              locationMap={grants.locationMap}
              grantsMap={grants.grantsMap}
              expertsMap={grants.expertsMap}
              showWorks={showWorks}
              showGrants={showGrants || !showWorks}
              setSelectedGrants={setSelectedGrants}
              setPanelOpen={setPanelOpen}
              setPanelType={setPanelType}
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
        <GrantsPanel
          grants={selectedGrants}
          onClose={() => setPanelOpen(false)}
          keyword={null}
        />
      )}

      {panelOpen && panelType === "works" && (
        <>
          <WorksPanel
            works={selectedWorks} // Pass the array of work objects
            onClose={() => setPanelOpen(false)}
            panelType={panelType}
            keyword={null}
          />
        </>
      )}
      {panelOpen && panelType === "combined" && (
        <CombinedPanel
          works={selectedWorks}
          grants={selectedGrants}
          locationName={locationName}
          onClose={() => setPanelOpen(false)}
          keyword={null}
        />
      )}
    </div>
  );
};

export default ResearchMap;