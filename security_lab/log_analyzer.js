const fs = require('fs');

const LOG_FILE = 'server.log';
const FAILED_LOGIN_THRESHOLD = 3;

// Regex: Supports simple and Morgan/Apache formats (including IPv6)
const LOG_PATTERN = /([\d\.a-f:A-F]+).*?\[(.*?)\].*?"?(GET|POST|PUT|DELETE|PATCH)\s+(\S+)(?:\s+HTTP\/.*?)?"?\s+(\d{3})/;
const SQLI_PATTERN = /('|"|%27|%22)(?:[\s\+]|%20)*(OR|UNION|SELECT|DROP|UPDATE|DELETE|--|#|\/\*)/i;

function analyze() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`Error: ${LOG_FILE} not found. Run the app or generator first.`);
    return;
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
  const failedLogins = {};
  const sqliAttempts = [];

  lines.forEach(line => {
    const match = line.match(LOG_PATTERN);
    if (match) {
      const [_, ip, timestamp, method, path, status] = match;
      const entry = { ip, timestamp, method, path, status };

      // 1. Detect Failed Login
      if (['/login', '/api/auth/login', '/invalid-login'].includes(path) && ['401', '404'].includes(status)) {
        if (!failedLogins[ip]) failedLogins[ip] = [];
        failedLogins[ip].push(entry);
      }

      // 2. Detect SQLi
      if (SQLI_PATTERN.test(path)) {
        sqliAttempts.push(entry);
      }
    }
  });

  printSummary(failedLogins, sqliAttempts);
}

function printSummary(failedLogins, sqliAttempts) {
  console.log('='.repeat(60));
  console.log('         SECURITY THREAT DETECTION REPORT (JS VERSION)');
  console.log('='.repeat(60));

  console.log(`\n[!] BRUTE FORCE ATTACK ALERTS (Threshold: ${FAILED_LOGIN_THRESHOLD} failures)`);
  let foundBrute = false;
  for (const ip in failedLogins) {
    if (failedLogins[ip].length >= FAILED_LOGIN_THRESHOLD) {
      foundBrute = true;
      console.log(`[-] IP: ${ip} | Attempts: ${failedLogins[ip].length}`);
      failedLogins[ip].slice(0, 3).forEach(att => {
        console.log(`    - [${att.timestamp}] ${att.method} ${att.path} ${att.status}`);
      });
      if (failedLogins[ip].length > 3) console.log(`    - ... (${failedLogins[ip].length - 3} more entries)`);
    }
  }
  if (!foundBrute) console.log('    No brute force attempts detected.');

  console.log(`\n[!] SQL INJECTION ATTEMPT ALERTS`);
  if (sqliAttempts.length > 0) {
    const byIp = {};
    sqliAttempts.forEach(att => {
      if (!byIp[att.ip]) byIp[att.ip] = [];
      byIp[att.ip].push(att);
    });

    for (const ip in byIp) {
      console.log(`[-] IP: ${ip} | Threats Detected: ${byIp[ip].length}`);
      byIp[ip].slice(0, 3).forEach(att => {
        console.log(`    - [${att.timestamp}] Path: ${att.path}`);
      });
      if (byIp[ip].length > 3) console.log(`    - ... (${byIp[ip].length - 3} more entries)`);
    }
  } else {
    console.log('    No SQL injection attempts detected.');
  }
  console.log('\n' + '='.repeat(60));
}

analyze();
