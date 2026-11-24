use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use crate::db::{DatabaseManager, SyncOutboxEventDto};

pub const DEFAULT_LAN_SYNC_PORT: u16 = 7878;
pub const LAN_AUTH_SECRET: &str = "AMEER-PERFUMES-LAN-KEY-v410";

static SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum LanSyncMessage {
    Handshake {
        station_id: String,
        auth_token: String,
        last_received_seq: i64,
    },
    HandshakeAck {
        station_id: String,
        authenticated: bool,
        last_server_seq: i64,
        error: Option<String>,
    },
    PullEventsRequest {
        from_sequence: i64,
        max_count: usize,
    },
    PushEventsBatch {
        origin_device_id: String,
        events: Vec<SyncOutboxEventDto>,
    },
    BatchAck {
        last_applied_sequence: i64,
        applied_count: usize,
        status: String,
    },
    Heartbeat {
        station_id: String,
        timestamp: String,
    },
    HeartbeatAck {
        timestamp: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LanSyncStats {
    pub success: bool,
    pub events_sent: usize,
    pub events_received: usize,
    pub peer_station_id: String,
    pub message: String,
}

pub fn is_lan_server_running() -> bool {
    SERVER_RUNNING.load(Ordering::SeqCst)
}

pub fn start_lan_sync_server(port: u16) -> Result<(), String> {
    if SERVER_RUNNING.load(Ordering::SeqCst) {
        return Ok(()); // Already running
    }

    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&bind_addr)
        .map_err(|e| format!("Failed to bind LAN sync listener on {}: {}", bind_addr, e))?;

    listener.set_nonblocking(true)
        .map_err(|e| format!("Failed to set nonblocking on listener: {}", e))?;

    SERVER_RUNNING.store(true, Ordering::SeqCst);
    println!("[LAN Sync] Server listening on {}", bind_addr);

    std::thread::spawn(move || {
        while SERVER_RUNNING.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((stream, addr)) => {
                    println!("[LAN Sync] Incoming connection from {}", addr);
                    handle_peer_connection(stream);
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(e) => {
                    eprintln!("[LAN Sync] Error accepting connection: {}", e);
                    std::thread::sleep(Duration::from_millis(200));
                }
            }
        }
        println!("[LAN Sync] Server stopped.");
    });

    Ok(())
}

pub fn stop_lan_sync_server() {
    SERVER_RUNNING.store(false, Ordering::SeqCst);
}

