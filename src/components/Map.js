import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

const PointExpertsPanel = ({ experts, onClose }) => {
  return (
    <div
      style={{
        width: '300px',
        background: '#f0f0f0',
        padding: '20px',
        overflowY: 'auto',
        height: '80vh',
        position: 'relative'
      }}
    >
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

      <h2>Selected Point Experts</h2>

      {/* Displaying the location between h2 and ul */}
      <div style={{ marginBottom: '20px', fontSize: '14px', color: '#555' }}>

        Location: {experts.length > 0 ? experts[0].location_name : 'No location available'}
      </div>

      <ul>
        {experts
          .sort((a, b) => a.researcher_name.localeCompare(b.researcher_name))
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
                {expert.researcher_name || "Unknown"}
              </div>
              <div style={{ marginTop: "10px", fontSize: "13px" }}>
                <strong>Related Works:</strong> {expert.work_count || "N/A"}
              </div>
              <a
                href={expert.researcher_url || "#"}
                target={expert.researcher_url ? "_blank" : "_self"}
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  marginTop: "12px",
                  padding: "8px 10px",
                  background: expert.researcher_url ? "#13639e" : "#ccc",
                  color: "white",
                  textAlign: "center",
                  borderRadius: "5px",
                  textDecoration: "none",
                  fontWeight: "bold",
                  opacity: expert.researcher_url ? "1" : "0.6",
                  cursor: expert.researcher_url ? "pointer" : "default"
                }}
              >
                {expert.researcher_url ? "View Profile" : "No Profile Found"}
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
      mapRef.current = L.map("map", { minZoom: 1, maxZoom: 9 }).setView([20, 0], 2);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

      markerClusterGroupRef.current = L.markerClusterGroup({
        iconCreateFunction: (cluster) => {
          let totalExperts = 0;
          cluster.getAllChildMarkers().forEach((marker) => {
            totalExperts += marker.options.expertCount || 1;
          });

          return L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${totalExperts}</div>`,
            className: "custom-cluster-icon",
            iconSize: [35, 35],
          });
        },
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

      geoData.features.forEach((feature) => {
        const geometry = feature.geometry;

        // Handle Polygon
        if (geometry.type === "Polygon") {
          const coordinates = geometry.coordinates[0];
          if (Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
            const flippedCoordinates = coordinates.map(([lng, lat]) => [lat, lng]);

            const polygon = L.polygon(flippedCoordinates, {
              color: '#13639e',
              weight: 2,
              fillColor: '#d8db9a',
              fillOpacity: 0.3,
            }).addTo(mapRef.current);

            const locationId = feature.properties.location_id;
            const expertCount = locationExpertCounts.get(locationId) || 0;
            const locationName = feature.properties.location_name || "Unknown";

            polygon.on("mouseover", (event) => {
              clearTimeout(popupTimeoutRef.current);

              const popupContent = document.createElement("div");
              popupContent.innerHTML = `
                <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
                  <div style="font-weight: bold; font-size: 16px; color: #13639e;">
                    ${expertCount} Experts at this location
                  </div>
                  <div style="font-size: 14px; color: #333; margin-top: 5px;">
                    <strong>Location:</strong> ${locationName}
                  </div>
                  <a href='#' 
                     class="view-experts-btn"
                     style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
                    View Experts
                  </a>
                </div>
              `;

              const popup = L.popup({ closeButton: false, autoClose: true })
                .setLatLng(event.latlng)
                .setContent(popupContent);

              polygon.bindPopup(popup).openPopup();

              let isMouseOver = false;

              popupContent.addEventListener("mouseenter", () => {
                isMouseOver = true;
                clearTimeout(popupTimeoutRef.current);
              });

              popupContent.addEventListener("mouseleave", () => {
                isMouseOver = false;
                popupTimeoutRef.current = setTimeout(() => {
                  polygon.closePopup();
                }, 500);
              });

              popupContent.querySelector(".view-experts-btn")?.addEventListener("click", (e) => {
                e.preventDefault();
                const experts = geoData.features.filter(f => f.properties.location_id === locationId);
                setSelectedExperts(experts);
                setPanelType("polygon");
                setPanelOpen(true);
                polygon.closePopup();
              });
            });

            polygon.on("mouseout", () => {
              popupTimeoutRef.current = setTimeout(() => {
                polygon.closePopup();
              }, 500);
            });
          }
        }

        // Handle Point and MultiPoint
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

        // If there's only one expert, show the details on hover
        if (count === 1) {
          marker.on("mouseover", () => {
            const expert = experts[0];
            const singleExpertPopupContent = `
              <div style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
                <div style="font-weight: bold; font-size: 16px; color: #13639e;">
                  ${expert.researcher_name || "Unknown"}
                </div>
                 <div style="font-size: 14px; color: #333; margin-top: 5px;">
                  <strong>Location:</strong> ${experts[0]?.location_name || "Unknown"}
                </div>
                <div style="font-size: 14px; color: #333; margin-top: 5px;">
                  <strong>Related Works:</strong> ${expert.work_count || "N/A"}
                </div>
                <a href='${expert.researcher_url || "#"}' target='_blank' 
                   style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
                  View Profile
                </a>
              </div>
            `;
            const singleExpertPopup = L.popup({ closeButton: false, autoClose: true })
              .setLatLng([lat, lng])
              .setContent(singleExpertPopupContent)
              .openOn(mapRef.current);

            // Set a timeout to close the popup after 3 seconds
            popupTimeoutRef.current = setTimeout(() => {
              mapRef.current.closePopup(singleExpertPopup);
            }, 1000); // Adjust the timeout duration as needed

            // Clear the timeout if the mouse enters the popup
            singleExpertPopup.on('mouseover', () => {
              clearTimeout(popupTimeoutRef.current);
            });

            // Reapply the timeout if the mouse leaves the popup
            singleExpertPopup.on('mouseout', () => {
              popupTimeoutRef.current = setTimeout(() => {
                mapRef.current.closePopup(singleExpertPopup);
              }, 1000); // Adjust the timeout duration as needed
            });
          });
        } else {


          let isMouseOverPopup = false;

          marker.on("mouseover", () => {

            const popupContent = `<div id="expert-popup" style='position: relative; padding: 15px; font-size: 14px; line-height: 1.5; width: 250px;'>
                      <div style="font-weight: bold; font-size: 16px; color: #13639e;">
                        ${experts.length === 1 ? experts[0]?.researcher_name || "Unknown" : `${experts.length} Experts at this Location`}
                      </div>
                      <div style="font-size: 14px; color: #333; margin-top: 5px;">
                        <strong>Location:</strong> ${experts[0]?.location_name || "Unknown"}
                      </div>
                      ${experts.length === 1 ? "" : `
                        <a href='#' 
                            class="view-experts-btn"
                            style="display: block; margin-top: 12px; padding: 8px 10px; background: #13639e; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">
                          View Experts
                        </a>
                      `}
                    </div>`;
            marker.bindPopup(popupContent).openPopup(); // Show popup on hover

            document.getElementById("expert-popup")?.addEventListener("mouseenter", () => {
              isMouseOverPopup = true;
            });
            document.getElementById("expert-popup")?.addEventListener("mouseleave", () => {
              isMouseOverPopup = false;
            });
          });

          marker.on("mouseout", () => {
            setTimeout(() => {
              if (!isMouseOverPopup) {
                marker.closePopup(); // Close popup when mouse leaves unless inside the popup
              }
            }, 200);
          });

          // Show expert panel on button click
          marker.on("popupopen", () => {
            document.querySelector(".view-experts-btn")?.addEventListener("click", (e) => {
              e.preventDefault();
              setSelectedPointExperts(experts); // Set experts for the point panel
              setPanelType("point"); // Set panel type to point
              setPanelOpen(true); // Open point panel
              marker.closePopup(); // Close popup after clicking
            });
          });

        }
      });
    }
  }, [geoData]);

  return (
    <div style={{ display: 'flex' }}>
      <div id="map" style={{ flex: 1, height: '100vh' }}></div>
      {panelOpen && panelType === "polygon" && selectedExperts.length > 0 && (
        <div
          style={{
            width: '300px',
            background: '#f0f0f0',
            padding: '20px',
            overflowY: 'auto',
            height: '80vh',
            position: 'relative'
          }}
        >
          <button
            onClick={() => setPanelOpen(false)}
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

          {/* Display Location (taken from the first expert) */}
          {selectedExperts.length > 0 && (
            <div style={{ marginBottom: '20px', fontSize: '14px', color: '#555' }}>
              <strong>Location:</strong> {selectedExperts[0].properties.location_name || "Unknown"}
            </div>
          )}

          <ul>
            {selectedExperts
              .sort((a, b) => a.properties.researcher_name.localeCompare(b.properties.researcher_name)) // Sort alphabetically by name
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
                    {expert.properties.researcher_name}
                  </div>
                  <div style={{ marginTop: "10px", fontSize: "13px" }}>
                    <strong>Related Works:</strong> {expert.properties.work_count || "N/A"}
                  </div>
                  <a
                    href={expert.properties.researcher_url || "#"}
                    target={expert.properties.researcher_url ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      marginTop: "12px",
                      padding: "8px 10px",
                      background: expert.properties.researcher_url ? "#13639e" : "#ccc",
                      color: "white",
                      textAlign: "center",
                      borderRadius: "5px",
                      textDecoration: "none",
                      fontWeight: "bold",
                      opacity: expert.properties.researcher_url ? "1" : "0.6",
                      cursor: expert.properties.researcher_url ? "pointer" : "default"
                    }}
                  >
                    {expert.properties.researcher_url ? "View Profile" : "No Profile Found"}
                  </a>
                </div>
              ))}
          </ul>
        </div>
      )}
      {panelOpen && panelType === "point" && selectedPointExperts.length > 0 && (
        <PointExpertsPanel
          experts={selectedPointExperts}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
};

export default ResearchMap;