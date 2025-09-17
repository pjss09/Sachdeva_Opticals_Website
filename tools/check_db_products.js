const { Pool } = require('pg');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://shop_user:Sachdeva2368@localhost:5432/sachdeva_opticals_website';
const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
(async () => {
  try {
    const t = await pool.query("SELECT COUNT(*) as c FROM products");
    console.log('products count:', t.rows[0].c);
    const r = await pool.query('SELECT id, name, price, image FROM products LIMIT 5');
    console.log('sample rows:', r.rows);
    await pool.end();
  } catch (e) {
    console.error('DB error:', e.message);
    process.exit(2);
  }
})();
