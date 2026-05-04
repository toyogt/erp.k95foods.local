import MasterDataPageShell from '@/components/hr/MasterDataPageShell';

export default function HRDesignations() {
  return (
    <MasterDataPageShell
      title="Designation"
      description="Job titles / roles assigned to employees."
      entityName="Designation"
      uniqueKey="designation_name"
      sortField="designation_name"
      searchKeys={['designation_name', 'description']}
      columns={[
        { key: 'designation_name', label: 'Designation' },
        { key: 'description', label: 'Description' },
      ]}
      fields={[
        { key: 'designation_name', label: 'Designation Name', required: true, placeholder: 'e.g. PRODUCTION INCHARGE' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  );
}