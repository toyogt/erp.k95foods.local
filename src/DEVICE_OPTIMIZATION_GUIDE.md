# Device-Specific Usability Guide

**Optimize for Desktop Supervisors, Shop-Floor Workers, and Handheld Scanners**

## Overview

The app adapts to 4 device modes automatically:
- **Desktop** — Supervisor: dense tables, multi-column layouts, reconciliation views
- **Mobile** — Shop-floor operator: large buttons, simple navigation, step-by-step actions
- **Scanner** — Handheld: large scan focus, minimal typing, quick confirms
- **Kiosk** — Shared terminal: centered workflow, step-by-step flow

## 1. Device Detection & Modes

### Auto-Detection

```javascript
import { detectDeviceMode, DEVICE_MODES } from '@/lib/deviceDetection';

const mode = detectDeviceMode();
// Returns: 'desktop' | 'mobile' | 'scanner' | 'kiosk'

// Check device characteristics
import { getDeviceCharacteristics } from '@/lib/deviceDetection';
const { isMobile, isTouch, orientation } = getDeviceCharacteristics();
```

### Manual Override (Admin Feature)

Users/admins can manually switch modes:

```javascript
import { useDeviceMode } from '@/hooks/useDeviceMode';

function App() {
  const { mode, setModeOverride } = useDeviceMode();

  return (
    <DeviceModeSwitcher />
  );
}
```

Override saved in localStorage, persists across sessions.

## 2. Desktop Supervisor Mode

### Characteristics
- Dense table layouts
- Multi-column forms
- Reconciliation-heavy views
- Search and filter prominent
- Keyboard shortcuts

### Optimal Sizes

```javascript
import { getOptimalSizes } from '@/lib/deviceDetection';

const desktopSizes = getOptimalSizes('desktop');
// {
//   buttonHeight: 'h-9',
//   buttonPadding: 'px-4 py-2',
//   inputHeight: 'h-9',
//   inputFontSize: 'text-sm',
//   tableDensity: 'compact',
// }
```

### Example: Supervisor Dashboard

```jsx
import SupervisorLayout from '@/components/device/SupervisorLayout';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';

export default function ReconciliationDashboard() {
  return (
    <SupervisorLayout
      title="Daily Reconciliation"
      stats={[
        { label: 'Exceptions', value: 23, change: -5 },
        { label: 'In Progress', value: 12, change: 0 },
        { label: 'Resolved', value: 89, change: 12 },
        { label: 'Resolution Rate', value: '89%', change: 5 },
      ]}
      filters={
        <>
          <input placeholder="Search..." />
          <select><option>All Modules</option></select>
        </>
      }
    >
      {/* Three-column layout on desktop */}
      <div>
        <h3 className="font-bold">Critical Issues</h3>
        <ResponsiveTable columns={columns} rows={criticalRows} />
      </div>
      <div>
        <h3 className="font-bold">In Progress</h3>
        <ResponsiveTable columns={columns} rows={inProgressRows} />
      </div>
      <div>
        <h3 className="font-bold">Trend Chart</h3>
        {/* Chart here */}
      </div>
    </SupervisorLayout>
  );
}
```

### Features
- **Multi-column grid** — 3-column on desktop, responsive down to 1 on mobile
- **Compact tables** — Dense rows, all columns visible
- **Quick actions** — Hover to reveal action buttons
- **Keyboard navigation** — Tab through tables
- **Advanced filters** — Always visible

## 3. Mobile Shop-Floor Mode

### Characteristics
- Large touch targets (h-11 = 44px minimum)
- Single-column flows
- Step-by-step actions
- Sticky action bar at bottom
- Simplified navigation

### Optimal Sizes

```javascript
const mobileSizes = getOptimalSizes('mobile');
// {
//   buttonHeight: 'h-11',    // 44px for touch
//   buttonPadding: 'px-4 py-3',
//   inputHeight: 'h-11',
//   inputFontSize: 'text-base',
//   tableDensity: 'comfortable',
// }
```

