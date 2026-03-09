import QRCode from 'react-qr-code';

// Deterministic color from product identity — helps workers visually differentiate
const PALETTE = [
  { bg: '#1d4ed8', stripe: '#1e3a8a', text: '#ffffff', badge: '#93c5fd', name: 'Blue'   },
  { bg: '#15803d', stripe: '#14532d', text: '#ffffff', badge: '#86efac', name: 'Green'  },
  { bg: '#c2410c', stripe: '#7c2d12', text: '#ffffff', badge: '#fdba74', name: 'Orange' },
  { bg: '#7c3aed', stripe: '#4c1d95', text: '#ffffff', badge: '#c4b5fd', name: 'Purple' },
  { bg: '#be123c', stripe: '#881337', text: '#ffffff', badge: '#fda4af', name: 'Red'    },
  { bg: '#0e7490', stripe: '#164e63', text: '#ffffff', badge: '#67e8f9', name: 'Teal'   },
  { bg: '#854d0e', stripe: '#431407', text: '#ffffff', badge: '#fde68a', name: 'Amber'  },
  { bg: '#1e3a5f', stripe: '#0f172a', text: '#ffffff', badge: '#94a3b8', name: 'Navy'   },
];

function getColor(lot) {
  const key = ((lot.flavour || '') + (lot.brand_name || '') + (lot.product_name || '')).toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  } catch { return iso; }
}

