/**
* @file dropTables.js
* @description Drops all PostGIS tables, views, and related objects created for the application  
* @module geo/postgis/dropTables 
*
* USAGE: node src/geo/postgis/dropTables.js
*
* © Zoey Vo, 2025
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

async function main() {
  console.log('⚠️  WARNING: This will delete all research location data!');
  console.log('🚀 Starting table cleanup process...');
  const startTime = Date.now();
  
  try {
    await dropTables();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Cleanup completed successfully in ${duration}s`);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = dropTables;
