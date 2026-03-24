import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { triggerFMSProcess } from '@/lib/useFMSAutoComplete';

export default function ExcelSOImport({ onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  async function handleExcelUpload(file) {
    setProcessing(true);
    setResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          po_number: { type: 'string' },
          customer_name: { type: 'string' },
          platform: { type: 'string' },
          po_date: { type: 'string' },
          po_expiry_date: { type: 'string' },
          po_delivery_date: { type: 'string' },
          payment_terms: { type: 'string' },
          billing_address: { type: 'string' },
          shipping_address: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_code: { type: 'string' },
                description: { type: 'string' },
                hsn_code: { type: 'string' },
                quantity: { type: 'number' },
                mrp: { type: 'number' },
                unit_base_cost: { type: 'number' },
                igst_rate: { type: 'number' },
                total_amount: { type: 'number' },
              }
            }
          },
          total_amount: { type: 'number' },
          tax_amount: { type: 'number' },
          taxable_amount: { type: 'number' },
        }
      }
    });

    if (extracted.status !== 'success' || !extracted.output) {
      toast({ title: 'Could not extract data from Excel', variant: 'destructive' });
      setProcessing(false);
      return;
    }

    const data = extracted.output;
    const soNumber = `SO-${Date.now().toString().slice(-8)}`;

    const so = await base44.entities.SalesOrder.create({
      so_number: soNumber,
      source: 'excel_upload',
      platform: data.platform || 'direct',
      status: 'confirmed',
      customer_name: data.customer_name || 'Unknown',
      po_number: data.po_number || '',
      po_date: data.po_date || '',
      po_expiry_date: data.po_expiry_date || '',
      po_delivery_date: data.po_delivery_date || '',
      payment_terms: data.payment_terms || '',
      billing_address: data.billing_address || '',
      shipping_address: data.shipping_address || '',
      total_amount: data.total_amount || 0,
      tax_amount: data.tax_amount || 0,
      taxable_amount: data.taxable_amount || 0,
    });

    if (data.items?.length) {
      for (const item of data.items) {
        await base44.entities.SalesOrderItem.create({
          ...item,
          sales_order_id: so.id,
          so_number: soNumber,
          stock_status: 'not_checked',
        });
      }
    }

    await base44.entities.SalesAuditLog.create({
      entity_type: 'SalesOrder', entity_id: so.id,
      reference_number: soNumber, action: 'created_from_excel',
      new_value: `${data.items?.length || 0} items`, user_email: user?.email,
    });

    await triggerFMSProcess({
      triggerSource: 'sales_order_created',
      triggerRefId: so.id,
      title: `Sales Order ${soNumber}`,
      triggerData: { so_number: soNumber, customer: data.customer_name },
    });

    setResult({ soNumber, itemCount: data.items?.length || 0, soId: so.id });
    setProcessing(false);
    toast({ title: 'Sales Order created from Excel', description: soNumber });
    if (onCreated) onCreated(so);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-medium">Upload BigBasket / Excel Purchase Order</p>

      {!result && !processing && (
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleExcelUpload(f);
          }}
        >
          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Drag & drop Excel file</p>
          <p className="text-xs text-slate-400 mt-1">.xlsx or .xls — BigBasket format supported</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { if (e.target.files[0]) handleExcelUpload(e.target.files[0]); e.target.value = ''; }} />
        </div>
      )}

      {processing && (
        <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center bg-blue-50">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-sm text-blue-700 font-medium">Processing Excel and creating Sales Order...</p>
          <p className="text-xs text-blue-500 mt-1">AI is mapping data — no preview needed</p>
        </div>
      )}

      {result && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Sales Order Created: {result.soNumber}</p>
            <p className="text-xs text-green-600">{result.itemCount} items imported successfully</p>
          </div>
          <Button variant="outline" className="ml-auto h-9 text-xs"
            onClick={() => window.location.href = `/SalesOrderDetail?id=${result.soId}`}>
            Open Order →
          </Button>
        </div>
      )}
    </div>
  );
}