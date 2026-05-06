import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Upload, X, FileText } from 'lucide-react';
import { genPRNumber, logPurchaseAudit, DEPARTMENTS } from './purchaseHelpers';
import { triggerFMSProcess } from '@/lib/useFMSAutoComplete';
import PRItemRowEnhanced from './PRItemRowEnhanced';

const EMPTY_ITEM = {
  item_code: '', item_name: '', description: '', quantity: '',
  unit: '', estimated_rate: '', sample_image: '', remarks: '',
};

export default function PRCreateForm({ user, onDone, onCancel, isHindi, t }) {
  const translate = t || ((k) => k);
  const [title, setTitle] = useState(user?.full_name || '');
  const [department, setDepartment] = useState('');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [overallRemarks, setOverallRemarks] = useState('');
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [supportingDocs, setSupportingDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.ItemMaster.filter({ is_active: true }, 'item_name', 500).catch(() => []),
      base44.entities.StoreItemMaster.filter({ is_active: true }, 'item_name', 500).catch(() => []),
    ]).then(([masterItems, storeItems]) => {
      const merged = [...masterItems];
      const existingCodes = new Set(masterItems.map(i => i.item_code).filter(Boolean));
      const existingNames = new Set(masterItems.map(i => i.item_name?.toLowerCase()).filter(Boolean));
      storeItems.forEach(si => {
        if (si.item_code && existingCodes.has(si.item_code)) return;
        if (si.item_name && existingNames.has(si.item_name.toLowerCase())) return;
        merged.push({ ...si, item_code: si.item_code || si.item_name, category: si.item_category || 'store' });
      });
      setIngredients(merged);
    });
    base44.entities.UOMMaster.list('uom_name', 200).then(setUoms).catch(() => {});
  }, []);

  function updateItem(index, updates) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, ...updates } : it));
  }
  function removeItem(index) { setItems(prev => prev.filter((_, i) => i !== index)); }
  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]); }

  async function handleDocUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setSupportingDocs(prev => [...prev, { name: file.name, url: file_url }]);
    setUploading(false);
  }
  function removeDoc(index) { setSupportingDocs(prev => prev.filter((_, i) => i !== index)); }

  const validItems = items.filter(it => it.item_name?.trim() && Number(it.quantity) > 0 && it.unit?.trim());

  function validate() {
    const errs = {};
    if (!title.trim()) errs.title = 'Requester name is required';
    if (!department) errs.department = 'Department is required';
    if (!requiredByDate) errs.requiredByDate = 'Required by date is required';
    if (validItems.length === 0) errs.items = 'At least one valid item is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    const prNumber = genPRNumber();
    const today = new Date().toISOString().split('T')[0];

    const pr = await base44.entities.PurchaseRequest.create({
      pr_number: prNumber, title, department,
      request_date: today, required_by_date: requiredByDate || null,
      priority, status: 'Pending Approval',
      requested_by: user?.email || '', requested_by_name: user?.full_name || '',
      overall_remarks: overallRemarks,
      supporting_documents: supportingDocs.map(d => d.url),
      mr_id: prNumber,
    });

    await Promise.all(validItems.map((it, i) =>
      base44.entities.PurchaseRequestItem.create({
        pr_number: prNumber, mr_id: prNumber, line_number: i + 1,
        item_code: it.item_code || '', item_name: it.item_name,
        description: it.description || '', quantity: Number(it.quantity), qty: Number(it.quantity),
        unit: it.unit || '', uom_code: it.unit || '',
        estimated_rate: it.estimated_rate ? Number(it.estimated_rate) : null,
        sample_image: it.sample_image || '', remarks: it.remarks || '',
        item_status: 'Pending', required_by: requiredByDate || '',
      })
    ));

    await logPurchaseAudit({ action: `Purchase Request ${prNumber} created`, entity_type: 'PurchaseRequest', entity_id: prNumber, user });
    await triggerFMSProcess({ triggerSource: 'purchase_request_created', triggerRefId: pr.id, title: `Purchase Request ${prNumber} — ${title}`, triggerData: { pr_number: prNumber, department, requested_by: user?.email || '' } });

    setLoading(false);
    onDone();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-700">{translate('Requester Name / On Whose Behalf')} *</label>
          <input className={`w-full border rounded-xl px-3 h-11 md:h-9 text-sm bg-white mt-1 ${errors.title ? 'border-red-300' : 'border-slate-200'}`}
            placeholder="e.g., Rajesh Kumar — Production Department" value={title} onChange={e => setTitle(e.target.value)} />
          {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">{translate('Department')} *</label>
          <select className={`w-full border rounded-xl px-3 h-11 md:h-9 text-sm bg-white mt-1 ${errors.department ? 'border-red-300' : 'border-slate-200'}`}
            value={department} onChange={e => setDepartment(e.target.value)}>
            <option value="">{translate('Select Department')}</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.department && <p className="text-xs text-red-500 mt-0.5">{errors.department}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">{translate('Required By Date')} *</label>
          <input type="date" className={`w-full border rounded-xl px-3 h-11 md:h-9 text-sm bg-white mt-1 ${errors.requiredByDate ? 'border-red-300' : 'border-slate-200'}`}
            min={new Date().toISOString().split('T')[0]} value={requiredByDate} onChange={e => setRequiredByDate(e.target.value)} />
          {errors.requiredByDate && <p className="text-xs text-red-500 mt-0.5">{errors.requiredByDate}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">{translate('Priority')}</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 h-11 md:h-9 text-sm bg-white mt-1" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-700">{translate('Date of Request')}</label>
          <input className="w-full border border-slate-200 rounded-lg px-3 h-11 md:h-9 text-sm bg-white mt-1 text-slate-500" value={new Date().toLocaleDateString('en-GB')} disabled />
          <p className="text-xs text-slate-500 mt-0.5">{translate('Auto-filled')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Line Items {errors.items && <span className="text-red-500 font-normal text-xs ml-2">{errors.items}</span>}</p>
        {items.map((it, idx) => (
          <PRItemRowEnhanced key={idx} item={it} index={idx} ingredients={ingredients} uoms={uoms}
            onUpdate={updates => updateItem(idx, updates)} onRemove={() => removeItem(idx)} canRemove={items.length > 1} />
        ))}
        <button onClick={addItem} className="text-sm text-blue-600 font-medium flex items-center gap-1"><Plus className="w-4 h-4" /> Add Item</button>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700">Overall Remarks</label>
        <textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 resize-none" value={overallRemarks} onChange={e => setOverallRemarks(e.target.value)} placeholder="Optional remarks" />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-700">Supporting Documents</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {supportingDocs.map((doc, i) => (
            <div key={i} className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 text-xs">
              <FileText className="w-3 h-3" /><span className="truncate max-w-[120px]">{doc.name}</span>
              <button onClick={() => removeDoc(i)} className="text-red-400"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <label className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 cursor-pointer hover:bg-slate-50">
            <Upload className="w-3 h-3" />{uploading ? 'Uploading...' : 'Upload'}
            <input type="file" className="hidden" onChange={handleDocUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-11">Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-11 bg-green-600 hover:bg-green-700">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          {loading ? 'Submitting...' : 'Submit Purchase Request'}
        </Button>
      </div>
    </div>
  );
}