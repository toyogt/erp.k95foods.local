import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { GripVertical, Trash2 } from 'lucide-react';

export default function LblJobRowEditor({ index, job, products, onUpdate, onRemove }) {
  const handleProductChange = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      onUpdate(index, 'sku_code', prod.item_code || prod.id);
      onUpdate(index, 'product_name', prod.product_name || prod.item_name || '');
      onUpdate(index, 'bottle_type', prod.bottle_type || prod.container_type || '');
      onUpdate(index, 'mrp', prod.mrp || '');
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-300" />
          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">Priority #{job.priority_order}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => onRemove(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Product</Label>
          <Select value={job.sku_code ? products.find(p => (p.item_code || p.id) === job.sku_code)?.id || '' : ''} onValueChange={handleProductChange}>
            <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.item_code || p.id} — {p.product_name || p.item_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Planned Bottles</Label>
          <Input type="number" value={job.quantity_bottles_planned || ''} onChange={e => onUpdate(index, 'quantity_bottles_planned', Number(e.target.value))} placeholder="0" className="h-11 md:h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Planned Cases</Label>
          <Input type="number" value={job.quantity_cases_planned || ''} onChange={e => onUpdate(index, 'quantity_cases_planned', Number(e.target.value))} placeholder="0" className="h-11 md:h-9" />
        </div>
      </div>
      {job.product_name && (
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Product: {job.product_name}</span>
          {job.bottle_type && <span>Bottle: {job.bottle_type}</span>}
          {job.mrp && <span>MRP: ₹{job.mrp}</span>}
        </div>
      )}
    </div>
  );
}