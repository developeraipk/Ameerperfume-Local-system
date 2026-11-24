-- ============================================================================
-- Ameer Perfumes ERP — Cloud Backend PostgreSQL DDL Schema
-- Centralized Synchronization, Aggregated Owner Reporting & Disaster Mirror
-- ============================================================================

CREATE TABLE IF NOT EXISTS cloud_terminal_nodes (
    terminal_id VARCHAR(32) PRIMARY KEY,
    station_role VARCHAR(32) NOT NULL CHECK(station_role IN ('PRIMARY_SERVER', 'CLIENT_PEER')),
    lan_ip VARCHAR(64) NOT NULL,
    last_heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_sync_watermarks (
    source_terminal_id VARCHAR(32) NOT NULL REFERENCES cloud_terminal_nodes(terminal_id),
    target_node_id VARCHAR(32) NOT NULL DEFAULT 'CLOUD_PG',
    last_replicated_sequence BIGINT NOT NULL DEFAULT 0,
    last_sync_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_terminal_id, target_node_id)
);

CREATE TABLE IF NOT EXISTS cloud_sync_events (
    event_id VARCHAR(64) PRIMARY KEY,
    origin_terminal_id VARCHAR(32) NOT NULL REFERENCES cloud_terminal_nodes(terminal_id),
    origin_sequence_number BIGINT NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    operation_type VARCHAR(16) NOT NULL CHECK(operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    payload_json JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(origin_terminal_id, origin_sequence_number)
);

CREATE TABLE IF NOT EXISTS cloud_sales_invoices (
    invoice_id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    terminal_id VARCHAR(32) NOT NULL,
    cashier_user_id VARCHAR(64) NOT NULL,
    net_payable_paisa BIGINT NOT NULL,
    payment_method VARCHAR(32) NOT NULL,
    invoice_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_inventory_snapshots (
    snapshot_id VARCHAR(64) PRIMARY KEY,
    snapshot_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    total_finished_goods_cost_paisa BIGINT NOT NULL,
    total_finished_goods_retail_paisa BIGINT NOT NULL,
    total_raw_materials_cost_paisa BIGINT NOT NULL,
    total_inventory_valuation_paisa BIGINT NOT NULL,
    recorded_by_terminal_id VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS cloud_owner_executive_metrics (
    metric_id VARCHAR(64) PRIMARY KEY,
    metric_date DATE UNIQUE NOT NULL,
    gross_sales_paisa BIGINT NOT NULL DEFAULT 0,
    orders_count INTEGER NOT NULL DEFAULT 0,
    attar_sales_paisa BIGINT NOT NULL DEFAULT 0,
    perfume_sales_paisa BIGINT NOT NULL DEFAULT 0,
    net_operating_profit_paisa BIGINT NOT NULL DEFAULT 0,
    wholesale_receivables_paisa BIGINT NOT NULL DEFAULT 0,
    cash_in_drawer_paisa BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed terminal nodes (Strictly 2 terminals per Owner Decision C)
INSERT INTO cloud_terminal_nodes (terminal_id, station_role, lan_ip, last_heartbeat_at)
VALUES 
    ('POS-01', 'PRIMARY_SERVER', '192.168.1.100', NOW()),
    ('POS-02', 'CLIENT_PEER', '192.168.1.101', NOW())
ON CONFLICT(terminal_id) DO UPDATE SET
    last_heartbeat_at = EXCLUDED.last_heartbeat_at;
