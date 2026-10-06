import * as XLSX from 'xlsx';

export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName: string = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMultiSheetExcel(sheets: { name: string; data: Record<string, unknown>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
