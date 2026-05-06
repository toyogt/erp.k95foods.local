import { DEPARTMENTS } from './purchaseHelpers';

export default function PRListFilters({ filters, onChange, isHindi, t }) {
  const translate = t || ((k) => k);

  function set(key, value) {
    onChange({ ...filters, [key]: value || undefined });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select className="h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white min-w-[120px]"
        value={filters.status || ''} onChange={e => set('status', e.target.value)}>
        <option value="">{translate('All Status')}</option>
        <option value="Pending Approval">{translate('Pending Approval')}</option>
        <option value="Approved">{translate('Approved')}</option>
        <option value="Partially Approved">{translate('Partially Approved')}</option>
        <option value="Rejected">{translate('Rejected')}</option>
        <option value="SUBMITTED">Submitted</option>
        <option value="ORDERED">Ordered</option>
        <option value="CLOSED">Closed</option>
      </select>
      <select className="h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white min-w-[120px]"
        value={filters.department || ''} onChange={e => set('department', e.target.value)}>
        <option value="">{translate('All Departments')}</option>
        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white min-w-[120px]"
        value={filters.priority || ''} onChange={e => set('priority', e.target.value)}>
        <option value="">{translate('All Priority')}</option>
        <option value="Low">{translate('Low')}</option>
        <option value="Medium">{translate('Medium')}</option>
        <option value="High">{translate('High')}</option>
        <option value="Urgent">{translate('Urgent')}</option>
      </select>
    </div>
  );
}