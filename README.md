# 📚 Future Store — Full Stack Bookstore v2

A complete online bookstore with a standalone frontend and Node.js + Express + Supabase backend.

## Quick Start

### 1. Database (Supabase)
- Create project at supabase.com
- SQL Editor → paste `database/supabase_schema.sql` → Run
- Settings → Database → Connection pooling → copy URI

### 2. Backend (Railway or local)
```bash
cd backend
npm install
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, SESSION_SECRET
npm run seed
npm run dev   # → http://localhost:5000/api/health
```

### 3. Frontend
- Open `frontend/index.html` with Live Server
- Set `const API_BASE = 'http://localhost:5000/api'` in the script
- Or deploy to Netlify by drag-dropping the `frontend/` folder

## Default Credentials
- Admin: admin@futurestore.com / Admin@12345
- Coupons: SAVE10 · WELCOME20 · FLAT5 · FREESHIP

## Features
✅ 16-book catalog with categories, search & filter
✅ Cart with session tracking (per user)
✅ Wishlist with persistence
✅ Login / Register with CAPTCHA + hashing
✅ Forgot password (localStorage-based)
✅ Remember Me (30-day session)
✅ Full shipping address at checkout
✅ Razorpay + PayPal + Cash on Delivery
✅ GST display in cart & checkout
✅ Order confirmation modal
✅ Order status tracking
✅ Return request flow
✅ Product reviews (star rating + comment)
✅ Related books in product preview
✅ Recently viewed books
✅ Stock tracking (out of stock / low stock)
✅ Multi-currency (USD, INR, GBP, EUR)
✅ Edit profile + delete account
✅ Admin panel (orders, users, logs, stats)
✅ Security logs with brute force detection
✅ Terms, Privacy, Contact pages
✅ Meta tags + favicon + OG tags
✅ Dynamic page titles
✅ Email subscribe with persistence
✅ Skeleton loaders
✅ Backend: rate limiting + input sanitization
✅ Backend: 35 REST API endpoints
