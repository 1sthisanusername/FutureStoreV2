import random
import time
from datetime import datetime

# Configuration
LOG_FILE = "access.log"
TOTAL_RECORDS = 500

IP_ADDRESSES = [
    "192.168.1.10", "192.168.1.11", "192.168.1.12", 
    "10.0.0.5", "10.0.0.6", "172.16.0.1", "172.16.0.2"
]

ATTACKER_IPS = ["192.168.100.1", "192.168.100.2", "45.33.22.11"]

NORMAL_PATHS = ["/", "/cart", "/products", "/about", "/contact", "/search?q=books"]
LOGIN_PATH = "/api/login"

SQLI_PAYLOADS = [
    "' OR 1=1 --",
    "UNION SELECT username, password FROM users --",
    "'; DROP TABLE products; --",
    "1' OR '1'='1",
    "admin' --",
    "')) OR 1=1 --",
    "1; SELECT pg_sleep(5)"
]

def generate_log_line():
    # NGINX Combined Log Format: 
    # $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
    
    timestamp = datetime.now().strftime("%d/%b/%Y:%H:%M:%S +0000")
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    
    # Decide event type
    # 75% Normal, 15% Failed Logins, 10% SQLi
    event_type = random.choices(
        ["normal", "failed_login", "sqli"], 
        weights=[75, 15, 10]
    )[0]
    
    if event_type == "normal":
        ip = random.choice(IP_ADDRESSES)
        path = random.choice(NORMAL_PATHS)
        method = "GET"
        status = 200
    elif event_type == "failed_login":
        ip = random.choice(ATTACKER_IPS)
        path = LOGIN_PATH
        method = "POST"
        status = 401
    else: # sqli
        ip = random.choice(ATTACKER_IPS)
        payload = random.choice(SQLI_PAYLOADS)
        path = f"/products?id={payload.replace(' ', '%20')}"
        method = "GET"
        status = 200 # Often SQLi attempts get 200 if not blocked by WAF
        
    return f'{ip} - - [{timestamp}] "{method} {path} HTTP/1.1" {status} {random.randint(500, 3000)} "-" "{user_agent}"\n'

def main():
    print(f"[*] Generating {TOTAL_RECORDS} log entries in {LOG_FILE}...")
    
    with open(LOG_FILE, "w") as f:
        # 1. Randomized logs
        for _ in range(TOTAL_RECORDS):
            f.write(generate_log_line())
            
        # 2. Guarantee some "Repeated Failed Login" detections (Attacker 1)
        attacker1 = "192.168.200.1"
        for _ in range(8):
            ts = datetime.now().strftime("%d/%b/%Y:%H:%M:%S +0000")
            f.write(f'{attacker1} - - [{ts}] "POST /api/login HTTP/1.1" 401 512 "-" "Mozilla/5.0"\n')

        # 3. Guarantee some "SQLi" detections (Attacker 2)
        attacker2 = "192.168.200.2"
        for payload in SQLI_PAYLOADS[:3]:
            ts = datetime.now().strftime("%d/%b/%Y:%H:%M:%S +0000")
            encoded_payload = payload.replace(" ", "%20").replace("'", "%27")
            f.write(f'{attacker2} - - [{ts}] "GET /products?id={encoded_payload} HTTP/1.1" 200 1024 "-" "Mozilla/5.0"\n')

    print(f"[+] Successfully created {LOG_FILE} for analysis.")

if __name__ == "__main__":
    main()
