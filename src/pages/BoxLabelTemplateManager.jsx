import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import AccessDenied from '@/components/AccessDenied';
import { Plus, Pencil, Trash2, Search, Loader2, Layers } from 'lucide-react';

export default function BoxLabelTemplateManager() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setUserLoading(false));
  }, []);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['box-label-templates'],
    queryFn: () => base44.entities.BoxLabelTemplate.list('-updated_date', 200),
  });

  const handleDelete = async (t) => {
    if (!confirm(`Delete template "${t.template_name}"?`)) return;
    try {
      await base44.entities.BoxLabelTemplate.delete(t.id);
      qc.invalidateQueries({ queryKey: ['box-label-templates'] });
      toast({ title: 'Template deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  if (userLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const canManage = user?.role === 'admin' || user?.role === 'lbl_supervisor' || user?.role === 'production_manager';
  if (!canManage) return <AccessDenied page="BoxLabelTemplateManager" />;

  const filtered = templates.filter(t =>
    !search || t.template_name?.toLowerCase().includes(search.toLowerCase()) || t.template_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Box Label Templates</h1>
          <p className="text-xs md:text-sm text-slate-500">Design templates and map them to SKUs for box label printing.</p>
        </div>
        <Button className="h-11 gap-2" onClick={() => navigate('/BoxLabelTemplateBuilder')}>
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-10 pl-9 text-sm"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 border-dashed rounded-xl">
          <p className="font-medium">No templates yet.</p>
          <p className="text-sm mt-1">Click "New Template" to design your first box label.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Template ID</th>
                <th className="text-left px-4 py-3 font-semibold">Page Size</th>
                <th className="text-left px-4 py-3 font-semibold">Elements</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{t.template_name}</div>
                    {t.description && <div className="text-xs text-slate-500">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.template_id}</td>
                  <td className="px-4 py-3 text-slate-600">{t.page_width} × {t.page_height} {t.page_unit}</td>
                  <td className="px-4 py-3 text-slate-600">{t.elements?.length || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" className="h-9" onClick={() => navigate(`/BoxLabelTemplateBuilder?id=${t.id}`)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 text-red-600 hover:bg-red-50" onClick={() => handleDelete(t)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}