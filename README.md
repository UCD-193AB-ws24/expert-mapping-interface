# Expert Mapping Interface (E.M.I)

## Table of Contents

1. [Introduction](#1-introduction)  
2. [Access and System Requirements](#2-access-and-system-requirements)  
3. [Features and Functionality](#3-features-and-functionality)  
4. [System Architecture](#4-system-architecture)  
5. [Deployment and Operations](#5-deployment-and-operations)  
6. [Troubleshooting](#6-troubleshooting)  
7. [Contact Information](#7-contact-information)  
8. [Glossary](#8-glossary)  
9. [Appendix](#9-appendix)

---

## 1. Introduction

### 1.1 Preface

The Expert Mapping Interface (E.M.I) is a web application developed for the UC Davis Library to visualize global research output by UC Davis scholars.

### 1.2 Overview of Product

E.M.I allows users to explore grants and scholarly works geographically using NLP and geospatial tools.

### 1.3 Target Audience

- Students  
- Journalists  
- Donors  
- Researchers  
- General public  

### 1.4 Guide Structure

This guide includes access instructions, feature walkthroughs, system design, troubleshooting, and contact info.

---

## 2. Access and System Requirements

### 2.1 System Requirements

- Modern browser (Chrome, Firefox, Safari)  
- Internet access  
- Desktop or mobile device  

### 2.2 Accessing the Interface

Visit: [http://35.247.92.204:3001](http://35.247.92.204:3001)  
No login or installation required.

---

## 3. Features and Functionality

### 3.1 Interactive Map Overview

- Global map with clusters and pins  
- Zoom levels reveal heatmaps or individual markers  
- Hovering shows popups  
- Clicking shows side panel with expert info  

### 3.2 Search and Filtering

- **Keyword Search**: Expert name, department, titles, abstracts  
- **Date Range Slider**  
- **Toggles**: Show/hide grants and works  
- Adjust filters or reload to reset  

### 3.3 Cluster and Zoom Logic

- Low zoom: Clustered summaries  
- High zoom: Individual pins  
- Heatmap for density display  

### 3.4 Hovering, Side Panel, and Profile Details

- Hover: Shows popup with expert/work count  
- Click “View Experts” to see sidebar  
- Profile links redirect to Aggie Experts  

### 3.5 Tablet View

- Filters and map guide appear above the map  
- Tap markers for popups and expert panel  
- Close guide by tapping "click to close"  

### 3.6 Mobile View

- Tap markers to view expert info  
- Filters accessed via funnel button  
- Search bar in navbar  
- Map guide under filters button  

---

## 4. System Architecture

### 4.1 Data Flow Pipeline

- Raw data from Aggie Experts API  
- Location entities extracted using LLaMA  
- Nominatim for geocoding  
- Data stored in PostGIS (GeoJSON)  
- Redis for caching  
- Frontend renders data using React  

### 4.2 Backend Services

- Node.js + Express for APIs  
- Redis for caching  
- PostGIS for storage  

### 4.3 Frontend Interface

- React.js + Leaflet for mapping  
- Tailwind CSS  
- Fully responsive  

### 4.4 Docker and GCP Deployment

- Deployed via Docker on GCP VM  
- Containers:
  - `emi-app` (Node.js/React)
  - `emi-redis`
  - `emi-postgis`
- Uses Docker Compose  
- Persistent volumes for Redis/PostGIS  
- Internal Docker networking  
- Exposed on port `3001`  
- Start/stop with `docker compose up -d` and `docker compose down`

More: [GitHub Repository](https://github.com/UCD-193AB-ws24/expert-mapping-interface)

---

# E.M.I - Deployment and Operations

## 5. Deployment and Operations

### 5.1 Local Development

* Build the frontend: `npm run build`
* Start the backend: `node src/backend/server.js`
* Access locally at: http://localhost:3001

### 5.2 Production Deployment

* Push changes to the main repository branch
* CI/CD pipeline is triggered automatically
   * EMI Docker image is built
   * Image is transferred to the virtual machine (VM)
   * Image is unpacked and deployed on the VM
* Application is available at: http://35.247.92.204:3001/

### 5.3 Docker Management

#### Images

**Creating/Updating Postgis Image:**

* **Local:**
   * `docker build -f ./Dockerfile.emi -t emi .`
   * `docker save -o "C:\image_path\emi.tar" emi`
   * `scp -i .\key_path\private_key .\image_path\emi.tar <user>@35.247.92.204:~`
* **VM:**
   * `docker compose down`
   * `docker rmi <emi-img-id>`
   * `docker load -i ~/emi.tar`
   * `docker compose up -d`
   * `docker cp expertIds.csv emi-app:/app/src/backend/etl/aggieExpertsAPI/utils`

**Creating Postgis Image:** `docker pull postgis/postgis`

**Creating Redis Image:** `docker pull redis`

#### Deploying

* Deploy containers: `docker compose up -d`
* View startup logs: `docker compose logs -f`
* Inspect containers: `docker ps`

#### Accessing Containers

* EMI: `docker exec -it emi-app sh`
* Redis: `docker exec -it emi-redis redis-cli`
* PostGIS: `docker exec -it emi-postgis psql -U postgres`

#### Removing

* `docker compose down [-v]` (-v resets volumes)

## 6. Troubleshooting

* **Why is the map not loading?**
   * The map may take a few seconds to load due to the large dataset. If it does not load after a short wait, please try reloading the page.
* **Why are no results being returned?**
   * Results are displayed based on the current zoom level, so try zooming in to explore the map further. Another possible reason is that the filter parameters are too specific, in which case, you can adjust the filters or reload the page to reset them.
* **Why is the hover tooltips not working?**
   * Ensure your browser is up to date and that you are not running any extensions that may block scripts.

## 7. Contact Information

* Zoey Vo — ausvo@ucdavis.edu, @zoeyvo
* Alyssa Vallejo — anvallejo@ucdavis.edu, AV-CompSci-Mage
* Marina Mata — mmbmata@ucdavis.edu, @marinamata
* Loc Nguyen — lctnguyen@ucdavis.edu, @loctng

## 8. Glossary

* **ETL:** Extract, Transform, Load pipeline
* **GeoJSON:** JSON format for geographic features
* **PostGIS:** Extension of PostgreSQL for geospatial queries
* **Redis:** In-memory data store for caching
* **LLaMA:** Language model for extracting location entities

## 9. Appendix

### 9.1 Project Overview and User Stories

The E.M.I was designed to replace static, ambiguous expert searches with a spatial-first experience. Users include students, donors, researchers, and journalists. Key goals include improved discovery, intuitive filters, and professional presentation of expert profiles.

For technical details on the ETL pipeline, see `src/backend/etl/README.md`.

---

*Zoey Vo, Alyssa Vallejo, Marina Mata, Loc Nguyen, 2025*
