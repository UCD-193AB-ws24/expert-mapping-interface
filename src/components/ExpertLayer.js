import { useEffect } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";

import {
  createSingleResearcherContent,
  createMultiResearcherContent,
  createGrantPopupContent,
  createMultiGrantPopup,
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

    const filteredFeatures = geoData?.features?.filter(
      (f) => (!f.properties?.type || f.properties?.type === "work") && showWorks
    );

    const markerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: false,
      iconCreateFunction: (cluster) => {
        const totalExperts = cluster
          .getAllChildMarkers()
          .reduce((sum, marker) => sum + marker.options.expertCount, 0);
        return L.divIcon({
          html: `<div style="background: #13639e; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${totalExperts}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40),
        });
      },
    });

    const locationMap = new Map();
    const locationExpertCounts = new Map();
    const polygonLayers = [];
    let activePopup = null;
    let closeTimeout = null;

    filteredFeatures?.forEach((feature) => {
      const geometry = feature.geometry;
      const entries = feature.properties.entries || [];
      const location = feature.properties.location || "Unknown";
      //const locationId = feature.properties.location_id;
      let totalLocationExperts = 0;
      entries.forEach(entry => {
        const relatedExperts = entry.relatedExperts || [];
        totalLocationExperts += relatedExperts.length;
      });
      if (totalLocationExperts > 0) {
        console.log("Location:", location, "Total Experts:", totalLocationExperts);
      }
      if (location) {
        locationExpertCounts.set(location, (locationExpertCounts.get(location) || 0) + (totalLocationExperts || 0));
      }

      if (["Point", "MultiPoint"].includes(geometry.type)) {
        const coords = geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates;

        coords.forEach(([lng, lat]) => {
          const key = `${lat},${lng}`;
          if (!locationMap.has(key)) locationMap.set(key, []);

          const matchedEntries = [];

          //case sensitive, lower and uper case
          //quote check, if user types in "Marina", it will match to Marina
          //partial word matching
          //multi-word input, if entry contains both words it will show up
          entries.forEach(entry => {
            if (keyword) {
              const entryText = JSON.stringify({ ...feature.properties, ...entry }).toLowerCase(); //Lowercases both the entry and keyword for fair matching
              const quoteMatch = keyword.match(/^"(.*)"$/); // Detect exact phrase if user puts something in quotes
              if (quoteMatch) {
                const phrase = quoteMatch[1].toLowerCase();
                if (!entryText.includes(phrase)) return; //Exact Phrase Match
              } else {
                const terms = keyword.toLowerCase().split(/\s+/); //Multi-word split, all individual words must be present
                const matchesAll = terms.every(term => entryText.includes(term)); //Case-insensitive AND Partial
                if (!matchesAll) return;
              }
            }

            const expert = entry.relatedExperts?.[0];
            matchedEntries.push({
              researcher_name: expert?.name || entry.authors?.join(", ") || "Unknown",
              researcher_url: expert?.url
                ? `https://experts.ucdavis.edu/${expert.url}`
                : null,
              location_name: feature.properties.location || "Unknown",
              work_titles: [entry.title],
              work_count: 1,
              confidence: entry.confidence || "Unknown",
              type: "expert",
            });
          });

          if (matchedEntries.length > 0) {
            locationMap.get(key).push(...matchedEntries);
          }
        });
      }
    });


    const sortedPolygons = geoData.features
      .filter((feature) => {
        const geom = feature.geometry;
        const rings = geom?.coordinates;
        const outer = rings?.[0];
        return (
          geom?.type === "Polygon" &&
          Array.isArray(outer) &&
          outer.length >= 4 &&
          outer.length <= 200000
        );
      })
      .sort((a, b) => {
        const area = (f) => {
          const bounds = L.polygon(f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng])).getBounds();
          return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
        };
        return area(b) - area(a);
      });

    console.log("Polygons to draw:", sortedPolygons.length);
    const polygonsToRender = new Set();

    sortedPolygons.forEach((feature, i) => {
      const geometry = feature.geometry;
      const location = feature.properties.location;
      if (polygonsToRender.has(location)) return;
      if (location) polygonsToRender.add(location);

      const flippedCoordinates = geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng])
      );

      const name = feature.properties?.display_name || feature.properties?.location || "Unknown";
      console.log(" Drawing polygon:", name, flippedCoordinates[0]);

      const polygon = L.polygon(flippedCoordinates, {
        color: "blue",
        fillColor: "yellow",
        fillOpacity: 0.6,
        weight: 2,
      }).addTo(map);

      polygonLayers.push(polygon);


      polygon.on("mouseover", () => {
        if (!showWorks) return;
        if (closeTimeout) clearTimeout(closeTimeout);

        const expertCount = locationExpertCounts.get(location) || 0;

        const content = expertCount === 1
          ? createSingleResearcherContent(feature.properties.entries[0])
          : createMultiResearcherContent(expertCount, feature.properties.display_name || feature.properties.location || "Unknown", expertCount);

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
          .setContent(content)
          .openOn(map);

        const popupElement = activePopup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = 'auto';

          popupElement.addEventListener('mouseenter', () => {
            if (closeTimeout) clearTimeout(closeTimeout);
          });

          popupElement.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
              if (activePopup) {
                activePopup.close();
                activePopup = null;
              }
            }, 300);
          });

          const expertsAtLocation = geoData.features.filter(f => f.properties.location === location);

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

    console.log("Polygons drawn on map:", polygonLayers.length);

    locationMap.forEach((experts, key) => {
      if (!experts.length || (showGrants && showWorks && combinedKeys?.has(key))) return;
      const [lat, lng] = key.split(",").map(Number);

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${experts.length}</div>`,
          className: "custom-marker-icon",
          iconSize: [30, 30],
        }),
        experts,
        expertCount: experts.length,
      });

      marker.on("mouseover", () => {
        const content = experts.length === 1
          ? createSingleResearcherContent(experts[0])
          : createMultiResearcherContent(experts.length, experts[0]?.location_name, experts.reduce((s, e) => s + (parseInt(e.work_count) || 0), 0));

        activePopup = L.popup({ closeButton: false, autoClose: false, maxWidth: 250 })
          .setLatLng(marker.getLatLng())
          .setContent(content)
          .openOn(map);
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
      polygonLayers.forEach((p) => map.removeLayer(p));
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;
