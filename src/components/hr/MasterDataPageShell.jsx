import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import SimpleMasterTable from './SimpleMasterTable';
import SimpleMasterDialog from './SimpleMasterDialog';

/**
 * Reusable page shell for master data (Department, Designation, Branch, Company, LeaveType).
 * Handles list/create/update/delete with confirmation and search.
 */
export default function MasterDataPageShell({
  title,
  description,
  entityName,
  fields,
  columns,
  searchKeys,
  uniqueKey,
  sortField = 'created_date',
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['master', entityName],
    queryFn: () => base44.entities[entityName].list(`-${sortField}`, 500),
  });

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return searchKeys.some((k) => String(r[k] || '').toLowerCase().includes(q));
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      // Uniqueness check (case-insensitive) on uniqueKey
      if (uniqueKey) {
        const incoming = String(payload[uniqueKey] || '').trim().toLowerCase();
        const dup = rows.find((r) =>
          String(r[uniqueKey] || '').trim().toLowerCase() === incoming &&
          r.id !== editing?.id
        );
        if (dup) {
          throw new Error(`A record with this ${uniqueKey.replace(/_/g, ' ')} already exists.`);
        }
      }
      if (editing?.id) {
        return base44.entities[entityName].update(editing.id, payload);
      }
      return base44.entities[entityName].create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master', entityName] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing?.id ? 'Updated' : 'Created', description: `${title} saved.` });
    },
    onError: (err) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities[entityName].delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master', entityName] });
      toast({ title: 'Deleted', description: `${title} record removed.` });
    },
    onError: (err) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleDelete = (row) => {
    const label = row[uniqueKey] || row.id;
    if (window.confirm(`Delete "${label}"? This cannot be undone.`)) {
      deleteMutation.mutate(row.id);
    }
  };

  if (user === null) return null;
  const allowed = ['admin', 'hr_manager', 'hr_supervisor'].includes(user?.role);
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          You do not have permission to manage {title}.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="h-11 md:h-9 gap-2">
          <Plus className="w-4 h-4" /> Add {title}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          className="pl-9 h-11 md:h-9 text-base md:text-sm"
        />
      </div>

      <SimpleMasterTable
        columns={columns}
        rows={filtered}
        loading={isLoading}
        onEdit={(r) => { setEditing(r); setDialogOpen(true); }}
        onDelete={handleDelete}
      />

      <SimpleMasterDialog
        open={dialogOpen}
        title={editing?.id ? `Edit ${title}` : `Add ${title}`}
        fields={fields}
        initialValues={editing || {}}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSubmit={(payload) => saveMutation.mutateAsync(payload)}
      />
    </div>
  );
}