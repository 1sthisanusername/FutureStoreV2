// server.js — Future Store API
require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const session      = require('express-session');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const path         = require('path');
const fs           = require('fs');
const Sentry       = require('@sentry/node');
const pgSession    = require('connect-pg-simple')(session);
const pool         = require('./config/db');

const { apiLimiter }                           = require('./middleware/rateLimiter');
const { sanitizeQuery, preventHpp }            = require('./middleware/sanitize');
const { passport, configured }                 = require('./services/passportService');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Sentry Initialization ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
  });
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
}

// ── Trust Proxy ───────────────────────────────────────────────────
app.set('trust proxy', 1); // Needed for secure cookies behind reverse proxies (Nginx/Caddy)

// ── Helmet — hardened HTTP headers ───────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://*.paypal.com', 'https://*.paypalobjects.com', 'https://checkout.razorpay.com', 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://*.paypal.com'],
      imgSrc:      ["'self'", 'data:', 'https:', 'https://*.paypal.com', 'https://*.paypalobjects.com', 'https://*.razorpay.com'],
      connectSrc:  ["'self'", 'https://*.paypal.com', 'https://*.sandbox.paypal.com', 'https://api.razorpay.com', 'https://lumberjack.razorpay.com', 'https://cdnjs.cloudflare.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      frameSrc:    ["'self'", 'https://*.paypal.com', 'https://*.sandbox.paypal.com', 'https://api.razorpay.com'],
      objectSrc:   ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // required for PayPal SDK iframes
}));

// ── CORS ──────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (no origin header), localhost, and Vercel deployments
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // Allow any Vercel deployment (preview + production)
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    // Check against explicit production URL
    if (origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
}));

// ── Body parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(cookieParser());

// ── Session ───────────────────────────────────────────────────────
let sessionStore;
if (process.env.NODE_ENV !== 'test') {
  sessionStore = new pgSession({
    pool: pool,                // Connection pool
    tableName: 'session',      // Use another table-name than the default "session" one
    createTableIfMissing: true // Automatically creates the session table in Supabase
  });
}

if (process.env.NODE_ENV === 'production' && process.env.SESSION_SECRET === 'change-me') {
  console.error('❌  FATAL: SESSION_SECRET must be set to a secure, random string in production!');
  process.exit(1);
}

app.use(session({
  name: 'futurestore.sid', // Custom name to avoid collision with generic connect.sid
  store: sessionStore, 
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: true,
  saveUninitialized: true,
  proxy: true,
  cookie: {
    secure:   process.env.NODE_ENV === 'production', 
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
    maxAge:   24 * 60 * 60 * 1000, 
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
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

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
app.use('/api/support',    require('./routes/support'));
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

// ── Sentry error handler ──────────────────────────────────────────
// Must be registered before other error middlewares and after controllers
if (process.env.NODE_ENV !== 'test') {
  app.use(Sentry.Handlers.errorHandler());
}

// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  // Never leak stack traces or internal details in production
  if (process.env.NODE_ENV !== 'production') console.error('[ERROR]', err.stack);
  // 🚨 EMERGENCY DEBUG: Reveal real error message on Railway
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    stack: err.stack
  });
});

if (process.env.NODE_ENV !== 'test') {
  const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
    console.log(`\n🚀  Future Store API  →  http://${HOST}:${PORT}`);
    console.log(`🛡️   Rate limiting     :  ✅ (auth:10/15m, search:60/m, order:5/m, api:120/m)`);
    console.log(`🧹  Input sanitisation :  ✅ (XSS strip, HPP, HTML entity escape, query limits)`);
    console.log(`🔒  Helmet CSP         :  ✅`);
    console.log(`📦  Env               :  ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
