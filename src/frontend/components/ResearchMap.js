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
import { isGrantInDate, isWorkInDate } from "./rendering/filters/dateFilter";
import { filterLocationMap, filterGrantLayerLocationMap, filterWorkLayerLocationMap } from "./rendering/filters/filterLocationMaps";
import { all } from "axios";
/**
 * ResearchMap Component
 * @description Main map interface for visualizing research-related data.
 * @param {boolean} showGrants - Whether to display grant-related data.
 * @param {boolean} showWorks - Whether to display works-related data.
 * @param {string} searchKeyword - Keyword used to filter data.
 * @param {Array<number>} selectedDateRange - Array of two numbers representing the selected year range for filtering data.
 */
const ResearchMap = ({ showGrants, showWorks, searchKeyword, selectedDateRange, onResetFilters }) => {

  const [selectedWorks, setSelectedWorks] = useState([]);
  const [selectedGrants, setSelectedGrants] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const [locationName, setLocationName] = useState("Unknown");
  const [zoomLevel, setZoomLevel] = useState(2);

  // State variables for raw maps
  const [rawExpertsMap, setRawExpertsMap] = useState(null);
  const [rawWorksMap, setRawWorksMap] = useState(null);
  const [rawGrantsMap, setRawGrantsMap] = useState(null);

  // Cached maps for different zoom levels
  const [locationMapsCache, setLocationMapsCache] = useState({}); // { [zoomLevel]: { ...maps } }
  const [currentLocationMaps, setCurrentLocationMaps] = useState(null);


  // Fetch raw maps data from Redis on mount
  useEffect(() => {
    const fetchRawMaps = async () => {
      try {
        // console.log("[DEBUG] Fetching raw maps from /api/redis/getRawMaps");
        const response = await fetch('/api/redis/getRawMaps');
        if (!response.ok) throw new Error('Failed to fetch raw maps');
        const data = await response.json();
        setRawExpertsMap(data.expertsMap);
        setRawWorksMap(data.worksMap);
        setRawGrantsMap(data.grantsMap);
        // console.log("[DEBUG] Raw maps loaded successfully");
        setIsLoading(false);
      } catch (err) {
        console.error("[ERROR] Failed to load static map data in fetchRawMaps:", err);
        setError('Failed to load static map data.');
      }
    };
    fetchRawMaps();
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

  const getMapType = () => {
    if (zoomLevel >= 2 && zoomLevel <= 4) return "CountryLevelMaps";
    if (zoomLevel >= 5 && zoomLevel <= 7) return "StateLevelMaps";
    if (zoomLevel >= 8 && zoomLevel <= 10) return "CountyLevelMaps";
    if (zoomLevel >= 11 && zoomLevel <= 13) return "CityLevelMaps";
    if (zoomLevel >= 14) return "ExactLevelMaps";
    return null;
  };

  // Fetch and process location maps based on zoom level and toggles
  useEffect(() => {
    const mapType = getMapType();
    if (!mapType) {
      console.warn("[DEBUG] No mapType determined for zoomLevel:", zoomLevel);
      return;
    }

    // Decide which API endpoints to call for each layer type
    // - worksMap: always nonoverlap
    // - grantsMap: always nonoverlap
    // - combinedMap: only when both toggles are on, use overlap
    // Cache by zoomLevel and toggle state for efficiency

    const cacheKey = `${zoomLevel}_${showWorks}_${showGrants}`;

    if (locationMapsCache[cacheKey]) {
      // console.log(`[DEBUG] Using cached maps for cacheKey: ${cacheKey}`);
      setCurrentLocationMaps(locationMapsCache[cacheKey]);
      return;
    }

    const fetchMaps = async () => {
      try {
        let workLayerMap = null, grantLayerMap = null, combinedLayerMap = null;

        if (showWorks && showGrants) {
          // Fetch all three maps in one API call to match the new server endpoint
          // console.log(`[DEBUG] Fetching ALL maps (works, grants, combined) for ${mapType}`);
          const allMapsRes = await fetch(`/api/redis/nonoverlap/getAll${mapType}`);
          if (!allMapsRes.ok) throw new Error("Failed to fetch all maps");
          const allMaps = await allMapsRes.json();
          workLayerMap = allMaps.worksMap;
          grantLayerMap = allMaps.grantsMap;
          combinedLayerMap = allMaps.combinedMap;
        } else if (showWorks) {
          // Overlap works map
          const worksRes = await fetch(`/api/redis/overlap/get${mapType}?type=works`);
          if (!worksRes.ok) throw new Error("Failed to fetch works map");
          workLayerMap = await worksRes.json();
        } else if (showGrants) {
          // Overlap grants map
          const grantsRes = await fetch(`/api/redis/overlap/get${mapType}?type=grants`);
          if (!grantsRes.ok) throw new Error("Failed to fetch grants map");
          grantLayerMap = await grantsRes.json();
        }

        const maps = { workLayerMap, grantLayerMap, combinedLayerMap };
        setLocationMapsCache(prev => ({ ...prev, [cacheKey]: maps }));
        setCurrentLocationMaps(maps);
      } catch (err) {
        console.error(`[ERROR] Failed to load location maps in fetchMaps for cacheKey: ${cacheKey}`, err);
        setError("Failed to load location maps.");
      }
    };

    fetchMaps();
  }, [zoomLevel, showWorks, showGrants]);

  const mapType = getMapType();
  const mapLevel = mapType ? mapType.replace("LevelMaps", "") : "";

  const workLayerLocations = currentLocationMaps?.workLayerMap || {};
  const grantLayerLocations = currentLocationMaps?.grantLayerMap || {};
  const combinedLocations = currentLocationMaps?.combinedLayerMap || {};

  // Filter worksMap, grantsMap, expertsMap, and locationMap based on searchKeyword
  // First filter by date, then by keyword
  // Filter works by date
  const dateFilteredWorksMap = Object.fromEntries(
    Object.entries(rawWorksMap || {}).filter(([, work]) => isWorkInDate(work, selectedDateRange))
  );

  // Filter grants by date
  const dateFilteredGrantsMap = Object.fromEntries(
    Object.entries(rawGrantsMap || {}).filter(([, grant]) => isGrantInDate(grant, selectedDateRange))
  );
  const dateFilteredExpertsMap = Object.fromEntries(
    Object.entries(rawExpertsMap || {}).filter(([, expert]) => {
      // Only keep experts who have at least one work or grant in the filtered maps
      const hasWork = (expert.workIDs || []).some(id => dateFilteredWorksMap[id]);
      const hasGrant = (expert.grantIDs || []).some(id => dateFilteredGrantsMap[id]);
      return hasWork || hasGrant;
    })
  );

  // Debounce searchKeyword to avoid filtering on every keystroke
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState(searchKeyword);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
    }, 400); // 400ms debounce delay

    return () => clearTimeout(handler);
  }, [searchKeyword]);

  // Filter experts by debounced keyword
  const filteredExpertsMap = Object.fromEntries(
    Object.entries(dateFilteredExpertsMap).filter(([, expert]) => matchesKeyword(debouncedSearchKeyword, expert))
  );

  const hasExpertMatches = Object.keys(filteredExpertsMap).length > 0;

  let effectiveFilteredExpertsMap, filteredWorksMap, filteredGrantsMap;

  if (hasExpertMatches) {
    // If there are expert matches, show all works/grants associated with those experts
    effectiveFilteredExpertsMap = filteredExpertsMap;
    const filteredExpertIds = new Set(Object.keys(filteredExpertsMap));

    filteredWorksMap = Object.fromEntries(
      Object.entries(dateFilteredWorksMap).filter(([, work]) =>
        (work.relatedExpertIDs || work.expertIDs || []).some(id => filteredExpertIds.has(id))
      )
    );
    filteredGrantsMap = Object.fromEntries(
      Object.entries(dateFilteredGrantsMap).filter(([, grant]) =>
        (grant.relatedExpertIDs || grant.expertIDs || []).some(id => filteredExpertIds.has(id))
      )
    );
  } else {
    // If no expert matches, filter works and grants by keyword directly
    effectiveFilteredExpertsMap = rawExpertsMap;
    filteredWorksMap = Object.fromEntries(
      Object.entries(dateFilteredWorksMap).filter(([, work]) => matchesKeyword(searchKeyword, work))
    );
    // console.log("Filtered Works Map:", Object.keys(filteredWorksMap).length, "entries");
    filteredGrantsMap = Object.fromEntries(
      Object.entries(dateFilteredGrantsMap).filter(([, grant]) => matchesKeyword(searchKeyword, grant))
    );
    // console.log(`Filtered Grants Map of length ${Object.keys(filteredGrantsMap).length}:`, Object.keys(filteredGrantsMap));
  }

  console.log(Object.keys(combinedLocations).length, "combinedLocations before filtering");
  // console.log(Object.entries(combinedLocations));
  const filteredWorkLayerLocations = filterWorkLayerLocationMap(
    workLayerLocations,
    filteredWorksMap
  );

  const filteredGrantLayerLocations = filterGrantLayerLocationMap(
    grantLayerLocations,
    filteredGrantsMap
  );

  const filteredCombinedLocations = filterLocationMap(
    combinedLocations,
    filteredWorksMap,
    filteredGrantsMap
  );

  // 1. Create new objects to hold the "moved" locations
  const movedToWorkLayer = {};
  const movedToGrantLayer = {};

  // 2. Iterate over filteredCombinedLocations and move as needed
  Object.entries(filteredCombinedLocations).forEach(([locID, loc]) => {
    const hasWorks = loc.workIDs && loc.workIDs.length > 0;
    const hasGrants = loc.grantIDs && loc.grantIDs.length > 0;

    if (hasWorks && !hasGrants) {
      movedToWorkLayer[locID] = loc;
      delete filteredCombinedLocations[locID];
    } else if (!hasWorks && hasGrants) {
      movedToGrantLayer[locID] = loc;
      delete filteredCombinedLocations[locID];
    }
  });

  // 3. Merge these into your filteredWorkLayerLocations and filteredGrantLayerLocations
  const finalFilteredWorkLayerLocations = { ...filteredWorkLayerLocations, ...movedToWorkLayer };
  const finalFilteredGrantLayerLocations = { ...filteredGrantLayerLocations, ...movedToGrantLayer };

  return (
    <div style={{ display: "flex", position: "relative", height: "100%" }}>
      <div id="map" style={{ flex: 1, minHeight: "calc(100vh - 140px)", position: "relative" }}>
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

        {/* Zoom Level Indicator */}
        {mapLevel && (
          <div className="zoom-level-indicator"
            style={{
              position: "absolute",
              top: "20px",
              left: "50px",
              zIndex: 1001,
              background: "rgba(255,255,255,0.80)", // slightly less opaque
              padding: "6px 16px",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "16px",
              color: "#3879C7",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
            }}
          >
            {mapLevel && `${mapLevel} Level`}
          </div>
        )}

        <MapWrapper mapRef={mapRef}>
          {/* Combined location layer */}
          {(showWorks && showGrants) && (
            <CombinedLayer
              searchKeyword={searchKeyword}
              locationMap={filteredCombinedLocations || {}}
              worksMap={rawWorksMap || {}}
              grantsMap={rawGrantsMap || {}}
              expertsMap={effectiveFilteredExpertsMap || {}}
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
              searchKeyword={searchKeyword}
              locationMap={finalFilteredWorkLayerLocations || filteredWorkLayerLocations || {}}
              worksMap={rawWorksMap || {}}
              expertsMap={effectiveFilteredExpertsMap || {}}
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
              searchKeyword={searchKeyword}
              locationMap={finalFilteredGrantLayerLocations || filteredGrantLayerLocations || {}}
              grantsMap={rawGrantsMap || {}}
              expertsMap={effectiveFilteredExpertsMap || {}}
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
