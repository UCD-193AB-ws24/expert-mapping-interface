//Handles rendering grant markers or polygons from GeoJSON.

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
  setSelectedGrants,
  setPanelOpen,
  setPanelType
}) => {
    const map = useMap();
//   useEffect(() => {
//     if (!map || !showGrants || !grantGeoJSON) return;
useEffect(() => {
    console.log("🔄 GrantLayer triggered. showGrants:", showGrants);
    console.log("grantGeoJSON:", grantGeoJSON);
  
    if (!map || !showGrants || !grantGeoJSON) return;
  

    const locationMap = new Map();
    let activePopup = null;
    let closeTimeout = null;

    grantGeoJSON.features.forEach((feature) => {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length !== 2) return;

      const [lng, lat] = coords;
      const key = `${lat},${lng}`;
      if (!locationMap.has(key)) locationMap.set(key, []);
      locationMap.get(key).push(feature.properties);
    });

    const markers = [];

    locationMap.forEach((grants, key) => {
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
            popupElement.style.pointerEvents = 'auto';
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
  }, [map, grantGeoJSON, showGrants, setSelectedGrants, setPanelOpen, setPanelType]);

  return null;
};

export default GrantLayer;
