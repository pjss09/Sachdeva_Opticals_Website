const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_me';

// Database selection priority: Postgres (if DATABASE_URL) -> SQLite (better-sqlite3) -> JSON files
let db = null;
let pg = null;
let useSql = false; // sqlite flag
let usePg = false;
async function initDatabases() {
  // Try Postgres when DATABASE_URL provided
  const DATABASE_URL = process.env.DATABASE_URL || process.env.RENDER_DATABASE_URL;
  if (DATABASE_URL) {
    try {
      pg = require('./db-postgres');
      await pg.init();
      usePg = true;
      console.log('Using Postgres database');
      return;
    } catch (e) {
      console.warn('Postgres init failed, falling back:', e.message);
      usePg = false;
    }
  }

  // Try SQLite
  try {
    db = require('./db');
    useSql = true;
    // Ensure a default admin user exists in users table
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    if (!u) {
      const hashed = bcrypt.hashSync('admin123', 10);
      db.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)').run('admin', hashed, 'admin');
      console.log('Created default admin user (username: admin, password: admin123)');
    }
    console.log('Using SQLite database');
    return;
  } catch (e) {
    console.warn('SQLite not available, falling back to JSON file storage. To enable SQLite, install build tools and run `npm install`.', e.message);
    useSql = false;
  }
}

// JSON helpers for fallback
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch (e) { return null; }
}
function writeJSON(file, data) { fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8'); }
const USERS_FILE = 'users.json';
if (!useSql) {
  // Ensure JSON files exist
  if (!readJSON('products.json')) writeJSON('products.json', []);
  if (!readJSON('orders.json')) writeJSON('orders.json', []);
  let usersJson = readJSON(USERS_FILE) || [];
  if (!usersJson.find(u => u.username === 'admin')) {
    const hashed = bcrypt.hashSync('admin123', 10);
    usersJson.push({ id: 1, username: 'admin', password: hashed, role: 'admin' });
    writeJSON(USERS_FILE, usersJson);
  }
}

// Middleware: authenticate JWT
function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Public endpoints
app.get('/api/products', async (req, res) => {
  if (usePg) {
    const r = await pg.pool.query('SELECT * FROM products');
    return res.json(r.rows);
  }
  if (useSql) {
    const rows = db.prepare('SELECT * FROM products').all();
    return res.json(rows);
  }
  const products = readJSON('products.json') || [];
  res.json(products);
});

// Get single product by id
app.get('/api/products/:id', async (req, res) => {
  const id = req.params.id;
  if (usePg) {
    const r = await pg.pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.json(r.rows[0]);
  }
  if (useSql) {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    return res.json(p);
  }
  const products = readJSON('products.json') || [];
  const p = products.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (usePg) {
    try {
      const r = await pg.pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = r.rows[0];
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = bcrypt.compareSync(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token });
    } catch (e) { console.error('Login error (pg)', e.message); return res.status(500).json({ error: 'Server error' }); }
  }
  if (useSql) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  const users = readJSON(USERS_FILE) || [];
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

app.post('/api/orders', async (req, res) => {
  const order = req.body;
  if (!order || !order.items || !Array.isArray(order.items) || order.items.length === 0) {
    return res.status(400).json({ error: 'Invalid order payload' });
  }
  const id = order.id || ('ORD' + Date.now());
  if (usePg) {
    try {
      await pg.pool.query('INSERT INTO orders (id, customer_json, items_json, total, payment_json, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id, JSON.stringify(order.customer||{}), JSON.stringify(order.items||[]), Number(order.total||0), JSON.stringify(order.payment||{}), new Date().toISOString()]);
      return res.json({ success: true, order: Object.assign({}, order, { id }) });
    } catch (e) { console.error('Order save error (pg)', e.message); return res.status(500).json({ error: 'Failed to save order' }); }
  }
  if (useSql) {
    try{
      db.prepare('INSERT INTO orders (id, customer_json, items_json, total, payment_json, created_at) VALUES (?,?,?,?,?,?)')
        .run(id, JSON.stringify(order.customer||{}), JSON.stringify(order.items||[]), Number(order.total||0), JSON.stringify(order.payment||{}), new Date().toISOString());
      return res.json({ success: true, order: Object.assign({}, order, { id }) });
    }catch(e){
      console.error('Order save error', e.message);
      return res.status(500).json({ error: 'Failed to save order' });
    }
  }
  // fallback JSON write
  const orders = readJSON('orders.json') || [];
  const newOrder = Object.assign({}, order, { id });
  orders.push(newOrder);
  try { writeJSON('orders.json', orders); return res.json({ success: true, order: newOrder }); } catch (e) { return res.status(500).json({ error: 'Failed to save order' }); }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Payments adapter: uses Stripe when STRIPE_SECRET env is set, otherwise returns a mock token
app.post('/api/payments/create', async (req, res) => {
  const order = req.body;
  if (!order || !order.total) return res.status(400).json({ error: 'Invalid order' });
  // If STRIPE_SECRET is configured, attempt to create a PaymentIntent (test mode)
  if (process.env.STRIPE_SECRET) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET);
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(Number(order.total) * 100),
        currency: 'inr',
        metadata: { orderId: order.id || ('ORD' + Date.now()) }
      });
      return res.json({ success: true, provider: 'stripe', clientSecret: intent.client_secret });
    } catch (e) {
      console.error('Stripe error', e.message);
      return res.status(500).json({ error: 'Payment provider error' });
    }
  }

  // Mock response for offline/demo
  return res.json({ success: true, provider: 'mock', paymentId: 'PAY' + Date.now(), clientSecret: 'mock_secret_' + Date.now() });
});

