// server.js — Future Store API
require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const session      = require('express-session');
const morgan       = require('morgan');
const path         = require('path');

const { apiLimiter }                           = require('./middleware/rateLimiter');
const { sanitizeQuery, preventHpp }            = require('./middleware/sanitize');
const { passport, configured }                 = require('./services/passportService');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Helmet — hardened HTTP headers ───────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", 'https://www.paypal.com', 'https://checkout.razorpay.com'],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // required for PayPal SDK iframes
}));

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));

// ── Body parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));    // 512 KB body limit (was 2 MB)
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(cookieParser());

// ── Session ───────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge:   10 * 60 * 1000,
  },
}));

// ── Passport ─────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

if (configured) {
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile','email'] })
  );
  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}?auth=failed` }),
    require('./controllers/authController').googleOAuthCallback
  );
}

// ── Global sanitisation — runs before every route ─────────────────
// Strips HTML tags from query strings and prevents HPP on all routes.
// Per-route body sanitisation is applied in each route file.
app.use(sanitizeQuery, preventHpp);

// ── Logging ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test')
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Static ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Global rate limiter (fallback) ────────────────────────────────
app.use('/api/', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/books',      require('./routes/books'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/addresses',  require('./routes/addresses'));
app.use('/api/wishlist',   require('./routes/wishlist'));
app.use('/api/subscribe',  require('./routes/subscribe'));
app.use('/api/admin',      require('./routes/admin'));

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    services: {
      algolia:  !!process.env.ALGOLIA_APP_ID,
      sendgrid: !!process.env.SENDGRID_API_KEY,
      twilio:   !!process.env.TWILIO_SID,
      oauth:    configured,
      s3:       !!process.env.AWS_S3_BUCKET,
    },
  })
);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` })
);

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  // Never leak stack traces or internal details in production
  if (process.env.NODE_ENV !== 'production') console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀  Future Store API  →  http://localhost:${PORT}`);
    console.log(`🛡️   Rate limiting     :  ✅ (auth:10/15m, search:60/m, order:5/m, api:120/m)`);
    console.log(`🧹  Input sanitisation :  ✅ (XSS strip, HPP, HTML entity escape, query limits)`);
    console.log(`🔒  Helmet CSP         :  ✅`);
    console.log(`📦  Env               :  ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
