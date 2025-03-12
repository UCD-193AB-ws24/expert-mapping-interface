import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

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
  console.log('Raw confidence value in createSingleResearcherContent:', confidence, typeof confidence);
  let confidenceClass = '';
  let confidenceLabel = confidence || '';
  
  if (confidence) {
    const confidenceValue = typeof confidence === 'string' ? confidence.toLowerCase() : '';
    console.log('Processed confidence value:', confidenceValue);
    
    if (confidenceValue === 'high') {
      confidenceClass = 'background-color: #e8f5e9; color: #2e7d32; font-weight: bold; padding: 2px 5px; border-radius: 3px;'; // Green
      confidenceLabel = 'High';
      console.log('Using HIGH confidence styling');
    } else {
      confidenceClass = 'background-color: #ffebee; color: #c62828; font-weight: bold; padding: 2px 5px; border-radius: 3px;'; // Red
      confidenceLabel = 'Low';
      console.log('Using LOW confidence styling');
    }
  }

  return `
    <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
      <div style="font-weight: bold; font-size: 16px; color: #13639e;">
        ${researcher.researcher_name || researcher.properties?.researcher_name || "Unknown"}
      </div>
      <div style="font-size: 14px; color: #333; margin-top: 5px;">
        <strong>Location:</strong> ${researcher.location_name || researcher.properties?.location_name || "Unknown"}
        ${confidence ? 
          `<div><strong>Confidence:</strong> <span style="${confidenceClass}">${confidenceLabel}</span></div>` 
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
    <div style="font-size: 14px; color: #333; margin-top: 5px; font-style: italic;">
      Click "View Experts" to see confidence ratings
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

  const getConfidenceStyle = (confidenceValue) => {
    console.log('Raw confidence in getConfidenceStyle:', confidenceValue, typeof confidenceValue);
    
    if (!confidenceValue) return { label: '', style: {} };
    
    const confValue = typeof confidenceValue === 'string' ? confidenceValue.toLowerCase() : '';
    console.log('Processed confidence value in panel:', confValue);
    
    if (confValue === 'high') {
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
    } else if (confValue === 'medium') {
      console.log('Using MEDIUM confidence styling in panel');
      return { 
        label: 'Medium',
        style: { 
          backgroundColor: '#fff3e0', 
          color: '#f57c00', 
          fontWeight: 'bold',
          padding: '2px 5px',
          borderRadius: '3px',
          display: 'inline-block'
        } 
      };
    } else if (confValue === 'low') {
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
      console.log('No matching confidence style for:', confValue);
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
      backgroundColor: "white",
      boxShadow: "-2px 0 5px rgba(0,0,0,0.2)",
      padding: "20px",
      overflowY: "auto",
      zIndex: 1000
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
        {experts.length} Expert{experts.length !== 1 ? 's' : ''} at this Location
      </h2>
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
                <div style={{ fontWeight: "bold", fontSize: "16px", color: "#13639e" }}>
                  {isFromProperties ? expert.properties.researcher_name : expert.researcher_name}
                </div>
                <div style={{ marginTop: "5px", color: "#333" }}>
                  <strong>Location:</strong> {isFromProperties ? expert.properties.location_name : expert.location_name}
                  {confidence && (
                    <div><strong>Confidence:</strong> <span style={confidenceStyle.style}>{confidenceStyle.label}</span></div>
                  )}
                </div>
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

const ResearchMap = () => {
  const [geoData, setGeoData] = useState(null);
  const [selectedExperts, setSelectedExperts] = useState([]);
  const [selectedPointExperts, setSelectedPointExperts] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState(null);
  const mapRef = useRef(null);
  const markerClusterGroupRef = useRef(null);
  const popupTimeoutRef = useRef(null);
  let activePopup = null;
  let closeTimeout = null;

  useEffect(() => {
    fetch("http://localhost:3001/api/redis/query")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          
          // Debug: Log more detailed information about confidence values
          if (data.features && data.features.length > 0) {
            // Sample multiple features for confidence values
            console.log('First 5 features confidence values:');
            data.features.slice(0, 5).forEach((feature, index) => {
              console.log(`Feature ${index + 1}:`, {
                confidence: feature.properties.confidence,
                type: typeof feature.properties.confidence,
                researcher: feature.properties.researcher_name,
                location: feature.properties.location_name
              });
            });
            
            // Count different confidence values
            const confidenceValues = {};
            data.features.forEach(feature => {
              const conf = feature.properties.confidence;
              confidenceValues[conf] = (confidenceValues[conf] || 0) + 1;
            });
            console.log('Confidence value distribution:', confidenceValues);
          }
          
          return data;
        } catch (error) {
          throw new Error(`Invalid JSON: ${text}`);
        }
      })
      .then((data) => setGeoData(data))
      .catch((error) => console.error("Error fetching geojson:", error));
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
        mapRef.current = L.map("map", {
          minZoom: 2,
          maxZoom: 9,
          maxBounds: [
            [-85, -180], // Southwest corner
            [85, 180]    // Northeast corner
          ],
          maxBoundsViscosity: 1.0, // Controls the "snap-back" effect when hitting the boundary
        }).setView([20, 0], 3);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

      markerClusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
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
      mapRef.current.addLayer(markerClusterGroupRef.current);
    }

    if (geoData) {
      markerClusterGroupRef.current.clearLayers();
      const locationMap = new Map();
      const locationExpertCounts = new Map();

      geoData.features.forEach((feature) => {
        const locationId = feature.properties.location_id;
        if (locationId) {
          locationExpertCounts.set(locationId, (locationExpertCounts.get(locationId) || 0) + 1);
        }
      });

      // Finding farthest expert for polygon
      const referencePoint = L.latLng(20, 0); // Example reference point
      let farthestExpert = null;
      let maxDistance = 0;

      geoData.features.forEach((feature) => {
        const geometry = feature.geometry;

        // Handle Point
        if (geometry.type === "Point") {
          const [lng, lat] = geometry.coordinates;
          const expertLocation = L.latLng(lat, lng);
          const distance = referencePoint.distanceTo(expertLocation); // Calculate distance

          if (distance > maxDistance) {
            maxDistance = distance;
            farthestExpert = feature;
          }
        }
      });

      if (farthestExpert) {
        const locationId = farthestExpert.properties.location_id;

        geoData.features.forEach((feature) => {
          const geometry = feature.geometry;

          if (geometry.type === "Polygon" && feature.properties.location_id === locationId) {
            const coordinates = geometry.coordinates[0];
            const flippedCoordinates = coordinates.map(([lng, lat]) => [lat, lng]);
            const polygon = L.polygon(flippedCoordinates, {
              color: '#13639e',
              weight: 2,
              fillColor: '#d8db9a',
              fillOpacity: 0.3,
            });

            // Remove the polygon from the map
            mapRef.current.removeLayer(polygon);
          }
        });
      }

      const polygonsToRender = new Set(); // To track unique locations

      const sortedPolygons = geoData.features
      .filter(feature => feature.geometry.type === "Polygon")
      .sort((a, b) => {
        const boundsA = L.polygon(a.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
        const boundsB = L.polygon(b.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();

        const areaA = (boundsA.getEast() - boundsA.getWest()) * (boundsA.getNorth() - boundsA.getSouth());
        const areaB = (boundsB.getEast() - boundsB.getWest()) * (boundsB.getNorth() - boundsB.getSouth());

        return areaB - areaA; // Sort in descending order (largest first)
      });

      sortedPolygons.forEach((feature) => {
        const geometry = feature.geometry;
        const locationId = feature.properties.location_id;

        // Check if this location has already been added
        if (!polygonsToRender.has(locationId)) {
          polygonsToRender.add(locationId);

          const coordinates = geometry.coordinates[0];
          if (Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
            const flippedCoordinates = coordinates.map(([lng, lat]) => [lat, lng]);

            const polygon = L.polygon(flippedCoordinates, {
              color: '#13639e',
              weight: 2,
              fillColor: '#d8db9a',
              fillOpacity: 0.3,
            }).addTo(mapRef.current);

            const expertCount = locationExpertCounts.get(locationId) || 0;
            const locationName = feature.properties.location_name || "Unknown";

            let isPolygonPopupPinned = false;

            polygon.on("mouseover", (event) => {
              if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
              }

              const experts = geoData.features.filter(f => f.properties.location_id === locationId);
              const totalWorks = experts.reduce((sum, expert) => {
                return sum + (parseInt(expert.properties.work_count) || 0);
              }, 0);
              
              // Choose content based on number of experts
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
                className: 'hoverable-popup'
              })
                .setLatLng(polygon.getBounds().getCenter())
                .setContent(popupContent)
                .openOn(mapRef.current);

              // Add hover handlers to the popup
              const popupElement = activePopup.getElement();
              if (popupElement) {
                popupElement.addEventListener('mouseenter', () => {
                  if (closeTimeout) {
                    clearTimeout(closeTimeout);
                    closeTimeout = null;
                  }
                });

                popupElement.addEventListener('mouseleave', () => {
                  closeTimeout = setTimeout(() => {
                    if (activePopup) {
                      activePopup.close();
                      activePopup = null;
                    }
                  }, 300);
                });
              }

              // Add event listener for view experts button
              setTimeout(() => {
                document.querySelector(".view-experts-btn")?.addEventListener("click", (e) => {
                  e.preventDefault();
                  setSelectedExperts(experts);
                  setPanelType("polygon");
                  setPanelOpen(true);
                  if (activePopup) {
                    activePopup.close();
                    activePopup = null;
                  }
                });
              }, 0);
            });

            polygon.on("mouseout", (event) => {
              // Add delay before closing
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

      // Handle Point and MultiPoint
      geoData.features.forEach((feature) => {
        const geometry = feature.geometry;

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

      locationMap.forEach((experts, key) => {
        const [lat, lng] = key.split(",").map(Number);
        const count = experts.length;
        const totalWorks = experts.reduce((sum, expert) => {
          return sum + (parseInt(expert.work_count) || 0);
        }, 0);

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${count}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30],
          }),
          experts: experts,
          expertCount: count,
        });

        // Create popup but don't bind it yet
        const popup = L.popup({
          closeButton: false,
          autoClose: false,
          maxWidth: 250,
          className: 'hoverable-popup'
        });

        marker.on("mouseover", (event) => {
          if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
          }

          const popupContent = createMultiResearcherContent(
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

          // Add hover handlers to the popup
          const popupElement = popup.getElement();
          if (popupElement) {
            popupElement.addEventListener('mouseenter', () => {
              if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
              }
            });

            popupElement.addEventListener('mouseleave', () => {
              closeTimeout = setTimeout(() => {
                if (activePopup) {
                  activePopup.close();
                  activePopup = null;
                }
              }, 300);
            });

            // Add event listener for view experts button
            const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
            if (viewExpertsBtn) {
              viewExpertsBtn.addEventListener("click", (e) => {
                e.preventDefault();
                setSelectedPointExperts(experts);
                setPanelType("point");
                setPanelOpen(true);
                if (activePopup) {
                  activePopup.close();
                  activePopup = null;
                }
              });
            }
          }
        });

        marker.on("mouseout", (event) => {
          closeTimeout = setTimeout(() => {
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          }, 300);
        });

        marker.addTo(markerClusterGroupRef.current);
      });
    }
  }, [geoData]);

  return (
    <div style={{ display: 'flex' }}>
      <div id="map" style={{ flex: 1, height: '100vh' }}></div>
      {panelOpen && selectedExperts.length > 0 && (
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