### Example: Mobile Operator Workflow

```jsx
import { useDeviceMode } from '@/hooks/useDeviceMode';
import ResponsiveActionBar from '@/components/responsive/ResponsiveActionBar';
import ResponsiveCard from '@/components/responsive/ResponsiveCard';

export default function TransferReceiving() {
  const { sizes } = useDeviceMode();
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Title */}
      <div className="bg-white border-b p-4 sticky top-0 z-20">
        <h1 className="text-xl font-bold">Transfer Receiving</h1>
        <p className="text-sm text-slate-500">Step {step} of 4</p>
      </div>

      {/* Content - single column */}
      <div className={`space-y-4 ${sizes.padding}`}>
        {step === 1 && (
          <ResponsiveCard title="Scan Transfer Code">
            <ScanInput
              label="Transfer ID"
              placeholder="Scan transfer barcode"
              onScanned={handleScanTransfer}
            />
          </ResponsiveCard>
        )}

        {step === 2 && (
          <ResponsiveCard title="Scan Item">
            <ScanInput
              label="Product Code"
              placeholder="Scan product barcode"
              onScanned={handleScanItem}
            />
          </ResponsiveCard>
        )}

        {step === 3 && (
          <ResponsiveCard title="Quantity Received">
            <Input
              type="number"
              placeholder="Enter quantity"
              className={`w-full ${sizes.inputHeight} text-center text-3xl font-bold`}
            />
          </ResponsiveCard>
        )}

        {step === 4 && (
          <ResponsiveCard title="Confirm Receipt">
            <SummaryTable data={summary} />
          </ResponsiveCard>
        )}
      </div>

      {/* Sticky action bar */}
      <ResponsiveActionBar
        sticky
        actions={[
          {
            label: step > 1 ? 'Back' : 'Cancel',
            variant: 'secondary',
            onClick: () => step > 1 ? setStep(step - 1) : goBack(),
          },
          {
            label: step < 4 ? 'Next' : 'Complete',
            variant: 'primary',
            onClick: () => step < 4 ? setStep(step + 1) : complete(),
            disabled: !canProceed(),
          },
        ]}
      />
    </div>
  );
}
```

### Features
- **Step-by-step workflow** — One action per screen
- **Sticky buttons** — Always visible at bottom
- **Large touch targets** — 44px minimum (h-11)
- **Minimal text** — Clear, task-focused
- **Progress indicator** — Shows step number

## 4. Scanner Handheld Mode

### Characteristics
- **Barcode/QR focus** — Largest input on screen
- **Auto-focus** — Keyboard always ready
- **Quick confirm** — No multi-step workflows
- **Minimal typing** — Scan = complete action
- **Large status** — Big checkmarks/errors

### Optimal Sizes

```javascript
const scannerSizes = getOptimalSizes('scanner');
// {
//   buttonHeight: 'h-14',    // Extra large for thick fingers
//   buttonPadding: 'px-6 py-4',
//   inputHeight: 'h-14',
//   inputFontSize: 'text-lg',
//   tableDensity: 'sparse',
// }
```

### Example: Scanner-First Pallet Receiving

```jsx
import ScannerLayout from '@/components/device/ScannerLayout';
import ScanInput from '@/components/scanner/ScanInput';
import ResponsiveActionBar from '@/components/responsive/ResponsiveActionBar';

export default function PalletReceive() {
  const [state, setState] = useState('waiting');
  const [pallet, setPallet] = useState(null);

  const handlePalletScan = async (palletId) => {
    const p = await base44.entities.Pallet.filter({ id: palletId }, null, 1);
    setPallet(p[0]);
    setState('scanned');
    return true; // Signal success
  };

  const confirmReceipt = async () => {
    await base44.entities.Pallet.update(pallet.id, { status: 'RECEIVED' });
    setState('success');
    setTimeout(() => {
      setPallet(null);
      setState('waiting');
    }, 2000);
  };

  return (
    <ScannerLayout title="Pallet Receiving" subtitle="Scan pallet barcodes">
      {state === 'waiting' && (
        <ScanInput
          label="Scan Pallet Barcode"
          placeholder="Ready to scan..."
          onScanned={handlePalletScan}
          autofocus
        />
      )}

      {state === 'scanned' && pallet && (
        <>
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-green-900">{pallet.pallet_id}</h2>
            <p className="text-green-700 mt-2">Status: {pallet.status}</p>
          </div>

          <ResponsiveActionBar
            actions={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setState('waiting'),
              },
              {
                label: 'Confirm Receipt',
                variant: 'primary',
                onClick: confirmReceipt,
              },
            ]}
          />
        </>
      )}

      {state === 'success' && (
        <div className="text-center py-12">
          <div className="text-6xl">✓</div>
          <p className="text-2xl font-bold text-green-600 mt-4">Received!</p>
        </div>
      )}
    </ScannerLayout>
  );
}
```

