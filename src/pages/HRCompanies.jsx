import MasterDataPageShell from '@/components/hr/MasterDataPageShell';

export default function HRCompanies() {
  return (
    <MasterDataPageShell
      title="Company"
      description="Master list of companies."
      entityName="Company"
      uniqueKey="company_name"
      sortField="company_name"
      searchKeys={['company_name', 'email', 'phone_number']}
      columns={[
        { key: 'company_name', label: 'Company' },
        { key: 'phone_number', label: 'Phone' },
        { key: 'email', label: 'Email' },
      ]}
      fields={[
        { key: 'company_name', label: 'Company Name', required: true },
        { key: 'phone_number', label: 'Phone Number' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'address', label: 'Address', type: 'textarea' },
      ]}
    />
  );
}