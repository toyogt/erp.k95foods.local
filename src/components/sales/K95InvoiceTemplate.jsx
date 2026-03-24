/**
 * K95 Tax Invoice Template
 * Matches the official K95 Foods Pvt Ltd invoice format exactly.
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

  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);
  let result = 'INR ' + numToWords(whole);
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise';
  result += ' only.';
  return result;
}

export default function K95InvoiceTemplate({ invoice, items, dispatch, order }) {
  if (!invoice) return null;

  const taxableAmount = items.reduce((s, i) => s + (i.taxable_value || (i.unit_base_cost || 0) * (i.quantity || 0)), 0);
  const igstAmount = items.reduce((s, i) => s + (i.igst_amount || 0), 0);
  const roundOff = Math.round(invoice.total_amount || 0) - (taxableAmount + igstAmount);
  const grandTotal = taxableAmount + igstAmount + roundOff;
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  const packingUnit = 12; // default, from rate list
  const igstRate = items[0]?.igst_rate || 40;

  return (
    <div className="bg-white text-black text-xs font-sans" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', border: '1px solid #000' }}>
      {/* Title */}
      <div className="text-center py-1 border-b border-black" style={{ fontSize: '14px', fontWeight: 'bold' }}>
        Tax Invoice
      </div>

      {/* Top section: IRN + Company + Invoice details */}
      <div className="flex border-b border-black" style={{ minHeight: '120px' }}>
        {/* Left: IRN + Company */}
        <div className="flex-1 p-3 border-r border-black">
          <div style={{ fontSize: '10px', marginBottom: '6px' }}>
            <div><strong>IRN:</strong></div>
            <div style={{ wordBreak: 'break-all', fontSize: '9px', color: '#333' }}>
              {invoice.irn || '—'}
            </div>
            {invoice.ack_number && <div className="mt-1"><strong>Ack. No.:</strong> {invoice.ack_number}</div>}
            {invoice.ack_date && <div><strong>Ack. Date:</strong> {invoice.ack_date}</div>}
          </div>
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px' }}>K95 Foods Private Limited</div>
            <div>Plot No. V8, M.I.E , Part - B, Bahadurgarh</div>
            <div>Jhajjar, Haryana</div>
            <div>Fssai Number: 10020011008320</div>
            <div>MSME No. DL05D0005564</div>
            <div><strong>GSTIN/UIN:</strong> 06AAHCK7191E1ZF</div>
            <div>State Name : Haryana, Code : 06</div>
          </div>
        </div>

        {/* Right: Invoice meta grid */}
        <div style={{ width: '260px', fontSize: '10px' }}>
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black" style={{ width: '50%' }}>
              <div className="text-gray-500">Invoice No.</div>
              <div style={{ fontWeight: 'bold' }}>{invoice.invoice_number}</div>
            </div>
            <div className="p-2" style={{ width: '50%' }}>
              <div className="text-gray-500">Dated</div>
              <div style={{ fontWeight: 'bold' }}>{invoice.invoice_date}</div>
            </div>
          </div>
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black" style={{ width: '50%' }}>
              <div className="text-gray-500">Delivery Note</div>
              <div>-</div>
            </div>
            <div className="p-2" style={{ width: '50%' }}>
              <div className="text-gray-500">Mode/Terms of Payment</div>
              <div>{invoice.payment_terms || order?.payment_terms || '30 Days'}</div>
            </div>
          </div>
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black" style={{ width: '50%' }}>
              <div className="text-gray-500">Reference No. & Date</div>
              <div>-</div>
            </div>
            <div className="p-2" style={{ width: '50%' }}>
              <div className="text-gray-500">Other References</div>
              <div>{order?.po_expiry_date ? `Expiry Date: ${order.po_expiry_date}` : '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Consignee / Buyer + Dispatch info */}
      <div className="flex border-b border-black" style={{ fontSize: '10px' }}>
        {/* Left: Ship To / Bill To */}
        <div className="flex-1 p-3 border-r border-black">
          <div className="mb-2">
            <div style={{ fontWeight: 'bold' }}>Consignee (Ship To) :</div>
            <div style={{ fontWeight: 'bold' }}>{invoice.customer_name?.toUpperCase()}</div>
            <div style={{ whiteSpace: 'pre-line' }}>{invoice.shipping_address}</div>
            {invoice.customer_gstin && <div><strong>GSTIN/UIN:</strong> {invoice.customer_gstin}</div>}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>Buyer (Bill To) :</div>
            <div style={{ fontWeight: 'bold' }}>{invoice.customer_name?.toUpperCase()}</div>
            <div style={{ whiteSpace: 'pre-line' }}>{invoice.billing_address || invoice.shipping_address}</div>
            {invoice.customer_gstin && <div><strong>GSTIN/UIN:</strong> {invoice.customer_gstin}</div>}
          </div>
        </div>

        {/* Right: Dispatch info */}
        <div style={{ width: '260px', fontSize: '10px' }}>
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black" style={{ width: '50%' }}>
              <div className="text-gray-500">Dispatch Doc No.</div>
              <div>-</div>
            </div>
            <div className="p-2" style={{ width: '50%' }}>
              <div className="text-gray-500">Delivery Note Date</div>
              <div>-</div>
            </div>
          </div>
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black" style={{ width: '50%' }}>
              <div className="text-gray-500">Buyer's Order No.</div>
              <div style={{ fontWeight: 'bold' }}>{order?.po_number || '-'}</div>
            </div>
            <div className="p-2" style={{ width: '50%' }}>
              <div className="text-gray-500">Dated</div>
              <div>{order?.po_date || '-'}</div>
            </div>
          </div>
          <div className="flex border-b border-black">
            <div className="p-2 border-r border-black" style={{ width: '50%' }}>
              <div className="text-gray-500">Dispatched through</div>
              <div style={{ fontWeight: 'bold' }}>{dispatch?.transporter_name || '-'}</div>
            </div>
            <div className="p-2" style={{ width: '50%' }}>
              <div className="text-gray-500">Destination</div>
              <div>{invoice.shipping_address?.split(',').slice(-2).join(',').trim() || '-'}</div>
            </div>
          </div>
          <div className="p-2">
            <div className="text-gray-500">Terms of Delivery</div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid black' }}>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center', width: '30px' }}>S.N</th>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>Description of Goods</th>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center', width: '70px' }}>HSN/SAC</th>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center', width: '80px' }}>Quantity</th>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center', width: '50px' }}>Rate</th>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center', width: '30px' }}>per</th>
            <th style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center', width: '70px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const rate = item.unit_base_cost || item.rate_snapshot || 0;
            const qty = item.quantity || 0;
            const amount = item.taxable_value || (rate * qty);
            const boxes = item.packing_unit ? Math.floor(qty / item.packing_unit) : null;
            return (
              <tr key={item.id || idx}>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{item.description}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>{item.hsn_code || '22029990'}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>
                  {qty} Pcs{boxes ? `\n(${boxes} Box)` : ''}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right' }}>{rate.toFixed(2)}</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'center' }}>Pcs</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right' }}>{amount.toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Totals rows */}
          <tr>
            <td colSpan={5} style={{ border: '1px solid #ccc', padding: '3px 4px' }} />
            <td colSpan={1} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right', fontSize: '9px', color: '#555' }} />
            <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold' }}>IGST</td>
            <td style={{ border: '1px solid #ccc' }} />
            <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
          </tr>
          {roundOff !== 0 && (
            <tr>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold' }}>Round Off</td>
              <td style={{ border: '1px solid #ccc' }} />
              <td style={{ border: '1px solid #ccc', padding: '3px 4px', textAlign: 'right' }}>{roundOff.toFixed(2)}</td>
            </tr>
          )}
          <tr style={{ fontWeight: 'bold' }}>
            <td colSpan={3} style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'right' }}>Total</td>
            <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'center' }}>{totalQty} Pcs</td>
            <td colSpan={2} style={{ border: '1px solid black' }} />
            <td style={{ border: '1px solid black', padding: '3px 4px', textAlign: 'right' }}>₹ {grandTotal.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words */}
      <div style={{ borderBottom: '1px solid black', padding: '4px 6px', fontSize: '10px' }}>
        <strong>Amount Chargeable (in words)</strong>
        <span style={{ float: 'right', fontStyle: 'italic' }}>E. & O.E</span>
        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{toWords(grandTotal)}</div>
      </div>

      {/* HSN Tax Summary */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', borderBottom: '1px solid black' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>HSN/SAC</th>
            <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>Taxable Value</th>
            <th colSpan={2} style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>IGST</th>
            <th style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>Total Tax Amount</th>
          </tr>
          <tr>
            <th style={{ border: '1px solid black', padding: '2px 6px' }} />
            <th style={{ border: '1px solid black', padding: '2px 6px' }} />
            <th style={{ border: '1px solid black', padding: '2px 6px', textAlign: 'center' }}>Rate</th>
            <th style={{ border: '1px solid black', padding: '2px 6px', textAlign: 'center' }}>Amount</th>
            <th style={{ border: '1px solid black', padding: '2px 6px' }} />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>22029990</td>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'center' }}>{igstRate}%</td>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
          </tr>
          <tr style={{ fontWeight: 'bold' }}>
            <td style={{ border: '1px solid black', padding: '3px 6px' }}>Total</td>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{taxableAmount.toFixed(2)}</td>
            <td style={{ border: '1px solid black', padding: '3px 6px' }} />
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
            <td style={{ border: '1px solid black', padding: '3px 6px', textAlign: 'right' }}>{igstAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Tax in words */}
      <div style={{ borderBottom: '1px solid black', padding: '4px 6px', fontSize: '10px' }}>
        <strong>Tax Amount (in words) :</strong> {toWords(igstAmount)}
      </div>
      {order?.po_number && (
        <div style={{ borderBottom: '1px solid black', padding: '4px 6px', fontSize: '10px' }}>
          <strong>Remarks :</strong> Against Customer Order {order.po_number}{order.po_date ? ` dated ${order.po_date}` : ''}
        </div>
      )}

      {/* Bank + Declaration */}
      <div style={{ display: 'flex', borderBottom: '1px solid black', fontSize: '10px' }}>
        <div style={{ flex: 1, padding: '6px', borderRight: '1px solid black' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Company's Bank Details</div>
          <div>A/c Holder's Name: K95 Foods Private Limited</div>
          <div>Bank Name: HDFC Bank</div>
          <div>A/c No.: 50200042408942</div>
          <div>Branch &amp; IFS Code: Gujranwala Town &amp; HDFC0000247</div>
          <div style={{ marginTop: '6px', fontStyle: 'italic' }}>
            <strong>Declaration</strong><br />
            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          </div>
        </div>
        <div style={{ width: '220px', padding: '6px', textAlign: 'right' }}>
          <div>for K95 Foods Private Limited</div>
          <div style={{ marginTop: '30px', fontWeight: 'bold' }}>Authorised Signatory</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '4px', textAlign: 'center', fontSize: '9px', color: '#666' }}>
        This is a Computer Generated Invoice
      </div>
    </div>
  );
}