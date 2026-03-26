/**
 * Address & Contact panel — mirrors ERPNext "Address & Contact" tab.
 * Shows Billing Address, Shipping Address, Company Address.
 */
export default function SOAddressPanel({ order }) {
  const fields = [
    {
      section: 'Billing Address',
      items: [
        { label: 'Customer', value: order.customer_name },
        { label: 'GSTIN', value: order.customer_gstin },
        { label: 'Billing Address', value: order.billing_address, multiline: true },
      ],
    },
    {
      section: 'Shipping Address',
      items: [
        { label: 'Shipping Address', value: order.shipping_address, multiline: true },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {fields.map(group => (
        <div key={group.section}>
          <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">{group.section}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map(item => item.value ? (
              <div key={item.label} className={`${item.multiline ? 'md:col-span-2' : ''}`}>
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <div className={`text-sm text-slate-800 font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 ${item.multiline ? 'whitespace-pre-line' : ''}`}>
                  {item.value}
                </div>
              </div>
            ) : null)}
          </div>
        </div>
      ))}

      {/* More Info section */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">Order Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Purchase Order Number', value: order.po_number },
            { label: 'Purchase Order Date', value: order.po_date },
            { label: 'PO Expiry Date', value: order.po_expiry_date },
            { label: 'PO Delivery Date', value: order.po_delivery_date },
            { label: 'Payment Terms', value: order.payment_terms },
            { label: 'Vendor Number', value: order.vendor_no },
            { label: 'Platform', value: order.platform },
            { label: 'Source', value: order.source },
          ].filter(f => f.value).map(f => (
            <div key={f.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{f.label}</p>
              <p className="text-sm font-medium text-slate-900">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}