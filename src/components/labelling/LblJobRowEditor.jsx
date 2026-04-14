import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import LblBatchSelect from '@/components/labelling/LblBatchSelect';
import LblLabelPreviewCard from '@/components/labelling/LblLabelPreviewCard';
import { GripVertical, Trash2, Lock, Unlock } from 'lucide-react';
import moment from 'moment';

const BOTTLES_PER_CASE = 12;

export default function LblJobRowEditor({ index, job, products, planDate, onUpdate, onRemove, dragHandleProps }) {
  const [casesManuallyEdited, setCasesManuallyEdited] = useState(false);

  // Load full product master record for this SKU (shelf life, ml, fssai, templates)
  const { data: productDetails = [] } = useQuery({
    queryKey: ['product-detail-row', job?.sku_code],
    queryFn: () => base44.entities.ProductMaster.filter({ item_code: job.sku_code }),
    enabled: !!job?.sku_code,
  });
  const productMaster = productDetails[0];

  // Load print templates for template selector
  const { data: templates = [] } = useQuery({
    queryKey: ['lbl-print-templates-active'],
    queryFn: () => base44.entities.LblPrintTemplate.filter({ is_active: true }),
    staleTime: 60000,
  });

  const handleProductChange = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      onUpdate(index, 'sku_code', prod.item_code || prod.id);
      onUpdate(index, 'product_name', prod.product_name || prod.item_name || '');
      onUpdate(index, 'bottle_type', prod.bottle_type || prod.container_type || '');
      onUpdate(index, 'mrp', prod.mrp || '');
      // Reset template on product change
      onUpdate(index, 'printer_template_id', '');
    }
  };

  const handleBottlesChange = (value) => {
    const bottles = Number(value) || 0;
    onUpdate(index, 'quantity_bottles_planned', bottles);
    if (!casesManuallyEdited && bottles > 0) {
      onUpdate(index, 'quantity_cases_planned', Math.ceil(bottles / BOTTLES_PER_CASE));
    }
  };

  const handleCasesChange = (value) => {
    setCasesManuallyEdited(true);
    onUpdate(index, 'quantity_cases_planned', Number(value) || 0);
  };

  const toggleCasesLock = () => {
    if (casesManuallyEdited) {
      setCasesManuallyEdited(false);
      const bottles = job.quantity_bottles_planned || 0;
      if (bottles > 0) {
        onUpdate(index, 'quantity_cases_planned', Math.ceil(bottles / BOTTLES_PER_CASE));
      }
    } else {
      setCasesManuallyEdited(true);
    }
  };

  const mfgDateValue = job.manufacturing_date || (planDate ? planDate : '');

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 rounded hover:bg-slate-100">
            <GripVertical className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">Priority #{job.priority_order}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => onRemove(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Row 1: Product, Bottles, Cases */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Product</Label>
          <Select value={job.sku_code ? products.find(p => (p.item_code || p.id) === job.sku_code)?.id || '' : ''} onValueChange={handleProductChange}>
            <SelectTrigger className="h-11 md:h-9"><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.item_code || p.id} — {p.product_name || p.item_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Planned Bottles</Label>
          <Input type="number" value={job.quantity_bottles_planned || ''} onChange={e => handleBottlesChange(e.target.value)} placeholder="0" className="h-11 md:h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Planned Cases</Label>
          <div className="flex gap-1.5 items-center">
            <Input type="number" value={job.quantity_cases_planned || ''} onChange={e => handleCasesChange(e.target.value)} placeholder="0" className={`h-11 md:h-9 flex-1 ${!casesManuallyEdited ? 'bg-slate-50' : ''}`} />
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={toggleCasesLock} title={casesManuallyEdited ? 'Switch to auto-calculate' : 'Edit manually'}>
              {casesManuallyEdited ? <Unlock className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
            </Button>
          </div>
          <p className="text-xs text-slate-500">{casesManuallyEdited ? 'Manual entry' : `Auto: ${BOTTLES_PER_CASE} bottles per case`}</p>
        </div>
      </div>

      {/* Row 2: Manufacturing Date, Batch Number */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Manufacturing Date</Label>
          <Input
            type="date"
            value={mfgDateValue}
            onChange={e => onUpdate(index, 'manufacturing_date', e.target.value)}
            className="h-11 md:h-9"
          />
          <p className="text-xs text-slate-500">Defaults to plan date</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Batch</Label>
          <LblBatchSelect
            value={job.batch_no || ''}
            onChange={(val) => onUpdate(index, 'batch_no', val)}
            skuCode={job.sku_code}
          />
        </div>
      </div>

      {/* Template Selector + MRP override */}
      {job.sku_code && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Print Template</Label>
            <Select
              value={job.printer_template_id || ''}
              onValueChange={v => onUpdate(index, 'printer_template_id', v)}
            >
              <SelectTrigger className="h-11 md:h-9">
                <SelectValue placeholder="Select label template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.middleware_template_name ? `(${t.middleware_template_name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Template used for demo and bulk print</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">MRP (₹)</Label>
            <Input
              type="number"
              value={job.mrp || ''}
              onChange={e => onUpdate(index, 'mrp', e.target.value)}
              placeholder="Auto-filled from product"
              className="h-11 md:h-9"
            />
            <p className="text-xs text-slate-500">
              {productMaster?.ml_per_bottle ? `${productMaster.ml_per_bottle} ml · USP shown in preview below` : 'Auto-filled from product master'}
            </p>
          </div>
        </div>
      )}

      {/* Label Preview Card — MRP, Mfg Date, Expiry (from mfg date + shelf life) set at plan time */}
      {job.sku_code && (
        <LblLabelPreviewCard
          productName={job.product_name}
          batchNo={job.batch_no}
          mrp={job.mrp}
          mlPerBottle={productMaster?.ml_per_bottle}
          mfgDate={job.manufacturing_date ? moment(job.manufacturing_date).format('DD/MM/YYYY') : (planDate ? moment(planDate).format('DD/MM/YYYY') : '')}
          labellingDate={''}
          shelfLifeDays={productMaster?.shelf_life_days}
          fssaiNo={productMaster?.fssai_no}
          bottleType={job.bottle_type}
          templateName={job.printer_template_id
            ? templates.find(t => t.id === job.printer_template_id)?.name
            : productMaster?.label_template_4x6 || ''}
        />
      )}
    </div>
  );
}