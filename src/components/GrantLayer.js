import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { createMultiGrantPopup } from "./Popups";

/**
 * GrantLayer Component
 * Renders grant-related polygons on a Leaflet map with keyword filtering and interactive popups.
 */
const GrantLayer = ({
  grantGeoJSON,
  showGrants,
  searchKeyword,
  setSelectedGrants,
  setPanelOpen,
  setPanelType,
  combinedKeys,
  showWorks   
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !grantGeoJSON || !showGrants) return;

    const keyword = searchKeyword?.toLowerCase() || "";
    const polygonLayers = [];
    let activePopup = null;
    let closeTimeout = null;

    const sortedPolygons = grantGeoJSON.features
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

      if (!location || polygonsToRender.has(location)) return;

      // Skip if overlapping with combinedKeys
      if (showWorks && showGrants && [...combinedKeys].some(key => key.trim().toLowerCase() === location)) {
        console.log(`GrantLayer - Skipping popup for overlapping location: ${location}`);
        return;
      }

      const entries = feature.properties.entries || [];

      // --- Keyword Filtering ---
      const matchedEntries = entries.filter(entry => {
        if (!keyword) return true;
        const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
        const quoteMatch = keyword.match(/^"(.*)"$/);
        if (quoteMatch) {
          return entryText.includes(quoteMatch[1]);
        } else {
          const terms = keyword.split(/\s+/);
          return terms.every(term => entryText.includes(term));
        }
      });

      if (matchedEntries.length === 0) return;

      polygonsToRender.add(location);

      const flippedCoordinates = feature.geometry.coordinates.map(ring =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      const polygon = L.polygon(flippedCoordinates, {
        color: "darkblue",
        fillColor: "orange",
        fillOpacity: 0.5,
        weight: 2,
      }).addTo(map);

      polygonLayers.push(polygon);

      polygon.on("mouseover", () => {
        if (!showGrants) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const content = createMultiGrantPopup(matchedEntries.length, locationRaw);

        if (activePopup) activePopup.close();

        activePopup = L.popup({
          closeButton: false,
          autoClose: false,
          maxWidth: 300,
          className: 'hoverable-popup',
          autoPan: false
        })
          .setLatLng(polygon.getBounds().getCenter())
          .setContent(content)
          .openOn(map);

        const popupElement = activePopup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';
          popupElement.addEventListener('mouseenter', () => clearTimeout(closeTimeout));
          popupElement.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });

          const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
          if (viewGrantsBtn) {
            viewGrantsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              setSelectedGrants([feature]);
              setPanelType("grant-polygon");
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

    return () => {
      polygonLayers.forEach(p => map.removeLayer(p));
    };
  }, [map, grantGeoJSON, showGrants, searchKeyword, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;
