import PurchaseReports from '@/components/purchase/PurchaseReports';

export default function PurchaseReportsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase Reports</h1>
        <p className="text-sm text-slate-500">Analytics and insights on purchase operations</p>
      </div>

      <PurchaseReports />
    </div>
  );
}