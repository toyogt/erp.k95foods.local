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
  ml_per_bottle: '', mrp: '', mrp_box: '', shelf_life_days: '', shelf_life_unit: 'days', bottle_type: '',
  recipe_group_id: '', default_recipe_option_id: '', box_type_id: '', bottles_per_box: '',
  batch_prefix: '', default_artwork_id: '', is_active: false, is_trial_pack: false,
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
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [flavours, setFlavours] = useState([]);
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
    const [u, s, m, rg, bt, bx, bo, rt, br, art, brnd, fam, flav] = await Promise.all([
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
      base44.entities.BrandMaster.filter({ is_active: true }).catch(() => []),
      base44.entities.ProductFamilyMaster.filter({ is_active: true }).catch(() => []),
      base44.entities.FlavourMaster.filter({ is_active: true }).catch(() => []),
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
    setBrands(brnd);
    setFamilies(fam);
    setFlavours(flav);
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

  // Auto-fill ML when bottle type changes
  const handleBottleTypeChange = (bottle_type) => {
    // Extract ML from bottle type name (e.g. "PET 200ml" -> 200)
    const mlMatch = bottle_type.match(/(\d+)\s*ml/i);
    const ml = mlMatch ? mlMatch[1] : '';
    setSkuForm(f => ({ ...f, bottle_type, ml_per_bottle: ml || f.ml_per_bottle }));
  };

  // Auto-calculate MRP per box when MRP or bottles change
  useEffect(() => {
    const mrp = parseFloat(skuForm.mrp);
    const bottles = parseInt(skuForm.bottles_per_box);
    if (!isNaN(mrp) && !isNaN(bottles) && bottles > 0) {
      const mrpBox = (mrp * bottles).toFixed(2);
      setSkuForm(f => ({ ...f, mrp_box: mrpBox }));
    }
  }, [skuForm.mrp, skuForm.bottles_per_box]);

  // Auto-generate SKU code and name when all required fields are filled
  useEffect(() => {
    if (!selected && skuForm.brand_name && skuForm.product_family && skuForm.flavour && 
        skuForm.ml_per_bottle && skuForm.bottles_per_box && skuForm.mrp) {
      const brand = brands.find(b => b.brand_name === skuForm.brand_name);
      const family = families.find(f => f.family_name === skuForm.product_family);
      const flavour = flavours.find(f => f.flavour_name === skuForm.flavour);
      const brandCode = brand?.short_code || skuForm.brand_name.substring(0, 3).toUpperCase();
      const familyCode = family?.short_code || skuForm.product_family.substring(0, 3).toUpperCase();
      const flavourCode = flavour?.short_code || skuForm.flavour.substring(0, 3).toUpperCase();
      const ml = skuForm.ml_per_bottle;
      const bottles = skuForm.bottles_per_box;
      const mrp = Math.round(skuForm.mrp);
      const autoCode = `${brandCode}-${familyCode}-${flavourCode}-${ml}ML-${bottles}X${mrp}`;
      const autoName = `${skuForm.brand_name} ${skuForm.product_family} ${skuForm.flavour} ${ml}ml - Pack of ${bottles}`;
      setSkuForm(f => ({ ...f, item_code: autoCode, product_name: autoName }));
    }
  }, [skuForm.brand_name, skuForm.product_family, skuForm.flavour, skuForm.ml_per_bottle, skuForm.bottles_per_box, skuForm.mrp, selected, brands, families, flavours]);

  // Filtered recipe options for selected group
  const filteredOptions = recipeOptions.filter(o => o.recipe_group_id === skuForm.recipe_group_id);

  // Get template placeholders
  const activeTpl = ryanTemplates.find(t => t.ryan_template_id === mappingForm.ryan_template_id);
  const templatePlaceholders = activeTpl?.placeholders_json
    ? (() => { try { return JSON.parse(activeTpl.placeholders_json); } catch { return []; } })()
    : [];

  // Cascading filters
  const availableFamilies = skuForm.brand_name 
    ? families.filter(f => f.brand_name === skuForm.brand_name)
    : [];
  const availableFlavours = skuForm.brand_name && skuForm.product_family
    ? flavours.filter(f => f.brand_name === skuForm.brand_name && f.family_name === skuForm.product_family)
    : [];

  const currentMapping = mappings.find(m => (m.sku_code || m.product_code) === (selected?.item_code));
  const complete = isSetupComplete(skuForm, { ...mappingForm });

  const handleSave = async () => {
    if (!skuForm.item_code?.trim() || !skuForm.product_name?.trim()) {
      alert('SKU Code and SKU Name are required.');
      return;
    }
    
    // Check for duplicate SKU code
    const duplicateCode = skus.find(s => s.item_code === skuForm.item_code && s.id !== selected?.id);
    if (duplicateCode) {
      alert(`SKU Code "${skuForm.item_code}" already exists. Please use a different code.`);
      return;
    }
    
    // Check for duplicate SKU name
    const duplicateName = skus.find(s => s.product_name === skuForm.product_name && s.id !== selected?.id);
    if (duplicateName) {
      alert(`SKU Name "${skuForm.product_name}" already exists. Please use a different name.`);
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
            <TabsContent value="basics" className="mt-4 space-y-5">
              {/* SKU Type selector */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-700 mb-3">SKU Type</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSkuForm(f => ({ ...f, is_trial_pack: false }))}
                    className={`h-14 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      !skuForm.is_trial_pack 
                        ? 'border-slate-700 bg-slate-700 text-white shadow-md' 
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <span className="text-xl">📦</span>
                    <span>Regular SKU</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkuForm(f => ({ ...f, is_trial_pack: true }))}
                    className={`h-14 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      skuForm.is_trial_pack 
                        ? 'border-purple-600 bg-purple-600 text-white shadow-md' 
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <span className="text-xl">🧪</span>
                    <span>Trial Pack</span>
                  </button>
                </div>
                {skuForm.is_trial_pack && (
                  <p className="text-xs text-purple-700 mt-3 bg-white/50 rounded-lg px-3 py-2">
                    Trial packs consume other SKUs as components. Recipe, bottle type, and artwork not required.
                  </p>
                )}
              </div>

              {/* Basic Info */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-bold text-slate-700">📋 Basic Information</p>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="SKU Code *" className="col-span-1">
                    <Input 
                      value={skuForm.item_code} 
                      readOnly 
                      placeholder="Auto-generated after filling all fields" 
                      className="h-12 text-base font-mono bg-slate-50" 
                    />
                    <p className="text-xs text-slate-400 mt-1">Auto-generated from brand, family, flavour, ML, pack size & MRP</p>
                  </Field>
                  <Field label="SKU Name *" className="col-span-1">
                    <Input 
                      value={skuForm.product_name} 
                      readOnly 
                      placeholder="Auto-generated after filling all fields" 
                      className="h-12 text-base bg-slate-50" 
                    />
                    <p className="text-xs text-slate-400 mt-1">Auto-generated including pack size</p>
                  </Field>
                </div>
              </div>

              {/* Product Classification */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-bold text-slate-700">🏷️ Product Classification</p>
                <div className="grid grid-cols-1 gap-4">

                  <Field label="Brand Name *">
                    <select 
                      value={skuForm.brand_name} 
                      onChange={e => setSkuForm(f => ({ ...f, brand_name: e.target.value, product_family: '', flavour: '' }))}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white"
                    >
                      <option value="">— Select Brand —</option>
                      {brands.map(b => <option key={b.id} value={b.brand_name}>{b.brand_name}</option>)}
                    </select>
                  </Field>

                  <Field label="Product Family *">
                    <select 
                      value={skuForm.product_family} 
                      onChange={e => setSkuForm(f => ({ ...f, product_family: e.target.value, flavour: '' }))}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white disabled:bg-slate-50"
                      disabled={!skuForm.brand_name}
                    >
                      <option value="">— Select Family —</option>
                      {availableFamilies.map(f => <option key={f.id} value={f.family_name}>{f.family_name}</option>)}
                    </select>
                    {skuForm.brand_name && availableFamilies.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ No families for "{skuForm.brand_name}" — add in Product Taxonomy
                      </p>
                    )}
                  </Field>

                  <Field label="Flavour *">
                    <select 
                      value={skuForm.flavour} 
                      onChange={e => setSkuForm(f => ({ ...f, flavour: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white disabled:bg-slate-50"
                      disabled={!skuForm.product_family}
                    >
                      <option value="">— Select Flavour —</option>
                      {availableFlavours.map(f => <option key={f.id} value={f.flavour_name}>{f.flavour_name}</option>)}
                    </select>
                    {skuForm.product_family && availableFlavours.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ No flavours for "{skuForm.product_family}" — add in Product Taxonomy
                      </p>
                    )}
                  </Field>
                </div>
              </div>

              {/* Packaging */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-bold text-slate-700">📦 Packaging Configuration</p>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Bottle Type *">
                    {bottleTypes.length > 0 ? (
                      <select
                        value={skuForm.bottle_type}
                        onChange={e => handleBottleTypeChange(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white"
                      >
                        <option value="">— Select Bottle Type —</option>
                        {bottleTypes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                    ) : (
                      <Input value={skuForm.bottle_type} onChange={e => handleBottleTypeChange(e.target.value)} placeholder="e.g. PET 200ml" className="h-11 text-base" />
                    )}
                  </Field>



                  <Field label="Box Type *">
                    <select
                      value={skuForm.box_type_id}
                      onChange={e => handleBoxTypeChange(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white"
                    >
                      <option value="">— Select Box Type —</option>
                      {boxTypes.map(b => (
                        <option key={b.box_type_id} value={b.box_type_id}>
                          {b.box_name} — {b.bottles_per_box} bottles/box
                        </option>
                      ))}
                    </select>
                    {boxTypes.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        No box types — add in Box Types page first
                      </p>
                    )}
                  </Field>

                  {selectedBoxType && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <div className="flex flex-wrap gap-4 text-sm text-blue-900">
                        <span>📦 <strong>{selectedBoxType.bottles_per_box}</strong> bottles/box</span>
                        {selectedBoxType.length_mm && (
                          <span>📐 {selectedBoxType.length_mm} × {selectedBoxType.width_mm} × {selectedBoxType.height_mm} mm</span>
                        )}
                        {selectedBoxType.empty_weight_kg && <span>⚖️ {selectedBoxType.empty_weight_kg} kg</span>}
                      </div>
                    </div>
                  )}

                  <Field label="Shelf Life *">
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="text" 
                        inputMode="numeric" 
                        value={skuForm.shelf_life_days} 
                        onChange={e => setSkuForm(f => ({ ...f, shelf_life_days: e.target.value.replace(/[^0-9]/g, '') }))} 
                        placeholder="12" 
                        className="h-12 text-base" 
                      />
                      <select
                        value={skuForm.shelf_life_unit || 'days'}
                        onChange={e => setSkuForm(f => ({ ...f, shelf_life_unit: e.target.value }))}
                        className="h-12 border border-slate-200 rounded-lg px-3 text-base bg-white"
                      >
                        <option value="days">Days</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                  </Field>
                </div>
              </div>

              {/* Pricing & Specs */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                <p className="text-sm font-bold text-slate-700">💰 Pricing & Specifications</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Product Barcode">
                    <Input value={skuForm.product_barcode} onChange={e => setSkuForm(f => ({ ...f, product_barcode: e.target.value }))} placeholder="8901234567890" className="h-12 text-base font-mono" />
                  </Field>
                  <Field label="MRP per Bottle (₹) *">
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      value={skuForm.mrp} 
                      onChange={e => setSkuForm(f => ({ ...f, mrp: e.target.value.replace(/[^0-9.]/g, '') }))} 
                      placeholder="25" 
                      className="h-12 text-base" 
                    />
                  </Field>
                  <Field label="MRP per Box (₹)">
                    <Input 
                      type="text" 
                      inputMode="decimal" 
                      value={skuForm.mrp_box} 
                      readOnly 
                      placeholder="Auto-calculated" 
                      className="h-12 text-base bg-slate-50" 
                    />
                    <p className="text-xs text-slate-400 mt-1">Auto-calculated from MRP × bottles</p>
                  </Field>
                </div>
              </div>

              {/* Batch Prefix */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <Field label="Batch Prefix (optional)">
                  <Input value={skuForm.batch_prefix} onChange={e => setSkuForm(f => ({ ...f, batch_prefix: e.target.value.toUpperCase() }))} placeholder="e.g. TYK" className="h-11 text-base font-mono tracking-wider" />
                  <p className="text-xs text-slate-500 mt-1">Used for batch code generation</p>
                </Field>
              </div>

              {/* Status toggle */}
              <div className={`border rounded-xl p-4 ${skuForm.is_active ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-bold text-slate-700 mb-3">Status</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!skuForm.is_active && !complete && !skuForm.is_trial_pack) {
                        alert('Cannot activate: setup is incomplete. Fill all required fields first.');
                        return;
                      }
                      setSkuForm(f => ({ ...f, is_active: !f.is_active }));
                    }}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${skuForm.is_active ? 'bg-green-600' : 'bg-slate-400'}`}
                  >
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${skuForm.is_active ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                  <div>
                    <span className={`text-base font-bold block ${skuForm.is_active ? 'text-green-700' : 'text-slate-600'}`}>
                      {skuForm.is_active ? '✓ Active' : 'Inactive'}
                    </span>
                    {!skuForm.is_trial_pack && !complete && (
                      <span className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3" />Setup incomplete — complete all required fields
                      </span>
                    )}
                  </div>
                </div>
              </div>


            </TabsContent>

            {/* ─── Tab 2: Recipe & Packaging ────────────────── */}
            <TabsContent value="recipe" className="mt-4 space-y-5">
              {/* Recipe - Hide for trial packs */}
              {!skuForm.is_trial_pack && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                  <p className="text-sm font-bold text-slate-700">🧪 Recipe Configuration</p>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Recipe Group *">
                      <select
                        value={skuForm.recipe_group_id}
                        onChange={e => setSkuForm(f => ({ ...f, recipe_group_id: e.target.value, default_recipe_option_id: '' }))}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white"
                      >
                        <option value="">— Select Recipe Group —</option>
                        {recipeGroups.map(g => <option key={g.recipe_group_id} value={g.recipe_group_id}>{g.recipe_name}</option>)}
                      </select>
                      {recipeGroups.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          No recipe groups — add in Recipe Builder first
                        </p>
                      )}
                    </Field>

                    <Field label="Default Recipe Option *">
                      <select
                        value={skuForm.default_recipe_option_id}
                        onChange={e => setSkuForm(f => ({ ...f, default_recipe_option_id: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-4 py-3 text-base h-12 bg-white disabled:bg-slate-50"
                        disabled={!skuForm.recipe_group_id}
                      >
                        <option value="">— Select Option —</option>
                        {filteredOptions.map(o => (
                          <option key={o.option_id} value={o.option_id}>
                            {o.option_name}{o.is_default ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
              {skuForm.is_trial_pack && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-sm text-purple-700">Recipe not required for trial packs</p>
                </div>
              )}


            </TabsContent>

            {/* ─── Tab 3: Printing & Batch ──────────────────── */}
            <TabsContent value="printing" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Ryan Template *" className="sm:col-span-2">
                  <RyanTemplateField
                    value={mappingForm.ryan_template_id}
                    onChange={v => setMappingForm(f => ({ ...f, ryan_template_id: v }))}
                    templates={ryanTemplates}
                    templatePlaceholders={templatePlaceholders}
                    activeTpl={activeTpl}
                    isAdmin={isAdmin}
                    onTemplateUpdated={loadAll}
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
                 <p className="text-sm font-semibold text-slate-700">Ryan Payload Mapping</p>
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

/**
 * Ryan Template selector with inline placeholder editor when placeholders_json is empty.
 */
function RyanTemplateField({ value, onChange, templates, templatePlaceholders, activeTpl, isAdmin, onTemplateUpdated }) {
  const [showAddPlaceholders, setShowAddPlaceholders] = useState(false);
  const [chipInput, setChipInput] = useState('');
  const [chips, setChips] = useState([]);
  const [saving, setSaving] = useState(false);

  // When template changes, reset
  useEffect(() => {
    setShowAddPlaceholders(false);
    setChips([]);
    setChipInput('');
  }, [value]);

  function addChip(raw) {
    const val = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!val || chips.includes(val)) { setChipInput(''); return; }
    setChips(prev => [...prev, val]);
    setChipInput('');
  }

  async function savePlaceholders() {
    if (!activeTpl || chips.length === 0) return;
    setSaving(true);
    await base44.entities.RyanTemplate.update(activeTpl.id, {
      placeholders_json: JSON.stringify(chips),
    });
    setSaving(false);
    setShowAddPlaceholders(false);
    onTemplateUpdated && onTemplateUpdated();
  }

  const noPlaceholders = value && activeTpl && templatePlaceholders.length === 0;

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white h-9"
      >
        <option value="">— Select template —</option>
        {templates.map(t => (
          <option key={t.ryan_template_id} value={t.ryan_template_id}>
            {t.ryan_template_id}{t.description ? ` — ${t.description}` : ''}
          </option>
        ))}
      </select>

      {/* Show placeholders chips */}
      {value && templatePlaceholders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-400">Placeholders:</span>
          {templatePlaceholders.map(p => (
            <span key={p} className="bg-blue-50 text-blue-700 font-mono text-xs px-2 py-0.5 rounded-md font-semibold">{p}</span>
          ))}
        </div>
      )}

      {/* Warning + inline editor when no placeholders */}
      {noPlaceholders && !showAddPlaceholders && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 flex-1">No placeholders configured for this template.</p>
          {isAdmin && (
            <button
              onClick={() => { setChips([]); setShowAddPlaceholders(true); }}
              className="text-xs text-amber-700 font-semibold underline shrink-0"
            >Add now</button>
          )}
        </div>
      )}

      {noPlaceholders && showAddPlaceholders && isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Add placeholders for <span className="font-mono">{value}</span></p>
          <div
            className="min-h-[36px] flex flex-wrap gap-1.5 items-center border border-amber-300 rounded-lg px-2 py-1.5 bg-white cursor-text"
            onClick={() => document.getElementById('inline-chip-input')?.focus()}
          >
            {chips.map(p => (
              <span key={p} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md">
                {p}
                <button type="button" onClick={(e) => { e.stopPropagation(); setChips(prev => prev.filter(c => c !== p)); }}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              id="inline-chip-input"
              value={chipInput}
              onChange={e => setChipInput(e.target.value.toUpperCase())}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addChip(chipInput); }
                else if (e.key === 'Backspace' && chipInput === '' && chips.length > 0) setChips(prev => prev.slice(0, -1));
              }}
              onBlur={() => chipInput && addChip(chipInput)}
              className="flex-1 min-w-[80px] outline-none text-xs font-mono bg-transparent"
              placeholder="BATCH, MFG …"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={savePlaceholders} disabled={saving || chips.length === 0} className="h-7 text-xs">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Placeholders'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddPlaceholders(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      )}
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