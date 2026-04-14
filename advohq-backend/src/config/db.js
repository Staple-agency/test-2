const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // increase timeout a bit
});

// 🔥 ADD THIS BLOCK
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ DB CONNECTED SUCCESSFULLY");
    client.release();
  } catch (err) {
    console.error("❌ DB CONNECTION FAILED:", err);
  }
})();

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

module.exports = pool;
