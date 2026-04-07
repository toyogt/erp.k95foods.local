import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, AlertCircle, PackageOpen, ScanLine, Keyboard, QrCode, CheckCircle2, Search, Clock, ListChecks } from 'lucide-react';
import ExportButton from '@/components/store/ExportButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import StockIssueHistory from '@/components/store/StockIssueHistory';

// Searchable item dropdown — only items with "putaway" (Stored) lots
function ItemSelect({ items, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = items.find(i => i.item_code === value);
  const filtered = query.trim()
    ? items.filter(i =>
        i.item_name?.toLowerCase().includes(query.toLowerCase()) ||
        i.item_code?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`flex-1 text-sm truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.item_name} (${selected.item_code})` : 'Type to search stored items...'}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus
                className="flex-1 text-sm outline-none"
                placeholder="Search by item name or code..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No stored items found</p>
            ) : filtered.map(i => (
              <div
                key={i.item_code}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${i.item_code === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(i.item_code, i); setOpen(false); setQuery(''); }}
              >
                <p className="font-medium">{i.item_name}</p>
                <p className="text-xs text-slate-400">{i.item_code} · {i.total_stock?.toFixed(2)} {i.uom} in stock</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Searchable lot dropdown — filtered by item and status=putaway
function LotSelect({ lots, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = lots.find(l => l.lot_id === value);
  const filtered = query.trim()
    ? lots.filter(l => l.lot_id?.toLowerCase().includes(query.toLowerCase()))
    : lots;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (lots.length === 0) return <p className="text-xs text-slate-400 mt-1">No stored lots found for this item</p>;

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        <span className={`flex-1 text-sm font-mono truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.lot_id} — ${selected.remaining_quantity ?? selected.quantity} ${selected.uom}` : 'Select lot...'}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus
                className="flex-1 text-sm outline-none"
                placeholder="Search lot ID..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(l => (
              <div
                key={l.lot_id}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.lot_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(l.lot_id, l); setOpen(false); setQuery(''); }}
              >
                <p className="font-mono font-semibold">{l.lot_id}</p>
                <p className="text-xs text-slate-400">Available: {l.remaining_quantity ?? l.quantity} {l.uom} · Supplier: {l.supplier_name || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Scan Mode Issue Form ---
function ScanModeIssue({ storedItems, stockByLot, onIssue, saving }) {
  const { toast } = useToast();
  const [lotScan, setLotScan] = useState('');
  const [quantity, setQuantity] = useState('');

  // Resolve lot from scan — must be status=putaway
  const resolvedLot = Object.values(stockByLot).flat().find(b => b.lot_id === lotScan.trim()) || null;
  const lotMeta = storedItems.flatMap(i => i.lots || []).find(l => l.lot_id === lotScan.trim()) || null;
  const maxQty = resolvedLot ? resolvedLot.quantity : 0;

  function handleAdd() {
    if (!resolvedLot || !quantity || parseFloat(quantity) <= 0) return;
    if (parseFloat(quantity) > maxQty) {
      toast({ title: 'Quantity exceeds available stock', variant: 'destructive' }); return;
    }
    onIssue([{ lot_id: resolvedLot.lot_id, item_name: resolvedLot.item_name, quantity: parseFloat(quantity) }]);
    setLotScan(''); setQuantity('');
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-slate-700 flex items-center gap-1">
          <QrCode className="w-3.5 h-3.5" /> Scan Lot QR Code
        </Label>
        <div className="flex gap-2 mt-1">
          <Input
            className="h-11 text-base flex-1 font-mono"
            placeholder="Scan or type Lot ID"
            value={lotScan}
            onChange={e => setLotScan(e.target.value)}
          />
          <QRScanner onScan={setLotScan} label="Lot QR" />
        </div>
        {lotScan && !resolvedLot && (
          <div className="mt-1.5 flex items-center gap-2 text-red-500 text-xs"><AlertCircle className="w-3.5 h-3.5" />Lot not found or not in stored status</div>
        )}
      </div>

      {resolvedLot && (
        <div>
          <Label className="text-xs font-medium text-slate-700">Quantity to Issue *</Label>
          <Input
            type="number"
            className="h-11 text-base mt-1"
            placeholder={`Enter quantity`}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            min="0.01"
            max={maxQty}
          />
        </div>
      )}

      <Button
        className="w-full h-11 text-base gap-2"
        disabled={!resolvedLot || !quantity || saving}
        onClick={handleAdd}
      >
        <PackageOpen className="w-5 h-5" />
        {saving ? 'Processing...' : 'Issue Stock'}
      </Button>
    </div>
  );
}

// --- Manual Mode Issue Form ---
function ManualModeIssue({ storedItems, stockByLot, onIssue, saving }) {
  const { toast } = useToast();
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedLotMeta, setSelectedLotMeta] = useState(null);
  const [quantity, setQuantity] = useState('');

  const selectedItem = storedItems.find(i => i.item_code === selectedItemCode);
  const itemLots = selectedItem?.lots || [];
  const balances = selectedLotId ? (stockByLot[selectedLotId] || []) : [];
  const maxQty = balances.reduce((s, b) => s + (b.quantity || 0), 0);

  function handleItemChange(code, meta) {
    setSelectedItemCode(code);
    setSelectedLotId('');
    setSelectedLotMeta(null);
    setQuantity('');
  }

  function handleLotChange(lotId, lotMeta) {
    setSelectedLotId(lotId);
    setSelectedLotMeta(lotMeta);
    setQuantity('');
  }

  function handleIssue() {
    if (!selectedItemCode || !selectedLotId || !quantity || parseFloat(quantity) <= 0) return;
    if (parseFloat(quantity) > maxQty) {
      toast({ title: 'Quantity exceeds available stock', variant: 'destructive' }); return;
    }
    onIssue([{ lot_id: selectedLotId, item_name: selectedItem?.item_name, quantity: parseFloat(quantity) }]);
    setSelectedItemCode(''); setSelectedLotId(''); setSelectedLotMeta(null); setQuantity('');
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-slate-700">Item Name *</Label>
        <div className="mt-1">
          <ItemSelect items={storedItems} value={selectedItemCode} onChange={handleItemChange} />
        </div>
        <p className="text-xs text-slate-400 mt-1">Only items with stored lots are shown</p>
      </div>

      {selectedItemCode && (
        <div>
          <Label className="text-xs font-medium text-slate-700">Lot *</Label>
          <div className="mt-1">
            <LotSelect lots={itemLots} value={selectedLotId} onChange={handleLotChange} />
          </div>
          {/* available qty shown in lot dropdown */}
        </div>
      )}

      {selectedLotId && maxQty > 0 && (
        <div>
          <Label className="text-xs font-medium text-slate-700">Quantity to Issue *</Label>
          <Input
            type="number"
            className="h-11 text-base mt-1"
            placeholder="Enter quantity"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            min="0.01"
            max={maxQty}
          />
        </div>
      )}

      <Button
        className="w-full h-11 text-base gap-2"
        disabled={!selectedItemCode || !selectedLotId || !quantity || saving}
        onClick={handleIssue}
      >
        <PackageOpen className="w-5 h-5" />
        {saving ? 'Processing...' : 'Issue Stock'}
      </Button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SMSStockOut() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('issue');
  const [mode, setMode] = useState('manual'); // 'scan' | 'manual'
  const [issueType, setIssueType] = useState('production');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [issueHistory, setIssueHistory] = useState([]);

  // Data
  const [storedItems, setStoredItems] = useState([]); // unique items with status=putaway lots
  const [stockByLot, setStockByLot] = useState({});   // lot_id → StoreStockBalance[]
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [lots, balances, issues] = await Promise.all([
      base44.entities.StoreLot.list('-created_date', 500),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreIssue.list('-created_date', 100),
    ]);
    setIssueHistory(issues);

    // Build stockByLot map
    const byLot = {};
    balances.forEach(b => { byLot[b.lot_id] = byLot[b.lot_id] ? [...byLot[b.lot_id], b] : [b]; });

    // Build unique items list — only include lots that have actual stock in StoreStockBalance
    const itemMap = {};
    lots
      .filter(l => !['rejected', 'damaged'].includes(l.status))
      .forEach(l => {
        const lotStock = (byLot[l.lot_id] || []).reduce((s, b) => s + (b.quantity || 0), 0);
        if (lotStock <= 0) return; // skip lots with no actual stock
        if (!itemMap[l.item_code]) {
          itemMap[l.item_code] = {
            item_code: l.item_code,
            item_name: l.item_name,
            uom: l.uom,
            lots: [],
            total_stock: 0,
          };
        }
        itemMap[l.item_code].lots.push(l);
        itemMap[l.item_code].total_stock += lotStock;
      });

    setStoredItems(Object.values(itemMap));
    setStockByLot(byLot);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleIssue(items) {
    if (!items || items.length === 0) return;
    setSaving(true);
    const user = await base44.auth.me();
    const issueId = `ISS-${Date.now()}`;
    const now = new Date().toISOString();

    await base44.entities.StoreIssue.create({
      issue_id: issueId,
      issue_type: issueType,
      reference_number: referenceNumber,
      status: 'confirmed',
      total_items: items.length,
      notes,
      issued_by: user?.email,
      issued_at: now,
    });

    for (const item of items) {
      let remaining = item.quantity;
      const balances = (stockByLot[item.lot_id] || []).filter(b => b.quantity > 0)
        .sort((a, b) => (a.mfg_date || '') < (b.mfg_date || '') ? -1 : 1); // FIFO

      for (const bal of balances) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, bal.quantity);
        remaining -= deduct;

        await base44.entities.StoreIssueLine.create({
          issue_id: issueId,
          lot_id: item.lot_id,
          location_id: bal.location_id,
          location_code: bal.location_code,
          item_code: bal.item_code,
          item_name: item.item_name || bal.item_name,
          uom: bal.uom,
          requested_quantity: item.quantity,
          issued_quantity: deduct,
          issue_type: issueType,
          issued_at: now,
        });

        const newQty = bal.quantity - deduct;
        if (newQty <= 0) await base44.entities.StoreStockBalance.delete(bal.id);
        else await base44.entities.StoreStockBalance.update(bal.id, { quantity: newQty });
      }

      // Recompute remaining from actual stock balances (prevents false consumption)
      const [lots, updatedBalances] = await Promise.all([
        base44.entities.StoreLot.filter({ lot_id: item.lot_id }),
        base44.entities.StoreStockBalance.filter({ lot_id: item.lot_id }),
      ]);
      if (lots.length > 0) {
        const actualRemaining = updatedBalances.reduce((s, b) => s + (b.quantity || 0), 0);
        await base44.entities.StoreLot.update(lots[0].id, {
          remaining_quantity: actualRemaining,
          status: actualRemaining <= 0 ? 'consumed' : 'putaway',
        });
      }
    }

    toast({ title: 'Stock issued successfully!', description: `Issue ${issueId} confirmed` });
    setReferenceNumber(''); setNotes('');
    setSaving(false);
    loadData();
  }

  return (
    <div className="pb-12">
      <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Issue</h1>
        <p className="text-sm text-slate-500">Issue stored stock for production or dispatch using FIFO</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'issue', label: 'New Issue', icon: PackageOpen },
          { id: 'history', label: `Issue History (${issueHistory.length})`, icon: ListChecks },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'history' && <StockIssueHistory issues={issueHistory} />}

      {activeTab === 'issue' && <>
      {/* Issue header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Issue Details</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-medium text-slate-700">Issue Type *</Label>
            <select className="w-full h-11 md:h-9 border border-slate-200 rounded-md px-3 text-base md:text-sm mt-2" value={issueType} onChange={e => setIssueType(e.target.value)}>
              <option value="production">Production Issue</option>
              <option value="dispatch">Dispatch</option>
              <option value="internal">Internal Use</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Reference Number</Label>
            <Input className="h-11 md:h-9 text-base md:text-sm mt-2" placeholder="Production Order / Dispatch ref" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <Input className="h-11 md:h-9 text-base md:text-sm mt-2" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          <Keyboard className="w-4 h-4" /> Manual Entry
        </button>
        <button
          onClick={() => setMode('scan')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'scan' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          <ScanLine className="w-4 h-4" /> QR / Barcode Scan
        </button>
      </div>

      {/* Issue form */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Loading stored items...</p>
        ) : storedItems.length === 0 ? (
          <div className="flex items-center gap-3 text-slate-400 py-6 justify-center">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">No stored stock available for issue</p>
          </div>
        ) : mode === 'scan' ? (
          <ScanModeIssue storedItems={storedItems} stockByLot={stockByLot} onIssue={handleIssue} saving={saving} />
        ) : (
          <ManualModeIssue storedItems={storedItems} stockByLot={stockByLot} onIssue={handleIssue} saving={saving} />
        )}
        </div>
        </>}
        </div>
        </div>
        );
        }