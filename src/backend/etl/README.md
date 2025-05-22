# ETL Pipeline for Expert Mapping Interface

This directory contains the Extract, Transform, Load (ETL) pipeline for the Expert Mapping Interface. The pipeline fetches data from Aggie Experts API, processes locations, and generates geojson files which geographically represent expert matched works and grants.

## Overview

```
Data Fetching → Location Processing → GeoJSON Generation 
```

---

## 📋 Components

### 1. Data Extraction (`/aggieExpertsAPI`)

- **persistExpertProfiles.js**: Main controller for fetching and persisting expert profiles with works and grants to both file storage and Redis cache.
- **getExpertFeatures.js**: Retrieves cached expert profiles and generates formatted work and grant feature collections, supporting both recent-only (default) and full dataset retrieval.
- **services/fetchExpertID.js**: Handles the retrieval of all expert IDs from the Aggie Experts API.
- **services/fetchProfileByID.js**: Fetches detailed information for a specific expert profile, including associated works and grants, with support for paginated data retrieval.
- **services/expertProfileCache.js**: Oversees the caching and retrieval of expert profiles in Redis, utilizing session-based storage to monitor updates and changes over time.
- **utils/formatFeatures.js**: Converts expert profiles into structured formats focused on works and grants, establishing relationship mappings between them.
  - Example:
    ```bash
    node ./src/backend/etl/aggieExpertsAPI/persistExpertProfiles.js [numExperts=1] [worksLimit=5] [grantsLimit=5]
    node ./src/backend/etl/aggieExpertsAPI/getExpertFeatures.js [--all]
    ```
- Output files:
  - `expertProfiles.json`: Complete expert profiles with associated works and grants, including metadata like timestamps and session IDs
  - `worksFeatures.json`: Work-centric data with related expert information and bibliographic metadata
  - `grantsFeatures.json`: Grant-centric data with related expert information and funding details
- Redis caching structure:
  - Expert profiles stored with key pattern: `expert:{expertId}`
  - Session-based tracking for detecting changes
  - Metadata stored as `expert:metadata` with statistics and timestamps

### 2. Location Processing (`/locationAssignment`)

- **extractLocations.js**: Uses LLM (llama3.3) to identify geographic entities from text
  - Prompts LLM to extract location and provide its confidence score in JSON format `Example: {"Location": "California", "Confidence": 90}`
  - Parses and filters the LLM's response
- **validateLocations.js**: Validates extracted location names against ISO references
  - Uses Nominatim Geocoding API and also prompts LLM for ISO codes to cross-check and assess the extracted locations
  - Calculates confidence metric based on the distance between 2 methods and the LLM's original confidence
- **geocodeLocations.js**: Converts locations to geographic coordinates
- **processLocations.js**: Manages the complete location workflow

- Example: 
  ```bash
  node ./src/backend/etl/locationAssignment/processLocations.js
  ```
- Output files:
  - **extractLocations.js**:
    - `works/locationBasedWorks.json`: Work-centric data with additional `location` and `llmConfidence` fields
    - `grants/locationBasedGrants.json`: Grant-centric data with additional `location` and `llmConfidence` fields
  - **validateLocations.js**:
    - `works/validatedWorks.json`: Locations with associated works
    - `grants/validatedGrants.json`: Locations with associated grants
  - **geocodeLocations.js**:
    - `locations/locationCoordinates.geojson`: Locations with corresponding metadata and geographic polygon coordinates

### 3. GeoJSON Generation (`/geojsonGeneration`)

- **generateGeoJson.js**: Creates finalized GeoJSON files to be stored in PostGIS
- Example:
    ```bash
    node ./src/backend/etl/geojsonGeneration/generateGeoJson.js
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
node ./src/backend/etl/aggieExpertsAPI/persistExpertProfiles.js

# 2. Match experts with works and grants
node ./src/backend/etl/aggieExpertsAPI/getExpertFeatures.js

# 3. Extract, validate, and geocode locations associated with matched features
node ./src/backend/etl/locationAssignment/processLocations.js

# 4. Generate GeoJSON of each feature type for visualization
node ./src/backend/etl/geojsonGeneration/generateGeoJson.js
```

Each component can be run individually for testing or development purposes.

![ETL Pipeline Diagram](../../assets/etl.png)

*Zoey Vo, Loc Nguyen, 2025*