// Public config endpoint (returns client-side publishable keys)
app.get('/api/config', (req, res) => {
  res.json({ stripePublishable: process.env.STRIPE_PUBLISHABLE || null });
});

// Combined checkout endpoint: create payment (if needed) and save order
app.post('/api/checkout', async (req, res) => {
  const order = req.body;
  if (!order || !order.items || !Array.isArray(order.items) || order.items.length === 0) return res.status(400).json({ error: 'Invalid order' });
  // Attempt payment create
  let paymentResp = null;
  if (process.env.STRIPE_SECRET) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET);
      const intent = await stripe.paymentIntents.create({ amount: Math.round(Number(order.total) * 100), currency: 'inr', metadata: { orderId: order.id || ('ORD' + Date.now()) } });
      paymentResp = { success: true, provider: 'stripe', clientSecret: intent.client_secret, paymentIntentId: intent.id };
    } catch (e) { console.error('Stripe error', e.message); return res.status(500).json({ error: 'Payment provider error' }); }
  } else {
    paymentResp = { success: true, provider: 'mock', paymentId: 'PAY' + Date.now(), clientSecret: 'mock_secret_' + Date.now() };
  }

  // Save order with payment info
  order.payment = paymentResp;
  const id = order.id || ('ORD' + Date.now());
  if (usePg) {
    try { await pg.pool.query('INSERT INTO orders (id, customer_json, items_json, total, payment_json, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id, JSON.stringify(order.customer||{}), JSON.stringify(order.items||[]), Number(order.total||0), JSON.stringify(paymentResp||{}), new Date().toISOString()]); return res.json({ success:true, order: Object.assign({}, order, { id }), payment: paymentResp }); } catch(e){ console.error('Order save error (pg)', e.message); return res.status(500).json({ error: 'Failed to save order' }); }
  }
  if (useSql) {
    try{ db.prepare('INSERT INTO orders (id, customer_json, items_json, total, payment_json, created_at) VALUES (?,?,?,?,?,?)').run(id, JSON.stringify(order.customer||{}), JSON.stringify(order.items||[]), Number(order.total||0), JSON.stringify(paymentResp||{}), new Date().toISOString()); return res.json({ success:true, order: Object.assign({}, order, { id }), payment: paymentResp }); }catch(e){ console.error('Order save error', e.message); return res.status(500).json({ error: 'Failed to save order' }); }
  }
  // fallback JSON
  const orders = readJSON('orders.json') || []; const newOrder = Object.assign({}, order, { id }); orders.push(newOrder); try { writeJSON('orders.json', orders); return res.json({ success:true, order: newOrder, payment: paymentResp }); } catch(e){ return res.status(500).json({ error: 'Failed to save order' }); }
});

