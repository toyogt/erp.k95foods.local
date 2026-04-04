import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, AlertCircle, PackageOpen, QrCode, Lock, Camera } from 'lucide-react';
import QRScanner from '@/components/store/QRScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// ── Inline item search dropdown ──────────────────────────────────────────────
function ItemSearchField({ value, onSelect }) {
  const [query, setQuery] = useState(value?.item_name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [allItems, setAllItems] = useState([]);

  useEffect(() => {
    base44.entities.ItemMaster.filter({ is_active: true }, 'item_name', 200).then(setAllItems);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    setResults(
      allItems.filter(i =>
        i.item_name?.toLowerCase().includes(q) ||
        i.item_code?.toLowerCase().includes(q)
      ).slice(0, 8)
    );
  }, [query, allItems]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => query && setOpen(true)}
        placeholder="Search item name or code…"
        className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map(item => (
            <button key={item.id} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
              onMouseDown={() => { onSelect(item); setQuery(item.item_name); setOpen(false); }}>
              <span className="font-medium text-slate-900">{item.item_name}</span>
              <span className="text-xs text-slate-400 ml-2 font-mono">{item.item_code}</span>
            </button>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="absolute z-30 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 px-3 py-2 text-sm text-slate-400">
          No items found
        </div>
      )}
    </div>
  );
}

