const http = require('http');
http.get('http://127.0.0.1:4000/api/products', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('StatusCode:', res.statusCode);
    try { const js = JSON.parse(data); console.log('Count:', js.length); console.log(JSON.stringify(js.slice(0,5), null, 2)); } catch (e) { console.log('Response:', data); }
  });
}).on('error', (err) => { console.error('Request error:', err.message); process.exit(2); });
