-- ============================================================
-- Future Store — MySQL Schema
-- Run: mysql -u root -p < config/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS futurestore
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE futurestore;

-- ─── USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uuid         CHAR(36)     NOT NULL UNIQUE,
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role         ENUM('customer','admin') DEFAULT 'customer',
  is_active    TINYINT(1)   DEFAULT 1,
  avatar       VARCHAR(255) DEFAULT NULL,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login   DATETIME     DEFAULT NULL,
  login_attempts TINYINT UNSIGNED DEFAULT 0,
  locked_until DATETIME     DEFAULT NULL,
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB;

-- ─── BOOKS / INVENTORY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  author       VARCHAR(180) NOT NULL,
  genre        VARCHAR(80)  NOT NULL,
  description  TEXT,
  price        DECIMAL(8,2) NOT NULL,
  original_price DECIMAL(8,2) DEFAULT NULL,
  stock        INT UNSIGNED DEFAULT 0,
  pages        SMALLINT UNSIGNED DEFAULT NULL,
  publisher    VARCHAR(120) DEFAULT NULL,
  year         YEAR        DEFAULT NULL,
  badge        VARCHAR(40) DEFAULT NULL,   -- NEW, SALE, CLASSIC, BESTSELLER
  cover_color  VARCHAR(40) DEFAULT '#2C3E50',
  rating       DECIMAL(3,2) DEFAULT 0.00,
  reviews_count INT UNSIGNED DEFAULT 0,
  is_active    TINYINT(1)  DEFAULT 1,
  created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_genre  (genre),
  INDEX idx_active (is_active),
  INDEX idx_rating (rating)
) ENGINE=InnoDB;

-- ─── REVIEWS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  book_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_book_user (book_id, user_id),
  FOREIGN KEY (book_id) REFERENCES books(id)  ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── ORDERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number  VARCHAR(30)  NOT NULL UNIQUE,
  user_id       INT UNSIGNED NOT NULL,
  status        ENUM('pending','confirmed','shipped','delivered','cancelled')
                DEFAULT 'pending',
  subtotal      DECIMAL(10,2) NOT NULL,
  shipping_fee  DECIMAL(8,2)  DEFAULT 0.00,
  total         DECIMAL(10,2) NOT NULL,
  payment_gateway VARCHAR(30) DEFAULT NULL,
  payment_id    VARCHAR(120)  DEFAULT NULL,
  shipping_name    VARCHAR(120) DEFAULT NULL,
  shipping_email   VARCHAR(180) DEFAULT NULL,
  shipping_phone   VARCHAR(30)  DEFAULT NULL,
  shipping_address TEXT        DEFAULT NULL,
  notes         TEXT          DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ─── ORDER ITEMS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id  INT UNSIGNED NOT NULL,
  book_id   INT UNSIGNED NOT NULL,
  qty       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id)  REFERENCES books(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ─── AUDIT LOG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED DEFAULT NULL,
  action     VARCHAR(120) NOT NULL,
  entity     VARCHAR(60)  DEFAULT NULL,
  entity_id  INT UNSIGNED DEFAULT NULL,
  details    JSON         DEFAULT NULL,
  ip_address VARCHAR(45)  DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user   (user_id),
  INDEX idx_action (action)
) ENGINE=InnoDB;


-- ─── ADDRESSES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  label        VARCHAR(60)  DEFAULT 'Home',
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(30)  DEFAULT NULL,
  line1        VARCHAR(255) NOT NULL,
  line2        VARCHAR(255) DEFAULT NULL,
  city         VARCHAR(100) NOT NULL,
  state        VARCHAR(100) NOT NULL,
  pincode      VARCHAR(20)  NOT NULL,
  country      VARCHAR(80)  DEFAULT 'India',
  is_default   TINYINT(1)   DEFAULT 0,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ─── COUPONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(50)  NOT NULL UNIQUE,
  type         ENUM('percent','flat') DEFAULT 'percent',
  value        DECIMAL(8,2) NOT NULL,
  min_order    DECIMAL(8,2) DEFAULT 0.00,
  max_uses     INT UNSIGNED DEFAULT NULL,
  uses         INT UNSIGNED DEFAULT 0,
  expires_at   DATETIME     DEFAULT NULL,
  is_active    TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code)
) ENGINE=InnoDB;

-- ─── ORDER STATUS HISTORY ─────────────────────────────────
CREATE TABLE IF NOT EXISTS order_status_history (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  status     VARCHAR(40)  NOT NULL,
  note       TEXT         DEFAULT NULL,
  changed_by INT UNSIGNED DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── WISHLIST ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist (
  user_id    INT UNSIGNED NOT NULL,
  book_id    INT UNSIGNED NOT NULL,
  added_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── EMAIL SUBSCRIPTIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS email_subscribers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(180) NOT NULL UNIQUE,
  is_active  TINYINT(1)   DEFAULT 1,
  source     VARCHAR(60)  DEFAULT 'website',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- ─── SUPPORT TICKETS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(180) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  message    TEXT         NOT NULL,
  status     ENUM('open', 'closed', 'resolved') DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- ─── REFRESH TOKENS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- add coupon_code column to orders if not present
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code  VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount     DECIMAL(8,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS address_id   INT UNSIGNED DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tracking_id  VARCHAR(120) DEFAULT NULL;
