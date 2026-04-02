/**
 * K95 Tax Invoice — Tally-style format
 * Accepts: { invoice, items, order, deliveryNote, printRef }
 */
import React from 'react';

function numberToWords(num) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (!num || num === 0) return 'Zero';
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' ' + a[n%10] : '');
    if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + inWords(n%100) : '');
    if (n < 100000) return inWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + inWords(n%1000) : '');
    if (n < 10000000) return inWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + inWords(n%100000) : '');
    return inWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + inWords(n%10000000) : '');
  };
  const [whole, decimal] = num.toFixed(2).split('.');
  let result = inWords(parseInt(whole));
  if (decimal && parseInt(decimal) > 0) result += ' and ' + inWords(parseInt(decimal)) + ' Paisa';
  return 'INR ' + result + ' only.';
}

function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.substring(0, 2);
  const STATE_MAP = {
    '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
    '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
    '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
    '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
    '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
    '26':'Dadra & Nagar Haveli','27':'Maharashtra','29':'Karnataka','30':'Goa',
    '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','36':'Telangana','37':'Andhra Pradesh',
  };
  return { code, name: STATE_MAP[code] || 'Unknown' };
}

const LOGO_URL = 'https://media.base44.com/files/public/69c237f5cfd7eab4cd2d386a/toyo_logo.png';

const B = { border: '1px solid #6b7280', padding: '4px 6px', fontSize: '10px' };
const BH = { ...B, background: '#f3f4f6', fontWeight: 'bold' };

