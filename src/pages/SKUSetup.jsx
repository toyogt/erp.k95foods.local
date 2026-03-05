import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, CheckCircle2, AlertTriangle, Plus, Pencil, Copy, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SKUList from '@/components/sku/SKUList';
import SetupChecklist, { isSetupComplete } from '@/components/sku/SetupChecklist';
import PayloadMapBuilder from '@/components/sku/PayloadMapBuilder';
import ArtworkTab from '@/components/sku/ArtworkTab';
import BatchRuleBuilder from '@/components/batch/BatchRuleBuilder';
import BatchRulePreview from '@/components/batch/BatchRulePreview.jsx';

function genId(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase().slice(-5); }

const EMPTY_SKU = {
  item_code: '', product_name: '', brand_name: '', product_family: '', flavour: '',
  ml_per_bottle: '', mrp: '', mrp_box: '', shelf_life_days: '', bottle_type: '',
  recipe_group_id: '', default_recipe_option_id: '', box_type_id: '', bottles_per_box: '',
  batch_prefix: '', default_artwork_id: '', is_active: false,
  fssai_no: '', manufacturer_name: '', address_1: '', address_2: '',
  customer_care_email: '', customer_care_phone: '', product_barcode: '',
};

const EMPTY_MAPPING = {
  ryan_template_id: '', batch_format_rule_id: '',
  batch_date_source: 'MFG_START', sequence_reset_scope: 'DAILY',
  use_batch_prefix_from_sku: false, payload_map_json: '[]',
};

