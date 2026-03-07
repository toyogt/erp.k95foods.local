import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ShoppingCart, ClipboardList, Truck, PackageOpen,
  TestTube2, Archive, Upload, ShieldCheck, Inbox, ChevronRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const MODULES = [
  {
    group: 'Purchase',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-600',
    items: [
      { label: 'Material Requests & POs', desc: 'Create & manage purchase requests and orders', icon: ShoppingCart, page: 'PurchaseOps' },
      { label: 'Approvals Inbox', desc: 'Review and approve pending purchase requests', icon: Inbox, page: 'ApprovalsInbox' },
      { label: 'Suppliers', desc: 'Manage supplier master data', icon: Truck, page: 'SupplierManager' },
    ],
  },
  {
    group: 'Gate & Receiving',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-600',
    items: [
      { label: 'Gate Entry', desc: 'Record vehicle & invoice on arrival', icon: ShieldCheck, page: 'GateEntry' },
      { label: 'Gate Inbox', desc: 'Review open gate entries & link to PO', icon: Truck, page: 'GateInbox' },
      { label: 'GRN Receive', desc: 'Receive goods and record quantities', icon: PackageOpen, page: 'GRNReceive' },
    ],
  },
  {
    group: 'Quality & Putaway',
    color: 'bg-purple-50 border-purple-200',
    headerColor: 'bg-purple-600',
    items: [
      { label: 'QC Inbox', desc: 'Inspect and approve or hold received items', icon: TestTube2, page: 'QCInbox' },
      { label: 'Putaway', desc: 'Move QC-passed stock to bins', icon: Archive, page: 'Putaway' },
    ],
  },
  {
    group: 'Accounts',
    color: 'bg-orange-50 border-orange-200',
    headerColor: 'bg-orange-600',
    items: [
      { label: 'Invoice Capture', desc: 'Upload and process supplier invoices', icon: Upload, page: 'InvoiceCapture' },
      { label: '3-Way Match', desc: 'Match invoices against PO and GRN', icon: ClipboardList, page: 'ThreeWayMatch' },
      { label: 'Payment Requests', desc: 'Create and approve payment requests', icon: ShoppingCart, page: 'PaymentRequests' },
    ],
  },
];

export default function PurchaseGRNHub() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase & GRN</h1>
        <p className="text-sm text-slate-500 mt-0.5">End-to-end procurement workflow</p>
      </div>

      {/* Workflow indicator */}
      <div className="flex items-center gap-1 text-xs overflow-x-auto pb-1">
        {['Purchase', 'Gate', 'GRN', 'QC', 'Putaway', 'Invoice'].map((s, i, arr) => (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <span className="bg-slate-800 text-white px-2 py-0.5 rounded-full font-medium">{s}</span>
            {i < arr.length - 1 && <span className="text-slate-400">→</span>}
          </div>
        ))}
      </div>

      {MODULES.map(({ group, color, headerColor, items }) => (
        <div key={group} className={`rounded-2xl border ${color} overflow-hidden`}>
          <div className={`${headerColor} px-4 py-2`}>
            <h2 className="text-sm font-bold text-white">{group}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map(({ label, desc, icon: Icon, page }) => (
              <Link
                key={page}
                to={createPageUrl(`${page}?from=PurchaseGRNHub`)}
                className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900">{label}</div>
                  <div className="text-xs text-slate-500 truncate">{desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}