fn handle_peer_connection(mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    let reader_stream = match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    };
    let mut reader = BufReader::new(reader_stream);
    let db = DatabaseManager::new();
    let mut line = String::new();
    let mut _peer_station = String::new();
    let mut is_authenticated = false;

    while let Ok(bytes_read) = reader.read_line(&mut line) {
        if bytes_read == 0 {
            break;
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            line.clear();
            continue;
        }

        let msg: LanSyncMessage = match serde_json::from_str(trimmed) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[LAN Sync] JSON decode error: {}", e);
                break;
            }
        };

        match msg {
            LanSyncMessage::Handshake { station_id, auth_token, .. } => {
                _peer_station = station_id.clone();
                is_authenticated = auth_token == LAN_AUTH_SECRET && (station_id == "POS-01" || station_id == "POS-02");
                let ack = LanSyncMessage::HandshakeAck {
                    station_id: "POS-01".to_string(),
                    authenticated: is_authenticated,
                    last_server_seq: 0,
                    error: if is_authenticated { None } else { Some("Invalid credentials or unauthorized terminal ID".to_string()) },
                };
                let _ = send_msg(&mut stream, &ack);
                if !is_authenticated {
                    break;
                }
            }
            LanSyncMessage::PushEventsBatch { origin_device_id: _, events } => {
                if !is_authenticated {
                    break;
                }
                let mut applied_count = 0;
                let mut max_seq = 0i64;
                for ev in &events {
                    if ev.local_sequence_number > max_seq {
                        max_seq = ev.local_sequence_number;
                    }
                    if let Ok(conn) = db.get_connection() {
                        let now = chrono::Utc::now().to_rfc3339();
                        let inbox_id = format!("inb_{}_{}", ev.device_id, ev.local_sequence_number);
                        let ins = conn.execute(
                            "INSERT OR IGNORE INTO sync_inbox_journal (
                                inbox_id, origin_device_id, origin_sequence_number, entity_type, entity_id,
                                operation_type, payload_json, received_at, is_applied, applied_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);",
                            rusqlite::params![
                                inbox_id,
                                ev.device_id,
                                ev.local_sequence_number,
                                ev.entity_type,
                                ev.entity_id,
                                ev.operation_type,
                                ev.payload_json,
                                now,
                                now
                            ]
                        );
                        if let Ok(rows) = ins {
                            if rows > 0 {
                                applied_count += 1;
                            }
                        }
                    }
                }
                let ack = LanSyncMessage::BatchAck {
                    last_applied_sequence: max_seq,
                    applied_count,
                    status: "OK".to_string(),
                };
                let _ = send_msg(&mut stream, &ack);
            }
            LanSyncMessage::PullEventsRequest { from_sequence, max_count } => {
                if !is_authenticated {
                    break;
                }
                let mut outbox_events: Vec<SyncOutboxEventDto> = Vec::new();
                if let Ok(conn) = db.get_connection() {
                    let mut stmt = conn.prepare(
                        "SELECT event_id, device_id, local_sequence_number, entity_type, entity_id,
                                operation_type, payload_json, is_synced, created_at
                         FROM sync_outbox
                         WHERE local_sequence_number > ?
                         ORDER BY local_sequence_number ASC
                         LIMIT ?;"
                    ).unwrap();
                    let rows = stmt.query_map(rusqlite::params![from_sequence, max_count as i64], |r| {
                        Ok(SyncOutboxEventDto {
                            event_id: r.get(0)?,
                            device_id: r.get(1)?,
                            local_sequence_number: r.get(2)?,
                            entity_type: r.get(3)?,
                            entity_id: r.get(4)?,
                            operation_type: r.get(5)?,
                            payload_json: r.get(6)?,
                            is_synced: r.get::<_, i64>(7)? != 0,
                            created_at: r.get(8)?,
                        })
                    }).unwrap();
                    for r in rows {
                        if let Ok(ev) = r {
                            outbox_events.push(ev);
                        }
                    }
                }
                let resp = LanSyncMessage::PushEventsBatch {
                    origin_device_id: "POS-01".to_string(),
                    events: outbox_events,
                };
                let _ = send_msg(&mut stream, &resp);
            }
            LanSyncMessage::Heartbeat { timestamp, .. } => {
                let _ = send_msg(&mut stream, &LanSyncMessage::HeartbeatAck { timestamp });
            }
            _ => {}
        }

        line.clear();
    }
}

fn send_msg(stream: &mut TcpStream, msg: &LanSyncMessage) -> std::io::Result<()> {
    let mut payload = serde_json::to_string(msg).unwrap();
    payload.push('\n');
    stream.write_all(payload.as_bytes())?;
    stream.flush()?;
    Ok(())
}

