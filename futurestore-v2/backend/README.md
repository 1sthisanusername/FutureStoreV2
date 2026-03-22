# 📚 Future Store Backend — Phase 1 Complete

**Node.js + Express + MySQL** — Full implementation of the BookNest Phase 1 To-Do list.

---

## 🗂 Project Structure

```
bookstore-backend/
├── config/
│   ├── db.js                  # MySQL connection pool
│   └── schema.sql             # Full DB schema (all tables)
├── controllers/
│   ├── authController.js      # Register, Login, OTP, OAuth, JWT, Reset
│   ├── bookController.js      # CRUD, Algolia search, Reviews, Suggest
│   ├── orderController.js     # Place, Cancel, Invoice, Coupon validation
│   ├── addressController.js   # Saved address management
│   ├── wishlistController.js  # Wishlist + move-to-cart
│   └── adminController.js     # Dashboard, Books, Inventory, Orders, Coupons
├── middleware/
│   ├── auth.js                # JWT verification + role guard
│   ├── validate.js            # express-validator helper
│   ├── rateLimiter.js         # Brute-force protection
│   └── auditLog.js            # Admin action audit trail
├── routes/
│   ├── auth.js                # /api/auth/*
│   ├── books.js               # /api/books/*
│   ├── orders.js              # /api/orders/*
│   ├── addresses.js           # /api/addresses/*
│   ├── wishlist.js            # /api/wishlist/*
│   ├── subscribe.js           # /api/subscribe
│   └── admin.js               # /api/admin/*
├── services/
│   ├── emailService.js        # SendGrid transactional emails
│   ├── smsService.js          # Twilio OTP
│   ├── searchService.js       # Algolia full-text search
│   ├── s3Service.js           # AWS S3 cover image upload
│   └── passportService.js     # Google OAuth 2.0
├── utils/
│   ├── jwt.js                 # Access + Refresh token helpers
│   └── invoice.js             # GST-compliant invoice HTML
├── tests/
│   ├── auth.test.js
│   ├── books.test.js
│   ├── orders.test.js
│   └── admin.test.js
├── public/covers/             # Local image fallback (if S3 not set up)
├── seed.js                    # Admin user + 10 sample books
├── server.js                  # Entry point
├── jest.config.js
├── package.json
└── .env.example
```

---

## ⚙️ Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in: DB_*, JWT_SECRET, SESSION_SECRET (minimum required)

# 3. Create database + tables
mysql -u root -p < config/schema.sql

# 4. Seed admin + sample books
npm run seed

# 5. Run
npm run dev          # development (nodemon, hot-reload)
npm start            # production

# 6. Run tests
npm test
```

**API:** `http://localhost:5000`  
**Health check:** `http://localhost:5000/api/health`  
**Default admin:** `admin@futurestore.com` / `Admin@12345`

---

## 🔐 Security Implementation

| Feature | Detail |
|---|---|
| Password hashing | bcrypt 12 rounds |
| CAPTCHA | SVG CAPTCHA on every login & register |
| Account lockout | 5 failed attempts → 30-min lock |
| JWT strategy | Short-lived access token (15m) + rotating refresh token (7d) |
| Refresh rotation | Old token deleted on use — replay attacks impossible |
| Rate limiting | 10 req/15 min on auth · 100 req/min globally |
| Input validation | express-validator on all routes |
| SQL injection | Parameterised queries only |
| Secure headers | Helmet |
| CORS | Locked to `FRONTEND_URL` |
| Audit log | Every admin action stored with IP |

---

## 📡 Full API Reference

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/captcha` | — | SVG CAPTCHA image |
| POST | `/register` | — | Email+password register |
| POST | `/login` | — | Login (sets cookies) |
| POST | `/refresh` | — | Rotate refresh token |
| POST | `/logout` | ✅ | Revoke all tokens |
| GET | `/me` | ✅ | Current user profile |
| PUT | `/change-password` | ✅ | Update password |
| POST | `/otp/send` | — | Send phone OTP |
| POST | `/otp/verify` | — | Verify OTP → login/register |
| GET | `/google` | — | Initiate Google OAuth |
| GET | `/google/callback` | — | OAuth callback |
| POST | `/forgot-password` | — | Send reset email |
| POST | `/reset-password` | — | Apply new password |
| GET | `/verify-email` | — | Verify email address |

### Books — `/api/books`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | — | List/search/filter books |
| GET | `/suggest?q=` | — | Autocomplete suggestions |
| GET | `/genres` | — | Genres with counts |
| GET | `/:id` | — | Book + reviews + related |
| POST | `/:id/reviews` | ✅ | Submit review (verified buyers only) |

### Orders — `/api/orders`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/validate-coupon` | ✅ | Validate coupon code |
| POST | `/` | ✅ | Place order |
| GET | `/` | ✅ | Order history |
| GET | `/:id` | ✅ | Order + items + timeline |
| POST | `/:id/cancel` | ✅ | Cancel order |
| GET | `/:id/invoice` | ✅ | GST invoice HTML |

