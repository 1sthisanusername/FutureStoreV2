// seed.js — Supabase PostgreSQL version
require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool   = require('./config/db');

const books = [
  { title: 'The Great Gatsby',        author: 'F. Scott Fitzgerald', genre: 'Fiction',    price: 12.99, original_price: 18.99, stock: 50, pages: 180, publisher: 'Scribner',        year: 1925, badge: 'CLASSIC',    cover_color: '#1a4a6e', rating: 4.2, reviews_count: 3200  },
  { title: 'Sapiens',                 author: 'Yuval Noah Harari',   genre: 'History',    price: 16.99, original_price: 24.99, stock: 38, pages: 443, publisher: 'Harper',           year: 2011, badge: 'BESTSELLER', cover_color: '#a67c52', rating: 4.6, reviews_count: 18400 },
  { title: 'Dune',                    author: 'Frank Herbert',        genre: 'Sci-Fi',     price: 14.99, original_price: null,  stock: 22, pages: 412, publisher: 'Ace Books',        year: 1965, badge: 'CLASSIC',    cover_color: '#d4af37', rating: 4.7, reviews_count: 9800  },
  { title: 'Atomic Habits',           author: 'James Clear',          genre: 'Self-Help',  price: 18.99, original_price: 26.99, stock: 60, pages: 320, publisher: 'Avery',            year: 2018, badge: 'BESTSELLER', cover_color: '#3e7d48', rating: 4.8, reviews_count: 42000 },
  { title: 'The Alchemist',           author: 'Paulo Coelho',         genre: 'Fiction',    price: 11.99, original_price: 16.99, stock: 45, pages: 208, publisher: 'HarperOne',        year: 1988, badge: 'SALE',       cover_color: '#c0392b', rating: 4.5, reviews_count: 28000 },
  { title: 'A Brief History of Time', author: 'Stephen Hawking',      genre: 'Science',    price: 15.49, original_price: 21.99, stock: 30, pages: 212, publisher: 'Bantam Books',      year: 1988, badge: null,         cover_color: '#2980b9', rating: 4.4, reviews_count: 12500 },
  { title: 'The Midnight Library',    author: 'Matt Haig',            genre: 'Fiction',    price: 14.99, original_price: null,  stock: 18, pages: 304, publisher: 'Canongate',        year: 2020, badge: 'NEW',        cover_color: '#2c3e50', rating: 4.3, reviews_count: 7800  },
  { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman',      genre: 'Psychology', price: 17.99, original_price: 25.99, stock: 25, pages: 499, publisher: 'Farrar',           year: 2011, badge: null,         cover_color: '#8e44ad', rating: 4.5, reviews_count: 15200 },
  { title: 'The Art of War',          author: 'Sun Tzu',              genre: 'Philosophy', price: 8.99,  original_price: 12.99, stock: 70, pages: 68,  publisher: 'Penguin Classics', year: 500,  badge: 'CLASSIC',    cover_color: '#d35400', rating: 4.1, reviews_count: 5500  },
  { title: '1984',                    author: 'George Orwell',        genre: 'Fiction',    price: 13.99, original_price: 18.99, stock: 55, pages: 328, publisher: 'Secker & Warburg', year: 1949, badge: 'CLASSIC',    cover_color: '#34495e', rating: 4.7, reviews_count: 31000 },
];

const coupons = [
  { code: 'SAVE10',    type: 'percent', value: 10, min_order: 0  },
  { code: 'WELCOME20', type: 'percent', value: 20, min_order: 0  },
  { code: 'FLAT5',     type: 'flat',    value: 5,  min_order: 20 },
  { code: 'FREESHIP',  type: 'flat',    value: 5,  min_order: 0  },
];

async function seed() {
  console.log('🌱  Seeding Supabase database...');

  // Setup constraints
  await pool.query('ALTER TABLE books DROP CONSTRAINT IF EXISTS unique_title_author').catch(()=>{});
  await pool.query('DROP INDEX IF EXISTS unique_title_author').catch(()=>{});
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS unique_books_title_author ON books (title, author)');
  await pool.query('TRUNCATE order_items, orders, wishlist, reviews, books, users RESTART IDENTITY CASCADE');

  // Admin user
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@futurestore.com').replace(/[';]/g, '');

  const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  if (existingAdmin.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (uuid, name, email, password_hash, role)
       VALUES ($1, 'Admin', $2, $3, 'admin')`,
      [uuidv4(), adminEmail, adminHash]
    );
    console.log('✅  New Admin user created:', adminEmail);
  } else {
    await pool.query(
      `UPDATE users SET password_hash = $1, role = 'admin' WHERE email = $2`,
      [adminHash, adminEmail]
    );
    console.log('✅  Admin user updated:', adminEmail);
  }

  // Books
  for (const b of books) {
    await pool.query(
      `INSERT INTO books (title, author, genre, price, original_price, stock, pages, publisher, year, badge, cover_color, rating, reviews_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (title, author) DO NOTHING`,
      [b.title, b.author, b.genre, b.price, b.original_price, b.stock,
       b.pages, b.publisher, b.year, b.badge, b.cover_color, b.rating, b.reviews_count]
    );
  }
  console.log(`✅  ${books.length} books seeded (cleaned up duplicates)`);

  // Coupons
  for (const c of coupons) {
    await pool.query(
      `INSERT INTO coupons (code, type, value, min_order)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO NOTHING`,
      [c.code, c.type, c.value, c.min_order]
    );
  }
  console.log(`✅  ${coupons.length} coupons seeded`);

  // Cleanup user emails
  await pool.query(`UPDATE users SET email = REPLACE(REPLACE(email, '''', ''), ';', '')`);
  console.log('✅  User emails sanitized.');

  console.log('\n🎉  Done!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
