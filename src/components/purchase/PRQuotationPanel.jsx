import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, CheckCircle2, Upload, Camera, X } from 'lucide-react';
import CreatableSupplierSelect from './CreatableSupplierSelect';
import { formatINR } from './purchaseHelpers';

export default function PRQuotationPanel({ prNumber, items, user }) {
  const [addingFor, setAddingFor] = useState(null);
  const [form, setForm] = useState({ supplier_id: '', supplier_name: '', quoted_rate: '', quotation_document: '', sample_requested: false, remarks: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['pr-quotations', prNumber],
    queryFn: () => base44.entities.PRQuotation.filter({ pr_number: prNumber }, 'created_date', 200),
    staleTime: 15000,
  });

  function getQuotationsForItem(lineNumber) {
    return quotations.filter(q => q.line_number === lineNumber);
  }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, quotation_document: file_url }));
    setUploading(false);
  }

  async function handleSave() {
    if (!form.supplier_name || !form.quoted_rate) return;
    setSaving(true);
    await base44.entities.PRQuotation.create({
      pr_number: prNumber,
      line_number: addingFor,
      supplier_id: form.supplier_id,
      supplier_name: form.supplier_name,
      quoted_rate: Number(form.quoted_rate),
      quotation_document: form.quotation_document,
      sample_requested: form.sample_requested,
      remarks: form.remarks,
    });
    setForm({ supplier_id: '', supplier_name: '', quoted_rate: '', quotation_document: '', sample_requested: false, remarks: '' });
    setAddingFor(null);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ['pr-quotations', prNumber] });
  }

  async function toggleSelected(quotationId, currentVal) {
    await base44.entities.PRQuotation.update(quotationId, { is_selected: !currentVal });
    queryClient.invalidateQueries({ queryKey: ['pr-quotations', prNumber] });
  }

  async function markSampleReceived(quotationId) {
    await base44.entities.PRQuotation.update(quotationId, { sample_received: true });
    queryClient.invalidateQueries({ queryKey: ['pr-quotations', prNumber] });
  }

  async function uploadSamplePhoto(quotationId, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.PRQuotation.update(quotationId, { sample_photo: file_url });
    queryClient.invalidateQueries({ queryKey: ['pr-quotations', prNumber] });
  }

  const approvedItems = items.filter(it => it.item_status === 'Approved' || it.item_status === 'Pending');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Quotation Management</h3>

      {approvedItems.map(it => {
        const itemQuotations = getQuotationsForItem(it.line_number);
        const selected = itemQuotations.find(q => q.is_selected);
        return (
          <div key={it.id || it.line_number} className="border border-slate-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">#{it.line_number} {it.item_name}</p>
                <p className="text-xs text-slate-500">Qty: {it.qty || it.quantity} {it.unit || it.uom_code}</p>
              </div>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setAddingFor(it.line_number)}>
                <Plus className="w-3 h-3" /> Add Quotation
              </Button>
            </div>

            {itemQuotations.length > 0 && (
              <div className="space-y-1.5">
                {itemQuotations.map(q => (
                  <div key={q.id} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${q.is_selected ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{q.supplier_name}</p>
                      <p className="text-xs text-slate-500">{formatINR(q.quoted_rate)} per unit{q.sample_requested && !q.sample_received ? ' · Sample pending' : ''}{q.sample_received ? ' · Sample received' : ''}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {q.sample_requested && !q.sample_received && (
                        <button onClick={() => markSampleReceived(q.id)} className="text-xs text-green-600 font-medium">Sample In</button>
                      )}
                      {q.sample_received && !q.sample_photo && (
                        <label className="text-xs text-blue-600 font-medium cursor-pointer"><Camera className="w-3.5 h-3.5 inline mr-0.5" />Photo<input type="file" accept="image/*" className="hidden" onChange={e => uploadSamplePhoto(q.id, e)} /></label>
                      )}
                      <button onClick={() => toggleSelected(q.id, q.is_selected)} className={`text-xs font-bold px-2 py-1 rounded ${q.is_selected ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-green-100'}`}>
                        {q.is_selected ? <><CheckCircle2 className="w-3 h-3 inline mr-0.5" />Selected</> : 'Select'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingFor === it.line_number && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <CreatableSupplierSelect value={form.supplier_name} onChange={s => setForm(prev => ({ ...prev, supplier_id: s.supplier_id, supplier_name: s.supplier_name }))} user={user} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Quoted Rate *</label>
                    <input type="number" className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1" value={form.quoted_rate} onChange={e => setForm(prev => ({ ...prev, quoted_rate: e.target.value }))} placeholder="₹" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">Document</label>
                    <label className="flex items-center gap-1 mt-1 h-9 px-3 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:bg-slate-50">
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}{form.quotation_document ? 'Uploaded' : 'Upload'}
                      <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded" checked={form.sample_requested} onChange={e => setForm(prev => ({ ...prev, sample_requested: e.target.checked }))} /> Request physical sample
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setAddingFor(null)}>Cancel</Button>
                  <Button size="sm" className="h-9 bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={saving || !form.supplier_name || !form.quoted_rate}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Quotation'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}