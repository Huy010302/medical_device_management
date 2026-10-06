-- Additive migration for the workflow-backed application.
CREATE TABLE IF NOT EXISTS audit_logs (
 id bigserial PRIMARY KEY,
 user_id varchar(36),
 action varchar(24) NOT NULL,
 table_name varchar(64) NOT NULL,
 record_id varchar(128) NOT NULL,
 old_value json,
 new_value json,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC, id DESC);
INSERT INTO device_statuses(value,label,description) VALUES
('operating','Đang vận hành','Operating'),('repairing','Đang sửa chữa','Repairing'),
('maintenance_pending','Chờ bảo trì','Maintenance pending'),('needs_repair','Cần sửa chữa','Needs repair'),
('awaiting_parts','Chờ linh kiện','Awaiting parts'),('irreparable','Không thể sửa chữa','Irreparable'),
('tendering','Đang đấu thầu','Tendering'),('approved','Đã duyệt','Approved'),
('purchased','Đã mua','Purchased'),('received','Đã tiếp nhận','Received')
ON CONFLICT(value) DO NOTHING;