export default function ToyoInvoice({ invoice, items = [], order, deliveryNote, printRef }) {
  if (!invoice) return null;

  const custGstin = invoice.customer_gstin || order?.customer_gstin || '';
  const isInterState = !custGstin || custGstin.substring(0, 2) !== '06';
  const custState = getStateFromGSTIN(custGstin);
  const custStateDisplay = custState ? `${custState.code}-${custState.name}` : '';

  const taxableAmount = items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost || 0) * (i.quantity || 0)), 0);
  const igstAmount    = isInterState ? items.reduce((s, i) => s + (i.igst_amount || 0), 0) : 0;
  const cgstAmount    = !isInterState ? items.reduce((s, i) => s + (i.cgst_amount || 0), 0) : 0;
  const sgstAmount    = !isInterState ? items.reduce((s, i) => s + (i.sgst_amount || 0), 0) : 0;
  const totalTax      = igstAmount + cgstAmount + sgstAmount;
  const rawTotal      = taxableAmount + totalTax;
  const roundOff      = Math.round(rawTotal) - rawTotal;
  const grandTotal    = rawTotal + roundOff;
  const totalQty      = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const igstRate      = items[0]?.igst_rate || 40;
  const halfRate      = igstRate / 2;

  // Format date DD/MM/YYYY
  const fmtDate = (d) => {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  const invoiceDateStr = fmtDate(invoice.invoice_date);
  const poDatedStr     = fmtDate(order?.po_date);
  const expiryStr      = order?.po_expiry_date ? `Expiry: ${fmtDate(order.po_expiry_date)}` : '-';

  return (
    <div ref={printRef} style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', color: '#000', fontSize: '10px', lineHeight: 1.4 }}>

      {/* Title */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', padding: '6px 0', borderBottom: '2px solid #000', letterSpacing: '1px' }}>
        Tax Invoice
      </div>

      {/* IRN Block (if present) */}
      {invoice.irn && (
        <div style={{ padding: '5px 8px', borderBottom: '1px solid #6b7280', fontSize: '9px' }}>
          <strong>IRN:</strong> <span style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{invoice.irn}</span>
          {invoice.ack_number && <span style={{ marginLeft: '12px' }}><strong>Ack No.:</strong> {invoice.ack_number}</span>}
          {invoice.ack_date && <span style={{ marginLeft: '12px' }}><strong>Ack Date:</strong> {fmtDate(invoice.ack_date)}</span>}
        </div>
      )}

      {/* Header: Seller + Invoice Meta */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            {/* Left: Seller */}
            <td style={{ ...B, width: '50%', verticalAlign: 'top', padding: '8px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <img src={LOGO_URL} alt="K95" style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: '50%', border: '1px solid #ccc', flexShrink: 0 }}
                  onError={e => { e.target.style.display = 'none'; }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>K95 Foods Private Limited</div>
                  <div>Plot No. V8, M.I.E, Part - B, Bahadurgarh</div>
                  <div>Jhajjar, Haryana</div>
                  <div>Fssai Number: 10020011008320</div>
                  <div>MSME No. DL05D0005564</div>
                  <div><strong>GSTIN/UIN:</strong> 06AAHCK7191E1ZF</div>
                  <div>State Name: Haryana, Code: 06</div>
                </div>
              </div>
            </td>
            {/* Right: Invoice Meta */}
            <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ ...B, borderLeft: 'none', borderTop: 'none', width: '50%' }}><div style={{ color: '#555', fontSize: '9px' }}>Invoice No.</div><div style={{ fontWeight: 'bold' }}>{invoice.invoice_number}</div></td>
                    <td style={{ ...B, borderTop: 'none', borderRight: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Dated</div><div style={{ fontWeight: 'bold' }}>{invoiceDateStr}</div></td>
                  </tr>
                  <tr>
                    <td style={{ ...B, borderLeft: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Delivery Note</div><div>{deliveryNote?.dn_number || '-'}</div></td>
                    <td style={{ ...B, borderRight: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Mode/Terms of Payment</div><div>{order?.payment_terms || invoice.payment_terms || '30 Days'}</div></td>
                  </tr>
                  <tr>
                    <td style={{ ...B, borderLeft: 'none', borderBottom: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Reference No. &amp; Date</div><div>{order?.po_number || '-'}</div></td>
                    <td style={{ ...B, borderRight: 'none', borderBottom: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Other References</div><div>{expiryStr}</div></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Consignee + Buyer + Dispatch Meta */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
        <tbody>
          <tr>
            {/* Left: Consignee */}
            <td style={{ ...B, width: '50%', verticalAlign: 'top', padding: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Consignee (Ship To):</div>
              <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>{invoice.customer_name || order?.customer_name}</div>
              <div style={{ whiteSpace: 'pre-line' }}>{invoice.shipping_address || order?.shipping_address || ''}</div>
              {custGstin && <div><strong>GSTIN/UIN:</strong> {custGstin}</div>}
              {custState && <div>State Name: {custState.name}, State Code: {custState.code}</div>}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Buyer (Bill To):</div>
                <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>{invoice.customer_name || order?.customer_name}</div>
                <div style={{ whiteSpace: 'pre-line' }}>{invoice.billing_address || invoice.shipping_address || order?.shipping_address || ''}</div>
                {custGstin && <div><strong>GSTIN/UIN:</strong> {custGstin}</div>}
                {custState && <div>State Name: {custState.name}, State Code: {custState.code}</div>}
                {custStateDisplay && <div>Place of Supply: {custStateDisplay}</div>}
              </div>
            </td>
            {/* Right: Dispatch Meta */}
            <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', height: '100%' }}>
                <tbody>
                  <tr>
                    <td style={{ ...B, borderLeft: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Dispatch Doc No.</div><div>{deliveryNote?.dn_number || '-'}</div></td>
                    <td style={{ ...B, borderRight: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Delivery Note Date</div><div>{fmtDate(deliveryNote?.dispatch_date) || '-'}</div></td>
                  </tr>
                  <tr>
                    <td style={{ ...B, borderLeft: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Buyer's Order No.</div><div style={{ fontWeight: 'bold' }}>{order?.po_number || '-'}</div></td>
                    <td style={{ ...B, borderRight: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Dated</div><div>{poDatedStr}</div></td>
                  </tr>
                  <tr>
                    <td style={{ ...B, borderLeft: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Dispatched through</div><div style={{ fontWeight: 'bold' }}>{deliveryNote?.transporter_name || order?.transporter || '-'}</div></td>
                    <td style={{ ...B, borderRight: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Destination</div><div>{custState?.name || '-'}</div></td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...B, borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}><div style={{ color: '#555', fontSize: '9px' }}>Terms of Delivery</div><div>-</div></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Line Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...BH, width: '28px', textAlign: 'center' }}>S.N</th>
            <th style={{ ...BH, textAlign: 'center' }}>Description of Goods</th>
            <th style={{ ...BH, width: '72px', textAlign: 'center' }}>HSN/SAC</th>
            <th style={{ ...BH, width: '84px', textAlign: 'center' }}>Quantity</th>
            <th style={{ ...BH, width: '60px', textAlign: 'right' }}>Rate</th>
            <th style={{ ...BH, width: '28px', textAlign: 'center' }}>per</th>
            <th style={{ ...BH, width: '78px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rate   = item.unit_base_cost || item.rate_snapshot || 0;
            const qty    = Number(item.quantity) || 0;
            const amount = item.taxable_value || (rate * qty);
            const pu     = item.packing_unit || 0;
            const boxes  = pu > 1 ? Math.floor(qty / pu) : null;
            return (
              <tr key={item.id || idx}>
                <td style={{ ...B, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ ...B, textAlign: 'center' }}>{item.description}</td>
                <td style={{ ...B, textAlign: 'center' }}>{item.hsn_code || '22029990'}</td>
                <td style={{ ...B, textAlign: 'center' }}>
                  {qty} Pcs{boxes ? <><br /><span style={{ fontSize: '8px', color: '#555' }}>({boxes} Box)</span></> : ''}
                </td>
                <td style={{ ...B, textAlign: 'right' }}>{rate.toFixed(2)}</td>
                <td style={{ ...B, textAlign: 'center' }}>Pcs</td>
                <td style={{ ...B, textAlign: 'right', fontWeight: 'bold' }}>{amount.toFixed(2)}</td>
              </tr>
            );
          })}

          {/* Subtotal */}
          <tr>
            <td colSpan={6} style={{ ...B, textAlign: 'right' }}></td>
            <td style={{ ...B, textAlign: 'right', fontWeight: 'bold' }}>{taxableAmount.toFixed(2)}</td>
          </tr>

          {/* Tax rows */}
          {isInterState ? (
            <tr>
              <td colSpan={6} style={{ ...B, textAlign: 'right', fontWeight: 'bold' }}>IGST @ {igstRate}%</td>
              <td style={{ ...B, textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
            </tr>
          ) : (
            <>
              <tr>
                <td colSpan={6} style={{ ...B, textAlign: 'right', fontWeight: 'bold' }}>CGST @ {halfRate}%</td>
                <td style={{ ...B, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={6} style={{ ...B, textAlign: 'right', fontWeight: 'bold' }}>SGST @ {halfRate}%</td>
                <td style={{ ...B, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </tr>
            </>
          )}

          {/* Round Off */}
          <tr>
            <td colSpan={6} style={{ ...B, textAlign: 'right', fontWeight: 'bold' }}>Round Off</td>
            <td style={{ ...B, textAlign: 'right' }}>{roundOff.toFixed(2)}</td>
          </tr>

          {/* Grand Total */}
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #000' }}>
            <td colSpan={3} style={{ ...BH, textAlign: 'center' }}>Total</td>
            <td style={{ ...BH, textAlign: 'center' }}>{totalQty} Pcs</td>
            <td colSpan={2} style={BH}></td>
            <td style={{ ...BH, textAlign: 'right' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in Words */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={B}><strong>Amount Chargeable (in words)</strong></td>
            <td style={{ ...B, textAlign: 'right', fontStyle: 'italic' }}>E. &amp; O.E</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ ...B, fontWeight: 'bold' }}>{numberToWords(Math.round(grandTotal))}</td>
          </tr>
        </tbody>
      </table>

      {/* HSN Tax Summary */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={BH}>HSN/SAC</th>
            <th style={{ ...BH, textAlign: 'right' }}>Taxable Value</th>
            {isInterState ? (
              <th colSpan={2} style={{ ...BH, textAlign: 'center' }}>IGST</th>
            ) : (
              <>
                <th colSpan={2} style={{ ...BH, textAlign: 'center' }}>CGST</th>
                <th colSpan={2} style={{ ...BH, textAlign: 'center' }}>SGST</th>
              </>
            )}
            <th style={{ ...BH, textAlign: 'right' }}>Total Tax Amount</th>
          </tr>
          <tr>
            <th style={{ ...B, background: '#f9fafb' }}></th>
            <th style={{ ...B, background: '#f9fafb' }}></th>
            <th style={{ ...B, background: '#f9fafb', textAlign: 'center', fontSize: '9px' }}>Rate</th>
            <th style={{ ...B, background: '#f9fafb', textAlign: 'center', fontSize: '9px' }}>Amount</th>
            {!isInterState && (
              <>
                <th style={{ ...B, background: '#f9fafb', textAlign: 'center', fontSize: '9px' }}>Rate</th>
                <th style={{ ...B, background: '#f9fafb', textAlign: 'center', fontSize: '9px' }}>Amount</th>
              </>
            )}
            <th style={{ ...B, background: '#f9fafb' }}></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...B, textAlign: 'center' }}>{items[0]?.hsn_code || '22029990'}</td>
            <td style={{ ...B, textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
            {isInterState ? (
              <>
                <td style={{ ...B, textAlign: 'center' }}>{igstRate}%</td>
                <td style={{ ...B, textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
              </>
            ) : (
              <>
                <td style={{ ...B, textAlign: 'center' }}>{halfRate}%</td>
                <td style={{ ...B, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
                <td style={{ ...B, textAlign: 'center' }}>{halfRate}%</td>
                <td style={{ ...B, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </>
            )}
            <td style={{ ...B, textAlign: 'right' }}>{totalTax.toFixed(2)}</td>
          </tr>
          <tr style={{ fontWeight: 'bold' }}>
            <td style={B}>Total</td>
            <td style={{ ...B, textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
            <td style={B}></td>
            <td style={{ ...B, textAlign: 'right' }}>{isInterState ? igstAmount.toFixed(2) : cgstAmount.toFixed(2)}</td>
            {!isInterState && (
              <>
                <td style={B}></td>
                <td style={{ ...B, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </>
            )}
            <td style={{ ...B, textAlign: 'right' }}>{totalTax.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Tax in Words */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={B}><strong>Tax Amount (in words):</strong> {numberToWords(parseFloat(totalTax.toFixed(2)))}</td>
          </tr>
        </tbody>
      </table>

      {/* Remarks */}
      {order?.po_number && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={B}><strong>Remarks:</strong> Against Customer Order {order.po_number}{order.po_date ? ` dated ${fmtDate(order.po_date)}` : ''}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Bank Details + Declaration + Signature */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ ...B, width: '55%', verticalAlign: 'top' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Company's Bank Details</div>
              <div>A/c Holder's Name: K95 Foods Private Limited</div>
              <div>Bank Name: HDFC Bank</div>
              <div>A/c No.: 50200042408942</div>
              <div>Branch &amp; IFS Code: Gujranwala Town &amp; HDFC0000247</div>
              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                <strong style={{ fontStyle: 'italic' }}>Declaration</strong><br />
                <em>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</em>
              </div>
            </td>
            <td style={{ ...B, verticalAlign: 'top', textAlign: 'right' }}>
              <div>for K95 Foods Private Limited</div>
              <div style={{ height: '50px' }}></div>
              <div style={{ fontWeight: 'bold' }}>Authorised Signatory</div>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ ...B, textAlign: 'center', color: '#555', fontSize: '9px', fontStyle: 'italic' }}>
              This is a Computer Generated Invoice
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}