/**
 * Picklists Listing Page — shows all picklists with search, filter, and links.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Search, ClipboardList, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import SalesOrderStatusBadge from '@/components/sales/SalesOrderStatusBadge';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'dispatch_scheduled', label: 'Dispatch Scheduled' },
  { key: 'pick_packed', label: 'Pick & Packed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR = {
  draft: 'bg-slate-100 text-slate-600',
  dispatch_scheduled: 'bg-blue-100 text-blue-800',
  pick_packed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function SalesPicklists() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: picklists = [], isLoading } = useQuery({
    queryKey: ['all_picklists'],
    queryFn: () => base44.entities.SalesPicklist.list('-created_date', 200),
  });

  const filtered = picklists.filter(pl => {
    const matchTab = activeTab === 'all' || pl.status === activeTab;
    const matchSearch = !search ||
      pl.picklist_number?.toLowerCase().includes(search.toLowerCase()) ||
      pl.so_number?.toLowerCase().includes(search.toLowerCase()) ||
      pl.transporter?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const fmt = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    return d;
  };

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Picklists</h1>
          <p className="text-sm text-slate-500">All pick lists generated from approved orders</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', count: picklists.length, color: 'text-slate-600' },
          { label: 'Draft', count: picklists.filter(p => p.status === 'draft').length, color: 'text-amber-600' },
          { label: 'Dispatch Scheduled', count: picklists.filter(p => p.status === 'dispatch_scheduled').length, color: 'text-blue-600' },
          { label: 'Pick & Packed', count: picklists.filter(p => p.status === 'pick_packed').length, color: 'text-green-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <span className="text-xs text-slate-500 font-medium">{k.label}</span>
            <p className={`text-2xl font-bold ${k.color}`}>{k.count}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {t.label}
              {t.key !== 'all' && <span className="ml-1 text-xs opacity-70">{picklists.filter(p => p.status === t.key).length}</span>}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search picklist, order, transporter..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No picklists found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs font-medium">
                  <th className="px-4 py-3 text-left">Picklist Number</th>
                  <th className="px-4 py-3 text-left">Sales Order</th>
                  <th className="px-4 py-3 text-left">Transporter</th>
                  <th className="px-4 py-3 text-left">Packaging Type</th>
                  <th className="px-4 py-3 text-left">Dispatch Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(pl => (
                  <tr key={pl.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-blue-600">
                      <Link to={`/SalesPicklistDetail?id=${pl.id}`} className="hover:underline">{pl.picklist_number}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/SalesOrderDetail?id=${pl.sales_order_id}`} className="text-blue-600 hover:underline text-xs">{pl.so_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{pl.transporter || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{pl.packaging_type || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(pl.dispatch_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[pl.status] || 'bg-slate-100 text-slate-600'}`}>
                        {pl.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/SalesPicklistDetail?id=${pl.id}`} className="text-blue-600 hover:underline text-xs font-medium">Open →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}