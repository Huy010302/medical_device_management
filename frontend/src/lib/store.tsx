import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useAuth } from '@/lib/auth';
import { apiJson, enqueueRecordWrite } from '@/lib/api';
import type {
  Device,
  DeviceStatus,
  TenderingRecord,
  PurchaseRecord,
  PurchaseStatus,
  ReceptionRecord,
  OperationLog,
  MaintenanceRecord,
  RepairRecord,
  RepairStatus,
  ReplacementPartLog,
  TransferRecord,
  DisposalRecord,
  LookupOption,
  DeviceStatusLookup,
  PurchaseStatusLookup,
} from '@/types/lifecycle';
import {
  generateId,
  getPurchaseDeviceIds,
  getTenderDeviceIds,
  STATUS_COLORS,
  statusBadgeClass,
  STATUS_LABELS,
  readableStatusLabel,
  PURCHASE_STATUS_COLORS,
  PURCHASE_STATUS_LABELS,
} from '@/lib/deviceUtils';
interface UpdateDeviceOptions {
  skipAutoWorkflowLog?: boolean;
}

interface StoreState {
  devices: Device[];
  allDevices: Device[];
  tenderingRecords: TenderingRecord[];
  purchaseRecords: PurchaseRecord[];
  receptionRecords: ReceptionRecord[];
  operationLogs: OperationLog[];
  maintenanceRecords: MaintenanceRecord[];
  repairRecords: RepairRecord[];
  replacementParts: ReplacementPartLog[];
  transferRecords: TransferRecord[];
  disposalRecords: DisposalRecord[];
  deviceCategories: LookupOption[];
  departments: LookupOption[];
  deviceStatusOptions: DeviceStatusLookup[];
  purchaseStatusOptions: PurchaseStatusLookup[];
  getDeviceStatusLabel: (status: DeviceStatus) => string;
  getDeviceStatusColor: (status: DeviceStatus) => string;
  getPurchaseStatusLabel: (status: PurchaseStatus) => string;
  getPurchaseStatusColor: (status: PurchaseStatus) => string;
  addDevice: (d: Device) => void;
  updateDevice: (d: Device, options?: UpdateDeviceOptions) => void;
  deleteDevice: (id: string) => void;
  addTenderingRecord: (r: TenderingRecord) => void;
  addTenderingPackage: (r: TenderingRecord, newDevices: Device[]) => void;
  updateTenderingRecord: (r: TenderingRecord) => void;
  addPurchaseRecord: (r: PurchaseRecord) => void;
  updatePurchaseRecord: (r: PurchaseRecord) => void;
  addReceptionRecord: (r: ReceptionRecord) => void;
  addOperationLog: (r: OperationLog) => void;
  addMaintenanceRecord: (r: MaintenanceRecord) => void;
  updateMaintenanceRecord: (r: MaintenanceRecord) => void;
  addRepairRecord: (r: RepairRecord) => void;
  updateRepairRecord: (r: RepairRecord) => void;
  addReplacementPart: (r: ReplacementPartLog) => void;
  updateReplacementPart: (r: ReplacementPartLog) => void;
  addTransferRecord: (r: TransferRecord) => void;
  addDisposalRecord: (r: DisposalRecord) => void;
  getDeviceById: (id: string) => Device | undefined;
}

const StoreContext = createContext<StoreState | null>(null);

type TableName =
  | 'devices'
  | 'tendering_records'
  | 'purchase_records'
  | 'reception_records'
  | 'operation_logs'
  | 'maintenance_records'
  | 'repair_records'
  | 'replacement_parts'
  | 'transfer_records'
  | 'disposal_records';

const DATE_KEYS = new Set([
  'tender_date', 'decision_date', 'contract_date', 'delivery_date', 'reception_date',
  'installation_date', 'commissioning_date', 'warranty_start', 'warranty_end', 'log_date',
  'scheduled_date', 'actual_date', 'next_maintenance_date', 'report_date', 'repair_start_date',
  'repair_end_date', 'replacement_date', 'transfer_date', 'disposal_date', 'deleted_at',
]);

function usePersistentState<T>(_key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  // PostgreSQL is the only source of truth in API demo mode.
  return useState<T>(fallback);
}

function toDbRow<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (value === undefined) return [key, null];
    if (DATE_KEYS.has(key) && value === '') return [key, null];
    return [key, value];
  }));
}

function fromDbRows<T>(rows: unknown[] | null): T[] {
  if (!rows) return [];
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row as T;
    const normalized = Object.fromEntries(Object.entries(row as Record<string, unknown>).map(([key, value]) => [key, value ?? '']));
    return normalized as T;
  });
}


function toLookupOptions(rows: unknown[] | null): LookupOption[] {
  return (rows || [])
    .map(row => row as Partial<LookupOption>)
    .filter(row => typeof row.name === 'string' && row.name.trim())
    .map(row => ({
      id: String(row.id || row.name),
      name: String(row.name).trim(),
      code: row.code ? String(row.code) : undefined,
      description: row.description ? String(row.description) : undefined,
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
      is_active: row.is_active !== false,
    }));
}

function getNormalizedPurchaseStatus(record: PurchaseRecord): PurchaseStatus {
  return record.purchase_status || (record.contract_number ? 'contract_signed' : 'pending_contract');
}

function getDeviceStatusForPurchaseStatus(status: PurchaseStatus): DeviceStatus | null {
  if (status === 'pending_contract') return null;
  if (status === 'contract_signed' || status === 'delivering') return 'purchased';
  if (status === 'received' || status === 'completed') return 'received';
  if (status === 'cancelled') return 'approved';
  return null;
}

function getImmediateDeviceStatusForRepairStatus(status: RepairStatus): DeviceStatus | null {
  if (status === 'reported') return 'needs_repair';
  if (status === 'in_progress') return 'repairing';
  if (status === 'awaiting_parts') return 'awaiting_parts';
  if (status === 'irreparable') return 'irreparable';
  return null;
}

