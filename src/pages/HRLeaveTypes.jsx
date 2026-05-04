import MasterDataPageShell from '@/components/hr/MasterDataPageShell';

export default function HRLeaveTypes() {
  return (
    <MasterDataPageShell
      title="Leave Type"
      description="Leave categories used for leave requests and balances."
      entityName="LeaveType"
      uniqueKey="leave_code"
      sortField="leave_code"
      searchKeys={['leave_code', 'leave_name']}
      columns={[
        { key: 'leave_code', label: 'Code' },
        { key: 'leave_name', label: 'Name' },
        { key: 'leave_period', label: 'Period' },
        { key: 'annual_quota', label: 'Quota (days)' },
      ]}
      fields={[
        { key: 'leave_code', label: 'Leave Code', required: true, placeholder: 'e.g. CL' },
        { key: 'leave_name', label: 'Leave Name', required: true, placeholder: 'e.g. Casual Leave' },
        { key: 'leave_period', label: 'Period (Yearly / Monthly / Quarterly / OneTime)', placeholder: 'Yearly' },
        { key: 'annual_quota', label: 'Annual Quota (days)', type: 'number', placeholder: '12' },
      ]}
    />
  );
}