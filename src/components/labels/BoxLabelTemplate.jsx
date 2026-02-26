import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';

// Portrait label: 4in wide × 6in tall
export default function BoxLabelTemplate({ label, product }) {
  if (!label || !product) return null;

  function fmtDate(d) {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return d;
  }
  const mfg = fmtDate(label.mfg_date);
  const exp = fmtDate(label.exp_date);
  const qtyVol = (product.bottles_per_box && product.ml_per_bottle)
    ? `${product.bottles_per_box} × ${product.ml_per_bottle}ml`
    : null;
  const barcodeVal = product.product_barcode || product.item_code || 'UNKNOWN';
  const qrVal = label.qr_payload || label.box_serial || 'NO-QR';

  return (
    <div
      className="box-label-page"
      style={{
        width: '4in',
        height: '6in',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10pt',
        padding: '0.15in',
        boxSizing: 'border-box',
        background: '#fff',
        color: '#000',
        overflow: 'hidden',
      }}
    >
      {/* ── TOP: brand + QR side by side ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.1in' }}>
        <div style={{ flex: 1 }}>
          {product.brand_name && (
            <div style={{ fontSize: '7pt', color: '#777', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3pt' }}>
              {product.brand_name}
            </div>
          )}
          <div style={{ fontSize: '16pt', fontWeight: 'bold', lineHeight: 1.15, marginBottom: '3pt' }}>
            {product.product_name}
          </div>
          {product.flavour && (
            <div style={{ fontSize: '10pt', fontWeight: '600', color: '#444' }}>
              {product.flavour}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <QRCode value={qrVal} size={75} style={{ height: '0.95in', width: '0.95in' }} />
          <span style={{ fontSize: '5.5pt', color: '#666', maxWidth: '1in', wordBreak: 'break-all', textAlign: 'center', marginTop: '2pt' }}>
            {label.box_serial}
          </span>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ borderTop: '0.5pt solid #ccc', margin: '0.1in 0' }} />

      {/* ── DATES + BATCH ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.05in' }}>
        <div>
          <div style={{ fontSize: '6.5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mfg Date</div>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '1pt' }}>{mfg}</div>
        </div>
        <div>
          <div style={{ fontSize: '6.5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exp Date</div>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', color: '#b91c1c', marginTop: '1pt' }}>{exp}</div>
        </div>
        <div>
          <div style={{ fontSize: '6.5pt', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batch</div>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', marginTop: '1pt' }}>{label.batch_no}</div>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ borderTop: '0.5pt solid #ccc', margin: '0.1in 0' }} />

      {/* ── SPECS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.08in 0.15in' }}>
        {qtyVol && <Spec label="Qty × Vol (bottles)" value={qtyVol} />}
        {!qtyVol && product.ml_per_bottle && <Spec label="Vol / Bottle" value={`${product.ml_per_bottle} ml`} />}
        {!qtyVol && product.bottles_per_box && <Spec label="Bottles / Box" value={`${product.bottles_per_box} bottles`} />}
        {product.gross_weight_kg && <Spec label="Gross Weight" value={`${product.gross_weight_kg} kg`} />}
        {product.mrp_box && <Spec label="MRP (Box)" value={`₹ ${product.mrp_box}`} big />}
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ borderTop: '0.5pt solid #ccc', margin: '0.1in 0' }} />

      {/* ── BARCODE (full width) ── */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Barcode
          value={barcodeVal}
          format="CODE128"
          width={1.6}
          height={52}
          displayValue={true}
          fontSize={9}
          margin={0}
        />
      </div>

      {/* ── DIVIDER ── */}
      <div style={{ borderTop: '0.5pt solid #ccc', margin: '0.1in 0' }} />

      {/* ── MANUFACTURER INFO ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.1in' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '2pt' }}>
              {product.manufacturer_name}
            </div>
            {product.address_1 && (
              <div style={{ fontSize: '7pt', color: '#444', lineHeight: 1.5 }}>{product.address_1}</div>
            )}
            {product.address_2 && (
              <div style={{ fontSize: '7pt', color: '#444', lineHeight: 1.5 }}>{product.address_2}</div>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            {product.fssai_no && (
              <div style={{ fontSize: '7pt', color: '#555' }}>
                <span style={{ fontWeight: 'bold' }}>FSSAI:</span> {product.fssai_no}
              </div>
            )}
            {product.customer_care_phone && (
              <div style={{ fontSize: '7pt', color: '#555', marginTop: '3pt' }}>
                <span style={{ fontWeight: 'bold' }}>Care:</span> {product.customer_care_phone}
              </div>
            )}
            {product.customer_care_email && (
              <div style={{ fontSize: '7pt', color: '#555', marginTop: '1pt' }}>
                {product.customer_care_email}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '6pt', color: '#aaa', textAlign: 'right', marginTop: '4pt' }}>
          {label.item_code} · Printed {label.printed_at ? new Date(label.printed_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value, big }) {
  return (
    <div>
      <span style={{ fontSize: '6.5pt', color: '#888', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: big ? '12pt' : '10pt', fontWeight: big ? 'bold' : '600' }}>{value}</span>
    </div>
  );
}