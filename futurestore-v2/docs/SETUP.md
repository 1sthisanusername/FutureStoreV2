# Future Store — Complete Setup Guide

## Project Structure
```
futurestore-v2/
├── frontend/
│   └── index.html          ← Complete single-file storefront
├── backend/
│   ├── config/db.js        ← PostgreSQL (Supabase) connection
│   ├── controllers/        ← Business logic
│   ├── middleware/         ← Auth, rate limiting, sanitization
│   ├── routes/             ← 35 API endpoints
│   ├── services/           ← Email, SMS, Search, S3
│   ├── seed.js             ← Sample data seeder
│   ├── server.js           ← Entry point
│   └── package.json
├── database/
│   └── supabase_schema.sql ← Run in Supabase SQL Editor
└── docs/
    └── SETUP.md
```

## Step-by-Step Setup

### Step 1 — Supabase
1. supabase.com → New Project
2. SQL Editor → paste `database/supabase_schema.sql` → Run
3. Settings → Database → Connection pooling → copy URI (port 6543)

### Step 2 — Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env` — add your `DATABASE_URL` from Supabase.

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run twice — once for `JWT_SECRET`, once for `SESSION_SECRET`.

Seed database:
```bash
npm run seed
```

Start server:
```bash
npm run dev
```
Visit: http://localhost:5000/api/health

### Step 3 — Frontend
Open `frontend/index.html` in VS Code → Right-click → Open with Live Server

Add your API URL near the top of the script section:
```js
const API_BASE = 'http://localhost:5000/api';
const RAZORPAY_KEY_ID = 'rzp_test_your_key';
const PAYPAL_CLIENT_ID = 'your_paypal_client_id';
```

### Step 4 — Create Admin Account
1. Register normally on the site
2. Go to Supabase → SQL Editor and run:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```
3. Log in — you'll see ⚙️ Admin Panel in the dropdown

## Deploy to Production

### Backend → Railway
1. railway.app → New Project → Deploy from GitHub
2. Add all .env variables in Railway → Variables tab
3. Get your public URL from Settings → Domains

### Frontend → Netlify
1. netlify.com → Add new site → Deploy manually
2. Drag the `frontend/` folder
3. Update `API_BASE` in index.html to your Railway URL

## API Endpoints (35 total)
- Auth: /api/auth/* (register, login, refresh, forgot-password, etc.)
- Books: /api/books (list, search, filter, reviews)
- Orders: /api/orders (place, list, cancel, invoice)
- Wishlist: /api/wishlist
- Addresses: /api/addresses
- Subscribe: /api/subscribe
- Admin: /api/admin/* (dashboard, books, orders, users, coupons)

## Coupons
- SAVE10 — 10% off
- WELCOME20 — 20% off
- FLAT5 — $5 off (min order $20)
- FREESHIP — Free shipping
