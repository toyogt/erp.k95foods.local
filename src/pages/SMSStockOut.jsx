import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { PackageOpen, ListChecks, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import Swal from 'sweetalert2';
import useDraftSave from '@/hooks/useDraftSave';
import StockIssueHistoryCards from '@/components/store/StockIssueHistoryCards';
import PickingStrategySelector from '@/components/store/PickingStrategySelector';
import SmartIssueForm from '@/components/store/SmartIssueForm';
import { buildAvailableItems } from '@/components/store/SmartPickingEngine';

const ISSUE_DRAFT_INITIAL = { issueType: 'production', referenceNumber: '', notes: '', pickingStrategy: 'FEFO' };

export default function SMSStockOut() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('issue');
  const [draft, setDraft, clearDraft, hasDraft] = useDraftSave('sms_stock_issue', ISSUE_DRAFT_INITIAL);
  const { issueType, referenceNumber, notes, pickingStrategy } = draft;
  const setIssueType = v => setDraft(prev => ({ ...prev, issueType: v }));
  const setReferenceNumber = v => setDraft(prev => ({ ...prev, referenceNumber: v }));
  const setNotes = v => setDraft(prev => ({ ...prev, notes: v }));
  const setPickingStrategy = v => setDraft(prev => ({ ...prev, pickingStrategy: v }));
  const [saving, setSaving] = useState(false);
  const [issueHistory, setIssueHistory] = useState([]);

  const [storedItems, setStoredItems] = useState([]);
  const [allLots, setAllLots] = useState([]);
  const [allBalances, setAllBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [lots, balances, issues] = await Promise.all([
      base44.entities.StoreLot.list('-created_date', 500),
      base44.entities.StoreStockBalance.list('-created_date', 1000),
      base44.entities.StoreIssue.list('-created_date', 100),
    ]);
    setIssueHistory(issues);
    setAllLots(lots);
    setAllBalances(balances);
    setStoredItems(buildAvailableItems(lots, balances));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleSmartIssue(pickingPlan, strategy) {
    if (!pickingPlan || pickingPlan.length === 0) return;
    setSaving(true);
    const user = await base44.auth.me();
    const issueId = `ISS-${Date.now()}`;
    const now = new Date().toISOString();

    await base44.entities.StoreIssue.create({
      issue_id: issueId,
      issue_type: issueType,
      picking_strategy: strategy,
      reference_number: referenceNumber,
      status: 'confirmed',
      total_items: pickingPlan.length,
      notes,
      issued_by: user?.email,
      issued_at: now,
    });

    const freshBalances = await base44.entities.StoreStockBalance.list('', 2000);

    for (const pick of pickingPlan) {
      await base44.entities.StoreIssueLine.create({
        issue_id: issueId,
        lot_id: pick.lot_id,
        location_id: pick.location_id,
        location_code: pick.location_code,
        item_code: pick.item_code,
        item_name: pick.item_name,
        uom: pick.uom,
        batch_number: pick.batch_number || '',
        manufacturing_date: pick.mfg_date || '',
        expiry_date: pick.expiry_date || '',
        supplier_name: pick.supplier_name || '',
        requested_quantity: pick.pick_quantity,
        issued_quantity: pick.pick_quantity,
        issue_type: issueType,
        picking_strategy: strategy,
        issued_at: now,
      });

      const matchingBal = freshBalances.find(b => b.lot_id === pick.lot_id && b.location_id === pick.location_id && b.quantity > 0);
      if (matchingBal) {
        const newQty = matchingBal.quantity - pick.pick_quantity;
        if (newQty <= 0) {
          await base44.entities.StoreStockBalance.delete(matchingBal.id);
        } else {
          await base44.entities.StoreStockBalance.update(matchingBal.id, { quantity: newQty });
        }
      }
    }

    const affectedLotIds = [...new Set(pickingPlan.map(p => p.lot_id))];
    const updatedBalances = await base44.entities.StoreStockBalance.list('', 5000);
    const balanceMap = {};
    updatedBalances.forEach(b => { balanceMap[b.lot_id] = (balanceMap[b.lot_id] || 0) + (b.quantity || 0); });

    for (const lotId of affectedLotIds) {
      const lot = allLots.find(l => l.lot_id === lotId);
      if (!lot) continue;
      const newRemaining = balanceMap[lotId] || 0;
      if (lot.remaining_quantity !== newRemaining) {
        await base44.entities.StoreLot.update(lot.id, {
          remaining_quantity: newRemaining,
          status: newRemaining <= 0 ? 'consumed' : lot.status,
        });
      }
    }

    Swal.fire({
      icon: 'success',
      title: 'Stock Issued',
      html: `<p class="font-mono font-bold">${issueId}</p><p>${pickingPlan.length} pick(s) confirmed using ${strategy} strategy</p>`,
      timer: 3000,
      showConfirmButton: false,
    });
    clearDraft();
    setSaving(false);
    loadData();
  }

  return (
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Issue</h1>
          <p className="text-sm text-slate-500">Issue stored stock using smart batch-wise picking (First Expired First Out / First In First Out)</p>
        </div>

        <div className="flex border-b border-slate-200">
          {[
            { id: 'issue', label: 'New Issue', icon: PackageOpen },
            { id: 'history', label: `Issue History (${issueHistory.length})`, icon: ListChecks },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {activeTab === 'history' && <StockIssueHistoryCards issues={issueHistory} />}

        {activeTab === 'issue' && (
          <>
            {hasDraft && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-700 font-medium">You have an unsaved draft issue</p>
                <button onClick={clearDraft} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear Draft</button>
              </div>
            )}

            <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Details</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Issue Type *</Label>
                  <select className="w-full h-11 md:h-9 border border-slate-200 rounded-md px-3 text-base md:text-sm mt-2" value={issueType} onChange={e => setIssueType(e.target.value)}>
                    <option value="production">Production Issue</option>
                    <option value="dispatch">Dispatch</option>
                    <option value="internal">Internal Use</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Reference Number</Label>
                  <input className="w-full h-11 md:h-9 text-base md:text-sm mt-2 border border-slate-200 rounded-md px-3" placeholder="Production Order / Dispatch reference" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Notes</Label>
                  <input className="w-full h-11 md:h-9 text-base md:text-sm mt-2 border border-slate-200 rounded-md px-3" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
              <PickingStrategySelector value={pickingStrategy || 'FEFO'} onChange={setPickingStrategy} />
            </div>

            <div className="bg-white/50 backdrop-blur-xl border border-white/30 rounded-[28px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-4 md:p-6">
              {loading ? (
                <p className="text-sm text-slate-400 text-center py-6">Loading stored items...</p>
              ) : storedItems.length === 0 ? (
                <div className="flex items-center gap-3 text-slate-400 py-6 justify-center">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm">No stored stock available for issue</p>
                </div>
              ) : (
                <SmartIssueForm
                  storedItems={storedItems}
                  allLots={allLots}
                  allBalances={allBalances}
                  pickingStrategy={pickingStrategy || 'FEFO'}
                  onIssue={handleSmartIssue}
                  saving={saving}
                />
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}