import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import ToyoInvoice from './ToyoInvoice';

export default function InvoiceModal({ open, onClose, invoice, items, order, deliveryNote }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html>
      <head>
        <title>Invoice - ${invoice?.invoice_number || invoice?.so_number || ''}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; background: #fff; color: #000; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #6b7280; padding: 4px 6px; font-size: 10px; }
          strong, .font-bold { font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          em { font-style: italic; }
          @media print {
            body { margin: 0; }
            @page { margin: 8mm; }
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Invoice Preview — {invoice?.invoice_number}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 text-sm gap-1.5">
              <Printer className="w-4 h-4" /> Print / Download
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-4 bg-slate-100">
          <div className="shadow-md">
            <ToyoInvoice
              invoice={invoice}
              items={items}
              order={order}
              deliveryNote={deliveryNote}
              printRef={printRef}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}