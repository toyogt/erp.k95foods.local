import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Send, RefreshCw, Trash2, Eye, Loader2 } from 'lucide-react';

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const CATEGORY_STYLES = {
  UTILITY: 'bg-blue-100 text-blue-700',
  MARKETING: 'bg-purple-100 text-purple-700',
  AUTHENTICATION: 'bg-orange-100 text-orange-700',
};

export default function TemplateList({ templates, onRefetch, onEdit, onNew, onTestSend }) {
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { toast } = useToast();

  const filtered = templates.filter(t => {
    const q = search.toLowerCase();
    return !q || t.display_name?.toLowerCase().includes(q) || t.template_name?.toLowerCase().includes(q);
  });

  async function handleSyncStatuses() {
    setSyncing(true);
    const resp = await base44.functions.invoke('whatsappTemplateManager', {
      action: 'check_status',
      waba_id: '__FROM_ENV__',
    });
    const metaTemplates = resp.data?.templates || [];

    for (const tpl of templates) {
      const metaMatch = metaTemplates.find(m => m.name === tpl.template_name);
      if (metaMatch) {
        const newStatus = metaMatch.status === 'APPROVED' ? 'approved' : metaMatch.status === 'REJECTED' ? 'rejected' : 'submitted';
        if (tpl.meta_status !== newStatus) {
          await base44.entities.WhatsAppTemplate.update(tpl.id, {
            meta_status: newStatus,
            meta_template_id: metaMatch.id || tpl.meta_template_id,
          });
        }
      }
    }
    setSyncing(false);
    toast({ title: 'Sync complete', description: `Checked ${metaTemplates.length} templates from Meta` });
    onRefetch();
  }

  async function handleDelete(tpl) {
    if (!confirm(`Delete template "${tpl.display_name || tpl.template_name}"? This will also delete it from Meta if submitted.`)) return;
    setDeletingId(tpl.id);

    if (tpl.meta_status !== 'draft') {
      await base44.functions.invoke('whatsappTemplateManager', {
        action: 'delete_template',
        waba_id: '__FROM_ENV__',
        template_name: tpl.template_name,
      }).catch(() => {});
    }

    await base44.entities.WhatsAppTemplate.delete(tpl.id);
    setDeletingId(null);
    toast({ title: 'Template deleted' });
    onRefetch();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleSyncStatuses} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync Status
          </Button>
          <Button size="sm" className="h-9 gap-1.5 bg-green-700 hover:bg-green-800" onClick={onNew}>
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs">
                <th className="px-3 py-2.5 text-left font-semibold">Template Name</th>
                <th className="px-3 py-2.5 text-left font-semibold">Category</th>
                <th className="px-3 py-2.5 text-left font-semibold">Parameters</th>
                <th className="px-3 py-2.5 text-left font-semibold">Trigger</th>
                <th className="px-3 py-2.5 text-center font-semibold">Meta Status</th>
                <th className="px-3 py-2.5 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(tpl => (
                <tr key={tpl.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{tpl.display_name || tpl.template_name}</div>
                    <div className="text-xs text-slate-400 font-mono">{tpl.template_name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge className={CATEGORY_STYLES[tpl.category] || 'bg-slate-100 text-slate-600'}>
                      {tpl.category}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{tpl.parameter_count || 0} params</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-slate-500">{tpl.trigger_event || 'manual'}</span>
                    {tpl.trigger_entity && <span className="text-xs text-slate-400 ml-1">→ {tpl.trigger_entity}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge className={STATUS_STYLES[tpl.meta_status] || STATUS_STYLES.draft}>
                      {tpl.meta_status || 'draft'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tpl)} title="Edit">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => onTestSend(tpl)} title="Test Send" disabled={tpl.meta_status !== 'approved'}>
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(tpl)} disabled={deletingId === tpl.id} title="Delete">
                        {deletingId === tpl.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">No templates found. Create your first WhatsApp template.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}