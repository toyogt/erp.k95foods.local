import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Search, Edit2, Power } from 'lucide-react';
import ItemMasterForm from '@/components/master/ItemMasterForm';

export default function ItemMasterManager() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await base44.entities.ItemMaster.list('-created_date', 500);
      setItems(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleCreate() {
    setEditItem(null);
    setShowForm(true);
  }

  function handleEdit(item) {
    setEditItem(item);
    setShowForm(true);
  }

  function handleFormDone() {
    setShowForm(false);
    setEditItem(null);
    loadItems();
  }

  async function toggleActive(item) {
    if (!confirm(`${item.is_active ? 'Deactivate' : 'Activate'} ${item.item_name}?`)) return;
    try {
      await base44.entities.ItemMaster.update(item.id, { is_active: !item.is_active });
      loadItems();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (showForm) {
    return <ItemMasterForm user={user} item={editItem} onDone={handleFormDone} onCancel={() => setShowForm(false)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Item Master</h1>
          <p className="text-sm text-slate-500">Unified registry for all purchasable items</p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 h-11">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-11 px-4 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="ALL">All Categories</option>
            <option value="INGREDIENT">Ingredients</option>
            <option value="CONTAINER">Containers</option>
            <option value="CAP">Caps</option>
            <option value="PACKAGING_BOX">Packaging Boxes</option>
            <option value="CONSUMABLE">Consumables</option>
          </select>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {searchQuery || categoryFilter !== 'ALL' ? 'No items match your filters' : 'No items yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase">UOM</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-700 uppercase">Status</th>
                  {isAdmin && <th className="text-right px-4 py-3 text-xs font-semibold text-slate-700 uppercase">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{item.item_code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.item_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                        {item.category?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.base_uom}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        item.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(item)}
                            className={`p-2 transition-colors ${
                              item.is_active ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'
                            }`}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}</p>
    </div>
  );
}