
const renderPoints = ({
  locationMap,
  map,
  markerClusterGroup,
  setSelectedWorks,
  setPanelType,
  setPanelOpen,
  expertsMap,
  worksMap,
}) => {
  locationMap.forEach((locationData, locationID) => {
    if (locationData.geometryType !== "Point" || locationData.expertIDs.length === 0) return; // Skip locations with 0 experts

    // Swap [lng, lat] to [lat, lng]
    const [lng, lat] = locationData.coordinates;
    const flippedCoordinates = [lat, lng];

    const marker = L.marker(flippedCoordinates, {
      icon: L.divIcon({
        html: `<div style='background: #13639e; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold;'>${locationData.expertIDs.length}</div>`,
        className: "custom-marker-icon",
        iconSize: [30, 30],
      }),
      expertCount: locationData.expertIDs.length, // Add expertCount to marker options
    });

    let workPointPopup = null;
    let workPointCT = null; // CT = closetimeout

    marker.on("mouseover", () => {
      if (workPointCT) clearTimeout(workPointCT);
      const content = createMultiExpertContent(
        locationData.expertIDs.length,
        locationData.name,
        locationData.workIDs.length
      );

      if (workPointPopup) workPointPopup.remove();
      workPointPopup = L.popup({
        closeButton: false,
        autoClose: false,
        maxWidth: 300,
        className: "hoverable-popup",
        autoPan: false,
      })
        .setLatLng(marker.getLatLng())
        .setContent(content)
        .openOn(map);
        const popupElement = workPointPopup.getElement();
        if (popupElement) {
          popupElement.style.pointerEvents = "auto";
  
          popupElement.addEventListener("mouseenter", () => {
            clearTimeout(workPointCT);
          });
  
          popupElement.addEventListener("mouseleave", () => {
            workPointCT = setTimeout(() => {
              if (workPointPopup) {
                workPointPopup.close();
                workPointPopup = null;
              }
            }, 200);
          });
  
          const viewWPointExpertsBtn = popupElement.querySelector(".view-w-experts-btn");
          if (viewWPointExpertsBtn) {
            // console.log('View Experts was pushed on a point!');
            viewWPointExpertsBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
  
              const panelData = preparePanelData(
                locationData.expertIDs,
                locationData.workIDs,
                expertsMap,
                worksMap,
                locationID // Pass the current locationID
              );
              console.log("Panel Data for Marker:", panelData); // Debugging log
              setSelectedWorks(panelData); // Pass the prepared data to the panel
              setPanelType("works");
              setPanelOpen(true);
  
              if (workPointPopup) {
                workPointPopup.close();
                workPointPopup = null;
              }
            });
          }
        }    
    });

    marker.on("mouseout", () => {
      workPointCT = setTimeout(() => {
        if (workPointPopup) {
          workPointPopup.close();
          workPointPopup = null;
        }
      }, 200);
    });

    markerClusterGroup.addLayer(marker);
  });

  map.addLayer(markerClusterGroup);
};