const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// Config
const LOG_FILE = path.join(__dirname, '../../security_lab/access.log');
const THREAT_ENTITY = 'SECURITY_THREAT';

// Patterns
const PATTERNS = {
    'SQL Injection': /UNION SELECT|' OR 1=1|--|DROP TABLE|INSERT INTO/i,
    'Brute Force Login': /POST \/api\/login.* 401/i
};

async function analyze() {
    console.log('🚀 Starting Security Log Analysis...');
    
    if (!fs.existsSync(LOG_FILE)) {
        console.error(`❌ Log file not found at ${LOG_FILE}`);
        return;
    }

    const logData = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
    let threatsFound = 0;

    // We'll group brute force by IP
    const bruteForceMap = {};

    for (const line of logData) {
        if (!line.trim()) continue;

        // Parse IP (assuming standard NGINX combined format)
        const ipMatch = line.match(/^(\d+\.\d+\.\d+\.\d+)/);
        const ip = ipMatch ? ipMatch[1] : 'unknown';

        // Check SQLi
        if (PATTERNS['SQL Injection'].test(line)) {
            console.warn(`🚨 SQLi Detected from ${ip}`);
            await logThreat('SQL Injection Attempt', ip, line.trim());
            threatsFound++;
        }

        // Check Brute Force
        if (PATTERNS['Brute Force Login'].test(line)) {
            bruteForceMap[ip] = (bruteForceMap[ip] || 0) + 1;
        }
    }

    // Process Brute Force Map
    for (const [ip, count] of Object.entries(bruteForceMap)) {
        if (count >= 5) {
            console.warn(`🚨 Brute Force Detected from ${ip} (${count} attempts)`);
            await logThreat('Brute Force Login', ip, `Repeated failed logins detected: ${count} attempts in logs.`);
            threatsFound++;
        }
    }

    console.log(`✅ Analysis Complete. ${threatsFound} threats logged to Supabase.`);
    process.exit(0);
}

async function logThreat(type, ip, details) {
    try {
        await pool.query(
            `INSERT INTO audit_log (action, entity, details, ip_address) 
             VALUES ($1, $2, $3, $4)`,
            [type, THREAT_ENTITY, JSON.stringify({ note: details }), ip]
        );
    } catch (err) {
        console.error('❌ Failed to log threat to DB:', err);
    }
}

analyze();
