/**
 * @file dropTables.js
 * @description Drops PostGIS tables and their contents (CASCADE).
 * @usage node ./src/backend/postgis/dropTables.js
 *
 * Zoey Vo, 2025
 */

const { pool, tables } = require('./config');

async function dropTables() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Starting cleanup...');
    
    // Start transaction
    await client.query('BEGIN');

    // Drop views first
    console.log('Dropping views...');
    await client.query(`
      DROP VIEW IF EXISTS research_locations_all CASCADE;
    `);

    // Drop triggers
    console.log('Dropping triggers...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_locations_works_timestamp ON locations_works;
      DROP TRIGGER IF EXISTS update_locations_grants_timestamp ON locations_grants;
    `);

    // Drop trigger functions
    console.log('Dropping functions...');
    await client.query(`
      DROP FUNCTION IF EXISTS update_timestamp CASCADE;
    `);

    // Drop tables
    console.log('Dropping tables...');
    await client.query(`
      DROP TABLE IF EXISTS locations_works CASCADE;
      DROP TABLE IF EXISTS locations_grants CASCADE;
    `);

    await client.query('COMMIT');
    console.log('✅ All tables and related objects dropped successfully');
    console.log('   Dropped tables:');
    console.log(`   - ${tables.works} (works locations table)`);
    console.log(`   - ${tables.grants} (grants locations table)`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export the function for external usage
module.exports = {
  dropTables
};
