import re
from collections import defaultdict

# Configuration
LOG_FILE = "server.log"
FAILED_LOGIN_THRESHOLD = 3

# Regex patterns
# Handles both simple mock format and Morgan/Apache combined format
# Format 1: [2023-10-27 10:00:00] 192.168.1.1 - GET /home 200
# Format 2: 127.0.0.1 - - [23/Apr/2026:12:34:56 +0000] "GET /api/books HTTP/1.1" 200 123
LOG_PATTERN = r'(?P<ip>[\d\.a-f:A-F]+).*?\[(?P<timestamp>.*?)\].*?"?(?P<method>GET|POST|PUT|DELETE|PATCH)\s+(?P<path>\S+)(?:\s+HTTP/.*?)?"?\s+(?P<status>\d{3})'

# SQLi Detection Regex
SQLI_PATTERN = r"('|\"|%27|%22)(?:[\s\+]|%20)*(OR|UNION|SELECT|DROP|UPDATE|DELETE|--|#|/*)"

def parse_logs(file_path):
    parsed_data = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                match = re.search(LOG_PATTERN, line)
                if match:
                    parsed_data.append(match.groupdict())
    except FileNotFoundError:
        print(f"Error: {file_path} not found. Please run the log generator first.")
        return []
    return parsed_data

def detect_threats(logs):
    failed_logins = defaultdict(list)
    sqli_attempts = []
    
    for entry in logs:
        ip = entry['ip']
        path = entry['path']
        status = entry['status']
        
        # 1. Detect Failed Login (Brute Force)
        # Check for 401 or 404 on common login paths
        if (path in ["/login", "/api/auth/login", "/invalid-login"]) and (status in ["401", "404"]):
            failed_logins[ip].append(entry)
            
        # 2. Detect SQL Injection
        if re.search(SQLI_PATTERN, path, re.IGNORECASE):
            sqli_attempts.append(entry)
            
    return failed_logins, sqli_attempts

def print_security_summary(failed_logins, sqli_attempts):
    print("=" * 60)
    print("         SECURITY THREAT DETECTION REPORT")
    print("=" * 60)
    
    # Brute Force Alerts
    print(f"\n[!] BRUTE FORCE ATTACK ALERTS (Threshold: {FAILED_LOGIN_THRESHOLD} failures)")
    found_brute = False
    for ip, attempts in failed_logins.items():
        if len(attempts) >= FAILED_LOGIN_THRESHOLD:
            found_brute = True
            print(f"[-] IP: {ip} | Attempts: {len(attempts)}")
            for att in attempts[:3]: # Show first 3 for brevity
                print(f"    - [{att['timestamp']}] {att['method']} {att['path']} {att['status']}")
            if len(attempts) > 3:
                print(f"    - ... ({len(attempts) - 3} more entries)")
                
    if not found_brute:
        print("    No brute force attempts detected.")
        
    # SQLi Alerts
    print(f"\n[!] SQL INJECTION ATTEMPT ALERTS")
    if sqli_attempts:
        # Group by IP for cleaner output
        sqli_by_ip = defaultdict(list)
        for attempt in sqli_attempts:
            sqli_by_ip[attempt['ip']].append(attempt)
            
        for ip, attempts in sqli_by_ip.items():
            print(f"[-] IP: {ip} | Threats Detected: {len(attempts)}")
            for att in attempts[:3]:
                print(f"    - [{att['timestamp']}] Path: {att['path']}")
            if len(attempts) > 3:
                print(f"    - ... ({len(attempts) - 3} more entries)")
    else:
        print("    No SQL injection attempts detected.")
        
    print("\n" + "=" * 60)

def main():
    print(f"Analyzing logs from {LOG_FILE}...")
    logs = parse_logs(LOG_FILE)
    
    if not logs:
        return
        
    failed_logins, sqli_attempts = detect_threats(logs)
    print_security_summary(failed_logins, sqli_attempts)

if __name__ == "__main__":
    main()
