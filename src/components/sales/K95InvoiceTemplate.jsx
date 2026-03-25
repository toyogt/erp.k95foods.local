/**
 * K95 Tax Invoice Template
 * Matches the official K95 Foods Private Limited invoice format exactly.
 * Supports both IGST (inter-state) and CGST+SGST (intra-state) tax display.
 */

function toWords(amount) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n) {
    if (n === 0) return '';
    if (n < 20) return units[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
  }

  const whole = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - whole) * 100);
  let result = 'INR ' + (whole > 0 ? numToWords(whole) : 'Zero');
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  result += ' only.';
  return result;
}

const CELL = { border: '1px solid #000', padding: '4px 6px' };
const CELL_LIGHT = { border: '1px solid #ccc', padding: '3px 6px' };
const LOGO_URL = 'https://media.base44.com/files/public/69c237f5cfd7eab4cd2d386a/toyo_logo.png';

function getStateFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return null;
  const stateCode = gstin.substring(0, 2);
  const STATE_MAP = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
    '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
    '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
    '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
    '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh',
  };
  return { code: stateCode, name: STATE_MAP[stateCode] || 'Unknown' };
}

export default function K95InvoiceTemplate({ invoice, items, dispatch, order, deliveryNote }) {
  if (!invoice) return null;

  const isInterState = (() => {
    const custGstin = invoice.customer_gstin || order?.customer_gstin;
    if (!custGstin) return true;
    return custGstin.substring(0, 2) !== '06'; // K95 is Haryana = 06
  })();

  const taxableAmount = items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost || 0) * (i.quantity || 0)), 0);
  const igstAmount = isInterState ? items.reduce((s, i) => s + (i.igst_amount || 0), 0) : 0;
  const cgstAmount = !isInterState ? items.reduce((s, i) => s + (i.cgst_amount || 0), 0) : 0;
  const sgstAmount = !isInterState ? items.reduce((s, i) => s + (i.sgst_amount || 0), 0) : 0;
  const totalTax = igstAmount + cgstAmount + sgstAmount;
  const roundOff = Math.round(invoice.total_amount || (taxableAmount + totalTax)) - (taxableAmount + totalTax);
  const grandTotal = taxableAmount + totalTax + roundOff;
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const igstRate = items[0]?.igst_rate || 40;

  const custState = getStateFromGSTIN(invoice.customer_gstin || order?.customer_gstin);
  const custStateDisplay = custState ? `${custState.code}-${custState.name}` : '';

  return (
    <div className="bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', border: '2px solid #000', fontSize: '10px', lineHeight: 1.35 }}>

      {/* ═══ TITLE BAR ═══ */}
      <div style={{ textAlign: 'center', padding: '6px 0', borderBottom: '2px solid #000', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>
        Tax Invoice
      </div>

      {/* ═══ TOP SECTION: IRN + QR | Company Info | Invoice Meta ═══ */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>

        {/* LEFT: IRN + Company Info */}
        <div style={{ flex: 1, borderRight: '1px solid #000' }}>
          {/* IRN Section */}
          {invoice.irn && (
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '9px' }}>IRN:</div>
                  <div style={{ wordBreak: 'break-all', fontSize: '8px', color: '#333', maxWidth: '350px' }}>{invoice.irn}</div>
                  {invoice.ack_number && <div style={{ marginTop: '2px', fontSize: '9px' }}><strong>Ack. No.:</strong> {invoice.ack_number}</div>}
                  {invoice.ack_date && <div style={{ fontSize: '9px' }}><strong>Ack. Date:</strong> {invoice.ack_date}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '8px', color: '#666' }}>
                  <div style={{ border: '1px solid #ccc', padding: '2px 4px', borderRadius: '2px' }}>e-Invoice</div>
                </div>
              </div>
            </div>
          )}

          {/* Company Header */}
          <div style={{ padding: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid #ccc' }}>
              <img src={LOGO_URL} alt="K95" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '13px' }}>K95 Foods Private Limited</div>
              <div>Plot No. V8, M.I.E , Part - B, Bahadurgarh</div>
              <div>Jhajjar, Haryana</div>
              <div>Fssai Number: 10020011008320</div>
              <div>MSME No. DL05D0005564</div>
              <div><strong>GSTIN/UIN:</strong> 06AAHCK7191E1ZF</div>
              <div>State Name : Haryana, Code : 06</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Invoice Meta Grid */}
        <div style={{ width: '270px' }}>
          {[
            [['Invoice No.', invoice.invoice_number, true], ['Dated', invoice.invoice_date, true]],
            [['Delivery Note', deliveryNote?.dn_number || '-'], ['Mode/Terms of Payment', invoice.payment_terms || order?.payment_terms || '30 Days']],
            [['Reference No. & Date', '-'], ['Other References', order?.po_expiry_date ? `Expiry Date: ${order.po_expiry_date}` : '-']],
          ].map((row, ri) => (
            <div key={ri} style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              {row.map(([label, value, bold], ci) => (
                <div key={ci} style={{ width: '50%', padding: '4px 6px', borderRight: ci === 0 ? '1px solid #000' : 'none' }}>
                  <div style={{ color: '#666', fontSize: '8px' }}>{label}</div>
                  <div style={{ fontWeight: bold ? 'bold' : 'normal', fontSize: '9px' }}>{value || '-'}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CONSIGNEE / BUYER + DISPATCH META ═══ */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
        {/* Left: Ship To / Bill To */}
        <div style={{ flex: 1, borderRight: '1px solid #000', padding: '6px 8px' }}>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontWeight: 'bold' }}>Consignee (Ship To) :</div>
            <div style={{ fontWeight: 'bold' }}>{(invoice.customer_name || order?.customer_name)?.toUpperCase()}</div>
            <div style={{ whiteSpace: 'pre-line' }}>{invoice.shipping_address || order?.shipping_address}</div>
            {(invoice.customer_gstin || order?.customer_gstin) && (
              <div><strong>GSTIN/UIN:</strong> {invoice.customer_gstin || order?.customer_gstin}</div>
            )}
            {custState && <div>State Name: {custState.name}, State Code: {custState.code}</div>}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>Buyer (Bill To) :</div>
            <div style={{ fontWeight: 'bold' }}>{(invoice.customer_name || order?.customer_name)?.toUpperCase()}</div>
            <div style={{ whiteSpace: 'pre-line' }}>{invoice.billing_address || invoice.shipping_address || order?.billing_address}</div>
            {(invoice.customer_gstin || order?.customer_gstin) && (
              <div><strong>GSTIN/UIN:</strong> {invoice.customer_gstin || order?.customer_gstin}</div>
            )}
            {custState && <div>State Name: {custState.name}, State Code: {custState.code}</div>}
            {custStateDisplay && <div>Place of Supply: {custStateDisplay}</div>}
          </div>
        </div>

        {/* Right: Dispatch info */}
        <div style={{ width: '270px' }}>
          {[
            [['Dispatch Doc No.', deliveryNote?.dn_number || '-'], ['Delivery Note Date', deliveryNote?.dispatch_date || '-']],
            [["Buyer's Order No.", order?.po_number || '-', true], ['Dated', order?.po_date || '-']],
            [['Dispatched through', dispatch?.transporter_name || deliveryNote?.transporter_name || '-', true], ['Destination', custStateDisplay || '-']],
          ].map((row, ri) => (
            <div key={ri} style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              {row.map(([label, value, bold], ci) => (
                <div key={ci} style={{ width: '50%', padding: '4px 6px', borderRight: ci === 0 ? '1px solid #000' : 'none' }}>
                  <div style={{ color: '#666', fontSize: '8px' }}>{label}</div>
                  <div style={{ fontWeight: bold ? 'bold' : 'normal', fontSize: '9px' }}>{value || '-'}</div>
                </div>
              ))}
            </div>
          ))}
          <div style={{ padding: '4px 6px' }}>
            <div style={{ color: '#666', fontSize: '8px' }}>Terms of Delivery</div>
          </div>
        </div>
      </div>

      {/* ═══ LINE ITEMS TABLE ═══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #000' }}>
            <th style={{ ...CELL, textAlign: 'center', width: '30px' }}>S.N</th>
            <th style={{ ...CELL, textAlign: 'center' }}>Description of Goods</th>
            <th style={{ ...CELL, textAlign: 'center', width: '70px' }}>HSN/SAC</th>
            <th style={{ ...CELL, textAlign: 'center', width: '80px' }}>Quantity</th>
            <th style={{ ...CELL, textAlign: 'center', width: '50px' }}>Rate</th>
            <th style={{ ...CELL, textAlign: 'center', width: '30px' }}>per</th>
            <th style={{ ...CELL, textAlign: 'center', width: '75px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rate = item.unit_base_cost || item.rate_snapshot || 0;
            const qty = item.quantity || 0;
            const amount = item.taxable_value || (rate * qty);
            const pu = item.packing_unit || 12;
            const boxes = pu > 1 ? Math.floor(qty / pu) : null;
            const isBoxUnit = item.description?.includes('Pack of');
            return (
              <tr key={item.id || idx}>
                <td style={{ ...CELL_LIGHT, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'center' }}>{item.description}</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'center' }}>{item.hsn_code || '22029990'}</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'center' }}>
                  {isBoxUnit ? `${qty} Box` : (
                    <>{qty} Pcs{boxes ? <><br /><span style={{ fontSize: '8px' }}>({boxes} Box)</span></> : ''}</>
                  )}
                </td>
                <td style={{ ...CELL_LIGHT, textAlign: 'right' }}>{rate.toFixed(2)}</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'center' }}>{isBoxUnit ? 'Box' : 'Pcs'}</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'right' }}>{amount.toFixed(2)}</td>
              </tr>
            );
          })}

          {/* Subtotal row */}
          <tr>
            <td colSpan={6} style={{ ...CELL_LIGHT, textAlign: 'right' }} />
            <td style={{ ...CELL_LIGHT, textAlign: 'right', fontWeight: 'bold' }}>{taxableAmount.toFixed(2)}</td>
          </tr>

          {/* Tax rows */}
          {isInterState ? (
            <tr>
              <td colSpan={6} style={{ ...CELL_LIGHT, textAlign: 'right', fontWeight: 'bold' }}>IGST</td>
              <td style={{ ...CELL_LIGHT, textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
            </tr>
          ) : (
            <>
              <tr>
                <td colSpan={6} style={{ ...CELL_LIGHT, textAlign: 'right', fontWeight: 'bold' }}>CGST</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={6} style={{ ...CELL_LIGHT, textAlign: 'right', fontWeight: 'bold' }}>SGST</td>
                <td style={{ ...CELL_LIGHT, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </tr>
            </>
          )}

          {/* Round Off */}
          {roundOff !== 0 && (
            <tr>
              <td colSpan={6} style={{ ...CELL_LIGHT, textAlign: 'right', fontWeight: 'bold' }}>Round Off</td>
              <td style={{ ...CELL_LIGHT, textAlign: 'right' }}>{roundOff.toFixed(2)}</td>
            </tr>
          )}

          {/* Grand Total row */}
          <tr style={{ fontWeight: 'bold', borderTop: '2px solid #000' }}>
            <td colSpan={3} style={{ ...CELL, textAlign: 'right' }}>Total</td>
            <td style={{ ...CELL, textAlign: 'center' }}>{totalQty} Pcs</td>
            <td colSpan={2} style={CELL} />
            <td style={{ ...CELL, textAlign: 'right' }}>₹ {grandTotal.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      {/* ═══ AMOUNT IN WORDS ═══ */}
      <div style={{ borderBottom: '1px solid #000', padding: '4px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Amount Chargeable (in words)</strong>
          <span style={{ fontStyle: 'italic' }}>E. & O.E</span>
        </div>
        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{toWords(grandTotal)}</div>
      </div>

      {/* ═══ HSN TAX SUMMARY ═══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={CELL}>HSN/SAC</th>
            <th style={CELL}>Taxable Value</th>
            {isInterState ? (
              <>
                <th colSpan={2} style={CELL}>IGST</th>
              </>
            ) : (
              <>
                <th colSpan={2} style={CELL}>CGST</th>
                <th colSpan={2} style={CELL}>SGST</th>
              </>
            )}
            <th style={CELL}>Total Tax Amount</th>
          </tr>
          <tr>
            <th style={CELL} />
            <th style={CELL} />
            <th style={{ ...CELL, textAlign: 'center' }}>Rate</th>
            <th style={{ ...CELL, textAlign: 'center' }}>Amount</th>
            {!isInterState && (
              <>
                <th style={{ ...CELL, textAlign: 'center' }}>Rate</th>
                <th style={{ ...CELL, textAlign: 'center' }}>Amount</th>
              </>
            )}
            <th style={CELL} />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...CELL, textAlign: 'center' }}>22029990</td>
            <td style={{ ...CELL, textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
            {isInterState ? (
              <>
                <td style={{ ...CELL, textAlign: 'center' }}>{igstRate}%</td>
                <td style={{ ...CELL, textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
              </>
            ) : (
              <>
                <td style={{ ...CELL, textAlign: 'center' }}>{(igstRate / 2)}%</td>
                <td style={{ ...CELL, textAlign: 'right' }}>{cgstAmount.toFixed(2)}</td>
                <td style={{ ...CELL, textAlign: 'center' }}>{(igstRate / 2)}%</td>
                <td style={{ ...CELL, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </>
            )}
            <td style={{ ...CELL, textAlign: 'right' }}>{totalTax.toFixed(2)}</td>
          </tr>
          <tr style={{ fontWeight: 'bold' }}>
            <td style={CELL}>Total</td>
            <td style={{ ...CELL, textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
            <td style={CELL} />
            <td style={{ ...CELL, textAlign: 'right' }}>{isInterState ? igstAmount.toFixed(2) : cgstAmount.toFixed(2)}</td>
            {!isInterState && (
              <>
                <td style={CELL} />
                <td style={{ ...CELL, textAlign: 'right' }}>{sgstAmount.toFixed(2)}</td>
              </>
            )}
            <td style={{ ...CELL, textAlign: 'right' }}>{totalTax.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Tax Amount in Words */}
      <div style={{ borderBottom: '1px solid #000', padding: '4px 8px' }}>
        <strong>Tax Amount (in words) :</strong> {toWords(totalTax)}
      </div>

      {/* Remarks */}
      {order?.po_number && (
        <div style={{ borderBottom: '1px solid #000', padding: '4px 8px' }}>
          <strong>Remarks :</strong> Against Customer Order {order.po_number}{order.po_date ? ` dated ${order.po_date}` : ''}
        </div>
      )}

      {/* ═══ BANK DETAILS + DECLARATION + SIGNATURE ═══ */}
      <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
        <div style={{ flex: 1, padding: '8px', borderRight: '1px solid #000' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Company's Bank Details</div>
          <div>A/c Holder's Name: K95 Foods Private Limited</div>
          <div>Bank Name: HDFC Bank</div>
          <div>A/c No.: 50200042408942</div>
          <div>Branch &amp; IFS Code: Gujranwala Town &amp; HDFC0000247</div>
          <div style={{ marginTop: '8px' }}>
            <strong style={{ fontStyle: 'italic' }}>Declaration</strong><br />
            <em>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</em>
          </div>
        </div>
        <div style={{ width: '240px', padding: '8px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>for K95 Foods Private Limited</div>
          <div style={{ marginTop: '40px', fontWeight: 'bold' }}>Authorised Signatory</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '4px', textAlign: 'center', fontSize: '9px', color: '#666' }}>
        This is a Computer Generated Invoice
      </div>
    </div>
  );
}