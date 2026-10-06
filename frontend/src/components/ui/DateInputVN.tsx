import { useEffect, useState } from 'react';

interface DateInputVNProps {
  /** Giá trị ngày dạng yyyy-mm-dd (rỗng nếu chưa chọn) */
  value: string;
  /** Trả về yyyy-mm-dd khi ngày hợp lệ và đầy đủ; trả về '' khi người dùng xóa hết */
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const isValidDate = (day: number, month: number, year: number): boolean => {
  if (month < 1 || month > 12) return false;
  if (year < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
};

// yyyy-mm-dd -> dd/mm/yyyy
const isoToDisplay = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

// Chèn '/' tự động khi người dùng đang gõ chỉ gồm số, ví dụ "01012026" -> "01/01/2026"
const maskDigitsToDisplay = (digits: string): string => {
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

export default function DateInputVN({ value, onChange, className, placeholder = 'dd/mm/yyyy' }: DateInputVNProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [error, setError] = useState('');

  // Đồng bộ lại khi value từ ngoài thay đổi (ví dụ reset form, đổi record đang sửa)
  useEffect(() => {
    setText(isoToDisplay(value));
    setError('');
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const display = maskDigitsToDisplay(digits);
    setText(display);

    if (digits.length === 0) {
      setError('');
      onChange('');
      return;
    }

    if (digits.length < 8) {
      // Chưa gõ xong, không báo lỗi vội, không gọi onChange để tránh lưu ngày dở dang
      setError('');
      return;
    }

    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));

    if (!isValidDate(day, month, year)) {
      setError('Ngày không hợp lệ.');
      return;
    }

    setError('');
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
  };

  const handleBlur = () => {
    const digits = text.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 8) {
      setError('Vui lòng nhập đủ ngày/tháng/năm.');
    }
  };

  return (
    <div>
      <input
        className={className}
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        maxLength={10}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
