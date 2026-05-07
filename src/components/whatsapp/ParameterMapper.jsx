import { Input } from '@/components/ui/input';

export default function ParameterMapper({ mappings, examples, entityFields, entities, triggerEntity, onMappingsChange, onExamplesChange }) {

  function updateMapping(index, field, value) {
    const updated = mappings.map(m => m.index === index ? { ...m, [field]: value } : m);
    onMappingsChange(updated);
  }

  function updateExample(idx, value) {
    const updated = [...examples];
    updated[idx] = value;
    onExamplesChange(updated);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-600 px-1">
        <div className="col-span-1">Slot</div>
        <div className="col-span-2">Label</div>
        <div className="col-span-2">Source Entity</div>
        <div className="col-span-3">Source Field</div>
        <div className="col-span-2">Fallback Value</div>
        <div className="col-span-2">Example Value *</div>
      </div>

      {mappings.map((m, idx) => (
        <div key={m.index} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-1">
            <span className="text-sm font-mono font-bold text-slate-500">{`{{${m.index}}}`}</span>
          </div>
          <div className="col-span-2">
            <Input
              className="h-8 text-xs"
              value={m.label}
              onChange={e => updateMapping(m.index, 'label', e.target.value)}
              placeholder="Recipient Name"
            />
          </div>
          <div className="col-span-2">
            <select
              className="w-full border border-slate-200 rounded-md px-2 h-8 text-xs bg-white"
              value={m.source_entity || triggerEntity || ''}
              onChange={e => updateMapping(m.index, 'source_entity', e.target.value)}
            >
              <option value="">— Select —</option>
              {entities.map(ent => <option key={ent.name} value={ent.name}>{ent.label}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            {entityFields.length > 0 && (m.source_entity || triggerEntity) ? (
              <select
                className="w-full border border-slate-200 rounded-md px-2 h-8 text-xs bg-white"
                value={m.source_field}
                onChange={e => updateMapping(m.index, 'source_field', e.target.value)}
              >
                <option value="">— Select Field —</option>
                {entityFields.map(f => <option key={f.key} value={f.key}>{f.key}</option>)}
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
          <div className="col-span-2">
            <Input
              className="h-8 text-xs"
              value={m.fallback_value}
              onChange={e => updateMapping(m.index, 'fallback_value', e.target.value)}
              placeholder="Default if empty"
            />
          </div>
          <div className="col-span-2">
            <Input
              className="h-8 text-xs border-orange-200"
              value={examples[idx] || ''}
              onChange={e => updateExample(idx, e.target.value)}
              placeholder="Example"
            />
          </div>
        </div>
      ))}

      {mappings.length === 0 && (
        <p className="text-xs text-slate-400 py-3 text-center">No parameters detected in body text. Use {'{{1}}'}, {'{{2}}'} etc.</p>
      )}
    </div>
  );
}