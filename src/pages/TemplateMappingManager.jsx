import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Search, Loader2 } from 'lucide-react';

const TABS = ['Mappings', 'Label Variants', 'Ryan Templates', 'Batch Format Rules'];

function genId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}`; }

function Badge({ ok }) {
  return ok
    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Active</span>
    : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Inactive</span>;
}

// ─── GENERIC INLINE EDITOR ──────────────────────────────────────────────────
function InlineForm({ fields, initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || {});
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label}{f.required && ' *'}</label>
          {f.type === 'boolean' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm text-slate-700">Active</span>
            </label>
          ) : f.type === 'json' ? (
           <textarea
             className="w-full h-24 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-blue-500"
             placeholder='{"prefix":"BTH","date":"YYMMDD","seq":4}'
             value={typeof form[f.key] === 'object' ? JSON.stringify(form[f.key], null, 2) : (form[f.key] || '')}
             onChange={e => {
               try { setForm(v => ({ ...v, [f.key]: JSON.parse(e.target.value) })); }
               catch { setForm(v => ({ ...v, [f.key]: e.target.value })); }
             }}
           />
          ) : f.type === 'select' ? (
           <select
             className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 bg-white"
             value={form[f.key] || ''}
             onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
           >
             <option value="">— Select —</option>
             {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
           </select>
          ) : (
            <input
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 font-mono"
              value={form[f.key] || ''}
              onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder || ''}
              readOnly={f.readOnly}
            />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── LABEL VARIANTS TAB ─────────────────────────────────────────────────────
function LabelVariantsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // id or 'new'
  const [saving, setSaving] = useState(false);

  const fields = [
    { key: 'label_variant_id', label: 'Variant ID', required: true, readOnly: !!editing && editing !== 'new' },
    { key: 'product_code', label: 'Product Code' },
    { key: 'brand', label: 'Brand' },
    { key: 'mrp_variant', label: 'MRP Variant' },
    { key: 'label_template_name', label: 'Label Template Name (on printer)' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ];

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); setItems(await base44.entities.LabelVariant.list('-created_date', 200)); setLoading(false); }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.LabelVariant.create({ ...form, is_active: form.is_active !== false });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.LabelVariant.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function del(item) {
    if (!confirm(`Delete variant ${item.label_variant_id}?`)) return;
    await base44.entities.LabelVariant.delete(item.id);
    await load();
  }

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-2" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New Variant</Button>
      {editing === 'new' && <InlineForm fields={fields} initial={{ is_active: true }} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
              {editing === item.id ? (
                <InlineForm fields={fields} initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-sm text-slate-800">{item.label_variant_id}</p>
                    <p className="text-xs text-slate-500">{item.product_code} · {item.brand} · MRP: {item.mrp_variant}</p>
                    {item.label_template_name && <p className="text-xs text-blue-600 font-mono mt-0.5">Template: {item.label_template_name}</p>}
                    <div className="mt-1"><Badge ok={item.is_active} /></div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                    <button onClick={() => del(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RYAN TEMPLATES TAB ─────────────────────────────────────────────────────
function RyanTemplatesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fields = [
    { key: 'ryan_template_id', label: 'Ryan Template ID', required: true, readOnly: !!editing && editing !== 'new' },
    { key: 'description', label: 'Description' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ];

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); setItems(await base44.entities.RyanTemplate.list('-created_date', 200)); setLoading(false); }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.RyanTemplate.create({ ...form, is_active: form.is_active !== false });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.RyanTemplate.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function del(item) {
    if (!confirm(`Delete template ${item.ryan_template_id}?`)) return;
    await base44.entities.RyanTemplate.delete(item.id);
    await load();
  }

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-2" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New Template</Button>
      {editing === 'new' && <InlineForm fields={fields} initial={{ is_active: true }} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
              {editing === item.id ? (
                <InlineForm fields={fields} initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono font-bold text-sm text-slate-800">{item.ryan_template_id}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                    <div className="mt-1"><Badge ok={item.is_active} /></div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                    <button onClick={() => del(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BATCH FORMAT RULES TAB ─────────────────────────────────────────────────
function BatchFormatRulesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fields = [
    { key: 'rule_id', label: 'Rule ID', required: true, readOnly: !!editing && editing !== 'new' },
    { key: 'description', label: 'Description', required: true },
    { key: 'format_json', label: 'Format JSON', type: 'json' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ];

  useEffect(() => { load(); }, []);
  async function load() { setLoading(true); setItems(await base44.entities.BatchFormatRule.list('-created_date', 200)); setLoading(false); }

  async function save(form) {
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.BatchFormatRule.create({ ...form, is_active: form.is_active !== false });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.BatchFormatRule.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function del(item) {
    if (!confirm(`Delete rule ${item.rule_id}?`)) return;
    await base44.entities.BatchFormatRule.delete(item.id);
    await load();
  }

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-2" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New Rule</Button>
      {editing === 'new' && <InlineForm fields={fields} initial={{ is_active: true }} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
              {editing === item.id ? (
                <InlineForm fields={fields} initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm text-slate-800">{item.rule_id}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                    {item.format_json && <p className="text-xs font-mono text-slate-400 truncate">{JSON.stringify(item.format_json)}</p>}
                    <div className="mt-1"><Badge ok={item.is_active} /></div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                    <button onClick={() => del(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAPPINGS TAB (main) ─────────────────────────────────────────────────────
function MappingsTab() {
  const [items, setItems] = useState([]);
  const [variants, setVariants] = useState([]);
  const [ryanTpls, setRyanTpls] = useState([]);
  const [batchRules, setBatchRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [m, v, r, b] = await Promise.all([
      base44.entities.SKUPrintMapping.list('-created_date', 500),
      base44.entities.LabelVariant.filter({ is_active: true }),
      base44.entities.RyanTemplate.filter({ is_active: true }),
      base44.entities.BatchFormatRule.filter({ is_active: true }),
    ]);
    setItems(m); setVariants(v); setRyanTpls(r); setBatchRules(b);
    setLoading(false);
  }

  const fields = [
    { key: 'mapping_id', label: 'Mapping ID', required: true, readOnly: !!editing && editing !== 'new', placeholder: genId('MAP') },
    { key: 'product_code', label: 'SKU Code', required: true },
    { key: 'batch_date_source', label: 'Batch Date Source', type: 'select', options: ['MFG_START', 'LABEL_START'] },
    { key: 'sequence_reset_scope', label: 'Sequence Reset Scope', type: 'select', options: ['DAILY', 'MONTHLY', 'YEARLY', 'NEVER'] },
    { key: 'use_batch_prefix_from_sku', label: 'Use Batch Prefix from SKU', type: 'boolean' },
    { key: 'label_variant_id', label: 'Label Variant ID', required: true },
    { key: 'ryan_template_id', label: 'Ryan Template ID' },
    { key: 'batch_format_rule_id', label: 'Batch Format Rule ID' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
  ];

  function validate(form) {
    if (!form.product_code || !form.label_variant_id) return 'SKU Code and label_variant_id are required';
    if (form.is_active && (!form.ryan_template_id || !form.batch_format_rule_id || !form.label_variant_id)) {
      return 'Cannot activate mapping: ryan_template_id, batch_format_rule_id, and label_variant_id are all required for active mappings';
    }
    return null;
  }

  async function save(form) {
    const err = validate(form);
    if (err) { alert(err); return; }
    setSaving(true);
    if (editing === 'new') {
      await base44.entities.SKUPrintMapping.create({ ...form, mapping_id: form.mapping_id || genId('MAP'), is_active: form.is_active !== false });
    } else {
      const rec = items.find(i => i.id === editing);
      if (rec) await base44.entities.SKUPrintMapping.update(rec.id, form);
    }
    setEditing(null);
    await load();
    setSaving(false);
  }

  async function del(item) {
    if (!confirm(`Delete mapping ${item.mapping_id}?`)) return;
    await base44.entities.SKUPrintMapping.delete(item.id);
    await load();
  }

  const filtered = items.filter(i =>
    !search || i.product_code?.toLowerCase().includes(search.toLowerCase()) ||
    i.label_variant_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="w-full pl-9 h-9 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" placeholder="Search by product code…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> New</Button>
      </div>

      {editing === 'new' && (
        <InlineForm
          fields={fields}
          initial={{ mapping_id: genId('MAP'), is_active: true }}
          onSave={save}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : (
        <div className="space-y-2">
          {filtered.map(item => {
            const variant = variants.find(v => v.label_variant_id === item.label_variant_id);
            const ryanTpl = ryanTpls.find(t => t.ryan_template_id === item.ryan_template_id);
            const batchRule = batchRules.find(r => r.rule_id === item.batch_format_rule_id);
            const isComplete = item.label_variant_id && item.ryan_template_id;

            return (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3">
                {editing === item.id ? (
                  <InlineForm fields={fields} initial={item} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono font-bold text-sm text-slate-800">{item.product_code}</p>
                        <Badge ok={item.is_active} />
                        {!isComplete && item.is_active && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Incomplete
                          </span>
                        )}
                        {isComplete && item.is_active && (
                          <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Variant: <span className="font-mono">{item.label_variant_id}</span>{variant?.label_template_name ? ` → ${variant.label_template_name}` : ''}</p>
                      {item.ryan_template_id && <p className="text-xs text-slate-500">Ryan: <span className="font-mono">{item.ryan_template_id}</span>{ryanTpl?.description ? ` — ${ryanTpl.description}` : ''}</p>}
                      {item.batch_format_rule_id && <p className="text-xs text-slate-500">Batch rule: <span className="font-mono">{item.batch_format_rule_id}</span>{batchRule?.description ? ` — ${batchRule.description}` : ''}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditing(item.id)} className="p-1.5 rounded-lg hover:bg-slate-100"><Pencil className="w-4 h-4 text-slate-500" /></button>
                      <button onClick={() => del(item)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No mappings found.</p>}
        </div>
      )}
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function TemplateMappingManager() {
  const [tab, setTab] = useState(0);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Template Mapping</h1>
        <p className="text-sm text-slate-500">Admin — SKU → Label template + Ryan template + Batch format</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 min-w-max text-xs font-semibold px-3 py-2 rounded-lg transition-all ${tab === i ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <MappingsTab />}
      {tab === 1 && <LabelVariantsTab />}
      {tab === 2 && <RyanTemplatesTab />}
      {tab === 3 && <BatchFormatRulesTab />}
    </div>
  );
}