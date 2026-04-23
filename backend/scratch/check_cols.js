const pool = require('../config/db');
async function run() {
    try {
        const res = await pool.query("SELECT * FROM books LIMIT 1");
        console.log(Object.keys(res.rows[0]));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
