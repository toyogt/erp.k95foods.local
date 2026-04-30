import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Plus, Trash2, AlertCircle, PackageOpen, ScanLine, Keyboard, QrCode, CheckCircle2, Search, Clock, ListChecks, MapPin } from 'lucide-react';
import { formatDateTime } from '@/lib/dateFormatter';
import Swal from 'sweetalert2';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import QRScanner from '@/components/store/QRScanner';
import StockIssueHistoryCards from '@/components/store/StockIssueHistoryCards';
import useDraftSave from '@/hooks/useDraftSave';
import NumericInput from '@/components/ui/NumericInput';
import { showErrorAlert } from '@/lib/toastHelpers';
import LocationIssueSelect from '@/components/store/LocationIssueSelect';


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

  // Show ALL items in dropdown - no limit

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
          <div className="max-h-64 overflow-y-auto">
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

function LotSelect({ lots, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = lots.find(l => l.lot_id === value);

  const availableLots = lots.filter(l => l.actual_stock > 0);
  const sortedLots = [...availableLots].sort((a, b) => {
    const expA = a.expiry_date || '9999-12-31';
    const expB = b.expiry_date || '9999-12-31';
    if (expA !== expB) return expA.localeCompare(expB);
    const mfgA = a.mfg_date || '9999-12-31';
    const mfgB = b.mfg_date || '9999-12-31';
    if (mfgA !== mfgB) return mfgA.localeCompare(mfgB);
    return (a.batch_number || '').localeCompare(b.batch_number || '');
  });

  const filtered = query.trim()
    ? sortedLots.filter(l => l.lot_id?.toLowerCase().includes(query.toLowerCase()) || l.batch_number?.toLowerCase().includes(query.toLowerCase()))
    : sortedLots;

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (availableLots.length === 0) return <p className="text-xs text-slate-400 mt-1">No lots with available stock found for this item</p>;

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center h-11 border border-slate-200 rounded-md px-3 gap-2 cursor-pointer bg-white"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        <span className={`flex-1 text-sm font-mono truncate ${selected ? 'text-slate-900' : 'text-slate-400'}`}>
          {selected ? `${selected.lot_id} — ${selected.actual_stock} ${selected.uom}` : 'Select lot...'}
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
                placeholder="Search lot ID or batch..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((l, idx) => (
              <div
                key={l.lot_id}
                className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${l.lot_id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                onClick={() => { onChange(l.lot_id, l); setOpen(false); setQuery(''); }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono font-semibold">{l.lot_id}</p>
                  {idx === 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">FIFO Suggested</span>}
                </div>
                <p className="text-xs text-slate-400">
                  Available: {l.actual_stock} {l.uom}
                  {l.batch_number ? ` · Batch: ${l.batch_number}` : ''}
                  {l.expiry_date ? ` · Expiry: ${l.expiry_date}` : ''}
                  {l.supplier_name ? ` · ${l.supplier_name}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualModeIssue({ storedItems, onIssue, saving }) {
  const [issueItems, setIssueItems] = useState([{ location_id: '' }]);

  const handleItemChange = (index, itemCode, item) => {
    const newItems = [...issueItems];
    newItems[index] = { item_code: itemCode, item_name: item.item_name, uom: item.uom, lot_id: '', location_id: '', quantity: '' };
    setIssueItems(newItems);
  };

  const handleLotChange = (index, lotId, lot) => {
    const newItems = [...issueItems];
    newItems[index].lot_id = lotId;
    newItems[index].lot = lot;
    newItems[index].location_id = '';
    newItems[index].quantity = '';
    // Auto-select location if only one
    if (lot?.locations?.length === 1) {
      newItems[index].location_id = lot.locations[0].location_id;
    }
    setIssueItems(newItems);
  };

  const handleLocationChange = (index, locationId) => {
    const newItems = [...issueItems];
    newItems[index].location_id = locationId;
    newItems[index].quantity = '';
    setIssueItems(newItems);
  };

  const handleQuantityChange = (index, quantity) => {
    const newItems = [...issueItems];
    newItems[index].quantity = quantity;
    setIssueItems(newItems);
  };

  const addRow = () => setIssueItems([...issueItems, { location_id: '' }]);
  const removeRow = (index) => setIssueItems(issueItems.filter((_, i) => i !== index));

  const handleSubmit = () => {
    const validItems = issueItems.filter(i => i.lot_id && i.location_id && i.quantity > 0);
    if (validItems.length === 0) {
        showErrorAlert("Invalid Input", "Please add at least one valid item to issue.");
        return;
    }

    const quantityByLot = {};
    for (const item of validItems) {
        quantityByLot[item.lot_id] = (quantityByLot[item.lot_id] || 0) + parseFloat(item.quantity);
    }

    // Validate per location
    for (const item of validItems) {
      const lot = storedItems.flatMap(i => i.lots).find(l => l.lot_id === item.lot_id);
      const locStock = lot?.locations?.find(loc => loc.location_id === item.location_id);
      if (locStock && parseFloat(item.quantity) > locStock.stock) {
        showErrorAlert("Stock Exceeded", `Cannot issue ${item.quantity} from ${locStock.location_code}. Only ${locStock.stock} available at this location.`);
        return;
      }
    }
    onIssue(validItems);
    setIssueItems([{}]);
  };

  return (
    <div className="space-y-4">
      {issueItems.map((item, index) => {
        const selectedItem = storedItems.find(i => i.item_code === item.item_code);
        const itemLots = selectedItem?.lots || [];
        const selectedLot = itemLots.find(l => l.lot_id === item.lot_id);
        const lotLocations = selectedLot?.locations || [];
        const hasMultipleLocations = lotLocations.length > 1;
        const selectedLocation = lotLocations.find(loc => loc.location_id === item.location_id);
        const maxQty = selectedLocation?.stock || selectedLot?.actual_stock || 0;
        return (
          <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border rounded-lg bg-slate-50/50">
            <div className="md:col-span-3">
              <Label className="text-xs font-medium text-slate-700">Item</Label>
              <ItemSelect items={storedItems} value={item.item_code} onChange={(code, it) => handleItemChange(index, code, it)} />
            </div>
            <div className="md:col-span-2">
                <Label className="text-xs font-medium text-slate-700">Lot</Label>
                <LotSelect lots={itemLots} value={item.lot_id} onChange={(id, lot) => handleLotChange(index, id, lot)} />
            </div>
            {selectedLot && (
              <div className="md:col-span-3">
                <Label className="text-xs font-medium text-slate-700">
                  Location {hasMultipleLocations ? '*' : ''}
                </Label>
                {hasMultipleLocations ? (
                  <LocationIssueSelect
                    locations={lotLocations}
                    value={item.location_id}
                    onChange={(locId) => handleLocationChange(index, locId)}
                  />
                ) : (
                  <div className="h-11 flex items-center px-3 mt-0 text-sm text-slate-700 bg-slate-100 rounded-md">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                    {lotLocations[0]?.location_code || 'No location'} — {lotLocations[0]?.stock || 0} {item.uom || 'Nos'}
                  </div>
                )}
              </div>
            )}
            <div className="md:col-span-2">
              <Label className="text-xs font-medium text-slate-700">Quantity</Label>
              <NumericInput 
                className="h-11 text-base mt-1" 
                placeholder={maxQty ? `Max: ${maxQty}` : '0'}
                value={item.quantity || ''} 
                onChange={(e) => handleQuantityChange(index, e.target.value)} 
                max={maxQty}
              />
            </div>
            <div className="md:col-span-1">
                <Label className="text-xs font-medium text-slate-700">Unit</Label>
                <div className="h-11 flex items-center px-3 mt-1 text-sm font-medium text-slate-700 bg-slate-100 rounded-md">{item.uom || 'Nos'}</div>
            </div>
            <div className="md:col-span-1">
              {issueItems.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeRow(index)} className="h-11 w-11 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <Button variant="outline" onClick={addRow} className="w-full h-11 gap-2"><Plus className="w-4 h-4" /> Add Row</Button>
      <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 text-base gap-2">
        <PackageOpen className="w-5 h-5" />
        {saving ? 'Processing...' : `Issue Stock (${issueItems.filter(i => i.lot_id && i.quantity > 0).length})`}
      </Button>
    </div>
  );
}

// --- Main Page ─────────────────────────────────────────────────────────────────
const ISSUE_DRAFT_INITIAL = { issueType: 'production', referenceNumber: '', notes: '' };

export default function SMSStockOut() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('issue');
  const [draft, setDraft, clearDraft, hasDraft] = useDraftSave('sms_stock_issue', ISSUE_DRAFT_INITIAL);
  const { issueType, referenceNumber, notes } = draft;
  const setIssueType = v => setDraft(prev => ({ ...prev, issueType: v }));
  const setReferenceNumber = v => setDraft(prev => ({ ...prev, referenceNumber: v }));
  const setNotes = v => setDraft(prev => ({ ...prev, notes: v }));
  const [saving, setSaving] = useState(false);
  const [issueHistory, setIssueHistory] = useState([]);

  const [storedItems, setStoredItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [lots, balances, issues] = await Promise.all([
      base44.entities.StoreLot.list('-created_date', 500),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreIssue.list('-created_date', 100),
    ]);
    setIssueHistory(issues);

    const stockByLot = {};
    balances.forEach(b => {
      stockByLot[b.lot_id] = (stockByLot[b.lot_id] || 0) + (b.quantity || 0);
    });

    // Build per-location breakdown for each lot
    const locationsByLot = {};
    balances.forEach(b => {
      if ((b.quantity || 0) <= 0) return;
      if (!locationsByLot[b.lot_id]) locationsByLot[b.lot_id] = [];
      locationsByLot[b.lot_id].push({
        location_id: b.location_id,
        location_code: b.location_code,
        stock: b.quantity || 0,
        uom: b.uom,
        balance_id: b.id,
      });
    });

    const itemMap = {};
    lots.forEach(l => {
      const lotStock = stockByLot[l.lot_id] || 0;
      if (lotStock <= 0) return;
      const lotLocations = locationsByLot[l.lot_id] || [];
      // Only include lots that have at least one location mapped — required for issuing
      if (lotLocations.length === 0) return;
      if (!itemMap[l.item_code]) {
        itemMap[l.item_code] = {
          item_code: l.item_code,
          item_name: l.item_name,
          uom: l.uom,
          lots: [],
          total_stock: 0,
        };
      }
      const lotWithStock = { ...l, actual_stock: lotStock, locations: lotLocations };
      itemMap[l.item_code].lots.push(lotWithStock);
      itemMap[l.item_code].total_stock += lotStock;
    });

    setStoredItems(Object.values(itemMap));
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

    const allBalances = await base44.entities.StoreStockBalance.list('', 2000);

    for (const item of items) {
        let remainingToIssue = item.quantity;
        // If user selected a specific location, deduct from that location only
        const balancesForLot = allBalances.filter(b => {
          if (b.lot_id !== item.lot_id || b.quantity <= 0) return false;
          if (item.location_id) return b.location_id === item.location_id;
          return true;
        }).sort((a, b) => (a.putaway_date || '') < (b.putaway_date || '') ? -1 : 1);

        for (const bal of balancesForLot) {
            if (remainingToIssue <= 0) break;
            const deduct = Math.min(remainingToIssue, bal.quantity);
            remainingToIssue -= deduct;

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
            if (newQty <= 0) {
                await base44.entities.StoreStockBalance.delete(bal.id);
            } else {
                await base44.entities.StoreStockBalance.update(bal.id, { quantity: newQty });
            }
        }
    }
    
    // Recalculate all remaining_quantities after all issues
    const allLots = await base44.entities.StoreLot.list('', 2000);
    const allRemainingBalances = await base44.entities.StoreStockBalance.list('', 5000);
    const balanceMap = {};
    allRemainingBalances.forEach(b => {
        balanceMap[b.lot_id] = (balanceMap[b.lot_id] || 0) + (b.quantity || 0);
    });
    
    for (const lot of allLots) {
        const newRemaining = balanceMap[lot.lot_id] || 0;
        if (lot.remaining_quantity !== newRemaining) {
             await base44.entities.StoreLot.update(lot.id, {
                remaining_quantity: newRemaining,
                status: newRemaining <= 0 ? 'consumed' : 'putaway',
            });
        }
    }

    Swal.fire({ icon: 'success', title: 'Stock Issued', text: `Issue ${issueId} confirmed with ${items.length} item(s)`, timer: 2500, showConfirmButton: false });
    clearDraft();
    setSaving(false);
    loadData();
  }

  return (
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
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

      {activeTab === 'history' && <StockIssueHistoryCards issues={issueHistory} />}

      {activeTab === 'issue' && <>
      {hasDraft && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-700 font-medium">You have an unsaved draft issue</p>
          <button onClick={clearDraft} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear Draft</button>
        </div>
      )}
      <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-6">
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
            <NumericInput className="h-11 md:h-9 text-base md:text-sm mt-2" placeholder="Production Order / Dispatch ref" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <NumericInput className="h-11 md:h-9 text-base md:text-sm mt-2" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-6">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Loading stored items...</p>
        ) : storedItems.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-slate-400 py-6 text-center">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm font-medium text-slate-600">No stock available for issue</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Only stock with an assigned location can be issued. Receive goods via Goods Receipt and complete putaway, or assign an opening stock location in Item Master.
            </p>
          </div>
        ) : (
          <ManualModeIssue storedItems={storedItems} onIssue={handleIssue} saving={saving} />
        )}
        </div>
        </>}
        </div>
        </motion.div>
        );
}