// ── Lot scan field ────────────────────────────────────────────────────────────
function LotScanField({ value, onChange, manualAllowed, availableLots }) {
  const [showScanner, setShowScanner] = useState(false);

  function handleScan(val) {
    onChange(val);
    setShowScanner(false);
  }

  return (
    <div className="space-y-2">
      {/* Big prominent camera button — impossible to miss */}
      <button
        type="button"
        onClick={() => setShowScanner(true)}
        className="w-full h-14 flex items-center justify-center gap-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl font-semibold text-base transition-colors shadow-sm"
      >
        <Camera className="w-6 h-6" />
        Tap to Scan Lot QR
      </button>

      {/* Full-screen scanner */}
      {showScanner && (
        <QRScanner onScan={handleScan} label="Scan Lot QR Code" />
      )}

      {/* Value display / manual input */}
      {value ? (
        <div className="flex items-center justify-between bg-teal-50 border border-teal-300 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-sm font-mono font-semibold text-teal-800 truncate">{value}</span>
          </div>
          <button type="button" onClick={() => onChange('')} className="text-xs text-slate-400 hover:text-red-500 ml-2 shrink-0">Clear</button>
        </div>
      ) : (
        manualAllowed && (
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Or type Lot ID manually…"
            className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm font-mono text-slate-600"
          />
        )
      )}

      {/* Available lots chips */}
      {!value && availableLots.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">Available lots:</p>
          <div className="flex flex-wrap gap-1">
            {availableLots.slice(0, 5).map(lotId => (
              <button key={lotId} type="button" onClick={() => onChange(lotId)}
                className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded px-2 py-1 font-mono h-8">
                {lotId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ idx, item, balances, onChange, onRemove, manualAllowed }) {
  const balancesForItem = balances.filter(b => b.item_code === item.item_code);
  const balancesForLot = item.lot_id
    ? balancesForItem.filter(b => b.lot_id === item.lot_id && b.quantity > 0)
    : [];
  const totalAvail = balancesForLot.reduce((s, b) => s + (b.quantity || 0), 0);
  const uniqueLots = [...new Set(balancesForItem.filter(b => b.quantity > 0).map(b => b.lot_id))];

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Item {idx + 1}</p>
        <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
          <div className="mt-1">
            <ItemSearchField
              value={{ item_name: item.item_name }}
              onSelect={selected => onChange(idx, { item_code: selected.item_code, item_name: selected.item_name, uom: selected.base_uom })}
            />
          </div>
          {item.item_code && <p className="text-xs text-slate-400 mt-0.5 font-mono">{item.item_code}</p>}
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Lot ID *</Label>
          <div className="mt-1">
            <LotScanField
              value={item.lot_id || ''}
              onChange={val => onChange(idx, { lot_id: val })}
              manualAllowed={manualAllowed}
              availableLots={uniqueLots}
            />
          </div>
          {item.lot_id && (
            <p className="text-xs mt-0.5">
              {totalAvail > 0
                ? <span className="text-green-600">Available: {totalAvail.toFixed(2)} {item.uom || 'units'}</span>
                : <span className="text-red-500">Lot not found in stock</span>}
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs font-medium text-slate-700">Quantity *</Label>
          <Input type="number" className="h-9 text-sm mt-1" min="0.01" placeholder="0"
            value={item.quantity || ''}
            onChange={e => onChange(idx, { quantity: e.target.value })} />
          {item.lot_id && item.quantity && parseFloat(item.quantity) > totalAvail && (
            <p className="text-xs text-red-500 mt-0.5">Exceeds available stock</p>
          )}
        </div>
      </div>

      {balancesForLot.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-500 mb-1">Stock locations (FIFO order):</p>
          <div className="space-y-1">
            {balancesForLot
              .sort((a, b) => (a.mfg_date || '') < (b.mfg_date || '') ? -1 : 1)
              .slice(0, 4).map((b, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-600">
                  <span className="font-mono">{b.location_code || b.location_id}</span>
                  <span>{b.quantity} {b.uom} · Mfg: {b.mfg_date || '—'}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SMSStockOut() {
  const { toast } = useToast();
  const [issueType, setIssueType] = useState('production');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ item_code: '', item_name: '', uom: '', lot_id: '', quantity: '' }]);
  const [balances, setBalances] = useState([]);
  const [manualAllowed, setManualAllowed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load manual entry setting
  useEffect(() => {
    base44.entities.AppSetting.filter({ key: 'store_manual_entry_enabled' })
      .then(r => setManualAllowed(r[0]?.value === 'true'));
  }, []);

  // Load stock balances for all selected item codes
  useEffect(() => {
    const codes = [...new Set(items.map(i => i.item_code).filter(Boolean))];
    if (codes.length === 0) { setBalances([]); return; }
    Promise.all(codes.map(code => base44.entities.StoreStockBalance.filter({ item_code: code })))
      .then(results => setBalances(results.flat()));
  }, [items.map(i => i.item_code).join(',')]);

  function addItem() {
    setItems(prev => [...prev, { item_code: '', item_name: '', uom: '', lot_id: '', quantity: '' }]);
  }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function changeItem(idx, patch) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function handleIssue() {
    const validItems = items.filter(i => i.item_code && i.lot_id && i.quantity && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      toast({ title: 'No valid items to issue', description: 'Please select an item, scan a lot, and enter quantity.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    const issueId = `ISS-${Date.now()}`;
    const now = new Date().toISOString();

    await base44.entities.StoreIssue.create({
      issue_id: issueId, issue_type: issueType, reference_number: referenceNumber,
      status: 'confirmed', total_items: validItems.length, notes,
      issued_by: user?.email, issued_at: now,
    });

    for (const item of validItems) {
      let remaining = parseFloat(item.quantity);
      const lotBalances = balances
        .filter(b => b.item_code === item.item_code && b.lot_id === item.lot_id && b.quantity > 0)
        .sort((a, b) => (a.mfg_date || '') < (b.mfg_date || '') ? -1 : 1);

      for (const bal of lotBalances) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, bal.quantity);
        remaining -= deduct;

        await base44.entities.StoreIssueLine.create({
          issue_id: issueId, lot_id: item.lot_id,
          location_id: bal.location_id, location_code: bal.location_code,
          item_code: item.item_code, item_name: item.item_name,
          uom: item.uom || bal.uom,
          requested_quantity: parseFloat(item.quantity),
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

    toast({ title: 'Stock issued successfully', description: `Issue ${issueId} confirmed for ${validItems.length} item(s)` });
    setItems([{ item_code: '', item_name: '', uom: '', lot_id: '', quantity: '' }]);
    setReferenceNumber('');
    setNotes('');
    setSaving(false);
  }

  const hasErrors = items.some(i => {
    if (!i.lot_id || !i.quantity) return false;
    const avail = balances
      .filter(b => b.item_code === i.item_code && b.lot_id === i.lot_id)
      .reduce((s, b) => s + b.quantity, 0);
    return parseFloat(i.quantity) > avail;
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Stock Issue</h1>
        <p className="text-sm text-slate-500">Issue stock for production or dispatch using FIFO</p>
      </div>

      {!manualAllowed && (
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5">
          <QrCode className="w-4 h-4 text-teal-600 shrink-0" />
          <p className="text-sm text-teal-700">QR scanning mode — manual Lot ID entry is restricted. Contact your admin to enable it in Store Settings.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Issue Type *</Label>
            <select className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm mt-1"
              value={issueType} onChange={e => setIssueType(e.target.value)}>
              <option value="production">Production Issue</option>
              <option value="dispatch">Dispatch</option>
              <option value="internal">Internal Use</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Reference Number</Label>
            <Input className="h-9 text-sm mt-1" placeholder="Production Order / Dispatch ref"
              value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <Input className="h-9 text-sm mt-1" placeholder="Optional notes"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <ItemRow key={idx} idx={idx} item={item} balances={balances}
              onChange={changeItem} onRemove={removeItem} manualAllowed={manualAllowed} />
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
          {saving ? 'Processing…' : 'Confirm Stock Issue'}
        </Button>
      </div>
    </div>
  );
}