import MasterDataPageShell from '@/components/hr/MasterDataPageShell';

export default function HRBranches() {
  return (
    <MasterDataPageShell
      title="Branch"
      description="Company branches and locations."
      entityName="Branch"
      uniqueKey="branch_name"
      sortField="branch_name"
      searchKeys={['branch_name', 'address', 'company_name']}
      columns={[
        { key: 'branch_name', label: 'Branch' },
        { key: 'company_name', label: 'Company' },
        { key: 'address', label: 'Address' },
        { key: 'phone_number', label: 'Phone' },
      ]}
      fields={[
        { key: 'branch_name', label: 'Branch Name', required: true, placeholder: 'e.g. V8' },
        { key: 'company_name', label: 'Company Name', placeholder: 'e.g. K95FoodsPvtLtd' },
        { key: 'address', label: 'Address', type: 'textarea' },
        { key: 'phone_number', label: 'Phone Number' },
        { key: 'email', label: 'Email', type: 'email' },
      ]}
    />
  );
}