require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('redis');
const { exec } = require('child_process');
const { spawn } = require('child_process');

// PostgreSQL connection
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.SERVER_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

const redisHost = process.env.SERVER_HOST;
const redisPort = process.env.REDIS_PORT;

const redisClient = createClient({
  socket: {
    host: redisHost,
    port: redisPort
  }
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
  process.exit(1);
});
redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});
redisClient.on('end', () => {
  console.log('🔌 Redis connection closed');
  process.exit(1);
});

(async () => {
  try {
    await redisClient.connect();
    const pgClient = await pool.connect();

    console.log('🔄 Running populateRedis to initialize Redis...');
    await new Promise((resolve, reject) => {
      exec('node src/backend/redis/populateRedis.js', (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Error running populateRedis: ${error.message}`);
          reject(error);
        } else {
          console.log(stdout);
          resolve();
        }
      });
    });

    console.log('✅ Redis initialized.');

    console.log('🔄 Adding a new fake row to PostgreSQL...');
    const fakeRowQuery = `
      INSERT INTO locations_works (id, name, properties, geom, created_at, updated_at)
      VALUES (
        991,
        'Test Location',
        '{"type": "Feature", "properties": {"key": "value"}}',
        ST_SetSRID(ST_GeomFromText('POINT(10 20)'), 4326),
        NOW(),
        NOW()
      )
    `;
    await pgClient.query(fakeRowQuery);
    console.log('✅ New fake row added to PostgreSQL.');

    console.log('🔌 Disconnecting from Redis and PostgreSQL...');
    await redisClient.disconnect(); // Disconnect from Redis
    pgClient.release(); // Release the PostgreSQL client
    console.log('✅ Disconnected from Redis and PostgreSQL.');

    console.log('🔄 Running populateRedis again to sync Redis with PostgreSQL...');
await new Promise((resolve, reject) => {
  const child = spawn('node', ['src/backend/redis/populateRedis.js'], { stdio: 'inherit' });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ populateRedis completed.');
      resolve();
    } else {
      reject(new Error(`populateRedis exited with code ${code}`));
    }
  });
});

    console.log('✅ Redis synced with PostgreSQL.');

    console.log('🔍 Verifying new row in Redis...');
    await redisClient.connect(); // Reconnect to Redis to verify the data
    const redisData = await redisClient.hGetAll('work:991');
    if (Object.keys(redisData).length > 0) {
      console.log('✅ New row found in Redis:', redisData);
    } else {
      console.error('❌ New row not found in Redis.');
    }
  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    await redisClient.disconnect();
    await pool.end();
    console.log('✅ PostgreSQL and Redis connections closed.');
    process.exit(0);
  }
})();