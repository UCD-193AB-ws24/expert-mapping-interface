# PostGIS Database Integration

This directory contains the PostGIS database integration code for storing and retrieving geospatial expert-associated works and grants; data produced by [ETL pipeline](../etl/README.md)

## Overview

This module manages the storage and retrieval of geospatial data for the Expert Mapping Interface using PostGIS, an extension of PostgreSQL. It is responsible for:

- Storing expert-associated works and grants as GeoJSON features with geometry types: Point & Polygon
- Facilitating frontend data fetching for desired geospatial features.
- Offering utility scripts for table creation, data upload, inspection, and debugging.

The integration with PostGIS ensures that the system can handle large, complex geospatial datasets and deliver fast, interactive map-based exploration of UC Davis research activities worldwide.

---

## 📋 Components

### 1.  config.js
- Sets database configuration parameters
- Manages PostGIS connection pool setup

### 2.  createTables.js
- Initializes tables and indexes for grants and works
- Sets up proper table structure with geometric data types

### 3.  dropTables.js
- Deletes tables and their contents (CASCADE)
- Used during development or for clean reinstallation

### 4.  uploadFeatures.js
- Uploads generated GeoJSONs for grants and works
- Converts GeoJSON features to PostGIS geometry format

### 5.  viewTables.js
- Utility function for viewing database contents
- Helps debug and inspect database records

### 6.  fetchFeatures.js
- Utilizes endpoints in server.js to retrieve grant and work features
- Returns formatted GeoJSON's for map rendering
- Output files:
  - `workFeatures.geojson`:  Research work data with coordinates
  - `grantFeatures.geojson`: Grant data with coordinates

---

## Output Files
- `workFeatures.geojson`: Research work data with coordinates (for map rendering)
- `grantFeatures.geojson`: Grant data with coordinates (for map rendering)

![ETL Pipeline Diagram](../../assets/postgis.png)

*Zoey Vo, Loc Nguyen, 2025*

---

## 🚀 How to Run the Full PostGIS Workflow

1. **Run the ETL pipeline to generate GeoJSONs:**
   ```bash
   # Run the full ETL pipeline (see ETL README for details)
   node ./src/backend/etl/aggieExpertsAPI/persistExpertProfiles.js
   node ./src/backend/etl/aggieExpertsAPI/getExpertFeatures.js
   node ./src/backend/etl/locationAssignment/processLocations.js
   node ./src/backend/etl/geojsonGeneration/generateGeoJson.js
   ```

2. **Create the PostGIS tables:**
   ```bash
   node ./src/backend/postgis/createTables.js
   ```

3. **Upload the generated GeoJSON features to PostGIS:**
   ```bash
   node ./src/backend/postgis/uploadFeatures.js
   ```

4. *(Optional)* **View or debug table contents:**
   ```bash
   node ./src/backend/postgis/viewTables.js
   ```

5. **Fetch features for use in the frontend or for inspection:**
   ```bash
   node ./src/backend/postgis/fetchFeatures.js
   ```

This workflow will take you from raw data extraction to a fully populated PostGIS database, ready for map-based visualization and querying.