// Reviews: public post and get, admin moderation endpoints
app.get('/api/products/:id/reviews', async (req, res) => {
  const pid = req.params.id;
  if (usePg) {
    try { const r = await pg.pool.query('SELECT id, product_id, username, rating, comment, approved, created_at FROM reviews WHERE product_id=$1 AND approved = true ORDER BY created_at DESC', [pid]); return res.json(r.rows); } catch(e){ return res.status(500).json({ error: 'Failed' }); }
  }
  if (useSql) { const rows = db.prepare('SELECT * FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY created_at DESC').all(pid); return res.json(rows); }
  const list = readJSON('reviews.json') || []; res.json(list.filter(r=>r.product_id === pid && r.approved));
});

app.post('/api/products/:id/reviews', async (req, res) => {
  const pid = req.params.id; const body = req.body || {};
  if (!body.rating || !body.comment) return res.status(400).json({ error: 'Invalid' });
  const id = 'rv' + Date.now();
  const row = { id, product_id: pid, username: (body.username||'guest'), rating: Number(body.rating), comment: body.comment, approved: false, created_at: new Date().toISOString() };
  if (usePg) { try { await pg.pool.query('INSERT INTO reviews (id, product_id, username, rating, comment, approved, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [row.id,row.product_id,row.username,row.rating,row.comment,row.approved,row.created_at]); return res.json({ success:true, review: row }); } catch(e){ console.error('Review save failed (pg)', e.message); return res.status(500).json({ error: 'Failed' }); } }
  if (useSql) { try{ db.prepare('INSERT INTO reviews (id,product_id,username,rating,comment,approved,created_at) VALUES (?,?,?,?,?,?,?)').run(row.id,row.product_id,row.username,row.rating,row.comment,row.approved,row.created_at); return res.json({ success:true, review: row }); }catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  const reviews = readJSON('reviews.json') || []; reviews.push(row); writeJSON('reviews.json', reviews); res.json({ success:true, review: row });
});

// Admin review moderation
app.get('/api/admin/reviews', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  if (usePg) { try{ const r = await pg.pool.query('SELECT * FROM reviews ORDER BY created_at DESC'); return res.json(r.rows); }catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  if (useSql) { const rows = db.prepare('SELECT * FROM reviews ORDER BY created_at DESC').all(); return res.json(rows); }
  const reviews = readJSON('reviews.json') || []; res.json(reviews.reverse());
});

app.put('/api/admin/reviews/:id/approve', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  if (usePg) { try{ await pg.pool.query('UPDATE reviews SET approved = true WHERE id = $1', [id]); return res.json({ success:true }); }catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  if (useSql) { try{ db.prepare('UPDATE reviews SET approved = 1 WHERE id = ?').run(id); return res.json({ success:true }); }catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  const reviews = readJSON('reviews.json') || []; const idx = reviews.findIndex(r=>r.id===id); if (idx === -1) return res.status(404).json({ error: 'Not found' }); reviews[idx].approved = true; writeJSON('reviews.json', reviews); res.json({ success:true });
});

app.delete('/api/admin/reviews/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  if (usePg) { try{ await pg.pool.query('DELETE FROM reviews WHERE id = $1', [id]); return res.json({ success:true }); }catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  if (useSql) { try{ db.prepare('DELETE FROM reviews WHERE id = ?').run(id); return res.json({ success:true }); }catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  const reviews = readJSON('reviews.json') || []; const out = reviews.filter(r=>r.id !== id); writeJSON('reviews.json', out); res.json({ success:true });
});

// Admin endpoints: product CRUD and orders listing
app.get('/api/admin/orders', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  if (usePg) {
    try { const r = await pg.pool.query('SELECT * FROM orders ORDER BY created_at DESC'); const mapped = r.rows.map(r=>({ id: r.id, customer: JSON.parse(r.customer_json||'{}'), items: JSON.parse(r.items_json||'[]'), total: r.total, payment: JSON.parse(r.payment_json||'{}'), created_at: r.created_at })); return res.json(mapped); } catch(e){ return res.status(500).json({ error: 'Failed' }); }
  }
  if (useSql) {
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    const mapped = rows.map(r=>({ id: r.id, customer: JSON.parse(r.customer_json||'{}'), items: JSON.parse(r.items_json||'[]'), total: r.total, payment: JSON.parse(r.payment_json||'{}'), created_at: r.created_at }));
    return res.json(mapped);
  }
  const orders = readJSON('orders.json') || [];
  res.json(orders.reverse());
});

app.get('/api/admin/products', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  if (usePg) { try { const r = await pg.pool.query('SELECT * FROM products'); return res.json(r.rows); } catch(e){ return res.status(500).json({ error: 'Failed' }); } }
  if (useSql) { const rows = db.prepare('SELECT * FROM products').all(); return res.json(rows); }
  const products = readJSON('products.json') || []; res.json(products);
});

app.post('/api/admin/products', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const p = req.body;
  if (!p || !p.name || !p.price) return res.status(400).json({ error: 'Invalid product' });
  if (usePg) { try{ const id = p.id || ('p' + Date.now()); await pg.pool.query('INSERT INTO products (id,name,description,price,image) VALUES ($1,$2,$3,$4,$5)', [id, p.name, p.description||'', Number(p.price), p.image||'']); return res.json({ success: true, product: Object.assign({ id }, p) }); } catch(e){ return res.status(500).json({ error: 'Failed to save product' }); } }
  if (useSql) {
    try{ const id = p.id || ('p' + Date.now()); db.prepare('INSERT INTO products (id,name,description,price,image) VALUES (?,?,?,?,?)').run(id, p.name, p.description||'', Number(p.price), p.image||''); return res.json({ success: true, product: Object.assign({ id }, p) }); }catch(e){ return res.status(500).json({ error: 'Failed to save product' }); }
  }
  // fallback JSON
  const products = readJSON('products.json') || []; p.id = p.id || ('p' + Date.now()); products.push(p); writeJSON('products.json', products); res.json({ success:true, product: p });
});

app.put('/api/admin/products/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  const p = req.body;
  if (usePg) { try{ await pg.pool.query('UPDATE products SET name=$1, description=$2, price=$3, image=$4 WHERE id=$5', [p.name, p.description||'', Number(p.price), p.image||'', id]); const updated = (await pg.pool.query('SELECT * FROM products WHERE id=$1', [id])).rows[0]; if(!updated) return res.status(404).json({ error: 'Not found' }); return res.json({ success:true, product: updated }); }catch(e){ return res.status(500).json({ error: 'Failed to update' }); } }
  if (useSql) { try{ db.prepare('UPDATE products SET name = ?, description = ?, price = ?, image = ? WHERE id = ?').run(p.name, p.description||'', Number(p.price), p.image||'', id); const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id); if(!updated) return res.status(404).json({ error: 'Not found' }); return res.json({ success:true, product: updated }); }catch(e){ return res.status(500).json({ error: 'Failed to update' }); } }
  const products = readJSON('products.json') || []; const idx = products.findIndex(x=>x.id===id); if(idx === -1) return res.status(404).json({ error: 'Not found' }); products[idx] = Object.assign(products[idx], p); writeJSON('products.json', products); res.json({ success:true, product: products[idx] });
});

app.delete('/api/admin/products/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const id = req.params.id;
  if (usePg) { try{ await pg.pool.query('DELETE FROM products WHERE id = $1', [id]); return res.json({ success: true }); }catch(e){ return res.status(500).json({ error: 'Failed to delete' }); } }
  if (useSql) { try{ db.prepare('DELETE FROM products WHERE id = ?').run(id); return res.json({ success: true }); }catch(e){ return res.status(500).json({ error: 'Failed to delete' }); } }
  const products = readJSON('products.json') || []; const out = products.filter(x=>x.id !== id); writeJSON('products.json', out); res.json({ success:true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize DBs and then start server
initDatabases().then(() => {
  app.listen(PORT, () => {
    console.log('Server started on port', PORT);
    console.log('PID:', process.pid);
    console.log('Serving from:', __dirname);
    console.log('Bind:', `http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize databases:', err.message);
  // still start server with JSON fallback
  app.listen(PORT, () => {
    console.log('Server started (JSON fallback) on port', PORT);
    console.log('PID:', process.pid);
    console.log('Serving from:', __dirname);
    console.log('Bind:', `http://localhost:${PORT}`);
  });
});
