import Barcode from 'react-barcode';

/**
 * Print-only 6×4 sticker for a label roll.
 * Props: roll_id, label_variant_id, product_code, declared_qty_labels
 */
export default function RollBarcodeLabel({ roll_id, label_variant_id, product_code, declared_qty_labels }) {
  return (
    <div style={{
      width: '6in', height: '4in',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0.4in', fontFamily: 'monospace',
      background: '#fff', color: '#000', gap: '0.2in',
    }}>
      <p style={{ fontSize: '22pt', fontWeight: 900, letterSpacing: 2 }}>LABEL ROLL</p>
      <Barcode value={roll_id} width={2.5} height={60} fontSize={14} />
      <p style={{ fontSize: '14pt', fontWeight: 700 }}>{roll_id}</p>
      <div style={{ fontSize: '11pt', textAlign: 'center', lineHeight: 1.7 }}>
        {product_code && <p>Product: {product_code}</p>}
        {label_variant_id && <p>Variant: {label_variant_id}</p>}
        {declared_qty_labels != null && <p>Declared: {declared_qty_labels.toLocaleString()} labels</p>}
      </div>
    </div>
  );
}