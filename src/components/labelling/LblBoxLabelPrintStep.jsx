import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import BoxLabelCanvas from '@/components/labelling/BoxLabelCanvas';
import { Printer, Loader2, AlertTriangle, Tag } from 'lucide-react';

/**
 * Box Label Print step shown to the operator.
 * Auto-picks the SKU's mapped box_label_template_id (configurable via SKU Setup),
 * but lets operator override. Data is pulled live from the job & SKU.
 */
export default function LblBoxLabelPrintStep({ job, user }) {
  const [overrideId, setOverrideId] = useState(null);
  const [printing, setPrinting] = useState(false);

  const { data: sku } = useQuery({
    queryKey: ['sku-for-job', job.sku_code],
    queryFn: async () => {
      const list = await base44.entities.ProductMaster.filter({ item_code: job.sku_code });
      return list[0] || null;
    },
    enabled: !!job?.sku_code,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['box-label-templates-active'],
    queryFn: () => base44.entities.BoxLabelTemplate.filter({ is_active: true }),
  });

  const activeTemplateId = overrideId || sku?.box_label_template_id;
  const template = useMemo(() => templates.find(t => t.id === activeTemplateId) || null, [templates, activeTemplateId]);

  const previewData = { job: job || {}, sku: sku || {} };

  const handlePrint = async () => {
    if (!template) {
      toast({ title: 'Pick a template first', variant: 'destructive' });
      return;
    }
    setPrinting(true);
    try {
      // Open browser print dialog — simplest reliable path
      window.print();
      toast({ title: 'Print dialog opened' });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-slate-700" />
        <h2 className="text-base font-semibold text-slate-900">Box Label Print</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {!sku?.box_label_template_id && !overrideId && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">No template mapped to this SKU</p>
                <p className="text-xs text-amber-700">Map a Box Label Template to this SKU in SKU Setup, or pick one below for this run.</p>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs font-medium text-slate-700">Template</Label>
            <Select value={activeTemplateId || ''} onValueChange={setOverrideId}>
              <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Pick a template" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.template_name}
                    {sku?.box_label_template_id === t.id && ' (mapped to SKU)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {template && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-center overflow-auto">
              <BoxLabelCanvas
                template={template}
                elements={template.elements || []}
                selectedId={null}
                onSelect={() => {}}
                onUpdateElement={() => {}}
                previewData={previewData}
                readOnly
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button className="h-11 flex-1 md:flex-none gap-2" onClick={handlePrint} disabled={!template || printing}>
              {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Print Box Label
            </Button>
          </div>
        </>
      )}
    </div>
  );
}