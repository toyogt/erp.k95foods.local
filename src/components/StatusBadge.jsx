import { cn } from '@/lib/utils';

const statusColors = {
  CREATED: 'bg-slate-100 text-slate-700',
  FILLED: 'bg-blue-100 text-blue-700',
  ON_PALLET: 'bg-indigo-100 text-indigo-700',
  IN_CHAMBER: 'bg-orange-100 text-orange-700',
  POST_CHAMBER: 'bg-teal-100 text-teal-700',
  LABELLED: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-emerald-100 text-emerald-800',
  OPEN: 'bg-slate-100 text-slate-700',
  SEALED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-amber-100 text-amber-700',
  RECEIVED: 'bg-teal-100 text-teal-700',
  PUTAWAY: 'bg-green-100 text-green-700',
  PLANNED: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  QC_PENDING: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-red-100 text-red-700',
  DRAFT: 'bg-slate-100 text-slate-700',
  RELEASED: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ISSUED: 'bg-teal-100 text-teal-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  RELEASED: 'bg-blue-100 text-blue-700',
  WIP: 'bg-indigo-100 text-indigo-700',
  FG: 'bg-emerald-100 text-emerald-700',
};

export default function StatusBadge({ status, className }) {
  const color = statusColors[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase', color, className)}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}