const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.env.RENDER_DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

// For local servers (localhost / 127.0.0.1) don't force SSL. For remote hosts, keep
// SSL enabled but allow self-signed certs by setting rejectUnauthorized: false.
const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: isLocal ? false : { rejectUnauthorized: false } });

async function init() {
  // Create tables if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      price NUMERIC,
      image TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_json TEXT,
      items_json TEXT,
      total NUMERIC,
      payment_json TEXT,
      created_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      username TEXT,
      rating INTEGER,
      comment TEXT,
      approved BOOLEAN DEFAULT false,
      created_at TIMESTAMP
    );
  `);

  // Migrate products from data/products.json if table empty
  const res = await pool.query('SELECT COUNT(1) as c FROM products');
  const count = Number(res.rows[0].c || 0);
  if (count === 0) {
    const DATA_DIR = path.join(__dirname, 'data');
    const prodFile = path.join(DATA_DIR, 'products.json');
    if (fs.existsSync(prodFile)) {
      const list = JSON.parse(fs.readFileSync(prodFile, 'utf8')) || [];
      for (const it of list) {
        const id = it.id || ('p' + Date.now());
        await pool.query('INSERT INTO products (id,name,description,price,image) VALUES ($1,$2,$3,$4,$5)', [id, it.name, it.description||'', Number(it.price||0), it.image||'']);
      }
    }
  }

  // Ensure admin user exists
  const userRes = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
  if (userRes.rowCount === 0) {
    const bcrypt = require('bcryptjs');
    const hashed = bcrypt.hashSync('admin123', 10);
    await pool.query('INSERT INTO users (username,password,role) VALUES ($1,$2,$3)', ['admin', hashed, 'admin']);
  }
}

module.exports = { pool, init };
