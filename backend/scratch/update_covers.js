const pool = require('../config/db');

const updates = [
    { id: 7, url: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1602190253i/52578297.jpg' }, // The Midnight Library
    { id: 6, url: 'https://m.media-amazon.com/images/I/71J+UnZdfdS._UF1000,1000_QL80_.jpg' }, // A Brief History of Time
    { id: 5, url: 'https://m.media-amazon.com/images/I/71CaTj9MAFL.jpg' }, // The Alchemist
    { id: 8, url: 'https://m.media-amazon.com/images/I/71f6DceqZAL.jpg' }, // Thinking, Fast and Slow
    { id: 2, url: 'https://m.media-amazon.com/images/I/713jIoMO3UL._AC_UF1000,1000_QL80_.jpg' }, // Sapiens
    { id: 10, url: 'https://m.media-amazon.com/images/S/compressed.photo.goodreads.com/books/1657781256i/61439040.jpg' }, // 1984
    { id: 3, url: 'https://m.media-amazon.com/images/I/81Ua99CURsL.jpg' }, // Dune
    { id: 4, url: 'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1655988385l/40121378.jpg' } // Atomic Habits
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
