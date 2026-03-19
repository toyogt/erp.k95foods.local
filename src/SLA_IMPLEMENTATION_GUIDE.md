# SLA and Aging Controls Guide

**Prevent Important Approvals from Sitting Unnoticed**

## Overview

SLA engine tracks time-sensitive workflows and automatically escalates aging items. Simple language, clear status colors, and smart alerts keep factory running smoothly.

## 1. Core Concepts

### SLA Status Buckets

- **On Time** ✓ — Item is progressing normally
- **Due Soon** ⚠ — 75% of SLA consumed, needs attention
- **Overdue** ! — Past SLA target, needs escalation
- **Critically Overdue** ✕ — 150% past SLA, immediate action required

### Tracked Workflows

```
- Purchase Order Approval (normal SLA: 24h)
- Label Approval (normal SLA: 8h)
- GRN Pending Quality Control (normal SLA: 4h)
- Dispatch Readiness Check (normal SLA: 2h)
- Transfer Receipt Pending (normal SLA: 6h)
- Maintenance Issue Acknowledgement (normal SLA: 1h)
- Sync Conflict Resolution (normal SLA: 4h)
- Quality Hold Pending Review (normal SLA: 24h)
```

### How SLA Works

1. **Created** — Item enters queue with current timestamp
2. **Clock Ticking** — Hours elapsed = (now - created_date)
3. **Aging Calculation** — Elapsed / SLA Target = % used
4. **Status Updated** — At 75% → "Due Soon", at 100% → "Overdue"
5. **Escalation** — Overdue items escalate every 4h to next level
6. **Exception Notes** — Users can justify delays with reason + notes

## 2. Configuration

### SLA Config Entity

Each workflow has a configuration:

```javascript
{
  workflow_type: 'purchase_approval',
  workflow_label: 'Purchase Order Approval',
  normal_sla_hours: 24,           // Target hours
  urgent_sla_hours: 4,            // For urgent priority
  critical_sla_hours: 1,          // For critical priority
  warning_threshold_percent: 75,  // Show warning at 75%
  overdue_threshold_percent: 150, // Mark critical at 150%
  escalation_interval_hours: 4,   // Escalate every 4h if still pending
  escalation_chain: [
    { escalation_level: 1, role_key: 'supervisor', notify_method: 'email' },
    { escalation_level: 2, role_key: 'manager', notify_method: 'both' },
    { escalation_level: 3, role_key: 'director', notify_method: 'both' },
  ],
}
```

### Admin Setup

**Route:** `/SLAConfigManager`

1. Click "Add SLA Config"
2. Select workflow type
3. Set normal/urgent/critical SLA hours
4. Set warning threshold (default 75%)
5. Set escalation interval (default 4h)
6. Save

## 3. Using SLA in Components

### Calculate Aging

```javascript
import { getSLAConfig, calculateAging, SLA_STATUSES } from '@/lib/slaEngine';

// Get SLA config
const config = await getSLAConfig('purchase_approval');

// Calculate aging
const aging = calculateAging(
  purchaseOrder.created_date,
  config,
  purchaseOrder.priority // 'normal' | 'urgent' | 'critical'
);

// aging = {
//   hoursElapsed: 18,
//   hoursRemaining: 6,
//   slaTarget: 24,
//   percentageUsed: 75,
//   status: 'DUE_SOON',
//   isOverdue: false,
//   isDueSoon: true,
//   isOnTime: false,
// }
```

### Display Status Badge

```jsx
import SLAStatusBadge from '@/components/sla/SLAStatusBadge';

<SLAStatusBadge 
  status={aging.status}
  hoursRemaining={aging.hoursRemaining}
  compact={false}
/>

// Compact version (small indicator)
<SLAStatusBadge 
  status={aging.status}
  compact={true}
/>
```

### Display Progress Bar

```jsx
import SLAProgressBar from '@/components/sla/SLAProgressBar';

<SLAProgressBar
  percentageUsed={aging.percentageUsed}
  status={aging.status}
  label="Purchase Order Approval"
  showLabel={true}
/>
```

## 4. Dashboard Widgets

