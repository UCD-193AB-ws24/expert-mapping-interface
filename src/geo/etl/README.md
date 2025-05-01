# ETL Pipeline for Expert Mapping Interface

This directory contains the Extract, Transform, Load (ETL) pipeline for the Expert Mapping Interface. The pipeline fetches data from Aggie Experts API, processes locations, and generates geojson files which geographically represent expert matched works and grants.

## Overview

```
Data Fetching → Expert Matching → Location Processing → GeoJSON Generation 
```

---

## 📋 Components

### 1. Data Extraction (`/aggieExpertsAPI`)

- **services/FetchingService.js**: Core service that handles fetching and caching data from the Aggie Experts API to Redis.
- **fetchFeatures.js**: Unified entry point for fetching all data types (experts, works, grants).
  - Example:
    ```bash
    node ./src/geo/etl/aggieExpertsAPI/fetchFeatures.js [expert|work|grant]
    ```
  - No arguments → fetch all types
- Output data:
  - Redis containing fetched expert, work, and grant data
  - Accessible via KEYS:
    - expert:*
    - work:*
    - grant:*

### 2. Expert Matching (`/aggieExpertsAPI`)

- **matchFeatures.js**: Orchestrates the matching process for works and grants to experts using the Redis cache.
- **services/MatchingService.js**: Contains the logic for matching works (by author name) and grants (by expert url) to experts.
- Example:
    ```bash
    node ./src/geo/etl/aggieExpertsAPI/matchFeatures.js [work|grant]
    ```
  - No arguments → match both
- Output files:
  - `expertMatchedWorks.json`:  Research work data with associated expert profiles
  - `expertMatchedGrants.json`: Grant data with with associated expert profiles


### 3. Location Processing (`/locationAssignment`)

- **extractLocations.js**: Uses LLM (llama3.3) to identify geographic entities from text
- **validateLocations.js**: Standardizes location names against ISO references
- **geocodeLocations.js**: Converts locations to geographic coordinates
- **processLocations.js**: Manages the complete location workflow

### 4. GeoJSON Generation (`/geojsonGeneration`)

- **generateGeoJson.js**: Creates finalized GeoJSON files to be stored in PostGIS
- Example:
    ```bash
    node ./src/geo/etl/geojsonGeneration/generateGeoJson.js
    ```
- Output files:
  - `generatedWorks.geojson`:  Research work data with coordinates
  - `generatedGrants.geojson`: Grant data with coordinates

## Data Storage

- **Redis**: Caching of unmatched API data
- **GeoJSON files**: Final output for the map visualization component

### Run the complete ETL pipeline:

```bash
# 1. Fetch all data from Aggie Experts API
node ./src/geo/etl/aggieExpertsAPI/fetchFeatures.js

# 2. Match experts with works and grants
node ./src/geo/etl/aggieExpertsAPI/matchFeatures.js

# 3. Extract, validate, and geocode locations associated with matched features
node ./src/geo/etl/locationAssignment/processLocations.js

# 4. Generate GeoJSON of each feature type for visualization
node ./src/geo/etl/geojsonGeneration/generateGeoJson.js
```

Each component can be run individually for testing or development purposes.

![ETL Pipeline Diagram](../../assets/etl.png)

*© Zoey Vo, Loc Nguyen, 2025*
