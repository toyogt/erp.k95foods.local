/**
 * Generic KPI data table with column definitions.
 * columns: [{key, label, render?}]
 * rows: array of objects
 */
export default function KPITable({ columns, rows, emptyMsg = 'No data' }) {
  if (!rows?.length) {
    return <p className="text-sm text-slate-400 text-center py-8">{emptyMsg}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map(c => (
              <th key={c.key} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}