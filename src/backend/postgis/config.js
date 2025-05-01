/**
* @file config.js
* @description Configuration for PostgreSQL connection
* @module geo/postgis/config
*
* © Zoey Vo, 2025
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const { Pool } = require('pg');

// Ensure all connection parameters are explicitly cast to their expected types
const pool = new Pool({
  user: String(process.env.PG_USER),
  host: String(process.env.PG_HOST),
  database: String(process.env.PG_DATABASE),
  password: String(process.env.PG_PASSWORD), // Ensure password is a string
  port: Number(process.env.PG_PORT),
});

// Add connection error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  pool,
  tables: {
    grants: 'locations_grants',
    works: 'locations_works'
  }
};