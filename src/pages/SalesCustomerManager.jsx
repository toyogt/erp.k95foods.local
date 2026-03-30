import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Search, Download, Plus, Edit2, Loader2, Users, Tag, Upload, FileDown, Trash2, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import BulkActionBar from '@/components/sales/BulkActionBar';
import BulkCSVUploadModal from '@/components/sales/BulkCSVUploadModal';
import CustomerImportModal from '@/components/sales/CustomerImportModal';
import CustomerFormDrawer, { BLANK_CUSTOMER } from '@/components/sales/CustomerFormDrawer';
import SalesAnalyticsPanel from '@/components/sales/SalesAnalyticsPanel';

function exportCSV(rows) {
  const headers = ['Name', 'Code', 'GSTIN', 'PAN', 'Phone', 'Email', 'Customer Group', 'Price List', 'GST Category', 'Place of Supply', 'Payment Terms', 'Status', 'Credit Limit', 'Current Outstanding'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.name, r.code, r.gstin, r.pan, r.phone, r.email, r.customer_group,
      r.price_list, r.gst_category, r.place_of_supply, r.payment_terms, r.status,
      r.outstanding_limit, r.current_outstanding,
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'customers.csv'; a.click();
}



const CSV_TEMPLATE_COLUMNS = [
  { key: 'name', label: 'Name', example: 'Swiggy Pvt Ltd' },
  { key: 'code', label: 'Code', example: 'SW001' },
  { key: 'customer_group', label: 'Customer Group', example: 'Quick Commerce' },
  { key: 'price_list', label: 'Price List', example: 'Swiggy Rate' },
  { key: 'payment_terms', label: 'Payment Terms', example: 'Net 30' },
  { key: 'status', label: 'Status', example: 'active' },
  { key: 'region', label: 'Region', example: 'Mumbai' },
  { key: 'gstin', label: 'GSTIN', example: '27AAACS1234A1Z5' },
  { key: 'phone', label: 'Phone', example: '9876543210' },
  { key: 'email', label: 'Email', example: 'accounts@swiggy.com' },
  { key: 'outstanding_limit', label: 'Credit Limit', example: '500000' },
];

export default function SalesCustomerManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterPriceList, setFilterPriceList] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers_all'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const { data: allRates = [] } = useQuery({
    queryKey: ['sales_rate_list_all'],
    queryFn: () => base44.entities.SalesRateList.list('-created_date', 1000),
  });

  const priceLists = [...new Set(allRates.map(r => r.price_list).filter(Boolean))].sort();
  const customerGroups = [...new Set(customers.map(c => c.customer_group).filter(Boolean))].sort();

  const filtered = customers.filter(c => {
    const s = search.toLowerCase();
    const matchSearch = !search || c.name?.toLowerCase().includes(s) || c.gstin?.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
    const matchPL = !filterPriceList || c.price_list === filterPriceList;
    const matchStatus = !filterStatus || c.status === filterStatus;
    const matchGroup = !filterGroup || c.customer_group === filterGroup;
    return matchSearch && matchPL && matchStatus && matchGroup;
  });

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortCol] ?? '';
    let bv = b[sortCol] ?? '';
    if (typeof av === 'number' || typeof bv === 'number') {
      av = Number(av) || 0; bv = Number(bv) || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    av = String(av).toLowerCase(); bv = String(bv).toLowerCase();
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const allFilteredIds = filtered.map(c => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  }

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const BULK_ACTIONS = [
    {
      key: 'price_list',
      label: 'Assign Price List',
      type: 'select',
      options: priceLists.map(p => ({ value: p, label: p })),
    },
    {
      key: 'customer_group',
      label: 'Set Customer Group',
      type: customerGroups.length > 0 ? 'select' : 'text',
      options: customerGroups.map(g => ({ value: g, label: g })),
    },
    {
      key: 'status',
      label: 'Mark Active',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'suspended', label: 'Suspended' },
      ],
    },
    {
      key: 'payment_terms',
      label: 'Set Payment Terms',
      type: 'text',
    },
    {
      key: 'region',
      label: 'Set Region',
      type: 'text',
    },
    {
      key: '__delete__',
      label: 'Delete Selected',
      type: 'confirm',
      danger: true,
    },
  ];

  async function handleBulkApply(key, value) {
    if (key === '__delete__') {
      if (!window.confirm(`Delete ${selected.size} selected customers? This cannot be undone.`)) return;
      setDeleting(true);
      const ids = [...selected];
      await Promise.all(ids.map(id => base44.entities.Customer.delete(id)));
      toast({ title: `${ids.length} customers deleted` });
      setSelected(new Set());
      setDeleting(false);
      qc.invalidateQueries(['customers_all']);
      return;
    }
    setApplying(true);
    const ids = [...selected];
    await Promise.all(ids.map(id => base44.entities.Customer.update(id, { [key]: value })));
    toast({ title: 'Bulk update applied', description: `${ids.length} customers updated (${key} → ${value})` });
    setSelected(new Set());
    setApplying(false);
    qc.invalidateQueries(['customers_all']);
  }

  async function handleDeleteSingle(c) {
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    await base44.entities.Customer.delete(c.id);
    toast({ title: 'Customer deleted' });
    qc.invalidateQueries(['customers_all']);
  }

  async function handleCSVUpdate(rows) {
    let count = 0;
    for (const row of rows) {
      const match = customers.find(c =>
        c.name?.toLowerCase() === row.name?.toLowerCase() ||
        c.code?.toLowerCase() === row.code?.toLowerCase() ||
        c.gstin?.toLowerCase() === row.gstin?.toLowerCase()
      );
      if (!match) continue;
      const updates = {};
      if (row.customer_group) updates.customer_group = row.customer_group;
      if (row.price_list) updates.price_list = row.price_list;
      if (row.payment_terms) updates.payment_terms = row.payment_terms;
      if (row.status) updates.status = row.status;
      if (row.region) updates.region = row.region;
      if (row.phone) updates.phone = row.phone;
      if (row.email) updates.email = row.email;
      if (row['credit limit'] || row.outstanding_limit) updates.outstanding_limit = parseFloat(row['credit limit'] || row.outstanding_limit) || 0;
      if (Object.keys(updates).length > 0) {
        await base44.entities.Customer.update(match.id, updates);
        count++;
      }
    }
    qc.invalidateQueries(['customers_all']);
    return count;
  }

  function openNew() { setEditing(null); setForm(BLANK_CUSTOMER); setShowForm(true); }
  function openEdit(c) { setEditing(c); setForm({ ...BLANK_CUSTOMER, ...c }); setShowForm(true); }

  function generateCode(existingCodes, prefix = 'CUST') {
    const nums = existingCodes.filter(c => c?.startsWith(prefix + '-')).map(c => parseInt(c.replace(prefix + '-', ''), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  async function assignMissingCodes() {
    const missing = customers.filter(c => !c.code);
    if (missing.length === 0) { toast({ title: 'All customers already have codes' }); return; }
    setSaving(true);
    let allCodes = customers.map(c => c.code).filter(Boolean);
    for (const c of missing) {
      const code = generateCode(allCodes);
      await base44.entities.Customer.update(c.id, { code });
      allCodes.push(code);
    }
    toast({ title: `Codes assigned to ${missing.length} customers` });
    setSaving(false);
    qc.invalidateQueries(['customers_all']);
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Master</h1>
          <p className="text-sm text-slate-500">{customers.length} customers · Manage profiles and price list assignments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-11 text-sm" onClick={() => exportCSV(filtered)}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" className="h-11 text-sm" onClick={assignMissingCodes} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Tag className="w-4 h-4 mr-2" />}
            Assign Codes
          </Button>
          <Button variant="outline" className="h-11 text-sm" onClick={() => setShowImportModal(true)}>
            <FileDown className="w-4 h-4 mr-2" /> Import Customers
          </Button>
          <Button variant="outline" className="h-11 text-sm" onClick={() => setShowCSVModal(true)}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Update CSV
          </Button>
          <Link to="/SalesPriceListView">
            <Button variant="outline" className="h-11 text-sm">
              <Tag className="w-4 h-4 mr-2" /> Price Lists
            </Button>
          </Link>
          <Button className="h-11 text-sm bg-slate-900 text-white" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search name, GSTIN, code, email..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
            <option value="">All Groups</option>
            {customerGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterPriceList} onChange={e => setFilterPriceList(e.target.value)}>
            <option value="">All Price Lists</option>
            {priceLists.map(pl => <option key={pl} value={pl}>{pl}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          {(search || filterPriceList || filterStatus || filterGroup) && (
            <button onClick={() => { setSearch(''); setFilterPriceList(''); setFilterStatus(''); setFilterGroup(''); }} className="h-9 px-3 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md">Clear</button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-medium">
            {selected.size} of {filtered.length} customers selected — use the action bar below to apply bulk changes
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center"><Users className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">No customers found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
                  <th className="px-3 py-2.5 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                  </th>
                  {[['name','Customer Name','text-left'],['code','Code','text-left'],['gstin','GSTIN','text-left'],['customer_group','Group','text-left'],['price_list','Price List','text-left'],['payment_terms','Payment Terms','text-left'],['outstanding_limit','Credit Limit','text-right'],['current_outstanding','Outstanding','text-right'],['status','Status','text-center']].map(([col, label, align]) => (
                    <th key={col} className={`px-3 py-2.5 ${align} cursor-pointer select-none hover:bg-slate-100`} onClick={() => handleSort(col)}>
                      <span className="inline-flex items-center gap-1">{label}{sortCol === col ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50 ${selected.has(c.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRow(c.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs font-mono">{c.code || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs font-mono">{c.gstin || '—'}</td>
                    <td className="px-3 py-2">
                      {c.customer_group ? (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{c.customer_group}</span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {c.price_list ? (
                        <Link to={`/SalesPriceListView?list=${encodeURIComponent(c.price_list)}`} className="text-blue-600 hover:underline text-xs font-medium">{c.price_list}</Link>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{c.payment_terms || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{c.outstanding_limit ? `₹${Number(c.outstanding_limit).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{c.current_outstanding ? `₹${Number(c.current_outstanding).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : c.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-900 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteSingle(c)} className="text-slate-300 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selected.size}
        onClearSelection={() => setSelected(new Set())}
        actions={BULK_ACTIONS}
        onApply={handleBulkApply}
        applying={applying}
      />

      {/* Import New Customers Modal */}
      {showImportModal && (
        <CustomerImportModal
          existingCustomers={customers}
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); qc.invalidateQueries(['customers_all']); }}
        />
      )}

      {/* CSV Bulk Update Modal */}
      {showCSVModal && (
        <BulkCSVUploadModal
          entityName="Customer"
          templateColumns={CSV_TEMPLATE_COLUMNS}
          onUpdate={handleCSVUpdate}
          onClose={() => setShowCSVModal(false)}
          templateFilename="customers_bulk_update.csv"
        />
      )}

      {/* AI Analytics */}
      <SalesAnalyticsPanel
        context="Customer Master"
        data={customers}
        type="customers"
      />

      {/* Form Drawer */}
      {showForm && (
        <CustomerFormDrawer
          editing={editing}
          form={form}
          setForm={setForm}
          priceLists={priceLists}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries(['customers_all']); }}
        />
      )}
    </div>
  );
}