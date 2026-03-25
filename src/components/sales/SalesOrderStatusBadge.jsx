const STATUS_CONFIG = {
  draft:            { label: 'Draft',              cls: 'bg-slate-100 text-slate-600' },
  confirmed:        { label: 'Confirmed',          cls: 'bg-blue-100 text-blue-700' },
  logistics_review: { label: 'Logistics Review',   cls: 'bg-purple-100 text-purple-700' },
  stock_validated:  { label: 'Stock Validated',    cls: 'bg-cyan-100 text-cyan-700' },
  picking:          { label: 'Pick & Pack',        cls: 'bg-amber-100 text-amber-700' },
  packing:          { label: 'Packing',            cls: 'bg-orange-100 text-orange-700' },
  dispatched:       { label: 'Dispatched',         cls: 'bg-indigo-100 text-indigo-700' },
  delivered:        { label: 'Delivered',           cls: 'bg-teal-100 text-teal-700' },
  invoiced:         { label: 'Invoiced',           cls: 'bg-violet-100 text-violet-700' },
  paid:             { label: 'Paid',               cls: 'bg-green-100 text-green-700' },
  closed:           { label: 'Closed',             cls: 'bg-slate-200 text-slate-600' },
  cancelled:        { label: 'Cancelled',          cls: 'bg-red-100 text-red-600' },
};

export default function SalesOrderStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}