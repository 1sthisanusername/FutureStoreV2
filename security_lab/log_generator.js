const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'access.log');
const TOTAL_LINES = 500;

const IPS = ['192.168.1.10', '10.0.0.5', '172.16.0.2', '203.0.113.1', '198.51.100.42'];
const ENDPOINTS = ['/', '/cart', '/products', '/about', '/contact', '/api/books'];
const AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

function generateLogLine() {
    const ip = IPS[Math.floor(Math.random() * IPS.length)];
    const time = new Date().toISOString().replace('T', ':').split('.')[0] + ' +0000';
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    
    // Randomly decide traffic type
    const type = Math.random();
    
    if (type < 0.8) {
        // Normal Traffic
        const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
        return `${ip} - - [${time}] "GET ${ep} HTTP/1.1" 200 ${Math.floor(Math.random()*5000)} "-" "${agent}"`;
    } else if (type < 0.9) {
        // Brute Force Attempt
        return `${ip} - - [${time}] "POST /api/login HTTP/1.1" 401 128 "-" "${agent}"`;
    } else {
        // SQL Injection Attempt
        const payloads = ["' OR 1=1--", "UNION SELECT NULL,NULL--", "'; DROP TABLE users;--"];
        const payload = encodeURIComponent(payloads[Math.floor(Math.random() * payloads.length)]);
        return `${ip} - - [${time}] "GET /products?id=${payload} HTTP/1.1" 200 4048 "-" "${agent}"`;
    }
}

function run() {
    console.log(`📝 Generating ${TOTAL_LINES} log entries...`);
    const lines = [];
    for (let i = 0; i < TOTAL_LINES; i++) {
        lines.push(generateLogLine());
    }
    fs.writeFileSync(LOG_FILE, lines.join('\n'));
    console.log(`✅ Logs saved to ${LOG_FILE}`);
}

run();
