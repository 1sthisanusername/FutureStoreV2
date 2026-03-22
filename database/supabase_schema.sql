-- ============================================================
-- Future Store — Supabase / PostgreSQL Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                  SERIAL PRIMARY KEY,
  uuid                UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  name                VARCHAR(120) NOT NULL,
  email               VARCHAR(180) NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,
  role                VARCHAR(20) DEFAULT 'customer',
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  last_login          TIMESTAMPTZ,
  login_attempts      SMALLINT DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  email_verified      BOOLEAN DEFAULT false,
  email_verify_token  VARCHAR(64),
  reset_token         VARCHAR(64),
  reset_token_expires TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS books (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  author          VARCHAR(180) NOT NULL,
  genre           VARCHAR(80)  NOT NULL,
  description     TEXT,
  price           DECIMAL(8,2) NOT NULL,
  original_price  DECIMAL(8,2),
  stock           INTEGER DEFAULT 0,
  pages           SMALLINT,
  publisher       VARCHAR(120),
  year            INTEGER,
  badge           VARCHAR(40),
  cover_color     VARCHAR(40) DEFAULT '#2C3E50',
  cover_url       VARCHAR(255),
  rating          DECIMAL(3,2) DEFAULT 0.00,
  reviews_count   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  book_id    INTEGER REFERENCES books(id)  ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id)  ON DELETE CASCADE,
  rating     SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, user_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  order_number     VARCHAR(30) NOT NULL UNIQUE,
  user_id          INTEGER REFERENCES users(id),
  status           VARCHAR(20) DEFAULT 'pending',
  subtotal         DECIMAL(10,2) NOT NULL,
  shipping_fee     DECIMAL(8,2)  DEFAULT 0.00,
  discount         DECIMAL(8,2)  DEFAULT 0.00,
  coupon_code      VARCHAR(50),
  total            DECIMAL(10,2) NOT NULL,
  payment_gateway  VARCHAR(30),
  payment_id       VARCHAR(120),
  tracking_id      VARCHAR(120),
  shipping_name    VARCHAR(120),
  shipping_email   VARCHAR(180),
  shipping_phone   VARCHAR(30),
  shipping_address TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  book_id    INTEGER REFERENCES books(id),
  qty        SMALLINT DEFAULT 1,
  unit_price DECIMAL(8,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  status     VARCHAR(40) NOT NULL,
  note       TEXT,
  changed_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  label      VARCHAR(60) DEFAULT 'Home',
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(30),
  line1      VARCHAR(255) NOT NULL,
  line2      VARCHAR(255),
  city       VARCHAR(100) NOT NULL,
  state      VARCHAR(100) NOT NULL,
  pincode    VARCHAR(20)  NOT NULL,
  country    VARCHAR(80)  DEFAULT 'India',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(50) NOT NULL UNIQUE,
  type       VARCHAR(10) DEFAULT 'percent',
  value      DECIMAL(8,2) NOT NULL,
  min_order  DECIMAL(8,2) DEFAULT 0.00,
  max_uses   INTEGER,
  uses       INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  book_id  INTEGER REFERENCES books(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS email_subscribers (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(180) NOT NULL UNIQUE,
  is_active  BOOLEAN DEFAULT true,
  source     VARCHAR(60) DEFAULT 'website',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER,
  action     VARCHAR(120) NOT NULL,
  entity     VARCHAR(60),
  entity_id  INTEGER,
  details    JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_genre   ON books(genre);
CREATE INDEX IF NOT EXISTS idx_books_active  ON books(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_tokens_user   ON refresh_tokens(user_id);
