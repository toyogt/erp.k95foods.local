import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import LblBatchSelect from '@/components/labelling/LblBatchSelect';
import { generateBatchNumber } from '@/lib/batchNumberGenerator';
import { canManagePlans } from '@/lib/labellingHelpers';
import { Hash, Info, Lock } from 'lucide-react';
import { Loader2, Save } from 'lucide-react';
import moment from 'moment';

const BOTTLES_PER_CASE = 12;

export default function LblJobEditModal({ open, onClose, job, products, planDate, onSave, mode = 'edit', user }) {
  const isAdd = mode === 'add';
  const todayStr = moment().format('YYYY-MM-DD');
  const todayDisplay = moment().format('DD/MM/YYYY');
  const canEditEntryDate = canManagePlans(user?.role);
  const emptyJob = { sku_code: '', product_name: '', bottle_type: '', mrp: '', entry_date: todayDisplay, manufacturing_date: planDate || '', batch_no: '', quantity_bottles_planned: 0, quantity_cases_planned: 0 };
  const [form, setForm] = useState(job || emptyJob);
  const [casesManual, setCasesManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mfgDateError, setMfgDateError] = useState('');
  const [entryDateUnlocked, setEntryDateUnlocked] = useState(false);

  // Convert stored DD/MM/YYYY to YYYY-MM-DD for native date input
  const entryDateForInput = useMemo(() => {
    const v = form.entry_date || '';
    if (!v) return '';
    if (v.includes('/')) {
      const [d, m, y] = v.split('/');
      return `${y}-${m}-${d}`;
    }
    return v;
  }, [form.entry_date]);

  const handleEntryDateChange = (value) => {
    // value from input is YYYY-MM-DD — store as DD/MM/YYYY
    if (!value) {
      setForm(f => ({ ...f, entry_date: '' }));
      return;
    }
    const formatted = moment(value).format('DD/MM/YYYY');
    setForm(f => ({ ...f, entry_date: formatted }));
  };

  const handleProductChange = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setForm(f => ({
        ...f,
        sku_code: prod.item_code || prod.id,
        product_name: prod.product_name || prod.item_name || '',
        bottle_type: prod.bottle_type || '',
        mrp: String(prod.mrp || ''),
        batch_prefix_code: prod.product_prefix_code || '',
        flavour_code: prod.flavour_code || '',
        batch_scheme: prod.batch_scheme || 'excel_date',
      }));
    }
  };

  const handleBottlesChange = (value) => {
    const bottles = Number(value) || 0;
    setForm(f => ({ ...f, quantity_bottles_planned: bottles, quantity_cases_planned: casesManual ? f.quantity_cases_planned : Math.ceil(bottles / BOTTLES_PER_CASE) }));
  };

  const handleCasesChange = (value) => {
    setCasesManual(true);
    setForm(f => ({ ...f, quantity_cases_planned: Number(value) || 0 }));
  };

  const handleMfgDateChange = (value) => {
    if (value && value > todayStr) {
      setMfgDateError('Manufacturing date cannot be a future date.');
    } else {
      setMfgDateError('');
    }
    setForm(f => ({ ...f, manufacturing_date: value }));
  };

  const handleSubmit = async () => {
    if (!form.sku_code) return;
    if (!form.quantity_bottles_planned || form.quantity_bottles_planned <= 0) return;
    if (form.manufacturing_date && form.manufacturing_date > todayStr) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  const selectedProductId = form.sku_code ? (products.find(p => (p.item_code || p.id) === form.sku_code)?.id || '') : '';

  // Live batch number preview using manufacturing date + prefix from ProductMaster
  const batchPreview = useMemo(() => {
    if (!form.batch_prefix_code || !form.flavour_code || !form.manufacturing_date) return '';
    const mfgFormatted = form.manufacturing_date.includes('/')
      ? form.manufacturing_date
      : form.manufacturing_date.split('-').reverse().join('/');
    return generateBatchNumber(
      { product_prefix_code: form.batch_prefix_code, flavour_code: form.flavour_code, batch_scheme: form.batch_scheme || 'excel_date' },
      mfgFormatted,
      1
    );
  }, [form.batch_prefix_code, form.flavour_code, form.batch_scheme, form.manufacturing_date]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>{isAdd ? 'Add Product to Plan' : 'Edit Job'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Product *</Label>
            <Select value={selectedProductId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.item_code || p.id} — {p.product_name || p.item_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {products.length === 0 && <p className="text-xs text-amber-600">No products in Product Master. Add products via SKU Setup first.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Planned Bottles *</Label>
              <Input type="number" value={form.quantity_bottles_planned || ''} onChange={e => handleBottlesChange(e.target.value)} placeholder="0" className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Planned Cases</Label>
              <Input type="number" value={form.quantity_cases_planned || ''} onChange={e => handleCasesChange(e.target.value)} placeholder="0" className="h-11 md:h-9" />
              <p className="text-xs text-slate-500">{casesManual ? 'Manual entry' : `Auto: ÷${BOTTLES_PER_CASE}`}</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                Entry Date
                {!entryDateUnlocked && <Lock className="w-3 h-3 text-slate-400" />}
              </Label>
              {canEditEntryDate && (
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
                  <Checkbox
                    checked={entryDateUnlocked}
                    onCheckedChange={(v) => setEntryDateUnlocked(!!v)}
                  />
                  Edit entry date
                </label>
              )}
            </div>
            <Input
              type="date"
              value={entryDateForInput}
              readOnly={!entryDateUnlocked}
              onChange={e => handleEntryDateChange(e.target.value)}
              className={`h-11 md:h-9 ${!entryDateUnlocked ? 'bg-slate-50 cursor-not-allowed text-slate-700' : ''}`}
            />
            <p className="text-xs text-slate-500">
              {entryDateUnlocked
                ? 'You can change the entry date.'
                : canEditEntryDate
                  ? 'Defaults to today. Tick “Edit entry date” to change.'
                  : 'Locked to today. Only a supervisor or admin can change this.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Manufacturing Date</Label>
              <Input type="date" value={form.manufacturing_date || ''} max={todayStr} onChange={e => handleMfgDateChange(e.target.value)} className={`h-11 md:h-9 ${mfgDateError ? 'border-red-400' : ''}`} />
              {mfgDateError && <p className="text-xs text-red-600">{mfgDateError}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Batch Number</Label>
              <LblBatchSelect value={form.batch_no || ''} onChange={val => setForm(f => ({ ...f, batch_no: val }))} skuCode={form.sku_code} />
            </div>
          </div>

          {/* Batch prefix info panel */}
          {(form.batch_prefix_code || form.flavour_code) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                <Hash className="w-3.5 h-3.5" /> Batch Number Formula
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-blue-900">
                {form.batch_prefix_code && <span>Prefix: <span className="font-mono font-bold">{form.batch_prefix_code}</span></span>}
                {form.flavour_code && <span>Flavour Code: <span className="font-mono font-bold">{form.flavour_code}</span></span>}
                <span>Scheme: <span className="font-semibold">{form.batch_scheme === 'day_year_seq' ? 'Day/Year/Seq' : 'Excel Date'}</span></span>
              </div>
              {batchPreview ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-700">Preview batch number:</span>
                  <span className="font-mono font-bold text-blue-900 bg-white border border-blue-200 rounded px-2 py-0.5 text-sm">{batchPreview}</span>
                  <span className="text-xs text-blue-500">(using Mfg. Date)</span>
                </div>
              ) : form.manufacturing_date ? null : (
                <p className="text-xs text-blue-600 flex items-center gap-1"><Info className="w-3 h-3" /> Set Manufacturing Date to preview batch number</p>
              )}
              {!form.batch_prefix_code && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">⚠ Prefix Code not set in Product Master — batch number must be entered manually at stock transfer</p>
              )}
            </div>
          )}

          {form.product_name && (
            <div className="flex gap-3 text-xs text-slate-500 flex-wrap bg-slate-50 rounded-lg p-2">
              <span>Product: {form.product_name}</span>
              {form.bottle_type && <span>Container: {form.bottle_type}</span>}
              {form.mrp && <span>MRP: ₹{form.mrp}</span>}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={onClose}>Cancel</Button>
          <Button className="h-11 md:h-9 gap-2" onClick={handleSubmit} disabled={saving || !form.sku_code || !form.quantity_bottles_planned || !!mfgDateError}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isAdd ? 'Add to Plan' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}