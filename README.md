This is a demo Optical Store project (static frontend + small Express backend) for local testing.

How to run (Windows PowerShell):

1. Install Node.js (if not already installed): https://nodejs.org/
2. In PowerShell, from the project folder run:

   npm install
   npm start

3. Open http://localhost:4000 in your browser (default).

If you need a different port:

   $env:PORT=3000; npm start


Notes:
- Demo admin credentials: username: admin, password: admin123
- This is a demo; do not use these credentials or this setup in production.

Store details (for this demo):

- Name: SACHDEVA OPTICALS
- Address: S.G.A.D COMPLEX, RUDRAPUR, UTTARAKHAND
- Phone: 9927375074
- Email: sachdevaopticals2368@gmail.com
- Instagram: https://www.instagram.com/sachdevaopticals/
- Facebook: https://www.facebook.com/SachdevaOpticalsRudrapur

Data persistence: products, orders and users are stored in the `data/` directory as JSON files for demo purposes. Consider migrating to a proper database for production.

Deploying to Render (recommended)

- Create a GitHub repository for this project and push your code.
- In Render dashboard, create a new Web Service and connect your GitHub repo.
- Use the `render.yaml` in the repo (or set the settings manually): it sets a Node web service on the Free plan and runs `npm install` then `npm start`.
- Note: `better-sqlite3` is configured as an optional dependency so Render won't fail the build if native compilation isn't available. The app will fall back to JSON file storage in `data/` if SQLite isn't available on the host.

Environment variables to set on Render (optional):
- `JWT_SECRET` — secret for admin JWT tokens (change from default for production).
- `STRIPE_SECRET` — your Stripe test/live secret key if you want real payments (optional).
- `PORT` — Render provides a dynamic port; the app reads `process.env.PORT` automatically. You don't need to set this manually when using Render.

After deployment, Render will give you an HTTPS URL and auto-redeploy on push. Verify the site by visiting `/api/products` and the front page.

Stripe (optional)
-----------------
This project can integrate with Stripe for payments. If you don't set Stripe keys the app will use a safe mock payments response and you can still test the checkout flow.

To enable Stripe payments locally:

1. Create a Stripe test account at https://dashboard.stripe.com/register if you don't have one.
2. From the Dashboard, get the "Publishable key" (starts with pk_test_) and the "Secret key" (starts with sk_test_).
3. In your PowerShell session set the environment variables before starting the server:

```powershell
$env:STRIPE_SECRET = 'sk_test_...'
$env:STRIPE_PUBLISHABLE = 'pk_test_...'
$env:DATABASE_URL = 'postgres://shop_user:password@localhost:5432/sachdeva_opticals_website'
cd 'D:\SACHDEVA_OPTICALS_WEBSITE'
npm start
```

4. Open the site at http://localhost:4000 and add items to the cart. At checkout you will see a card entry form when the publishable key is configured.

Test card numbers (Stripe test):

- Card: 4242 4242 4242 4242 — successful payment
- Card: 4000 0000 0000 9995 — requires authentication (SCA) in test mode

If you prefer not to put keys in the shell, you can set them in your system environment variables or in your deployment provider (Render/Heroku) settings.

Testing payments via script
--------------------------
I've included a small test script under `tools/test_payments.js` to exercise the payments endpoints. It will attempt to call `/api/payments/create` and `/api/checkout` on the local server. If Stripe keys are set it will use Stripe; otherwise it will exercise the mock flow.

Run it like:

```powershell
cd 'D:\SACHDEVA_OPTICALS_WEBSITE'
$env:DATABASE_URL = 'postgres://shop_user:Sachdeva2368@localhost:5432/sachdeva_opticals_website'
node .\tools\test_payments.js
```

Helper script
-------------

There's a small PowerShell helper `tools/start_with_stripe.ps1` that prompts for Stripe test keys and starts the server with the correct environment for local testing. Run it from PowerShell in the repo root:

```powershell
.\tools\start_with_stripe.ps1
```


Next steps & E2E summary
------------------------

I ran automated E2E smoke tests (health, admin login, post review, admin approve, checkout, admin orders) against a running local server using the mock payment path. The tests confirmed the main flows are working and orders are saved (mock payments). If you enable Stripe test keys (see instructions above) I can re-run the tests to verify real PaymentIntent flows.

Recommended next actions:

- Enable Stripe test keys locally and re-run E2E if you want live test coverage for payments.
- Improve product image management by storing an images array per product and exposing image uploads in the admin UI.
- Implement webcam-based try-on as an experimental UX enhancement for eyewear.

If you'd like me to proceed with any of these, tell me which to start with and I'll take care of it.


