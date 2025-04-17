# 🗄️ PostGIS Database Integration

This directory contains the PostGIS database integration code for storing and retrieving geospatial data in the Expert Mapping Interface project.

## 📋 Overview

PostGIS extends PostgreSQL with geospatial capabilities, allowing efficient storage and querying of geographic data. This module handles the database operations for the expert mapping data.

---

## 📁 Component Files

### 1. ⚙️ config.js
- Sets database configuration parameters
- Manages PostGIS connection pool setup

### 2. 🏗️ createTables.js
- Initializes tables and indexes for grants and works
- Sets up proper table structure with geometric data types

### 3. 🗑️ dropTables.js
- Deletes tables and their contents (CASCADE)
- Used during development or for clean reinstallation

### 4. ⬆️ uploadAll.js
- Uploads generated GeoJSONs for grants and works
- Converts GeoJSON features to PostGIS geometry format

### 5. 👁️ viewTables.js
- Utility function for viewing database contents
- Helps debug and inspect database records

### 6. 🔍 fetchFeatures.js
- Utilizes endpoints in server.js to retrieve grant and work features
- Returns formatted GeoJSON for map rendering
