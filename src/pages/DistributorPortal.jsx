import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Send, Loader2, Package, Clock, CheckCircle2, XCircle, ShoppingCart, Search } from 'lucide-react';

const STATUS_STYLE = {
  pending:   'bg-amber-100 text-amber-800',
  reviewing: 'bg-blue-100 text-blue-800',
  converted: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
};

const STATUS_ICON = {
  pending:   Clock,
  reviewing: Clock,
  converted: CheckCircle2,
  rejected:  XCircle,
};

const EMPTY_ITEM = { item_code: '', description: '', quantity: '', notes: '' };

export default function DistributorPortal() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [distributorName, setDistributorName] = useState('');
  const [contactName, setContactName] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [searchTerms, setSearchTerms] = useState({});

  // Rate list for item selection
  const { data: rateList = [] } = useQuery({
    queryKey: ['rate_list_portal'],
    queryFn: () => base44.entities.SalesRateList.filter({ is_active: true }, 'item_name', 300),
  });

  // Stock balances
  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stock_for_portal'],
    queryFn: () => base44.entities.StockBalance.list('-updated_date', 500),
  });

  // My requests
  const { data: myRequests = [], isLoading, refetch } = useQuery({
    queryKey: ['distributor_requests_mine', user?.email],
    queryFn: () => base44.entities.DistributorRequest.filter(
      { requested_by_email: user?.email }, '-created_date', 50
    ),
    enabled: !!user?.email,
  });

  // Admin: show all
  const { data: allRequests = [] } = useQuery({
    queryKey: ['distributor_requests_all'],
    queryFn: () => base44.entities.DistributorRequest.list('-created_date', 50),
    enabled: user?.role === 'admin',
  });

  const displayRequests = user?.role === 'admin' ? allRequests : myRequests;

  function getStock(itemCode) {
    const rows = stockBalances.filter(s => s.sku_code === itemCode || s.item_code === itemCode);
    return rows.reduce((sum, r) => sum + (r.available_qty || r.qty_available || r.quantity || 0), 0);
  }

  function getFilteredItems(idx) {
    const term = (searchTerms[idx] || '').toLowerCase();
    if (!term) return rateList.slice(0, 30);
    return rateList.filter(r =>
      r.item_code?.toLowerCase().includes(term) ||
      r.item_name?.toLowerCase().includes(term)
    ).slice(0, 20);
  }

  function selectItem(idx, rateItem) {
    setItems(prev => prev.map((item, i) => i === idx ? {
      ...item,
      item_code: rateItem.item_code,
      description: rateItem.item_name,
    } : item));
    setSearchTerms(prev => ({ ...prev, [idx]: '' }));
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setDistributorName(''); setContactName(''); setExpectedDate(''); setNotes('');
    setItems([{ ...EMPTY_ITEM }]); setSearchTerms({});
  }

  // MOQ configs for validation
  const { data: moqConfigs = [] } = useQuery({
    queryKey: ['sales_moq_configs'],
    queryFn: () => base44.entities.SalesMinOrderConfig.filter({ is_active: true }),
  });

  function getMOQ(itemCode) {
    return moqConfigs.find(c => c.item_code === itemCode);
  }

  async function handleSubmit() {
    if (!distributorName.trim()) {
      toast({ title: 'Please enter your distributor / company name', variant: 'destructive' });
      return;
    }
    const validItems = items.filter(i => i.description.trim() && parseFloat(i.quantity) > 0);
    if (!validItems.length) {
      toast({ title: 'Add at least one item with a product and quantity', variant: 'destructive' });
      return;
    }

    // MOQ check
    for (const item of validItems) {
      const moq = getMOQ(item.item_code);
      if (moq && parseFloat(item.quantity) < moq.min_order_qty) {
        toast({
          title: `Minimum order not met for ${item.description}`,
          description: `Minimum order quantity is ${moq.min_order_qty} units${moq.min_order_boxes ? ` (${moq.min_order_boxes} boxes)` : ''}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSubmitting(true);
    const reqNumber = `DR-${Date.now().toString().slice(-7)}`;
    await base44.entities.DistributorRequest.create({
      request_number: reqNumber,
      distributor_name: distributorName.trim(),
      contact_name: contactName.trim(),
      requested_by_email: user?.email,
      status: 'pending',
      items: validItems.map(i => ({
        item_code: i.item_code,
        description: i.description.trim(),
        quantity: parseFloat(i.quantity),
        notes: i.notes.trim(),
      })),
      notes: notes.trim(),
      expected_delivery_date: expectedDate || null,
    });

    setSubmitting(false);
    toast({ title: 'Order request submitted!', description: `Reference: ${reqNumber}` });
    resetForm();
    setShowForm(false);
    refetch();
  }

  const pendingCount = displayRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Distributor Order Portal</h1>
          <p className="text-sm text-slate-500">Submit your order requests. Our sales team will review and confirm.</p>
        </div>
        <Button
          className="h-11 bg-slate-900 text-white text-sm w-full sm:w-auto"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          <Plus className="w-4 h-4 mr-2" /> New Order Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{displayRequests.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Requests</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-xs text-amber-600 mt-0.5">Awaiting Review</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">
            {displayRequests.filter(r => r.status === 'converted').length}
          </p>
          <p className="text-xs text-green-600 mt-0.5">Converted to Orders</p>
        </div>
      </div>

      {/* Requests list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            {user?.role === 'admin' ? 'All Requests' : 'My Requests'}
          </h2>
          {user?.role === 'admin' && (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Admin View</span>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : displayRequests.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No requests yet. Submit your first order request above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayRequests.map(req => {
              const Icon = STATUS_ICON[req.status] || Clock;
              return (
                <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{req.request_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[req.status]}`}>
                        <Icon className="w-3 h-3 inline mr-0.5" />
                        {req.status === 'converted' ? 'Converted to Order' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(req.created_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <p className="text-xs text-slate-500 mt-1">From: <span className="font-medium">{req.distributor_name}</span> · {req.requested_by_email}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(req.items || []).map((item, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md">
                        <Package className="w-3 h-3" />
                        {item.description} × {item.quantity}
                      </span>
                    ))}
                  </div>
                  {req.notes && <p className="text-xs text-slate-500 mt-1.5 italic">Note: {req.notes}</p>}
                  {req.expected_delivery_date && <p className="text-xs text-slate-400 mt-1">Expected by: {req.expected_delivery_date}</p>}
                  {req.status === 'converted' && req.converted_so_number && (
                    <p className="text-xs text-green-700 mt-1 font-medium">Sales Order: {req.converted_so_number}</p>
                  )}
                  {req.status === 'rejected' && req.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">Reason: {req.rejection_reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-slate-900">New Order Request</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Your Company / Distributor Name *</Label>
                  <Input className="h-9 text-sm mt-1" placeholder="e.g. ABC Distributors"
                    value={distributorName} onChange={e => setDistributorName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Contact Person</Label>
                  <Input className="h-9 text-sm mt-1" placeholder="Your name"
                    value={contactName} onChange={e => setContactName(e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Expected Delivery Date</Label>
                <Input type="date" className="h-9 text-sm mt-1" value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)} />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-slate-700">Order Items *</Label>
                  <button onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
                    className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const stock = item.item_code ? getStock(item.item_code) : null;
                    const moq = item.item_code ? getMOQ(item.item_code) : null;
                    const filtered = getFilteredItems(idx);
                    return (
                      <div key={idx} className="bg-slate-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-slate-500 font-medium mt-2 w-5 flex-shrink-0">{idx + 1}.</span>
                          <div className="flex-1 space-y-2">
                            {/* Product search */}
                            <div className="relative">
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <Input
                                    className="h-8 text-sm pl-8"
                                    placeholder="Search product by name or code..."
                                    value={searchTerms[idx] || item.description || ''}
                                    onChange={e => {
                                      setSearchTerms(prev => ({ ...prev, [idx]: e.target.value }));
                                      if (!e.target.value) updateItem(idx, 'item_code', '');
                                    }}
                                  />
                                </div>
                                <Input type="number" min="1" className="h-8 text-sm w-24" placeholder="Qty"
                                  value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                                {items.length > 1 && (
                                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              {/* Dropdown */}
                              {searchTerms[idx] && filtered.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                                  {filtered.map(r => {
                                    const s = getStock(r.item_code);
                                    return (
                                      <button key={r.id} onClick={() => selectItem(idx, r)}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2">
                                        <div>
                                          <span className="text-sm text-slate-900">{r.item_name}</span>
                                          <span className="text-xs text-slate-400 ml-2">{r.item_code}</span>
                                        </div>
                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${s > 0 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}>
                                          Stock: {s}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {/* Selected item info */}
                            {item.item_code && (
                              <div className="flex flex-wrap gap-2 text-xs">
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">{item.item_code}</span>
                                {stock !== null && (
                                  <span className={`px-2 py-0.5 rounded font-medium ${stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                                    Available stock: {stock} units
                                  </span>
                                )}
                                {moq && (
                                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                                    Min order: {moq.min_order_qty} units{moq.min_order_boxes ? ` / ${moq.min_order_boxes} boxes` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                            <Input className="h-7 text-xs bg-white" placeholder="Item notes (optional)"
                              value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Special Instructions / Notes</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none"
                  placeholder="Any special requirements, delivery instructions, etc."
                  value={notes} onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-slate-100">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button className="h-11 flex-1 bg-slate-900 text-white text-sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}