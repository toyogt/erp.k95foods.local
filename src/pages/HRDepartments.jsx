import MasterDataPageShell from '@/components/hr/MasterDataPageShell';

export default function HRDepartments() {
  return (
    <MasterDataPageShell
      title="Department"
      description="Departments are linked to employees. The Department Head email receives attendance anomaly alerts for everyone in the department."
      entityName="Department"
      uniqueKey="department_name"
      sortField="department_name"
      searchKeys={['department_name', 'department_head_email', 'department_head_name']}
      columns={[
        { key: 'department_name', label: 'Department' },
        { key: 'department_head_name', label: 'Head' },
        { key: 'department_head_email', label: 'Head Email' },
      ]}
      fields={[
        { key: 'department_name', label: 'Department Name', required: true, placeholder: 'e.g. PRODUCTION' },
        { key: 'department_head_name', label: 'Department Head Name', placeholder: 'e.g. Ramesh Kumar' },
        { key: 'department_head_email', label: 'Department Head Email', type: 'email', placeholder: 'head@company.com', helper: 'This email receives attendance alerts for the department' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  );
}