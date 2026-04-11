/**
 * Picklist Print Template — ERPNext-style professional A4 layout.
 * Matches reference PDF: two-column header meta, items table, totals, signature block.
 */
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

  const S = {
    page: { fontFamily: "'Arial', 'Helvetica', sans-serif", maxWidth: '900px', margin: '0 auto', padding: '24px 32px', background: '#fff', color: '#000', fontSize: '12px', lineHeight: '1.5' },
    title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', color: '#111' },
    plNum: { fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '12px' },
    hr: { border: 'none', borderTop: '2px solid #333', margin: '12px 0 16px 0' },
    metaTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px' },
    metaLabel: { padding: '4px 0', fontWeight: 'bold', textAlign: 'right', paddingRight: '12px', fontSize: '12px', color: '#333', whiteSpace: 'nowrap' },
    metaValue: { padding: '4px 0', fontSize: '12px', color: '#000' },
    th: { border: '1px solid #bbb', padding: '8px 10px', fontSize: '11px', fontWeight: 'bold', background: '#f5f5f5', textAlign: 'left' },
    td: { border: '1px solid #ccc', padding: '6px 10px', fontSize: '11px' },
    tdR: { border: '1px solid #ccc', padding: '6px 10px', fontSize: '11px', textAlign: 'right' },
    tdC: { border: '1px solid #ccc', padding: '6px 10px', fontSize: '11px', textAlign: 'center' },
    totalRow: { border: '1px solid #bbb', padding: '8px 10px', fontSize: '12px', fontWeight: 'bold', background: '#f9f9f9' },
    sigBlock: { display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #ccc' },
    sigItem: { textAlign: 'center', width: '200px' },
    sigLine: { borderBottom: '1px solid #333', height: '40px', marginBottom: '6px' },
    sigLabel: { fontSize: '11px', color: '#555' },
    footer: { textAlign: 'center', marginTop: '24px', fontSize: '10px', color: '#999' },
  };

  const leftMeta = [
    ['Company:', picklist.company || 'K95 Foods Private Limited'],
    ['Purpose:', picklist.purpose || 'Delivery'],
    ['Customer Name:', customerName || picklist.customer_name || '—'],
    ['SO No.:', soNumber || picklist.so_number || '—'],
  ];

  const rightMeta = [
    ['Warehouse:', picklist.warehouse || 'Finished Goods - KFPL'],
    ['Transporter:', picklist.transporter || '—'],
    ['Packaging Type:', picklist.packaging_type || '—'],
    ['PO No.:', picklist.po_number || picklist.so_number || '—'],
    ['Dispatch Date:', fmt(picklist.dispatch_date)],
  ];

  const maxRows = Math.max(leftMeta.length, rightMeta.length);

  return (
    <div style={S.page}>
      <div style={S.title}>Pick List</div>
      <div style={S.plNum}>{picklist.picklist_number}</div>
      <hr style={S.hr} />

      {/* Two-column meta header */}
      <table style={S.metaTable}>
        <tbody>
          {Array.from({ length: maxRows }).map((_, i) => {
            const left = leftMeta[i];
            const right = rightMeta[i];
            return (
              <tr key={i}>
                <td style={{ ...S.metaLabel, width: '130px' }}>{left ? left[0] : ''}</td>
                <td style={{ ...S.metaValue, width: '220px' }}>{left ? left[1] : ''}</td>
                <td style={{ ...S.metaLabel, width: '140px' }}>{right ? right[0] : ''}</td>
                <td style={S.metaValue}>{right ? right[1] : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th style={{ ...S.th, textAlign: 'center', width: '36px' }}>Sr</th>
            <th style={S.th}>Item</th>
            <th style={S.th}>Item Name</th>
            <th style={S.th}>Item Group</th>
            <th style={{ ...S.th, textAlign: 'right', width: '70px' }}>Qty</th>
            <th style={{ ...S.th, textAlign: 'right', width: '90px' }}>Picked Qty (in Stock UOM)</th>
            <th style={{ ...S.th, textAlign: 'center', width: '50px' }}>UOM</th>
            <th style={{ ...S.th, textAlign: 'right', width: '90px' }}>Stock Reserved Qty (in Stock UOM)</th>
            <th style={{ ...S.th, textAlign: 'center', width: '80px' }}>UOM Conversion Factor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={S.tdC}>{idx + 1}</td>
              <td style={S.td}>{item.item_code || '—'}</td>
              <td style={S.td}>{item.item_name || item.description || '—'}</td>
              <td style={S.td}>{item.item_group || 'Kombucha'}</td>
              <td style={S.tdR}>{item.required_qty || 0}</td>
              <td style={S.tdR}>{item.picked_qty ?? item.required_qty ?? 0}</td>
              <td style={S.tdC}>{item.uom || 'Pcs'}</td>
              <td style={S.tdR}>0</td>
              <td style={S.tdC}>1</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#999' }}>No items</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ ...S.totalRow, textAlign: 'right' }}>Total</td>
            <td style={{ ...S.totalRow, textAlign: 'right' }}>{totalQty}</td>
            <td style={{ ...S.totalRow, textAlign: 'right' }}>{totalPicked}</td>
            <td colSpan={3} style={S.totalRow}></td>
          </tr>
        </tfoot>
      </table>

      {/* Signature Block */}
      <div style={S.sigBlock}>
        <div style={S.sigItem}>
          <div style={S.sigLine}></div>
          <div style={S.sigLabel}>Prepared By</div>
        </div>
        <div style={S.sigItem}>
          <div style={S.sigLine}></div>
          <div style={S.sigLabel}>Checked By</div>
        </div>
        <div style={S.sigItem}>
          <div style={S.sigLine}></div>
          <div style={S.sigLabel}>Authorized Signature</div>
        </div>
      </div>

      <div style={S.footer}>
        Computer generated — K95 Foods Private Limited
      </div>
    </div>
  );
}