export default function SKUSetup() {
  const [user, setUser] = useState(null);
  const [skus, setSkus] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [recipeGroups, setRecipeGroups] = useState([]);
  const [recipeOptions, setRecipeOptions] = useState([]);
  const [boxTypes, setBoxTypes] = useState([]);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [ryanTemplates, setRyanTemplates] = useState([]);
  const [batchRules, setBatchRules] = useState([]);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null); // full SKU record
  const [skuForm, setSkuForm] = useState(EMPTY_SKU);
  const [mappingForm, setMappingForm] = useState(EMPTY_MAPPING);
  const [payloadRows, setPayloadRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // Batch Rule Builder modal
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [ruleBuilderMode, setRuleBuilderMode] = useState('create'); // 'create' | 'edit' | 'duplicate'
  const [ruleBuilderRule, setRuleBuilderRule] = useState(null);

  const isAdmin = user?.role === 'admin';

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [u, s, m, rg, bt, bx, bo, rt, br, art] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.ProductMaster.list('-created_date', 500),
      base44.entities.SKUPrintMapping.list('-created_date', 500).catch(() => []),
      base44.entities.RecipeGroup.filter({ is_active: true }, '-created_date', 200).catch(() => []),
      base44.entities.BottleType.list('-created_date', 100).catch(() => []),
      base44.entities.BoxType.filter({ is_active: true }, '-created_date', 200).catch(() => []),
      base44.entities.RecipeOption.list('-created_date', 500).catch(() => []),
      base44.entities.RyanTemplate.filter({ is_active: true }, '-created_date', 200).catch(() => []),
      base44.entities.BatchFormatRule.filter({ is_active: true }, '-created_date', 200).catch(() => []),
      base44.entities.LabelArtwork.filter({ is_active: true }, '-created_date', 500).catch(() => []),
    ]);
    setUser(u);
    setSkus(s);
    setMappings(m);
    setRecipeGroups(rg);
    setBottleTypes(bt);
    setBoxTypes(bx);
    setRecipeOptions(bo);
    setRyanTemplates(rt);
    setBatchRules(br);
    setArtworks(art);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, []);

  // Load a SKU into the editor
  const openSku = useCallback((sku) => {
    setSelected(sku);
    setSkuForm({ ...EMPTY_SKU, ...sku });
    const mapping = mappings.find(m => (m.sku_code || m.product_code) === sku.item_code);
    if (mapping) {
      setMappingForm({ ...EMPTY_MAPPING, ...mapping });
      setPayloadRows(mapping.payload_map_json ? JSON.parse(mapping.payload_map_json) : []);
    } else {
      setMappingForm(EMPTY_MAPPING);
      setPayloadRows([]);
    }
  }, [mappings]);

  const openNew = () => {
    setSelected(null);
    setSkuForm(EMPTY_SKU);
    setMappingForm(EMPTY_MAPPING);
    setPayloadRows([]);
  };

  // Re-open when mappings change (after save)
  useEffect(() => {
    if (selected) openSku(selected);
  }, [mappings]);

  // Derive bottles_per_box when box_type_id changes
  const handleBoxTypeChange = (box_type_id) => {
    const bt = boxTypes.find(b => b.box_type_id === box_type_id);
    setSkuForm(f => ({ ...f, box_type_id, bottles_per_box: bt ? bt.bottles_per_box : '' }));
  };

  // Filtered recipe options for selected group
  const filteredOptions = recipeOptions.filter(o => o.recipe_group_id === skuForm.recipe_group_id);

  // Get template placeholders
  const activeTpl = ryanTemplates.find(t => t.ryan_template_id === mappingForm.ryan_template_id);
  const templatePlaceholders = activeTpl?.placeholders_json
    ? (() => { try { return JSON.parse(activeTpl.placeholders_json); } catch { return []; } })()
    : [];

  // Unique brand/family/flavour suggestions from existing SKUs
  const brands = [...new Set(skus.map(s => s.brand_name).filter(Boolean))];
  const families = [...new Set(skus.map(s => s.product_family).filter(Boolean))];
  const flavours = [...new Set(skus.map(s => s.flavour).filter(Boolean))];

  const currentMapping = mappings.find(m => (m.sku_code || m.product_code) === (selected?.item_code));
  const complete = isSetupComplete(skuForm, { ...mappingForm });

  const handleSave = async () => {
    if (!skuForm.item_code?.trim() || !skuForm.product_name?.trim()) {
      alert('SKU Code and SKU Name are required.');
      return;
    }
    if (skuForm.is_active && !complete) {
      alert('Cannot activate: setup is incomplete. Please complete all required fields first.');
      return;
    }

    setSaving(true);
    const bt = boxTypes.find(b => b.box_type_id === skuForm.box_type_id);

    // Build SKU payload
    const skuPayload = { ...skuForm };
    if (bt) skuPayload.bottles_per_box = bt.bottles_per_box;
    ['ml_per_bottle','bottles_per_box','mrp','mrp_box','shelf_life_days'].forEach(k => {
      if (skuPayload[k] !== '' && skuPayload[k] !== undefined && !isNaN(skuPayload[k])) skuPayload[k] = Number(skuPayload[k]);
      else if (skuPayload[k] === '') delete skuPayload[k];
    });

    let savedSku;
    if (selected) {
      await base44.entities.ProductMaster.update(selected.id, skuPayload);
      savedSku = { ...selected, ...skuPayload };
    } else {
      savedSku = await base44.entities.ProductMaster.create(skuPayload);
    }

    // Upsert SKUPrintMapping
    const mappingPayload = {
      ...mappingForm,
      product_code: skuForm.item_code,
      sku_code: skuForm.item_code,
      payload_map_json: JSON.stringify(payloadRows),
      is_active: true,
    };

    if (currentMapping) {
      await base44.entities.SKUPrintMapping.update(currentMapping.id, mappingPayload);
    } else if (mappingForm.ryan_template_id || mappingForm.batch_format_rule_id) {
      await base44.entities.SKUPrintMapping.create({
        ...mappingPayload,
        mapping_id: genId('MAP'),
        label_variant_id: '',
      });
    }

    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2500);
    await loadAll();
    // re-select by item_code
    setTimeout(() => {
      setSkus(prev => {
        const fresh = prev.find(s => s.item_code === skuForm.item_code);
        if (fresh) openSku(fresh);
        return prev;
      });
    }, 500);
  };

  if (loading) return (
    <div className="flex justify-center items-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  );

  const selectedBoxType = boxTypes.find(b => b.box_type_id === skuForm.box_type_id);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Left: SKU List */}
      <div className="lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h1 className="text-base font-bold text-slate-900">SKU Setup</h1>
          <p className="text-xs text-slate-500">End-to-end configuration in one place</p>
        </div>
        <SKUList skus={skus} mappings={mappings} selected={selected} onSelect={openSku} onNew={openNew} />
      </div>

      {/* Right: Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {skuForm.item_code || <span className="text-slate-400 font-normal">New SKU</span>}
              {skuForm.product_name && <span className="font-normal text-slate-500 ml-2">— {skuForm.product_name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savedMsg && <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{savedMsg}</span>}
            <Button className="h-9 gap-2 text-sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Setup checklist */}
          <SetupChecklist sku={skuForm} mapping={mappingForm} />

          {/* Tabs */}
          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="h-9 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="basics" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Basics</TabsTrigger>
              <TabsTrigger value="recipe" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Recipe & Packaging</TabsTrigger>
              <TabsTrigger value="printing" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Printing & Batch</TabsTrigger>
              <TabsTrigger value="artwork" className="rounded-lg text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm px-4">Artwork</TabsTrigger>
            </TabsList>

            {/* ─── Tab 1: Basics ─────────────────────────────── */}
            <TabsContent value="basics" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="SKU Code *">
                  <Input value={skuForm.item_code} onChange={e => setSkuForm(f => ({ ...f, item_code: e.target.value }))} placeholder="e.g. MNG-200-PET" className="text-sm h-9" />
                </Field>
                <Field label="SKU Name *">
                  <Input value={skuForm.product_name} onChange={e => setSkuForm(f => ({ ...f, product_name: e.target.value }))} placeholder="e.g. Mango Drink 200ml" className="text-sm h-9" />
                </Field>

                <Field label="Brand Name">
                  <datalist id="brands-list">{brands.map(b => <option key={b} value={b} />)}</datalist>
                  <Input value={skuForm.brand_name} onChange={e => setSkuForm(f => ({ ...f, brand_name: e.target.value }))} list="brands-list" placeholder="Brand…" className="text-sm h-9" />
                </Field>
                <Field label="Product Family">
                  <datalist id="family-list">{families.map(b => <option key={b} value={b} />)}</datalist>
                  <Input value={skuForm.product_family} onChange={e => setSkuForm(f => ({ ...f, product_family: e.target.value }))} list="family-list" placeholder="e.g. Juice" className="text-sm h-9" />
                </Field>
                <Field label="Flavour">
                  <datalist id="flavour-list">{flavours.map(b => <option key={b} value={b} />)}</datalist>
                  <Input value={skuForm.flavour} onChange={e => setSkuForm(f => ({ ...f, flavour: e.target.value }))} list="flavour-list" placeholder="e.g. Mango" className="text-sm h-9" />
                </Field>
                <Field label="Product Barcode">
                  <Input value={skuForm.product_barcode} onChange={e => setSkuForm(f => ({ ...f, product_barcode: e.target.value }))} className="text-sm h-9" />
                </Field>
                <Field label="MRP per Bottle (₹)">
                  <Input type="number" value={skuForm.mrp} onChange={e => setSkuForm(f => ({ ...f, mrp: e.target.value }))} className="text-sm h-9" />
                </Field>
                <Field label="MRP per Box (₹)">
                  <Input type="number" value={skuForm.mrp_box} onChange={e => setSkuForm(f => ({ ...f, mrp_box: e.target.value }))} className="text-sm h-9" />
                </Field>
                <Field label="ML per Bottle">
                  <Input type="number" value={skuForm.ml_per_bottle} onChange={e => setSkuForm(f => ({ ...f, ml_per_bottle: e.target.value }))} className="text-sm h-9" />
                </Field>
                <Field label="Batch Prefix (optional)">
                  <Input value={skuForm.batch_prefix} onChange={e => setSkuForm(f => ({ ...f, batch_prefix: e.target.value }))} placeholder="e.g. MNG" className="text-sm h-9 font-mono" />
                </Field>

                {/* Active toggle */}
                <Field label="Status" className="sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!skuForm.is_active && !complete) {
                          alert('Cannot activate: setup is incomplete. Fill all required fields first.');
                          return;
                        }
                        setSkuForm(f => ({ ...f, is_active: !f.is_active }));
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${skuForm.is_active ? 'bg-green-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${skuForm.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-sm font-semibold ${skuForm.is_active ? 'text-green-700' : 'text-slate-500'}`}>
                      {skuForm.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {!complete && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Setup incomplete</span>}
                  </div>
                </Field>
              </div>

              {/* Manufacturer details collapsible */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-slate-500 font-semibold select-none hover:text-slate-700">
                  Manufacturer / Label Details ▸
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  {[
                    { k: 'fssai_no', l: 'FSSAI No' },
                    { k: 'manufacturer_name', l: 'Manufacturer Name' },
                    { k: 'address_1', l: 'Address Line 1' },
                    { k: 'address_2', l: 'Address Line 2' },
                    { k: 'customer_care_email', l: 'Care Email' },
                    { k: 'customer_care_phone', l: 'Care Phone' },
                  ].map(({ k, l }) => (
                    <Field key={k} label={l} className={k.includes('address') ? 'sm:col-span-2' : ''}>
                      <Input value={skuForm[k]} onChange={e => setSkuForm(f => ({ ...f, [k]: e.target.value }))} className="text-sm h-9" />
                    </Field>
                  ))}
                </div>
              </details>
            </TabsContent>

            {/* ─── Tab 2: Recipe & Packaging ────────────────── */}
            <TabsContent value="recipe" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Recipe Group */}
                <Field label="Recipe Group *">
                  <SelectInput
                    value={skuForm.recipe_group_id}
                    onChange={v => setSkuForm(f => ({ ...f, recipe_group_id: v, default_recipe_option_id: '' }))}
                    placeholder="— Select recipe group —"
                    options={recipeGroups.map(g => ({ value: g.recipe_group_id, label: g.recipe_name }))}
                    empty="No recipe groups. Add in Recipe Builder first."
                  />
                </Field>

                {/* Default Option */}
                <Field label="Default Recipe Option *">
                  <SelectInput
                    value={skuForm.default_recipe_option_id}
                    onChange={v => setSkuForm(f => ({ ...f, default_recipe_option_id: v }))}
                    placeholder={skuForm.recipe_group_id ? '— Select option —' : '— Select group first —'}
                    options={filteredOptions.map(o => ({ value: o.option_id, label: o.option_name + (o.is_default ? ' (default)' : '') }))}
                    disabled={!skuForm.recipe_group_id}
                    empty="No options for this group."
                  />
                </Field>

                {/* Bottle Type */}
                <Field label="Bottle Type *">
                  {bottleTypes.length > 0 ? (
                    <SelectInput
                      value={skuForm.bottle_type}
                      onChange={v => setSkuForm(f => ({ ...f, bottle_type: v }))}
                      placeholder="— Select bottle type —"
                      options={bottleTypes.map(b => ({ value: b.name, label: b.name }))}
                    />
                  ) : (
                    <Input value={skuForm.bottle_type} onChange={e => setSkuForm(f => ({ ...f, bottle_type: e.target.value }))} placeholder="e.g. PET 200ml" className="text-sm h-9" />
                  )}
                </Field>

                {/* Box Type */}
                <Field label="Box Type *">
                  <SelectInput
                    value={skuForm.box_type_id}
                    onChange={handleBoxTypeChange}
                    placeholder="— Select box type —"
                    options={boxTypes.map(b => ({ value: b.box_type_id, label: `${b.box_name}${b.box_code ? ' (' + b.box_code + ')' : ''} — ${b.bottles_per_box} btls` }))}
                    empty="No box types. Add in Master Data → Box Types first."
                  />
                </Field>

                {/* Box type details */}
                {selectedBoxType && (
                  <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span>📦 <strong>{selectedBoxType.bottles_per_box}</strong> bottles/box</span>
                    {selectedBoxType.length_mm && selectedBoxType.width_mm && selectedBoxType.height_mm &&
                      <span>📐 {selectedBoxType.length_mm} × {selectedBoxType.width_mm} × {selectedBoxType.height_mm} mm</span>}
                    {selectedBoxType.empty_weight_kg && <span>⚖️ {selectedBoxType.empty_weight_kg} kg (empty)</span>}
                  </div>
                )}

                <Field label="Bottles per Box (derived)">
                  <Input value={skuForm.bottles_per_box || ''} readOnly className="text-sm h-9 bg-slate-50 font-bold" placeholder="Set by Box Type" />
                </Field>

                <Field label="Shelf Life (days) *">
                  <Input type="number" value={skuForm.shelf_life_days} onChange={e => setSkuForm(f => ({ ...f, shelf_life_days: e.target.value }))} className="text-sm h-9" placeholder="e.g. 365" />
                </Field>
              </div>
            </TabsContent>

            {/* ─── Tab 3: Printing & Batch ──────────────────── */}
            <TabsContent value="printing" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ryan Template *">
                  <SelectInput
                    value={mappingForm.ryan_template_id}
                    onChange={v => setMappingForm(f => ({ ...f, ryan_template_id: v }))}
                    placeholder="— Select template —"
                    options={ryanTemplates.map(t => ({ value: t.ryan_template_id, label: `${t.ryan_template_id}${t.description ? ' — ' + t.description : ''}` }))}
                    empty="No active Ryan Templates found."
                  />
                </Field>

                <Field label="Batch Format Rule *" className="sm:col-span-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <select
                        value={mappingForm.batch_format_rule_id}
                        onChange={e => setMappingForm(f => ({ ...f, batch_format_rule_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9"
                      >
                        <option value="">— Select rule —</option>
                        {batchRules.map(r => (
                          <option key={r.rule_id} value={r.rule_id}>
                            {r.rule_name || r.description || r.rule_id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => { setRuleBuilderRule(null); setRuleBuilderMode('create'); setRuleBuilderOpen(true); }}
                      className="h-9 px-2 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1 shrink-0"
                      title="Create New Rule"
                    ><Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">New</span></button>
                    {mappingForm.batch_format_rule_id && (() => {
                      const selRule = batchRules.find(r => r.rule_id === mappingForm.batch_format_rule_id);
                      return selRule ? (
                        <>
                          <button
                            onClick={() => { setRuleBuilderRule(selRule); setRuleBuilderMode('edit'); setRuleBuilderOpen(true); }}
                            className="h-9 px-2 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1 shrink-0"
                            title="Edit Rule"
                          ><Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Edit</span></button>
                          <button
                            onClick={() => { setRuleBuilderRule(selRule); setRuleBuilderMode('duplicate'); setRuleBuilderOpen(true); }}
                            className="h-9 px-2 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1 shrink-0"
                            title="Duplicate Rule"
                          ><Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dup</span></button>
                        </>
                      ) : null;
                    })()}
                  </div>
                  {/* Inline preview for selected rule */}
                  {mappingForm.batch_format_rule_id && batchRules.find(r => r.rule_id === mappingForm.batch_format_rule_id) && (
                    <div className="mt-2">
                      <BatchRulePreview
                        rule={batchRules.find(r => r.rule_id === mappingForm.batch_format_rule_id)}
                        sku={skuForm}
                      />
                    </div>
                  )}
                </Field>

                <Field label="Batch Date Source">
                  <SelectInput
                    value={mappingForm.batch_date_source}
                    onChange={v => setMappingForm(f => ({ ...f, batch_date_source: v }))}
                    options={[
                      { value: 'MFG_START', label: 'MFG Start (manufacturing date)' },
                      { value: 'LABEL_START', label: 'Label Start (labelling date)' },
                    ]}
                  />
                </Field>

                <Field label="Sequence Reset Scope">
                  <SelectInput
                    value={mappingForm.sequence_reset_scope}
                    onChange={v => setMappingForm(f => ({ ...f, sequence_reset_scope: v }))}
                    options={[
                      { value: 'DAILY', label: 'Daily' },
                      { value: 'MONTHLY', label: 'Monthly' },
                      { value: 'YEARLY', label: 'Yearly' },
                      { value: 'NEVER', label: 'Never (continuous)' },
                    ]}
                  />
                </Field>

                <Field label="Use Batch Prefix from SKU" className="sm:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setMappingForm(f => ({ ...f, use_batch_prefix_from_sku: !f.use_batch_prefix_from_sku }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${mappingForm.use_batch_prefix_from_sku ? 'bg-blue-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${mappingForm.use_batch_prefix_from_sku ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="text-sm text-slate-700">
                      Prepend <span className="font-mono font-semibold text-blue-700">{skuForm.batch_prefix || '—'}</span> to batch ID
                    </span>
                  </label>
                </Field>
              </div>

              {/* Payload Map Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Ryan Payload Mapping</p>
                  {templatePlaceholders.length > 0 && (
                    <span className="text-xs text-slate-400">Placeholders from template: {templatePlaceholders.join(', ')}</span>
                  )}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <PayloadMapBuilder
                    rows={payloadRows}
                    onChange={setPayloadRows}
                    templatePlaceholders={templatePlaceholders}
                    sku={skuForm}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ─── Tab 4: Artwork ───────────────────────────── */}
            <TabsContent value="artwork" className="mt-4">
              <ArtworkTab
                sku={selected || (skuForm.item_code ? skuForm : null)}
                artworks={artworks}
                onArtworksChanged={loadAll}
                onDefaultChanged={(artworkId) => setSkuForm(f => ({ ...f, default_artwork_id: artworkId }))}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {/* Batch Rule Builder Modal */}
      <Dialog open={ruleBuilderOpen} onOpenChange={setRuleBuilderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ruleBuilderMode === 'create' ? 'Create Batch Format Rule' :
               ruleBuilderMode === 'edit' ? 'Edit Batch Format Rule' :
               'Duplicate Batch Format Rule'}
            </DialogTitle>
          </DialogHeader>
          <BatchRuleBuilder
            rule={ruleBuilderMode === 'create' ? null : ruleBuilderRule}
            saveAsNew={ruleBuilderMode === 'duplicate'}
            skus={skus}
            isAdmin={isAdmin}
            onSaved={async (saved) => {
              setRuleBuilderOpen(false);
              await loadAll();
              // Auto-select saved rule
              setMappingForm(f => ({ ...f, batch_format_rule_id: saved.rule_id }));
            }}
            onCancel={() => setRuleBuilderOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small helper components for cleaner markup
function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function SelectInput({ value, onChange, placeholder, options, empty, disabled }) {
  if (empty && options.length === 0) {
    return <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{empty}</p>;
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}