function buildPendingPurchaseFromTender(tender: TenderingRecord, relatedDevices: Device[], now: string, createdBy?: string): PurchaseRecord {
  const deviceIds = getTenderDeviceIds(tender);
  const totalValue = Number(tender.winning_bid_value) || Number(tender.estimated_value) || 0;
  const quantity = Math.max(1, deviceIds.length);

  const purchaseItems = tender.tender_items?.map(item => ({
    id: generateId(),
    device_ids: item.device_ids,
    device_codes: item.device_codes,
    name: item.name,
    category: item.category,
    manufacturer: item.manufacturer,
    model: item.model,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.estimated_unit_value,
  })) || relatedDevices.map(device => ({
    id: generateId(),
    device_ids: [device.id],
    device_codes: [device.device_code],
    name: device.name,
    category: device.category,
    manufacturer: device.manufacturer,
    model: device.model,
    unit: device.unit,
    quantity: 1,
    unit_price: totalValue / quantity,
  }));

  return {
    id: generateId(),
    device_id: deviceIds[0] || '',
    device_ids: deviceIds,
    purchase_items: purchaseItems,
    tendering_record_id: tender.id,
    purchase_status: 'pending_contract',
    contract_number: '',
    contract_date: '',
    vendor_name: tender.winning_vendor || '',
    vendor_contact: '',
    unit_price: totalValue / quantity,
    quantity,
    total_value: totalValue,
    currency: 'VND',
    payment_terms: '',
    delivery_date: '',
    warranty_months: 12,
    attachments: [],
    notes: `Tự tạo từ gói thầu ${tender.tender_code || tender.tender_name}. Chờ ký hợp đồng mua sắm.`,
    created_by: createdBy,
    created_at: now,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { can, currentUser } = useAuth();
  const remoteDbEnabled = Boolean(currentUser && currentUser.role !== 'pending');

  const [devices, setDevices] = usePersistentState<Device[]>('mdlm:devices', []);
  const [tenderingRecords, setTenderingRecords] = usePersistentState<TenderingRecord[]>('mdlm:tenderingRecords', []);
  const [purchaseRecords, setPurchaseRecords] = usePersistentState<PurchaseRecord[]>('mdlm:purchaseRecords', []);
  const [receptionRecords, setReceptionRecords] = usePersistentState<ReceptionRecord[]>('mdlm:receptionRecords', []);
  const [operationLogs, setOperationLogs] = usePersistentState<OperationLog[]>('mdlm:operationLogs', []);
  const [maintenanceRecords, setMaintenanceRecords] = usePersistentState<MaintenanceRecord[]>('mdlm:maintenanceRecords', []);
  const [repairRecords, setRepairRecords] = usePersistentState<RepairRecord[]>('mdlm:repairRecords', []);
  const [replacementParts, setReplacementParts] = usePersistentState<ReplacementPartLog[]>('mdlm:replacementParts', []);
  const [transferRecords, setTransferRecords] = usePersistentState<TransferRecord[]>('mdlm:transferRecords', []);
  const [disposalRecords, setDisposalRecords] = usePersistentState<DisposalRecord[]>('mdlm:disposalRecords', []);
  const [deviceCategories, setDeviceCategories] = usePersistentState<LookupOption[]>('mdlm:deviceCategories', []);
  const [departments, setDepartments] = usePersistentState<LookupOption[]>('mdlm:departments', []);
  const [dbDeviceStatuses, setDbDeviceStatuses] = usePersistentState<DeviceStatusLookup[]>('mdlm:deviceStatuses', []);
  const [masterRevision,setMasterRevision] = useState(0);
  useEffect(()=>{const onChange=()=>setMasterRevision(n=>n+1);window.addEventListener('mdlm:master-updated',onChange);return()=>window.removeEventListener('mdlm:master-updated',onChange);},[]);
  const [dbPurchaseStatuses] = usePersistentState<PurchaseStatusLookup[]>('mdlm:purchaseStatuses', []);

  useEffect(() => {
    const onPage = (event: Event) => {
      const {path,items} = (event as CustomEvent<{path:string;items: {id:string}[]}>).detail;
      const merge = <T extends {id:string}>(previous:T[], incoming:T[]) => {
        const all = new Map(previous.map(item=>[item.id,item]));
        incoming.forEach(item=>all.set(item.id,item));
        return [...all.values()].slice(-300);
      };
      if(path==='/devices') setDevices(prev=>merge(prev,items as Device[]));
      if(path==='/tendering') setTenderingRecords(prev=>merge(prev,items as TenderingRecord[]));
      if(path==='/purchases') setPurchaseRecords(prev=>merge(prev,items as PurchaseRecord[]));
    };
    window.addEventListener('mdlm:page-loaded',onPage);
    return () => window.removeEventListener('mdlm:page-loaded',onPage);
  },[]);

  const logRemoteError = useCallback((action: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`API ${action} failed:`, error);
    window.dispatchEvent(new CustomEvent('mdlm:api-error', { detail: `${action}: ${message}. Dữ liệu có thể chưa được lưu; tải lại trang để đồng bộ.` }));
  }, []);

  const upsertRemote = useCallback(async <T extends Record<string, unknown>>(table: TableName, rows: T | T[]) => {
    if (!remoteDbEnabled) return;
    try {
      for (const row of (Array.isArray(rows) ? rows : [rows])) {
        await enqueueRecordWrite(() => apiJson(`/records/${table}/${encodeURIComponent(String(row.id))}`, {
          method: 'PUT', body: JSON.stringify({ payload: toDbRow(row) }),
        }));
        window.dispatchEvent(new Event('mdlm:record-saved'));
      }
    } catch (error) { logRemoteError(`save ${table}`, error); }
  }, [logRemoteError, remoteDbEnabled]);

  const updateRemote = useCallback(async <T extends { id: string } & Record<string, unknown>>(table: TableName, row: T) => {
    await upsertRemote(table, row);
  }, [upsertRemote]);

  const requirePermission = useCallback((allowed: boolean, message: string) => {
    if (!allowed) throw new Error(message);
  }, []);

  const stampCreatedBy = useCallback(<T extends { created_by?: string }>(record: T): T => ({
    ...record,
    created_by: record.created_by || currentUser?.id,
  }), [currentUser]);

  useEffect(() => {
    if (!remoteDbEnabled) return;
    let active = true;
    const loadRemoteData = async () => {
      try {
        const tables: TableName[] = [
          'devices', 'tendering_records', 'purchase_records', 'reception_records',
          'operation_logs', 'maintenance_records', 'repair_records', 'replacement_parts',
          'transfer_records', 'disposal_records',
        ];
        const results = await Promise.all(tables.map(table => apiJson<unknown[]>(`/records/${table}`)));
        if (!active) return;
        setDevices(fromDbRows<Device>(results[0]));
        setTenderingRecords(fromDbRows<TenderingRecord>(results[1]));
        setPurchaseRecords(fromDbRows<PurchaseRecord>(results[2]));
        setReceptionRecords(fromDbRows<ReceptionRecord>(results[3]));
        setOperationLogs(fromDbRows<OperationLog>(results[4]));
        setMaintenanceRecords(fromDbRows<MaintenanceRecord>(results[5]));
        setRepairRecords(fromDbRows<RepairRecord>(results[6]));
        setReplacementParts(fromDbRows<ReplacementPartLog>(results[7]));
        setTransferRecords(fromDbRows<TransferRecord>(results[8]));
        setDisposalRecords(fromDbRows<DisposalRecord>(results[9]));
        const lookup = await Promise.allSettled([
          apiJson<unknown[]>('/device-categories'), apiJson<unknown[]>('/departments'),
        ]);
        if (!active) return;
        if (lookup[0].status === 'fulfilled') setDeviceCategories(toLookupOptions(lookup[0].value));
        if (lookup[1].status === 'fulfilled') setDepartments(toLookupOptions(lookup[1].value));
        const statuses = await apiJson<DeviceStatusLookup[]>('/device-statuses');
        if (active) setDbDeviceStatuses(statuses);
      } catch (error) { if (active) logRemoteError('load records', error); }
    };
    void loadRemoteData();
    return () => { active = false; };
  }, [remoteDbEnabled, currentUser?.id, logRemoteError, masterRevision]);

  const addDevice = useCallback((d: Device) => {
    requirePermission(can('device:create'), 'Bạn không có quyền thêm thiết bị.');
    const nextDevice = {
      ...d,
      created_by: d.created_by || currentUser?.id,
      updated_by: currentUser?.id,
    };
    setDevices(prev => [...prev, nextDevice]);
    void upsertRemote('devices', nextDevice as unknown as Record<string, unknown>);
  }, [can, currentUser, requirePermission, setDevices, upsertRemote]);

  const updateDevice = useCallback((d: Device, options?: UpdateDeviceOptions) => {
    requirePermission(can('device:update'), 'Bạn không có quyền cập nhật thiết bị.');

    const now = new Date().toISOString();
    const previousDevice = devices.find(x => x.id === d.id);
    const nextDevice = {
      ...d,
      updated_at: now,
      updated_by: currentUser?.id,
    };
    const statusChanged = Boolean(previousDevice && previousDevice.current_status !== d.current_status);

    if (statusChanged && !options?.skipAutoWorkflowLog) {
      throw new Error('Không đổi trạng thái trực tiếp trong form thiết bị. Hãy dùng đúng quy trình nghiệp vụ.');
    }

    setDevices(prev => prev.map(x => x.id === d.id ? nextDevice : x));
    void updateRemote('devices', nextDevice as unknown as Device & Record<string, unknown>);
  }, [can, currentUser, devices, requirePermission, setDevices, updateRemote]);

  const deleteDevice = useCallback((id: string) => {
    requirePermission(can('device:delete'), 'Bạn không có quyền xoá thiết bị.');
    const now = new Date().toISOString();
    setDevices(prev => prev.map(x => {
      if (x.id !== id) return x;
      const deletedDevice = { ...x, deleted_at: now, updated_at: now };
      void updateRemote('devices', deletedDevice as unknown as Device & Record<string, unknown>);
      return deletedDevice;
    }));
  }, [can, requirePermission, setDevices, updateRemote]);

  const getDeviceById = useCallback((id: string) => devices.find(d => d.id === id), [devices]);

  const addTenderingRecord = useCallback((r: TenderingRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm hồ sơ đấu thầu.');
    const stampedRecord = stampCreatedBy(r);
    setTenderingRecords(prev => [...prev, stampedRecord]);
    void upsertRemote('tendering_records', stampedRecord as unknown as Record<string, unknown>);

    if (r.tender_status === 'awarded') {
      const now = new Date().toISOString();
      const relatedDeviceIds = getTenderDeviceIds(r);
      const relatedDevices = devices.filter(device => relatedDeviceIds.includes(device.id));
      const pendingPurchase = buildPendingPurchaseFromTender(stampedRecord, relatedDevices, now, currentUser?.email);
      setPurchaseRecords(prev => prev.some(p => p.tendering_record_id === r.id) ? prev : [...prev, pendingPurchase]);
      void upsertRemote('purchase_records', pendingPurchase as unknown as Record<string, unknown>);
    }
  }, [can, currentUser, devices, requirePermission, setPurchaseRecords, setTenderingRecords, stampCreatedBy, upsertRemote]);

  const addTenderingPackage = useCallback((r: TenderingRecord, newDevices: Device[]) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm hồ sơ đấu thầu.');
    requirePermission(can('device:create'), 'Bạn không có quyền tạo thiết bị mới từ gói thầu.');

    const createdBy = currentUser?.email;
    const stampedDevices = newDevices.map(device => ({ ...device, created_by: device.created_by || createdBy }));
    const stampedRecord = stampCreatedBy(r);

    setDevices(prev => [...prev, ...stampedDevices]);
    setTenderingRecords(prev => [...prev, stampedRecord]);
    void upsertRemote('devices', stampedDevices as unknown as Record<string, unknown>[]);
    void upsertRemote('tendering_records', stampedRecord as unknown as Record<string, unknown>);

    if (r.tender_status === 'awarded') {
      const now = new Date().toISOString();
      const pendingPurchase = buildPendingPurchaseFromTender(stampedRecord, stampedDevices, now, createdBy);
      setPurchaseRecords(prev => prev.some(p => p.tendering_record_id === r.id) ? prev : [...prev, pendingPurchase]);
      void upsertRemote('purchase_records', pendingPurchase as unknown as Record<string, unknown>);
    }
  }, [can, currentUser, requirePermission, setDevices, setPurchaseRecords, setTenderingRecords, stampCreatedBy, upsertRemote]);

  const updateTenderingRecord = useCallback((r: TenderingRecord) => {
    requirePermission(can('workflow:update'), 'Bạn không có quyền cập nhật hồ sơ đấu thầu.');

    const now = new Date().toISOString();
    const relatedDeviceIds = getTenderDeviceIds(r);
    const nextDeviceStatus: DeviceStatus = r.tender_status === 'awarded' ? 'approved' : 'tendering';
    const tenderManagedStatuses: DeviceStatus[] = ['tendering', 'approved'];
    const nextTender = { ...r, created_by: r.created_by || currentUser?.email, created_at: r.created_at || now };

    setTenderingRecords(prev => prev.map(record => record.id === r.id ? { ...record, ...nextTender, created_by: record.created_by || nextTender.created_by, created_at: record.created_at || nextTender.created_at } : record));
    void updateRemote('tendering_records', nextTender as unknown as TenderingRecord & Record<string, unknown>);

    setDevices(prev => {
      const changedDevices: Device[] = [];
      const nextDevices = prev.map(device => {
        if (!relatedDeviceIds.includes(device.id)) return device;

        if (r.tender_status === 'cancelled') {
          if (!tenderManagedStatuses.includes(device.current_status)) return device;
          const existingNotes = device.notes || '';
          const cancelledNote = existingNotes.includes('Gói thầu đã hủy') ? '' : `\nGói thầu ${r.tender_code || r.tender_name} đã hủy, thiết bị được xóa khỏi danh sách quản lý.`;
          const nextDevice = {
            ...device,
            current_status: 'tendering' as DeviceStatus,
            notes: `${existingNotes}${cancelledNote}`.trim(),
            deleted_at: device.deleted_at || now,
            updated_at: now,
          };
          changedDevices.push(nextDevice);
          return nextDevice;
        }

        if (!tenderManagedStatuses.includes(device.current_status)) return device;
        const nextDevice = { ...device, current_status: nextDeviceStatus, deleted_at: null, updated_at: now };
        changedDevices.push(nextDevice);
        return nextDevice;
      });
      if (changedDevices.length) void upsertRemote('devices', changedDevices as unknown as Record<string, unknown>[]);
      return nextDevices;
    });

    if (r.tender_status === 'awarded') {
      const relatedDevices = devices.filter(device => relatedDeviceIds.includes(device.id));
      const pendingPurchase = buildPendingPurchaseFromTender({ ...r, created_by: r.created_by || currentUser?.email }, relatedDevices, now, currentUser?.email);

      setPurchaseRecords(prev => {
        const existing = prev.find(purchase => purchase.tendering_record_id === r.id);
        if (!existing) {
          void upsertRemote('purchase_records', pendingPurchase as unknown as Record<string, unknown>);
          return [...prev, pendingPurchase];
        }

        const nextPurchases = prev.map(purchase => {
          if (purchase.tendering_record_id !== r.id) return purchase;
          if (getNormalizedPurchaseStatus(purchase) !== 'pending_contract') return purchase;
          const updatedPurchase = {
            ...purchase,
            vendor_name: r.winning_vendor || purchase.vendor_name,
            total_value: Number(r.winning_bid_value) || purchase.total_value || Number(r.estimated_value) || 0,
            unit_price: relatedDeviceIds.length ? (Number(r.winning_bid_value) || Number(r.estimated_value) || 0) / relatedDeviceIds.length : purchase.unit_price,
            quantity: relatedDeviceIds.length || purchase.quantity,
            notes: purchase.notes || pendingPurchase.notes,
          };
          void updateRemote('purchase_records', updatedPurchase as unknown as PurchaseRecord & Record<string, unknown>);
          return updatedPurchase;
        });
        return nextPurchases;
      });
    }

    if (r.tender_status === 'cancelled') {
      setPurchaseRecords(prev => {
        const remaining = prev.filter(purchase => !(purchase.tendering_record_id === r.id && getNormalizedPurchaseStatus(purchase) === 'pending_contract'));
        return remaining;
      });
    }
  }, [can, currentUser, devices, requirePermission, setDevices, setPurchaseRecords, setTenderingRecords, updateRemote, upsertRemote]);

  const applyPurchaseStatusToDevices = useCallback((record: PurchaseRecord) => {
    const nextStatus = getDeviceStatusForPurchaseStatus(getNormalizedPurchaseStatus(record));
    if (!nextStatus) return;

    const relatedDeviceIds = getPurchaseDeviceIds(record);
    setDevices(prev => {
      const changedDevices: Device[] = [];
      const nextDevices = prev.map(device => {
        if (!relatedDeviceIds.includes(device.id)) return device;
        if (nextStatus === 'approved' && !['approved', 'purchased'].includes(device.current_status)) return device;
        if (nextStatus === 'purchased' && !['tendering', 'approved', 'purchased'].includes(device.current_status)) return device;
        if (nextStatus === 'received' && !['approved', 'purchased', 'received'].includes(device.current_status)) return device;
        const nextDevice = { ...device, current_status: nextStatus, updated_at: new Date().toISOString() };
        changedDevices.push(nextDevice);
        return nextDevice;
      });
      if (changedDevices.length) void upsertRemote('devices', changedDevices as unknown as Record<string, unknown>[]);
      return nextDevices;
    });
  }, [setDevices, upsertRemote]);

  const addPurchaseRecord = useCallback((r: PurchaseRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm hồ sơ mua sắm.');
    const stampedRecord = stampCreatedBy(r);
    setPurchaseRecords(prev => [...prev, stampedRecord]);
    void upsertRemote('purchase_records', stampedRecord as unknown as Record<string, unknown>);
    applyPurchaseStatusToDevices(stampedRecord);
  }, [applyPurchaseStatusToDevices, can, requirePermission, setPurchaseRecords, stampCreatedBy, upsertRemote]);

  const updatePurchaseRecord = useCallback((r: PurchaseRecord) => {
    requirePermission(can('workflow:update'), 'Bạn không có quyền cập nhật hồ sơ mua sắm.');
    const stampedRecord = stampCreatedBy(r);
    setPurchaseRecords(prev => prev.map(record => record.id === r.id ? { ...record, ...stampedRecord } : record));
    void updateRemote('purchase_records', stampedRecord as unknown as PurchaseRecord & Record<string, unknown>);
    applyPurchaseStatusToDevices(r);
  }, [applyPurchaseStatusToDevices, can, requirePermission, setPurchaseRecords, stampCreatedBy, updateRemote]);

  const addReceptionRecord = useCallback((r: ReceptionRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm hồ sơ tiếp nhận.');

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const stampedRecord = stampCreatedBy(r);
    const nextReceptionRecords = [...receptionRecords, stampedRecord];

    setReceptionRecords(nextReceptionRecords);
    void upsertRemote('reception_records', stampedRecord as unknown as Record<string, unknown>);

    const nextDeviceStatus: DeviceStatus = stampedRecord.acceptance_status !== 'failed' && stampedRecord.commissioning_date
      ? 'operating'
      : 'received';

    setDevices(prev => {
      const changedDevices: Device[] = [];
      const nextDevices = prev.map(device => {
        if (device.id !== stampedRecord.device_id || device.current_status === 'disposed') return device;

        const noteLine = stampedRecord.acceptance_status === 'failed'
          ? `[${today}] Nghiệm thu không đạt. Thiết bị giữ trạng thái Đã tiếp nhận để tiếp tục xử lý.`
          : stampedRecord.commissioning_date
            ? `[${today}] Nghiệm thu đạt và đã đưa vào sử dụng. Thiết bị chuyển sang Đang vận hành.`
            : `[${today}] Đã tiếp nhận/nghiệm thu. Chưa có ngày đưa vào sử dụng nên thiết bị giữ trạng thái Đã tiếp nhận.`;

        const nextDevice: Device = {
          ...device,
          current_status: nextDeviceStatus,
          current_location: stampedRecord.initial_location || device.current_location,
          notes: `${device.notes || ''}
${noteLine}`.trim(),
          updated_at: now,
          updated_by: currentUser?.id,
        };
        changedDevices.push(nextDevice);
        return nextDevice;
      });

      if (changedDevices.length) void upsertRemote('devices', changedDevices as unknown as Record<string, unknown>[]);
      return nextDevices;
    });

    if (stampedRecord.purchase_record_id) {
      setPurchaseRecords(prev => prev.map(purchase => {
        if (purchase.id !== stampedRecord.purchase_record_id) return purchase;
        const status = getNormalizedPurchaseStatus(purchase);
        if (status === 'completed' || status === 'cancelled') return purchase;

        const purchaseDeviceIds = getPurchaseDeviceIds(purchase);
        const receivedDeviceIds = new Set(
          nextReceptionRecords
            .filter(record => record.purchase_record_id === purchase.id)
            .map(record => record.device_id)
        );
        const allPurchasedDevicesReceived = purchaseDeviceIds.length > 0 && purchaseDeviceIds.every(id => receivedDeviceIds.has(id));
        if (!allPurchasedDevicesReceived) return purchase;

        const nextPurchase: PurchaseRecord = {
          ...purchase,
          purchase_status: 'received',
          delivery_date: purchase.delivery_date || stampedRecord.reception_date,
        };
        void updateRemote('purchase_records', nextPurchase as unknown as PurchaseRecord & Record<string, unknown>);
        return nextPurchase;
      }));
    }
  }, [
    can,
    currentUser?.id,
    receptionRecords,
    requirePermission,
    setDevices,
    setPurchaseRecords,
    setReceptionRecords,
    stampCreatedBy,
    updateRemote,
    upsertRemote,
  ]);

  const addOperationLog = useCallback((r: OperationLog) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm nhật ký vận hành.');
    setOperationLogs(prev => [...prev, r]);
    void upsertRemote('operation_logs', r as unknown as Record<string, unknown>);
  }, [can, requirePermission, setOperationLogs, upsertRemote]);

  const updateDeviceStatusFromLifecycle = useCallback((
    deviceId: string,
    nextStatus: DeviceStatus,
    note?: string
  ) => {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    setDevices(prev => prev.map(device => {
      if (device.id !== deviceId) return device;
      if (device.current_status === 'disposed') return device;

      const noteLine = note ? `\n[${today}] ${note}` : '';
      const nextDevice: Device = {
        ...device,
        current_status: nextStatus,
        notes: `${device.notes || ''}${noteLine}`.trim(),
        updated_at: now,
        updated_by: currentUser?.id,
      };

      void updateRemote('devices', nextDevice as unknown as Device & Record<string, unknown>);
      return nextDevice;
    }));
  }, [currentUser?.id, setDevices, updateRemote]);

  const hasOpenRepairForDevice = useCallback((
    deviceId: string,
    records: RepairRecord[] = repairRecords
  ) => (
    records.some(record =>
      record.device_id === deviceId &&
      !['completed', 'irreparable'].includes(record.repair_status)
    )
  ), [repairRecords]);

  const hasOpenMaintenanceForDevice = useCallback((
    deviceId: string,
    records: MaintenanceRecord[] = maintenanceRecords
  ) => (
    records.some(record =>
      record.device_id === deviceId &&
      record.result !== 'completed'
    )
  ), [maintenanceRecords]);

  const hasWaitingPartsForDevice = useCallback((
    deviceId: string,
    records: ReplacementPartLog[] = replacementParts
  ) => {
    const latestByPart = new Map<string, ReplacementPartLog>();

    records
      .filter(record => record.device_id === deviceId)
      .forEach(record => {
        const key = [
          record.repair_record_id || 'no-repair',
          record.part_code || record.part_name,
        ].join('|');

        const existing = latestByPart.get(key);
        const currentTime = new Date(record.created_at || record.replacement_date || '').getTime();
        const existingTime = existing ? new Date(existing.created_at || existing.replacement_date || '').getTime() : -1;

        if (!existing || currentTime >= existingTime) {
          latestByPart.set(key, record);
        }
      });

    return Array.from(latestByPart.values()).some(record =>
      ['requested', 'ordered', 'received'].includes(record.part_status || 'installed')
    );
  }, [replacementParts]);

  const resolveDeviceStatusAfterClosure = useCallback((
    deviceId: string,
    nextMaintenanceRecords: MaintenanceRecord[] = maintenanceRecords,
    nextRepairRecords: RepairRecord[] = repairRecords,
    nextReplacementParts: ReplacementPartLog[] = replacementParts
  ): DeviceStatus => {
    if (hasWaitingPartsForDevice(deviceId, nextReplacementParts)) return 'awaiting_parts';
    if (hasOpenRepairForDevice(deviceId, nextRepairRecords)) return 'repairing';
    if (hasOpenMaintenanceForDevice(deviceId, nextMaintenanceRecords)) return 'maintenance_pending';
    return 'operating';
  }, [
    maintenanceRecords,
    repairRecords,
    replacementParts,
    hasWaitingPartsForDevice,
    hasOpenRepairForDevice,
    hasOpenMaintenanceForDevice,
  ]);

  const addMaintenanceRecord = useCallback((r: MaintenanceRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm phiếu bảo trì.');

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const stampedRecord = stampCreatedBy(r);

    setMaintenanceRecords(prev => [...prev, stampedRecord]);
    void upsertRemote('maintenance_records', stampedRecord as unknown as Record<string, unknown>);

    if (stampedRecord.result === 'completed') {
      const nextStatus = resolveDeviceStatusAfterClosure(
        stampedRecord.device_id,
        [...maintenanceRecords, stampedRecord],
        repairRecords,
        replacementParts
      );

      updateDeviceStatusFromLifecycle(
        stampedRecord.device_id,
        nextStatus,
        'Bảo trì hoàn thành. Hệ thống cập nhật trạng thái thiết bị theo các phiếu còn mở.'
      );

      return;
    }

    if (stampedRecord.result === 'incomplete') {
      updateDeviceStatusFromLifecycle(
        stampedRecord.device_id,
        'maintenance_pending',
        'Bảo trì chưa hoàn thành. Thiết bị cần được kiểm tra/hoàn tất bảo trì trước khi xác nhận vận hành.'
      );

      return;
    }

    if (stampedRecord.result === 'needs_repair') {
      updateDeviceStatusFromLifecycle(
        stampedRecord.device_id,
        'needs_repair',
        'Bảo trì phát hiện lỗi. Hệ thống chuyển thiết bị sang trạng thái Cần sửa chữa.'
      );

      const alreadyHasOpenRepair = hasOpenRepairForDevice(stampedRecord.device_id);

      if (!alreadyHasOpenRepair) {
        const autoRepair = stampCreatedBy<RepairRecord>({
          id: generateId(),
          device_id: stampedRecord.device_id,
          report_date: stampedRecord.actual_date || today,
          reported_by: stampedRecord.performed_by || currentUser?.name || currentUser?.email || '',
          fault_description: `Tự tạo từ phiếu bảo trì: ${stampedRecord.description || 'Bảo trì phát hiện thiết bị cần sửa chữa.'}`,
          repair_start_date: '',
          repair_end_date: '',
          repair_company: stampedRecord.service_company || '',
          technician: '',
          repair_description: '',
          parts_replaced: [],
          total_cost: 0,
          repair_status: 'reported',
          warranty_claim: false,
          attachments: [],
          created_at: now,
        });

        setRepairRecords(prev => [...prev, autoRepair]);
        void upsertRemote('repair_records', autoRepair as unknown as Record<string, unknown>);
      }
    }
  }, [
    can,
    currentUser,
    maintenanceRecords,
    repairRecords,
    replacementParts,
    requirePermission,
    resolveDeviceStatusAfterClosure,
    hasOpenRepairForDevice,
    setMaintenanceRecords,
    setRepairRecords,
    stampCreatedBy,
    updateDeviceStatusFromLifecycle,
    upsertRemote,
  ]);

  const syncDeviceStatusFromMaintenance = useCallback((
    maintenance: MaintenanceRecord,
    nextMaintenanceRecords: MaintenanceRecord[]
  ) => {
    if (maintenance.result === 'completed') {
      const nextStatus = resolveDeviceStatusAfterClosure(
        maintenance.device_id,
        nextMaintenanceRecords,
        repairRecords,
        replacementParts
      );

      updateDeviceStatusFromLifecycle(
        maintenance.device_id,
        nextStatus,
        'Phiếu bảo trì hoàn thành. Hệ thống cập nhật trạng thái thiết bị theo các phiếu còn mở.'
      );
      return;
    }

    if (maintenance.result === 'incomplete') {
      updateDeviceStatusFromLifecycle(
        maintenance.device_id,
        'maintenance_pending',
        'Phiếu bảo trì được cập nhật là chưa hoàn thành. Thiết bị cần tiếp tục xử lý.'
      );
      return;
    }

    if (maintenance.result === 'needs_repair') {
      updateDeviceStatusFromLifecycle(
        maintenance.device_id,
        'needs_repair',
        'Phiếu bảo trì phát hiện lỗi. Hệ thống chuyển thiết bị sang trạng thái Cần sửa chữa.'
      );

      if (!hasOpenRepairForDevice(maintenance.device_id)) {
        const now = new Date().toISOString();
        const today = now.slice(0, 10);
        const autoRepair = stampCreatedBy<RepairRecord>({
          id: generateId(),
          device_id: maintenance.device_id,
          report_date: maintenance.actual_date || today,
          reported_by: maintenance.performed_by || currentUser?.name || currentUser?.email || '',
          fault_description: `Tự tạo từ phiếu bảo trì: ${maintenance.description || 'Bảo trì phát hiện thiết bị cần sửa chữa.'}`,
          repair_start_date: '',
          repair_end_date: '',
          repair_company: maintenance.service_company || '',
          technician: '',
          repair_description: '',
          parts_replaced: [],
          total_cost: 0,
          repair_status: 'reported',
          warranty_claim: false,
          attachments: [],
          created_at: now,
        });
        setRepairRecords(prev => [...prev, autoRepair]);
        void upsertRemote('repair_records', autoRepair as unknown as Record<string, unknown>);
      }
    }
  }, [
    currentUser,
    repairRecords,
    replacementParts,
    resolveDeviceStatusAfterClosure,
    hasOpenRepairForDevice,
    setRepairRecords,
    stampCreatedBy,
    updateDeviceStatusFromLifecycle,
    upsertRemote,
  ]);

  const updateMaintenanceRecord = useCallback((r: MaintenanceRecord) => {
    requirePermission(can('workflow:update'), 'Bạn không có quyền cập nhật phiếu bảo trì.');

    const stampedRecord = stampCreatedBy(r);
    const today = new Date().toISOString().slice(0, 10);
    const normalizedRecord: MaintenanceRecord = {
      ...stampedRecord,
      actual_date: stampedRecord.result === 'completed'
        ? (stampedRecord.actual_date || today)
        : stampedRecord.actual_date,
    };
    const nextMaintenanceRecords = maintenanceRecords.map(record => (
      record.id === normalizedRecord.id ? { ...record, ...normalizedRecord } : record
    ));

    setMaintenanceRecords(nextMaintenanceRecords);
    void updateRemote('maintenance_records', normalizedRecord as unknown as MaintenanceRecord & Record<string, unknown>);
    syncDeviceStatusFromMaintenance(normalizedRecord, nextMaintenanceRecords);
  }, [
    can,
    maintenanceRecords,
    requirePermission,
    setMaintenanceRecords,
    stampCreatedBy,
    syncDeviceStatusFromMaintenance,
    updateRemote,
  ]);

  const syncDeviceStatusFromRepair = useCallback((
    repair: RepairRecord,
    nextRepairRecords: RepairRecord[]
  ) => {
    const immediateStatus = getImmediateDeviceStatusForRepairStatus(repair.repair_status);

    if (immediateStatus) {
      const noteByStatus: Record<Exclude<RepairStatus, 'completed'>, string> = {
        reported: 'Đã ghi nhận phiếu báo hỏng/sửa chữa. Thiết bị cần được xử lý.',
        in_progress: 'Thiết bị đang trong quá trình sửa chữa.',
        awaiting_parts: 'Thiết bị đang chờ linh kiện để tiếp tục sửa chữa.',
        irreparable: 'Thiết bị được đánh giá không sửa được. Cần xem xét thanh lý hoặc thay thế.',
      };

      updateDeviceStatusFromLifecycle(
        repair.device_id,
        immediateStatus,
        noteByStatus[repair.repair_status as Exclude<RepairStatus, 'completed'>]
      );
      return;
    }

    const nextStatus = resolveDeviceStatusAfterClosure(
      repair.device_id,
      maintenanceRecords,
      nextRepairRecords,
      replacementParts
    );

    updateDeviceStatusFromLifecycle(
      repair.device_id,
      nextStatus,
      'Phiếu sửa chữa hoàn thành. Hệ thống cập nhật trạng thái thiết bị theo các phiếu còn mở.'
    );
  }, [maintenanceRecords, replacementParts, resolveDeviceStatusAfterClosure, updateDeviceStatusFromLifecycle]);

  const addRepairRecord = useCallback((r: RepairRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm phiếu sửa chữa.');

    const stampedRecord = stampCreatedBy(r);
    const nextRepairRecords = [...repairRecords, stampedRecord];

    setRepairRecords(prev => [...prev, stampedRecord]);
    void upsertRemote('repair_records', stampedRecord as unknown as Record<string, unknown>);
    syncDeviceStatusFromRepair(stampedRecord, nextRepairRecords);
  }, [
    can,
    repairRecords,
    requirePermission,
    setRepairRecords,
    stampCreatedBy,
    syncDeviceStatusFromRepair,
    upsertRemote,
  ]);

  const updateRepairRecord = useCallback((r: RepairRecord) => {
    requirePermission(can('workflow:update'), 'Bạn không có quyền cập nhật phiếu sửa chữa.');

    const stampedRecord = stampCreatedBy(r);
    const nextRepairRecords = repairRecords.map(record => (
      record.id === stampedRecord.id ? { ...record, ...stampedRecord } : record
    ));

    setRepairRecords(nextRepairRecords);
    void updateRemote('repair_records', stampedRecord as unknown as RepairRecord & Record<string, unknown>);
    syncDeviceStatusFromRepair(stampedRecord, nextRepairRecords);
  }, [
    can,
    repairRecords,
    requirePermission,
    setRepairRecords,
    stampCreatedBy,
    syncDeviceStatusFromRepair,
    updateRemote,
  ]);
  const addReplacementPart = useCallback((r: ReplacementPartLog) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm nhật ký thay thế linh kiện.');

    const nextRecord: ReplacementPartLog = {
      ...r,
      part_status: r.part_status || 'installed',
    };

    const nextReplacementParts = [...replacementParts, nextRecord];

    setReplacementParts(prev => [...prev, nextRecord]);
    void upsertRemote('replacement_parts', nextRecord as unknown as Record<string, unknown>);

    if (['requested', 'ordered', 'received'].includes(nextRecord.part_status || 'installed')) {
      updateDeviceStatusFromLifecycle(
        nextRecord.device_id,
        'awaiting_parts',
        'Thiết bị đang chờ linh kiện/chi phí thay thế trước khi hoàn tất sửa chữa.'
      );
      return;
    }

    if (nextRecord.part_status === 'installed') {
      const nextStatus = resolveDeviceStatusAfterClosure(
        nextRecord.device_id,
        maintenanceRecords,
        repairRecords,
        nextReplacementParts
      );

      updateDeviceStatusFromLifecycle(
        nextRecord.device_id,
        nextStatus,
        'Đã ghi nhận linh kiện được lắp/thay thế. Hệ thống cập nhật trạng thái theo các phiếu còn mở.'
      );
    }
  }, [
    can,
    maintenanceRecords,
    repairRecords,
    replacementParts,
    requirePermission,
    resolveDeviceStatusAfterClosure,
    setReplacementParts,
    updateDeviceStatusFromLifecycle,
    upsertRemote,
  ]);

  const updateReplacementPart = useCallback((r: ReplacementPartLog) => {
    requirePermission(can('workflow:update'), 'Bạn không có quyền cập nhật linh kiện.');

    const nextRecord: ReplacementPartLog = {
      ...r,
      part_status: r.part_status || 'installed',
    };

    const nextReplacementParts = replacementParts.map(record =>
      record.id === nextRecord.id ? { ...record, ...nextRecord } : record
    );

    setReplacementParts(nextReplacementParts);
    void updateRemote('replacement_parts', nextRecord as unknown as ReplacementPartLog & Record<string, unknown>);

    const nextStatus = resolveDeviceStatusAfterClosure(
      nextRecord.device_id,
      maintenanceRecords,
      repairRecords,
      nextReplacementParts
    );

    updateDeviceStatusFromLifecycle(
      nextRecord.device_id,
      nextStatus,
      'Cập nhật trạng thái linh kiện. Hệ thống đồng bộ lại trạng thái thiết bị.'
    );
  }, [
    can,
    maintenanceRecords,
    repairRecords,
    replacementParts,
    requirePermission,
    resolveDeviceStatusAfterClosure,
    setReplacementParts,
    updateDeviceStatusFromLifecycle,
    updateRemote,
  ]);

  const addTransferRecord = useCallback((r: TransferRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm hồ sơ điều chuyển.');
    setTransferRecords(prev => [...prev, r]);
    void upsertRemote('transfer_records', r as unknown as Record<string, unknown>);
  }, [can, requirePermission, setTransferRecords, upsertRemote]);

  const addDisposalRecord = useCallback((r: DisposalRecord) => {
    requirePermission(can('workflow:create'), 'Bạn không có quyền thêm hồ sơ thanh lý.');

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const stampedRecord = stampCreatedBy(r);

    setDisposalRecords(prev => [...prev, stampedRecord]);
    void upsertRemote('disposal_records', stampedRecord as unknown as Record<string, unknown>);

    setDevices(prev => {
      const changedDevices: Device[] = [];
      const nextDevices = prev.map(device => {
        if (device.id !== stampedRecord.device_id) return device;

        const noteLine = `[${today}] Đã lập phiếu thanh lý${stampedRecord.decision_number ? ` theo QĐ ${stampedRecord.decision_number}` : ''}. Thiết bị chuyển sang trạng thái Đã thanh lý.`;
        const nextDevice: Device = {
          ...device,
          current_status: 'disposed',
          current_location: '',
          notes: `${device.notes || ''}
${noteLine}`.trim(),
          updated_at: now,
          updated_by: currentUser?.id,
        };
        changedDevices.push(nextDevice);
        return nextDevice;
      });

      if (changedDevices.length) void upsertRemote('devices', changedDevices as unknown as Record<string, unknown>[]);
      return nextDevices;
    });
  }, [can, currentUser?.id, requirePermission, setDevices, setDisposalRecords, stampCreatedBy, upsertRemote]);


  const fallbackDeviceStatuses = useMemo<DeviceStatusLookup[]>(() => (
    (Object.keys(STATUS_LABELS) as DeviceStatus[]).map((value, index) => ({
      value,
      label: STATUS_LABELS[value],
      color_class: STATUS_COLORS[value],
      sort_order: index + 1,
      is_active: true,
    }))
  ), []);

  const fallbackPurchaseStatuses = useMemo<PurchaseStatusLookup[]>(() => (
    (Object.keys(PURCHASE_STATUS_LABELS) as PurchaseStatus[]).map((value, index) => ({
      value,
      label: PURCHASE_STATUS_LABELS[value],
      color_class: PURCHASE_STATUS_COLORS[value],
      sort_order: index + 1,
      is_active: true,
    }))
  ), []);

  const deviceStatusOptions = useMemo(() => (
    dbDeviceStatuses.length ? dbDeviceStatuses.map(option => ({
      ...option,
      label: readableStatusLabel(option.value, option.label),
    })) : fallbackDeviceStatuses
  ), [dbDeviceStatuses, fallbackDeviceStatuses]);

  const purchaseStatusOptions = useMemo(() => (
    dbPurchaseStatuses.length ? dbPurchaseStatuses : fallbackPurchaseStatuses
  ), [dbPurchaseStatuses, fallbackPurchaseStatuses]);

  const getDeviceStatusLabel = useCallback((status: DeviceStatus) => (
    deviceStatusOptions.find(option => option.value === status)?.label || status
  ), [deviceStatusOptions]);

  const getDeviceStatusColor = useCallback((status: DeviceStatus) => (
    statusBadgeClass(status)
  ), []);

  const getPurchaseStatusLabel = useCallback((status: PurchaseStatus) => (
    purchaseStatusOptions.find(option => option.value === status)?.label || status
  ), [purchaseStatusOptions]);

  const getPurchaseStatusColor = useCallback((status: PurchaseStatus) => (
    purchaseStatusOptions.find(option => option.value === status)?.color_class || 'bg-gray-100 text-gray-800 border-gray-300'
  ), [purchaseStatusOptions]);

  const activeDevices = useMemo(() => devices.filter(d => !d.deleted_at), [devices]);

  return (
    <StoreContext.Provider value={{
      devices: activeDevices,
      allDevices: devices,
      tenderingRecords,
      purchaseRecords,
      receptionRecords,
      operationLogs,
      maintenanceRecords,
      repairRecords,
      replacementParts,
      transferRecords,
      disposalRecords,
      deviceCategories,
      departments,
      deviceStatusOptions,
      purchaseStatusOptions,
      getDeviceStatusLabel,
      getDeviceStatusColor,
      getPurchaseStatusLabel,
      getPurchaseStatusColor,
      addDevice,
      updateDevice,
      deleteDevice,
      addTenderingRecord,
      addTenderingPackage,
      updateTenderingRecord,
      addPurchaseRecord,
      updatePurchaseRecord,
      addReceptionRecord,
      addOperationLog,
      addMaintenanceRecord,
      updateMaintenanceRecord,
      addRepairRecord,
      updateRepairRecord,
      addReplacementPart,
      updateReplacementPart,
      addTransferRecord,
      addDisposalRecord,
      getDeviceById,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
}