pub fn sync_with_peer_lan(peer_addr: &str, current_station: &str) -> Result<LanSyncStats, String> {
    let mut stream = TcpStream::connect_timeout(
        &peer_addr.parse().map_err(|e| format!("Invalid peer address: {}", e))?,
        Duration::from_secs(5)
    ).map_err(|e| format!("Connection to peer {} timed out / failed: {}", peer_addr, e))?;

    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    let db = DatabaseManager::new();

    // 1. Handshake
    let hs = LanSyncMessage::Handshake {
        station_id: current_station.to_string(),
        auth_token: LAN_AUTH_SECRET.to_string(),
        last_received_seq: 0,
    };
    send_msg(&mut stream, &hs).map_err(|e| e.to_string())?;

    let mut line = String::new();
    reader.read_line(&mut line).map_err(|e| format!("Failed to read HandshakeAck: {}", e))?;
    let resp: LanSyncMessage = serde_json::from_str(line.trim())
        .map_err(|e| format!("Invalid handshake response: {}", e))?;

    match resp {
        LanSyncMessage::HandshakeAck { authenticated, error, .. } => {
            if !authenticated {
                return Err(format!("Peer rejected handshake: {:?}", error));
            }
        }
        _ => return Err("Unexpected response to Handshake".to_string()),
    }

    // 2. Push unsynced local events to peer
    let mut events_to_push: Vec<SyncOutboxEventDto> = Vec::new();
    if let Ok(conn) = db.get_connection() {
        let mut stmt = conn.prepare(
            "SELECT event_id, device_id, local_sequence_number, entity_type, entity_id,
                    operation_type, payload_json, is_synced, created_at
             FROM sync_outbox
             WHERE is_synced = 0
             ORDER BY local_sequence_number ASC
             LIMIT 100;"
        ).map_err(|e| e.to_string())?;

        let rows = stmt.query_map([], |r| {
            Ok(SyncOutboxEventDto {
                event_id: r.get(0)?,
                device_id: r.get(1)?,
                local_sequence_number: r.get(2)?,
                entity_type: r.get(3)?,
                entity_id: r.get(4)?,
                operation_type: r.get(5)?,
                payload_json: r.get(6)?,
                is_synced: false,
                created_at: r.get(8)?,
            })
        }).map_err(|e| e.to_string())?;

        for r in rows {
            if let Ok(ev) = r {
                events_to_push.push(ev);
            }
        }
    }

    let push_count = events_to_push.len();
    if !events_to_push.is_empty() {
        let push_msg = LanSyncMessage::PushEventsBatch {
            origin_device_id: current_station.to_string(),
            events: events_to_push.clone(),
        };
        send_msg(&mut stream, &push_msg).map_err(|e| e.to_string())?;

        line.clear();
        reader.read_line(&mut line).map_err(|e| format!("Failed to read BatchAck: {}", e))?;
        let ack: LanSyncMessage = serde_json::from_str(line.trim())
            .map_err(|e| format!("Invalid batch ack: {}", e))?;

        if let LanSyncMessage::BatchAck { status, .. } = ack {
            if status == "OK" {
                // Mark events as synced in local outbox
                if let Ok(conn) = db.get_connection() {
                    for ev in &events_to_push {
                        let _ = conn.execute("UPDATE sync_outbox SET is_synced = 1 WHERE event_id = ?;", [&ev.event_id]);
                    }
                }
            }
        }
    }

    // 3. Pull events from peer
    let last_inbox_seq = if let Ok(conn) = db.get_connection() {
        conn.query_row(
            "SELECT COALESCE(MAX(origin_sequence_number), 0) FROM sync_inbox_journal WHERE origin_device_id != ?;",
            [current_station],
            |r| r.get(0)
        ).unwrap_or(0i64)
    } else {
        0i64
    };

    let pull_req = LanSyncMessage::PullEventsRequest {
        from_sequence: last_inbox_seq,
        max_count: 100,
    };
    send_msg(&mut stream, &pull_req).map_err(|e| e.to_string())?;

    line.clear();
    reader.read_line(&mut line).map_err(|e| format!("Failed to read PullEvents response: {}", e))?;
    let pull_resp: LanSyncMessage = serde_json::from_str(line.trim())
        .map_err(|e| format!("Invalid pull response: {}", e))?;

    let mut recv_count = 0;
    if let LanSyncMessage::PushEventsBatch { events, .. } = pull_resp {
        if let Ok(conn) = db.get_connection() {
            let now = chrono::Utc::now().to_rfc3339();
            for ev in &events {
                let inbox_id = format!("inb_{}_{}", ev.device_id, ev.local_sequence_number);
                let ins = conn.execute(
                    "INSERT OR IGNORE INTO sync_inbox_journal (
                        inbox_id, origin_device_id, origin_sequence_number, entity_type, entity_id,
                        operation_type, payload_json, received_at, is_applied, applied_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?);",
                    rusqlite::params![
                        inbox_id,
                        ev.device_id,
                        ev.local_sequence_number,
                        ev.entity_type,
                        ev.entity_id,
                        ev.operation_type,
                        ev.payload_json,
                        now,
                        now
                    ]
                );
                if let Ok(rows) = ins {
                    if rows > 0 {
                        recv_count += 1;
                    }
                }
            }
        }
    }

    Ok(LanSyncStats {
        success: true,
        events_sent: push_count,
        events_received: recv_count,
        peer_station_id: if current_station == "POS-01" { "POS-02".to_string() } else { "POS-01".to_string() },
        message: format!("LAN Sync complete: {} events sent, {} events received from peer.", push_count, recv_count),
    })
}
