import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, CheckCircle2, X, ClipboardCheck } from 'lucide-react';
import { SkeletonList } from '@/components/store/StoreSkeleton';
import ExportButton from '@/components/store/ExportButton';
import DiscrepancyModal from '@/components/store/DiscrepancyModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

function CountRow({ entry, onCount }) {
  const [physical, setPhysical] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDiscrepancy, setShowDiscrepancy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (physical === '') return;
    const phyQty = parseFloat(physical);
    const variance = phyQty - entry.system_quantity;
    // Show modal if discrepancy detected
    if (variance !== 0) {
      setShowDiscrepancy(true);
      return;
    }
    // No variance: proceed normally
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.StoreCycleCount.update(entry.id, {
      physical_quantity: phyQty, variance, status: 'counted',
      counted_by: user?.email, counted_at: new Date().toISOString(), notes,
    });
    toast({ title: 'Count recorded', description: `Perfect count — no variance` });
    onCount();
    setSaving(false);
  }

  async function handleProceedWithDiscrepancy() {
    setSaving(true);
    const user = await base44.auth.me();
    const phyQty = parseFloat(physical);
    const variance = phyQty - entry.system_quantity;
    await base44.entities.StoreCycleCount.update(entry.id, {
      physical_quantity: phyQty, variance, status: 'counted',
      counted_by: user?.email, counted_at: new Date().toISOString(), notes,
    });
    toast({ title: 'Count recorded', description: `Variance noted: ${variance > 0 ? '+' : ''}${variance}` });
    setShowDiscrepancy(false);
    onCount();
    setSaving(false);
  }

  async function handleAdjustPutaway({ adjustedQty, reason }) {
    setSaving(true);
    const user = await base44.auth.me();
    const phyQty = parseFloat(physical);
    const variance = phyQty - entry.system_quantity;
    
    // Update cycle count
    await base44.entities.StoreCycleCount.update(entry.id, {
      physical_quantity: phyQty, variance, status: 'counted',
      counted_by: user?.email, counted_at: new Date().toISOString(), notes,
      adjustment_reason: reason, adjusted_quantity: adjustedQty,
    });
    
    // Adjust the stock balance for this lot/location
    const balances = await base44.entities.StoreStockBalance.filter({
      lot_id: entry.lot_id,
      location_id: entry.location_id,
    });
    
    if (balances.length > 0) {
      const bal = balances[0];
      const adjustment = adjustedQty - bal.quantity;
      const newQty = bal.quantity + adjustment;
      
      if (newQty <= 0) {
        await base44.entities.StoreStockBalance.delete(bal.id);
      } else {
        await base44.entities.StoreStockBalance.update(bal.id, { quantity: newQty });
      }
    }
    
    toast({ title: 'Count & adjustment recorded', description: `Putaway lot adjusted to ${adjustedQty}` });
    setShowDiscrepancy(false);
    onCount();
    setSaving(false);
  }

  if (entry.status !== 'pending') {
    return (
      <div className="px-3 md:px-4 py-3 hover:bg-slate-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">{entry.item_name}</p>
            <p className="text-xs text-slate-400">{entry.lot_id} · {entry.location_code}</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 shrink-0">Counted</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
          <span>System: <strong className="text-slate-700">{entry.system_quantity}</strong></span>
          <span>Physical: <strong className="text-slate-700">{entry.physical_quantity ?? '—'}</strong></span>
          <span>Variance: <strong className={`${(entry.variance || 0) === 0 ? 'text-green-600' : 'text-red-500'}`}>{entry.variance > 0 ? '+' : ''}{entry.variance ?? '—'}</strong></span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-3 md:px-4 py-3 border-b border-slate-100">
        <div className="mb-2">
          <p className="text-sm font-medium text-slate-800">{entry.item_name}</p>
          <p className="text-xs text-slate-400">{entry.lot_id} · {entry.location_code} · System: {entry.system_quantity} {entry.uom}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Label className="text-xs font-medium text-slate-700">Physical Count *</Label>
            <Input type="number" className="h-11 md:h-9 text-base md:text-sm mt-1" value={physical} onChange={e => setPhysical(e.target.value)} placeholder="Actual counted quantity" />
          </div>
          <div className="flex-1">
            <Label className="text-xs font-medium text-slate-700">Notes</Label>
            <Input className="h-11 md:h-9 text-base md:text-sm mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional remarks" />
          </div>
          <Button className="h-11 md:h-9 gap-1.5 w-full sm:w-auto" disabled={physical === '' || saving} onClick={submit}><CheckCircle2 className="w-4 h-4" />Record</Button>
        </div>
      </div>
      {showDiscrepancy && (
        <DiscrepancyModal
          entry={entry}
          physicalQty={parseFloat(physical)}
          onProceed={handleProceedWithDiscrepancy}
          onAdjust={handleAdjustPutaway}
          onCancel={() => setShowDiscrepancy(false)}
        />
      )}
    </>
  );
}

