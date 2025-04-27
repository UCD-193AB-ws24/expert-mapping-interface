import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import {
  noResearcherContent,
  createSingleResearcherContent,
  createMultiResearcherContent
} from "./Popups";

const ExpertLayer = ({
  geoData,
  showWorks,
  showGrants,
  searchKeyword,
  setSelectedExperts,
  setSelectedPointExperts,
  setPanelOpen,
  setPanelType,
  combinedKeys,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !geoData) return;

    console.log("ExpertLayer - combinedKeys:", Array.from(combinedKeys));

    const keyword = searchKeyword?.toLowerCase() || "";
    const markerClusterGroup = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 });
    const locationExpertCounts = new Map();
    const polygonLayers = [];
    let activePopup = null;
    let closeTimeout = null;

    const filteredFeatures = geoData.features.filter(f => (!f.properties?.type || f.properties.type === "work") && showWorks);

    filteredFeatures.forEach(feature => {
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";
      const totalLocationExperts = entries.reduce((sum, e) => sum + (e.relatedExperts?.length || 0), 0);
      if (location) locationExpertCounts.set(location, (locationExpertCounts.get(location) || 0) + totalLocationExperts);
    });

    const sortedPolygons = geoData.features
      .filter(f => f.geometry?.type === "Polygon")
      .sort((a, b) => {
        const area = f => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    const polygonsToRender = new Set();

    sortedPolygons.forEach(feature => {
      const locationRaw = feature.properties.location || "Unknown";
      const location = locationRaw.trim().toLowerCase();

      console.log("ExpertLayer - Checking location:", location);

      if (!location || polygonsToRender.has(location)) return;
      polygonsToRender.add(location);

      // 🔹 Normalized overlap check
      if (showWorks && showGrants && [...combinedKeys].some(key => key.trim().toLowerCase() === location)) {
        console.log(`ExpertLayer - Skipping popup for overlapping location: ${location}`);
        return;
      }

      const flippedCoordinates = feature.geometry.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));
      const polygon = L.polygon(flippedCoordinates, { color: "blue", fillColor: "lightyellow", fillOpacity: 0.6, weight: 2 }).addTo(map);
      polygonLayers.push(polygon);

      polygon.on("mouseover", () => {
        if (!showWorks) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const expertCount = locationExpertCounts.get(locationRaw) || 0;
        const content = expertCount === 0
          ? noResearcherContent(expertCount, locationRaw, expertCount)
          : createMultiResearcherContent(expertCount, locationRaw, expertCount);

        if (activePopup) activePopup.close();
        activePopup = L.popup({ closeButton: false, autoClose: false, maxWidth: 300, className: 'hoverable-popup', autoPan: false })
          .setLatLng(polygon.getBounds().getCenter())
          .setContent(content)
          .openOn(map);

        const popupElement = activePopup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';
          popupElement.addEventListener('mouseenter', () => clearTimeout(closeTimeout));
          popupElement.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) { activePopup.close(); activePopup = null; }
            }, 300);
          });

          const viewExpertsBtn = popupElement.querySelector(".view-experts-btn");
          if (viewExpertsBtn) {
            viewExpertsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              const expertsAtLocation = geoData.features.filter(f => f.properties.location === locationRaw);
              setSelectedExperts(expertsAtLocation);
              setPanelType("polygon");
              setPanelOpen(true);
              if (activePopup) { activePopup.close(); activePopup = null; }
            });
          }
        }
      });

      polygon.on("mouseout", () => {
        closeTimeout = setTimeout(() => {
          if (activePopup) { activePopup.close(); activePopup = null; }
        }, 300);
      });
    });

    map.addLayer(markerClusterGroup);

    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach(p => map.removeLayer(p));
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;
