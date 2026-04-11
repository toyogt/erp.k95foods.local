/**
 * Picklists Listing Page — ERPNext-style with Create Picklist, search, filter, KPIs.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ClipboardList, Plus, ChevronRight, Calendar, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import usePagination from '@/hooks/usePagination';
import TablePagination from '@/components/sales/TablePagination';
import CreatePicklistModal from '@/components/sales/CreatePicklistModal';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'picking', label: 'Picking' },
  { key: 'picked', label: 'Picked' },
  { key: 'dispatch_scheduled', label: 'Dispatch Scheduled' },
  { key: 'pick_packed', label: 'Pick & Packed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLOR = {
  draft: 'bg-slate-100 text-slate-600',
  picking: 'bg-amber-100 text-amber-800',
  picked: 'bg-blue-100 text-blue-800',
  dispatch_scheduled: 'bg-indigo-100 text-indigo-800',
  pick_packed: 'bg-green-100 text-green-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function SalesPicklists() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  const { data: picklists = [], isLoading } = useQuery({
    queryKey: ['all_picklists'],
    queryFn: () => base44.entities.SalesPicklist.list('-created_date', 500),
    staleTime: 60000,
  });

  const filtered = useMemo(() => picklists.filter(pl => {
    const matchTab = activeTab === 'all' || pl.status === activeTab;
    const matchSearch = !search ||
      pl.picklist_number?.toLowerCase().includes(search.toLowerCase()) ||
      pl.so_number?.toLowerCase().includes(search.toLowerCase()) ||
      pl.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      pl.transporter?.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || pl.dispatch_date === dateFilter || pl.created_date?.startsWith(dateFilter);
    return matchTab && matchSearch && matchDate;
  }), [picklists, activeTab, search, dateFilter]);

  const pagination = usePagination(filtered, 25);

  const fmt = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
    return d;
  };

  const counts = useMemo(() => {
    const c = {};
    STATUS_TABS.forEach(t => { c[t.key] = t.key === 'all' ? picklists.length : picklists.filter(p => p.status === t.key).length; });
    return c;
  }, [picklists]);

  return (
    <motion.div className="p-3 md:p-6 space-y-5 mx-auto" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pick Lists</h1>
          <p className="text-sm text-slate-500">Manage warehouse pick lists for sales orders</p>
        </div>
        <Button className="h-11 bg-slate-900 text-white text-sm gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Create Pick List
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', count: counts.all, color: 'text-slate-600' },
          { label: 'Draft', count: counts.draft, color: 'text-slate-500' },
          { label: 'Picking', count: counts.picking, color: 'text-amber-600' },
          { label: 'Dispatch Scheduled', count: counts.dispatch_scheduled, color: 'text-indigo-600' },
          { label: 'Pick & Packed', count: counts.pick_packed, color: 'text-green-600' },
          { label: 'Completed', count: counts.completed, color: 'text-emerald-600' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.04 }}
            className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 hover:shadow-md transition-shadow">
            <span className="text-xs text-slate-500 font-medium">{k.label}</span>
            <p className={`text-2xl font-bold ${k.color}`}>{k.count}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              {t.label}
              {t.key !== 'all' && counts[t.key] > 0 && <span className="ml-1 text-xs opacity-70">{counts[t.key]}</span>}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-slate-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search picklist, order, customer, transporter..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Input type="date" className="h-9 text-sm w-40" value={dateFilter}
              onChange={e => setDateFilter(e.target.value)} />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-xs text-red-500 hover:text-red-700">Clear</button>
            )}
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
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-xs font-medium">
                    <th className="px-4 py-3 text-left">Pick List Number</th>
                    <th className="px-4 py-3 text-left">Sales Order</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Transporter</th>
                    <th className="px-4 py-3 text-left">Dispatch Date</th>
                    <th className="px-4 py-3 text-right">Items</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagination.paged.map(pl => (
                    <tr key={pl.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => window.location.href = `/SalesPicklistDetail?id=${pl.id}`}>
                      <td className="px-4 py-3 font-medium text-blue-600">{pl.picklist_number}</td>
                      <td className="px-4 py-3">
                        <Link to={`/SalesOrderDetail?id=${pl.sales_order_id}`} className="text-blue-600 hover:underline text-xs" onClick={e => e.stopPropagation()}>
                          {pl.so_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{pl.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 flex items-center gap-1">
                        {pl.transporter && <Truck className="w-3 h-3 text-slate-400" />}
                        {pl.transporter || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{fmt(pl.dispatch_date)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{pl.items?.length || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[pl.status] || 'bg-slate-100 text-slate-600'}`}>
                          {pl.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Link to={`/SalesPicklistDetail?id=${pl.id}`} className="text-blue-600 hover:underline text-xs font-medium">Open →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {pagination.paged.map(pl => (
                <Link key={pl.id} to={`/SalesPicklistDetail?id=${pl.id}`} className="block px-4 py-3.5 active:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{pl.picklist_number}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{pl.customer_name || pl.so_number}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[pl.status] || 'bg-slate-100 text-slate-600'}`}>
                        {pl.status?.replace(/_/g, ' ')}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    {pl.transporter && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{pl.transporter}</span>}
                    {pl.dispatch_date && <span>Dispatch: {fmt(pl.dispatch_date)}</span>}
                    <span>{pl.items?.length || 0} items</span>
                  </div>
                </Link>
              ))}
            </div>

            <TablePagination {...pagination} />
          </>
        )}
      </div>

      <CreatePicklistModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['all_picklists'] })}
      />
    </motion.div>
  );
}