export default function SMSCycleCount() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState('');
  const [entries, setEntries] = useState([]);
  const [stock, setStock] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [counts, stk] = await Promise.all([
      base44.entities.StoreCycleCount.list('-created_date', 500),
      base44.entities.StoreStockBalance.list('-created_date', 500),
    ]);
    setStock(stk);
    const grouped = {};
    counts.forEach(c => { if (!grouped[c.session_name]) grouped[c.session_name] = []; grouped[c.session_name].push(c); });
    setSessions(Object.entries(grouped).map(([name, items]) => ({ name, items })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!activeSession) { setEntries([]); return; }
    base44.entities.StoreCycleCount.filter({ session_name: activeSession }).then(setEntries);
  }, [activeSession]);

  async function createSession() {
    if (!sessionName.trim()) return;
    setCreating(true);
    // Create entries for all current stock balances
    const user = await base44.auth.me();
    for (const bal of stock) {
      await base44.entities.StoreCycleCount.create({
        count_id: `CC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        session_name: sessionName.trim(),
        location_id: bal.location_id, location_code: bal.location_code,
        lot_id: bal.lot_id, item_code: bal.item_code, item_name: bal.item_name, uom: bal.uom,
        system_quantity: bal.quantity, status: 'pending',
      });
    }
    toast({ title: 'Cycle count session started', description: `${stock.length} items to count` });
    setSessionName('');
    setCreating(false);
    load();
    setActiveSession(sessionName.trim());
  }

  if (loading) return (
    <div className="space-y-4">
      <div><div className="h-6 bg-slate-200 rounded w-40 animate-pulse mb-1" /><div className="h-4 bg-slate-100 rounded w-64 animate-pulse" /></div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-16" />
      <SkeletonList rows={3} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cycle Count</h1>
        <p className="text-sm text-slate-500">Physical stock verification with discrepancy tracking</p>
      </div>

      {/* Start new session */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <Label className="text-xs font-medium text-slate-700">New Count Session Name</Label>
          <Input className="h-11 md:h-9 text-base md:text-sm mt-1" placeholder="e.g. Monthly Count Jan 2025" value={sessionName} onChange={e => setSessionName(e.target.value)} />
        </div>
        <Button className="h-11 md:h-9 gap-2 w-full sm:w-auto" disabled={!sessionName.trim() || creating || stock.length === 0} onClick={createSession}>
          <Plus className="w-4 h-4" />{creating ? 'Creating...' : 'Start Session'}
        </Button>
      </div>

      {/* Session list */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">Count Sessions</p>
          </div>
          <div className="divide-y divide-slate-100">
            {sessions.map(s => {
              const counted = s.items.filter(i => i.status !== 'pending').length;
              const total = s.items.length;
              const discrepancies = s.items.filter(i => i.variance !== 0 && i.variance !== null).length;
              return (
                <div key={s.name} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 flex items-center justify-between ${activeSession === s.name ? 'bg-blue-50' : ''}`} onClick={() => setActiveSession(s.name)}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {counted}/{total} counted · {discrepancies} discrepancies
                      {s.items[0]?.created_date && ` · ${new Date(s.items[0].created_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(counted / total) * 100}%` }} /></div>
                    <span className="text-xs text-slate-500">{Math.round((counted / total) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Count entries */}
      {activeSession && entries.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <p className="text-sm font-semibold text-slate-700">{activeSession} — Physical Count</p>
          </div>
          <div className="divide-y divide-slate-100">
            {entries.map(e => <CountRow key={e.id} entry={e} onCount={() => base44.entities.StoreCycleCount.filter({ session_name: activeSession }).then(setEntries)} />)}
          </div>
        </div>
      )}
    </div>
  );
}