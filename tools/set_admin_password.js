const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function genPassword(len = 16) {
  return crypto.randomBytes(Math.ceil(len * 3 / 4)).toString('base64').replace(/\/+|\=+/g, '').slice(0, len);
}

async function updatePostgres(password) {
  const { Pool } = require('pg');
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
  const hashed = bcrypt.hashSync(password, 10);
  // try update
  const res = await pool.query('UPDATE users SET password=$1 WHERE username=$2 RETURNING id', [hashed, 'admin']);
  if (res.rowCount === 0) {
    // insert admin
    await pool.query('INSERT INTO users (username,password,role) VALUES ($1,$2,$3)', ['admin', hashed, 'admin']);
    console.log('Inserted new admin user.');
  } else {
    console.log('Updated admin password.');
  }
  await pool.end();
}

function updateJSON(password) {
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const USERS_FILE = path.join(DATA_DIR, 'users.json');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let users = [];
  try { users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]'); } catch (e) { users = []; }
  const hashed = bcrypt.hashSync(password, 10);
  const idx = users.findIndex(u => u.username === 'admin');
  if (idx === -1) {
    users.push({ id: (users.length + 1), username: 'admin', password: hashed, role: 'admin' });
    console.log('Inserted admin user into JSON storage.');
  } else {
    users[idx].password = hashed;
    console.log('Updated admin password in JSON storage.');
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function main() {
  const provided = process.env.NEW_ADMIN_PASSWORD;
  const password = provided && provided.length >= 6 ? provided : genPassword(16);
  try {
    if (process.env.DATABASE_URL) {
      await updatePostgres(password);
    } else {
      updateJSON(password);
    }
    console.log('\nNew admin password: ' + password);
    console.log('Store this password safely. You can now login at /login with username=admin.');
  } catch (e) {
    console.error('Failed to set admin password:', e.message);
    process.exit(2);
  }
}

main();
