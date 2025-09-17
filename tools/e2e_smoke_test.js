const http = require('http');
const https = require('https');

const SERVER = process.env.SERVER_URL || 'http://127.0.0.1:4000';

function doPost(path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const payload = JSON.stringify(data || {});
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { const js = JSON.parse(data || '{}'); resolve({ status: res.statusCode, body: js }); } catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

function doGet(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const opts = { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + (url.search || ''), method: 'GET', headers: {} };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { const js = JSON.parse(data || '{}'); resolve({ status: res.statusCode, body: js }); } catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', err => reject(err));
    req.end();
  });
}

function doPut(path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER);
    const payload = JSON.stringify(data || {});
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { const js = JSON.parse(data || '{}'); resolve({ status: res.statusCode, body: js }); } catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

(async function(){
  try{
    console.log('Server:', SERVER);
    console.log('\n1) Health check');
    const h = await doGet('/health');
    console.log('Health:', h.status, h.body);

    console.log('\n2) Login as admin');
    const login = await doPost('/api/login', { username: 'admin', password: 'Sachdeva2368' });
    console.log('Login:', login.status, login.body);
    const token = login.body && login.body.token;
    if(!token) throw new Error('Login failed; cannot continue E2E');

    console.log('\n3) Post a review for product p1');
    const review = await doPost('/api/products/p1/reviews', { username: 'e2e-tester', rating: 5, comment: 'Great frames!' });
    console.log('Post review:', review.status, review.body);

    console.log('\n4) Admin list reviews');
    const adminList = await doGet('/api/admin/reviews', token);
    console.log('Admin reviews list:', adminList.status, Array.isArray(adminList.body) ? adminList.body.length + ' items' : adminList.body);

    // find the unapproved review we just posted
    const rv = Array.isArray(adminList.body) ? adminList.body.find(r=>r.username==='e2e-tester' && r.comment && r.comment.includes('Great frames')) : null;
    if(!rv) throw new Error('Posted review not found in admin list');

  console.log('\n5) Approve review:', rv.id);
  const approve = await doPut('/api/admin/reviews/' + rv.id + '/approve', {}, token);
    console.log('Approve response:', approve.status, approve.body);

    console.log('\n6) Create an order (checkout)');
    const checkout = await doPost('/api/checkout', { id: 'e2e-' + Date.now(), customer: { name: 'E2E Tester', email: 'e2e@example.com' }, items: [{ id: 'p1', name: 'Eyeglasses', qty: 1, price: 49.99 }], total: 49.99 });
    console.log('Checkout:', checkout.status, checkout.body && checkout.body.order ? 'order saved' : checkout.body);

    console.log('\n7) Admin orders list');
    const orders = await doGet('/api/admin/orders', token);
    console.log('Admin orders:', orders.status, Array.isArray(orders.body) ? orders.body.length + ' orders' : orders.body);

    console.log('\nE2E smoke test completed successfully.');
  }catch(e){
    console.error('E2E failed:', e && e.message ? e.message : e);
    process.exit(2);
  }
})();
