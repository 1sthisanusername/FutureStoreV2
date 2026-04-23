const pool = require('../config/db');
pool.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'audit_log'")
    .then(res => {
        console.table(res.rows);
        process.exit(0);
    })
    .catch(e => {
        console.error('ERROR:', e.message);
        process.exit(1);
    });
