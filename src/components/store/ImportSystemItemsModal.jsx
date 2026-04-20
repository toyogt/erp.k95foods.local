import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImportRulesTable from '@/components/store/ImportRulesTable';
import { Loader2, Search, Download, CheckCircle2, X, ArrowLeft, ArrowRight, Settings2 } from 'lucide-react';

const SOURCE_TABS = [
  { key: 'ingredient', label: 'Ingredients' },
  { key: 'box_type', label: 'Box Types' },
  { key: 'cap_type', label: 'Caps' },
  { key: 'container', label: 'Containers' },
  { key: 'flavour', label: 'Flavours' },
  { key: 'label_artwork', label: 'Label Artworks' },
];

async function fetchSystemItems() {
  const [ingredientItems, ingredientMasters, boxes, caps, containers, flavours, artworks] = await Promise.all([
    base44.entities.IngredientItem.list('brand_name', 500).catch(() => []),
    base44.entities.IngredientMaster.list('ingredient_name', 500).catch(() => []),
    base44.entities.BoxType.list('box_name', 500).catch(() => []),
    base44.entities.CapType.list('cap_name', 500).catch(() => []),
    base44.entities.ContainerType.list('auto_generated_name', 500).catch(() => []),
    base44.entities.FlavourMaster.list('flavour_name', 500).catch(() => []),
    base44.entities.LabelArtwork.list('artwork_name', 500).catch(() => []),
  ]);

  // Combine IngredientItem (brand items) and IngredientMaster (specs)
  const ingredientRows = [];

  // Brand-level items
  ingredientItems.filter(i => i.brand_name).forEach(i => {
    ingredientRows.push({
      source_entity: 'IngredientItem', source_id: i.id,
      item_name: `${i.brand_name}${i.ingredient_id ? ' (' + i.ingredient_id + ')' : ''}`,
      item_category: 'ingredient', uom: i.uom || 'Kg', material_photo: '',
    });
  });

  // Spec-level masters
  ingredientMasters.filter(m => m.ingredient_name && m.is_active !== false).forEach(m => {
    ingredientRows.push({
      source_entity: 'IngredientMaster', source_id: m.id,
      item_name: `${m.ingredient_name}${m.short_code ? ' (' + m.short_code + ')' : ''}`,
      item_code: m.ingredient_id || m.short_code || '',
      item_category: 'ingredient', uom: m.uom_id || 'Kg', material_photo: '',
    });
  });

  return [
    ...ingredientRows,
    ...boxes.map(b => ({
      source_entity: 'BoxType', source_id: b.id,
      item_name: b.box_name,
      item_code: b.box_type_id || b.box_code || '',
      item_category: 'box_type', uom: 'Nos', material_photo: '',
    })),
    ...caps.map(c => ({
      source_entity: 'CapType', source_id: c.id,
      item_name: c.cap_name,
      item_code: c.cap_sku_code || '',
      item_category: 'cap_type', uom: 'Nos', material_photo: c.cap_photo_url || '',
    })),
    ...containers.map(c => ({
      source_entity: 'ContainerType', source_id: c.id,
      item_name: c.auto_generated_name,
      item_code: c.container_code || '',
      item_category: 'container', uom: 'Nos', material_photo: '',
    })),
    ...flavours.map(f => ({
      source_entity: 'FlavourMaster', source_id: f.id,
      item_name: `${f.flavour_name} (${f.brand_name} - ${f.family_name})`,
      item_category: 'flavour', uom: 'Ltr', material_photo: '',
    })),
    ...artworks.map(a => ({
      source_entity: 'LabelArtwork', source_id: a.id,
      item_name: a.artwork_name,
      item_code: a.artwork_id || '',
      item_category: 'label_artwork', uom: 'Nos', material_photo: a.preview_url || '',
    })),
  ];
}

