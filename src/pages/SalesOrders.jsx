import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Upload, Users, Package, TrendingUp, Clock, CheckCircle2, AlertTriangle, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SalesOrderStatusBadge from '@/components/sales/SalesOrderStatusBadge';
import CreateSalesOrderModal from '@/components/sales/CreateSalesOrderModal';

const STATUS_TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'picking', label: 'Picking' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
];

const PLATFORM_COLORS = {
  blinkit: 'bg-yellow-100 text-yellow-800',
  swiggy: 'bg-orange-100 text-orange-800',
  zepto: 'bg-purple-100 text-purple-800',
  direct: 'bg-blue-100 text-blue-800',
  other: 'bg-slate-100 text-slate-700',
};

export default function SalesOrders() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('manual');

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['sales_orders'],
    queryFn: () => base44.entities.SalesOrder.list('-created_date', 100),
  });

  const filtered = orders.filter(o => {
    const matchesTab = activeTab === 'all' || o.status === activeTab;
    const matchesSearch = !search ||
      o.so_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.po_number?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // KPI counts
  const pending = orders.filter(o => ['draft', 'confirmed', 'stock_validated', 'picking', 'packing'].includes(o.status)).length;
  const dispatched = orders.filter(o => o.status === 'dispatched').length;
  const overdue = orders.filter(o => {
    if (!o.po_expiry_date) return false;
    return new Date(o.po_expiry_date) < new Date() && !['paid', 'closed', 'cancelled'].includes(o.status);
  }).length;
  const totalValue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Orders</h1>
          <p className="text-sm text-slate-500">Flow-driven order lifecycle management</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            onClick={() => { setCreateType('pdf_upload'); setShowCreateModal(true); }}
          >
            <Upload className="w-4 h-4 mr-2" /> Upload PDF
          </Button>
          <Button
            className="h-11 px-4 text-sm bg-slate-900 hover:bg-slate-800 text-white"
            onClick={() => { setCreateType('manual'); setShowCreateModal(true); }}
          >
            <Plus className="w-4 h-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500 font-medium">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{pending}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500 font-medium">Dispatched</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{dispatched}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 font-medium">Expiry Alerts</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{overdue}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-slate-500 font-medium">Total Value</span>
          </div>
          <p className="text-xl font-bold text-slate-900">₹{(totalValue / 1000).toFixed(1)}K</p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
              {t.key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  {orders.filter(o => o.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by order number, customer, PO number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Orders Table */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs font-medium">
                  <th className="px-4 py-3 text-left">Order Number</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Platform</th>
                  <th className="px-4 py-3 text-left">PO Number</th>
                  <th className="px-4 py-3 text-left">PO Expiry</th>
                  <th className="px-4 py-3 text-right">Total (INR)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(order => {
                  const isExpired = order.po_expiry_date && new Date(order.po_expiry_date) < new Date()
                    && !['paid', 'closed', 'cancelled'].includes(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {order.so_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{order.customer_name}</td>
                      <td className="px-4 py-3">
                        {order.platform && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[order.platform] || PLATFORM_COLORS.other}`}>
                            {order.platform}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{order.po_number || '—'}</td>
                      <td className="px-4 py-3">
                        {order.po_expiry_date ? (
                          <span className={isExpired ? 'text-red-600 font-medium' : 'text-slate-600'}>
                            {isExpired && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {order.po_expiry_date}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {order.total_amount ? `₹${order.total_amount.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <SalesOrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/SalesOrderDetail?id=${order.id}`}
                          className="text-blue-600 hover:underline text-xs font-medium"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSalesOrderModal
          defaultType={createType}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); refetch(); }}
        />
      )}
    </div>
  );
}