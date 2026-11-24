export interface SyncEventPayload {
  event_id: string;
  origin_terminal_id: "POS-01" | "POS-02";
  origin_sequence_number: number;
  entity_type: string;
  entity_id: string;
  operation_type: "INSERT" | "UPDATE" | "DELETE";
  payload_json: Record<string, any> | string;
  created_at: string;
}

export interface SyncPushPayloadDto {
  terminal_id: "POS-01" | "POS-02";
  watermark_sequence: number;
  sync_trigger_reason: "PERIODIC_15_MIN" | "CRITICAL_MILESTONE_SHIFT_CLOSE" | "CRITICAL_MILESTONE_BATCH_RELEASE" | "MANUAL";
  events: SyncEventPayload[];
}

export interface SyncPushResponseDto {
  success: boolean;
  terminal_id: string;
  processed_events_count: number;
  acknowledged_watermark: number;
  server_timestamp: string;
  message: string;
}

export interface SyncStatusResponseDto {
  cloud_service: string;
  database: string;
  topology_nodes: {
    terminal_id: string;
    role: string;
    last_replicated_sequence: number;
    last_sync: string;
    is_healthy: boolean;
  }[];
  total_events_archived: number;
  sync_cadence: string;
}