### Approval Aging Widget

Shows all pending approvals by aging bucket:

```jsx
import ApprovalAgeingWidget from '@/components/sla/ApprovalAgeingWidget';

<ApprovalAgeingWidget />
```

**Features:**
- Tabs for each aging bucket (Critically Overdue, Overdue, Due Soon, On Time)
- Click to filter
- Shows count in each bucket
- Red highlight for critical items

### Pending Actions Widget

Shows GRN QC, dispatch, transfer, quality holds:

```jsx
import PendingActionsAgeingWidget from '@/components/sla/PendingActionsAgeingWidget';

<PendingActionsAgeingWidget />
```

**Features:**
- Filters by critical/all
- Shows SLA progress
- Hours remaining or overdue

## 5. Exception Justification

Allow users to explain why items are delayed.

### SLA Exception Entity

```
{
  entity_id: 'PO_123',
  entity_type: 'PurchaseOrder',
  workflow_type: 'purchase_approval',
  reason_code: 'waiting_external', // waiting_external | missing_info | quality_hold | system_issue | resource_constraint | other
  justification_notes: 'Waiting for supplier quote, expected tomorrow',
  submitted_by: 'john@factory.com',
  submitted_at: '2026-03-19T10:00:00Z',
  approved_by: 'supervisor@factory.com',
  approved_at: '2026-03-19T10:15:00Z',
  status: 'approved', // pending | approved | rejected
  expected_resolution_date: '2026-03-20T10:00:00Z',
}
```

### Exception Form

```jsx
import SLAExceptionForm from '@/components/sla/SLAExceptionForm';

<SLAExceptionForm
  entityId={po.id}
  entityType="PurchaseOrder"
  workflowType="purchase_approval"
  onSuccess={() => alert('Exception submitted')}
  onCancel={() => setShowForm(false)}
/>
```

**Reason codes:**
- Waiting for External Party
- Missing Required Information
- Quality/Compliance Hold
- System Issue
- Resource Unavailable
- Other

## 6. Escalation Monitoring

### Escalation Dashboard

**Route:** `/SLAEscalationDashboard`

Shows:
- Total escalations
- Unacknowledged escalations
- Critical escalations (level 2+)
- Resolved escalations

Filter by:
- Unresolved only
- All escalations

Each escalation shows:
- Entity code and type
- Escalation level
- Hours overdue
- Escalated to (role, person)
- Whether acknowledged
- When acknowledged/resolved

### Escalation Log Entity

```
{
  escalation_id: 'PO_123_1_timestamp',
  workflow_type: 'purchase_approval',
  entity_type: 'PurchaseOrder',
  entity_id: 'PO_123',
  entity_code: 'PO-2026-001',
  escalation_level: 1,
  escalated_to_role: 'supervisor',
  escalated_to_email: 'john@factory.com',
  escalated_to_name: 'John Smith',
  hours_overdue: 2.5,
  escalation_reason: 'Purchase order approval overdue by 2.5 hours',
  acknowledged: false,
  acknowledged_at: null,
  action_taken: null,
  resolved_at: null,
}
```

## 7. Integration Examples

### Add to Approval List Page