### ScanInput Component

```jsx
import ScanInput from '@/components/scanner/ScanInput';

<ScanInput
  label="Barcode"
  placeholder="Scan barcode or QR code"
  type="barcode" // 'barcode' | 'qr' | 'manual'
  onScanned={async (scannedValue) => {
    // Validate and process scan
    const record = await fetchRecord(scannedValue);
    if (!record) throw new Error('Not found');
    return true; // Signal success
  }}
  onError={(error) => console.error(error)}
  autofocus
  scanTimeout={100} // Device sends barcode + Enter key
  debounce={200} // Wait for scan completion before processing
/>
```

**ScanInput Features:**
- ✅ Auto-focus on mount
- ✅ Keyboard buffer detection (scanner sends complete barcode)
- ✅ Debounce scan completion
- ✅ Prevent duplicate scans
- ✅ Large status indicators (24px icons)
- ✅ Success/error visual feedback
- ✅ Keeps focus for next scan

### Features
- **Barcode/QR focus** — Largest element
- **Auto-focused input** — Ready to scan immediately
- **No manual typing** — Scanners send complete data
- **Quick visual feedback** — Large checkmarks/X marks
- **Error recovery** — Clear error messages, focus reset
- **Offline-ready** — Works without network

## 5. Kiosk Shared Terminal Mode

### Characteristics
- Centered, focused workflow
- Large, touch-friendly buttons
- Step-by-step prompts
- No navigation sidebar
- Locked to single flow

### Example: Kiosk Goods Receipt

```jsx
import KioskLayout from '@/components/device/KioskLayout';
import { Button } from '@/components/ui/button';

export default function GoodsReceiptKiosk() {
  const [step, setStep] = useState(1);
  const [grn, setGRN] = useState(null);

  return (
    <KioskLayout
      title={step === 1 ? 'Goods Receipt' : 'Inspect Items'}
      step={step}
      totalSteps={4}
      backButton={
        step > 1 && (
          <Button
            variant="outline"
            className="h-12 px-8 text-lg"
            onClick={() => setStep(step - 1)}
          >
            ← Back
          </Button>
        )
      }
    >
      {step === 1 && (
        <>
          <ScanInput
            label="Scan GRN Barcode"
            type="barcode"
            placeholder="Ready to scan..."
            onScanned={async (grnId) => {
              const g = await fetchGRN(grnId);
              setGRN(g);
              setStep(2);
              return true;
            }}
            autofocus
          />
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-2xl font-bold text-slate-900">{grn.grn_no}</h2>
          <p className="text-lg text-slate-600">{grn.supplier_name}</p>
          <p className="text-3xl font-bold text-slate-900 mt-4">{grn.items.length} items</p>
          
          <Button
            className="w-full h-14 text-lg mt-8"
            onClick={() => setStep(3)}
          >
            Start Inspection
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <ScanInput
            label="Scan Item Barcodes"
            type="barcode"
            onScanned={async (itemId) => {
              // Process item
              return true;
            }}
            autofocus
          />
        </>
      )}

      {step === 4 && (
        <>
          <div className="text-center space-y-6">
            <div className="text-7xl">✓</div>
            <h2 className="text-3xl font-bold text-green-600">Receipt Complete</h2>
            <Button
              className="w-full h-14 text-lg mt-8"
              onClick={() => {
                setStep(1);
                setGRN(null);
              }}
            >
              New Receipt
            </Button>
          </div>
        </>
      )}
    </KioskLayout>
  );
}
```

