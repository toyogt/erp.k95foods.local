import { useState } from 'react';
import { formatDateDDMMYYYY } from './purchaseHelpers';
import CreatableSupplierSelect from './CreatableSupplierSelect';

export default function POCreateDetailsTab({ form, setForm, user }) {
  const today = new Date().toISOString().split('T')[0];

  function updateField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Row 1: Date + Company */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Date *</label>
          <input
            type="date"
            className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1 bg-white"
            value={form.po_date || today}
            onChange={e => updateField('po_date', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Company *</label>
          <input
            className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1 bg-slate-50"
            value="K95 Foods Private Limited"
            readOnly
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">Required By</label>
          <input
            type="date"
            className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1 bg-white"
            value={form.due_date || ''}
            onChange={e => updateField('due_date', e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Supplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <CreatableSupplierSelect
            value={form.supplier_name || ''}
            onChange={s => setForm(prev => ({
              ...prev,
              supplier_id: s.supplier_id || '',
              supplier_name: s.supplier_name || '',
              supplier_gstin: s.gstin || '',
              supplier_address: s.address ? `${s.address}${s.city ? ', ' + s.city : ''}${s.state ? ', ' + s.state : ''}` : '',
              supplier_contact: s.contact_name || '',
              supplier_email: s.email || '',
            }))}
            user={user}
            showClear
          />
          {form.supplier_id && (
            <p className="text-xs text-slate-500 mt-1">
              Get Items from Open Material Requests
              <br />
              <span className="text-slate-400">Fetch items based on Default Supplier.</span>
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Payment Terms</label>
            <select
              className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm bg-white mt-1"
              value={form.payment_terms || ''}
              onChange={e => updateField('payment_terms', e.target.value)}
            >
              <option value="">Select</option>
              <option value="Advance">Advance</option>
              <option value="On Delivery">On Delivery</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          {form.payment_terms === 'Custom' && (
            <div>
              <label className="text-xs font-medium text-slate-700">Custom Payment Terms</label>
              <input
                className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1"
                value={form.custom_payment_terms || ''}
                onChange={e => updateField('custom_payment_terms', e.target.value)}
                placeholder="Enter custom payment terms"
              />
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Delivery + Quotation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-700">Delivery Address</label>
          <textarea
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
            value={form.delivery_address || ''}
            onChange={e => updateField('delivery_address', e.target.value)}
            placeholder="K95 Foods Pvt Ltd, Factory Address"
          />
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700">Quotation Reference</label>
            <input
              className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1"
              value={form.quotation_number || ''}
              onChange={e => updateField('quotation_number', e.target.value)}
              placeholder="Quotation number"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Ship Via</label>
            <input
              className="w-full h-11 md:h-9 border border-slate-200 rounded-lg px-3 text-sm mt-1"
              value={form.ship_via || ''}
              onChange={e => updateField('ship_via', e.target.value)}
              placeholder="Transporter name"
            />
          </div>
        </div>
      </div>
    </div>
  );
}