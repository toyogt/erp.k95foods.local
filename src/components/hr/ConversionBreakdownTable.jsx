/**
 * Shows successful conversion breakdown by a category field
 * (source_type, role_interested, location_area).
 */
export default function ConversionBreakdownTable({ data, label }) {
  if (!data?.length) {
    return <div className="text-sm text-slate-500 text-center py-6">No data available.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{label}</th>
            <th className="px-3 py-2 text-right font-medium">Reached</th>
            <th className="px-3 py-2 text-right font-medium">Hired</th>
            <th className="px-3 py-2 text-right font-medium">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.slice(0, 12).map((row) => (
            <tr key={row.name} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-900 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-right text-slate-700">{row.reached}</td>
              <td className="px-3 py-2 text-right text-green-700 font-medium">{row.hired}</td>
              <td className="px-3 py-2 text-right">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.rate >= 30
                      ? 'bg-green-100 text-green-700'
                      : row.rate >= 10
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {row.rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}