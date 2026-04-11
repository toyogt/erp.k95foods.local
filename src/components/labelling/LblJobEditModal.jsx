import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import LblBatchSelect from '@/components/labelling/LblBatchSelect';
import { Loader2, Save } from 'lucide-react';
import moment from 'moment';

const BOTTLES_PER_CASE = 12;

export default function LblJobEditModal({ open, onClose, job, products, planDate, onSave, mode = 'edit' }) {
  const isAdd = mode === 'add';
  const emptyJob = { sku_code: '', product_name: '', bottle_type: '', mrp: '', manufacturing_date: planDate || '', batch_no: '', quantity_bottles_planned: 0, quantity_cases_planned: 0 };
  const [form, setForm] = useState(job || emptyJob);
  const [casesManual, setCasesManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleProductChange = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setForm(f => ({ ...f, sku_code: prod.item_code || prod.id, product_name: prod.product_name || prod.item_name || '', bottle_type: prod.bottle_type || '', mrp: String(prod.mrp || '') }));
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

  const handleSubmit = async () => {
    if (!form.sku_code) return;
    if (!form.quantity_bottles_planned || form.quantity_bottles_planned <= 0) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  const selectedProductId = form.sku_code ? (products.find(p => (p.item_code || p.id) === form.sku_code)?.id || '') : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Manufacturing Date</Label>
              <Input type="date" value={form.manufacturing_date || ''} onChange={e => setForm(f => ({ ...f, manufacturing_date: e.target.value }))} className="h-11 md:h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Batch Number</Label>
              <LblBatchSelect value={form.batch_no || ''} onChange={val => setForm(f => ({ ...f, batch_no: val }))} skuCode={form.sku_code} />
            </div>
          </div>

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
          <Button className="h-11 md:h-9 gap-2" onClick={handleSubmit} disabled={saving || !form.sku_code || !form.quantity_bottles_planned}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isAdd ? 'Add to Plan' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}