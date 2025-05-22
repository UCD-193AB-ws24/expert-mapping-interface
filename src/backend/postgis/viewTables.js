/**
 * @file viewTables.js
 * @description Utility for viewing and debugging PostGIS table contents.
 * @usage node ./src/backend/postgis/viewTables.js
 *
 * Zoey Vo, 2025
 */

const { pool, tables } = require('./config');

async function viewTables(limit = 50, offset = 0) {
    const client = await pool.connect();
    
    try {
        // Show table counts
        console.log('\n📊 Table Counts:');
        const counts = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM ${tables.works}) as works,
                (SELECT COUNT(*) FROM ${tables.grants}) as grants,
                (SELECT COUNT(*) FROM locations_all) as total
        `);
        console.log('------------------------');
        console.log(`Works: ${counts.rows[0].works}`);
        console.log(`Grants: ${counts.rows[0].grants}`);
        console.log(`Total: ${counts.rows[0].total}`);

        // Show table sizes
        console.log('\n💾 Table Sizes:');
        const tableSizes = await client.query(`
            SELECT 
                table_name,
                pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
                pg_size_pretty(pg_table_size(quote_ident(table_name))) as table_size,
                pg_size_pretty(pg_indexes_size(quote_ident(table_name))) as index_size
            FROM (
                VALUES ('${tables.works}'), ('${tables.grants}')
            ) AS t(table_name)
        `);
        console.table(tableSizes.rows);

        // Sample of works data
        console.log(`\n📚 Works Locations (showing ${limit} rows, offset ${offset}):`);
        const works = await client.query(`
            SELECT 
                id,
                name,
                REPLACE(ST_GeometryType(geom), 'ST_', '') as geometry_type,
                created_at
            FROM ${tables.works}
            ORDER BY id ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        console.table(works.rows);

        // Sample of grants data
        console.log(`\n💰 Grant Locations (showing ${limit} rows, offset ${offset}):`);
        const grants = await client.query(`
            SELECT 
                id,
                name,
                REPLACE(ST_GeometryType(geom), 'ST_', '') as geometry_type,
                created_at
            FROM ${tables.grants}
            ORDER BY id ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        console.table(grants.rows);

        // Show distribution by type
        console.log('\n📊 Feature Distribution by Geometry Type:');
        const geomDist = await client.query(`
            WITH combined_data AS (
                SELECT 
                    'works' as source,
                    REPLACE(ST_GeometryType(geom), 'ST_', '') as geom_type
                FROM ${tables.works}
                UNION ALL
                SELECT 
                    'grants' as source,
                    REPLACE(ST_GeometryType(geom), 'ST_', '') as geom_type
                FROM ${tables.grants}
            )
            SELECT 
                source,
                geom_type,
                COUNT(*) as count
            FROM combined_data
            GROUP BY source, geom_type
            ORDER BY source, count DESC
        `);
        console.table(geomDist.rows);
    } catch (error) {
        console.error('❌ Error viewing tables:', error);
    } finally {
        client.release();
    }
}

async function viewAllUploaded() {
    try {
        const client = await pool.connect();
        
        console.log('\n🌍 All Uploaded Works and Grants:');
        
        // Get works
        const works = await client.query(`
            SELECT 
                id, name, ST_AsGeoJSON(geom)::json AS geometry, properties
            FROM ${tables.works}
            ORDER BY id ASC
        `);
        
        // Get grants
        const grants = await client.query(`
            SELECT 
                id, name, ST_AsGeoJSON(geom)::json AS geometry, properties
            FROM ${tables.grants}
            ORDER BY id ASC
        `);
        
        client.release();
        
        // Format as GeoJSON
        const worksFeatures = works.rows.map(row => ({
            type: 'Feature',
            id: row.id,
            geometry: row.geometry,
            properties: { 
                ...row.properties,
                name: row.name,
                id: row.id,
                type: 'works'
            }
        }));
        
        const grantsFeatures = grants.rows.map(row => ({
            type: 'Feature',
            id: row.id,
            geometry: row.geometry,
            properties: { 
                ...row.properties,
                name: row.name,
                id: row.id, 
                type: 'grants'
            }
        }));
        
        const geojson = {
            type: 'FeatureCollection',
            features: [...worksFeatures, ...grantsFeatures],
            metadata: {
                works_count: worksFeatures.length,
                grants_count: grantsFeatures.length,
                total_count: worksFeatures.length + grantsFeatures.length,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(JSON.stringify(geojson, null, 2));
        console.log(`\nWorks features: ${worksFeatures.length}`);
        console.log(`Grants features: ${grantsFeatures.length}`);
        console.log(`Total features: ${geojson.features.length}`);
        
        return geojson;
    } catch (error) {
        console.error('❌ Error viewing all uploaded data:', error);
    }
}

if (require.main === module) {
    const mode = process.argv[2];
    if (mode === 'all-data') {
        viewAllUploaded();
    } else {
        const limit = process.argv[2] ? parseInt(process.argv[2]) : 50;
        const offset = process.argv[3] ? parseInt(process.argv[3]) : 0;
        
        viewTables(limit, offset)
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    }
}

module.exports = {
    viewTables,
    viewAllUploaded
};