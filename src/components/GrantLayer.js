// components/map/GrantLayer.js
import { useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import {
  createGrantPopupContent,
  createMultiGrantPopup
} from "./Popups";

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
    if (!map || !showGrants || !grantGeoJSON) return;

    const keyword = searchKeyword?.toLowerCase() || "";
    const locationMap = new Map();
    let activePopup = null;
    let closeTimeout = null;

    (grantGeoJSON?.features || []).forEach((feature) => {
      if (!feature.geometry || (feature.geometry.type !== "Point" && feature.geometry.type !== "Polygon")) return;


let lat, lng;

if (feature.geometry.type === "Point") {
  [lng, lat] = feature.geometry.coordinates;
} else if (feature.geometry.type === "Polygon") {
  const latlngs = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
  const center = L.polygon(latlngs).getBounds().getCenter();
  lat = center.lat;
  lng = center.lng;
} else {
  return; // skip unsupported geometry
}

      const key = `${lat},${lng}`;
      if (!locationMap.has(key)) locationMap.set(key, []);

      const entries = feature.properties.entries || [];
      const matchedEntries = [];
      
      //case sensitive, lower and uper case
          //quote check, if user types in "Marina", it will match to Marina
          //partial word matching
          //multi-word input, if entry contains both words it will show up
      entries.forEach(entry => {
        if (keyword) {
          const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase();
          const quoteMatch = keyword.match(/^"(.*)"$/);
          if (quoteMatch) {
            const phrase = quoteMatch[1].toLowerCase();
            if (!entryText.includes(phrase)) return;
          } else {
            const terms = keyword.toLowerCase().split(/\s+/);
            const matchesAll = terms.every(term => entryText.includes(term));
            if (!matchesAll) return;
          }
        }


        entry.location_name = feature.properties.location;
        entry.researcher_name = entry.relatedExpert?.name || "Unknown";
        entry.researcher_url = entry.relatedExpert?.url
          ? `https://experts.ucdavis.edu/${entry.relatedExpert.url}`
          : null;

        matchedEntries.push(entry);
      });

      if (matchedEntries.length > 0) {
        locationMap.get(key).push(...matchedEntries);
      }
    });

    const markers = [];

    locationMap.forEach((grants, key) => {
      if (!grants || grants.length === 0) return;
      if (showGrants && showWorks && combinedKeys?.has(key)) return;

      const [lat, lng] = key.split(",").map(Number);
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #f59e0b; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${grants.length}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30],
        }),
        grantCount: grants.length,
        grants,
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

      marker.on("mouseover", () => {
        if (!grants || grants.length === 0 || !grants[0]) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const content = grants.length === 1
          ? createGrantPopupContent(grants[0])
          : createMultiGrantPopup(grants, grants[0].location_name);

        popup.setLatLng(marker.getLatLng())
             .setContent(content)
             .openOn(map);

        activePopup = popup;

        const popupElement = popup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';

          popupElement.addEventListener("mouseenter", () => {
            if (closeTimeout) clearTimeout(closeTimeout);
          });

          popupElement.addEventListener("mouseleave", () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 500);
          });

          const viewGrantsBtn = popupElement.querySelector(".view-grants-btn");
          if (viewGrantsBtn) {
            viewGrantsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedGrants(grants);
              setPanelType("grants");
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

      marker.addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach((marker) => {
        map.removeLayer(marker);
      });
    };
  }, [map, grantGeoJSON, showGrants, searchKeyword, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;
