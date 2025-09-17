const http = require('http');
const https = require('https');

const SERVER = process.env.SERVER_URL || 'http://127.0.0.1:4000';

function doPost(path, data) {
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

async function testPaymentsCreate() {
  console.log('Testing /api/payments/create');
  const body = { id: 'test-' + Date.now(), total: 19.99 };
  try {
    const res = await doPost('/api/payments/create', body);
    console.log('Status:', res.status);
    console.log('Response:', res.body);
  } catch (e) {
    console.error('Request failed:', e.message);
  }
}

async function testCheckout() {
  console.log('\nTesting /api/checkout');
  const order = { id: 'test-' + Date.now(), customer: { name: 'Test', email: 'test@example.com' }, items: [{ id: 'p1', name: 'Eyeglasses', qty: 1, price: 49.99 }], total: 49.99 };
  try {
    const res = await doPost('/api/checkout', order);
    console.log('Status:', res.status);
    console.log('Response:', res.body);
  } catch (e) {
    console.error('Request failed:', e.message);
  }
}

(async function () {
  console.log('Server:', SERVER);
  await testPaymentsCreate();
  await testCheckout();
})();
