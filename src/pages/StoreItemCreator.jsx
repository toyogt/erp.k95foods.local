import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, List, PackagePlus } from 'lucide-react';
import StoreItemForm from '@/components/store/StoreItemForm';
import StoreItemList from '@/components/store/StoreItemList';
import { showSuccessToast } from '@/lib/toastHelpers';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function StoreItemCreator() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const data = await base44.entities.StoreItemMaster.list('-created_date', 500);
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleSaved() {
    showSuccessToast('Item created successfully and added to Store Item Master');
    setShowForm(false);
    load();
  }

  return (
    <motion.div className="pb-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <ToastContainer />
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PackagePlus className="w-6 h-6 text-teal-600" />
              Store Item Creator
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create new items directly into the Store Item Master
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="h-11 gap-2 text-sm bg-teal-600 hover:bg-teal-700"
          >
            {showForm ? (
              <>
                <List className="w-4 h-4" /> View Items
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create New Item
              </>
            )}
          </Button>
        </div>

        {/* Content */}
        {showForm ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 max-w-lg">
            <h2 className="font-bold text-slate-900 text-lg mb-4">New Store Item</h2>
            <StoreItemForm
              onSaved={handleSaved}
              onCancel={() => setShowForm(false)}
            />
          </div>
        ) : (
          <StoreItemList
            items={items}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
          />
        )}
      </div>
    </motion.div>
  );
}