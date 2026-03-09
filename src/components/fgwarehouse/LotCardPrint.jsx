import QRCode from 'react-qr-code';

export default function LotCardPrint({ lot }) {
  if (!lot) return null;

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=500');
    win.document.write(`
      <html>
      <head>
        <title>Lot Card - ${lot.lot_id}</title>
        <style>
          @page { size: 6in 4in; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { width: 6in; height: 4in; font-family: Arial, sans-serif; display: flex; }
          .card { width: 100%; height: 100%; display: flex; flex-direction: row; border: 3px solid #000; }
          .left { flex: 1; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; }
          .right { width: 180px; background: #f0f0f0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 14px; border-left: 2px solid #000; }
          .lot-id { font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #111; }
          .product { font-size: 22px; font-weight: 800; color: #000; line-height: 1.2; margin-top: 6px; }
          .sub { font-size: 13px; color: #444; margin-top: 3px; }
          .row { display: flex; gap: 20px; margin-top: 8px; }
          .stat { }
          .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #777; }
          .stat-value { font-size: 18px; font-weight: 800; color: #000; }
          .qr-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; text-align: center; }
          .footer { font-size: 10px; color: #888; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="left">
            <div>
              <div class="lot-id">${lot.lot_id}</div>
              <div class="product">${lot.product_name || lot.sku_code}</div>
              <div class="sub">${[lot.brand_name, lot.product_family, lot.flavour].filter(Boolean).join(' · ')}</div>
              <div class="row">
                <div class="stat">
                  <div class="stat-label">Boxes In</div>
                  <div class="stat-value">${lot.boxes_in || 0}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Bottles/Box</div>
                  <div class="stat-value">${lot.bottles_per_box || '—'}</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Loose Bottles</div>
                  <div class="stat-value">${lot.loose_bottles_in || 0}</div>
                </div>
              </div>
            </div>
            <div>
              ${lot.location ? `<div class="sub">📍 ${lot.location}</div>` : ''}
              <div class="footer">Date: ${lot.lot_date || ''} &nbsp;|&nbsp; SKU: ${lot.sku_code}</div>
            </div>
          </div>
          <div class="right">
            <div id="qr-placeholder"></div>
            <div class="qr-label">${lot.lot_id}</div>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
        <script>
          QRCode.toCanvas(document.createElement('canvas'), '${lot.lot_id}', { width: 140 }, function(err, canvas) {
            if (!err) document.getElementById('qr-placeholder').appendChild(canvas);
          });
          window.onload = function() { setTimeout(function(){ window.print(); window.close(); }, 800); };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
      {/* Preview */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-slate-400 font-mono font-semibold">{lot.lot_id}</p>
          <p className="text-base font-bold text-slate-900">{lot.product_name || lot.sku_code}</p>
          <p className="text-xs text-slate-500">{[lot.brand_name, lot.product_family, lot.flavour].filter(Boolean).join(' · ')}</p>
          <div className="flex gap-4 mt-2">
            <div>
              <p className="text-xs text-slate-400">Boxes</p>
              <p className="text-lg font-bold text-slate-900">{lot.boxes_in || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Bottles/Box</p>
              <p className="text-lg font-bold text-slate-900">{lot.bottles_per_box || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Loose</p>
              <p className="text-lg font-bold text-slate-900">{lot.loose_bottles_in || 0}</p>
            </div>
          </div>
          {lot.location && <p className="text-xs text-slate-400">📍 {lot.location}</p>}
        </div>
        <QRCode value={lot.lot_id} size={90} />
      </div>
      <button
        onClick={handlePrint}
        className="w-full py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
      >
        🖨️ Print Lot Card (6×4)
      </button>
    </div>
  );
}