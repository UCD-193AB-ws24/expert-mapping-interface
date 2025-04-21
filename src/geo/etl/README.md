# ETL Pipeline for Expert Mapping Interface

This directory contains the Extract, Transform, Load (ETL) pipeline for the Expert Mapping Interface project. The pipeline processes data from the Aggie Experts API, extracts location information, validates it, geocodes it, and generates GeoJSON files for visualization on the map.

## Pipeline Overview

```
aggieExpertsAPI → locationAssignment → geojsonGeneration
```

## 📁 Directory Structure

### 1. /aggieExpertsAPI
Data extraction and expert matching process.

- **fetchAll.js**
  - Orchestrates the entire data fetch process by running:
    - a. fetchExperts.js - Retrieves expert profiles
    - b. fetchGrants.js - Retrieves grant information
    - c. fetchWorks.js - Retrieves research works

- **matchAll.js**
  - Associates grants and works with their respective experts
    - a. matchWorks.js - Matches works by expert name
    - b. matchGrants.js - Matches grants by expert URL

- **apiUtils.js**
  - Contains helper functions used across the API interaction modules

### 2. /locationAssignment
Process for extracting, validating, and geocoding locations from data.

- **processLocations.js**
  - Manages the location processing workflow:
    - a. **extractLocations.js**
      - Uses LLM (llama3.3) to extract geopolitical entities from work and grant text
      - Outputs structured location data (City, Country format)
    
    - b. **validateLocations.js**
      - Validates extracted locations against ISO standards
      - Ensures location names are standardized and recognized
    
    - c. **geocodeLocations.js**
      - Converts validated location names to geographic coordinates
      - Creates GeoJSON features for each valid location

### 3. /geojsonGeneration
Generation of final GeoJSON files for map visualization.

- **generateGeoJson.js**
  - Combines location coordinates with location-based works and grants
  - Generates two separate GeoJSON files:
    - grants.geojson - For visualizing grants on the map
    - works.geojson - For visualizing research works on the map

## Data Flow

1. Fetch expert, grant, and work data from Aggie Experts API
2. Match grants and works to experts
3. Extract location information from grant and work descriptions
4. Validate locations against standard geographical references
5. Convert locations to geographic coordinates
6. Generate GeoJSON files for map visualization

![ETL Diagram](../../assets/etl.png)

## Usage

To run the entire ETL pipeline:

```bash
node ./src/geo/etl/aggieExpertsAPI/fetchAll.js
node ./src/geo/etl/aggieExpertsAPI/matchAll.js
node ./src/geo/etl/locationAssignment/processLocations.js
node ./src/geo/etl/geojsonGeneration/generateGeoJson.js
```

Each component can also be run individually for testing or debugging purposes.