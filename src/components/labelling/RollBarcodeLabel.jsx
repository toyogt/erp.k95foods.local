import Barcode from 'react-barcode';

/**
 * Print-only 6×4 sticker for a label roll.
 * Props: roll_id, sku_code, artwork_name, artwork_version, barcode, declared_qty_labels
 */
export default function RollBarcodeLabel({ roll_id, sku_code, artwork_name, artwork_version, barcode, declared_qty_labels }) {
  return (
    <div style={{
      width: '6in', height: '4in',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0.4in', fontFamily: 'monospace',
      background: '#fff', color: '#000', gap: '0.15in',
    }}>
      <p style={{ fontSize: '20pt', fontWeight: 900, letterSpacing: 2 }}>LABEL ROLL</p>
      <Barcode value={roll_id} width={2.5} height={60} fontSize={14} />
      <p style={{ fontSize: '13pt', fontWeight: 700 }}>{roll_id}</p>
      <div style={{ fontSize: '11pt', textAlign: 'center', lineHeight: 1.8 }}>
        {sku_code && <p>SKU: <strong>{sku_code}</strong></p>}
        {artwork_name && <p>Artwork: <strong>{artwork_name}</strong></p>}
        {artwork_version && <p style={{ fontSize: '14pt', fontWeight: 900 }}>Version: {artwork_version}</p>}
        {barcode && <p>Barcode: {barcode}</p>}
        {declared_qty_labels != null && <p>Declared: {declared_qty_labels.toLocaleString()} labels</p>}
      </div>
    </div>
  );
}