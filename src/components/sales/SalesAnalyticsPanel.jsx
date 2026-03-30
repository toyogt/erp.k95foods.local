import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, BarChart2, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];

function StatCard({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 flex flex-col gap-0.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Unassigned';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function topN(obj, n = 6) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

function fmt(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/**
 * Reusable data-driven analytics panel for sales module pages.
 * Props:
 *   context: string — label shown in header
 *   data: array — records to analyse (Customer[], SalesOrder[], etc.)
 *   type: 'customers' | 'orders' | 'invoices' | 'generic'
 */
export default function SalesAnalyticsPanel({ context = 'Sales Data', data = [], type = 'customers' }) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    if (!data.length) return null;

    if (type === 'customers') {
      const active = data.filter(c => c.status === 'active').length;
      const inactive = data.filter(c => c.status === 'inactive').length;
      const suspended = data.filter(c => c.status === 'suspended').length;
      const withGSTIN = data.filter(c => c.gstin).length;
      const withPriceList = data.filter(c => c.price_list).length;
      const withCode = data.filter(c => c.code).length;
      const frozen = data.filter(c => c.is_frozen).length;
      const totalCreditLimit = data.reduce((s, c) => s + (c.outstanding_limit || 0), 0);
      const totalOutstanding = data.reduce((s, c) => s + (c.current_outstanding || 0), 0);
      const creditUtilPct = totalCreditLimit > 0 ? ((totalOutstanding / totalCreditLimit) * 100).toFixed(1) : 0;

      const byGroup = topN(groupBy(data, 'customer_group'));
      const byPriceList = topN(groupBy(data, 'price_list'));
      const byTerritory = topN(groupBy(data, 'territory'));
      const byGSTCategory = topN(groupBy(data, 'gst_category'));
      const byStatus = [
        { name: 'Active', value: active },
        { name: 'Inactive', value: inactive },
        { name: 'Suspended', value: suspended },
      ].filter(d => d.value > 0);

      const risks = [];
      if (frozen > 0) risks.push(`${frozen} customer${frozen > 1 ? 's' : ''} are frozen`);
      if (suspended > 0) risks.push(`${suspended} customer${suspended > 1 ? 's' : ''} suspended`);
      const noPriceList = data.length - withPriceList;
      if (noPriceList > 0) risks.push(`${noPriceList} customers have no price list assigned`);
      const noGSTIN = data.length - withGSTIN;
      if (noGSTIN > 0) risks.push(`${noGSTIN} customers missing GSTIN`);
      const noCode = data.length - withCode;
      if (noCode > 0) risks.push(`${noCode} customers have no customer code`);
      if (parseFloat(creditUtilPct) > 80) risks.push(`High overall credit utilisation at ${creditUtilPct}%`);

      return { type: 'customers', active, inactive, suspended, withGSTIN, withPriceList, withCode, frozen, totalCreditLimit, totalOutstanding, creditUtilPct, byGroup, byPriceList, byTerritory, byGSTCategory, byStatus, risks };
    }

    if (type === 'orders') {
      const total = data.length;
      const totalValue = data.reduce((s, o) => s + (o.total_amount || 0), 0);
      const avgOrder = total > 0 ? totalValue / total : 0;
      const byStatus = topN(groupBy(data, 'status'));
      const byPlatform = topN(groupBy(data, 'platform'));
      const byCustomer = topN(groupBy(data, 'customer_name'));
      const cancelled = data.filter(o => o.status === 'cancelled').length;
      const draft = data.filter(o => o.status === 'draft').length;
      const risks = [];
      if (draft > 0) risks.push(`${draft} orders still in draft`);
      if (cancelled > 0) risks.push(`${cancelled} orders cancelled`);

      return { type: 'orders', total, totalValue, avgOrder, byStatus, byPlatform, byCustomer, risks };
    }

    if (type === 'invoices') {
      const total = data.length;
      const totalValue = data.reduce((s, i) => s + (i.total_amount || 0), 0);
      const overdue = data.filter(i => i.status === 'overdue').length;
      const paid = data.filter(i => i.status === 'paid').length;
      const partial = data.filter(i => i.status === 'partially_paid').length;
      const byStatus = topN(groupBy(data, 'status'));
      const byCustomer = topN(groupBy(data, 'customer_name'));
      const risks = [];
      if (overdue > 0) risks.push(`${overdue} invoices are overdue`);
      const unpaid = data.filter(i => ['sent', 'partially_paid', 'overdue'].includes(i.status));
      const unpaidValue = unpaid.reduce((s, i) => s + (i.total_amount || 0), 0);
      if (unpaidValue > 0) risks.push(`${fmt(unpaidValue)} in unpaid / partially paid invoices`);

      return { type: 'invoices', total, totalValue, paid, partial, overdue, byStatus, byCustomer, risks };
    }

    // generic fallback
    const byStatus = topN(groupBy(data, 'status'));
    return { type: 'generic', total: data.length, byStatus, risks: [] };
  }, [data, type]);

  if (!stats) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-900">Analytics Report — {context}</p>
            <p className="text-xs text-slate-500">Auto-computed from {data.length} records</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 space-y-6">

          {/* CUSTOMERS */}
          {stats.type === 'customers' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Customers" value={data.length} />
                <StatCard label="Active" value={stats.active} color="text-green-700" sub={`${((stats.active / data.length) * 100).toFixed(0)}% of total`} />
                <StatCard label="Total Credit Limit" value={fmt(stats.totalCreditLimit)} />
                <StatCard label="Credit Utilisation" value={`${stats.creditUtilPct}%`} color={parseFloat(stats.creditUtilPct) > 80 ? 'text-red-600' : 'text-slate-900'} sub={`${fmt(stats.totalOutstanding)} outstanding`} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">With GSTIN</span><p className="font-bold text-slate-900 mt-0.5">{stats.withGSTIN} / {data.length}</p></div>
                <div className="bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">With Price List</span><p className="font-bold text-slate-900 mt-0.5">{stats.withPriceList} / {data.length}</p></div>
                <div className="bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">With Code</span><p className="font-bold text-slate-900 mt-0.5">{stats.withCode} / {data.length}</p></div>
                <div className="bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">Frozen</span><p className={`font-bold mt-0.5 ${stats.frozen > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.frozen}</p></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.byGroup.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">By Customer Group</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={stats.byGroup} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [v, 'Customers']} />
                        <Bar dataKey="value" fill="#0f172a" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {stats.byTerritory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">By Territory</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={stats.byTerritory} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [v, 'Customers']} />
                        <Bar dataKey="value" fill="#334155" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {stats.byPriceList.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">By Price List</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.byPriceList.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-700 font-medium">{d.name}</span>
                        <span className="text-slate-400">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ORDERS */}
          {stats.type === 'orders' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Total Orders" value={stats.total} />
                <StatCard label="Total Value" value={fmt(stats.totalValue)} />
                <StatCard label="Average Order Value" value={fmt(stats.avgOrder)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.byStatus.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">By Status</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={stats.byStatus} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [v, 'Orders']} />
                        <Bar dataKey="value" fill="#0f172a" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {stats.byPlatform.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">By Platform</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={stats.byPlatform} layout="vertical" margin={{ left: 0, right: 16 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [v, 'Orders']} />
                        <Bar dataKey="value" fill="#334155" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              {stats.byCustomer.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Top Customers by Order Count</p>
                  <div className="space-y-1.5">
                    {stats.byCustomer.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 w-4 text-right">{i + 1}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                          <div className="absolute left-0 top-0 h-full bg-slate-800 rounded-full" style={{ width: `${(d.value / stats.byCustomer[0].value) * 100}%` }} />
                          <span className="absolute left-2 top-0 h-full flex items-center text-white font-medium z-10">{d.name}</span>
                        </div>
                        <span className="text-slate-700 font-medium w-6 text-right">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* INVOICES */}
          {stats.type === 'invoices' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Invoices" value={stats.total} />
                <StatCard label="Total Value" value={fmt(stats.totalValue)} />
                <StatCard label="Paid" value={stats.paid} color="text-green-700" />
                <StatCard label="Overdue" value={stats.overdue} color={stats.overdue > 0 ? 'text-red-600' : 'text-slate-900'} />
              </div>
              {stats.byStatus.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">By Status</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={stats.byStatus} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [v, 'Invoices']} />
                      <Bar dataKey="value" fill="#0f172a" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {/* RISKS */}
          {stats.risks.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-semibold text-amber-800">Attention Required</p>
              </div>
              {stats.risks.map((r, i) => (
                <p key={i} className="text-xs text-amber-700">• {r}</p>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}