## 6. Responsive Components

### ResponsiveTable

Auto-switches between table (desktop) and card list (mobile):

```jsx
import ResponsiveTable from '@/components/responsive/ResponsiveTable';

<ResponsiveTable
  columns={[
    { key: 'pallet_id', label: 'Pallet' },
    { key: 'status', label: 'Status', render: (status) => <Badge>{status}</Badge> },
    { key: 'bottles', label: 'Bottles' },
  ]}
  rows={pallets}
  onRowClick={(row) => navigateToPallet(row.id)}
/>
```

### ResponsiveCard

Auto-adjusts density based on device:

```jsx
import ResponsiveCard from '@/components/responsive/ResponsiveCard';

<ResponsiveCard
  title="Transfer Summary"
  variant="comfortable" // auto | compact | comfortable | sparse
>
  <div>Content here</div>
</ResponsiveCard>
```

### ResponsiveActionBar

Sticky action buttons for mobile/scanner:

```jsx
import ResponsiveActionBar from '@/components/responsive/ResponsiveActionBar';

<ResponsiveActionBar
  sticky
  actions={[
    { label: 'Cancel', variant: 'secondary', onClick: handleCancel },
    { label: 'Submit', variant: 'primary', onClick: handleSubmit },
  ]}
/>
```

## 7. Best Practices

### ✅ DO

1. **Always test on actual devices**
   - Desktop, phone, tablet, actual Zebra scanner
   - Real finger/touch vs mouse

2. **Use ScanInput for barcode fields**
   - Auto-focuses, handles scanner devices natively
   - No special setup needed

3. **Make buttons ≥44px height on mobile**
   - h-11 for mobile, h-9 for desktop
   - Use `sizes.buttonHeight` from hook

4. **Break forms into steps on mobile**
   - One input per screen (scanner mode)
   - Progress indicator required

5. **Sticky action bar for mobile**
   - Buttons always visible
   - Don't require scroll to submit

6. **Test scanner mode**
   - Disable text input on scan fields
   - Allow Enter key to submit
   - Prevent double-scan within 500ms

7. **Use ResponsiveTable everywhere**
   - Tables on desktop, cards on mobile
   - No custom layout switching needed

### ❌ DON'T

1. **Don't use text-xs on mobile** — Use text-sm minimum
2. **Don't hide action buttons** — Must always be visible on mobile
3. **Don't require typing** — Use scanners where possible
4. **Don't create steps without progress** — Show step 2 of 4
5. **Don't disable scanner devices** — Test with actual hardware
6. **Don't ignore landscape mode** — Tablets switch orientation
7. **Don't block auto-focus** — Scanners need immediate focus

## 8. Testing Checklist

- [ ] Desktop: 3-column layout, compact tables
- [ ] Mobile: Single column, 44px buttons, sticky actions
- [ ] Scanner: Large scan input, no manual typing, quick confirms
- [ ] Kiosk: Centered flow, step-by-step, navigation bottom
- [ ] Touch: All buttons ≥44px, no hover required
- [ ] Keyboard: Tab navigation works, Enter submits
- [ ] Orientation: Works landscape and portrait
- [ ] Offline: Scan input works offline
- [ ] Actual hardware: Test with real Zebra/Honeywell device
- [ ] Mode switching: Manual override persists across refresh

## 9. Device Mode Configuration

Override device detection globally:

```javascript
// Force scanner mode for testing
localStorage.setItem('device_mode_override', 'scanner');

// Clear override
localStorage.removeItem('device_mode_override');
```

---

**Priority:** Real factory usage over visual polish. If buttons are too small or text too dense, fix it. Users in hardhats and gloves are your audience.