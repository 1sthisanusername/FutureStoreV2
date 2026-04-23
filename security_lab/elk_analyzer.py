"""
ELK Stack Compatibility Note:
This script outputs structured JSON alerts to 'threat_alerts.json'. 
In an ELK Stack pipeline, Logstash can be configured with a 'file' input plugin 
pointing to this JSON file and a 'json' filter to automatically parse the fields 
(timestamp, source_ip, threat_type, details). These fields can then be indexed into 
Elasticsearch and visualized in Kibana dashboards for real-time monitoring.
"""

import re
import json
from collections import defaultdict

# Configuration
LOG_FILE = "access.log"
ALERT_FILE = "threat_alerts.json"
FAILED_LOGIN_THRESHOLD = 5

# Regex pattern for NGINX Combined Log Format
# Extracts: IP, Timestamp, Method, Path, Status
LOG_PATTERN = r'(?P<ip>\d+\.\d+\.\d+\.\d+) - - \[(?P<timestamp>.*?)\] "(?P<method>\w+) (?P<path>.*?) HTTP/1.1" (?P<status>\d+)'

# Robust Regex signature for SQL Injection attempts in URL paths/parameters
SQLI_PATTERN = r"(UNION|SELECT|INSERT|DELETE|DROP|UPDATE|' OR |\" OR |1=1|--|#|\/\*)"

def analyze_logs():
    failed_logins = defaultdict(int)
    threats = []

    print(f"[*] Starting analysis of {LOG_FILE}...")

    try:
        with open(LOG_FILE, "r") as f:
            for line in f:
                match = re.search(LOG_PATTERN, line)
                if not match:
                    continue

                log_data = match.groupdict()
                ip = log_data['ip']
                path = log_data['path']
                status = log_data['status']
                ts = log_data['timestamp']

                # 1. Detect Repeated Failed Logins (401 Unauthorized on login endpoint)
                if "/api/login" in path and status == "401":
                    failed_logins[ip] += 1
                    if failed_logins[ip] > FAILED_LOGIN_THRESHOLD:
                        alert = {
                            "timestamp": ts,
                            "source_ip": ip,
                            "threat_type": "Repeated Failed Logins",
                            "details": f"IP exceeded threshold with {failed_logins[ip]} failed attempts."
                        }
                        threats.append(alert)
                        # Reset counter after flagging to avoid duplicate spam in this run
                        failed_logins[ip] = -999 

                # 2. Detect SQLi Attempts
                # Check if the path contains SQLi signatures (case-insensitive)
                if re.search(SQLI_PATTERN, path, re.IGNORECASE):
                    alert = {
                        "timestamp": ts,
                        "source_ip": ip,
                        "threat_type": "SQL Injection Attempt",
                        "details": f"Malicious payload detected in path: {path}"
                    }
                    threats.append(alert)

    except FileNotFoundError:
        print(f"[!] Error: {LOG_FILE} not found. Please run log_generator.py first.")
        return

    # Output detected threats to structured JSON
    if threats:
        print(f"[!] {len(threats)} threats detected! Writing to {ALERT_FILE}...")
        with open(ALERT_FILE, "w") as f:
            for threat in threats:
                f.write(json.dumps(threat) + "\n")
        print("[+] Threat detection report complete.")
    else:
        print("[+] No threats detected in this log cycle.")

if __name__ == "__main__":
    analyze_logs()
