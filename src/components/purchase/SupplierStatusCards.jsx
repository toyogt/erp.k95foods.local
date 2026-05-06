export default function SupplierStatusCards({ suppliers, activeFilter, onFilter }) {
  const all = suppliers.length;
  const approved = suppliers.filter(s => s.approval_status === 'APPROVED').length;
  const hold = suppliers.filter(s => s.approval_status === 'HOLD').length;
  const blocked = suppliers.filter(s => s.approval_status === 'BLOCKED').length;

  const cards = [
    { key: 'ALL', label: 'All', count: all, border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
    { key: 'APPROVED', label: 'Approved', count: approved, border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700' },
    { key: 'HOLD', label: 'Hold', count: hold, border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
    { key: 'BLOCKED', label: 'Blocked', count: blocked, border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700' },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map(c => (
        <button
          key={c.key}
          onClick={() => onFilter(c.key)}
          className={`rounded-xl border-2 px-3 py-3 text-center transition-all ${
            activeFilter === c.key
              ? `${c.border} ${c.bg} ring-2 ring-offset-1 ring-blue-300`
              : `border-slate-200 bg-white hover:${c.bg}`
          }`}
        >
          <p className={`text-xl font-bold ${c.text}`}>{c.count}</p>
          <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
        </button>
      ))}
    </div>
  );
}