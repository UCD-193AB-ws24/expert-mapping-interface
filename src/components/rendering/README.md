# Map Rendering Components

This folder contains the core rendering logic for the Expert Mapping Interface frontend. It is responsible for visualizing geospatial data using Leaflet, including markers, polygons, interactive popups, side panels, and search/zoom-based filters.

---

## Overview

The `rendering/` directory powers all the map visualization and interaction features. It handles:

- Drawing expert and grant data on the Leaflet map
- Filtering visible features based on search terms and zoom level
- Rendering popups and dynamic panels
- Preparing and structuring data for UI display

---

## Structure

### filters/
- `searchFilter.js` – Filters map data based on keyword matches (title, abstract, funder, etc.)
- `zoomFilter.js` – Filters features shown depending on current zoom level

### utils/
- `preparePanelData.js` – Organizes expert data to be passed to side panels for display

---

##Components

### Layer Components
- `GrantLayer.js` – Draws grant polygons/markers with popups and filtering
- `WorkLayer.js` – Renders expert-related research areas and clustering
- `CombinedLayer.js` – Displays a unified marker when grant and work data overlap

### Panel Components
- `Panels.js` – Renders the side panel interface for grants and experts
- `CombinedPanel.js` – Used when a location contains both grant and expert data

### Popup Logic
- `Popups.js` – Creates popup content for grants/works with keyword match highlighting

### Data Preprocessing
- `ProcessGeoJSON.js` – Normalizes and processes incoming GeoJSON to consistent structure

---

## Notes

- This is the main logic layer between map data and UI.
- Filtering is keyword- and zoom-sensitive, designed to improve map clarity and performance.
- Popups and panels are generated dynamically based on matched fields and locations.

*Marina Mata, Alyssa Vallejo, 2025*
