import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Warehouse, Search, CheckCircle2, ScanLine } from 'lucide-react';
import { GRN_STATUS_COLOR, logGrnAudit } from '@/components/grn/grnHelpers';
import { recordMovement, getWorkflowBin } from '@/components/grn/stockLedger';

export default function Putaway() {
  const [user, setUser] = useState(null);
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [stagingItems, setStagingItems] = useState([]); // {sku_code, item_name, uom_code, qty_in_staging}
  const [bins, setBins] = useState([]); // UNRESTRICTED bins
  const [destBinCode, setDestBinCode] = useState('');
  const [destBin, setDestBin] = useState(null);
  const [putawayQtys, setPutawayQtys] = useState({}); // sku_code -> qty
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [binError, setBinError] = useState('');

  async function load() {
    setLoading(true);
    const [u, data] = await Promise.all([
      base44.auth.me(),
      base44.entities.GRNHeader.filter({ status: 'QC_PASSED' }, '-created_date', 100),
    ]);
    setUser(u);
    setGrns(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function selectGRN(grn) {
    setSelected(grn);
    setDone(false);
    setDestBinCode('');
    setDestBin(null);
    setBinError('');

    // Get staging bin (RECEIVING or DEFAULT_PUTAWAY)
    const stagingBin = await getWorkflowBin('RECEIVING') || await getWorkflowBin('DEFAULT_PUTAWAY');
    // Load unrestricted bins
    const allBins = await base44.entities.Bin.filter({ bin_type: 'UNRESTRICTED', is_active: true });
    setBins(allBins);

    // Load stock balances for this GRN's items in the staging bin
    const grnItems = await base44.entities.GRNItem.filter({ grn_id: grn.grn_id });
    const passedItems = grnItems.filter(it => (it.received_qty || 0) > 0);

    // Get stock in staging bin per sku
    const items = await Promise.all(passedItems.map(async it => {
      let qtyInStaging = 0;
      if (stagingBin) {
        const bal = await base44.entities.StockBalance.filter({ sku_code: it.item_code, bin_id: stagingBin.bin_id });
        qtyInStaging = bal[0]?.qty || 0;
      }
      return { sku_code: it.item_code, item_name: it.item_name, uom_code: it.uom_code, qty_in_staging: qtyInStaging, stagingBin };
    }));

    setStagingItems(items);
    const qtys = {};
    items.forEach(it => { qtys[it.sku_code] = it.qty_in_staging; });
    setPutawayQtys(qtys);
  }

  async function lookupBin(code) {
    setBinError('');
    setDestBin(null);
    if (!code.trim()) return;
    const found = bins.find(b => b.bin_code.toLowerCase() === code.trim().toLowerCase());
    if (!found) {
      setBinError(`Bin "${code}" not found or not UNRESTRICTED.`);
      return;
    }
    setDestBin(found);
  }

  async function handlePutaway() {
    if (!destBin) return;
    setSubmitting(true);
    const stagingBin = stagingItems[0]?.stagingBin;

    await Promise.all(
      stagingItems.map(it => {
        const qty = Number(putawayQtys[it.sku_code]) || 0;
        if (!qty) return Promise.resolve();
        return recordMovement({
          moveType: 'PUTAWAY',
          refType: 'GRN',
          refId: selected.grn_id,
          skuCode: it.sku_code,
          qty,
          fromBinId: stagingBin?.bin_id,
          fromBinCode: stagingBin?.bin_code,
          toBinId: destBin.bin_id,
          toBinCode: destBin.bin_code,
          performedBy: user?.email || '',
          notes: `Putaway from GRN ${selected.grn_id}`,
        });
      })
    );

    await logGrnAudit({ action: 'PUTAWAY_DONE', entity_type: 'GRNHeader', entity_id: selected.grn_id, details: { dest_bin: destBin.bin_code }, user });
    await base44.entities.GRNHeader.update(selected.id, { status: 'CLOSED' });

    setDone(true);
    setSubmitting(false);
    load();
  }

  const filtered = grns.filter(g => {
    const q = search.toLowerCase();
    return !q || (g.grn_id || '').toLowerCase().includes(q) || (g.supplier_name || '').toLowerCase().includes(q) || (g.po_id || '').toLowerCase().includes(q);
  });

  if (!selected) return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="w-6 h-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">Putaway</h1>
        </div>
        <button onClick={load} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><RefreshCw className="w-5 h-5" /></button>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 font-medium">
        Only QC PASSED GRNs shown. Stock can only be put away to UNRESTRICTED bins.
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search GRN, supplier, PO…"
          className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm" />
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
        : filtered.length === 0
          ? <div className="text-center py-12 text-slate-400"><Warehouse className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="font-semibold">No QC-passed GRNs ready for putaway.</p></div>
          : filtered.map(g => (
            <button key={g.id} onClick={() => selectGRN(g)} className="w-full text-left bg-white rounded-2xl border border-slate-200 p-4 hover:border-green-400 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">{g.grn_id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRN_STATUS_COLOR[g.status]}`}>{g.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{g.supplier_name || '—'}</p>
                  <p className="text-xs text-slate-400">{g.po_id ? `PO: ${g.po_id}` : 'No PO'}</p>
                </div>
                <span className="text-green-600 text-sm font-semibold">Putaway →</span>
              </div>
            </button>
          ))
      }
    </div>
  );

  if (done) return (
    <div className="max-w-md mx-auto pt-12 text-center space-y-4">
      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
      <h2 className="text-2xl font-bold text-slate-900">Putaway Complete</h2>
      <p className="text-slate-500">Bin: <span className="font-bold">{destBin?.bin_code}</span></p>
      <p className="text-sm text-slate-400">Stock is now UNRESTRICTED and available for use.</p>
      <Button onClick={() => { setSelected(null); setDone(false); }} className="w-full h-12 bg-slate-900">← Back to Putaway List</Button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-12">
      <div className="flex items-center gap-2">
        <button onClick={() => setSelected(null)} className="text-blue-500 text-sm font-semibold">← Back</button>
        <span className="font-bold text-slate-900">{selected.grn_id}</span>
        <span className="text-xs text-slate-400">{selected.supplier_name}</span>
      </div>

      {/* Items in staging */}
      <div className="space-y-2">
        {stagingItems.map(it => (
          <div key={it.sku_code} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{it.item_name || it.sku_code}</p>
                <p className="text-xs text-slate-400">In staging: {it.qty_in_staging} {it.uom_code}</p>
              </div>
              <div className="w-24">
                <label className="block text-xs text-slate-500 mb-0.5">Putaway Qty</label>
                <input type="number" max={it.qty_in_staging} value={putawayQtys[it.sku_code] ?? it.qty_in_staging}
                  onChange={e => setPutawayQtys(prev => ({ ...prev, [it.sku_code]: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right" />
              </div>
            </div>
          </div>
        ))}
        {stagingItems.length === 0 && <p className="text-center text-slate-400 py-6 text-sm">No items in staging bin. Stock movements may not be configured.</p>}
      </div>

      {/* Destination bin scan */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">
          <ScanLine className="inline w-4 h-4 mr-1" />Destination Bin Code
        </label>
        <div className="flex gap-2">
          <input type="text" value={destBinCode} onChange={e => setDestBinCode(e.target.value.toUpperCase())}
            onBlur={() => lookupBin(destBinCode)}
            placeholder="e.g. RACK-02-B3" className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono uppercase" />
          <Button variant="outline" onClick={() => lookupBin(destBinCode)} className="h-12 px-4">Verify</Button>
        </div>
        {binError && <p className="text-xs text-red-600 mt-1">{binError}</p>}
        {destBin && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-xl p-2 text-sm text-green-800 font-semibold">
            ✓ {destBin.bin_code} — {destBin.bin_name || destBin.bin_type}
          </div>
        )}
        {/* Bin picker fallback */}
        <select className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-500"
          value={destBin?.bin_id || ''}
          onChange={e => { const b = bins.find(x => x.bin_id === e.target.value); setDestBin(b); setDestBinCode(b?.bin_code || ''); setBinError(''); }}>
          <option value="">— Or pick from list —</option>
          {bins.map(b => <option key={b.bin_id} value={b.bin_id}>{b.bin_code} {b.bin_name ? `· ${b.bin_name}` : ''}</option>)}
        </select>
      </div>

      <Button onClick={handlePutaway} disabled={!destBin || submitting || stagingItems.length === 0} className="w-full h-12 bg-slate-900">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
        Confirm Putaway to {destBin?.bin_code || '...'}
      </Button>
    </div>
  );
}