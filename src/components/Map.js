import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// For single researcher display (used in markers, polygons, and side panel)
const createSingleResearcherContent = (researcher, isPopup = true) => `
  <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
    <div style="font-weight: bold; font-size: 16px; color: #13639e;">
      ${researcher.researcher_name || researcher.properties?.researcher_name || "Unknown"}
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Location:</strong> ${researcher.location_name || researcher.properties?.location_name || "Unknown"}
    </div>
    <div style="font-size: 14px; color: #333; margin-top: 5px;">
      <strong>Related Works ${researcher.work_count || researcher.properties?.work_count || 0}:</strong>
      ${(researcher.work_titles || researcher.properties?.work_titles || []).length > 0 ? `
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${(researcher.work_titles || researcher.properties?.work_titles || []).slice(0, 3).map(title => 
            `<li style="margin-bottom: 3px;">${title}</li>`
          ).join('')}
          ${(researcher.work_titles || researcher.properties?.work_titles || []).length > 3 ? 
            `<li style="list-style: none; font-style: italic;">... and ${(researcher.work_titles || researcher.properties?.work_titles || []).length - 3} more</li>` : ''}
        </ul>
      ` : '<div style="margin-top: 3px;">No works found</div>'}
    </div>
    <a href='${researcher.researcher_url || researcher.properties?.researcher_url || "#"}' 
       target='_blank'
       rel="noopener noreferrer"
       style="display: block; margin-top: 12px; padding: 8px 10px; background: ${(researcher.researcher_url || researcher.properties?.researcher_url) ? '#13639e' : '#ccc'}; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; opacity: ${(researcher.researcher_url || researcher.properties?.researcher_url) ? '1' : '0.6'}; cursor: ${(researcher.researcher_url || researcher.properties?.researcher_url) ? 'pointer' : 'default'}">
      ${(researcher.researcher_url || researcher.properties?.researcher_url) ? "View Profile" : "No Profile Found"}
    </a>
  </div>
`;

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
      <strong>Related Works ${totalWorks}</strong>
    </div>
    <a href='#'
       class="view-experts-btn"
       style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
      View Experts
    </a>
  </div>
`;

const ExpertsPanel = ({ experts, onClose, panelType }) => {
  const isFromProperties = panelType === "polygon"; // Check if experts are from polygon or point

  return (
    <div style={{
      width: '350px',
      background: '#f0f0f0',
      padding: '20px',
      overflowY: 'auto',
      height: '80vh',
      position: 'relative'
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'transparent',
          border: 'none',
          fontSize: '20px',
          color: '#13639e',
          cursor: 'pointer',
        }}
      >
        &times;
      </button>

      <h2>Selected Experts</h2>

      <div style={{ marginBottom: '20px', fontSize: '14px', color: '#555' }}>
        Location: {isFromProperties ? experts[0].properties.location_name : experts[0].location_name}
      </div>

      <ul style={{ padding: 0, listStyle: 'none' }}>
        {experts
          .sort((a, b) => {
            const nameA = isFromProperties ? a.properties.researcher_name : a.researcher_name;
            const nameB = isFromProperties ? b.properties.researcher_name : b.researcher_name;
            return nameA.localeCompare(nameB);
          })
          .map((expert, index) => (
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
              <div style={{ marginTop: "10px", fontSize: "13px" }}>
                <strong>Related Works {isFromProperties ? expert.properties.work_count : expert.work_count || 0}:</strong>
                {((isFromProperties ? expert.properties.work_titles : expert.work_titles) || []).length > 0 ? (
                  <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                    {((isFromProperties ? expert.properties.work_titles : expert.work_titles) || [])
                      .slice(0, 3)
                      .map((title, idx) => (
                        <li key={idx} style={{ marginBottom: "3px" }}>{title}</li>
                    ))}
                    {((isFromProperties ? expert.properties.work_titles : expert.work_titles) || []).length > 3 && (
                      <li style={{ listStyle: "none", fontStyle: "italic" }}>
                        ... and {((isFromProperties ? expert.properties.work_titles : expert.work_titles) || []).length - 3} more
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
                  background: (isFromProperties ? expert.properties.researcher_url : expert.researcher_url) ? '#13639e' : '#ccc',
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
          ))}
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
          return JSON.parse(text);
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
          const experts = markers.flatMap(marker => marker.options.experts || []);
          const totalExperts = experts.length;
          const totalWorks = experts.reduce((sum, expert) => {
            return sum + (parseInt(expert.work_count) || 0);
          }, 0);

          return L.divIcon({
            html: `
              <div class="cluster-icon">
                <div class="cluster-count">${totalExperts}</div>
                <div class="cluster-works">Works: ${totalWorks}</div>
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
              const allWorkTitles = experts.flatMap(expert => expert.properties.work_titles || []);
              const displayTitles = allWorkTitles.slice(0, 3);
              const hasMoreWorks = allWorkTitles.length > 3;
              
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

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${count}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30],
          }),
          expertCount: count,
        });

        const popupContent = document.createElement("div");
        popupContent.innerHTML = `
          <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
            <div style="font-weight: bold; font-size: 16px; color: #13639e;">
              ${count === 1 ? experts[0]?.researcher_name || "Unknown" : `${count} Experts at this Location`}
            </div>
            <div style="font-size: 14px; color: #333; margin-top: 5px;">
              <strong>Location:</strong> ${experts[0]?.location_name || "Unknown"}
            </div>
            ${count === 1 ? "" : `
              <a href='#' 
                 class="view-experts-btn"
                 style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
                View Experts
              </a>
            `}
          </div>
        `;

        const popup = L.popup({ closeButton: false, autoClose: true })
          .setLatLng([lat, lng])
          .setContent(popupContent);

        marker.bindPopup(popup).addTo(markerClusterGroupRef.current);
        
        // Disable clicking on points
        // marker.off("click");

        // If there's only one expert, show the details on hover
        if (count === 1) {
          let isMarkerPopupPinned = false;

          marker.on("mouseover", (event) => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }

            const expert = experts[0];
            const popupContent = createSingleResearcherContent(expert);

            if (activePopup) {
              activePopup.close();
            }

            activePopup = L.popup({ 
              closeButton: false, 
              autoClose: false,
              maxWidth: 250,
              className: 'hoverable-popup'
            })
              .setLatLng(marker.getLatLng())
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
          });

          marker.on("mouseout", (event) => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });
        } else {
          let isPopupPinned = false;

          marker.on("mouseover", (event) => {
            if (closeTimeout) {
              clearTimeout(closeTimeout);
              closeTimeout = null;
            }

            const totalWorks = experts.reduce((sum, expert) => {
              return sum + (parseInt(expert.work_count) || 0);
            }, 0);

            const popupContent = createMultiResearcherContent(
              experts.length, 
              experts[0]?.location_name || "Unknown",
              totalWorks
            );
            
            if (activePopup) {
              activePopup.close();
            }

            activePopup = L.popup({ 
              closeButton: false, 
              autoClose: false,
              maxWidth: 250,
              className: 'hoverable-popup'
            })
              .setLatLng(marker.getLatLng())
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
              setSelectedPointExperts(experts);
              setPanelType("point");
              setPanelOpen(true);
                if (activePopup) {
                  activePopup.close();
                  activePopup = null;
                }
              });
            }, 0);
          });

          marker.on("mouseout", (event) => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });
        }
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