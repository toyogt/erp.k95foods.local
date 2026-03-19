# Page Refactoring Architecture Guide

## Pattern Overview

Each refactored page follows this structure:

```
pages/ModuleName.jsx                    ← Container/orchestrator
├── components/module/ModuleView.jsx    ← Presentation (UI only)
├── components/module/SectionName.jsx   ← Feature sections
├── hooks/useModuleData.js              ← Data fetching/state
├── hooks/useModuleActions.js           ← Business logic/actions
├── lib/moduleRules.js                  ← Validation/rules
└── lib/moduleHelpers.js                ← Utility functions
```

## File Responsibilities

### Container (pages/ModuleName.jsx)
- Orchestrates hooks and state
- Handles route params & auth
- Passes data/actions to view
- Error/loading boundaries
- ~50-100 lines

```javascript
import ModuleView from '@/components/module/ModuleView';
import { useModuleData } from '@/hooks/useModuleData';
import { useModuleActions } from '@/hooks/useModuleActions';

export default function ModulePage() {
  const [user, setUser] = useState(null);
  const { data, loading, error } = useModuleData();
  const { actions } = useModuleActions();

  return (
    <ErrorBoundary>
      {loading ? <Spinner /> : <ModuleView data={data} actions={actions} />}
    </ErrorBoundary>
  );
}
```

### View Component (components/module/ModuleView.jsx)
- Pure presentation logic
- Receives all data as props
- No direct API calls
- Delegates actions to handlers
- ~200-300 lines

```javascript
export default function ModuleView({ data, actions }) {
  return (
    <div className="space-y-6">
      <DocumentHeader {...data.header} />
      <ModuleSection data={data.section} onAction={actions.handleAction} />
      <ActionFooter onSubmit={actions.handleSubmit} />
    </div>
  );
}
```

### Data Hook (hooks/useModuleData.js)
- Fetches data from Base44
- Manages loading/error states
- Returns normalized data
- ~100-150 lines

```javascript
export function useModuleData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.Entity.list()
      .then(data => setData(data))
      .catch(err => setError(err));
  }, []);

  return { data, loading, error };
}
```

### Action Hook (hooks/useModuleActions.js)
- Handles user actions (create, update, delete)
- Coordinates with multiple entities
- Fires FMS events
- Returns action handlers
- ~150-200 lines

```javascript
export function useModuleActions() {
  const [actionLoading, setActionLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setActionLoading(true);
    try {
      const result = await base44.entities.Entity.create(formData);
      await fireFMSEvent('event_key', result.id);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    } finally {
      setActionLoading(false);
    }
  };

  return { handleSubmit, actionLoading };
}
```

### Rules/Validation (lib/moduleRules.js)
- Business rule checks
- Validation logic
- Error messages
- ~100 lines

```javascript
export function validateTransferQty(qty, available) {
  if (qty > available) return 'Quantity exceeds available stock';
  if (qty <= 0) return 'Quantity must be > 0';
  return null;
}

export function checkTransferRules(transfer) {
  const errors = [];
  if (!transfer.destination) errors.push('Destination required');
  if (transfer.items.length === 0) errors.push('Add at least 1 item');
  return errors;
}
```

### Helpers (lib/moduleHelpers.js)
- Format/transform data
- Utility functions
- Constants
- ~100 lines

```javascript
export function formatTransferCode(prefix, id) {
  return `${prefix}_${new Date().getFullYear()}_${id}`;
}

export const TRANSFER_STATUSES = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  RECEIVED: 'Received',
};
```

## Reusable Components

Extract common patterns into shared components:

```
components/
├── common/
│   ├── DocumentHeader.jsx         ← Title, date, status, edit button
│   ├── StatusBadge.jsx            ← Color-coded status display
│   ├── ScanInput.jsx              ← QR/barcode scan with format
│   ├── ActionFooter.jsx           ← Submit/Cancel/Delete buttons
│   ├── ApprovalPanel.jsx          ← Approval rules & buttons
│   ├── AuditPanel.jsx             ← Created/Updated/By info
│   ├── ErrorBoundary.jsx          ← Error fallback UI
│   └── LoadingSpinner.jsx         ← Skeleton/spinner
└── [module]/
    ├── [ModuleName]View.jsx       ← Page-specific view
    ├── Section1.jsx               ← Feature section
    └── Section2.jsx               ← Feature section
```

## State Management Pattern

Use React Query for server state + local state for UI:

```javascript
// Data fetching
const { data, isLoading, error } = useQuery(
  ['entities', filters],
  () => fetchData(filters)
);

// Form state
const [form, setForm] = useState(initialValues);

// UI state
const [showModal, setShowModal] = useState(false);
```

## Error Handling Pattern

```javascript
try {
  // Action
  const result = await action();
  if (result.success) {
    toast.success('Action completed');
    onSuccess();
  } else {
    toast.error(result.error?.message || 'Failed');
  }
} catch (error) {
  logError(error);
  toast.error('Unexpected error');
}
```

## Migration Checklist

When refactoring a page:

