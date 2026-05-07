import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Users, Plus, Search, Edit, Phone, Mail, Briefcase } from 'lucide-react';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import { useToast } from '@/components/ui/use-toast';

const ALLOWED_ROLES = ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'];

export default function HREmployees() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-master'],
    queryFn: () => base44.entities.Employee.list('employee_code', 5000),
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.employee_code?.toLowerCase().includes(q) ||
        e.employee_name?.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            HR access required to manage employees.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOpenNew = () => {
    setEditingEmployee(null);
    setDialogOpen(true);
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setDialogOpen(true);
  };

  const handleSubmit = async (formData) => {
    const code = formData.employee_code;

    if (!editingEmployee) {
      // Check duplicate
      const existing = await base44.entities.Employee.filter({ employee_code: code }, '-created_date', 1);
      if (existing.length > 0) {
        throw new Error(`Employee code "${code}" already exists`);
      }
      await base44.entities.Employee.create(formData);
      toast({ title: 'Employee registered', description: `${formData.employee_name} (${code}) added.` });
    } else {
      await base44.entities.Employee.update(editingEmployee.id, formData);
      toast({ title: 'Employee updated', description: `${formData.employee_name} saved.` });
    }

    queryClient.invalidateQueries({ queryKey: ['employees-master'] });
    setDialogOpen(false);
    setEditingEmployee(null);
  };

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Employees</h1>
            <p className="text-xs md:text-sm text-slate-500">
              {employees.length} registered · used for attendance enrichment
            </p>
          </div>
        </div>
        <Button onClick={handleOpenNew} className="h-11 md:h-9 gap-2">
          <Plus className="w-4 h-4" />
          Register Employee
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-700">Search</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Code, name, phone or department..."
                className="h-11 md:h-9 pl-9 text-base md:text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Employees {filtered.length !== employees.length && `(${filtered.length} of ${employees.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {search ? 'No employees match your search.' : 'No employees yet. Click "Register Employee" to add one.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Code</th>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">Phone</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Department</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Shift</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-slate-900">{emp.employee_code}</td>
                      <td className="px-4 py-2 text-slate-900">{emp.employee_name}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {emp.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {emp.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600 hidden md:table-cell">
                        {emp.department || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600 hidden md:table-cell">
                        {emp.shift_name || <span className="text-slate-400">default</span>}
                      </td>
                      <td className="px-4 py-2">
                        {emp.is_active !== false ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Active</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => handleEdit(emp)}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmployeeFormDialog
        open={dialogOpen}
        employee={editingEmployee}
        onClose={() => { setDialogOpen(false); setEditingEmployee(null); }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}