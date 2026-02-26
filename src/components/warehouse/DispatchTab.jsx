import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2, PackageCheck, Package } from 'lucide-react';

function parseSerial(raw) {
  try { const o = JSON.parse(raw); if (o.s) return o.s; } catch (_) {}
  return raw.trim();
}

export default function DispatchTab({ user }) {
  const [mode, setMode] = useState('serialized'); // 'serialized' | 'legacy'
  // Serialized
  const [boxInput, setBoxInput] = useState('');
  const [refDoc, setRefDoc] = useState('');
  const [serialMsg, setSerialMsg] = useState(null);
  const [serialScanning, setSerialScanning] = useState(false);
  const [dispatched, setDispatched] = useState([]);
  const boxRef = useRef(null);

  // Legacy
  const [legacyLots, setLegacyLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [legacyQty, setLegacyQty] = useState('');
  const [legacyRef, setLegacyRef] = useState('');
  const [legacyMsg, setLegacyMsg] = useState(null);
  const [legacySubmitting, setLegacySubmitting] = useState(false);
  const [lotFilter, setLotFilter] = useState('');

  useEffect(() => { if (mode === 'legacy') loadLots(); }, [mode]);
  useEffect(() => { if (mode === 'serialized') boxRef.current?.focus(); }, [mode]);

  async function loadLots() {
    const lots = await base44.entities.LegacyStockLot.filter({}, '-created_date', 100);
    setLegacyLots(lots.filter(l => l.qty_boxes > 0));
  }

  async function handleSerialDispatch() {
    const raw = boxInput.trim();
    if (!raw || !refDoc.trim()) return;
    setBoxInput('');
    setSerialScanning(true);
    setSerialMsg(null);
    const serial = parseSerial(raw);
    const labels = await base44.entities.BoxLabel.filter({ box_serial: serial }, '-created_date', 1);
    if (!labels.length) {
      setSerialMsg({ ok: false, msg: `Box not found: ${serial}` });
      setSerialScanning(false); boxRef.current?.focus(); return;
    }
    const lbl = labels[0];
    if (lbl.status !== 'IN_STOCK') {
      setSerialMsg({ ok: false, msg: `Box status is ${lbl.status}, expected IN_STOCK` });
      setSerialScanning(false); boxRef.current?.focus(); return;
    }
    await base44.entities.BoxLabel.update(lbl.id, {
      status: 'OUT',
      current_location: `OUT:${refDoc.trim()}`,
      dispatched_at: new Date().toISOString(),
      dispatched_by: user?.email || '',
    });
    setDispatched(prev => [...prev, { serial, item_code: lbl.item_code, ref: refDoc }]);
    setSerialMsg({ ok: true, msg: `✓ ${serial} dispatched → ${refDoc}` });
    setSerialScanning(false);
    boxRef.current?.focus();
  }

  async function handleLegacyDispatch() {
    if (!selectedLot || !legacyQty || !legacyRef.trim()) return;
    const qty = Number(legacyQty);
    if (isNaN(qty) || qty <= 0) return;
    if (qty > selectedLot.qty_boxes) {
      setLegacyMsg({ ok: false, msg: `Cannot dispatch ${qty} — only ${selectedLot.qty_boxes} available.` });
      return;
    }
    setLegacySubmitting(true);
    await base44.entities.LegacyStockMove.create({
      lot_id: selectedLot.id,
      item_code: selectedLot.item_code,
      batch_no: selectedLot.batch_no,
      qty_boxes: qty,
      direction: 'OUT',
      reference_doc_no: legacyRef,
      moved_at: new Date().toISOString(),
      moved_by: user?.email || '',
    });
    await base44.entities.LegacyStockLot.update(selectedLot.id, {
      qty_boxes: selectedLot.qty_boxes - qty,
    });
    setLegacyMsg({ ok: true, msg: `✓ ${qty} boxes dispatched from ${selectedLot.batch_no} → ${legacyRef}` });
    setLegacyQty('');
    setLegacyRef('');
    setSelectedLot(null);
    setLegacySubmitting(false);
    loadLots();
  }

  const filteredLots = legacyLots.filter(l =>
    !lotFilter || [l.item_code, l.batch_no, l.current_location].join(' ').toLowerCase().includes(lotFilter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[['serialized', 'Serialized (New Stock)', PackageCheck], ['legacy', 'Legacy / Opening Stock', Package]].map(([m, label, Icon]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {mode === 'serialized' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-800">Serialized Dispatch</h3>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Reference Doc No (required)</label>
            <input className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none"
              placeholder="e.g. DO-2024-001" value={refDoc} onChange={e => setRefDoc(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Scan Box QR</label>
            <div className="flex gap-2">
              <input ref={boxRef} className="flex-1 h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none font-mono"
                placeholder={refDoc.trim() ? 'Scan box QR…' : 'Enter ref doc first'} value={boxInput}
                onChange={e => setBoxInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSerialDispatch()}
                disabled={!refDoc.trim() || serialScanning} />
              <Button onClick={handleSerialDispatch} disabled={!boxInput.trim() || !refDoc.trim() || serialScanning}
                className="bg-amber-600 hover:bg-amber-700 h-10">
                {serialScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dispatch'}
              </Button>
            </div>
          </div>
          {serialMsg && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${serialMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {serialMsg.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {serialMsg.msg}
            </div>
          )}
          {dispatched.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Dispatched ({dispatched.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {[...dispatched].reverse().map((d, i) => (
                  <div key={i} className="flex gap-2 text-xs text-slate-700">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="font-mono flex-1">{d.serial}</span>
                    <span className="text-slate-400">{d.item_code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'legacy' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-800">Legacy / Opening Stock Dispatch</h3>
          <input className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none"
            placeholder="Filter by item code / batch / location…" value={lotFilter} onChange={e => setLotFilter(e.target.value)} />
          <div className="max-h-56 overflow-y-auto space-y-1">
            {filteredLots.map(lot => (
              <button key={lot.id} onClick={() => setSelectedLot(lot === selectedLot ? null : lot)}
                className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${selectedLot?.id === lot.id ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className="font-semibold text-slate-800">{lot.item_code}</span>
                <span className="text-slate-500 ml-2">Batch: {lot.batch_no}</span>
                <span className="text-slate-500 ml-2">Loc: {lot.current_location}</span>
                <span className="float-right font-bold text-slate-900">{lot.qty_boxes} boxes</span>
              </button>
            ))}
            {filteredLots.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No lots found.</p>}
          </div>
          {selectedLot && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-sm text-slate-600">Dispatching from: <b>{selectedLot.item_code} · {selectedLot.batch_no}</b> ({selectedLot.qty_boxes} available)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Qty Boxes</label>
                  <input type="number" min={1} max={selectedLot.qty_boxes}
                    className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none"
                    value={legacyQty} onChange={e => setLegacyQty(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Reference Doc No</label>
                  <input className="w-full h-10 px-3 text-sm rounded-xl border border-slate-300 focus:border-amber-500 focus:outline-none"
                    placeholder="e.g. DO-2024-001" value={legacyRef} onChange={e => setLegacyRef(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleLegacyDispatch}
                disabled={!legacyQty || !legacyRef.trim() || legacySubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 h-11 gap-2">
                {legacySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dispatch from Legacy Stock'}
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
      )}
    </div>
  );
}