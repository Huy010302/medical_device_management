CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(320) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_verified boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar NOT NULL UNIQUE,
    name varchar NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar NOT NULL UNIQUE,
    name varchar NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar NOT NULL UNIQUE,
    name varchar NOT NULL,
    description text
);

CREATE TABLE IF NOT EXISTS device_statuses (
    value varchar PRIMARY KEY,
    label varchar NOT NULL,
    description text
);

CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
    username varchar UNIQUE,
    full_name varchar NOT NULL,
    email varchar NOT NULL UNIQUE,
    role_id uuid NOT NULL REFERENCES roles(id),
    department_id uuid REFERENCES departments(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
    id text PRIMARY KEY,
    device_code varchar NOT NULL UNIQUE,
    name varchar NOT NULL,
    category_id uuid REFERENCES device_categories(id),
    manufacturer varchar,
    model varchar,
    origin_country varchar,
    serial_number varchar,
    asset_code varchar,
    unit varchar,
    current_status varchar REFERENCES device_statuses(value),
    department_id uuid REFERENCES departments(id),
    current_location varchar,
    installation_date date,
    warranty_start date,
    warranty_end date,
    qr_token uuid UNIQUE DEFAULT gen_random_uuid(),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS maintenance_records (
    id text PRIMARY KEY,
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    maintenance_type varchar,
    scheduled_date date,
    actual_date date,
    performed_by varchar,
    service_company varchar,
    description text,
    result varchar,
    cost numeric,
    next_maintenance_date date,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_records (
    id text PRIMARY KEY,
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    report_date date,
    fault_category varchar,
    fault_description text,
    repair_start_date date,
    repair_end_date date,
    technician varchar,
    repair_company varchar,
    total_cost numeric,
    repair_status varchar
);

CREATE TABLE IF NOT EXISTS replacement_parts (
    id text PRIMARY KEY,
    repair_record_id text NOT NULL REFERENCES repair_records(id) ON DELETE CASCADE,
    part_name varchar,
    part_code varchar,
    quantity integer,
    unit_price numeric,
    vendor varchar,
    replacement_date date
);

CREATE TABLE IF NOT EXISTS transfer_records (
    id text PRIMARY KEY,
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    transfer_date date,
    from_location varchar,
    to_location varchar,
    reason text,
    approved_by varchar
);

CREATE TABLE IF NOT EXISTS disposal_records (
    id text PRIMARY KEY,
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    disposal_date date,
    reason text,
    disposal_method varchar,
    book_value numeric,
    disposal_value numeric
);

CREATE TABLE IF NOT EXISTS tendering_records (
    id text PRIMARY KEY,
    tender_code varchar NOT NULL UNIQUE,
    tender_name varchar NOT NULL,
    tender_date date,
    winning_vendor varchar,
    estimated_value numeric,
    tender_status varchar
);

CREATE TABLE IF NOT EXISTS purchase_records (
    id text PRIMARY KEY,
    tender_id text REFERENCES tendering_records(id),
    contract_number varchar,
    vendor_name varchar,
    purchase_date date,
    total_value numeric,
    status varchar
);

CREATE TABLE IF NOT EXISTS reception_records (
    id text PRIMARY KEY,
    device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    purchase_id text REFERENCES purchase_records(id),
    reception_date date,
    installation_date date,
    warranty_start date,
    warranty_end date
);

INSERT INTO roles(code,name,description) VALUES
('admin','Administrator','System administrator'),
('asset_manager','Asset Manager','Medical device and asset management'),
('procurement_officer','Procurement Officer','Procurement and tendering'),
('biomedical_engineer','Biomedical Engineer','Maintenance and repair'),
('clinical_user','Clinical User','Clinical equipment user')
ON CONFLICT (code) DO NOTHING;

INSERT INTO device_statuses(value,label,description) VALUES
('operational','Đang vận hành','Device is operational'),
('maintenance','Đang bảo trì','Device is under maintenance'),
('repair','Đang sửa chữa','Device is under repair'),
('disposed','Đã thanh lý','Device has been disposed'),
('inactive','Ngừng sử dụng','Device is inactive')
ON CONFLICT (value) DO NOTHING;
