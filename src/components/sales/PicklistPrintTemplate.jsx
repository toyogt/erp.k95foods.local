/**
 * Picklist Print Template
 * Based on ERPNext "Pick List" print format — adapted for K95 Foods.
 * Shows company header, order info, and the pick locations table.
 */

const LOGO_URL = 'https://media.base44.com/files/public/69c237f5cfd7eab4cd2d386a/toyo_logo.png';
const CELL = { border: '1px solid #000', padding: '4px 8px', fontSize: '11px' };

export default function PicklistPrintTemplate({ picklist, soNumber, customerName }) {
  if (!picklist) return null;

  const items = picklist.items || [];
  const totalRequired = items.reduce((s, i) => s + (i.required_qty || 0), 0);
  const totalPicked = items.reduce((s, i) => s + (i.picked_qty || 0), 0);

  const metaRows = [
    ['Picklist No.', picklist.picklist_number],
    ['Sales Order', soNumber || picklist.so_number],
    ['Customer', customerName],
    ['Transporter', picklist.transporter || '-'],
    ['Dispatch Date', picklist.dispatch_date || '-'],
    ['Appointment Date', picklist.appointment_date || '-'],
    ['Packaging Type', picklist.packaging_type || '-'],
    ['Status', (picklist.status || '').replace(/_/g, ' ').toUpperCase()],
  ];

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '16px', background: '#fff', color: '#000', fontSize: '11px' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #ccc', flexShrink: 0 }}>
          <img src={LOGO_URL} alt="K95" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px' }}>K95 Foods Private Limited</div>
          <div>Plot No. V8, M.I.E, Part-B, Bahadurgarh, Jhajjar, Haryana</div>
          <div>GSTIN: 06AAHCK7191E1ZF</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px' }}>PICK LIST</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{picklist.picklist_number}</div>
        </div>
      </div>

      {/* ── META INFO GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', border: '1px solid #000', marginBottom: '10px' }}>
        {metaRows.map(([label, value], i) => (
          <div key={label} style={{ display: 'flex', borderBottom: i < metaRows.length - 2 ? '1px solid #ccc' : 'none', borderRight: i % 2 === 0 ? '1px solid #ccc' : 'none' }}>
            <div style={{ width: '140px', padding: '4px 8px', color: '#555', fontWeight: 'bold', fontSize: '10px', backgroundColor: '#f5f5f5', flexShrink: 0 }}>{label}</div>
            <div style={{ padding: '4px 8px', flex: 1 }}>{value || '-'}</div>
          </div>
        ))}
      </div>

      {/* ── ITEM LOCATIONS TABLE ── */}
      <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>Item Locations</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#222', color: '#fff' }}>
            <th style={{ ...CELL, color: '#fff', textAlign: 'center', width: '36px' }}>S.N</th>
            <th style={{ ...CELL, color: '#fff', textAlign: 'left' }}>Item Description</th>
            <th style={{ ...CELL, color: '#fff', textAlign: 'left' }}>Rack / Bin Location</th>
            <th style={{ ...CELL, color: '#fff', textAlign: 'right', width: '90px' }}>Required Qty</th>
            <th style={{ ...CELL, color: '#fff', textAlign: 'right', width: '90px' }}>Picked Qty</th>
            <th style={{ ...CELL, color: '#fff', textAlign: 'center', width: '90px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ ...CELL, textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ ...CELL }}>
                <div style={{ fontWeight: 'bold' }}>{item.description}</div>
                {item.item_code && <div style={{ fontSize: '9px', color: '#666' }}>{item.item_code}</div>}
              </td>
              <td style={{ ...CELL, color: item.location ? '#000' : '#aaa' }}>{item.location || '—'}</td>
              <td style={{ ...CELL, textAlign: 'right', fontWeight: 'bold' }}>{item.required_qty ?? '—'}</td>
              <td style={{ ...CELL, textAlign: 'right' }}>
                {item.picked_qty != null ? item.picked_qty : <span style={{ color: '#aaa' }}>—</span>}
              </td>
              <td style={{ ...CELL, textAlign: 'center' }}>
                <span style={{
                  padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold',
                  backgroundColor: item.status === 'picked' ? '#d1fae5' : item.status === 'short' ? '#fef3c7' : '#f1f5f9',
                  color: item.status === 'picked' ? '#065f46' : item.status === 'short' ? '#92400e' : '#475569',
                }}>
                  {(item.status || 'pending').toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0', borderTop: '2px solid #000' }}>
            <td colSpan={3} style={{ ...CELL, textAlign: 'right' }}>TOTAL</td>
            <td style={{ ...CELL, textAlign: 'right' }}>{totalRequired}</td>
            <td style={{ ...CELL, textAlign: 'right' }}>{totalPicked || '—'}</td>
            <td style={CELL} />
          </tr>
        </tbody>
      </table>

      {/* ── FOOTER / SIGNATURES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '12px' }}>
        {['Prepared By', 'Checked By', 'Authorised Signatory'].map(label => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #000', height: '40px', marginBottom: '4px' }} />
            <div style={{ fontSize: '10px', color: '#555' }}>{label}</div>
          </div>
        ))}
      </div>

      {picklist.notes && (
        <div style={{ marginTop: '12px', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '10px' }}>
          <strong>Notes:</strong> {picklist.notes}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '9px', color: '#999' }}>
        Computer generated — K95 Foods Private Limited
      </div>
    </div>
  );
}