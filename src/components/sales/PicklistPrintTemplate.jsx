/**
 * Picklist Print Template — matches reference PDF format exactly.
 * Two-column header meta, then items table with full details.
 */

const B = { border: '1px solid #ccc', padding: '6px 10px', fontSize: '12px' };
const BH = { ...B, fontWeight: 'bold', background: '#f9fafb' };

export default function PicklistPrintTemplate({ picklist, soNumber, customerName }) {
  if (!picklist) return null;

  const items = picklist.items || [];
  const totalQty = items.reduce((s, i) => s + (i.required_qty || 0), 0);
  const totalPicked = items.reduce((s, i) => s + (i.picked_qty || 0), 0);

  const fmt = (d) => {
    if (!d) return '—';
    const p = d.split('-');
    if (p.length === 3 && p[0].length === 4) return `${p[2]}-${p[1]}-${p[0]}`;
    return d;
  };

  const leftMeta = [
    ['Company:', 'K95 Foods Private Limited'],
    ['Purpose:', 'Delivery'],
    ['Customer Name:', customerName || '—'],
    ['SO No.:', soNumber || picklist.so_number || '—'],
  ];

  const rightMeta = [
    ['Warehouse:', 'Finished Goods - KFPL'],
    ['Transporter:', picklist.transporter || '—'],
    ['Packaging Type:', picklist.packaging_type || '—'],
    ['Appointment Date:', fmt(picklist.appointment_date)],
    ['Expiry Date:', fmt(picklist.expiry_date)],
    ['PO No.:', soNumber || picklist.so_number || '—'],
    ['Dispatch Date:', fmt(picklist.dispatch_date)],
  ];

  const maxRows = Math.max(leftMeta.length, rightMeta.length);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '20px', background: '#fff', color: '#000', fontSize: '12px' }}>

      {/* Title */}
      <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '6px' }}>Pick List</div>
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
        {picklist.picklist_number}
      </div>
      <hr style={{ border: 'none', borderTop: '2px solid #e74c3c', marginBottom: '16px' }} />

      {/* Two-column meta header */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <tbody>
          {Array.from({ length: maxRows }).map((_, i) => {
            const left = leftMeta[i];
            const right = rightMeta[i];
            return (
              <tr key={i}>
                <td style={{ padding: '4px 0', width: '130px', fontWeight: 'bold', textAlign: 'right', paddingRight: '12px', fontSize: '12px', color: '#333' }}>
                  {left ? left[0] : ''}
                </td>
                <td style={{ padding: '4px 0', width: '220px', fontSize: '12px' }}>
                  {left ? left[1] : ''}
                </td>
                <td style={{ padding: '4px 0', width: '140px', fontWeight: 'bold', textAlign: 'right', paddingRight: '12px', fontSize: '12px', color: '#333' }}>
                  {right ? right[0] : ''}
                </td>
                <td style={{ padding: '4px 0', fontSize: '12px' }}>
                  {right ? right[1] : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <hr style={{ border: 'none', borderTop: '2px solid #e74c3c', marginBottom: '20px' }} />

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th style={{ ...BH, textAlign: 'center', width: '36px' }}>Sr</th>
            <th style={{ ...BH, textAlign: 'left' }}>Item</th>
            <th style={{ ...BH, textAlign: 'left' }}>Item Name</th>
            <th style={{ ...BH, textAlign: 'left' }}>Item Group</th>
            <th style={{ ...BH, textAlign: 'right', width: '70px' }}>Qty</th>
            <th style={{ ...BH, textAlign: 'right', width: '80px' }}>Picked Qty (in Stock UOM)</th>
            <th style={{ ...BH, textAlign: 'center', width: '50px' }}>UOM</th>
            <th style={{ ...BH, textAlign: 'right', width: '70px' }}>Stock Reserved Qty (in Stock UOM)</th>
            <th style={{ ...BH, textAlign: 'center', width: '70px' }}>UOM Conversion Factor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ ...B, textAlign: 'center' }}>{idx + 1}</td>
              <td style={B}>{item.item_code || '—'}</td>
              <td style={B}>{item.description || '—'}</td>
              <td style={B}>{item.item_group || '—'}</td>
              <td style={{ ...B, textAlign: 'right' }}>{(item.required_qty || 0).toLocaleString('en-IN')}</td>
              <td style={{ ...B, textAlign: 'right' }}>{(item.picked_qty || item.required_qty || 0).toLocaleString('en-IN')}</td>
              <td style={{ ...B, textAlign: 'center' }}>Pcs</td>
              <td style={{ ...B, textAlign: 'right' }}>0</td>
              <td style={{ ...B, textAlign: 'center' }}>1</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} style={{ ...B, textAlign: 'center', color: '#999' }}>No items</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', color: '#999' }}>
        Computer generated — K95 Foods Private Limited
      </div>
    </div>
  );
}