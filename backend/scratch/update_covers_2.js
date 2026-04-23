const pool = require('../config/db');

const updates = [
    { id: 9, url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS0DC7_6-uSuQSZt0HOlq8TjAsz-wR20mpkn3sRojVzsq1j6Zs3isnagSZxA6pU8Q0IQ9qlRJbJKKLoGImGKnFd5jgRrsZnf0sWl4_iRA&s=10' }, // The Art of War
    { id: 1, url: 'https://m.media-amazon.com/images/I/81TLiZrasVL._UF1000,1000_QL80_.jpg' } // The Great Gatsby
];

async function run() {
    for (const update of updates) {
        try {
            await pool.query("UPDATE books SET cover_url = ? WHERE id = ?", [update.url, update.id]);
            console.log(`✅ Updated book ID ${update.id}`);
        } catch (e) {
            console.error(`❌ Failed to update book ID ${update.id}:`, e.message);
        }
    }
    process.exit(0);
}

run();