- [ ] Create hooks folder structure
- [ ] Extract data fetching → useModuleData
- [ ] Extract actions → useModuleActions
- [ ] Extract rules/validation → lib/moduleRules
- [ ] Extract helpers/constants → lib/moduleHelpers
- [ ] Create ModuleView component
- [ ] Break down view into sections
- [ ] Extract common components (header, footer, etc.)
- [ ] Add error boundaries
- [ ] Add loading states
- [ ] Test desktop + mobile
- [ ] Verify FMS events still fire
- [ ] Verify permissions still work
- [ ] Check no data duplication

## Benefits

✅ **Testability:** Can unit test hooks, rules, helpers independently
✅ **Reusability:** Hooks/components used across modules
✅ **Maintainability:** Clear separation of concerns
✅ **Readability:** Each file has single responsibility
✅ **Scalability:** Easy to add new features without modifying core
✅ **Debugging:** Smaller files easier to troubleshoot
✅ **Performance:** Better tree-shaking, code splitting

## File Size Targets

- Container page: 50-100 lines
- View component: 200-300 lines
- Data hook: 100-150 lines
- Action hook: 150-200 lines
- Rules/helpers: 50-150 lines each
- Common components: 100-200 lines each

## Implementation Examples

### TransferReceiving (Refactored)
- **Container:** `pages/TransferReceiving.jsx` (70 lines)
  - Orchestrates hooks, handles params, error boundaries
  
- **View:** `components/warehouse/TransferReceivingView.jsx` (250 lines)
  - Pure presentation with ScanInput, summary cards, line table
  - Receives data/actions as props only

- **Data Hook:** `hooks/useTransferReceivingData.js` (120 lines)
  - Fetches transfer & lines
  - CRUD operations (addLine, updateLine, removeLine)

- **Action Hook:** `hooks/useTransferReceivingActions.js` (140 lines)
  - createTransfer, submitTransfer, receiveTransfer, discardTransfer
  - Validation, error handling, state management

- **Rules:** `lib/transferReceivingRules.js` (60 lines)
  - checkTransferRules, validateReceiveQty, getVarianceSeverity

- **Helpers:** `lib/transferReceivingHelpers.js` (70 lines)
  - Constants (TRANSFER_STATUSES, COLORS)
  - Utilities (formatTransferCode, calculateSummary)

### FillingStation (Refactored)
- **Data Hook:** `hooks/useFillingStationData.js` (130 lines)
  - Loads active batch, crates
  - Add/update/remove crate operations

- **Action Hook:** `hooks/useFillingStationActions.js` (155 lines)
  - startBatch, recordCrate, completeBatch, pauseBatch
  - Fires FMS events & trace events

### ProductionOrders (Refactored)
- **Data Hook:** `hooks/useProductionOrdersData.js` (105 lines)
  - List, create, update, delete orders
  - Filter by status/SKU/date

- **Action Hook:** `hooks/useProductionOrdersActions.js` (130 lines)
  - createProductionOrder, releaseOrder, completeOrder, cancelOrder
  - Validates business rules before action

## Shared Components

All pages can now use:

```javascript
import DocumentHeader from '@/components/common/DocumentHeader';
import StatusBadge from '@/components/common/StatusBadge';
import ScanInput from '@/components/common/ScanInput';
import ActionFooter from '@/components/common/ActionFooter';
import AuditPanel from '@/components/common/AuditPanel';
import ApprovalPanel from '@/components/common/ApprovalPanel';
import ErrorBoundary from '@/components/common/ErrorBoundary';
```

## Deduplication Achieved

**Before:** Duplicate code across SKUSetup, Labelling, Production
- Status badge logic → `StatusBadge.jsx` (1 source)
- Scan input logic → `ScanInput.jsx` (1 source)
- Action footer → `ActionFooter.jsx` (1 source)
- Audit display → `AuditPanel.jsx` (1 source)

**After:** Single component, used everywhere

## Testing Improvements

Each module is now testable independently:

```javascript
// Test data hook
it('should load transfer', () => {
  const { result } = renderHook(() => useTransferReceivingData(id));
  expect(result.current.transfer).toBeDefined();
});

// Test action hook
it('should receive transfer', async () => {
  const { result } = renderHook(() => useTransferReceivingActions());
  await act(async () => {
    await result.current.receiveTransfer(...);
  });
});

// Test rules
it('should validate qty', () => {
  const error = validateReceiveQty(150, 100);
  expect(error).toContain('cannot receive more');
});

// Test component in isolation
it('should render view', () => {
  render(<TransferReceivingView data={mockData} actions={mockActions} />);
  expect(screen.getByText('Transfer Code')).toBeInTheDocument();
});
```

## Migration Path for Remaining Pages

1. **SKUSetup:** Extract SKUData → SKUActions → SKUView
2. **LabellingLine:** Extract LabelData → LabelActions → LabelView
3. **WarehouseOps:** Extract WarehouseData → WarehouseActions → WarehouseView
4. **RecipeBuilder:** Extract RecipeData → RecipeActions → RecipeView

Each follows same pattern; estimated ~300-400 lines per page refactored into ~1200 lines of smaller modules.

---

**Benefits Delivered:**
✅ Reduced file sizes (200-300 line limit)
✅ Eliminated duplicate code (5+ instances consolidated)
✅ Improved testability (unit test each module)
✅ Better error handling (ErrorBoundary + validation layers)
✅ FMS event integration baked into action hooks
✅ Clear separation of concerns
✅ Easier onboarding (structure is obvious)