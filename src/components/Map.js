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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const calculateOpacity = (expertCount) => {
    const minOpacity = 0.3;
    const maxOpacity = 0.7;
    const maxExperts = 25; 
    
    return Math.min(
      minOpacity + (maxOpacity - minOpacity) * (expertCount / maxExperts),
      maxOpacity
    );
  };

  useEffect(() => {
    setIsLoading(true);
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
        setGeoData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching geojson:", error);
        setIsLoading(false);
        setError("Failed to load map data. Please ensure the API server is running on port 3001.");
      });
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
        mapRef.current = L.map("map", {
          minZoom: 3,
          maxZoom: 9,
          maxBounds: [
            [-85, -270], // Southwest corner
            [85, 270]    // Northeast corner
          ],
          maxBoundsViscosity: 1.0, // Controls the "snap-back" effect when hitting the boundary
        }).setView([20, 0], 4);

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
            const expertCount = locationExpertCounts.get(locationId) || 0;
            const dynamicOpacity = calculateOpacity(expertCount);

            const polygon = L.polygon(flippedCoordinates, {
              color: '#13639e',
              weight: 2,
              fillColor: '#d8db9a',
              fillOpacity: dynamicOpacity,
            }).addTo(mapRef.current);

            let isPolygonPopupPinned = false;

            // Store polygon reference for event handlers
            const currentPolygon = polygon;

            currentPolygon.on("mouseover", (event) => {
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
                  popupElement.style.pointerEvents = 'none';
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
                const viewExpertsBtn = document.querySelector(".view-experts-btn");
                if (viewExpertsBtn) {
                  viewExpertsBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedExperts(experts);
                    setPanelType("polygon");
                    setPanelOpen(true);
                    if (activePopup) {
                      activePopup.close();
                      activePopup = null;
                    }
                  });
                }
              }, 0);
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
            html: count === 1 
              ? `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>1</div>`
              : `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${count}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30],
          }),
          experts: experts,
          expertCount: count,
        });

        const popup = L.popup({
          closeButton: false,
          autoClose: false,
          maxWidth: 250,
          className: 'hoverable-popup',
          autoPan: false,
          keepInView: false,
          interactive: true
        });

        marker.on("mouseover", (event) => {
          if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
          }

          const popupContent = count === 1
            ? createSingleResearcherContent(experts[0])
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
              }, 300);
            });

            const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
            if (viewExpertsBtn) {
              viewExpertsBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
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
    <div style={{ display: 'flex', position: 'relative' }}>
      <div id="map" style={{ flex: 1, height: '100vh' }}></div>
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