function createdAt(lot) {
  if (!lot.created_date) return '';
  try {
    const d = new Date(lot.created_date);
    return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

export default function LotCardPrint({ lot }) {
  if (!lot) return null;
  const col = getColor(lot);

  const handlePrint = () => {
    const created = createdAt(lot);
    const win = window.open('', '_blank', 'width=780,height=520');
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Lot Card — ${lot.lot_id}</title>
  <style>
    @page { size: 6in 4in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: 6in; height: 4in; font-family: 'Arial Black', Arial, sans-serif; background: #fff; }
    .card { width: 100%; height: 100%; display: flex; border: 3px solid #000; overflow: hidden; }

    /* LEFT COLOR STRIPE */
    .stripe {
      width: 1.1in;
      background: ${col.bg};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 6px;
      gap: 8px;
      border-right: 3px solid #000;
      flex-shrink: 0;
    }
    .stripe-flavour {
      color: #fff;
      font-size: 20px;
      font-weight: 900;
      text-align: center;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1;
    }
    .stripe-brand {
      color: rgba(255,255,255,0.75);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: center;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
    }

    /* MAIN CONTENT */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 14px 16px 10px 14px;
      justify-content: space-between;
      min-width: 0;
    }
    .top-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .lot-id {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #555;
      text-transform: uppercase;
    }
    .created {
      font-size: 9px;
      color: #888;
      text-align: right;
      white-space: nowrap;
    }
    .product-name {
      font-size: 26px;
      font-weight: 900;
      color: #000;
      line-height: 1.1;
      margin-top: 6px;
    }
    .flavour-badge {
      display: inline-block;
      background: ${col.bg};
      color: #fff;
      font-size: 15px;
      font-weight: 900;
      padding: 3px 12px;
      border-radius: 20px;
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .brand-pill {
      display: inline-block;
      border: 2px solid ${col.bg};
      color: ${col.bg};
      font-size: 11px;
      font-weight: 800;
      padding: 2px 10px;
      border-radius: 20px;
      margin-top: 4px;
      margin-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .divider { border: none; border-top: 1.5px solid #ddd; margin: 8px 0; }

    .info-grid { display: flex; gap: 20px; }
    .info-cell {}
    .info-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial; font-weight: 400; }
    .info-value { font-size: 15px; font-weight: 900; color: #111; line-height: 1.2; }

    .footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 6px;
    }
    .sku-text { font-size: 10px; color: #aaa; font-family: 'Courier New', monospace; }
    .loc-text { font-size: 12px; font-weight: 700; color: #333; }

    /* QR PANEL */
    .qr-panel {
      width: 1.55in;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 10px;
      border-left: 2px solid #000;
      background: #fafafa;
      flex-shrink: 0;
    }
    .qr-lot {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 1px;
      color: #333;
      text-align: center;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .scan-text {
      font-size: 9px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
<div class="card">
  <div class="stripe">
    <div class="stripe-flavour">${lot.flavour || lot.product_family || 'STOCK'}</div>
    ${lot.brand_name ? `<div class="stripe-brand">${lot.brand_name}</div>` : ''}
  </div>

  <div class="main">
    <div>
      <div class="top-row">
        <div class="lot-id">LOT: ${lot.lot_id}</div>
        ${created ? `<div class="created">Created:<br>${created}</div>` : ''}
      </div>
      <div class="product-name">${lot.product_name || lot.sku_code}</div>
      <div style="margin-top:5px">
        ${lot.flavour ? `<span class="flavour-badge">${lot.flavour}</span>` : ''}
        ${lot.brand_name ? `<span class="brand-pill">${lot.brand_name}</span>` : ''}
      </div>
    </div>

    <hr class="divider">

    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Batch Code</div>
        <div class="info-value">${lot.batch_code || '—'}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Mfg. Date</div>
        <div class="info-value">${fmtDate(lot.mfg_date)}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Expiry Date</div>
        <div class="info-value" style="color:#c2410c">${fmtDate(lot.exp_date)}</div>
      </div>
    </div>

    <div class="footer-row">
      <div>
        ${lot.location ? `<div class="loc-text">📍 ${lot.location}</div>` : ''}
        <div class="sku-text">SKU: ${lot.sku_code}</div>
      </div>
      <div class="sku-text">${lot.lot_date ? 'Lot Date: ' + fmtDate(lot.lot_date) : ''}</div>
    </div>
  </div>

  <div class="qr-panel">
    <div class="scan-text">Scan to identify</div>
    <div id="qr"></div>
    <div class="qr-lot">${lot.lot_id}</div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
<script>
  QRCode.toCanvas(document.createElement('canvas'), '${lot.lot_id}', { width: 148 }, function(err, canvas) {
    if (!err) document.getElementById('qr').appendChild(canvas);
  });
  window.onload = function() { setTimeout(function(){ window.print(); window.close(); }, 900); };
</script>
</body>
</html>
    `);
    win.document.close();
  };

  // ── In-app preview ────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
      {/* Color header stripe */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: col.bg }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {lot.brand_name || 'BRAND'}
          </p>
          <p className="text-lg font-black text-white uppercase tracking-wide leading-tight">
            {lot.flavour || lot.product_family || 'PRODUCT'}
          </p>
        </div>
        <QRCode value={lot.lot_id} size={72} bgColor="transparent" fgColor="#ffffff" />
      </div>

      {/* Content */}
      <div className="bg-white px-4 py-3 space-y-3">
        <div>
          <p className="text-xs font-mono text-slate-400 font-bold">LOT: {lot.lot_id}</p>
          <p className="text-base font-black text-slate-900 leading-tight mt-0.5">{lot.product_name || lot.sku_code}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {lot.flavour && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: col.bg }}>
                {lot.flavour}
              </span>
            )}
            {lot.brand_name && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border-2" style={{ borderColor: col.bg, color: col.bg }}>
                {lot.brand_name}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Batch</p>
            <p className="text-sm font-black text-slate-900 leading-tight">{lot.batch_code || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Mfg</p>
            <p className="text-sm font-bold text-slate-900">{fmtDate(lot.mfg_date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Exp</p>
            <p className="text-sm font-bold text-orange-700">{fmtDate(lot.exp_date)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          {lot.location && <p className="font-semibold text-slate-600">📍 {lot.location}</p>}
          {lot.created_date && <p>{createdAt(lot)}</p>}
        </div>
      </div>

      <button
        onClick={handlePrint}
        className="w-full py-3 text-white font-bold text-sm uppercase tracking-wider transition-opacity hover:opacity-90 active:opacity-80"
        style={{ background: col.bg }}
      >
        🖨️ Print Lot Card (6×4)
      </button>
    </div>
  );
}