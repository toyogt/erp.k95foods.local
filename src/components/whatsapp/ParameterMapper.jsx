import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';

const BUILT_IN_FIELDS = [
  { key: 'id', label: 'id — Record ID' },
  { key: 'created_date', label: 'created_date — Created Date' },
  { key: 'created_by', label: 'created_by — Created By Email' },
  { key: 'updated_date', label: 'updated_date — Updated Date' },
];

// Hardcoded fallback fields — always available even if schema() fails
const FALLBACK_FIELDS = {
  DirectorTask: [
    ...BUILT_IN_FIELDS,
    { key: 'task_number', label: 'task_number — Auto-generated task number' },
    { key: 'task_name', label: 'task_name — Title of the task' },
    { key: 'task_details', label: 'task_details — Detailed description' },
    { key: 'task_type', label: 'task_type — single or project' },
    { key: 'project_id', label: 'project_id — Parent Project ID' },
    { key: 'project_name', label: 'project_name — Project name' },
    { key: 'assigned_to_email', label: 'assigned_to_email — Assignee email' },
    { key: 'assigned_to_name', label: 'assigned_to_name — Assignee name' },
    { key: 'assigned_by_email', label: 'assigned_by_email — Assigner email' },
    { key: 'assigned_by_name', label: 'assigned_by_name — Assigner name' },
    { key: 'director_email', label: 'director_email — Director email' },
    { key: 'director_name', label: 'director_name — Director name' },
    { key: 'is_important', label: 'is_important — Important flag' },
    { key: 'start_date', label: 'start_date — Start date DD/MM/YYYY' },
    { key: 'start_time', label: 'start_time — Start time HH:MM' },
    { key: 'end_date', label: 'end_date — End date DD/MM/YYYY' },
    { key: 'end_time', label: 'end_time — End time HH:MM' },
    { key: 'status', label: 'status — Task status' },
    { key: 'completed_at', label: 'completed_at — Completion timestamp' },
    { key: 'completed_by_email', label: 'completed_by_email — Completed by' },
    { key: 'verified_at', label: 'verified_at — Verification timestamp' },
    { key: 'verified_by_email', label: 'verified_by_email — Verified by' },
    { key: 'verified_by_name', label: 'verified_by_name — Verified by name' },
    { key: 'date_change_reason', label: 'date_change_reason — Date change reason' },
    { key: 'requested_new_date', label: 'requested_new_date — Requested new date' },
    { key: 'requested_new_time', label: 'requested_new_time — Requested new time' },
    { key: 'notification_time', label: 'notification_time — Notification time' },
    { key: 'overdue_notified', label: 'overdue_notified — Overdue notification sent' },
    { key: 'ea_emails', label: 'ea_emails — Executive Assistant emails' },
    { key: 'progress_note', label: 'progress_note — Latest progress update' },
    { key: 'progress_updated_at', label: 'progress_updated_at — Progress update time' },
    { key: 'predecessor_task_ids', label: 'predecessor_task_ids — Predecessor task IDs' },
    { key: 'predecessor_task_numbers', label: 'predecessor_task_numbers — Predecessor numbers' },
  ],
  User: [
    ...BUILT_IN_FIELDS,
    { key: 'full_name', label: 'full_name — User full name' },
    { key: 'email', label: 'email — User email' },
    { key: 'role', label: 'role — User role' },
  ],
  PurchaseOrder: [
    ...BUILT_IN_FIELDS,
    { key: 'po_id', label: 'po_id — Purchase Order ID' },
    { key: 'supplier_id', label: 'supplier_id — Supplier ID' },
    { key: 'supplier_name', label: 'supplier_name — Supplier name' },
    { key: 'po_date', label: 'po_date — Order date' },
    { key: 'due_date', label: 'due_date — Due date' },
    { key: 'status', label: 'status — Order status' },
    { key: 'total_amount', label: 'total_amount — Total amount' },
  ],
  GRNHeader: [
    ...BUILT_IN_FIELDS,
    { key: 'grn_id', label: 'grn_id — Goods Receipt Note ID' },
    { key: 'supplier_name', label: 'supplier_name — Supplier name' },
    { key: 'invoice_number', label: 'invoice_number — Invoice number' },
    { key: 'status', label: 'status — Status' },
    { key: 'received_by', label: 'received_by — Received by' },
  ],
  SalesOrder: [
    ...BUILT_IN_FIELDS,
    { key: 'so_number', label: 'so_number — Sales Order number' },
    { key: 'customer_name', label: 'customer_name — Customer name' },
    { key: 'status', label: 'status — Order status' },
    { key: 'total_amount', label: 'total_amount — Total amount' },
  ],
  PaymentRequest: [
    ...BUILT_IN_FIELDS,
    { key: 'payreq_id', label: 'payreq_id — Payment Request ID' },
    { key: 'supplier_name', label: 'supplier_name — Supplier name' },
    { key: 'requested_amount', label: 'requested_amount — Requested amount' },
    { key: 'status', label: 'status — Request status' },
  ],
  SupplierInvoice: [
    ...BUILT_IN_FIELDS,
    { key: 'inv_id', label: 'inv_id — Invoice ID' },
    { key: 'supplier_name', label: 'supplier_name — Supplier name' },
    { key: 'invoice_number', label: 'invoice_number — Invoice number' },
    { key: 'invoice_amount', label: 'invoice_amount — Invoice amount' },
    { key: 'status', label: 'status — Invoice status' },
  ],
};

