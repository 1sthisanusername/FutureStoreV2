// services/passportService.js — Google OAuth 2.0 via passport
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

let configured = false;

try {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google'));

          const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
          let user = rows[0];

          if (!user) {
            const uuid = uuidv4();
            const { rows: [ins] } = await pool.query(
              `INSERT INTO users (uuid, name, email, password_hash, role, email_verified)
               VALUES ($1, $2, $3, 'GOOGLE_OAUTH', 'customer', true) RETURNING id`,
              [uuid, profile.displayName, email]
            );
            user = { id: ins.id, uuid, name: profile.displayName, email, role: 'customer' };
          } else if (!user.is_active) {
            return done(null, false, { message: 'Account disabled.' });
          }

          await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    ));

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
      try {
        const { rows } = await pool.query('SELECT id,uuid,name,email,role FROM users WHERE id=$1', [id]);
        done(null, rows[0] || null);
      } catch (err) {
        done(err);
      }
    });

    configured = true;
    console.log('🔑  Google OAuth configured');
  }
} catch (_) {
  console.log('ℹ️   Google OAuth not configured (passport-google-oauth20 not installed or env vars missing)');
}

module.exports = { passport, configured };
