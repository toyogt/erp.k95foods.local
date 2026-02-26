import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { ScanLine, CheckCircle, AlertCircle, Loader2, Lock } from 'lucide-react';

function parseSerial(raw) {
  // Try JSON QR payload first
  try {
    const obj = JSON.parse(raw);
    if (obj.s) return obj.s;
  } catch (_) {}
  // If it starts with BX- assume direct serial
  if (raw.startsWith('BX-')) return raw.trim();
  return raw.trim();
}

export default function BoxScanStep({ pallet, user, scannedBoxes, setScannedBoxes, onSealRequest }) {
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null); // { ok, message }
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleScan() {
    const raw = scanInput.trim();
    if (!raw) return;
    setScanInput('');
    setScanning(true);
    setLastResult(null);

    const serial = parseSerial(raw);

    // Check BoxLabel exists
    const labels = await base44.entities.BoxLabel.filter({ box_serial: serial }, '-created_date', 1);
    if (!labels.length) {
      setLastResult({ ok: false, message: `Box serial not found: ${serial}` });
      setScanning(false);
      inputRef.current?.focus();
      return;
    }
    const label = labels[0];

    // Status check
    const allowedStatuses = ['PRINTED_UNREGISTERED', 'ON_PALLET_REGISTERED'];
    if (user?.role === 'admin') allowedStatuses.push('IN_STOCK');
    if (!allowedStatuses.includes(label.status)) {
      setLastResult({ ok: false, message: `Cannot add — box is ${label.status}` });
      setScanning(false);
      inputRef.current?.focus();
      return;
    }

    // Duplicate check on current pallet
    if (scannedBoxes.find(b => b.box_serial === serial)) {
      setLastResult({ ok: false, message: `Already on this pallet: ${serial}` });
      setScanning(false);
      inputRef.current?.focus();
      return;
    }

    // If box is already ON_PALLET_REGISTERED, skip duplicate link check (it's preloaded)
    if (label.status === 'ON_PALLET_REGISTERED') {
      setScannedBoxes(prev => [...prev, { ...label, box_serial: serial }]);
      setLastResult({ ok: true, message: `✓ ${serial} already on pallet` });
      setScanning(false);
      inputRef.current?.focus();
      return;
    }

    // Duplicate across pallets
    const existingLinks = await base44.entities.BoxPalletLink.filter({ box_serial: serial }, '-created_date', 1);
    if (existingLinks.length > 0) {
      setLastResult({ ok: false, message: `Already linked to pallet ${existingLinks[0].pallet_id}` });
      setScanning(false);
      inputRef.current?.focus();
      return;
    }

    // Create link
    await base44.entities.BoxPalletLink.create({
      pallet_id: pallet.pallet_id,
      box_serial: serial,
      scanned_at: new Date().toISOString(),
      scanned_by: user?.email || '',
    });

    // Register box
    await base44.entities.BoxLabel.update(label.id, {
      status: 'ON_PALLET_REGISTERED',
      registered_at: new Date().toISOString(),
      registered_by: user?.email || '',
      current_location: pallet.pallet_id,
    });

    setScannedBoxes(prev => [...prev, { ...label, box_serial: serial }]);
    setLastResult({ ok: true, message: `✓ ${serial} added` });
    setScanning(false);
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleScan();
  }

  // Summary grouped by item_code + batch_no
  const summary = Object.values(
    scannedBoxes.reduce((acc, b) => {
      const key = `${b.item_code}|${b.batch_no}`;
      if (!acc[key]) acc[key] = { item_code: b.item_code, batch_no: b.batch_no, count: 0 };
      acc[key].count++;
      return acc;
    }, {})
  );

  return (
    <div className="space-y-4">
      {/* Pallet header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 flex items-center justify-between">
        <div>
          <span className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Active Pallet</span>
          <p className="font-bold text-emerald-900 text-lg font-mono">{pallet.pallet_id}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-emerald-700">{scannedBoxes.length}</span>
          <p className="text-xs text-emerald-600">boxes scanned</p>
        </div>
      </div>

      {/* Scan input */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scan Box QR</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 h-11 px-4 text-sm rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none font-mono"
            placeholder="Scan QR or type box serial…"
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={scanning}
          />
          <Button onClick={handleScan} disabled={!scanInput.trim() || scanning} className="bg-emerald-600 hover:bg-emerald-700 h-11">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
          </Button>
        </div>

        {lastResult && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${lastResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {lastResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {lastResult.message}
          </div>
        )}
      </div>

      {/* Summary table */}
      {summary.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Contents Summary</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-100">
                <th className="text-left pb-1">Item Code</th>
                <th className="text-left pb-1">Batch</th>
                <th className="text-right pb-1">Boxes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary.map((row, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-semibold text-slate-800">{row.item_code}</td>
                  <td className="py-1.5 text-slate-600">{row.batch_no}</td>
                  <td className="py-1.5 text-right font-bold text-slate-900">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scanned list (last 10) */}
      {scannedBoxes.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">
            Recent Scans ({scannedBoxes.length} total)
          </p>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {[...scannedBoxes].reverse().slice(0, 20).map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-mono text-slate-700 flex-1">{b.box_serial}</span>
                <span className="text-slate-400">{b.item_code}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seal button */}
      {scannedBoxes.length > 0 && (
        <Button
          onClick={onSealRequest}
          className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold gap-2"
        >
          <Lock className="w-5 h-5" /> Seal Pallet ({scannedBoxes.length} boxes)
        </Button>
      )}
    </div>
  );
}