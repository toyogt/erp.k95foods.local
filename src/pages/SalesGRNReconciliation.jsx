import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, RefreshCw, AlertTriangle, CheckCircle, Clock, FileText, ShieldAlert, PackageSearch, ChevronRight } from 'lucide-react';
import GRNEntryModal from '@/components/sales/GRNEntryModal';
import ManagementReviewTab from '@/components/sales/ManagementReviewTab';
import DebitNoteEntryModal from '@/components/sales/DebitNoteEntryModal';
import GRNReconciliationPanel from '@/components/sales/GRNReconciliationPanel';
import PendingGRNTab from '@/components/sales/PendingGRNTab';

const PLATFORM_COLORS = {
  swiggy: 'bg-orange-100 text-orange-700',
  zepto: 'bg-purple-100 text-purple-700',
  blinkit: 'bg-yellow-100 text-yellow-700',
  other: 'bg-slate-100 text-slate-600',
};

const GRN_STATUS_COLORS = {
  pending_match: 'bg-yellow-100 text-yellow-700',
  matched: 'bg-green-100 text-green-700',
  discrepancy_identified: 'bg-red-100 text-red-700',
  credit_note_issued: 'bg-blue-100 text-blue-700',
  closed: 'bg-slate-100 text-slate-600',
};

const GRN_STATUS_LABELS = {
  pending_match: 'Pending Match', matched: 'Matched',
  discrepancy_identified: 'Discrepancy Found', credit_note_issued: 'Credit Note Issued', closed: 'Closed'
};

const DN_STATUS_COLORS = {
  received: 'bg-yellow-100 text-yellow-700',
  matched_to_grn: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  disputed: 'bg-red-100 text-red-700',
  credit_note_issued: 'bg-blue-100 text-blue-700',
  closed: 'bg-slate-100 text-slate-600',
};

