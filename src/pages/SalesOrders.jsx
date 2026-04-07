import { useState, useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Upload, Package, TrendingUp, Clock, AlertTriangle, Search, Inbox, Download } from 'lucide-react';

function exportOrdersCSV(rows) {
  const headers = ['SO Number','Customer','Platform','PO Number','PO Date','PO Expiry','Total Amount','Status','Source'];
  const lines = [headers.join(',')];
  for (const o of rows) {
    lines.push([
      o.so_number, o.customer_name, o.platform, o.po_number, o.po_date, o.po_expiry_date,
      o.total_amount, o.status, o.source,
    ].map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sales_orders.csv'; a.click();
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import SalesOrderStatusBadge from '@/components/sales/SalesOrderStatusBadge';
import CreateSalesOrderModal from '@/components/sales/CreateSalesOrderModal';
import DistributorRequestsTab from '@/components/sales/DistributorRequestsTab';
import SKUManagementTab from '@/components/sales/SKUManagementTab';
import usePagination from '@/hooks/usePagination';
import TablePagination from '@/components/sales/TablePagination';

const STATUS_TABS = [
  { key: 'distributor_requests', label: 'Distributor Requests', icon: Inbox },
  { key: 'all', label: 'All Orders' },
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'logistics_review', label: 'Logistics Review' },
  { key: 'picking', label: 'Picking' },
  { key: 'dispatched', label: 'Dispatched' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'paid', label: 'Paid' },
  { key: 'sku', label: 'SKU', icon: Package },
];

const PLATFORM_COLORS = {
  blinkit: 'bg-yellow-100 text-yellow-800',
  swiggy: 'bg-orange-100 text-orange-800',
  zepto: 'bg-purple-100 text-purple-800',
  direct: 'bg-blue-100 text-blue-800',
  other: 'bg-slate-100 text-slate-700',
};

export default function SalesOrders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterExpiryAlert, setFilterExpiryAlert] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('manual');

  const { data: distRequests = [] } = useQuery({
    queryKey: ['distributor_requests_all'],
    queryFn: () => base44.entities.DistributorRequest.list('-created_date', 100),
  });
  const openRequestsCount = distRequests.filter(r => r.status === 'pending' || r.status === 'reviewing').length;

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['sales_orders'],
    queryFn: () => base44.entities.SalesOrder.list('-created_date', 500),
    staleTime: 120000,
    cacheTime: 600000,
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => orders.filter(o => {
    const matchesTab = activeTab === 'all' || o.status === activeTab;
    const matchesSearch = !search ||
      o.so_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.po_number?.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = !filterPlatform || o.platform === filterPlatform;
    const matchesExpiry = !filterExpiryAlert || (
      o.po_expiry_date && new Date(o.po_expiry_date) < new Date() && !['paid','closed','cancelled'].includes(o.status)
    );
    return matchesTab && matchesSearch && matchesPlatform && matchesExpiry;
  }), [orders, activeTab, search, filterPlatform, filterExpiryAlert]);

  const pagination = usePagination(filtered, 25);

  // KPI counts — memoized
  const { pending, dispatched, overdue, totalValue } = useMemo(() => {
    let pend = 0, disp = 0, over = 0, val = 0;
    const now = new Date();
    for (const o of orders) {
      val += o.total_amount || 0;
      if (['draft', 'confirmed', 'stock_validated', 'picking', 'packing'].includes(o.status)) pend++;
      if (o.status === 'dispatched') disp++;
      if (o.po_expiry_date && new Date(o.po_expiry_date) < now && !['paid', 'closed', 'cancelled'].includes(o.status)) over++;
    }
    return { pending: pend, dispatched: disp, overdue: over, totalValue: val };
  }, [orders]);

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Orders</h1>
          <p className="text-sm text-slate-500">Flow-driven order lifecycle management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 px-4 text-sm" onClick={() => exportOrdersCSV(filtered)}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === t.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.icon && <t.icon className="w-3.5 h-3.5" />}
              {t.label}
              {t.key === 'distributor_requests' && openRequestsCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === t.key ? 'bg-white text-slate-900' : 'bg-amber-100 text-amber-700'
                }`}>{openRequestsCount}</span>
              )}
              {t.key !== 'all' && t.key !== 'distributor_requests' && (
                <span className="text-xs opacity-70">{orders.filter(o => o.status === t.key).length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== 'distributor_requests' && activeTab !== 'sku' && (
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search order, customer, Purchase Order..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value)}
            >
              <option value="">All Platforms</option>
              <option value="blinkit">Blinkit</option>
              <option value="swiggy">Swiggy</option>
              <option value="zepto">Zepto</option>
              <option value="direct">Direct</option>
            </select>
            <button
              onClick={() => setFilterExpiryAlert(v => !v)}
              className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
                filterExpiryAlert ? 'bg-red-100 border-red-300 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              Expiry Alerts
            </button>
            {(search || filterPlatform || filterExpiryAlert) && (
              <button
                onClick={() => { setSearch(''); setFilterPlatform(''); setFilterExpiryAlert(false); }}
                className="h-9 px-3 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md"
              >Clear</button>
            )}
          </div>
        </div>
        )}

        {activeTab === 'distributor_requests' ? (
          <div className="p-4">
            <DistributorRequestsTab onSOCreated={refetch} />
          </div>
        ) : activeTab === 'sku' ? (
          <div className="p-4">
            <SKUManagementTab />
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No orders found</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs font-medium">
                <th className="px-4 py-3 text-left">Sales Order Number</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Platform</th>
                  <th className="px-4 py-3 text-left">Purchase Order Number</th>
                  <th className="px-4 py-3 text-left">Purchase Order Expiry</th>
                  <th className="px-4 py-3 text-right">Total (INR)</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.paged.map(order => {
                  const isExpired = order.po_expiry_date && new Date(order.po_expiry_date) < new Date()
                    && !['paid', 'closed', 'cancelled'].includes(order.status);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <a href={`/SalesOrderDetail?id=${order.id}`} className="text-blue-600 hover:underline">{order.so_number || '—'}</a>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{order.customer_name}</td>
                      <td className="px-4 py-3">
                        {order.platform && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[order.platform] || PLATFORM_COLORS.other}`}>
                            {order.platform}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {order.po_number ? (
                          <a href={`/SalesOrderDetail?id=${order.id}`} className="text-blue-600 hover:underline">{order.po_number}</a>
                        ) : '—'}
                      </td>
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
                      <td className="px-4 py-3"><SalesOrderStatusBadge status={order.status} /></td>
                      <td className="px-4 py-3">
                        <a href={`/SalesOrderDetail?id=${order.id}`} className="text-blue-600 hover:underline text-xs font-medium">Open →</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination {...pagination} />
          </>
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