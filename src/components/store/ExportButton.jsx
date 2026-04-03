import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

function convertToCSV(data, columns) {
  if (!data || data.length === 0) return '';
  const headers = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      let val = c.key.split('.').reduce((o, k) => o?.[k], row) ?? '';
      val = String(val).replace(/"/g, '""');
      if (String(val).includes(',') || String(val).includes('"') || String(val).includes('\n')) val = `"${val}"`;
      return val;
    }).join(',')
  );
  return [headers, ...rows].join('\n');
}

export default function ExportButton({ data, columns, filename = 'export' }) {
  const [exporting, setExporting] = useState(false);

  function handleExport() {
    setExporting(true);
    const csv = convertToCSV(data, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    link.download = `${filename}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handleExport} disabled={!data?.length || exporting}>
      <Download className="w-4 h-4" />
      Export
    </Button>
  );
}