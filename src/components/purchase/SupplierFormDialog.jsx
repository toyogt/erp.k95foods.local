import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export default function SupplierFormDialog({ open, onClose, supplier, onSave, saving }) {
  const isEdit = !!supplier?.id;
  const [form, setForm] = useState(() => ({
    supplier_id: supplier?.supplier_id || '',
    supplier_name: supplier?.supplier_name || '',
    approval_status: supplier?.approval_status || 'HOLD',
    gstin: supplier?.gstin || '',
    contact_name: supplier?.contact_name || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    payment_terms_days: supplier?.payment_terms_days ?? '',
    default_currency: supplier?.default_currency || 'INR',
    address: supplier?.address || '',
    bank_details: supplier?.bank_details || '',
    notes: supplier?.notes || '',
  }));

  function setF(field, val) {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'approval_status') updated.is_approved = val === 'APPROVED';
      return updated;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplier_name.trim()) return;
    onSave(form, isEdit ? supplier.id : null);
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 h-11 md:h-9 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const textareaCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y';
  const labelCls = 'text-xs font-medium text-slate-700';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Supplier Name */}
          <div>
            <label className={labelCls}>Supplier Name *</label>
            <input className={inputCls + ' mt-1'} placeholder="Enter supplier name"
              value={form.supplier_name} onChange={e => setF('supplier_name', e.target.value)} autoFocus />
          </div>

          {/* Status + GSTIN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls + ' mt-1'} value={form.approval_status} onChange={e => setF('approval_status', e.target.value)}>
                <option value="HOLD">Hold</option>
                <option value="APPROVED">Approved</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>GSTIN</label>
              <input className={inputCls + ' mt-1'} placeholder="e.g. 29AABCU9603R1ZM"
                value={form.gstin} onChange={e => setF('gstin', e.target.value)} />
            </div>
          </div>

          {/* Contact + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input className={inputCls + ' mt-1'} placeholder="Contact person"
                value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls + ' mt-1'} placeholder="Phone number"
                value={form.phone} onChange={e => setF('phone', e.target.value)} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls + ' mt-1'} placeholder="supplier@example.com" type="email"
              value={form.email} onChange={e => setF('email', e.target.value)} />
          </div>

          {/* Payment Terms + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Terms (days)</label>
              <input className={inputCls + ' mt-1'} placeholder="e.g. 30" type="number"
                value={form.payment_terms_days} onChange={e => setF('payment_terms_days', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input className={inputCls + ' mt-1'} placeholder="INR"
                value={form.default_currency} onChange={e => setF('default_currency', e.target.value)} />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelCls}>Address</label>
            <textarea className={textareaCls + ' mt-1'} rows={2} placeholder="Full address"
              value={form.address} onChange={e => setF('address', e.target.value)} />
          </div>

          {/* Bank Details */}
          <div>
            <label className={labelCls}>Bank Details</label>
            <textarea className={textareaCls + ' mt-1'} rows={2} placeholder="Account number, IFSC, bank name"
              value={form.bank_details} onChange={e => setF('bank_details', e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={textareaCls + ' mt-1'} rows={2} placeholder="Any additional notes"
              value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onClose(false)} className="flex-1 h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.supplier_name.trim()} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEdit ? 'Update Supplier' : 'Create Supplier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}