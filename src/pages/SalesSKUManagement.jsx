import SKUManagementTab from '@/components/sales/SKUManagementTab';

export default function SalesSKUManagement() {
  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto pb-32">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Product (SKU) Management</h1>
        <p className="text-sm text-slate-500">View and edit all product details from a single place</p>
      </div>
      <SKUManagementTab />
    </div>
  );
}