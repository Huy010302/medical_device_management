import { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import type { Attachment } from '@/types/lifecycle';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt';

interface Props {
  attachments: Attachment[];
  onChange?: (attachments: Attachment[]) => void;
  label?: string;
  helperText?: string;
  readOnly?: boolean;
  accept?: string;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Không thể đọc file ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function AttachmentUploader({
  attachments,
  onChange,
  label = 'Tài liệu đính kèm',
  helperText = 'Hỗ trợ PDF, Word, Excel, ảnh và TXT. Demo: file mã hóa base64 lưu trong hồ sơ PostgreSQL; hệ thống thật cần object storage và giới hạn dung lượng.',
  readOnly = false,
  accept = DEFAULT_ACCEPT,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState('');
  const canEdit = Boolean(onChange) && !readOnly;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !onChange) return;
    setError('');

    const files = Array.from(fileList);
    const oversized = files.find(file => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setError(`File "${oversized.name}" vượt quá 5MB. Vui lòng nén file hoặc chọn file nhỏ hơn.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    try {
      const nextAttachments = await Promise.all(files.map(async file => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        url: await readFileAsDataUrl(file),
        size: file.size,
        uploaded_at: new Date().toISOString(),
      })));

      onChange([...(attachments || []), ...nextAttachments]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể upload tài liệu.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    if (!onChange) return;
    onChange((attachments || []).filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="label mb-0 flex items-center gap-2">
            <Paperclip size={15} /> {label}
          </label>
          {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
        </div>

        {canEdit && (
          <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary whitespace-nowrap">
            <Upload size={16} /> Upload
          </button>
        )}
      </div>

      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={e => void handleFiles(e.target.files)}
        />
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      {(attachments || []).length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-200 overflow-hidden">
          {(attachments || []).map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex items-center gap-2">
                <FileText size={16} className="shrink-0 text-gray-500" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {[file.type, formatFileSize(file.size)].filter(Boolean).join(' • ') || 'Tài liệu'}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    download={file.name}
                    className="btn-icon"
                    title="Mở / tải tài liệu"
                  >
                    <Download size={16} />
                  </a>
                )}
                {canEdit && (
                  <button type="button" onClick={() => removeAttachment(index)} className="btn-icon text-red-600" title="Xóa tài liệu">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
          Chưa có tài liệu nào.
        </div>
      )}
    </div>
  );
}