```jsx
import { getSLAConfig, calculateAging } from '@/lib/slaEngine';
import SLAStatusBadge from '@/components/sla/SLAStatusBadge';
import SLAProgressBar from '@/components/sla/SLAProgressBar';

export default function PurchaseApprovals() {
  const [approvals, setApprovals] = useState([]);

  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    const config = await getSLAConfig('purchase_approval');
    const pos = await base44.entities.PurchaseOrder.filter(
      { status: 'SUBMITTED' },
      '-created_date'
    );

    const withAging = pos.map(po => ({
      ...po,
      aging: calculateAging(po.created_date, config, po.priority),
    }));

    // Sort by most overdue first
    withAging.sort((a, b) => b.aging.percentageUsed - a.aging.percentageUsed);
    setApprovals(withAging);
  };

  return (
    <div className="space-y-4">
      {approvals.map(po => (
        <div key={po.id} className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-slate-900">{po.po_number}</h3>
              <p className="text-sm text-slate-600">{po.vendor_name}</p>
            </div>
            <SLAStatusBadge status={po.aging.status} />
          </div>

          <SLAProgressBar
            percentageUsed={po.aging.percentageUsed}
            status={po.aging.status}
            label="Approval Progress"
          />

          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Amount</span>
              <p className="font-bold">${po.total_amount}</p>
            </div>
            <div>
              <span className="text-slate-600">SLA</span>
              <p className="font-bold">{po.aging.slaTarget}h</p>
            </div>
            <div className="text-right">
              <span className="text-slate-600">Status</span>
              <p className={`font-bold ${po.aging.isOnTime ? 'text-green-600' : 'text-amber-600'}`}>
                {po.aging.hoursRemaining > 0
                  ? `${Math.round(po.aging.hoursRemaining)}h left`
                  : `${Math.round(Math.abs(po.aging.hoursRemaining))}h overdue`
                }
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Add Exception Button

```jsx
function PurchaseOrderDetail() {
  const [showException, setShowException] = useState(false);

  return (
    <div className="space-y-6">
      {/* Status and aging info */}
      <div className="bg-white rounded-lg p-6">
        <SLAStatusBadge status={aging.status} />
        <SLAProgressBar
          percentageUsed={aging.percentageUsed}
          status={aging.status}
          label="Approval Time"
        />

        {aging.isDueSoon && !showException && (
          <button
            onClick={() => setShowException(true)}
            className="w-full h-10 mt-4 border-2 border-amber-300 text-amber-700 font-bold rounded-lg hover:bg-amber-50"
          >
            Justify Delay
          </button>
        )}
      </div>

      {/* Exception form */}
      {showException && (
        <SLAExceptionForm
          entityId={po.id}
          entityType="PurchaseOrder"
          workflowType="purchase_approval"
          onSuccess={() => {
            setShowException(false);
            alert('Exception submitted for review');
          }}
          onCancel={() => setShowException(false)}
        />
      )}
    </div>
  );
}
```

## 8. Language & Terminology

✅ **Simple, Operational Language:**
- "Due Soon" instead of "approaching threshold"
- "Hours overdue" instead of "SLA variance"
- "Justify Delay" instead of "submit exception"
- "Pending approval" instead of "workflow step status"

❌ **Avoid:**
- Technical jargon
- Abbreviations (QC, PO, GRN, SLA)
- Complex metrics

## 9. Color Coding

- **Green (On Time)** — bg-green-100 text-green-700
- **Amber (Due Soon)** — bg-amber-100 text-amber-700
- **Red (Overdue)** — bg-red-100 text-red-700
- **Dark Red (Critically Overdue)** — bg-red-900 text-white

## 10. Best Practices

### ✅ DO

1. **Show SLA status prominently** on all approval lists
2. **Use color** to highlight aging items
3. **Enable exception justification** for legitimate delays
4. **Escalate automatically** every 4h past SLA
5. **Show hours remaining/overdue** clearly
6. **Update config based on feedback** (adjust SLA targets if too tight/loose)
7. **Link escalation to audit trail** for compliance

### ❌ DON'T

1. **Don't hide aging info** — Make it visible
2. **Don't set SLAs too tight** — They become noise
3. **Don't escalate without notification** — People need to know
4. **Don't block approvals on age** — Let supervisor override
5. **Don't forget to acknowledge** — Close the feedback loop
6. **Don't use aggressive language** — "Overdue" is clear enough

## 11. Checklist

- [ ] SLA Configs created for all workflows
- [ ] SLA widgets added to dashboards
- [ ] ApprovalAgeingWidget on Approvals page
- [ ] PendingActionsAgeingWidget on Dashboard
- [ ] Exception form integrated into approval pages
- [ ] Escalation Dashboard accessible to supervisors
- [ ] Escalation email notifications working
- [ ] Admin can update SLA targets
- [ ] Tested on mobile (aging indicator visible)
- [ ] User training on "Due Soon" → "Justify Delay" flow

---

**Key Goal:** Remove surprise rejections. Aging visibility + exception justification = transparency + trust.