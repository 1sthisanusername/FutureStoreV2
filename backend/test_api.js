const axios = require('axios');
async function test() {
  try {
    const r1 = await axios.get('http://localhost:5000/api/books?badge=NEW&limit=8');
    console.log('--- ARRIVALS ---', r1.data.data.length);
    const r2 = await axios.get('http://localhost:5000/api/books?sort=reviews_count&order=DESC&limit=10');
    console.log('--- BESTSELLERS ---', r2.data.data.length);
    process.exit(0);
  } catch (e) { console.error(e.message); process.exit(1); }
}
test();
