/**
 * Inline "Set Now" prompt for missing product details.
 * Shows a compact "Not Set — Set Now" button, on click shows an inline input.
 * On confirm, updates the ProductMaster record directly.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';

export default function SetProductDetailInline({ productId, sku, fieldKey, fieldLabel, fieldType = 'number', onUpdated }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const numVal = fieldType === 'number' ? parseFloat(value) : value;
    if (fieldType === 'number' && (!numVal || numVal <= 0)) {
      toast({ title: `Please enter a valid ${fieldLabel}`, variant: 'destructive' });
      return;
    }
    if (!productId) {
      toast({ title: `Product not found for ${sku}. Update it from Product Master.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    await base44.entities.ProductMaster.update(productId, { [fieldKey]: numVal });
    setSaving(false);
    toast({ title: `${fieldLabel} updated for ${sku}` });
    setEditing(false);
    setValue('');
    if (onUpdated) onUpdated();
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded px-1.5 py-0.5 transition-colors"
      >
        <AlertCircle className="w-3 h-3" />
        <span className="text-xs font-medium">Not Set</span>
        <span className="text-xs text-blue-600 font-semibold ml-0.5">· Set Now</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type={fieldType}
        className="h-7 w-20 text-xs px-2"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={fieldLabel}
        autoFocus
        min={fieldType === 'number' ? 0.01 : undefined}
        step={fieldType === 'number' ? 'any' : undefined}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setEditing(false); setValue(''); }
        }}
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-6 h-6 rounded flex items-center justify-center bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button
        onClick={() => { setEditing(false); setValue(''); }}
        className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-slate-200"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}