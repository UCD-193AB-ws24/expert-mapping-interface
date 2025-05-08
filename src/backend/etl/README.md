# ETL Pipeline for Expert Mapping Interface

This directory contains the Extract, Transform, Load (ETL) pipeline for the Expert Mapping Interface. The pipeline fetches data from Aggie Experts API, processes locations, and generates geojson files which geographically represent expert matched works and grants.

## Overview

```
Data Fetching → Location Processing → GeoJSON Generation 
```

---

## 📋 Components

### 1. Data Extraction (`/aggieExpertsAPI`)

- **persistExpertProfiles.js**: Main file for fetching and persisting expert profiles with their works and grants.
- **services/fetchAllExpertProfiles.js**: Retrieves all expert profiles from the Aggie Experts API.
- **services/fetchProfile.js**: Processes and formats expert profile data including works and grants.
- **services/fetchExpert.js**: Retireves all expert id's via Aggie Experts API.
- **utils/formatFeatures.js**: Formats expert profiles into work-centric and grant-centric JSON files.
  - Example:
    ```bash
    node ./src/geo/etl/aggieExpertsAPI/persistExpertProfiles.js
    ```
- Output files:
  - `expertProfiles.json`: Contains all expert profiles with their associated works and grants
  - `worksFeatures.json`: Work-centric data with related expert information
  - `grantsFeatures.json`: Grant-centric data with related expert information
- Redis caching:
  - Redis containing expert profile data
  - Accessible via KEYS:
    - expert:*

### 2. Location Processing (`/locationAssignment`)

- **extractLocations.js**: Uses LLM (llama3.3) to identify geographic entities from text
- **validateLocations.js**: Standardizes location names against ISO references
- **geocodeLocations.js**: Converts locations to geographic coordinates
- **processLocations.js**: Manages the complete location workflow

### 3. GeoJSON Generation (`/geojsonGeneration`)

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

*Zoey Vo, Loc Nguyen, 2025*
