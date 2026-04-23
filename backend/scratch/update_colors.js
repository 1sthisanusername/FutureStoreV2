const pool = require('../config/db');

// Rich, distinct cover colors for each book — no blacks or near-blacks
const updates = [
    { id: 1, color: '#1B4332' },   // The Great Gatsby — deep emerald green
    { id: 2, color: '#7B2D26' },   // Sapiens — warm burgundy
    { id: 3, color: '#B8860B' },   // Dune — desert gold
    { id: 4, color: '#2C3E50' },   // Atomic Habits — navy slate
    { id: 5, color: '#6B3A2A' },   // The Alchemist — warm brown
    { id: 6, color: '#1A237E' },   // A Brief History of Time — deep indigo
    { id: 7, color: '#4A148C' },   // The Midnight Library — rich purple
    { id: 8, color: '#004D40' },   // Thinking, Fast and Slow — teal green
    { id: 9, color: '#8B0000' },   // The Art of War — crimson red
    { id: 10, color: '#37474F' },  // 1984 — blue-grey steel
];

async function run() {
    for (const u of updates) {
        try {
            await pool.query("UPDATE books SET cover_color = $1 WHERE id = $2", [u.color, u.id]);
            console.log(`✅ Book ID ${u.id} → ${u.color}`);
        } catch (e) {
            console.error(`❌ Book ID ${u.id}:`, e.message);
        }
    }
    console.log('\n✅ All cover colors updated!');
    process.exit(0);
}

run();
