import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';

// Rendered at exactly 6in × 4in. Used both on-screen (scaled) and for print.
export default function BoxLabelTemplate({ label, product }) {
  if (!label || !product) return null;

  const mfg = label.mfg_date || '—';
  const exp = label.exp_date || '—';
  const barcodeVal = product.product_barcode || product.item_code || 'UNKNOWN';
  const qrVal = label.qr_payload || label.box_serial || 'NO-QR';

  return (
    <div
      className="box-label-page"
      style={{
        width: '6in',
        height: '4in',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10pt',
        padding: '0.12in',
        boxSizing: 'border-box',
        background: '#fff',
        color: '#000',
        overflow: 'hidden',
        pageBreakAfter: 'always',
      }}
    >
      {/* Top section: brand + product info + QR */}
      <div style={{ display: 'flex', gap: '0.1in', flex: '0 0 auto', alignItems: 'flex-start' }}>
        {/* Left: product details */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '8pt', color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2pt' }}>
            {product.brand_name}
          </div>
          <div style={{ fontSize: '18pt', fontWeight: 'bold', lineHeight: 1.15, marginBottom: '2pt' }}>
            {product.product_name}
          </div>
          {product.flavour && (
            <div style={{ fontSize: '12pt', fontWeight: '600', color: '#333', marginBottom: '4pt' }}>
              {product.flavour}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.3in', marginTop: '4pt' }}>
            <div>
              <span style={{ fontSize: '7pt', color: '#888', display: 'block', textTransform: 'uppercase' }}>Mfg Date</span>
              <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>{mfg}</span>
            </div>
            <div>
              <span style={{ fontSize: '7pt', color: '#888', display: 'block', textTransform: 'uppercase' }}>Exp Date</span>
              <span style={{ fontSize: '11pt', fontWeight: 'bold', color: '#b91c1c' }}>{exp}</span>
            </div>
            <div>
              <span style={{ fontSize: '7pt', color: '#888', display: 'block', textTransform: 'uppercase' }}>Batch</span>
              <span style={{ fontSize: '11pt', fontWeight: 'bold' }}>{label.batch_no}</span>
            </div>
          </div>
        </div>

        {/* Right: QR code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2pt', flexShrink: 0 }}>
          <QRCode value={qrVal} size={80} style={{ height: '0.85in', width: '0.85in' }} />
          <span style={{ fontSize: '6pt', color: '#555', maxWidth: '0.9in', wordBreak: 'break-all', textAlign: 'center' }}>
            {label.box_serial}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '0.5pt solid #ccc', margin: '0.06in 0' }} />

      {/* Middle: pack info row */}
      <div style={{ display: 'flex', gap: '0.3in', flex: '0 0 auto', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.25in' }}>
          {product.ml_per_bottle && (
            <Spec label="Vol/Bottle" value={`${product.ml_per_bottle} ml`} />
          )}
          {product.bottles_per_box && (
            <Spec label="Bottles/Box" value={product.bottles_per_box} />
          )}
          {product.gross_weight_kg && (
            <Spec label="Gross Wt" value={`${product.gross_weight_kg} kg`} />
          )}
          {product.mrp_box && (
            <Spec label="MRP (Box)" value={`₹ ${product.mrp_box}`} big />
          )}
        </div>

        {/* 1D Barcode */}
        <div style={{ flexShrink: 0 }}>
          <Barcode
            value={barcodeVal}
            format="CODE128"
            width={1.2}
            height={40}
            displayValue={true}
            fontSize={8}
            margin={0}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '0.5pt solid #ccc', margin: '0.06in 0' }} />

      {/* Bottom: manufacturer info */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.15in', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '8pt', fontWeight: 'bold', marginBottom: '2pt' }}>
              {product.manufacturer_name}
            </div>
            {product.address_1 && (
              <div style={{ fontSize: '7pt', color: '#444', lineHeight: 1.4 }}>{product.address_1}</div>
            )}
            {product.address_2 && (
              <div style={{ fontSize: '7pt', color: '#444', lineHeight: 1.4 }}>{product.address_2}</div>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            {product.fssai_no && (
              <div style={{ fontSize: '7pt', color: '#555' }}>
                <span style={{ fontWeight: 'bold' }}>FSSAI:</span> {product.fssai_no}
              </div>
            )}
            {product.customer_care_phone && (
              <div style={{ fontSize: '7pt', color: '#555', marginTop: '2pt' }}>
                <span style={{ fontWeight: 'bold' }}>Care:</span> {product.customer_care_phone}
              </div>
            )}
            {product.customer_care_email && (
              <div style={{ fontSize: '7pt', color: '#555' }}>
                {product.customer_care_email}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '6pt', color: '#aaa', textAlign: 'right', marginTop: '2pt' }}>
          {label.item_code} · Printed {label.printed_at ? new Date(label.printed_at).toLocaleString() : '—'}
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value, big }) {
  return (
    <div>
      <span style={{ fontSize: '6.5pt', color: '#888', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: big ? '11pt' : '9pt', fontWeight: big ? 'bold' : '600' }}>{value}</span>
    </div>
  );
}