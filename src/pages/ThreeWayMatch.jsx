import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { perform3WayMatch, genId, logAccountsAudit, createAlertEvent, INVOICE_STATUS_COLOR } from '@/components/accounts/accountsHelpers';

export default function ThreeWayMatch() {
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [poItems, setPoItems] = useState([]);
  const [tolerance, setTolerance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState('');
  const [matchResult, setMatchResult] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    loadInvoices();
    loadTolerance();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const invs = await base44.entities.SupplierInvoice.filter({
        status: { $in: ['DRAFT', 'SUBMITTED'] }
      });
      setInvoices(invs);
    } finally {
      setLoading(false);
    }
  };

  const loadTolerance = async () => {
    try {
      const configs = await base44.entities.MatchToleranceConfig.filter({ is_active: true });
      setTolerance(configs[0] || {
        qty_over_tolerance_percent: 0,
        price_over_tolerance_percent: 0,
        allow_under_delivery: true,
      });
    } catch (_) {}
  };

  const handleSelectInvoice = async (inv) => {
    setSelected(inv);
    setError('');
    setMatchResult(null);
    try {
      const invItems = await base44.entities.SupplierInvoiceItem.filter({ inv_id: inv.inv_id });
      setItems(invItems);
      if (inv.linked_po_id) {
        const poItems = await base44.entities.PurchaseOrderItem.filter({ po_id: inv.linked_po_id });
        setPoItems(poItems);
      } else {
        setPoItems([]);
      }
    } catch (err) {
      setError(`Failed to load items: ${err.message}`);
    }
  };

  const handlePerformMatch = async () => {
    if (!selected?.linked_po_id) {
      setError('No PO linked to this invoice');
      return;
    }
    setMatching(true);
    try {
      const result = await perform3WayMatch(items, selected.linked_po_id, tolerance);
      setMatchResult(result);

      // Create MatchResult record
      const matchId = genId('MATCH');
      const status = result.status === 'OK' ? 'MATCHED_OK' : 'EXCEPTION';
      await base44.entities.MatchResult.create({
        match_id: matchId,
        inv_id: selected.inv_id,
        po_id: selected.linked_po_id,
        status: result.status,
        exception_summary: result.exceptions.join('; ') || null,
        details_json: JSON.stringify(result.details),
        matched_by: user?.full_name || user?.email || '',
        matched_at: new Date().toISOString(),
      });

      // Update invoice status
      await base44.entities.SupplierInvoice.update(selected.id, {
        status,
        exception_summary: result.exceptions.join('; ') || null,
      });

      // Create alert if exception
      if (result.status === 'EXCEPTION') {
        await createAlertEvent(
          { inv_id: selected.inv_id, exception_summary: result.exceptions.join('; ') },
          user
        );
      }

      await logAccountsAudit({
        action: 'THREE_WAY_MATCH_COMPLETED',
        entity_type: 'SupplierInvoice',
        entity_id: selected.inv_id,
        details: { match_status: result.status },
        user,
      });

      setSelected({ ...selected, status });
      setError('');
    } catch (err) {
      setError(`Match failed: ${err.message}`);
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">3-Way Match (PO vs GRN vs Invoice)</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice List */}
        <Card className="p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Invoices to Match</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices to match</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invoices.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => handleSelectInvoice(inv)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                    selected?.id === inv.id
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm">{inv.inv_id}</div>
                  <div className="text-xs text-slate-500">{inv.supplier_name}</div>
                  <div className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded ${INVOICE_STATUS_COLOR[inv.status]}`}>
                    {inv.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Match Details */}
        {selected && (
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Invoice: {selected.inv_id}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Supplier:</span> <span className="font-medium">{selected.supplier_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Invoice #:</span> <span className="font-medium">{selected.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Date:</span> <span className="font-medium">{selected.invoice_date}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Amount:</span> <span className="font-medium">₹{selected.invoice_amount}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">PO:</span> <span className="font-medium">{selected.linked_po_id || '—'}</span></div>
              </div>
            </Card>

            {/* Line Items Comparison */}
            <Card className="p-4">
              <h3 className="font-semibold text-slate-900 mb-3">Line Items</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">No items</p>
              ) : (
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {items.map((it, i) => (
                    <div key={i} className="border border-slate-200 rounded p-2 bg-slate-50 text-xs">
                      <div className="font-medium">{it.item_code} • {it.item_name}</div>
                      <div className="text-slate-600">Qty: {it.qty} {it.uom_code} @ ₹{it.rate}/unit = ₹{it.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Match Result */}
            {matchResult && (
              <Card className={`p-4 ${matchResult.status === 'OK' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex gap-2 mb-3">
                  {matchResult.status === 'OK' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                  <h4 className={`font-semibold ${matchResult.status === 'OK' ? 'text-green-900' : 'text-red-900'}`}>
                    {matchResult.status === 'OK' ? 'Match Passed' : 'Match Failed'}
                  </h4>
                </div>
                {matchResult.exceptions.length > 0 && (
                  <div className="space-y-1 text-xs">
                    {matchResult.exceptions.map((ex, i) => (
                      <div key={i} className="flex gap-2">
                        <X className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{ex}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <Button
              onClick={handlePerformMatch}
              disabled={!selected?.linked_po_id || matching}
              className="w-full gap-2"
            >
              {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {!selected?.linked_po_id ? 'Link PO first' : 'Perform 3-Way Match'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}