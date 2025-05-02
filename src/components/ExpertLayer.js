import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";

import {
  noResearcherContent,
  createSingleResearcherContent,
  createMultiResearcherContent,
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

    const keyword = searchKeyword?.toLowerCase() || "";
    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
    });

    const polygonLayers = [];
    let activePopup = null;
    let closeTimeout = null;

    const getPlaceRankRange = (zoomLevel) => {
      if (zoomLevel === 2) return [2, 4];
      if (zoomLevel >= 3 && zoomLevel <= 4) return [5, 8];
      if (zoomLevel >= 5 && zoomLevel <= 6) return [9, 16];
      if (zoomLevel >= 7) return [17, Infinity];
      return [Infinity, Infinity];
    };

    const filterFeaturesByZoomAndPlaceRank = (features, zoomLevel) => {
      const [minRank, maxRank] = getPlaceRankRange(zoomLevel);
      return features.filter((feature) => {
        const placeRank = feature.properties.place_rank || Infinity;
        return placeRank >= minRank && placeRank <= maxRank;
      });
    };

    const renderPoints = (features, currentZoom) => {
      const locationMap = new Map();

      const filteredPoints = filterFeaturesByZoomAndPlaceRank(features, currentZoom);

      filteredPoints.forEach((feature) => {
        const geometry = feature.geometry;
        const properties = feature.properties || {};
        const entries = properties.entries || [];
        const location = properties.location || "Unknown";

        if (["Point", "MultiPoint"].includes(geometry.type)) {
          const coords =
            geometry.type === "Point"
              ? [geometry.coordinates]
              : geometry.coordinates;

          coords.forEach(([lng, lat]) => {
            const key = `${lat},${lng}`;
            if (!locationMap.has(key)) locationMap.set(key, []);

            const popupEntries = [];
            const panelEntries = [];
            let totalExperts = 0;

            entries.forEach((entry) => {
              if (keyword) {
                const entryText = JSON.stringify({
                  ...properties,
                  ...entry,
                }).toLowerCase();
                const quoteMatch = keyword.match(/^"(.*)"$/);
                if (quoteMatch) {
                  const phrase = quoteMatch[1];
                  if (!entryText.includes(phrase)) return;
                } else {
                  const terms = keyword.split(/\s+/);
                  const matchesAll = terms.every((term) =>
                    entryText.includes(term)
                  );
                  if (!matchesAll) return;
                }
              }

              const relatedExperts = entry.relatedExperts || [];
              totalExperts += relatedExperts.length;

              const expert = relatedExperts[0];
              popupEntries.push({
                researcher_name:
                  expert?.name || entry.authors?.join(", ") || "Unknown",
                researcher_url: expert?.url
                  ? `https://experts.ucdavis.edu/${expert.url}`
                  : null,
                location_name: location,
                work_titles: [entry.title],
                work_count: 1,
                confidence: entry.confidence || "Unknown",
                type: "expert",
              });

              panelEntries.push({
                ...entry,
                relatedExperts,
                location_name: location,
              });
            });

            if (totalExperts === 0) return;

            if (popupEntries.length > 0) {
              locationMap.get(key).push(...popupEntries);
              locationMap.get(key).panelData = panelEntries;
              locationMap.get(key).totalExperts = totalExperts;
            }
          });
        }
      });

      locationMap.forEach((experts, key) => {
        if (!experts.length || (showGrants && showWorks && combinedKeys?.has(key))) return;

        const [lat, lng] = key.split(",").map(Number);
        const totalExperts = locationMap.get(key).totalExperts || 0;

        if (totalExperts === 0) return;

        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${totalExperts}</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30],
          }),
          experts,
          expertCount: totalExperts,
          panelData: locationMap.get(key).panelData,
        });

        marker.on("mouseover", () => {
          const content =
            totalExperts === 1
              ? createSingleResearcherContent(experts[0])
              : createMultiResearcherContent(
                  totalExperts,
                  experts[0]?.location_name,
                  experts.reduce((s, e) => s + (parseInt(e.work_count) || 0), 0)
                );

          if (activePopup) activePopup.close();

          activePopup = L.popup({
            closeButton: false,
            autoClose: false,
            maxWidth: 300,
            className: "hoverable-popup",
            autoPan: false,
          })
            .setLatLng(marker.getLatLng())
            .setContent(content)
            .openOn(map);

          const viewExpertsButton = document.querySelector(".view-experts-btn");
          if (viewExpertsButton) {
            viewExpertsButton.addEventListener("click", () => {
              const relatedExperts = marker.options.panelData?.flatMap(
                (entry) => entry.relatedExperts || []
              );
              if (!relatedExperts || relatedExperts.length === 0) return;

              setSelectedPointExperts(marker.options.panelData || []);
              setPanelType("point");
              setPanelOpen(true);
            });
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
    };

    const renderPolygons = (features) => {
      features.forEach((feature) => {
        const properties = feature.properties || {};
        const entries = properties.entries || [];

        const totalExperts = entries.reduce(
          (sum, entry) => sum + (entry.relatedExperts?.length || 0),
          0
        );

        if (totalExperts === 0) return;

        const flippedCoordinates = feature.geometry.coordinates.map((ring) =>
          ring.map(([lng, lat]) => [lat, lng])
        );

        const polygon = L.polygon(flippedCoordinates, {
          color: "blue",
          fillColor: "#dbeafe",
          fillOpacity: 0.6,
          weight: 2,
        }).addTo(map);

        polygonLayers.push(polygon);

        polygon.on("mouseover", () => {
          if (closeTimeout) clearTimeout(closeTimeout);

          const content = createMultiResearcherContent(
            totalExperts,
            properties.location || "Unknown",
            entries.length || 0
          );

          if (activePopup) activePopup.close();

          activePopup = L.popup({
            closeButton: false,
            autoClose: false,
            maxWidth: 300,
            className: "hoverable-popup",
            autoPan: false,
          })
            .setLatLng(polygon.getBounds().getCenter())
            .setContent(content)
            .openOn(map);

          const viewExpertsButton = document.querySelector(".view-experts-btn");
          if (viewExpertsButton) {
            viewExpertsButton.addEventListener("click", () => {
              const relatedExperts = entries.flatMap((entry) => entry.relatedExperts || []);
              if (!relatedExperts || relatedExperts.length === 0) return;

              setSelectedExperts([{
                ...feature,
                properties: {
                  ...properties,
                  entries,
                },
              }]);
              setPanelType("polygon");
              setPanelOpen(true);
            });
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
    };

    const renderFeatures = () => {
      const currentZoom = map.getZoom();
      console.log(`Current Zoom Level: ${currentZoom}`);

      markerClusterGroup.clearLayers();
      polygonLayers.forEach((layer) => map.removeLayer(layer));
      polygonLayers.length = 0;

      let filteredFeatures;

      if (keyword) {
        console.log(`Filtering features by keyword: "${keyword}"`);
        filteredFeatures = geoData.features.filter((feature) => {
          const entryText = JSON.stringify(feature.properties).toLowerCase();
          return entryText.includes(keyword);
        });
      } else {
        console.log("Filtering features by zoom level and place_rank");
        filteredFeatures = filterFeaturesByZoomAndPlaceRank(
          geoData.features,
          currentZoom
        );
      }

      const points = filteredFeatures.filter((f) =>
        ["Point", "MultiPoint"].includes(f.geometry?.type)
      );
      const polygons = filteredFeatures.filter(
        (f) => f.geometry?.type === "Polygon"
      );

      renderPoints(points, currentZoom);
      renderPolygons(polygons);
    };

    renderFeatures();
    map.on("zoomend", renderFeatures);

    return () => {
      map.removeLayer(markerClusterGroup);
      polygonLayers.forEach((layer) => map.removeLayer(layer));
      map.off("zoomend", renderFeatures);
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;