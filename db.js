const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_PATH = path.join(DATA_DIR, 'app.db');
const db = new Database(DB_PATH);

// Initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  price REAL,
  image TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_json TEXT,
  items_json TEXT,
  total REAL,
  payment_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT
);
`);

// Migration from JSON files (if present and products table empty)
try{
  const count = db.prepare('SELECT COUNT(1) as c FROM products').get().c;
  if(count === 0){
    const prodFile = path.join(DATA_DIR, 'products.json');
    if(fs.existsSync(prodFile)){
      const list = JSON.parse(fs.readFileSync(prodFile,'utf8')) || [];
      const insert = db.prepare('INSERT INTO products (id,name,description,price,image) VALUES (@id,@name,@description,@price,@image)');
      const insertMany = db.transaction((items)=>{ for(const it of items){ insert.run({ id: it.id || ('p'+Date.now()), name: it.name, description: it.description || '', price: Number(it.price||0), image: it.image || '' }) } });
      insertMany(list);
    }
  }
} catch(e){ console.error('DB migration error', e.message) }

module.exports = db;
