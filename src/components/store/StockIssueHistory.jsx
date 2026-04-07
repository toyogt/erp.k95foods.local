export default function StockIssueHistory({ issues }) {
  if (!issues || issues.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No issue history yet.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-xs">
              <th className="text-left px-4 py-3 font-medium">Issue ID</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Reference</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Issued By</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issues.map(i => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-sm font-bold text-slate-800">{i.issue_id}</td>
                <td className="px-4 py-3">
                  <span className="capitalize text-slate-700">{i.issue_type || '—'}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{i.reference_number || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800">{i.total_items || 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    i.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{i.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{i.issued_by || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {i.issued_at ? new Date(i.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">{i.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}