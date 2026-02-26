import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, Plus, Trash2, PackageCheck, FileText } from 'lucide-react';

function parseSerial(raw) {
  try { const o = JSON.parse(raw); if (o.s) return o.s; } catch (_) {}
  return raw.trim();
}

function genDocNo() {
  return 'DO-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function DispatchTab({ user }) {
  const [refDoc, setRefDoc] = useState('');
  const [dispatchItems, setDispatchItems] = useState([]); // { type:'serial'|'legacy', ...data }
  const [boxInput, setBoxInput] = useState('');
  const [scanMsg, setScanMsg] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Legacy lot selection
  const [legacyLots, setLegacyLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotFilter, setLotFilter] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);
  const [legacyQty, setLegacyQty] = useState('');
  const [legacyMsg, setLegacyMsg] = useState(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const boxRef = useRef(null);

  useEffect(() => { loadLots(); }, []);

  async function loadLots() {
    setLotsLoading(true);
    const lots = await base44.entities.LegacyStockLot.filter({}, '-created_date', 200);
    setLegacyLots(lots.filter(l => l.qty_boxes > 0));
    setLotsLoading(false);
  }

  // Scan serialized box
  async function handleSerialScan() {
    const raw = boxInput.trim();
    if (!raw) return;
    setBoxInput('');
    setScanning(true);
    setScanMsg(null);
    const serial = parseSerial(raw);

    if (dispatchItems.find(d => d.type === 'serial' && d.serial === serial)) {
      setScanMsg({ ok: false, msg: `Already in this dispatch: ${serial}` });
      setScanning(false); boxRef.current?.focus(); return;
    }

    const labels = await base44.entities.BoxLabel.filter({ box_serial: serial }, '-created_date', 1);
    if (!labels.length) {
      setScanMsg({ ok: false, msg: `Box not found: ${serial}` });
      setScanning(false); boxRef.current?.focus(); return;
    }
    const lbl = labels[0];
    if (lbl.status !== 'IN_STOCK') {
      setScanMsg({ ok: false, msg: `Box status is "${lbl.status}", expected IN_STOCK` });
      setScanning(false); boxRef.current?.focus(); return;
    }
    setDispatchItems(prev => [...prev, {
      type: 'serial',
      serial,
      item_code: lbl.item_code,
      batch_no: lbl.batch_no,
      label_id: lbl.id,
    }]);
    setScanMsg({ ok: true, msg: `✓ ${serial} added` });
    setScanning(false);
    boxRef.current?.focus();
  }

  // Add legacy lot quantity
  function handleAddLegacy() {
    const qty = Number(legacyQty);
    if (!selectedLot || !qty || qty <= 0 || qty > selectedLot.qty_boxes) {
      setLegacyMsg({ ok: false, msg: qty > selectedLot?.qty_boxes ? `Only ${selectedLot?.qty_boxes} available` : 'Enter valid quantity' });
      return;
    }
    // Check if this lot already added — update qty if so
    const existing = dispatchItems.findIndex(d => d.type === 'legacy' && d.lot_id === selectedLot.id);
    if (existing >= 0) {
      const newQty = dispatchItems[existing].qty + qty;
      if (newQty > selectedLot.qty_boxes) {
        setLegacyMsg({ ok: false, msg: `Total would exceed available (${selectedLot.qty_boxes})` });
        return;
      }
      setDispatchItems(prev => prev.map((d, i) => i === existing ? { ...d, qty: newQty } : d));
    } else {
      setDispatchItems(prev => [...prev, {
        type: 'legacy',
        lot_id: selectedLot.id,
        item_code: selectedLot.item_code,
        product_name: selectedLot.product_name || selectedLot.item_code,
        batch_no: selectedLot.batch_no,
        current_location: selectedLot.current_location,
        qty,
        available: selectedLot.qty_boxes,
      }]);
    }
    setLegacyMsg({ ok: true, msg: `${qty} boxes from ${selectedLot.batch_no} added` });
    setLegacyQty('');
    setSelectedLot(null);
  }

  function removeItem(i) {
    setDispatchItems(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmitDispatch() {
    if (!refDoc.trim() || dispatchItems.length === 0) return;
    setSubmitting(true);
    const now = new Date().toISOString();

    for (const item of dispatchItems) {
      if (item.type === 'serial') {
        await base44.entities.BoxLabel.update(item.label_id, {
          status: 'OUT',
          current_location: `OUT:${refDoc.trim()}`,
          dispatched_at: now,
          dispatched_by: user?.email || '',
        });
      } else {
        // Legacy lot
        const lot = legacyLots.find(l => l.id === item.lot_id);
        if (lot) {
          await base44.entities.LegacyStockLot.update(item.lot_id, {
            qty_boxes: lot.qty_boxes - item.qty,
          });
          await base44.entities.LegacyStockMove.create({
            lot_id: item.lot_id,
            item_code: item.item_code,
            batch_no: item.batch_no,
            qty_boxes: item.qty,
            direction: 'OUT',
            reference_doc_no: refDoc.trim(),
            moved_at: now,
            moved_by: user?.email || '',
          });
        }
      }
    }

    const serialCount = dispatchItems.filter(d => d.type === 'serial').length;
    const legacyCount = dispatchItems.filter(d => d.type === 'legacy').reduce((s, d) => s + d.qty, 0);
    setSubmitMsg(`✓ Dispatched ${serialCount} serialized + ${legacyCount} legacy boxes on ${refDoc}`);
    setSubmitted(true);
    setSubmitting(false);
    loadLots();
  }

  function resetDispatch() {
    setDispatchItems([]);
    setRefDoc('');
    setBoxInput('');
    setScanMsg(null);
    setLegacyMsg(null);
    setSubmitted(false);
    setSubmitMsg('');
  }

  const filteredLots = legacyLots.filter(l =>
    !lotFilter || [l.item_code, l.batch_no, l.current_location, l.product_name].join(' ').toLowerCase().includes(lotFilter.toLowerCase())
  );

  const totalSerialBoxes = dispatchItems.filter(d => d.type === 'serial').length;
  const totalLegacyBoxes = dispatchItems.filter(d => d.type === 'legacy').reduce((s, d) => s + d.qty, 0);

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-emerald-900">Dispatch Complete</p>
            <p className="text-sm text-emerald-700 mt-1">{submitMsg}</p>
          </div>
        </div>
        <Button variant="outline" onClick={resetDispatch} className="w-full h-11">
          Start New Dispatch
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reference Doc */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase block">Reference / DO Number *</label>
        <div className="flex gap-2">
          <input
            className="flex-1 h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none"
            placeholder="e.g. DO-2024-001"
            value={refDoc}
            onChange={e => setRefDoc(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={() => setRefDoc(genDocNo())} className="shrink-0 text-xs">
            Auto
          </Button>
        </div>
      </div>

      {/* Serialized scan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-emerald-600" /> Scan Serialized Boxes
        </h3>
        <div className="flex gap-2">
          <input
            ref={boxRef}
            className="flex-1 h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none font-mono"
            placeholder={refDoc.trim() ? 'Scan box QR…' : 'Enter ref doc first'}
            value={boxInput}
            onChange={e => setBoxInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSerialScan()}
            disabled={!refDoc.trim() || scanning}
          />
          <Button
            onClick={handleSerialScan}
            disabled={!boxInput.trim() || !refDoc.trim() || scanning}
            className="bg-amber-600 hover:bg-amber-700 h-10"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </Button>
        </div>
        {scanMsg && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${scanMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {scanMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {scanMsg.msg}
          </div>
        )}
      </div>

      {/* Legacy lot picker */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> Add Legacy / Non-Serialized Stock
        </h3>
        <input
          className="w-full h-9 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none"
          placeholder="Filter by item / batch / location…"
          value={lotFilter}
          onChange={e => setLotFilter(e.target.value)}
        />
        {lotsLoading ? (
          <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {filteredLots.slice(0, 20).map(lot => (
              <button key={lot.id} onClick={() => setSelectedLot(selectedLot?.id === lot.id ? null : lot)}
                className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${selectedLot?.id === lot.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{lot.product_name || lot.item_code}</span>
                    <span className="text-slate-400 text-xs ml-2">Batch: {lot.batch_no}</span>
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{lot.qty_boxes} boxes</span>
                </div>
                {lot.current_location && <p className="text-xs text-slate-400 mt-0.5">📍 {lot.current_location}</p>}
              </button>
            ))}
            {filteredLots.length === 0 && <p className="text-sm text-slate-400 text-center py-3">No legacy lots found.</p>}
          </div>
        )}
        {selectedLot && (
          <div className="border-t border-slate-100 pt-3 flex gap-2">
            <input
              type="number" min={1} max={selectedLot.qty_boxes}
              className="flex-1 h-9 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none"
              placeholder={`Qty (max ${selectedLot.qty_boxes})`}
              value={legacyQty}
              onChange={e => setLegacyQty(e.target.value)}
            />
            <Button onClick={handleAddLegacy} className="bg-amber-600 hover:bg-amber-700 h-9 gap-1">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        )}
        {legacyMsg && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${legacyMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {legacyMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {legacyMsg.msg}
          </div>
        )}
      </div>

      {/* Dispatch summary */}
      {dispatchItems.length > 0 && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700">Dispatch Summary</h3>
            <p className="text-xs text-slate-500">{totalSerialBoxes} serialized + {totalLegacyBoxes} legacy = <b>{totalSerialBoxes + totalLegacyBoxes} boxes</b></p>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dispatchItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-slate-200">
                <div className={`w-2 h-2 rounded-full shrink-0 ${item.type === 'serial' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <div className="flex-1 min-w-0">
                  {item.type === 'serial' ? (
                    <div>
                      <span className="text-xs font-mono text-slate-700">{item.serial}</span>
                      <span className="text-xs text-slate-400 ml-2">{item.item_code} · {item.batch_no}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-semibold text-slate-700">{item.product_name}</span>
                      <span className="text-xs text-slate-400 ml-2">{item.batch_no}</span>
                      <span className="text-xs font-bold text-blue-700 ml-2">{item.qty} boxes</span>
                    </div>
                  )}
                </div>
                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleSubmitDispatch}
            disabled={submitting || !refDoc.trim()}
            className="w-full h-11 bg-amber-600 hover:bg-amber-700 gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Dispatch ${totalSerialBoxes + totalLegacyBoxes} Boxes → ${refDoc || '…'}`}
          </Button>
        </div>
      )}
    </div>
  );
}