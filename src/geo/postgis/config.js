const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'emi_experts',
  password: 'emisecrets',
  port: 5432,
});

module.exports = {
  pool,
  tables: {
    points: 'research_locations_point',
    polygons: 'research_locations_poly'
    }
}; 