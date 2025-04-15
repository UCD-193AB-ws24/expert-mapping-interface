// components/map/ExpertLayer.js

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
  setSelectedExperts,
  setSelectedPointExperts,
  setPanelOpen,
  setPanelType
}) => {
  const map = useMap();

  useEffect(() => {
    console.log("🔄 ExpertLayer triggered. showWorks:", showWorks);
    console.log("geoData in ExpertLayer:", geoData);
    if (!map || !geoData) return;

    const filteredFeatures = showWorks
      ? geoData.features.filter(f => f.properties?.researcher_name || f.properties?.work_titles)
      : [];
    console.log("Filtered experts:", filteredFeatures);
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
      } else if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        const polygon = L.geoJSON(feature, {
          style: {
            color: "#13639e",
            weight: 2,
            fillOpacity: 0.2,
            fillColor: "#13639e"
          }
        });

        polygon.on("mouseover", (event) => {
          if (!showWorks) return;
          if (closeTimeout) clearTimeout(closeTimeout);

          const expertsAtLocation = geoData.features.filter(
            f => f.properties?.location_id === feature.properties.location_id
          );

          const totalWorks = expertsAtLocation.reduce((sum, expert) => {
            return sum + (parseInt(expert.properties?.work_count) || 0);
          }, 0);

          const popupContent = expertsAtLocation.length === 1
            ? createSingleResearcherContent(expertsAtLocation[0].properties)
            : createMultiResearcherContent(
                expertsAtLocation.length,
                feature.properties.location_name,
                totalWorks
              );

          if (activePopup) activePopup.close();

          activePopup = L.popup({
            closeButton: false,
            autoClose: false,
            maxWidth: 300,
            className: 'hoverable-popup',
            autoPan: false,
            keepInView: false,
            interactive: true
          })
            .setLatLng(polygon.getBounds().getCenter())
            .setContent(popupContent)
            .openOn(map);

          const popupElement = activePopup.getElement();
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
          }, 500);
        });

        polygon.addTo(map);
      }
    });

    locationMap.forEach((experts, key) => {
      const [lat, lng] = key.split(",").map(Number);
      const count = experts.length;
      const totalWorks = experts.reduce((sum, expert) => sum + (parseInt(expert.work_count) || 0), 0);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${count}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30],
        }),
        experts,
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

      marker.on("mouseover", () => {
        if (closeTimeout) clearTimeout(closeTimeout);

        const content = count === 1 
          ? (experts[0].type === "grant"
            ? createGrantPopupContent(experts[0])
            : createSingleResearcherContent(experts[0]))
          : (experts[0].type === "grant"
            ? createMultiGrantPopup(experts, experts[0]?.location_name || "Unknown")
            : createMultiResearcherContent(
                count,
                experts[0]?.location_name || "Unknown",
                totalWorks
              ));

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

    return () => {
      map.removeLayer(markerClusterGroup);
    };
  }, [map, geoData, showWorks, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;
