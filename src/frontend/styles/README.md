# Frontend Styles and Leaflet Marker Configuration

This folder contains styling and icon configuration files for the Expert Mapping Interface frontend. It handles both global CSS and fixes for third-party assets like Leaflet icons.

---

## Purpose

- Define and customize the global look of the mapping interface (layout, colors, map size, slider, etc.)
- Ensure correct rendering of Leaflet marker icons in a React environment (fixes broken icon links caused by build systems)

---

## Components

### 1. `icon-fix.js`
- Imports Leaflet’s default marker and shadow icons directly from the package
- Overrides the default marker globally using:
  ```js
  L.Marker.prototype.options.icon = DefaultIcon;

### 2. `index.css`
- Loads Tailwind CSS base, component, and utility classes
- Adds custom styles for:
  - Full-page map layout (`#map`, `.leaflet-container`)
  - Map legends and typography
  - Custom date slider appearance (`.custom-track`, `.custom-thumb`, etc.)

*Marina Mata, Alyssa Vallejo 2025*