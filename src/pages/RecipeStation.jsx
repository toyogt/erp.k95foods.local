import { AlertCircle } from 'lucide-react';

export default function RecipeStation() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <AlertCircle className="w-14 h-14 text-slate-300" />
      <h1 className="text-2xl font-bold text-slate-700">Module Disabled</h1>
      <p className="text-slate-500 max-w-xs">
        Recipe Station is currently disabled. Contact your administrator if you need access.
      </p>
    </div>
  );
}
  const [view, setView] = useState('list'); // list | new | run | qa_review
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [qcResult, setQcResult] = useState(null);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New batch form
  const [newForm, setNewForm] = useState({ batch_id: '', product: '', bottle_type: '', planned_qty_liters: '' });

  // Checklist state
  const [step, setStep] = useState('before'); // before | while | after | submit
  const [beforeItems, setBeforeItems] = useState([]);
  const [afterItems, setAfterItems] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setUser);
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [batchData, btData] = await Promise.all([
      base44.entities.Batch.list('-created_date', 50),
      base44.entities.BottleType.list('name'),
    ]);
    setBatches(batchData.filter(b => ['IN_PROGRESS', 'QC_PENDING', 'APPROVED', 'REJECTED'].includes(b.status)));
    setBottleTypes(btData);
    setLoading(false);
  }

  async function openBatch(batch) {
    setSelected(batch);
    setBeforeItems(getDefaultItems('BEFORE'));
    setAfterItems(getDefaultItems('AFTER'));
    setStep('before');

    // Load existing QC result if any
    const results = await base44.entities.QCResult.filter({ batch_id: batch.batch_id });
    setQcResult(results[0] || null);

    const role = getRole(user);
    if (batch.status === 'QC_PENDING' && role === 'qa') {
      setView('qa_review');
    } else {
      setView('run');
    }
  }

  async function startBatch() {
    if (!newForm.batch_id || !newForm.product || !newForm.bottle_type) return;
    setSaving(true);
    const batch = await base44.entities.Batch.create({
      batch_id: newForm.batch_id,
      product: newForm.product,
      bottle_type: newForm.bottle_type,
      planned_qty_liters: Number(newForm.planned_qty_liters) || 0,
      status: 'IN_PROGRESS',
      start_time: new Date().toISOString(),
    });
    await logAudit({ action: `Started batch ${newForm.batch_id}`, entity_type: 'Batch', entity_id: newForm.batch_id, user });
    setSaving(false);
    setNewForm({ batch_id: '', product: '', bottle_type: '', planned_qty_liters: '' });
    setView('list');
    loadData();
  }

  async function saveBefore(items) {
    await base44.entities.ChecklistLog.create({
      station: 'RECIPE',
      batch_id: selected.batch_id,
      checklist_type: 'BEFORE',
      items_json: items,
      completed_by: user?.email,
      completed_at: new Date().toISOString(),
    });
    await logAudit({ action: `Before checklist completed for ${selected.batch_id}`, entity_type: 'Batch', entity_id: selected.batch_id, user });
    setStep('while');
  }

  async function saveWhile(form) {
    const qc = await base44.entities.QCResult.create({
      batch_id: selected.batch_id,
      brix: Number(form.brix),
      ph: Number(form.ph),
      temp: Number(form.temp),
      notes: form.notes,
      qa_status: 'PENDING',
      timestamp: new Date().toISOString(),
    });
    setQcResult(qc);
    await logAudit({ action: `QC readings entered for ${selected.batch_id}`, entity_type: 'Batch', entity_id: selected.batch_id, user });
    setStep('after');
  }

  async function saveAfter(items) {
    await base44.entities.ChecklistLog.create({
      station: 'RECIPE',
      batch_id: selected.batch_id,
      checklist_type: 'AFTER',
      items_json: items,
      completed_by: user?.email,
      completed_at: new Date().toISOString(),
    });
    setStep('submit');
  }

  async function submitToQA() {
    setSaving(true);
    await base44.entities.Batch.update(selected.id, { status: 'QC_PENDING', end_time: new Date().toISOString() });
    await logAudit({ action: `Batch ${selected.batch_id} submitted to QA`, entity_type: 'Batch', entity_id: selected.batch_id, user });
    setSaving(false);
    setView('list');
    loadData();
  }

  async function qaDecide(decision, remarks) {
    await base44.entities.Batch.update(selected.id, { status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' });
    if (qcResult) {
      await base44.entities.QCResult.update(qcResult.id, { qa_status: decision, notes: remarks || qcResult.notes, qa_user: user?.email });
    }
    await logAudit({ action: `QA ${decision} batch ${selected.batch_id}`, entity_type: 'Batch', entity_id: selected.batch_id, user });
    setView('list');
    loadData();
  }

  const role = getRole(user);

  // ── List view ─────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Recipe Station</h1>
            <p className="text-sm text-slate-500">{role === 'qa' ? 'QA Review mode' : 'Batch execution'}</p>
          </div>
          {role !== 'qa' && (
            <Button onClick={() => setView('new')} className="rounded-xl h-11 gap-1.5 px-4">
              <Plus className="w-4 h-4" /> New Batch
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : batches.length === 0 ? (
          <div className="text-center py-20 text-slate-400">No active batches</div>
        ) : (
          <div className="space-y-3">
            {batches.map(b => (
              <button key={b.id} onClick={() => openBatch(b)} className="w-full text-left rounded-2xl bg-white border border-slate-200 p-5 active:scale-[0.98] transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 text-lg">{b.batch_id}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{b.product} · {b.bottle_type}</p>
                    {b.start_time && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{moment(b.start_time).fromNow()}</p>}
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── New batch form ─────────────────────────────────────────────
  if (view === 'new') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1">
          <ArrowLeft className="w-4 h-4" /> Batches
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Start New Batch</h1>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
          {[
            { label: 'Batch ID', key: 'batch_id', placeholder: 'e.g. BATCH-2026-001' },
            { label: 'Product', key: 'product', placeholder: 'e.g. Apple Juice' },
            { label: 'Planned Qty (Litres)', key: 'planned_qty_liters', placeholder: 'e.g. 5000', type: 'number' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">{label}</label>
              <Input type={type || 'text'} placeholder={placeholder} value={newForm[key]} onChange={e => setNewForm(p => ({ ...p, [key]: e.target.value }))} className="h-14 text-base rounded-xl" />
            </div>
          ))}

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Bottle Type</label>
            <Select value={newForm.bottle_type} onValueChange={v => setNewForm(p => ({ ...p, bottle_type: v }))}>
              <SelectTrigger className="h-14 rounded-xl text-base"><SelectValue placeholder="Select bottle type" /></SelectTrigger>
              <SelectContent>
                {bottleTypes.map(bt => <SelectItem key={bt.id} value={bt.name}>{bt.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={startBatch} disabled={saving || !newForm.batch_id || !newForm.product || !newForm.bottle_type} className="w-full h-16 rounded-2xl text-lg font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40">
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Start Batch'}
        </Button>
      </div>
    );
  }

  // ── QA Review view ─────────────────────────────────────────────
  if (view === 'qa_review') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1">
          <ArrowLeft className="w-4 h-4" /> Batches
        </button>
        <div className="rounded-2xl bg-rose-600 text-white p-5">
          <p className="text-xs uppercase tracking-widest text-rose-200 mb-1">QA Review</p>
          <p className="text-xl font-bold">{selected?.batch_id}</p>
          <p className="text-rose-200 text-sm mt-1">{selected?.product} · {selected?.bottle_type}</p>
        </div>
        <QAReview batch={selected} qcResult={qcResult} onDecision={qaDecide} />
      </div>
    );
  }

  // ── Batch run (checklist flow) ─────────────────────────────────
  const stepLabels = { before: 'BEFORE', while: 'WHILE', after: 'AFTER', submit: 'SUBMIT' };
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="space-y-4">
      <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-slate-500 font-medium -ml-1">
        <ArrowLeft className="w-4 h-4" /> Batches
      </button>

      <div className="rounded-2xl bg-rose-600 text-white p-5">
        <p className="text-xs uppercase tracking-widest text-rose-200 mb-1">Active Batch</p>
        <p className="text-xl font-bold">{selected?.batch_id}</p>
        <p className="text-rose-200 text-sm mt-1">{selected?.product} · {selected?.bottle_type}</p>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${i <= stepIdx ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
            {stepLabels[s]}
          </div>
        ))}
      </div>

      {step === 'before' && (
        <ChecklistStep type="BEFORE" items={beforeItems} onChange={setBeforeItems} onComplete={() => saveBefore(beforeItems)} canComplete={true} />
      )}
      {step === 'while' && (
        <WhileChecks onSubmit={saveWhile} />
      )}
      {step === 'after' && (
        <ChecklistStep type="AFTER" items={afterItems} onChange={setAfterItems} onComplete={() => saveAfter(afterItems)} canComplete={true} />
      )}
      {step === 'submit' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <p className="text-lg font-bold text-slate-900">All checks complete</p>
            {qcResult && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[['Brix', qcResult.brix, '°Bx'], ['pH', qcResult.ph, ''], ['Temp', qcResult.temp, '°C']].map(([l, v, u]) => (
                  <div key={l} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500">{l}</p>
                    <p className="font-bold text-slate-900">{v}{u}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button onClick={submitToQA} disabled={saving} className="w-full h-16 rounded-2xl text-lg font-bold bg-rose-600 hover:bg-rose-700">
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Submit to QA'}
          </Button>
        </div>
      )}
    </div>
  );
}