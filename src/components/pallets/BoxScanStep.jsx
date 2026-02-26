import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { ScanLine, CheckCircle, AlertCircle, Loader2, Lock } from 'lucide-react';

function parseSerial(raw) {
  try {
    const obj = JSON.parse(raw);
    if (obj.s) return obj.s;
  } catch (_) {}
  return raw.trim();
}

export default function BoxScanStep({ pallet, user, products = [], scannedBoxes, setScannedBoxes, onSealRequest }) {
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Save draft status whenever boxes are added
  useEffect(() => {
    if (scannedBoxes.length > 0 && pallet?.id && pallet.status !== 'SEALED') {
      // Save product/batch info to pallet for reference
      const first = scannedBoxes[0];
      const productInfo = products.find(p => p.item_code === first.item_code);
      const productName = productInfo
        ? productInfo.product_name + (productInfo.flavour ? ` · ${productInfo.flavour}` : '')
        : first.item_code;
      base44.entities.BoxPallet.update(pallet.id, {
        status: 'OPEN',
        item_code: first.item_code,
        product_name: productName,
        batch_no: first.batch_no,
        total_boxes: scannedBoxes.length,
      }).catch(() => {});
    }
  }, [scannedBoxes.length]);

  function getProductName(item_code) {
    const p = products.find(p => p.item_code === item_code);
    if (!p) return item_code;
    return p.product_name + (p.flavour ? ` · ${p.flavour}` : '');
  }

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
      setScanning(false); inputRef.current?.focus(); return;
    }
    const label = labels[0];

    // Duplicate check on current pallet (local state) — just skip silently as "already scanned"
    if (scannedBoxes.find(b => b.box_serial === serial)) {
      setLastResult({ ok: false, message: `Already scanned on this pallet: ${serial}` });
      setScanning(false); inputRef.current?.focus(); return;
    }

    // If box is ON_PALLET_REGISTERED — check which pallet record it belongs to
    if (label.status === 'ON_PALLET_REGISTERED') {
      const links = await base44.entities.BoxPalletLink.filter({ box_serial: serial }, '-created_date', 1);
      if (links.length > 0) {
        // Check if this link belongs to our current pallet record
        const isOurPallet = links[0].pallet_id === pallet.pallet_id &&
          (links[0].box_pallet_record_id === pallet.id || !links[0].box_pallet_record_id);
        if (isOurPallet) {
          // Already on this pallet in DB — but not in local state yet (resume scenario)
          // DO NOT add again, just inform
          setLastResult({ ok: false, message: `Already scanned on this pallet: ${serial}` });
        } else {
          setLastResult({ ok: false, message: `❌ Already on pallet "${links[0].pallet_id}" — use a different label` });
        }
      } else {
        setLastResult({ ok: false, message: `❌ Box is ON_PALLET_REGISTERED but no link found — contact admin` });
      }
      setScanning(false); inputRef.current?.focus(); return;
    }

    // Allow PRINTED_UNREGISTERED; admin can also scan IN_STOCK
    const allowed = ['PRINTED_UNREGISTERED'];
    if (user?.role === 'admin') allowed.push('IN_STOCK');
    if (!allowed.includes(label.status)) {
      setLastResult({ ok: false, message: `❌ Cannot add — box status is ${label.status}` });
      setScanning(false); inputRef.current?.focus(); return;
    }

    // Cross-pallet duplicate check via links table
    const existingLinks = await base44.entities.BoxPalletLink.filter({ box_serial: serial }, '-created_date', 1);
    if (existingLinks.length > 0) {
      setLastResult({ ok: false, message: `❌ Already linked to pallet "${existingLinks[0].pallet_id}"` });
      setScanning(false); inputRef.current?.focus(); return;
    }

    // Enforce single product per pallet
    if (scannedBoxes.length > 0) {
      const firstBox = scannedBoxes[0];
      if (firstBox.item_code !== label.item_code) {
        setLastResult({ ok: false, message: `❌ Pallet already has item "${firstBox.item_code}" — cannot mix products` });
        setScanning(false); inputRef.current?.focus(); return;
      }
      if (firstBox.batch_no !== label.batch_no) {
        setLastResult({ ok: false, message: `❌ Pallet already has batch "${firstBox.batch_no}" — cannot mix batches` });
        setScanning(false); inputRef.current?.focus(); return;
      }
    }

    // Create link
    await base44.entities.BoxPalletLink.create({
      pallet_id: pallet.pallet_id,
      box_pallet_record_id: pallet.id,
      box_serial: serial,
      scanned_at: new Date().toISOString(),
      scanned_by: user?.email || '',
    });

    // Update box status
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

  const firstBox = scannedBoxes[0];
  const productName = firstBox ? getProductName(firstBox.item_code) : null;

  return (
    <div className="space-y-4">
      {/* Pallet header */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 flex items-center justify-between">
        <div>
          <span className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Active Pallet</span>
          <p className="font-bold text-emerald-900 text-lg font-mono">{pallet.pallet_id}</p>
          <p className="text-xs text-emerald-600">Draft auto-saves as you scan</p>
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
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scan Box QR / Serial</span>
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
            <span className="break-all">{lastResult.message}</span>
          </div>
        )}
      </div>

      {/* Contents summary */}
      {scannedBoxes.length > 0 && firstBox && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Contents Summary</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{productName}</p>
              <p className="text-xs text-slate-500 font-mono">{firstBox.item_code} · Batch: {firstBox.batch_no}</p>
              {firstBox.exp_date && <p className="text-xs text-slate-400">Exp: {firstBox.exp_date}</p>}
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-slate-900">{scannedBoxes.length}</span>
              <p className="text-xs text-slate-500">boxes</p>
            </div>
          </div>
        </div>
      )}

      {/* Scanned list */}
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