/**
 * LblBoxLabelAgentPrintModal
 * Picks a workstation whose printer matches the template label size,
 * generates a PDF from the rendered label HTML, uploads it, and submits
 * via printSubmitJob — no browser print dialog.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Printer, Wifi, WifiOff, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { deriveSizeCode, sizeMatches } from '@/lib/boxLabelSizeCode';
import { resolveElementValue } from '@/lib/boxLabelHelpers';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/**
 * Build a self-contained HTML document for the label, sized exactly to the template.
 * This is rendered off-screen, captured by html2canvas, then placed into a jsPDF page.
 */
function buildLabelHtml(template, data) {
  const unit = template.page_unit === 'inch' ? 'in' : 'mm';
  const w = template.page_width;
  const h = template.page_height;

  const body = (template.elements || []).map(el => {
    const style = [
      'position:absolute',
      `left:${el.x}${unit}`,
      `top:${el.y}${unit}`,
      `width:${el.width}${unit}`,
      `height:${el.height}${unit}`,
      `transform:rotate(${el.rotation || 0}deg)`,
      'box-sizing:border-box',
      'overflow:hidden',
      `color:${el.color || '#000'}`,
    ].join(';');
    const value = resolveElementValue(el, data) || '';

    if (el.type === 'text') {
      const textStyle = [
        `font-size:${el.font_size || 10}pt`,
        `font-weight:${el.font_weight || 'normal'}`,
        `text-align:${el.text_align || 'left'}`,
        'line-height:1.15',
        'padding:1px',
        'white-space:pre-wrap',
        'word-break:break-word',
      ].join(';');
      return `<div style="${style}"><div style="${textStyle}">${escapeHtml(value)}</div></div>`;
    }
    if (el.type === 'image' && el.image_url) {
      return `<div style="${style}"><img src="${el.image_url}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain"/></div>`;
    }
    if (el.type === 'barcode') {
      const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=${encodeURIComponent((el.barcode_type || 'code128').toLowerCase())}&text=${encodeURIComponent(value || ' ')}&scale=2&includetext&textxalign=center`;
      return `<div style="${style}"><img src="${barcodeUrl}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:contain"/></div>`;
    }
    return '';
  }).join('\n');

  return { body, w, h, unit };
}

/**
 * Render the label off-screen, capture as canvas, build a PDF sized to the template.
 * Returns a Blob (application/pdf).
 */
async function renderLabelToPdfBlob(template, data) {
  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  const { body, w, h, unit } = buildLabelHtml(template, data);

  // Off-screen container
  const wrap = document.createElement('div');
  wrap.style.position = 'fixed';
  wrap.style.left = '-10000px';
  wrap.style.top = '0';
  wrap.style.background = '#fff';
  wrap.innerHTML = `
    <div id="lbl-print-sheet" style="position:relative;width:${w}${unit};height:${h}${unit};background:#fff;font-family:Arial,Helvetica,sans-serif;color:#000;">
      ${body}
    </div>`;
  document.body.appendChild(wrap);

  try {
    // Wait a tick for images (barcodes, logos) to load
    const sheet = wrap.querySelector('#lbl-print-sheet');
    const imgs = Array.from(sheet.querySelectorAll('img'));
    await Promise.all(imgs.map(img => img.complete ? null : new Promise(res => {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    })));

    const canvas = await html2canvas(sheet, { scale: 3, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    const pdfUnit = unit === 'in' ? 'in' : 'mm';
    const orientation = w >= h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: pdfUnit, format: [w, h] });
    pdf.addImage(imgData, 'PNG', 0, 0, w, h);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrap);
  }
}

export default function LblBoxLabelAgentPrintModal({ open, onOpenChange, template, data, onPrinted }) {
  const sizeInfo = useMemo(() => deriveSizeCode(template), [template]);

  // Auto-calc number of boxes = stock transfer bottles / bottles per box (ceil).
  // Editable by operator if needed.
  const computedBoxes = useMemo(() => {
    const bottles = Number(data?.job?.stock_transfer_qty) || 0;
    const perBox = Number(data?.sku?.bottles_per_box) || 0;
    if (!bottles || !perBox) return 1;
    return Math.max(1, Math.ceil(bottles / perBox));
  }, [data]);

  const [copies, setCopies] = useState(computedBoxes);
  const [selectedWid, setSelectedWid] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset copies whenever the modal opens or the computed value changes
  useMemo(() => { if (open) setCopies(computedBoxes); }, [open, computedBoxes]);

  // Fetch live discovery — force a real-time probe (refresh: true) so we don't
  // rely on a stale cache. A workstation only counts as "active" if its agent
  // responded right now AND is reporting at least one matching printer.
  const { data: discovery, isLoading: loadingDiscovery, refetch, isFetching } = useQuery({
    queryKey: ['print-discovery-for-box-label'],
    queryFn: async () => {
      const res = await base44.functions.invoke('printDiscoveryLive', { refresh: true });
      return res.data || {};
    },
    enabled: open,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Keep only printers whose size matches the template AND whose workstation
  // is verified online by the latest probe (probe_ok === true). Stale cache
  // entries with probe_ok=false are filtered out.
  const eligible = useMemo(() => {
    const printers = Array.isArray(discovery?.rows)
      ? discovery.rows
      : Array.isArray(discovery?.printers) ? discovery.printers : [];
    const matched = printers.filter(p =>
      p.probe_ok === true &&
      p.printer_name &&
      sizeMatches(p.size_code, sizeInfo.aliases)
    );
    // Dedupe by workstation display name (case-insensitive) so the same physical
    // workstation registered under multiple ids shows once.
    const map = new Map();
    for (const p of matched) {
      const key = (p.display_name || p.workstation_name || p.workstation_id || '').trim().toLowerCase();
      if (!map.has(key)) map.set(key, p);
    }
    return Array.from(map.values());
  }, [discovery, sizeInfo]);

  const handleDownloadPdf = async () => {
    if (!Number(copies) || Number(copies) < 1) {
      toast({ title: 'Copies must be at least 1', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const blob = await renderLabelToPdfBlob(template, data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `box-label-${data?.job?.batch_no || 'label'}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({
        title: 'PDF downloaded',
        description: `Open the file and print ${copies} cop${copies === 1 ? 'y' : 'ies'} manually.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Failed to generate PDF', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedWid) {
      toast({ title: 'Pick a workstation', variant: 'destructive' });
      return;
    }
    if (!Number(copies) || Number(copies) < 1) {
      toast({ title: 'Copies must be at least 1', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Render label → PDF blob
      const blob = await renderLabelToPdfBlob(template, data);
      const fileName = `box-label-${data?.job?.batch_no || 'label'}-${Date.now()}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // 2. Upload PDF to get a public URL the agent can fetch
      const upload = await base44.integrations.Core.UploadFile({ file });
      const file_url = upload?.file_url;
      if (!file_url) throw new Error('PDF upload failed');

      // 3. Submit via Print Management
      const submit = await base44.functions.invoke('printSubmitJob', {
        source_type: 'url',
        source_value: file_url,
        label_size: sizeInfo.primary,
        copies: Number(copies),
        preferred_workstation_id: selectedWid,
      });

      const resp = submit?.data || {};
      if (!resp.ok) {
        const reason = resp.error?.body?.error || resp.error?.error || resp.error || resp.status || 'submission failed';
        toast({ title: 'Print routing failed', description: typeof reason === 'string' ? reason : JSON.stringify(reason), variant: 'destructive' });
        return;
      }
      toast({
        title: 'Sent to printer',
        description: `Job ${resp.erp_job_id} → ${resp.selected?.printer} on ${resp.selected?.workstation_id}`,
      });
      onPrinted?.(resp);
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Print failed', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" /> Send Box Label to Printer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <div>Template: <span className="font-medium text-slate-900">{template?.template_name}</span></div>
            <div>Size: <span className="font-mono text-slate-900">{sizeInfo.primary || '—'}</span> ({template?.page_width}×{template?.page_height} {template?.page_unit})</div>
            <div>Batch: <span className="font-mono text-slate-900">{data?.job?.batch_no || '—'}</span></div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Number of Boxes (Copies)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={200}
                value={copies}
                onChange={e => setCopies(e.target.value)}
                className="h-11 md:h-9 w-32"
              />
              {copies !== computedBoxes && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => setCopies(computedBoxes)}
                >
                  Reset to {computedBoxes}
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {Number(data?.job?.stock_transfer_qty) || 0} bottles ÷ {Number(data?.sku?.bottles_per_box) || 0} bottles/box = <span className="font-semibold text-slate-700">{computedBoxes}</span> box{computedBoxes === 1 ? '' : 'es'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-700">Eligible Workstations (matching size {sizeInfo.primary})</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()} disabled={loadingDiscovery || isFetching}>
                {(loadingDiscovery || isFetching) ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            {loadingDiscovery ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : eligible.length === 0 ? (
              <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800">
                    No active workstation has a printer matching size <span className="font-mono font-semibold">{sizeInfo.primary}</span>.
                    You can download the PDF and print it manually from any printer.
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-11 md:h-9 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 gap-2"
                  onClick={handleDownloadPdf}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF for Manual Printing
                </Button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {eligible.map(p => {
                  const selected = selectedWid === p.workstation_id;
                  const ok = p.probe_ok !== false;
                  return (
                    <button
                      type="button"
                      key={p.workstation_id}
                      onClick={() => setSelectedWid(p.workstation_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors ${selected ? 'bg-slate-900/5' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {ok ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {p.display_name || p.workstation_name || p.workstation_id}
                        </div>
                      </div>
                      {selected && <CheckCircle2 className="w-5 h-5 text-slate-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button className="h-11 md:h-9 gap-2" onClick={handleSubmit} disabled={submitting || !selectedWid || eligible.length === 0}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Send to Printer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}