// export default ExpertLayer;
import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";

import { 
  createSingleResearcherContent, 
  createMultiResearcherContent, 
  createGrantPopupContent, 
  createMultiGrantPopup 
} from "./Popups";

const ExpertLayer = ({
  geoData,
  showWorks,
  showGrants,
  setSelectedExperts,
  setSelectedPointExperts,
  setPanelOpen,
  setPanelType
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !geoData) return;

    const filteredFeatures = geoData.features.filter((f) => {
      const isExpert = !f.properties?.type || f.properties?.type === "expert";
      const isGrant = f.properties?.type === "grant";
      return (showWorks && isExpert) || (showGrants && isGrant);
    });

    if (filteredFeatures.length === 0) return;

    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers();
        const totalExperts = markers.reduce((sum, marker) => sum + marker.options.expertCount, 0);
        return L.divIcon({
          html: `<div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40)
        });
      }
    });

    const locationMap = new Map();
    const locationExpertCounts = new Map();
    let activePopup = null;
    let closeTimeout = null;
    const polygonLayers = [];  // ⬅️ Track polygon layers

    filteredFeatures.forEach((feature) => {
      if (!feature.properties || !feature.geometry) return;

      const { location_id } = feature.properties;
      if (location_id) {
        locationExpertCounts.set(location_id, (locationExpertCounts.get(location_id) || 0) + 1);
      }

      const geometry = feature.geometry;
      if (geometry.type === "Point" || geometry.type === "MultiPoint") {
        const coordsList = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates;
        coordsList.forEach(([lng, lat]) => {
          const key = `${lat},${lng}`;
          if (!locationMap.has(key)) locationMap.set(key, []);
          locationMap.get(key).push(feature.properties);
        });
      }
    });

    // 🧭 Draw Polygons
    const sortedPolygons = geoData.features
      .filter(feature => feature.geometry.type === "Polygon")
      .sort((a, b) => {
        const boundsA = L.polygon(a.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
        const boundsB = L.polygon(b.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
        const areaA = (boundsA.getEast() - boundsA.getWest()) * (boundsA.getNorth() - boundsA.getSouth());
        const areaB = (boundsB.getEast() - boundsB.getWest()) * (boundsB.getNorth() - boundsB.getSouth());
        return areaB - areaA;
      });

    const polygonsToRender = new Set();

    const calculateOpacity = (count) => {
      const min = 0.3, max = 0.7, maxExperts = 25;
      return Math.min(min + (max - min) * (count / maxExperts), max);
    };

    sortedPolygons.forEach(feature => {
      const geometry = feature.geometry;
      const locationId = feature.properties.location_id;
      if (polygonsToRender.has(locationId)) return;
      polygonsToRender.add(locationId);

      const flippedCoordinates = geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
      const expertCount = locationExpertCounts.get(locationId) || 0;
      const dynamicOpacity = calculateOpacity(expertCount);

      const polygon = L.polygon(flippedCoordinates, {
        color: '#13639e',
        weight: 2,
        fillColor: '#d8db9a',
        fillOpacity: dynamicOpacity
      }).addTo(map);

      polygonLayers.push(polygon); // ⬅️ Save to array

      polygon.on("mouseover", () => {
        if (!showWorks) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const expertsAtLocation = geoData.features.filter(f => f.properties?.location_id === locationId);
        const totalWorks = expertsAtLocation.reduce((sum, expert) => sum + (parseInt(expert.properties?.work_count) || 0), 0);

        const content = expertsAtLocation.length === 1
          ? createSingleResearcherContent(expertsAtLocation[0].properties)
          : createMultiResearcherContent(expertsAtLocation.length, feature.properties.location_name, totalWorks);

        if (activePopup) activePopup.close();
        activePopup = L.popup({ closeButton: false, autoClose: false, maxWidth: 300, className: 'hoverable-popup', autoPan: false, keepInView: false, interactive: true })
          .setLatLng(polygon.getBounds().getCenter())
          .setContent(content)
          .openOn(map);

        const popupElement = activePopup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';
          popupElement.addEventListener("mouseenter", () => { if (closeTimeout) clearTimeout(closeTimeout); });
          popupElement.addEventListener("mouseleave", () => {
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
              setSelectedExperts(expertsAtLocation);
              setPanelType("polygon");
              setPanelOpen(true);
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            });
          }
        }
      });

      polygon.on("mouseout", () => {
        closeTimeout = setTimeout(() => {
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        }, 300);
      });
    });

    // 📍 Draw Markers
    locationMap.forEach((experts, key) => {
      const [lat, lng] = key.split(",").map(Number);
      const count = experts.length;
      const totalWorks = experts.reduce((sum, expert) => sum + (parseInt(expert.work_count) || 0), 0);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${count}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30]
        }),
        experts,
        expertCount: count
      });

      const popup = L.popup({ closeButton: false, autoClose: false, maxWidth: 250, className: 'hoverable-popup', autoPan: false, keepInView: false, interactive: true });

      marker.on("mouseover", () => {
        if (closeTimeout) clearTimeout(closeTimeout);
        const content = count === 1
          ? (experts[0].type === "grant" ? createGrantPopupContent(experts[0]) : createSingleResearcherContent(experts[0]))
          : (experts[0].type === "grant" ? createMultiGrantPopup(experts, experts[0]?.location_name || "Unknown") : createMultiResearcherContent(count, experts[0]?.location_name || "Unknown", totalWorks));

        popup.setLatLng(marker.getLatLng()).setContent(content).openOn(map);
        activePopup = popup;

        const popupElement = popup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';
          popupElement.addEventListener("mouseenter", () => { if (closeTimeout) clearTimeout(closeTimeout); });
          popupElement.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 500);
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

      marker.on("mouseout", () => {
        closeTimeout = setTimeout(() => {
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        }, 500);
      });

      markerClusterGroup.addLayer(marker);
    });

    map.addLayer(markerClusterGroup);

    // 🧼 Cleanup markers + polygons
    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach(p => map.removeLayer(p));  // ✅ Clear polygons
    };
  }, [map, geoData, showWorks, showGrants, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;