export default function SalesGRNReconciliation() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showDNModal, setShowDNModal] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [prefillInvoice, setPrefillInvoice] = useState(null);

  const { data: grns = [], isLoading: grnsLoading } = useQuery({
    queryKey: ['customer-grns'],
    queryFn: () => base44.entities.CustomerGRN.list('-created_date', 100),
  });

  const { data: debitNotes = [], isLoading: dnsLoading } = useQuery({
    queryKey: ['customer-debit-notes'],
    queryFn: () => base44.entities.CustomerDebitNote.list('-created_date', 100),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['sales-invoices-for-grn'],
    queryFn: () => base44.entities.SalesInvoice.list('-invoice_date', 200),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders-for-grn'],
    queryFn: () => base44.entities.SalesOrder.list('-created_date', 500),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['customer-grns'] });
    qc.invalidateQueries({ queryKey: ['customer-debit-notes'] });
    qc.invalidateQueries({ queryKey: ['sales-invoices-for-grn'] });
    qc.invalidateQueries({ queryKey: ['sales-orders-for-grn'] });
  };

  // Count delivered invoices without a GRN
  const pendingGRNCount = (() => {
    const grnInvIds = new Set(grns.map(g => g.invoice_id).filter(Boolean));
    const grnInvNums = new Set(grns.map(g => g.invoice_number?.trim().toLowerCase()).filter(Boolean));
    return invoices.filter(inv => {
      if (inv.workflow_state !== 'delivered') return false;
      if (grnInvIds.has(inv.id)) return false;
      if (inv.invoice_number && grnInvNums.has(inv.invoice_number.trim().toLowerCase())) return false;
      return true;
    }).length;
  })();

  const handleRecordGRNFromPending = (invoice, salesOrder) => {
    setPrefillInvoice(invoice);
    setShowGRNModal(true);
  };

  const filterGRNs = (items) => items.filter(g => {
    const matchSearch = !search || g.grn_number?.toLowerCase().includes(search.toLowerCase()) ||
      g.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      g.po_number?.toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platformFilter === 'all' || g.platform === platformFilter;
    const matchStatus = statusFilter === 'all' || g.status === statusFilter;
    return matchSearch && matchPlatform && matchStatus;
  });

  const filterDNs = (items) => items.filter(d => {
    const matchSearch = !search || d.debit_note_number?.toLowerCase().includes(search.toLowerCase()) ||
      d.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platformFilter === 'all' || d.platform === platformFilter;
    return matchSearch && matchPlatform;
  });

  const stats = {
    total: grns.length,
    pending: grns.filter(g => g.status === 'pending_match').length,
    discrepancy: grns.filter(g => g.status === 'discrepancy_identified').length,
    creditIssued: grns.filter(g => g.status === 'credit_note_issued').length,
  };

  // Count items needing management review (GRN discrepancy >1%)
  const mgmtReviewCount = grns.filter(g => {
    const inv = invoices.find(i => i.invoice_number === g.invoice_number || i.id === g.invoice_id);
    const invAmt = inv?.total_amount || g.invoice_total_amount || 0;
    const grnAmt = g.grn_total_amount || 0;
    return invAmt > 0 && Math.abs((invAmt - grnAmt) / invAmt) * 100 > 1;
  }).length + debitNotes.filter(d => ['under_review', 'disputed'].includes(d.status)).length;

  return (
    <motion.div className="space-y-5 p-3 md:p-4 lg:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">GRN Reconciliation</h1>
          <p className="text-sm text-slate-500">Manage customer Goods Receipt Notes, Discrepancy Notes, and Credit Notes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 gap-2" onClick={refresh}><RefreshCw className="w-4 h-4" />Refresh</Button>
          <Button variant="outline" className="h-11 gap-2" onClick={() => setShowDNModal(true)}><Plus className="w-4 h-4" />Debit Note</Button>
          <Button className="h-11 gap-2" onClick={() => setShowGRNModal(true)}><Plus className="w-4 h-4" />Record GRN</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total GRNs', value: stats.total, icon: FileText, color: 'text-slate-700', bg: 'bg-slate-100 text-slate-600' },
          { label: 'Pending Match', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 text-yellow-600' },
          { label: 'Discrepancies', value: stats.discrepancy, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 text-red-600' },
          { label: 'Credit Notes Issued', value: stats.creditIssued, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100 text-blue-600' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.06 }}
            className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${s.bg}`}><s.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9 h-10" placeholder="Search GRN, invoice, PO number..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="swiggy">Swiggy</SelectItem>
            <SelectItem value="zepto">Zepto</SelectItem>
            <SelectItem value="blinkit">Blinkit</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_match">Pending Match</SelectItem>
            <SelectItem value="discrepancy_identified">Discrepancy Found</SelectItem>
            <SelectItem value="credit_note_issued">Credit Note Issued</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pending_grn">
        <TabsList>
          <TabsTrigger value="pending_grn" className="relative">
            <PackageSearch className="w-3.5 h-3.5 mr-1" />
            Pending for GRN
            {pendingGRNCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{pendingGRNCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="grns">Customer GRNs ({grns.length})</TabsTrigger>
          <TabsTrigger value="debitnotes">Debit Notes ({debitNotes.length})</TabsTrigger>
          <TabsTrigger value="mgmt_review" className="relative">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            Management Review
            {mgmtReviewCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{mgmtReviewCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending for GRN Tab */}
        <TabsContent value="pending_grn" className="mt-3">
          <PendingGRNTab
            invoices={invoices}
            grns={grns}
            orders={salesOrders}
            onRecordGRN={handleRecordGRNFromPending}
          />
        </TabsContent>

        {/* GRNs Tab */}
        <TabsContent value="grns" className="mt-3">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3">GRN Number</th>
                  <th className="text-left px-3 py-3">Platform</th>
                  <th className="text-left px-3 py-3">Invoice Number</th>
                  <th className="text-left px-3 py-3">Purchase Order</th>
                  <th className="text-right px-3 py-3">GRN Amount</th>
                  <th className="text-right px-3 py-3">Debit Note</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="px-3 py-3">GRN Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grnsLoading && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">Loading...</td></tr>
                )}
                {!grnsLoading && filterGRNs(grns).length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-400">No GRNs recorded yet. Click "Record GRN" to add one.</td></tr>
                )}
                {filterGRNs(grns).map(grn => {
                  const inv = invoices.find(i => i.invoice_number === grn.invoice_number || i.id === grn.invoice_id);
                  const invAmt = inv?.total_amount || grn.invoice_total_amount || 0;
                  const grnAmt = grn.grn_total_amount || 0;
                  const discPct = invAmt > 0 ? Math.abs((invAmt - grnAmt) / invAmt) * 100 : 0;
                  const flagged = discPct > 1;
                  return (
                  <tr key={grn.id} className={`cursor-pointer ${flagged ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`} onClick={() => setSelectedGRN(grn)}>
                    <td className="px-4 py-3 font-medium text-slate-900">{grn.grn_number}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${PLATFORM_COLORS[grn.platform] || ''}`}>{grn.platform?.toUpperCase()}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{grn.invoice_number}</td>
                    <td className="px-3 py-3 text-slate-600">{grn.po_number || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-800">₹{(grn.grn_total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right">
                      {grn.dn_amount > 0 ? (
                        <span className="text-red-600 font-medium">₹{(grn.dn_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${GRN_STATUS_COLORS[grn.status] || ''}`}>{GRN_STATUS_LABELS[grn.status] || grn.status}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs">{grn.grn_date}</td>
                    {flagged && (
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-1 text-xs text-red-700 font-semibold whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3" /> {discPct.toFixed(1)}%
                        </span>
                      </td>
                    )}
                    </tr>
                    );
                    })}
              </tbody>
            </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {grnsLoading && <div className="p-8 text-center text-slate-400">Loading...</div>}
              {!grnsLoading && filterGRNs(grns).length === 0 && <div className="p-8 text-center text-slate-400">No GRNs recorded yet.</div>}
              {filterGRNs(grns).map(grn => {
                const inv = invoices.find(i => i.invoice_number === grn.invoice_number || i.id === grn.invoice_id);
                const invAmt = inv?.total_amount || grn.invoice_total_amount || 0;
                const grnAmt = grn.grn_total_amount || 0;
                const discPct = invAmt > 0 ? Math.abs((invAmt - grnAmt) / invAmt) * 100 : 0;
                const flagged = discPct > 1;
                return (
                  <div key={grn.id} className={`px-4 py-3.5 active:bg-slate-50 cursor-pointer ${flagged ? 'bg-red-50' : ''}`} onClick={() => setSelectedGRN(grn)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{grn.grn_number}</p>
                        <p className="text-sm text-slate-600 mt-0.5">Invoice: {grn.invoice_number}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${GRN_STATUS_COLORS[grn.status] || ''}`}>{GRN_STATUS_LABELS[grn.status] || grn.status}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[grn.platform] || ''}`}>{grn.platform?.toUpperCase()}</span>
                      <span className="font-medium text-slate-700">₹{(grnAmt).toLocaleString('en-IN')}</span>
                      {grn.grn_date && <span>{grn.grn_date}</span>}
                      {flagged && <span className="text-red-600 font-medium flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> {discPct.toFixed(1)}%</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Management Review Tab */}
        <TabsContent value="mgmt_review" className="mt-3">
          <ManagementReviewTab grns={grns} debitNotes={debitNotes} invoices={invoices} onRefresh={refresh} />
        </TabsContent>

        {/* Debit Notes Tab */}
        <TabsContent value="debitnotes" className="mt-3">
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3">Debit Note Number</th>
                  <th className="text-left px-3 py-3">Platform</th>
                  <th className="text-left px-3 py-3">Invoice Number</th>
                  <th className="text-left px-3 py-3">GRN Number</th>
                  <th className="text-right px-3 py-3">Debit Note Amount</th>
                  <th className="text-right px-3 py-3">Credit Note Issued</th>
                  <th className="text-center px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dnsLoading && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading...</td></tr>
                )}
                {!dnsLoading && filterDNs(debitNotes).length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No debit notes recorded yet.</td></tr>
                )}
                {filterDNs(debitNotes).map(dn => (
                  <tr key={dn.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{dn.debit_note_number}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${PLATFORM_COLORS[dn.platform] || ''}`}>{dn.platform?.toUpperCase()}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{dn.invoice_number}</td>
                    <td className="px-3 py-3 text-slate-600">{dn.grn_number || '—'}</td>
                    <td className="px-3 py-3 text-right text-red-600 font-medium">₹{(dn.debit_note_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-3 text-right text-green-700">{dn.our_credit_note_number ? `${dn.our_credit_note_number} (₹${dn.our_credit_note_amount})` : '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${DN_STATUS_COLORS[dn.status] || ''}`}>{dn.status?.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {dnsLoading && <div className="p-8 text-center text-slate-400">Loading...</div>}
              {!dnsLoading && filterDNs(debitNotes).length === 0 && <div className="p-8 text-center text-slate-400">No debit notes recorded yet.</div>}
              {filterDNs(debitNotes).map(dn => (
                <div key={dn.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{dn.debit_note_number}</p>
                      <p className="text-sm text-slate-600 mt-0.5">Invoice: {dn.invoice_number}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${DN_STATUS_COLORS[dn.status] || ''}`}>{dn.status?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLORS[dn.platform] || ''}`}>{dn.platform?.toUpperCase()}</span>
                    <span className="text-red-600 font-medium">₹{(dn.debit_note_amount || 0).toLocaleString('en-IN')}</span>
                    {dn.grn_number && <span>GRN: {dn.grn_number}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <GRNEntryModal
        open={showGRNModal}
        onClose={() => { setShowGRNModal(false); setPrefillInvoice(null); }}
        onSaved={refresh}
        invoices={invoices}
        prefillInvoice={prefillInvoice}
      />
      <DebitNoteEntryModal open={showDNModal} onClose={() => setShowDNModal(false)} onSaved={refresh} grns={grns} invoices={invoices} />
      <GRNReconciliationPanel grn={selectedGRN} open={!!selectedGRN} onClose={() => setSelectedGRN(null)} onUpdated={() => { refresh(); setSelectedGRN(null); }} />
    </motion.div>
  );
}