/**
 * Responsive Table
 * Switches between table (desktop) and card list (mobile/scanner)
 */

import { useDeviceMode } from '@/hooks/useDeviceMode';

export default function ResponsiveTable({
  columns,
  rows,
  onRowClick,
  loading = false,
  emptyMessage = 'No data',
}) {
  const { layout } = useDeviceMode();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Full table for desktop
  if (layout.tableMode === 'full') {
    return (
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-900">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Card list for mobile/scanner
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div
          key={idx}
          onClick={() => onRowClick?.(row)}
          className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="space-y-2">
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between">
                <span className="text-xs font-medium text-slate-600">{col.label}</span>
                <span className="font-semibold text-slate-900">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}