import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRightLeft,
  CheckCircle,
  Cpu,
  FileText,
  PackageCheck,
  Play,
  Settings,
  ShoppingCart,
  Trash2,
  Wrench,
} from 'lucide-react';

import { useStore } from '@/lib/store';
import { apiJson } from '@/lib/api';
import {
  buildTimeline,
  formatDate,
  purchaseIncludesDevice,
  tenderIncludesDevice,
} from '@/lib/deviceUtils';

import type { TimelineEvent } from '@/types/lifecycle';

const iconMap: Record<string, typeof FileText> = {
  FileText,
  CheckCircle,
  ShoppingCart,
  PackageCheck,
  Play,
  Activity,
  Wrench,
  Settings,
  Cpu,
  ArrowRightLeft,
  Trash2,
};

interface Props {
  deviceId: string;
}

interface ApiDeviceEvent {
  id: string;
  device_id: string;
  event_type: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface ApiEventResponse {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  items: ApiDeviceEvent[];
}

function mapApiEvent(event: ApiDeviceEvent): TimelineEvent {
  const metadata = event.metadata || {};

  const location =
    typeof metadata.location === 'string'
      ? metadata.location
      : '';

  const severity =
    typeof metadata.severity === 'string'
      ? metadata.severity
      : '';

  const cost =
    typeof metadata.cost === 'number'
      ? metadata.cost
      : null;

  switch (event.event_type) {
    case 'DEVICE_REGISTERED':
      return {
        id: event.id,
        type: event.event_type,
        title: 'Đăng ký thiết bị',
        description: location
          ? `Thiết bị được ghi nhận tại ${location}`
          : 'Thiết bị được đăng ký vào hệ thống',
        date: event.timestamp,
        icon: 'FileText',
        color: 'text-blue-600',
      };

    case 'DEVICE_RECEIVED':
      return {
        id: event.id,
        type: event.event_type,
        title: 'Tiếp nhận thiết bị',
        description: location
          ? `Tiếp nhận tại ${location}`
          : 'Thiết bị được tiếp nhận',
        date: event.timestamp,
        icon: 'PackageCheck',
        color: 'text-green-600',
      };

    case 'DEVICE_STATUS_CHANGED':
      return {
        id: event.id,
        type: event.event_type,
        title: 'Thay đổi trạng thái',
        description: [
          location ? `Vị trí: ${location}` : '',
          severity ? `Mức độ: ${severity}` : '',
        ]
          .filter(Boolean)
          .join(' • ') || 'Trạng thái thiết bị được cập nhật',
        date: event.timestamp,
        icon: 'Activity',
        color: 'text-blue-600',
      };

    case 'DEVICE_TRANSFERRED': {
      const from =
        typeof metadata.from_location === 'string'
          ? metadata.from_location
          : '';

      const to =
        typeof metadata.to_location === 'string'
          ? metadata.to_location
          : '';

      return{
        id: event.id,
        type: event.event_type,
        title: 'Điều chuyển thiết bị',
        description:
          from || to
            ? `${from || '—'} → ${to || '—'}`
            : 'Thiết bị được điều chuyển',
        date: event.timestamp,
        icon: 'ArrowRightLeft',
        color: 'text-purple-600',
      };
    }

    case 'MAINTENANCE_COMPLETED': {
      const maintenanceType =
        typeof metadata.maintenance_type === 'string'
          ? metadata.maintenance_type
          : '';

      return {
        id: event.id,
        type: event.event_type,
        title: 'Hoàn thành bảo trì',
        description: [
          maintenanceType
            ? `Loại: ${maintenanceType}`
            : '',
          cost !== null
            ? `Chi phí: ${cost.toLocaleString('vi-VN')} ₫`
            : '',
          location ? `Vị trí: ${location}` : '',
        ]
          .filter(Boolean)
          .join(' • ') || 'Hoàn thành bảo trì thiết bị',
        date: event.timestamp,
        icon: 'Wrench',
        color: 'text-orange-600',
      };
    }

    case 'REPAIR_COMPLETED': {
      const fault =
        typeof metadata.fault_category === 'string'
          ? metadata.fault_category
          : '';

      return {
        id: event.id,
        type: event.event_type,
        title: 'Hoàn thành sửa chữa',
        description: [
          fault ? `Nhóm lỗi: ${fault}` : '',
          cost !== null
            ? `Chi phí: ${cost.toLocaleString('vi-VN')} ₫`
            : '',
          location ? `Vị trí: ${location}` : '',
        ]
          .filter(Boolean)
          .join(' • ') || 'Hoàn thành sửa chữa thiết bị',
        date: event.timestamp,
        icon: 'Settings',
        color: 'text-red-600',
      };
    }

    case 'DEVICE_DISPOSED':
      return {
        id: event.id,
        type: event.event_type,
        title: 'Thanh lý thiết bị',
        description: location
          ? `Thiết bị được thanh lý tại ${location}`
          : 'Thiết bị được ghi nhận thanh lý',
        date: event.timestamp,
        icon: 'Trash2',
        color: 'text-gray-600',
      };

    default:
      return {
        id: event.id,
        type: event.event_type,
        title: event.event_type,
        description: location
          ? `Vị trí: ${location}`
          : 'Sự kiện thiết bị',
        date: event.timestamp,
        icon: 'Activity',
        color: 'text-gray-600',
      };
  }
}

export default function DeviceTimeline({ deviceId }: Props) {
  const {
    tenderingRecords,
    purchaseRecords,
    receptionRecords,
    operationLogs,
    maintenanceRecords,
    repairRecords,
    replacementParts,
    transferRecords,
    disposalRecords,
  } = useStore();

  const [apiEvents, setApiEvents] = useState<ApiDeviceEvent[]>([]);
  const [totalApiEvents, setTotalApiEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError('');

      try {
        const result = await apiJson<ApiEventResponse>(
          `/analytics/events?device_id=${encodeURIComponent(
            deviceId
          )}&limit=200&offset=0`
        );

        if (!cancelled) {
          setApiEvents(result.items || []);
          setTotalApiEvents(result.total || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải lịch sử sự kiện.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const workflowEvents = useMemo(
    () =>
      buildTimeline(
        tenderingRecords.filter(r =>
          tenderIncludesDevice(r, deviceId)
        ),
        purchaseRecords.filter(r =>
          purchaseIncludesDevice(r, deviceId)
        ),
        receptionRecords.filter(r => r.device_id === deviceId),
        operationLogs.filter(r => r.device_id === deviceId),
        maintenanceRecords.filter(r => r.device_id === deviceId),
        repairRecords.filter(r => r.device_id === deviceId),
        replacementParts.filter(r => r.device_id === deviceId),
        transferRecords.filter(r => r.device_id === deviceId),
        disposalRecords.filter(r => r.device_id === deviceId),
      ),
    [
      deviceId,
      tenderingRecords,
      purchaseRecords,
      receptionRecords,
      operationLogs,
      maintenanceRecords,
      repairRecords,
      replacementParts,
      transferRecords,
      disposalRecords,
    ]
  );

  const events = useMemo(() => {
    const serverEvents = apiEvents.map(mapApiEvent);

    const merged = [...serverEvents, ...workflowEvents];

    const unique = Array.from(
      new Map(
        merged.map(event => [event.id, event])
      ).values()
    );

    return unique.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  }, [apiEvents, workflowEvents]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Activity
          size={48}
          className="mx-auto mb-3 opacity-50 animate-pulse"
        />
        <p>Đang tải lịch sử vòng đời...</p>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="text-center py-12 text-red-500">
        <Activity
          size={48}
          className="mx-auto mb-3 opacity-50"
        />
        <p>Không thể tải lịch sử vòng đời</p>
        <p className="text-xs mt-2">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Activity
          size={48}
          className="mx-auto mb-3 opacity-50"
        />
        <p>Chưa có sự kiện nào trong vòng đời</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {totalApiEvents.toLocaleString('vi-VN')} sự kiện
          </p>

          {totalApiEvents > apiEvents.length && (
            <p className="text-xs text-gray-500 mt-1">
              Đang hiển thị {apiEvents.length} sự kiện gần nhất
            </p>
          )}
        </div>

        {error && (
          <span className="text-xs text-amber-600">
            Có lỗi khi đồng bộ một phần dữ liệu
          </span>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {events.map(
            (event: TimelineEvent, index: number) => {
              const Icon =
                iconMap[event.icon] || Activity;

              return (
                <div
                  key={`${event.id}-${index}`}
                  className="relative flex items-start gap-4 pl-2"
                >
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0 ${event.color}`}
                  >
                    <Icon size={18} />
                  </div>

                  <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <h4 className="text-sm font-semibold text-gray-800">
                        {event.title}
                      </h4>

                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(event.date)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">
                      {event.description}
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}