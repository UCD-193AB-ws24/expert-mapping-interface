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
  searchKeyword,
  setSelectedExperts,
  setSelectedPointExperts,
  setPanelOpen,
  setPanelType,
  combinedKeys 
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !geoData) return;

    const zoomThresholds = {
      continental: 2, // Show continental polygons at zoom level 2 or lower
      country: 3,     // Show country polygons at zoom level 3-5
      state: 4,       // Show state polygons at zoom level 6-8
      city: 6,       // Show city polygons at zoom level 9-12
      points: 8      // Show individual points at zoom level 13 or higher
    };

    const polygonLayers = [];
    let markerClusterGroup = L.markerClusterGroup({
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

    let activePopup = null;
    let closeTimeout = null;

    const renderFeatures = () => {
      const currentZoom = map.getZoom();

      // Clear existing layers
      polygonLayers.forEach(layer => map.removeLayer(layer));
      map.removeLayer(markerClusterGroup);
      markerClusterGroup = L.markerClusterGroup({
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

      const getPolygonArea = (coordinates) => {
        const bounds = L.polygon(coordinates.map(([lng, lat]) => [lat, lng])).getBounds();
        return (bounds.getEast() - bounds.getWest()) * (bounds.getNorth() - bounds.getSouth());
      };

      const sortedPolygons = geoData.features
        .filter(feature => feature.geometry.type === "Polygon")
        .map(feature => ({
          ...feature,
          area: getPolygonArea(feature.geometry.coordinates[0])
        }))
        .sort((a, b) => b.area - a.area); // Sort by area descending

      const polygonsToRender = sortedPolygons.filter(feature => {
        const area = feature.area;

        if (currentZoom <= zoomThresholds.continental) {
          return area > 100000; // Example threshold for continental polygons
        } else if (currentZoom <= zoomThresholds.country) {
          return area > 10000 && area <= 100000; // Example threshold for country polygons
        } else if (currentZoom <= zoomThresholds.state) {
          return area > 1000 && area <= 10000; // Example threshold for state polygons
        } else if (currentZoom <= zoomThresholds.city) {
          return area > 100 && area <= 1000; // Example threshold for city polygons
        }
        return false;
      });

      const pointsToRender = geoData.features.filter(feature => {
        return feature.geometry.type === "Point" && currentZoom >= zoomThresholds.points;
      });

      // Render polygons
      polygonsToRender.forEach(feature => {
        const flippedCoordinates = feature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
        const polygon = L.polygon(flippedCoordinates, {
          color: '#13489e',
          weight: 2,
          fillColor: '#1e5bbd',
          fillOpacity: 0.5
        }).addTo(map);

        polygonLayers.push(polygon);

        polygon.on("mouseover", () => {
          if (closeTimeout) clearTimeout(closeTimeout);

          const name = feature.properties?.display_name || feature.properties?.location || "Unknown";
          const content = `<strong>${name}</strong>`;
          activePopup = L.popup({ closeButton: false, autoClose: false })
            .setLatLng(polygon.getBounds().getCenter())
            .setContent(content)
            .openOn(map);
        });

        polygon.on("mouseout", () => {
          closeTimeout = setTimeout(() => {
            if (activePopup) {
              activePopup.close();
              activePopup = null;
            }
          }, 300);
        });

        polygon.on("click", () => {
          const expertsAtLocation = geoData.features.filter(f => f.properties?.location_id === feature.properties.location_id);
          setSelectedExperts(expertsAtLocation);
          setPanelType("polygon");
          setPanelOpen(true);
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        });
      });

      // Render points
      pointsToRender.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>1</div>`,
            className: "custom-marker-icon",
            iconSize: [30, 30]
          })
        });

        marker.on("mouseover", () => {
          if (closeTimeout) clearTimeout(closeTimeout);

          const content = createSingleResearcherContent(feature.properties);
          activePopup = L.popup({ closeButton: false, autoClose: false })
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
          }, 300);
        });

        marker.on("click", () => {
          setSelectedPointExperts([feature.properties]);
          setPanelType("point");
          setPanelOpen(true);
          if (activePopup) {
            activePopup.close();
            activePopup = null;
          }
        });

        markerClusterGroup.addLayer(marker);
      });

      map.addLayer(markerClusterGroup);
    };

    // Initial render
    renderFeatures();

    // Add zoom listener
    map.on('zoomend', renderFeatures);

    return () => {
      map.off('zoomend', renderFeatures);
      polygonLayers.forEach(layer => map.removeLayer(layer));
      map.removeLayer(markerClusterGroup);
    };
  }, [map, geoData, showWorks, showGrants, searchKeyword, setSelectedExperts, setSelectedPointExperts, setPanelOpen, setPanelType]);

  return null;
};

export default ExpertLayer;