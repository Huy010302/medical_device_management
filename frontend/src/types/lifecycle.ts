export type DeviceStatus =
  | 'tendering'
  | 'approved'
  | 'purchased'
  | 'received'
  | 'operating'
  | 'maintenance'
  | 'maintenance_pending'
  | 'needs_repair'
  | 'repairing'
  | 'awaiting_parts'
  | 'irreparable'
  | 'disposed';

export type TenderStatus = 'planning' | 'open' | 'evaluating' | 'awarded' | 'cancelled';
export type PurchaseStatus = 'pending_contract' | 'contract_signed' | 'delivering' | 'received' | 'completed' | 'cancelled';
export type AcceptanceStatus = 'passed' | 'failed' | 'conditional';
export type LogType = 'routine_check' | 'incident' | 'transfer' | 'calibration';
export type LogResult = 'normal' | 'abnormal' | 'needs_attention';
export type MaintenanceType = 'preventive' | 'corrective' | 'calibration';
export type MaintenanceResult = 'completed' | 'incomplete' | 'needs_repair';
export type RepairStatus =
  | 'reported'
  | 'in_progress'
  | 'awaiting_parts'
  | 'completed'
  | 'irreparable';
export type DisposalMethod = 'auction' | 'destroy' | 'donate' | 'return_vendor';


export interface LookupOption {
  id: string;
  name: string;
  code?: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface DeviceStatusLookup {
  value: DeviceStatus;
  label: string;
  color_class: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface PurchaseStatusLookup {
  value: PurchaseStatus;
  label: string;
  color_class: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
  uploaded_at?: string;
}

export interface CommitteeMember {
  name: string;
  title: string;
  department?: string;
}

export interface ReplacedPart {
  part_name: string;
  quantity: number;
  unit_price: number;
}


export interface TenderingDeviceItem {
  id: string;
  device_ids: string[];
  device_codes: string[];
  name: string;
  category: string;
  category_id?: string | null;
  department_id?: string | null;
  manufacturer: string;
  model: string;
  origin_country: string;
  unit: string;
  quantity: number;
  estimated_unit_value: number;
  notes: string;
}

export interface Device {
  id: string;
  device_code: string;
  name: string;
  category: string;
  category_id?: string | null;
  department_id?: string | null;
  manufacturer: string;
  model: string;
  origin_country: string;
  unit: string;
  current_status: DeviceStatus;
  current_location: string;
  qr_data: string;
  qr_token?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;

  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
}

export interface TenderingRecord {
  id: string;
  device_id: string;
  device_ids?: string[];
  tender_items?: TenderingDeviceItem[];
  tender_code: string;
  tender_name: string;
  estimated_value: number;
  tender_date: string;
  winning_vendor: string;
  winning_bid_value: number;
  tender_status: TenderStatus;
  decision_number: string;
  decision_date: string;
  attachments: Attachment[];
  notes: string;
  created_by?: string;
  created_at: string;
}

export interface PurchaseDeviceItem {
  id: string;
  device_ids: string[];
  device_codes: string[];
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export interface PurchaseRecord {
  id: string;
  device_id: string;
  device_ids?: string[];
  purchase_items?: PurchaseDeviceItem[];
  tendering_record_id?: string;
  purchase_status?: PurchaseStatus;
  contract_number: string;
  contract_date: string;
  vendor_name: string;
  vendor_contact: string;
  unit_price: number;
  quantity: number;
  total_value: number;
  currency: string;
  payment_terms: string;
  delivery_date: string;
  warranty_months: number;
  attachments: Attachment[];
  notes: string;
  created_by?: string;
  created_at: string;
}

export interface ReceptionRecord {
  id: string;
  device_id: string;
  purchase_record_id?: string;
  reception_date: string;
  reception_committee: CommitteeMember[];
  serial_number: string;
  asset_code: string;
  installation_date: string;
  commissioning_date: string;
  warranty_start: string;
  warranty_end: string;
  initial_location: string;
  acceptance_status: AcceptanceStatus;
  attachments: Attachment[];
  notes: string;
  created_by?: string;
  created_at: string;
}

export interface OperationLog {
  id: string;
  device_id: string;
  log_date: string;
  log_type: LogType;
  performed_by: string;
  department: string;
  description: string;
  result: LogResult;
  attachments: Attachment[];
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  device_id: string;
  maintenance_type: MaintenanceType;
  scheduled_date: string;
  actual_date: string;
  performed_by: string;
  service_company: string;
  description: string;
  result: MaintenanceResult;
  cost: number;
  next_maintenance_date: string;
  attachments: Attachment[];
  created_by?: string;
  created_at: string;
}

export interface RepairRecord {
  id: string;
  device_id: string;
  report_date: string;
  reported_by: string;
  fault_description: string;
  repair_start_date: string;
  repair_end_date: string;
  repair_company: string;
  technician: string;
  repair_description: string;
  parts_replaced: ReplacedPart[];
  total_cost: number;
  repair_status: RepairStatus;
  warranty_claim: boolean;
  attachments: Attachment[];
  created_by?: string;
  created_at: string;
}

export type ReplacementPartStatus =
  | 'requested'
  | 'ordered'
  | 'received'
  | 'installed'
  | 'cancelled';

export interface ReplacementPartLog {
  id: string;
  device_id: string;
  repair_record_id?: string;
  replacement_date: string;
  part_name: string;
  part_code: string;
  quantity: number;
  unit_price: number;
  vendor: string;
  reason: string;
  performed_by: string;
  part_status?: ReplacementPartStatus;
  attachments: Attachment[];
  created_at: string;
}

export interface TransferRecord {
  id: string;
  device_id: string;
  transfer_date: string;
  from_location: string;
  to_location: string;
  reason: string;
  approved_by: string;
  decision_number: string;
  attachments: Attachment[];
  created_at: string;
}

export interface DisposalRecord {
  id: string;
  device_id: string;
  disposal_date: string;
  reason: string;
  disposal_method: DisposalMethod;
  disposal_committee: CommitteeMember[];
  book_value: number;
  disposal_value: number;
  decision_number: string;
  decision_date: string;
  attachments: Attachment[];
  notes: string;
  created_by?: string;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}
