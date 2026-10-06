-- ADDITIVE migration; do not drop or overwrite existing hospital tables.
CREATE TABLE IF NOT EXISTS workflow_records (
  kind varchar(40) NOT NULL,
  id varchar(128) NOT NULL,
  payload json NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS device_events (
  id varchar(36) PRIMARY KEY,
  device_id varchar(128) NOT NULL,
  event_type varchar(64) NOT NULL,
  timestamp timestamptz NOT NULL,
  metadata json NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_events_timestamp ON device_events(timestamp);
INSERT INTO roles(code, name, description) VALUES ('pending','Pending','Waiting for approval')
ON CONFLICT (code) DO NOTHING;
