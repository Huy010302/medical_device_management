-- Run once after 001 and 002; safe to rerun.
ALTER TABLE device_categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE device_statuses ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_workflow_kind_updated ON workflow_records(kind, updated_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_workflow_device_code ON workflow_records ((payload->>'device_code')) WHERE kind='devices';
CREATE INDEX IF NOT EXISTS idx_workflow_device_department ON workflow_records ((payload->>'department_id')) WHERE kind='devices';
CREATE INDEX IF NOT EXISTS idx_workflow_device_category ON workflow_records ((payload->>'category_id')) WHERE kind='devices';
CREATE INDEX IF NOT EXISTS idx_workflow_device_status ON workflow_records ((payload->>'current_status')) WHERE kind='devices';
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_qr_token ON workflow_records ((payload->>'qr_token')) WHERE kind='devices' AND payload->>'qr_token' IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_device_event ON device_events(device_id, timestamp DESC);
-- Attach IDs to older JSON device documents, preserving their original display fields.
UPDATE workflow_records w SET payload = jsonb_set(w.payload::jsonb, '{category_id}', to_jsonb(c.id::text))::json
FROM device_categories c WHERE w.kind='devices' AND (w.payload->>'category_id') IS NULL AND w.payload->>'category'=c.name;
UPDATE workflow_records w SET payload = jsonb_set(w.payload::jsonb, '{department_id}', to_jsonb(d.id::text))::json
FROM departments d WHERE w.kind='devices' AND (w.payload->>'department_id') IS NULL AND w.payload->>'current_location'=d.name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_unique_device_code ON workflow_records ((payload->>'device_code')) WHERE kind='devices' AND payload->>'device_code' IS NOT NULL;
