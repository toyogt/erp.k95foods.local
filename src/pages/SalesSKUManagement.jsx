import { motion } from 'framer-motion';
import SKUManagementTab from '@/components/sales/SKUManagementTab';

export default function SalesSKUManagement() {
  return (
    <motion.div className="p-3 md:p-6 space-y-5 mx-auto pb-32" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div>
        <h1 className="text-xl font-bold text-slate-900">Product (SKU) Management</h1>
        <p className="text-sm text-slate-500">View and edit all product details from a single place</p>
      </div>
      <SKUManagementTab />
    </motion.div>
  );
}