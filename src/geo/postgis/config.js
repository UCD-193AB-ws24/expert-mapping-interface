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
    grants: 'locations_grants',
    works: 'locations_works'
    }
}; 