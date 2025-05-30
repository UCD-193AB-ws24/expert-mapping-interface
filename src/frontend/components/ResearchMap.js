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
import "leaflet/dist/leaflet.css";
import MapWrapper from "./MapContainer";
import WorkLayer from "./rendering/WorkLayer";
import GrantLayer from "./rendering/GrantLayer";
import CombinedLayer from "./rendering/CombinedLayer";
import { WorksPanel, GrantsPanel, CombinedPanel } from "./rendering/Panels";
import { matchesKeyword } from "./rendering/filters/searchFilter";
import { organizeAllMaps } from "./rendering/filters/organizeAllMaps";
import { filterFeaturesByZoom, filterOverlappingLocationsByZoom } from "./rendering/filters/zoomFilter";
import { isGrantInDate, isWorkInDate } from "./rendering/filters/dateFilter";
import { splitFeaturesByLocation } from "./rendering/filters/splitFeaturesByLocation";
import { isHighConfidence } from "./rendering/filters/confidenceFilter";
/**
 * ResearchMap Component
 * @description Main map interface for visualizing research-related data.
 * @param {boolean} showGrants - Whether to display grant-related data.
 * @param {boolean} showWorks - Whether to display works-related data.
 * @param {string} searchKeyword - Keyword used to filter data.
 * @param {Array<number>} selectedDateRange - Array of two numbers representing the selected year range for filtering data.
 */
const ResearchMap = ({ showGrants, showWorks, searchKeyword, selectedDateRange, onResetFilters }) => {

  const [rawGrantGeoJSON, setRawGrantGeoJSON] = useState(null);
  const [rawWorkGeoJSON, setRawWorkGeoJSON] = useState(null);
  const [selectedWorks, setSelectedWorks] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
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
          fetch('/workFeatures.geojson').then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          }),
          fetch('/grantFeatures.geojson').then((response) => {
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
              .filter(isHighConfidence)
              .filter(entry => isWorkInDate(entry, selectedDateRange))
              .filter(entry => matchesKeyword(searchKeyword, entry))
          }
        }))
        .filter(f => f.properties.entries.length > 0)
    };
  }, [rawWorkGeoJSON, selectedDateRange, searchKeyword]);
  console.log("Filtered Works Count:", filteredWorkGeoJSON?.features?.length);


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
              .filter(isHighConfidence)
              .filter(entry => isGrantInDate(entry, selectedDateRange))
              .filter(entry => matchesKeyword(searchKeyword, entry))

          }
        }))
        .filter(f => f.properties.entries.length > 0)
    };
  }, [rawGrantGeoJSON, selectedDateRange, searchKeyword]);
  console.log("Filtered Grants Count:", filteredGrantGeoJSON?.features?.length);

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
    filterOverlappingLocationsByZoom(overlappingLocations, zoomLevel),
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
              map.setView([30, 0], 2); 
              setZoomLevel(2);
            }
          }}
          style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            zIndex: 1002,
            padding: "8px 14px",
            backgroundColor: "#2f6bb3", 
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
          Reset View
        </button>


        <MapWrapper mapRef={mapRef}>
          {/* Combined location layer */}
          {(showWorks && showGrants) && (
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
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            padding: "30px",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            backdropFilter: "blur(10px)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          {/* Modern spinning loader */}
          <div
            style={{
              position: "relative",
              width: "60px",
              height: "60px",
            }}
          >
            {/* Outer ring */}
            <div
              style={{
                position: "absolute",
                width: "60px",
                height: "60px",
                border: "3px solid #e8f4fd",
                borderRadius: "50%",
              }}
            />
            {/* Spinning arc */}
            <div
              style={{
                position: "absolute",
                width: "60px",
                height: "60px",
                border: "3px solid transparent",
                borderTopColor: "#3879C7",
                borderRightColor: "#3879C7",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            {/* Inner pulsing dot */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "8px",
                height: "8px",
                backgroundColor: "#3879C7",
                borderRadius: "50%",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          </div>

          {/* Animated text */}
          <div
            style={{
              fontSize: "16px",
              fontWeight: "500",
              color: "#3879C7",
              animation: "fadeInOut 2s ease-in-out infinite",
            }}
          >
            Loading Map Data...
          </div>
        </div>
      )}

      {/* Error message (keeping your existing error styling) */}
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
          onClose={() => setPanelOpen(false)}
          keyword={null}
        />
      )}
    </div>
  );
};

export default ResearchMap;