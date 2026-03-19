import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Loader2, ClipboardList, ShoppingCart, BarChart3, Plus, LayoutGrid, ChevronRight,
         Truck, PackageOpen, TestTube2, Archive, Upload, ShieldCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MRWizard from '@/components/purchase/MRWizard';
import MRList from '@/components/purchase/MRList';
import POForm from '@/components/purchase/POForm';
import POList from '@/components/purchase/POList';
import PurchaseReports from '@/components/purchase/PurchaseReports';

const HUB_GROUPS = [
  {
    group: 'Purchase',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-600',
    items: [
      { label: 'Requisitions', desc: 'Create & manage material requests', icon: ClipboardList, tab: 'mr' },
      { label: 'Purchase Orders', desc: 'Create & manage purchase orders', icon: ShoppingCart, tab: 'po' },
      { label: 'Approvals Inbox', desc: 'Review and approve pending requests', icon: Inbox, page: 'ApprovalsInbox' },
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

const TABS = [
  { id: 'hub', label: 'Hub', Icon: LayoutGrid },
  { id: 'mr', label: 'Requisitions', Icon: ClipboardList },
  { id: 'po', label: 'Purchase Orders', Icon: ShoppingCart },
  { id: 'reports', label: 'Reports', Icon: BarChart3 },
];

export default function PurchaseOps() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('mr');
  const [showMRWizard, setShowMRWizard] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [poSourceMR, setPoSourceMR] = useState(null);
  const [poSourceItems, setPoSourceItems] = useState([]);
  const [mrListKey, setMrListKey] = useState(0);
  const [poListKey, setPoListKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  const isManager = user?.role === 'admin' || user?.role === 'purchase_manager' || user?.role === 'production_manager';
  const isAdmin = user?.role === 'admin';

  function handleCreatePO(mr, items) {
    setPoSourceMR(mr);
    setPoSourceItems(items);
    setShowPOForm(true);
    setTab('po');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase</h1>
        <p className="text-sm text-slate-500">Requisitions → POs → Approvals</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        {TABS.map(({ id, label, Icon: TabIcon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <TabIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* MR Tab */}
      {tab === 'mr' && (
        <div className="space-y-4">
          {!showMRWizard && (
            <Button onClick={() => setShowMRWizard(true)} className="w-full bg-blue-600 hover:bg-blue-700 h-11">
              <Plus className="w-4 h-4 mr-2" /> New Material Request
            </Button>
          )}
          {showMRWizard && (
            <MRWizard
              user={user}
              onDone={() => { setShowMRWizard(false); setMrListKey(k => k + 1); }}
              onCancel={() => setShowMRWizard(false)}
            />
          )}
          {!showMRWizard && (
            <MRList
              key={mrListKey}
              user={user}
              isManager={isManager}
              onCreatePO={handleCreatePO}
            />
          )}
        </div>
      )}

      {/* PO Tab */}
      {tab === 'po' && (
        <div className="space-y-4">
          {!showPOForm && isManager && (
            <Button onClick={() => { setPoSourceMR(null); setPoSourceItems([]); setShowPOForm(true); }}
              className="w-full bg-blue-600 hover:bg-blue-700 h-11">
              <Plus className="w-4 h-4 mr-2" /> New Purchase Order
            </Button>
          )}
          {showPOForm && (
            <POForm
              user={user}
              isAdmin={isAdmin}
              sourceMR={poSourceMR}
              sourceItems={poSourceItems}
              onDone={() => { setShowPOForm(false); setPoListKey(k => k + 1); setMrListKey(k => k + 1); }}
              onCancel={() => setShowPOForm(false)}
            />
          )}
          {!showPOForm && (
            <POList key={poListKey} user={user} isManager={isManager} />
          )}
        </div>
      )}

      {/* Reports Tab */}
      {tab === 'reports' && <PurchaseReports />}
    </div>
  );
}