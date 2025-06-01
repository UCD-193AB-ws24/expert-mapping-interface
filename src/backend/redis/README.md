# Redis Backend Utilities

This folder contains the backend logic for synchronizing, organizing, and managing expert and grant data in Redis. It is responsible for keeping Redis in sync with PostgreSQL, organizing Redis data for efficient querying, and providing utility functions for data population and maintenance.

---

## Overview

The `redis/` directory powers all Redis-related backend operations. It handles:

- Synchronizing works and grants from PostgreSQL to Redis
- Organizing and indexing Redis data for fast lookups
- Populating Redis with initial or updated data
- Utility functions for metadata, cleanup, and data structure management

---

## Structure

### Core Sync Logic

- `syncRedis.js` – Main logic for syncing works and grants from PostgreSQL to Redis, including metadata updates and entry deduplication.
- `organizeRedis.js` – Organizes and indexes Redis data after sync, creating lookup maps and optimizing for frontend queries.
- `organizeRedisMaps.js` – Builds and maintains mapping structures in Redis for fast access to works, grants, 
and locations.
- `initializeRedis.js` – Uses the same logic as `syncRedis.js`, assuming the Redis is completely empty.

### Utilities

- `populateRedis.js` – Script for populating Redis from PostgreSQL, runs on deployment and on data refresh.
- `utils/` – Helper functions for Redis operations, including key management and data formatting.

### Tests

- `tests/` – Unit and integration tests for Redis sync and organization logic.

### Metrics

- `metrics/` – Scripts for purposes of comparing data fetch strategies and primarily compares the speed of fetch from Postgis and Redis.
---

## Key Concepts

- **Syncing:** Ensures Redis reflects the latest state of works and grants from PostgreSQL, updating only when necessary.
- **Organizing:** After syncing, Redis data is restructured for efficient querying by the frontend.
- **Metadata:** Metadata keys track counts and timestamps for works and grants in Redis.
- **Deduplication:** Prevents duplicate entries for works/grants when multiple experts are associated.

---

## Notes

- All Redis operations are designed to be idempotent and safe for repeated runs.
- Data organization is optimized for frontend panel and map queries.
- Tests cover edge cases such as missing fields, outdated data, and entry validation.
- Some tests may not be at 100% statement and/or branch coverage, but that is because there are some limitations on unreachable code paths due to very rare conditions and defensive programming in which the branches are unlikely to be triggered during normal testing.

*Alyssa Vallejo, 2025*