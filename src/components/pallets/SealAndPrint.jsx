import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Printer, FileText, CheckCircle, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';

export default function SealAndPrint({ pallet, scannedBoxes, user, onSealed, onHandoverReady }) {
  const [sealing, setSealing] = useState(false);
  const [sealed, setSealed] = useState(pallet.status === 'SEALED');
  const [sealedPallet, setSealedPallet] = useState(pallet.status === 'SEALED' ? pallet : null);
  const [manifestPrinted, setManifestPrinted] = useState(false);

  const summary = Object.values(
    scannedBoxes.reduce((acc, b) => {
      const key = `${b.item_code}|${b.batch_no}`;
      if (!acc[key]) acc[key] = { item_code: b.item_code, batch_no: b.batch_no, count: 0 };
      acc[key].count++;
      return acc;
    }, {})
  );

  async function handleSeal() {
    setSealing(true);
    const now = new Date().toISOString();
    const updated = await base44.entities.BoxPallet.update(pallet.id, {
      status: 'SEALED',
      sealed_at: now,
      sealed_by: user?.email || '',
      total_boxes: scannedBoxes.length,
    });
    const sealedData = { status: 'SEALED', sealed_at: now, sealed_by: user?.email, total_boxes: scannedBoxes.length };
    setSealing(false);
    setSealed(true);
    setSealedPallet({ ...pallet, ...sealedData });
    onSealed?.(sealedData);
  }

  function printPalletLabel() {
    const top3 = summary.slice(0, 3);
    const qrVal = JSON.stringify({ p: pallet.pallet_id });
    const sealTime = sealedPallet?.sealed_at ? new Date(sealedPallet.sealed_at).toLocaleString() : '—';

    const html = `<!DOCTYPE html><html><head>
      <style>
        @page { size: 6in 4in; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; }
        .label { width: 6in; height: 4in; display: flex; flex-direction: column; padding: 0.15in; box-sizing: border-box; border: 1px solid #000; }
        .brand { font-size: 7pt; color: #888; letter-spacing: 0.08em; text-transform: uppercase; }
        .pallet-id { font-size: 28pt; font-weight: 900; letter-spacing: 0.04em; margin: 2pt 0; }
        .row { display: flex; gap: 0.4in; margin-top: 6pt; }
        .spec-label { font-size: 6.5pt; color: #888; text-transform: uppercase; display: block; }
        .spec-val { font-size: 10pt; font-weight: bold; }
        .divider { border-top: 0.5pt solid #ccc; margin: 6pt 0; }
        .summary-row { font-size: 8pt; display: flex; justify-content: space-between; padding: 1pt 0; }
        .qr-wrap { flex-shrink: 0; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; }
        .staging { font-size: 8pt; color: #444; margin-top: 4pt; }
        .footer { margin-top: auto; font-size: 6pt; color: #aaa; text-align: right; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>
      <div class="label">
        <div class="top">
          <div style="flex:1">
            <div class="brand">FG Pallet</div>
            <div class="pallet-id">${pallet.pallet_id}</div>
            <div class="row">
              <div><span class="spec-label">Sealed</span><span class="spec-val">${sealTime}</span></div>
              <div><span class="spec-label">Total Boxes</span><span class="spec-val">${scannedBoxes.length}</span></div>
            </div>
          </div>
          <div class="qr-wrap">
            ${document.getElementById('__pallet-qr-svg')?.innerHTML || ''}
          </div>
        </div>
        <div class="divider"></div>
        <div>
          ${top3.map(r => `<div class="summary-row"><span>${r.item_code} · ${r.batch_no}</span><span>${r.count} boxes</span></div>`).join('')}
          ${summary.length > 3 ? `<div class="summary-row" style="color:#888">+ ${summary.length - 3} more item groups</div>` : ''}
        </div>
        ${sealedPallet?.staging_location ? `<div class="staging">📦 Staging: ${sealedPallet.staging_location}</div>` : ''}
        <div class="footer">Sealed by ${sealedPallet?.sealed_by || '—'} · ${pallet.pallet_id}</div>
      </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function printManifestAndMark() {
    setManifestPrinted(true);
    printManifest();
  }

  function printManifest() {
    const rows = scannedBoxes.slice(0, 20).map(b =>
      `<tr><td>${b.box_serial}</td><td>${b.item_code || '—'}</td><td>${b.batch_no || '—'}</td><td>${b.exp_date || '—'}</td></tr>`
    ).join('');
    const more = scannedBoxes.length > 20 ? `<p style="color:#888;font-size:10pt;">...and ${scannedBoxes.length - 20} more</p>` : '';
    const summaryRows = summary.map(r =>
      `<tr><td><b>${r.item_code}</b></td><td>${r.batch_no}</td><td>${r.count}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
        h1 { font-size: 18pt; margin-bottom: 4pt; }
        h2 { font-size: 13pt; margin-top: 16pt; margin-bottom: 4pt; }
        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        th { border-bottom: 1.5pt solid #000; text-align: left; padding: 4pt 6pt; font-size: 8pt; text-transform: uppercase; }
        td { border-bottom: 0.5pt solid #ddd; padding: 3pt 6pt; }
        .meta { font-size: 9pt; color: #555; margin-bottom: 12pt; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>
      <h1>Pallet Manifest — ${pallet.pallet_id}</h1>
      <div class="meta">Sealed: ${sealedPallet?.sealed_at ? new Date(sealedPallet.sealed_at).toLocaleString() : '—'} · By: ${sealedPallet?.sealed_by || '—'} · Total boxes: ${scannedBoxes.length}</div>
      <h2>Contents Summary</h2>
      <table><thead><tr><th>Item Code</th><th>Batch</th><th>Boxes</th></tr></thead>
      <tbody>${summaryRows}</tbody></table>
      <h2>Box Serials (first 20)</h2>
      <table><thead><tr><th>Box Serial</th><th>Item Code</th><th>Batch</th><th>Exp Date</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${more}
    </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="space-y-4">
      {!sealed && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-900">Seal Pallet</h3>
          <p className="text-sm text-slate-600">
            You are about to seal <span className="font-bold">{pallet.pallet_id}</span> with{' '}
            <span className="font-bold">{scannedBoxes.length} boxes</span>. This cannot be undone.
          </p>
          <div className="space-y-1">
            {summary.map((r, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-700">{r.item_code} · {r.batch_no}</span>
                <span className="font-bold">{r.count} boxes</span>
              </div>
            ))}
          </div>
          <Button onClick={handleSeal} disabled={sealing} className="w-full bg-slate-900 hover:bg-slate-800 gap-2 h-11">
            {sealing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Confirm Seal Pallet</>}
          </Button>
        </div>
      )}

      {sealed && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-900">Pallet Sealed!</p>
              <p className="text-xs text-emerald-700">{pallet.pallet_id} · {scannedBoxes.length} boxes · {sealedPallet?.sealed_at ? new Date(sealedPallet.sealed_at).toLocaleString() : ''}</p>
            </div>
          </div>

          {/* Hidden QR for label printing */}
          <div id="__pallet-qr-svg" style={{ display: 'none' }}>
            <QRCode value={JSON.stringify({ p: pallet.pallet_id })} size={72} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={printPalletLabel} variant="outline" className="gap-2 h-12">
              <Printer className="w-4 h-4" /> Pallet Label (6×4)
            </Button>
            <Button onClick={printManifestAndMark} variant="outline" className={`gap-2 h-12 ${manifestPrinted ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : ''}`}>
              <FileText className="w-4 h-4" /> {manifestPrinted ? '✓ Manifest Printed' : 'Full Manifest (A4)'}
            </Button>
          </div>

          {!manifestPrinted && (
            <p className="text-xs text-amber-600 text-center font-medium">⚠ Print the manifest to proceed</p>
          )}

          <Button
            onClick={onHandoverReady}
            disabled={!manifestPrinted}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2 h-11 disabled:opacity-40"
          >
            Proceed to Photo Proof →
          </Button>
        </>
      )}
    </div>
  );
}