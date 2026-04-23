# Log Analysis & Threat Detection Lab

This project simulates a security monitoring environment for an e-commerce website. It consists of a log generator to simulate traffic (including attacks) and an analyzer to detect threats.

## Components
1. `log_generator.py`: Generates a simulated `server.log` file with normal traffic, brute-force login attempts, and SQL injection payloads.
2. `log_analyzer.py`: Parses the log file using Regular Expressions and flags suspicious activities based on predefined security logic.
3. `server.log`: The generated log file (created after running the generator).

## How to Run

1. **Prerequisites**: Ensure you have Python 3 installed.
2. **Generate Logs**:
   ```bash
   python log_generator.py
   ```
   This will create a `server.log` file in the current directory.
3. **Analyze Logs**:
   ```bash
   python log_analyzer.py
   ```
   The script will display a security alert summary in the console.

---

## ELK Stack Integration (Bonus)

In a real-world enterprise environment, manual script parsing is replaced by the **ELK Stack** (Elasticsearch, Logstash, Kibana) or **Elastic Stack**.

### Workflow
1. **Data Collection (Filebeat)**: Install Filebeat on the web server to tail the `server.log` file and ship it to Logstash.
2. **Data Parsing (Logstash)**: Logstash uses "Grok" filters (regex-based patterns) to parse the raw log strings into structured JSON fields.
3. **Storage & Indexing (Elasticsearch)**: The structured logs are stored in Elasticsearch, allowing for lightning-fast full-text searches.
4. **Visualization (Kibana)**: Security analysts use Kibana to create dashboards, visualize attack trends, and set up real-time alerts.

### Sample Logstash Configuration (`logstash.conf`)

```ruby
input {
  file {
    path => "/var/log/ecommerce/server.log"
    start_position => "beginning"
  }
}

filter {
  # Parse the log line using Grok
  grok {
    match => { "message" => "\[%{TIMESTAMP_ISO8601:timestamp}\] %{IP:client_ip} - %{WORD:method} %{URIPATHPARAM:request_path} %{NUMBER:status}" }
  }

  # Add a tag if SQLi is detected
  if [request_path] =~ /('|"|UNION|SELECT|--)/ {
    mutate { add_tag => [ "sqli_attempt" ] }
  }

  # Add a tag for failed logins
  if [request_path] == "/login" and [status] == "401" {
    mutate { add_tag => [ "failed_login" ] }
  }
}

output {
  elasticsearch {
    hosts => ["http://localhost:9200"]
    index => "security-logs-%{+YYYY.MM.dd}"
  }
  stdout { codec => rubydebug }
}
```

### Why use ELK?
- **Real-time Monitoring**: Alerts can be triggered the moment an attack starts.
- **Scalability**: Can handle millions of logs per second from thousands of servers.
- **Correlation**: Useful for correlating logs from different sources (DB, OS, App) to see the full scope of an attack.
