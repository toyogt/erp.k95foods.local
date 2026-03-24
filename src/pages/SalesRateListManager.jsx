import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Upload, Download, Edit2, X, Check, Loader2, Search } from 'lucide-react';

const SAMPLE_CSV = `item_code,item_name,hsn_code,uom,price_list,rate,mrp,igst_rate,packing_unit,brand,valid_from,valid_upto
TK-GL-330,Toyo Kombucha Original Low Sugar Glass Bottle 330ML,22029990,Pcs,30% Margin,44.11,95,40,12,Toyo Kombucha,2026-01-01,2026-12-31`;

export default function SalesRateListManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    item_code: '', item_name: '', hsn_code: '22029990', uom: 'Pcs',
    price_list: '30% Margin', rate: '', mrp: '', igst_rate: 40,
    packing_unit: 12, brand: 'Toyo Kombucha', currency: 'INR',
    valid_from: '', valid_upto: '', is_active: true, notes: '',
  });

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ['sales_rate_list'],
    queryFn: () => base44.entities.SalesRateList.list('-created_date', 200),
  });

  const filtered = rates.filter(r =>
    !search || r.item_code?.toLowerCase().includes(search.toLowerCase()) ||
    r.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.price_list?.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() {
    setEditing(null);
    setForm({ item_code: '', item_name: '', hsn_code: '22029990', uom: 'Pcs', price_list: '30% Margin', rate: '', mrp: '', igst_rate: 40, packing_unit: 12, brand: 'Toyo Kombucha', currency: 'INR', valid_from: '', valid_upto: '', is_active: true, notes: '' });
    setShowForm(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({ ...r, rate: r.rate ?? '', mrp: r.mrp ?? '', igst_rate: r.igst_rate ?? 40 });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.item_code || !form.rate) {
      toast({ title: 'Item Code and Rate are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const data = { ...form, rate: parseFloat(form.rate), mrp: parseFloat(form.mrp) || 0, igst_rate: parseFloat(form.igst_rate) || 40, packing_unit: parseInt(form.packing_unit) || 12 };

    if (editing) {
      await base44.entities.SalesRateList.update(editing.id, data);
      await base44.entities.SalesAuditLog.create({ entity_type: 'SalesRateList', entity_id: editing.id, reference_number: form.item_code, action: 'rate_updated', new_value: `Rate: ${form.rate}`, user_email: user?.email });
      toast({ title: 'Rate updated' });
    } else {
      const r = await base44.entities.SalesRateList.create(data);
      await base44.entities.SalesAuditLog.create({ entity_type: 'SalesRateList', entity_id: r.id, reference_number: form.item_code, action: 'rate_created', user_email: user?.email });
      toast({ title: 'Rate created' });
    }
    setSaving(false);
    setShowForm(false);
    qc.invalidateQueries(['sales_rate_list']);
  }

  async function handleCSVUpload(file) {
    setUploading(true);
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    let created = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx]?.trim() || ''; });
      if (!row.item_code || !row.rate) continue;
      await base44.entities.SalesRateList.create({
        item_code: row.item_code,
        item_name: row.item_name || '',
        hsn_code: row.hsn_code || '22029990',
        uom: row.uom || 'Pcs',
        price_list: row.price_list || '30% Margin',
        rate: parseFloat(row.rate) || 0,
        mrp: parseFloat(row.mrp) || 0,
        igst_rate: parseFloat(row.igst_rate) || 40,
        packing_unit: parseInt(row.packing_unit) || 12,
        brand: row.brand || '',
        valid_from: row.valid_from || '',
        valid_upto: row.valid_upto || '',
        currency: 'INR',
        is_active: true,
      });
      created++;
    }
    setUploading(false);
    toast({ title: `Uploaded ${created} rates` });
    qc.invalidateQueries(['sales_rate_list']);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rate_list_sample.csv';
    a.click();
  }

  return (
    <div className="p-3 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Rate List Manager</h1>
          <p className="text-sm text-slate-500">Manage product selling rates — changes apply to new orders only</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-11 text-sm" onClick={downloadSample}>
            <Download className="w-4 h-4 mr-2" /> Sample CSV
          </Button>
          <Button variant="outline" className="h-11 text-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Bulk Upload CSV
          </Button>
          <Button className="h-11 text-sm bg-slate-900 text-white" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Add Rate
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { if (e.target.files[0]) handleCSVUpload(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search by item code, name, or price list..." className="pl-9 h-9 text-sm"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading rates...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No rates found. Add manually or upload a CSV.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-700 font-medium">
                  <th className="px-3 py-2.5 text-left">Item Code</th>
                  <th className="px-3 py-2.5 text-left">Item Name</th>
                  <th className="px-3 py-2.5 text-left">Price List</th>
                  <th className="px-3 py-2.5 text-right">Rate (INR)</th>
                  <th className="px-3 py-2.5 text-right">MRP</th>
                  <th className="px-3 py-2.5 text-right">IGST %</th>
                  <th className="px-3 py-2.5 text-right">Pack Unit</th>
                  <th className="px-3 py-2.5 text-center">Active</th>
                  <th className="px-3 py-2.5 text-left">Valid Upto</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.item_code}</td>
                    <td className="px-3 py-2 text-slate-800 max-w-xs truncate">{r.item_name}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{r.price_list}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">₹{r.rate}</td>
                    <td className="px-3 py-2 text-right text-slate-600">₹{r.mrp || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.igst_rate}%</td>
                    <td className="px-3 py-2 text-right text-slate-600">{r.packing_unit || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{r.valid_upto || '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => openEdit(r)} className="text-slate-400 hover:text-slate-900">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{editing ? 'Edit Rate' : 'Add Rate'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['item_code', 'Item Code *', 'text'],
                ['item_name', 'Item Name', 'text'],
                ['hsn_code', 'HSN Code', 'text'],
                ['uom', 'Unit of Measure', 'text'],
                ['price_list', 'Price List', 'text'],
                ['rate', 'Rate (INR) *', 'number'],
                ['mrp', 'MRP', 'number'],
                ['igst_rate', 'IGST Rate %', 'number'],
                ['packing_unit', 'Packing Unit (bottles/box)', 'number'],
                ['brand', 'Brand', 'text'],
                ['valid_from', 'Valid From', 'date'],
                ['valid_upto', 'Valid Upto', 'date'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <Label className="text-xs font-medium text-slate-700">{label}</Label>
                  <Input type={type} className="h-9 text-sm mt-1" value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="is_active" className="text-sm text-slate-700">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-slate-100">
              <Button variant="outline" className="h-11 px-4" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="h-11 bg-slate-900 text-white" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}