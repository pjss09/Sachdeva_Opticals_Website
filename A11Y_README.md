Automated accessibility checks (pa11y)

This project includes a small pa11y-based runner to scan the local site for accessibility issues.

Quick start (Windows PowerShell):

1. Install dev dependencies:
   npm install

2. Start your server (if not already running). Example:
   node server.js

3. Run the a11y script:
   npm run a11y

You can set a custom server URL via the SERVER_URL environment variable. Example (PowerShell):

$env:SERVER_URL='http://127.0.0.1:4000'; npm run a11y

Notes:
- pa11y may report multiple issues; some are best fixed in markup/CSS (missing labels, contrast, etc.).
- This runner is intentionally simple; you can extend it to scan multiple pages or integrate into CI.
