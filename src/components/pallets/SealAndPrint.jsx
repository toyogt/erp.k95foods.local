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
      if (!acc[key]) {
        // product_name may be stored on BoxLabel, or fall back to item_code
        const pname = b.product_name || b.item_code;
        acc[key] = { item_code: b.item_code, batch_no: b.batch_no, count: 0, product_name: pname };
      }
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

    // Create PackedOutputEvent records and update progress
    const [allBoxLabels, allAllocations, allProducts] = await Promise.all([
      base44.entities.BoxLabel.list('-created_date', 5000),
      base44.entities.SKUAllocation.list('-created_date', 5000),
      base44.entities.ProductMaster.list('-created_date', 500),
    ]);

    // Build WO → allocation map
    const allPackingWOs = await base44.entities.PackingWO.list('-created_date', 2000).catch(() => []);
    const woMap = {};
    for (const wo of allPackingWOs) { woMap[wo.wo_id] = wo; }

    // Group scanned boxes by wo_id and sku_code
    const grouped = {};
    for (const scannedBox of scannedBoxes) {
      const boxLabel = allBoxLabels.find(bl => bl.box_serial === scannedBox.box_serial);
      const woId = boxLabel?.wo_id || scannedBox.wo_id || '';
      const skuCode = boxLabel?.item_code || scannedBox.item_code || '';
      const key = `${woId}|${skuCode}`;
      if (!grouped[key]) {
        grouped[key] = { wo_id: woId, sku_code: skuCode, boxes: [] };
      }
      grouped[key].boxes.push(scannedBox);
    }

    // Create PackedOutputEvent for each group + update allocation/order progress
    let eventNum = 1;
    for (const group of Object.values(grouped)) {
      const wo = woMap[group.wo_id];
      // Find allocation: via PackingWO.allocation_id first, else by sku_code match
      const allocation = wo?.allocation_id
        ? allAllocations.find(a => a.allocation_id === wo.allocation_id)
        : allAllocations.find(a => a.sku_code === group.sku_code && a.plan_id === wo?.plan_id);

      const product = allProducts.find(p => p.item_code === group.sku_code);
      const boxesCount = group.boxes.length;
      const bottlesPerBox = product?.bottles_per_box || 1;
      const packedBottles = boxesCount * bottlesPerBox;

      await base44.entities.PackedOutputEvent.create({
        event_id: `PE-${pallet.pallet_id}-${eventNum}`,
        pallet_id: pallet.pallet_id,
        sealed_at: now,
        status: 'ACTIVE',
        wo_id: group.wo_id,
        allocation_id: allocation?.allocation_id || '',
        plan_id: allocation?.plan_id || wo?.plan_id || '',
        order_id: allocation?.order_id || '',
        sku_code: group.sku_code,
        boxes_count: boxesCount,
        bottles_per_box: bottlesPerBox,
        packed_bottles: packedBottles,
      });
      eventNum++;

      // Update SKUAllocation progress
      if (allocation) {
        const existingEvents = await base44.entities.PackedOutputEvent.filter({
          allocation_id: allocation.allocation_id,
          status: 'ACTIVE',
        });
        const totalProduced = existingEvents.reduce((s, e) => s + (e.packed_bottles || 0), 0) + packedBottles;
        const isDone = allocation.required_bottles > 0 && totalProduced >= allocation.required_bottles;
        await base44.entities.SKUAllocation.update(allocation.id, {
          produced_bottles_packed: totalProduced,
          status: isDone ? 'DONE' : (totalProduced > 0 ? 'RUNNING' : allocation.status),
        }).catch(() => {});
      }

      // Update ProductionOrderLine progress (if allocation has order_id / order_line_id)
      if (allocation?.order_line_id) {
        const orderLines = await base44.entities.ProductionOrderLine.filter({ id: allocation.order_line_id }).catch(() => []);
        if (orderLines.length > 0) {
          const line = orderLines[0];
          // Sum all active events for this order_line
          const lineEvents = await base44.entities.PackedOutputEvent.filter({
            order_id: allocation.order_id,
            sku_code: group.sku_code,
            status: 'ACTIVE',
          }).catch(() => []);
          const lineProduced = lineEvents.reduce((s, e) => s + (e.packed_bottles || 0), 0) + packedBottles;
          const lineDone = line.required_bottles > 0 && lineProduced >= line.required_bottles;
          await base44.entities.ProductionOrderLine.update(line.id, {
            produced_bottles_packed: lineProduced,
            status: lineDone ? 'DONE' : (lineProduced > 0 ? 'PARTIAL' : 'OPEN'),
          }).catch(() => {});
        }
      }
    }

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
    // Build detailed product summary from scanned boxes
    const productMap = {};
    for (const b of scannedBoxes) {
      const key = `${b.item_code}|${b.batch_no}`;
      if (!productMap[key]) {
        productMap[key] = {
          item_code: b.item_code,
          batch_no: b.batch_no,
          exp_date: b.exp_date || '—',
          mfg_date: b.mfg_date || '—',
          // product_name stored directly on BoxLabel entity
          product_name: b.product_name || b.item_code,
          count: 0,
        };
      }
      productMap[key].count++;
    }
    const detailRows = Object.values(productMap).map(r => {
      return `<tr>
        <td>${r.product_name}</td>
        <td>${r.item_code}</td>
        <td>${r.batch_no}</td>
        <td>${r.mfg_date}</td>
        <td>${r.exp_date}</td>
        <td style="text-align:right;font-weight:bold">${r.count}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
        h1 { font-size: 18pt; margin-bottom: 4pt; }
        h2 { font-size: 13pt; margin-top: 16pt; margin-bottom: 4pt; }
        table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        th { border-bottom: 1.5pt solid #000; text-align: left; padding: 5pt 6pt; font-size: 8pt; text-transform: uppercase; background: #f5f5f5; }
        td { border-bottom: 0.5pt solid #ddd; padding: 5pt 6pt; }
        .meta { font-size: 9pt; color: #555; margin-bottom: 12pt; line-height: 1.6; }
        .total-row { font-weight: bold; background: #f9f9f9; border-top: 1pt solid #000; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    </head><body>
      <h1>Pallet Manifest — ${pallet.pallet_id}</h1>
      <div class="meta">
        Sealed: ${sealedPallet?.sealed_at ? new Date(sealedPallet.sealed_at).toLocaleString() : '—'}<br/>
        Sealed by: ${sealedPallet?.sealed_by || '—'}<br/>
        Total Boxes: <strong>${scannedBoxes.length}</strong>
      </div>
      <h2>Product Details</h2>
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Item Code</th>
            <th>Batch No</th>
            <th>Mfg Date</th>
            <th>Exp Date</th>
            <th style="text-align:right">Qty (Boxes)</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows}
          <tr class="total-row">
            <td colspan="5">TOTAL</td>
            <td style="text-align:right">${scannedBoxes.length}</td>
          </tr>
        </tbody>
      </table>
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