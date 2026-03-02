import QRCode from 'react-qr-code';
import Barcode from 'react-barcode';
import { format } from 'date-fns';

/**
 * 6×4 inch crate label — intended for print-only rendering.
 * Props: crate_id, product_code, batch_id, bottle_type, filler_machine_id, filled_at, operator_name
 */
export default function CrateLabel6x4({ crate_id, product_code, batch_id, bottle_type, filler_machine_id, filled_at, operator_name }) {
  const filledStr = filled_at ? format(new Date(filled_at), 'dd MMM yyyy HH:mm') : '—';

  return (
    <div style={{
      width: '6in',
      height: '4in',
      padding: '0.18in',
      boxSizing: 'border-box',
      fontFamily: 'monospace',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #000',
      background: '#fff',
      pageBreakAfter: 'always',
    }}>
      {/* Top row: QR + main info */}
      <div style={{ display: 'flex', gap: '0.15in', flex: 1 }}>
        {/* QR code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '1.1in' }}>
          <QRCode value={crate_id || 'N/A'} size={96} />
        </div>

        {/* Main info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* Crate ID big */}
          <div>
            <p style={{ fontSize: '9pt', color: '#555', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>CRATE ID</p>
            <p style={{ fontSize: '22pt', fontWeight: 'bold', margin: 0, letterSpacing: '0.03em', lineHeight: 1.1 }}>{crate_id}</p>
          </div>

          {/* Product + batch */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginTop: '0.05in' }}>
            <div>
              <p style={{ fontSize: '7pt', color: '#777', margin: 0 }}>PRODUCT</p>
              <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: 0 }}>{product_code}</p>
            </div>
            <div>
              <p style={{ fontSize: '7pt', color: '#777', margin: 0 }}>BATCH</p>
              <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: 0 }}>{batch_id}</p>
            </div>
            <div>
              <p style={{ fontSize: '7pt', color: '#777', margin: 0 }}>BOTTLE TYPE</p>
              <p style={{ fontSize: '9pt', fontWeight: 'bold', margin: 0 }}>{bottle_type}</p>
            </div>
            <div>
              <p style={{ fontSize: '7pt', color: '#777', margin: 0 }}>FILLER</p>
              <p style={{ fontSize: '9pt', fontWeight: 'bold', margin: 0 }}>{filler_machine_id}</p>
            </div>
          </div>

          {/* Timestamp + operator */}
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '3px', marginTop: '4px' }}>
            <p style={{ fontSize: '7.5pt', color: '#444', margin: 0 }}>Filled: {filledStr}{operator_name ? ` · ${operator_name}` : ''}</p>
          </div>
        </div>
      </div>

      {/* Barcode strip */}
      <div style={{ marginTop: '0.1in', display: 'flex', justifyContent: 'center' }}>
        <Barcode
          value={crate_id || 'UNKNOWN'}
          format="CODE128"
          width={1.6}
          height={40}
          fontSize={10}
          margin={0}
          displayValue={true}
        />
      </div>
    </div>
  );
}