export default function ImportSystemItemsModal({ existingItems, onClose, onImported }) {
  const [loading, setLoading] = useState(true);
  const [systemItems, setSystemItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ingredient');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState('select'); // 'select' | 'rules' | 'done'
  const [rulesMap, setRulesMap] = useState({}); // idx -> { batch_required, expiry_required, ... }

  // Build set of already-imported source IDs
  const existingSourceIds = new Set(
    existingItems.filter(e => e.source_id).map(e => `${e.source_entity}:${e.source_id}`)
  );

  useEffect(() => {
    fetchSystemItems().then(items => {
      setSystemItems(items);
      setLoading(false);
    });
  }, []);

  const filtered = systemItems.filter(si => {
    if (si.item_category !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return si.item_name?.toLowerCase().includes(q) || si.item_code?.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (idx) => {
    const globalIdx = systemItems.indexOf(filtered[idx]);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(globalIdx)) next.delete(globalIdx); else next.add(globalIdx);
      return next;
    });
  };

  const toggleAll = () => {
    const filteredIndices = filtered.map(fi => systemItems.indexOf(fi)).filter(idx => {
      const si = systemItems[idx];
      return !existingSourceIds.has(`${si.source_entity}:${si.source_id}`);
    });
    const allSelected = filteredIndices.every(idx => selected.has(idx));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        filteredIndices.forEach(idx => next.delete(idx));
      } else {
        filteredIndices.forEach(idx => next.add(idx));
      }
      return next;
    });
  };

  // Items selected for import (used in rules step)
  const selectedItems = [...selected].map(idx => systemItems[idx]).filter(Boolean);

  function handleToggleRule(idx, ruleKey, forceOn) {
    setRulesMap(prev => {
      const current = prev[idx] || {};
      return { ...prev, [idx]: { ...current, [ruleKey]: forceOn || !current[ruleKey] } };
    });
  }

  function handleChangeShelfLife(idx, val) {
    setRulesMap(prev => {
      const current = prev[idx] || {};
      return { ...prev, [idx]: { ...current, min_shelf_life_days: val ? Number(val) : 0 } };
    });
  }

  function handleProceedToRules() {
    if (selected.size === 0) return;
    // Initialize rulesMap for selected items
    const initialRules = {};
    selectedItems.forEach((_, idx) => {
      if (!rulesMap[idx]) initialRules[idx] = {};
    });
    setRulesMap(prev => ({ ...initialRules, ...prev }));
    setStep('rules');
  }

  async function handleImport() {
    if (selectedItems.length === 0) return;
    setImporting(true);

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < selectedItems.length; i++) {
      const si = selectedItems[i];
      const key = `${si.source_entity}:${si.source_id}`;
      if (existingSourceIds.has(key)) {
        skipped++;
        continue;
      }

      // Generate AI item code for each item
      let itemCode = si.item_code || '';
      if (!itemCode) {
        const codeRes = await base44.functions.invoke('generateItemCode', {
          item_name: si.item_name,
          item_category: si.item_category,
        });
        itemCode = codeRes.data.item_code || '';
      }

      const rules = rulesMap[i] || {};
      await base44.entities.StoreItemMaster.create({
        item_name: si.item_name,
        item_code: itemCode,
        item_category: si.item_category,
        source_entity: si.source_entity,
        source_id: si.source_id,
        uom: si.uom || 'Nos',
        material_photo: si.material_photo || '',
        is_active: true,
        batch_required: !!rules.batch_required,
        mfg_date_required: !!rules.mfg_date_required,
        expiry_required: !!rules.expiry_required,
        qc_required: !!rules.qc_required,
        min_shelf_life_days: rules.min_shelf_life_days || 0,
      });
      imported++;
    }

    setResult({ imported, skipped });
    setStep('done');
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3 md:p-4">
      <div className={`bg-white rounded-2xl w-full shadow-xl max-h-[90vh] flex flex-col ${step === 'rules' ? 'max-w-4xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Import from System Masters</h2>
            <p className="text-xs text-slate-500 mt-0.5">Select items from existing system data to add to Store Item Master</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'done' && result ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Import Complete</h3>
            <p className="text-sm text-slate-600">
              {result.imported} item(s) imported successfully.
              {result.skipped > 0 && ` ${result.skipped} item(s) skipped (already exists).`}
            </p>
            <Button onClick={() => { onImported(); onClose(); }} className="h-11 bg-slate-900">
              Done
            </Button>
          </div>
        ) : step === 'rules' ? (
          <>
            {/* Step indicator */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Step 2 of 2</span>
                <span>Configure rules for {selectedItems.length} item(s)</span>
              </div>
            </div>

            {/* Rules table */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <ImportRulesTable
                items={selectedItems}
                rulesMap={rulesMap}
                onToggleRule={handleToggleRule}
                onChangeShelfLife={handleChangeShelfLife}
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <Button variant="outline" onClick={() => setStep('select')} className="h-11 gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Selection
              </Button>
              <Button onClick={handleImport} disabled={importing} className="h-11 bg-teal-600 hover:bg-teal-700 gap-2 text-sm">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {importing ? 'Importing...' : `Import ${selectedItems.length} Item(s)`}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200 px-4 shrink-0">
              {SOURCE_TABS.map(tab => {
                const count = systemItems.filter(si => si.item_category === tab.key).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label} <span className="text-xs text-slate-400 ml-1">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="px-4 pt-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input className="pl-9 h-9" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No items found in this category.</div>
              ) : (
                <div className="space-y-1">
                  {/* Select all */}
                  <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer border-b border-slate-100 mb-1">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={filtered.filter(fi => !existingSourceIds.has(`${fi.source_entity}:${fi.source_id}`)).every(fi => selected.has(systemItems.indexOf(fi)))}
                      onChange={toggleAll}
                    />
                    <span className="text-xs font-semibold text-slate-500 uppercase">Select All</span>
                  </label>

                  {filtered.map((si, idx) => {
                    const globalIdx = systemItems.indexOf(si);
                    const alreadyExists = existingSourceIds.has(`${si.source_entity}:${si.source_id}`);

                    return (
                      <label
                        key={globalIdx}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer ${
                          alreadyExists ? 'opacity-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded"
                          checked={selected.has(globalIdx)}
                          onChange={() => toggleSelect(idx)}
                          disabled={alreadyExists}
                        />
                        {si.material_photo ? (
                          <img src={si.material_photo} alt="" className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{si.item_name}</p>
                          <p className="text-xs text-slate-400">
                            {si.item_code && `${si.item_code} · `}{si.source_entity} · {si.uom}
                          </p>
                        </div>
                        {alreadyExists && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Already Added</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-sm text-slate-500">{selected.size} item(s) selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="h-11">Cancel</Button>
                <Button onClick={handleProceedToRules} disabled={selected.size === 0} className="h-11 bg-teal-600 hover:bg-teal-700 gap-2">
                  <Settings2 className="w-4 h-4" /> Configure Rules
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}