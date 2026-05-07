import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';

const BUILT_IN_FIELDS = [
  { key: 'id', label: 'id — Record ID' },
  { key: 'created_date', label: 'created_date — Created Date' },
  { key: 'created_by', label: 'created_by — Created By Email' },
];

export default function ParameterMapper({ mappings, examples, entities, triggerEntity, onMappingsChange, onExamplesChange }) {
  // Cache of loaded fields per entity name
  const [fieldCache, setFieldCache] = useState({});

  // Load schema fields for a given entity
  const loadEntityFields = useCallback(async (entityName) => {
    if (!entityName || fieldCache[entityName]) return;
    const entityRef = base44.entities[entityName];
    if (!entityRef || typeof entityRef.schema !== 'function') {
      setFieldCache(prev => ({ ...prev, [entityName]: [...BUILT_IN_FIELDS] }));
      return;
    }
    try {
      const schema = await entityRef.schema();
      const fields = Object.entries(schema.properties || {}).map(([key, val]) => ({
        key,
        label: `${key}${val.description ? ' — ' + val.description : ''}`,
      }));
      setFieldCache(prev => ({ ...prev, [entityName]: [...BUILT_IN_FIELDS, ...fields] }));
    } catch {
      setFieldCache(prev => ({ ...prev, [entityName]: [...BUILT_IN_FIELDS] }));
    }
  }, [fieldCache]);

  // Pre-load fields for all entities referenced in mappings + trigger entity
  useEffect(() => {
    const entitiesToLoad = new Set();
    if (triggerEntity) entitiesToLoad.add(triggerEntity);
    mappings.forEach(m => { if (m.source_entity) entitiesToLoad.add(m.source_entity); });
    entitiesToLoad.forEach(e => loadEntityFields(e));
  }, [mappings, triggerEntity, loadEntityFields]);

  function updateMapping(index, field, value) {
    const updated = mappings.map(m => {
      if (m.index !== index) return m;
      const newMapping = { ...m, [field]: value };
      // When source entity changes, reset source field and load new fields
      if (field === 'source_entity') {
        newMapping.source_field = '';
        if (value) loadEntityFields(value);
      }
      return newMapping;
    });
    onMappingsChange(updated);
  }

  function updateExample(idx, value) {
    const updated = [...examples];
    updated[idx] = value;
    onExamplesChange(updated);
  }

  return (
    <div className="space-y-2">
      {/* Header row — hidden on mobile, shown as table header on desktop */}
      <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-semibold text-slate-600 px-1">
        <div className="col-span-1">Slot</div>
        <div className="col-span-2">Label</div>
        <div className="col-span-2">Source Entity</div>
        <div className="col-span-3">Source Field</div>
        <div className="col-span-2">Fallback Value</div>
        <div className="col-span-2">Example Value *</div>
      </div>

      {mappings.map((m, idx) => {
        const resolvedEntity = m.source_entity || triggerEntity || '';
        const fieldsForRow = fieldCache[resolvedEntity] || [];

        return (
          <div key={m.index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start md:items-center border border-slate-100 md:border-0 rounded-lg md:rounded-none p-2 md:p-0">
            {/* Slot */}
            <div className="md:col-span-1 flex items-center gap-2">
              <span className="text-xs text-slate-500 md:hidden font-medium">Slot:</span>
              <span className="text-sm font-mono font-bold text-slate-500">{`{{${m.index}}}`}</span>
            </div>

            {/* Label */}
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 md:hidden mb-0.5 block">Label</label>
              <Input
                className="h-8 text-xs"
                value={m.label}
                onChange={e => updateMapping(m.index, 'label', e.target.value)}
                placeholder="Recipient Name"
              />
            </div>

            {/* Source Entity */}
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 md:hidden mb-0.5 block">Source Entity</label>
              <select
                className="w-full border border-slate-200 rounded-md px-2 h-8 text-xs bg-white"
                value={resolvedEntity}
                onChange={e => updateMapping(m.index, 'source_entity', e.target.value)}
              >
                <option value="">— Select —</option>
                {entities.map(ent => <option key={ent.name} value={ent.name}>{ent.label}</option>)}
              </select>
            </div>

            {/* Source Field */}
            <div className="md:col-span-3">
              <label className="text-xs text-slate-500 md:hidden mb-0.5 block">Source Field</label>
              {fieldsForRow.length > 0 ? (
                <select
                  className="w-full border border-slate-200 rounded-md px-2 h-8 text-xs bg-white"
                  value={m.source_field}
                  onChange={e => updateMapping(m.index, 'source_field', e.target.value)}
                >
                  <option value="">— Select Field —</option>
                  {fieldsForRow.map(f => <option key={f.key} value={f.key}>{f.key}</option>)}
                </select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  value={m.source_field}
                  onChange={e => updateMapping(m.index, 'source_field', e.target.value)}
                  placeholder="field_name"
                />
              )}
            </div>

            {/* Fallback */}
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 md:hidden mb-0.5 block">Fallback</label>
              <Input
                className="h-8 text-xs"
                value={m.fallback_value}
                onChange={e => updateMapping(m.index, 'fallback_value', e.target.value)}
                placeholder="Default if empty"
              />
            </div>

            {/* Example */}
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500 md:hidden mb-0.5 block">Example *</label>
              <Input
                className="h-8 text-xs border-orange-200"
                value={examples[idx] || ''}
                onChange={e => updateExample(idx, e.target.value)}
                placeholder="Example"
              />
            </div>
          </div>
        );
      })}

      {mappings.length === 0 && (
        <p className="text-xs text-slate-400 py-3 text-center">No parameters detected in body text. Use {'{{1}}'}, {'{{2}}'} etc.</p>
      )}
    </div>
  );
}