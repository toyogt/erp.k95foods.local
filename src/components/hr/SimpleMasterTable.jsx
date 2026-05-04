import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Generic table for master data entities (Department, Designation, Branch, Company, LeaveType).
 * Pass `columns` array of { key, label, render? } and `rows`.
 */
export default function SimpleMasterTable({ columns = [], rows = [], onEdit, onDelete, loading }) {
  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Loading…</div>;
  }
  if (!rows.length) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
        No records yet. Click "Add" to create one.
      </div>
    );
  }
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100 hover:bg-slate-100">
            {columns.map((c) => (
              <TableHead key={c.key} className="text-slate-700 font-medium">{c.label}</TableHead>
            ))}
            <TableHead className="text-slate-700 font-medium w-32 text-right">Status</TableHead>
            <TableHead className="text-slate-700 font-medium w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <TableRow key={r.id} className="hover:bg-slate-50">
              {columns.map((c) => (
                <TableCell key={c.key} className="text-sm text-slate-900">
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </TableCell>
              ))}
              <TableCell className="text-right">
                {r.is_active === false ? (
                  <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit?.(r)}>
                    <Pencil className="w-4 h-4 text-slate-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete?.(r)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}