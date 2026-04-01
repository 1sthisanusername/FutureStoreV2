const pool = require('./backend/config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function resetAdmin() {
  try {
    const email = 'futurestore@railway.com';
    const pass = 'admin123';
    const hash = await bcrypt.hash(pass, 10);
    
    // First, try to update if it exists
    const updateResult = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id",
      [hash, email]
    );

    if (updateResult.rows.length === 0) {
      // If doesn't exist, create it
      const uuidv4 = crypto.randomUUID();
      await pool.query(
        "INSERT INTO users (uuid, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
        [uuidv4, 'Admin User', email, hash, 'admin']
      );
      console.log('ADMIN USER CREATED SUCCESSFUL');
    } else {
      console.log('ADMIN PASSWORD RESET SUCCESSFUL');
    }
  } catch (e) {
    console.error('DB ERROR:', e.message);
  } finally {
    process.exit(0);
  }
}

resetAdmin();
