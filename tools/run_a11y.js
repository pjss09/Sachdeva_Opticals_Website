// Multi-page runner for pa11y: scan multiple routes and produce a JSON report
const pa11y = require('pa11y');
const fs = require('fs');
const path = require('path');

const base = process.env.SERVER_URL || 'http://127.0.0.1:4000';
const routes = process.env.A11Y_ROUTES ? process.env.A11Y_ROUTES.split(',') : ['/', '/products', '/product.html', '/wishlist.html', '/login.html'];

(async function(){
  const report = { url: base, generatedAt: new Date().toISOString(), pages: [] };
  let totalIssues = 0;
  for (const r of routes) {
    const pageUrl = new URL(r, base).toString();
    console.log('Scanning', pageUrl);
    try {
      const res = await pa11y(pageUrl, {timeout: 30000});
      const issues = res.issues || [];
      totalIssues += issues.length;
      report.pages.push({ route: r, url: pageUrl, issues });
      console.log(`  Issues: ${issues.length}`);
    } catch (e) {
      console.warn('  pa11y failed for', pageUrl, e && e.message || e);
      report.pages.push({ route: r, url: pageUrl, error: String(e) });
      totalIssues += 1;
    }
  }

  // write JSON report
  const outPath = path.join(__dirname, 'a11y-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote', outPath, 'total issues:', totalIssues);
  if (totalIssues > 0) process.exit(2);
  process.exit(0);
})();
