import { useEffect, useRef } from 'react';
import BoxLabelTemplate from './BoxLabelTemplate';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';

/**
 * Opens a modal with all N labels rendered and a Print button.
 * Print uses a hidden iframe with injected HTML / CSS so only labels print.
 */
export default function PrintPreview({ labels, product, onClose }) {
  const previewRef = useRef(null);

  function handlePrint() {
    const style = `
      <style>
        @page { size: 6in 4in; margin: 0; }
        body { margin: 0; padding: 0; background: #fff; }
        .box-label-page {
          width: 6in; height: 4in;
          page-break-after: always;
          break-after: page;
        }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    `;
    const bodyHTML = previewRef.current?.innerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html><head>${style}</head><body>${bodyHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="font-bold text-slate-900">Print Preview — {labels.length} label{labels.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-slate-500">Each label is 6 × 4 inches (Code128 barcode + QR code)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handlePrint} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Printer className="w-4 h-4" /> Print All
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto bg-slate-200 p-6 flex flex-col items-center gap-4">
        <div ref={previewRef}>
          {labels.map((lbl, i) => (
            <div key={i} style={{ marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', background: '#fff', display: 'inline-block' }}>
              {/* Scale down 6in×4in for screen: ~72px/in → show at 0.9 scale */}
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '6in', height: '4in' }}>
                <BoxLabelTemplate label={lbl} product={product} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}