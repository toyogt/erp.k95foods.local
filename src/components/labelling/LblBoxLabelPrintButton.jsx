/**
 * LblBoxLabelPrintButton
 * Renders a "Print Box Label" action for a labelling job.
 * - Fetches the SKU's mapped BoxLabelTemplate (ProductMaster.box_label_template_id)
 * - Merges live job + SKU data into the template fields
 * - Opens a workstation picker (LblBoxLabelAgentPrintModal) which renders
 *   the label to PDF and submits it to the chosen agent via printSubmitJob.
 *   No browser print dialog is used.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Printer, Loader2 } from 'lucide-react';
import LblBoxLabelAgentPrintModal from '@/components/labelling/LblBoxLabelAgentPrintModal';
import moment from 'moment';

function buildPreviewData(job, sku, boxType, overrides = {}) {
  // Compute expiry from MFG + shelf life
  let expiry = '';
  if (job?.manufacturing_date && sku?.shelf_life_days) {
    const m = moment(job.manufacturing_date, ['DD/MM/YYYY', 'YYYY-MM-DD']);
    if (m.isValid()) {
      const unit = sku.shelf_life_unit || 'months';
      expiry = m.add(Number(sku.shelf_life_days), unit).format('DD/MM/YYYY');
    }
  }

  // Compute gross weight of the full box:
  //   (bottles per box × filled bottle weight) + empty box weight
  // Falls back to sku.gross_weight_kg if components are missing.
  let grossWeight = '';
  const bottlesPerBox = Number(sku?.bottles_per_box) || 0;
  const bottleWeightKg = Number(sku?.filled_bottle_weight_kg) || 0;
  const boxEmptyKg = Number(boxType?.empty_weight_kg) || 0;
  if (bottlesPerBox && bottleWeightKg) {
    grossWeight = (bottlesPerBox * bottleWeightKg + boxEmptyKg).toFixed(2) + ' Kg';
  } else if (sku?.gross_weight_kg) {
    grossWeight = Number(sku.gross_weight_kg).toFixed(2) + ' Kg';
  }

  const fullAddress = [sku?.address_1, sku?.address_2].filter(Boolean).join(', ');

  return {
    job: {
      ...job,
      batch_no: overrides.batch_no || job?.batch_no || '',
      manufacturing_date: job?.manufacturing_date || '',
      expiry_date: expiry,
      stock_transfer_qty: overrides.stock_transfer_qty ?? job?.stock_transfer_qty ?? job?.quantity_bottles_planned ?? '',
    },
    sku: sku || {},
    computed: {
      gross_weight: grossWeight,
      full_address: fullAddress,
    },
  };
}

export default function LblBoxLabelPrintButton({ job, overrides, size = 'md', variant = 'outline', className = '' }) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [resolved, setResolved] = useState(null); // { template, data }

  const { data: productList = [] } = useQuery({
    queryKey: ['pm-box-label', job?.sku_code],
    queryFn: () => base44.entities.ProductMaster.filter({ item_code: job?.sku_code }),
    enabled: !!job?.sku_code,
  });
  const sku = productList[0];
  const templateId = sku?.box_label_template_id;

  const handleClick = async () => {
    if (!sku) {
      toast({ title: 'Product not found', description: 'Cannot find product master for this job.', variant: 'destructive' });
      return;
    }
    if (!templateId) {
      toast({ title: 'No Box Label Template', description: 'Map a Box Label Template to this product in SKU Setup → Printing & Batch.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const [template, boxTypes] = await Promise.all([
      base44.entities.BoxLabelTemplate.get(templateId).catch(() => null),
      sku.box_type_id
        ? base44.entities.BoxType.filter({ box_type_id: sku.box_type_id }).catch(() => [])
        : Promise.resolve([]),
    ]);
    setLoading(false);
    if (!template) {
      toast({ title: 'Template not found', description: 'The mapped Box Label Template is missing or inactive.', variant: 'destructive' });
      return;
    }
    const data = buildPreviewData(job, sku, boxTypes[0], overrides);
    setResolved({ template, data });
    setModalOpen(true);
  };

  const heightCls = size === 'sm' ? 'h-9' : 'h-11';

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        variant={variant}
        className={`${heightCls} gap-2 ${className}`}
        type="button"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        Print Box Label
        {!templateId && sku && <span className="text-xs text-amber-600 ml-1">(no template)</span>}
      </Button>

      {resolved && (
        <LblBoxLabelAgentPrintModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          template={resolved.template}
          data={resolved.data}
        />
      )}
    </>
  );
}