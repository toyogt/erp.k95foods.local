import { ExternalLink, FileText, Truck, Receipt, CreditCard, ClipboardList } from 'lucide-react';

const DOC_TYPES = {
  fulfilment: {
    label: 'Fulfilment',
    color: 'text-blue-700',
    items: [
      { key: 'invoices', label: 'Sales Invoice', icon: Receipt, color: 'bg-purple-50 text-purple-700 border-purple-200' },
      { key: 'picklists', label: 'Pick List', icon: ClipboardList, color: 'bg-blue-50 text-blue-700 border-blue-200' },
      { key: 'deliveryNotes', label: 'Delivery Note', icon: Truck, color: 'bg-green-50 text-green-700 border-green-200' },
    ],
  },
  payment: {
    label: 'Payment',
    color: 'text-emerald-700',
    items: [
      { key: 'payments', label: 'Payment Entry', icon: CreditCard, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ],
  },
};

function DocBadge({ doc, label, href, color, icon: Icon, count }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded border ${color} hover:opacity-80 transition-opacity`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {count > 0 && (
        <span className="bg-slate-900 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold ml-0.5">{count}</span>
      )}
      <ExternalLink className="w-3 h-3 ml-0.5 opacity-50" />
    </a>
  );
}

export default function SOConnectionsGrid({ picklists = [], deliveryNotes = [], invoices = [], payments = [] }) {
  const docData = { picklists, deliveryNotes, invoices, payments };
  const hasAny = picklists.length > 0 || deliveryNotes.length > 0 || invoices.length > 0 || payments.length > 0;

  if (!hasAny) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No linked documents yet.</p>
        <p className="text-xs mt-1">Documents will appear here as the order progresses.</p>
      </div>
    );
  }

  const hrefMap = {
    invoices: (doc) => `/SalesInvoiceDetail?id=${doc.id}`,
    picklists: (doc) => `/SalesPicklistDetail?id=${doc.id}`,
    deliveryNotes: (doc) => `/SalesDeliveryNoteDetail?id=${doc.id}`,
    payments: () => '#',
  };

  const labelMap = {
    invoices: (doc) => doc.invoice_number || 'Invoice',
    picklists: (doc) => doc.picklist_number || 'Picklist',
    deliveryNotes: (doc) => doc.dn_number || 'Delivery Note',
    payments: (doc) => doc.reference_number || 'Payment',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(DOC_TYPES).map(([catKey, category]) => {
        const catDocs = category.items.filter(item => docData[item.key]?.length > 0);
        if (catDocs.length === 0) return null;

        return (
          <div key={catKey}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${category.color}`}>
              {category.label}
            </p>
            <div className="space-y-1.5">
              {category.items.map(item => {
                const docs = docData[item.key] || [];
                if (docs.length === 0) return null;
                return docs.map(doc => (
                  <DocBadge
                    key={doc.id}
                    doc={doc}
                    label={labelMap[item.key](doc)}
                    href={hrefMap[item.key](doc)}
                    color={item.color}
                    icon={item.icon}
                    count={0}
                  />
                ));
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}