import random
import time
from datetime import datetime

# Configuration
LOG_FILE = "server.log"
TOTAL_RECORDS = 150

IP_ADDRESSES = [
    "192.168.1.10", "192.168.1.11", "192.168.1.12", 
    "10.0.0.5", "10.0.0.6", "172.16.0.1", "172.16.0.2"
]

MALICIOUS_IPS = ["192.168.100.1", "192.168.100.2"]

NORMAL_PATHS = ["/home", "/cart", "/checkout", "/products", "/about", "/contact"]
LOGIN_PATH = "/login"

SQLI_PAYLOADS = [
    "' OR 1=1 --",
    "UNION SELECT username, password FROM users --",
    "'; DROP TABLE products; --",
    "%27%20OR%201%3D1",
    "admin' --",
    "') OR ('1'='1"
]

def generate_log_line():
    timestamp = datetime.now().strftime("%d/%b/%Y:%H:%M:%S +0000")
    
    # Decide event type
    event_type = random.choices(
        ["normal", "brute_force", "sqli"], 
        weights=[70, 15, 15]
    )[0]
    
    if event_type == "normal":
        ip = random.choice(IP_ADDRESSES)
        path = random.choice(NORMAL_PATHS)
        method = "GET"
        status = 200
    elif event_type == "brute_force":
        ip = random.choice(MALICIOUS_IPS)
        path = LOGIN_PATH
        method = "POST"
        status = 401
    else: # sqli
        ip = random.choice(MALICIOUS_IPS)
        path = f"/products?id={random.choice(SQLI_PAYLOADS)}"
        method = "GET"
        status = 200 # Often SQLi attempts get 200 if not blocked
        
    return f'{ip} - - [{timestamp}] "{method} {path} HTTP/1.1" {status} 512\n'

def main():
    print(f"Generating {TOTAL_RECORDS} log entries in {LOG_FILE}...")
    with open(LOG_FILE, "w") as f:
        # Mix in some specific brute force sequences to ensure detection
        # Attacker 1: 5 failed logins
        for _ in range(5):
            ts = datetime.now().strftime("%d/%b/%Y:%H:%M:%S +0000")
            f.write(f'192.168.50.1 - - [{ts}] "POST /login HTTP/1.1" 401 512\n')
            
        # Attacker 2: SQLi attempts
        for payload in SQLI_PAYLOADS[:3]:
            ts = datetime.now().strftime("%d/%b/%Y:%H:%M:%S +0000")
            f.write(f'192.168.50.2 - - [{ts}] "GET /products?id={payload} HTTP/1.1" 200 512\n')

        # Randomized logs
        for _ in range(TOTAL_RECORDS):
            f.write(generate_log_line())
            
    print("Log generation complete.")

if __name__ == "__main__":
    main()