### Addresses — `/api/addresses`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | My saved addresses |
| POST | `/` | ✅ | Add address |
| PUT | `/:id` | ✅ | Edit address |
| DELETE | `/:id` | ✅ | Remove address |

### Wishlist — `/api/wishlist`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | ✅ | My wishlist |
| POST | `/:bookId` | ✅ | Add to wishlist |
| DELETE | `/:bookId` | ✅ | Remove from wishlist |
| POST | `/:bookId/move-to-cart` | ✅ | Move to cart |

### Subscribe — `/api/subscribe`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | — | Subscribe email |
| DELETE | `/unsubscribe` | — | Unsubscribe |

### Admin — `/api/admin`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Stats, charts, audit log |
| GET/POST | `/books` | List + create books (with S3 image upload) |
| PUT/DELETE | `/books/:id` | Edit / soft-delete |
| GET | `/inventory` | Stock levels + units sold |
| PATCH | `/inventory/:id/stock` | Update stock |
| GET | `/orders` | All orders (filter by status) |
| PATCH | `/orders/:id/status` | Update status + trigger email |
| GET/POST | `/coupons` | List + create coupons |
| DELETE | `/coupons/:id` | Deactivate coupon |
| GET | `/users` | All users |
| PATCH | `/users/:id/toggle` | Enable / disable user |
| GET | `/subscribers` | Email subscriber list |

---

## 🌐 Optional Services Setup

All services degrade gracefully — the app works without them (mocks used in dev):

### SendGrid (Email)
```bash
# .env
SENDGRID_API_KEY=SG.xxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Twilio (SMS OTP)
```bash
TWILIO_SID=ACxxxxxxxx
TWILIO_TOKEN=xxxxxxxx
TWILIO_FROM=+1XXXXXXXXXX
```

### Algolia (Search)
```bash
ALGOLIA_APP_ID=XXXXXXXX
ALGOLIA_API_KEY=your_admin_api_key
ALGOLIA_INDEX=books
# After setup, re-seed to index existing books:
npm run seed
```

### Google OAuth
```bash
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
# Add callback URL in Google Cloud Console → APIs → Credentials
```

### AWS S3 (Cover Images)
```bash
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
# Bucket policy: public-read on /covers/* prefix
```

---

## 🔗 Connecting to the Frontend

```javascript
// Refresh token on 401
async function apiFetch(url, opts = {}) {
  let res = await fetch(`http://localhost:5000${url}`, { credentials: 'include', ...opts });
  if (res.status === 401) {
    await fetch('http://localhost:5000/api/auth/refresh', { method: 'POST', credentials: 'include' });
    res = await fetch(`http://localhost:5000${url}`, { credentials: 'include', ...opts });
  }
  return res.json();
}

// Place order after Razorpay payment
await apiFetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: cart.map(i => ({ id: i.id, qty: i.qty })),
    payment_gateway: 'razorpay',
    payment_id: razorpayPaymentId,
    coupon_code: appliedCoupon,
  }),
});
```

---

## 🚀 Production Checklist

- [Done] Change ALL secrets in `.env` to strong random values (`openssl rand -hex 32`)
- [Done] Set `NODE_ENV=production`
- [Done] Use HTTPS (Nginx/Caddy reverse proxy)
- [Done] Set `cookie: { secure: true }` — auto-enabled in production
- [Done] Restrict `FRONTEND_URL` to your real domain
- [Done] Use `pm2` process manager: `pm2 start server.js --name futurestore`
- [Done] Set up MySQL backups (automated snapshots on RDS)
- [Done] Configure Sentry for error tracking
- [Done] Move session store from memory to Redis (`connect-redis`)

---

## ✅ Phase 1 Checklist vs Implementation

| Task | Status |
|---|---|
| Email + password signup with bcrypt | ✅ |
| Phone OTP signup via SMS gateway | ✅ |
| Google OAuth 2.0 | ✅ |
| JWT access + refresh tokens | ✅ |
| Role-based access control middleware | ✅ |
| Password reset + email verification | ✅ |
| Book schema + CRUD API | ✅ |
| Algolia / ElasticSearch full-text search | ✅ |
| Search index sync on create/update/delete | ✅ |
| Filter API: genre, author, price, rating | ✅ |
| Sort + pagination + autocomplete | ✅ |
| Address management | ✅ |
| Razorpay + PayPal integration | ✅ (frontend) |
| Cash on Delivery option | ✅ (COD handled via order flow) |
| Coupon code validation + discount | ✅ |
| GST-compliant invoice PDF | ✅ (HTML invoice) |
| Payment failure + retry flows | ✅ (frontend) |
| Order schema with status transitions | ✅ |
| Stock decrement on order placement | ✅ |
| Order cancellation + stock restore | ✅ |
| Email + SMS on status change | ✅ |
| Admin login with role guard | ✅ |
| Inventory management UI | ✅ |
| Stock low-stock alerts | ✅ |
| Coupon CRUD | ✅ |
| Order management + status updates | ✅ |
| S3 for cover image upload | ✅ |
| Wishlist | ✅ |
| Email subscriber capture + welcome email | ✅ |
| Unit tests for auth, books, orders, admin | ✅ |
| Audit log | ✅ |
