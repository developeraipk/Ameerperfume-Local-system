use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use crate::db::DatabaseManager;

pub const DEFAULT_CLOUD_ENDPOINT: &str = "http://127.0.0.1:3000";
pub const CLOUD_AUTH_TOKEN: &str = "AMEER-CLOUD-TOKEN-PROD-2026";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncEventPayload {
    pub event_id: String,
    pub origin_terminal_id: String,
    pub origin_sequence_number: i64,
    pub entity_type: String,
    pub entity_id: String,
    pub operation_type: String,
    pub payload_json: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncPushPayload {
    pub terminal_id: String,
    pub watermark_sequence: i64,
    pub sync_trigger_reason: String,
    pub events: Vec<CloudSyncEventPayload>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncPushResponse {
    pub success: bool,
    pub terminal_id: String,
    pub processed_events_count: usize,
    pub acknowledged_watermark: i64,
    pub server_timestamp: String,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CloudSyncStatusResponse {
    pub cloud_service: String,
    pub database: String,
    pub total_events_archived: i64,
    pub sync_cadence: String,
    pub is_online: bool,
}

pub struct CloudSyncClient {
    pub host: String,
    pub port: u16,
    pub terminal_id: String,
    pub auth_token: String,
}

impl CloudSyncClient {
    pub fn new(endpoint: &str, terminal_id: &str) -> Self {
        let (host, port) = parse_endpoint(endpoint);
        Self {
            host,
            port,
            terminal_id: terminal_id.to_string(),
            auth_token: CLOUD_AUTH_TOKEN.to_string(),
        }
    }

    pub fn push_events(&self, trigger_reason: &str) -> Result<CloudSyncPushResponse, String> {
        let db = DatabaseManager::new();
        let conn = db.get_connection().map_err(|e| e.to_string())?;

        // 1. Fetch pending outbox events
        let mut stmt = conn.prepare(
            "SELECT event_id, device_id, local_sequence_number, entity_type, entity_id,
                    operation_type, payload_json, is_synced, created_at
             FROM sync_outbox
             WHERE is_synced = 0
             ORDER BY local_sequence_number ASC
             LIMIT 100;"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |r| {
            Ok(CloudSyncEventPayload {
                event_id: r.get(0)?,
                origin_terminal_id: r.get(1)?,
                origin_sequence_number: r.get(2)?,
                entity_type: r.get(3)?,
                entity_id: r.get(4)?,
                operation_type: r.get(5)?,
                payload_json: r.get(6)?,
                created_at: r.get(8)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut events: Vec<CloudSyncEventPayload> = Vec::new();
        let mut max_seq = 0i64;
        for r in rows {
            if let Ok(ev) = r {
                if ev.origin_sequence_number > max_seq {
                    max_seq = ev.origin_sequence_number;
                }
                events.push(ev);
            }
        }

        let push_payload = CloudSyncPushPayload {
            terminal_id: self.terminal_id.clone(),
            watermark_sequence: max_seq,
            sync_trigger_reason: trigger_reason.to_string(),
            events: events.clone(),
        };

        // 2. Perform HTTP POST with exponential backoff retry (1s, 2s, 4s)
        let body_json = serde_json::to_string(&push_payload).map_err(|e| e.to_string())?;
        let path = "/api/v1/sync/push";
        
        let mut backoff = Duration::from_millis(500);
        let mut last_err = String::new();

        for _attempt in 1..=3 {
            match self.send_http_request("POST", path, Some(&body_json)) {
                Ok(resp_body) => {
                    // Mark events as synced in local outbox
                    if let Ok(mut upd) = conn.prepare("UPDATE sync_outbox SET is_synced = 1 WHERE event_id = ?;") {
                        for ev in &events {
                            let _ = upd.execute([&ev.event_id]);
                        }
                    }

                    let parsed: CloudSyncPushResponse = serde_json::from_str(&resp_body)
                        .unwrap_or_else(|_| CloudSyncPushResponse {
                            success: true,
                            terminal_id: self.terminal_id.clone(),
                            processed_events_count: events.len(),
                            acknowledged_watermark: max_seq,
                            server_timestamp: chrono::Utc::now().to_rfc3339(),
                            message: format!("Synchronized {} events to cloud NestJS backend.", events.len()),
                        });

                    return Ok(parsed);
                }
                Err(e) => {
                    last_err = e;
                    std::thread::sleep(backoff);
                    backoff *= 2;
                }
            }
        }

        // Graceful offline fallback: if cloud backend is currently unreachable, log and preserve local queue
        Ok(CloudSyncPushResponse {
            success: false,
            terminal_id: self.terminal_id.clone(),
            processed_events_count: 0,
            acknowledged_watermark: 0,
            server_timestamp: chrono::Utc::now().to_rfc3339(),
            message: format!("Cloud offline or unreachable: {}. Local transactions queued in sync_outbox.", last_err),
        })
    }

    fn send_http_request(&self, method: &str, path: &str, body: Option<&str>) -> Result<String, String> {
        let addr = format!("{}:{}", self.host, self.port);
        let mut stream = TcpStream::connect_timeout(
            &addr.to_socket_addrs().map_err(|e| e.to_string())?.next().ok_or("DNS resolution failed")?,
            Duration::from_secs(3)
        ).map_err(|e| format!("TCP connection failed: {}", e))?;

        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

        let content_length = body.map(|b| b.len()).unwrap_or(0);
        let request = format!(
            "{} {} HTTP/1.1\r\n\
             Host: {}:{}\r\n\
             User-Agent: AmeerPerfumes-ERP-Desktop/4.1.0\r\n\
             Authorization: Bearer {}\r\n\
             Content-Type: application/json\r\n\
             Content-Length: {}\r\n\
             Connection: close\r\n\r\n{}",
            method, path, self.host, self.port, self.auth_token, content_length, body.unwrap_or("")
        );

        stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
        stream.flush().map_err(|e| e.to_string())?;

        let mut response_bytes = Vec::new();
        stream.read_to_end(&mut response_bytes).map_err(|e| e.to_string())?;
        let response_str = String::from_utf8_lossy(&response_bytes);

        // Parse status line and body
        if let Some(pos) = response_str.find("\r\n\r\n") {
            let (headers, body_part) = response_str.split_at(pos + 4);
            let first_line = headers.lines().next().unwrap_or("");
            if first_line.contains("200") || first_line.contains("201") {
                Ok(body_part.to_string())
            } else {
                Err(format!("HTTP Error: {} | Response: {}", first_line, body_part))
            }
        } else {
            Err("Malformed HTTP response".to_string())
        }
    }
}

fn parse_endpoint(endpoint: &str) -> (String, u16) {
    let clean = endpoint.trim_start_matches("http://").trim_start_matches("https://");
    if let Some((h, p)) = clean.split_once(':') {
        let port_clean = p.split('/').next().unwrap_or("3000");
        (h.to_string(), port_clean.parse::<u16>().unwrap_or(3000))
    } else {
        let host = clean.split('/').next().unwrap_or("127.0.0.1");
        (host.to_string(), 3000)
    }
}
