import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, AlertCircle, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function ItemRow({ idx, item, stockByLot, onChange, onRemove }) {
  const available = item.lot_id ? (stockByLot[item.lot_id] || []) : [];
  const totalAvail = available.reduce((s, b) => s + (b.quantity || 0), 0);

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Item {idx + 1}</p>
        <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
          <Input className="h-9 text-sm mt-1" placeholder="Item name or code" value={item.item_name || ''} onChange={e => onChange(idx, 'item_name', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Lot ID (scan or type) *</Label>
          <Input className="h-9 text-sm mt-1 font-mono" placeholder="LOT-YYYYMMDD-NNNN" value={item.lot_id || ''} onChange={e => onChange(idx, 'lot_id', e.target.value)} />
          {item.lot_id && (
            <p className="text-xs mt-0.5 text-slate-400">
              {totalAvail > 0 ? <span className="text-green-600">Available: {totalAvail.toFixed(2)} units</span> : <span className="text-red-500">Not found in stock</span>}
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
          <Input type="number" className="h-9 text-sm mt-1" min="0.01" placeholder="0" value={item.quantity || ''} onChange={e => onChange(idx, 'quantity', e.target.value)} />
          {item.lot_id && item.quantity && parseFloat(item.quantity) > totalAvail && (
            <p className="text-xs text-red-500 mt-0.5">Exceeds available stock</p>
          )}
        </div>
      </div>
      {item.lot_id && available.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-500 mb-1">FIFO Locations (auto-selected):</p>
          <div className="space-y-1">
            {available.slice(0, 3).map((b, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-600">
                <span className="font-mono">{b.location_code}</span>
                <span>{b.quantity} units · MFG: {b.mfg_date || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SMSStockOut() {
  const { toast } = useToast();
  const [issueType, setIssueType] = useState('production');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ item_name: '', lot_id: '', quantity: '' }]);
  const [stockByLot, setStockByLot] = useState({});
  const [saving, setSaving] = useState(false);

  // Load stock balances for all entered lot IDs
  useEffect(() => {
    const lotIds = [...new Set(items.map(i => i.lot_id).filter(Boolean))];
    if (lotIds.length === 0) return;
    Promise.all(lotIds.map(lid => base44.entities.StoreStockBalance.filter({ lot_id: lid }))).then(results => {
      const map = {};
      lotIds.forEach((lid, i) => { map[lid] = results[i].sort((a, b) => (a.mfg_date || '') < (b.mfg_date || '') ? -1 : 1); });
      setStockByLot(map);
    });
  }, [items.map(i => i.lot_id).join(',')]);

  function addItem() { setItems(prev => [...prev, { item_name: '', lot_id: '', quantity: '' }]); }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function changeItem(idx, key, val) { setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it)); }

  async function handleIssue() {
    const validItems = items.filter(i => i.lot_id && i.quantity && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) { toast({ title: 'No valid items', variant: 'destructive' }); return; }
    setSaving(true);
    const user = await base44.auth.me();
    const issueId = `ISS-${Date.now()}`;
    const now = new Date().toISOString();

    await base44.entities.StoreIssue.create({
      issue_id: issueId, issue_type: issueType, reference_number: referenceNumber,
      status: 'confirmed', total_items: validItems.length, notes, issued_by: user?.email, issued_at: now,
    });

    // Process each item — FIFO deduction
    for (const item of validItems) {
      let remaining = parseFloat(item.quantity);
      const balances = (stockByLot[item.lot_id] || []).filter(b => b.quantity > 0);

      for (const bal of balances) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, bal.quantity);
        remaining -= deduct;

        await base44.entities.StoreIssueLine.create({
          issue_id: issueId, lot_id: item.lot_id,
          location_id: bal.location_id, location_code: bal.location_code,
          item_code: bal.item_code, item_name: item.item_name || bal.item_name,
          uom: bal.uom, requested_quantity: parseFloat(item.quantity),
          issued_quantity: deduct, issue_type: issueType, issued_at: now,
        });

        const newQty = bal.quantity - deduct;
        if (newQty <= 0) {
          await base44.entities.StoreStockBalance.delete(bal.id);
        } else {
          await base44.entities.StoreStockBalance.update(bal.id, { quantity: newQty });
        }
      }

      // Update lot remaining quantity
      const lots = await base44.entities.StoreLot.filter({ lot_id: item.lot_id });
      if (lots.length > 0) {
        const newRemaining = Math.max(0, (lots[0].remaining_quantity ?? lots[0].quantity) - parseFloat(item.quantity));
        await base44.entities.StoreLot.update(lots[0].id, {
          remaining_quantity: newRemaining,
          status: newRemaining <= 0 ? 'consumed' : lots[0].status,
        });
      }
    }

    toast({ title: 'Stock issued successfully!', description: `Issue ${issueId} confirmed for ${validItems.length} item(s)` });
    setItems([{ item_name: '', lot_id: '', quantity: '' }]);
    setReferenceNumber(''); setNotes('');
    setSaving(false);
  }

  const hasErrors = items.some(i => i.lot_id && i.quantity && parseFloat(i.quantity) > (stockByLot[i.lot_id] || []).reduce((s, b) => s + b.quantity, 0));

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Stock Issue</h1>
        <p className="text-sm text-slate-500">Issue stock for production or dispatch using FIFO</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {/* Issue header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Issue Type *</Label>
            <select className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm mt-1" value={issueType} onChange={e => setIssueType(e.target.value)}>
              <option value="production">Production Issue</option>
              <option value="dispatch">Dispatch</option>
              <option value="internal">Internal Use</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Reference Number</Label>
            <Input className="h-9 text-sm mt-1" placeholder="Production Order / Dispatch ref" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <Input className="h-9 text-sm mt-1" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ItemRow key={idx} idx={idx} item={item} stockByLot={stockByLot} onChange={changeItem} onRemove={removeItem} />
          ))}
        </div>

        <Button variant="outline" className="w-full gap-2" onClick={addItem}>
          <Plus className="w-4 h-4" /> Add Item
        </Button>

        {hasErrors && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>One or more items exceed available stock quantity</p>
          </div>
        )}

        <Button className="w-full h-11 text-base gap-2" disabled={saving || hasErrors} onClick={handleIssue}>
          <PackageOpen className="w-5 h-5" />
          {saving ? 'Processing...' : 'Confirm Stock Issue'}
        </Button>
      </div>
    </div>
  );
}