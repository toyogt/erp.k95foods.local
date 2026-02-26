import { useRef } from 'react';
import BoxLabelTemplate from './BoxLabelTemplate';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';

export default function PrintPreview({ labels, product, onClose }) {
  const previewRef = useRef(null);

  function handlePrint() {
    const printItems = previewRef.current?.querySelectorAll('.lbl-print-page') || [];
    const pages = Array.from(printItems).map(el => el.innerHTML);
    const pageHTML = pages.map((html, i) => `
      <div class="lbl-print-page">${html}</div>
    `).join('');

    const style = `
      <style>
        @page { size: 4in 6in; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; width: 4in; }
        .lbl-print-page {
          display: block;
          width: 4in;
          height: 6in;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .lbl-print-page:not(:last-child) {
          page-break-after: always;
          break-after: page;
        }
        .lbl-print-page > div {
          transform: none !important;
          width: 4in !important;
          height: 6in !important;
          transform-origin: top left !important;
        }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    `;
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<!DOCTYPE html><html><head>${style}</head><body>${pageHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="font-bold text-slate-900">Print Preview — {labels.length} label{labels.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-slate-500">Each label is 4 × 6 inches (portrait)</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handlePrint} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Printer className="w-4 h-4" /> Print All ({labels.length})
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto bg-slate-200 p-6 flex flex-col items-center gap-4">
        <div ref={previewRef}>
          {labels.map((lbl, i) => (
            <div
              key={i}
              className="lbl-print-page"
              style={{
                marginBottom: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                background: '#fff',
                width: `${0.85 * 4}in`,
                height: `${0.85 * 6}in`,
                overflow: 'hidden',
              }}
            >
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '4in', height: '6in' }}>
                <BoxLabelTemplate label={lbl} product={product} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}