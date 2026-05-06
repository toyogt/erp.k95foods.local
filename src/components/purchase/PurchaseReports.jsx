import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, ShoppingCart, Clock, AlertTriangle, TrendingUp, DollarSign, Truck } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR, PO_STATUS_COLOR, PR_STATUS_COLOR } from './purchaseHelpers';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b'];

export default function PurchaseReports() {
  const { data: pos = [], isLoading: poLoading, refetch: refetchPO } = useQuery({
    queryKey: ['purchase-reports-po'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 500), staleTime: 60000,
  });
  const { data: prs = [], isLoading: prLoading, refetch: refetchPR } = useQuery({
    queryKey: ['purchase-reports-pr'], queryFn: () => base44.entities.PurchaseRequest.list('-created_date', 500), staleTime: 60000,
  });
  const { data: followUps = [] } = useQuery({
    queryKey: ['purchase-reports-fups'], queryFn: () => base44.entities.POFollowUp.filter({ status: 'Pending' }, '-follow_up_date', 200).catch(() => []), staleTime: 60000,
  });

  const loading = poLoading || prLoading;
  const today = new Date().toISOString().split('T')[0];

  // KPIs
  const totalPOs = pos.length;
  const activePOs = pos.filter(p => !['Delivered', 'Cancelled'].includes(p.status)).length;
  const pendingPRs = prs.filter(p => p.status === 'Pending Approval').length;
  const overdueFUs = followUps.filter(f => f.follow_up_date < today).length;
  const totalValue = pos.reduce((s, p) => s + (p.total_amount || 0), 0);
  const avgValue = totalPOs > 0 ? totalValue / totalPOs : 0;
  const totalFreight = pos.reduce((s, p) => s + (p.total_freight_paid || 0), 0);

  // Monthly trend
  const monthlyData = {};
  pos.forEach(po => {
    if (!po.po_date) return;
    const m = po.po_date.substring(0, 7); // YYYY-MM
    if (!monthlyData[m]) monthlyData[m] = { month: m, count: 0, value: 0 };
    monthlyData[m].count++;
    monthlyData[m].value += po.total_amount || 0;
  });
  const monthlyChart = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

  // PO by status
  const statusCounts = {};
  pos.forEach(po => { statusCounts[po.status] = (statusCounts[po.status] || 0) + 1; });
  const statusChart = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Top 5 suppliers
  const supplierTotals = {};
  pos.forEach(po => {
    if (!po.supplier_name) return;
    supplierTotals[po.supplier_name] = (supplierTotals[po.supplier_name] || 0) + (po.total_amount || 0);
  });
  const topSuppliers = Object.entries(supplierTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // POs pending receipt
  const pendingReceipt = pos.filter(p => ['Sent to Supplier', 'Acknowledged', 'In Transit', 'Partially Received'].includes(p.status));

  // PR by status
  const prStatusCounts = {};
  prs.forEach(pr => { prStatusCounts[pr.status] = (prStatusCounts[pr.status] || 0) + 1; });

  function refresh() { refetchPO(); refetchPR(); }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-slate-700">Purchase Analytics</p>
        <button onClick={refresh} className="text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Count KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Purchase Orders', value: totalPOs, icon: ShoppingCart, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Active Orders', value: activePOs, icon: TrendingUp, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Pending Requests', value: pendingPRs, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Overdue Follow-Ups', value: overdueFUs, icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(kpi => (
          <div key={kpi.label} className={`border rounded-xl p-3 ${kpi.color}`}>
            <kpi.icon className="w-5 h-5" />
            <p className="text-2xl font-bold mt-1">{kpi.value}</p>
            <p className="text-xs">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Value KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Total Purchase Order Value', value: formatINR(totalValue), icon: DollarSign },
          { label: 'Average Order Value', value: formatINR(avgValue), icon: TrendingUp },
          { label: 'Total Freight Paid', value: formatINR(totalFreight), icon: Truck },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500"><kpi.icon className="w-4 h-4" /><span className="text-xs">{kpi.label}</span></div>
            <p className="text-xl font-bold text-slate-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Monthly Purchase Order Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Purchase Orders by Status</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={statusChart} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
              {statusChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top suppliers */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Top 5 Suppliers by Value</p>
        {topSuppliers.map(([name, value], i) => (
          <div key={name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span><span className="text-sm font-medium text-slate-800">{name}</span></div>
            <span className="text-sm font-bold text-slate-900">{formatINR(value)}</span>
          </div>
        ))}
        {topSuppliers.length === 0 && <p className="text-sm text-slate-400 text-center py-2">No data yet</p>}
      </div>

      {/* Pending receipt */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Purchase Orders Pending Receipt ({pendingReceipt.length})</p>
        {pendingReceipt.slice(0, 10).map(po => (
          <div key={po.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
            <div><span className="font-bold text-sm text-slate-900">{po.po_id}</span><span className="text-xs text-slate-400 ml-2">{po.supplier_name}</span></div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PO_STATUS_COLOR[po.status] || ''}`}>{po.status}</span>
          </div>
        ))}
        {pendingReceipt.length === 0 && <p className="text-sm text-slate-400 text-center py-2">All orders received</p>}
      </div>

      {/* PR status breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Purchase Requests by Status</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(prStatusCounts).map(([status, count]) => (
            <div key={status} className={`rounded-lg px-3 py-2 text-center ${PR_STATUS_COLOR[status] || 'bg-slate-100 text-slate-600'}`}>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs">{status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}