function getFieldsForEntity(entityName, fieldCache) {
  if (!entityName) return [];
  if (fieldCache[entityName] && fieldCache[entityName].length > 0) return fieldCache[entityName];
  return FALLBACK_FIELDS[entityName] || [];
}

export default function ParameterMapper({ mappings, examples, entities, triggerEntity, onMappingsChange, onExamplesChange }) {
  const [fieldCache, setFieldCache] = useState({});
  const loadingRef = useRef(new Set());

  // Load schema fields for entities used in mappings
  useEffect(() => {
    const entitiesToLoad = new Set();
    if (triggerEntity) entitiesToLoad.add(triggerEntity);
    mappings.forEach(m => { if (m.source_entity) entitiesToLoad.add(m.source_entity); });

    entitiesToLoad.forEach(entityName => {
      if (fieldCache[entityName] || loadingRef.current.has(entityName)) return;
      loadingRef.current.add(entityName);

      const entityRef = base44.entities[entityName];
      if (!entityRef || typeof entityRef.schema !== 'function') {
        const fb = FALLBACK_FIELDS[entityName] || [...BUILT_IN_FIELDS];
        setFieldCache(prev => ({ ...prev, [entityName]: fb }));
        loadingRef.current.delete(entityName);
        return;
      }

      entityRef.schema()
        .then(schema => {
          const fields = Object.entries(schema.properties || {}).map(([key, val]) => ({
            key,
            label: `${key}${val.description ? ' — ' + val.description : ''}`,
          }));
          setFieldCache(prev => ({ ...prev, [entityName]: [...BUILT_IN_FIELDS, ...fields] }));
        })
        .catch(() => {
          const fb = FALLBACK_FIELDS[entityName] || [...BUILT_IN_FIELDS];
          setFieldCache(prev => ({ ...prev, [entityName]: fb }));
        })
        .finally(() => loadingRef.current.delete(entityName));
    });
  }, [mappings, triggerEntity]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateMapping(index, field, value) {
    const updated = mappings.map(m => {
      if (m.index !== index) return m;
      const newMapping = { ...m, [field]: value };
      if (field === 'source_entity') {
        newMapping.source_field = '';
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
        const fieldsForRow = getFieldsForEntity(resolvedEntity, fieldCache);

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

            {/* Source Field — always show select, use fallback fields if cache not ready */}
            <div className="md:col-span-3">
              <label className="text-xs text-slate-500 md:hidden mb-0.5 block">Source Field</label>
              {fieldsForRow.length > 0 ? (
                <select
                  className="w-full border border-slate-200 rounded-md px-2 h-8 text-xs bg-white"
                  value={m.source_field}
                  onChange={e => updateMapping(m.index, 'source_field', e.target.value)}
                >
                  <option value="">— Select Field —</option>
                  {fieldsForRow.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
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