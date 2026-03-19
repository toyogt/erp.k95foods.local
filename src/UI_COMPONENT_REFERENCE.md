# K95 UI Component Reference Card

Quick copy-paste components that maintain K95 design consistency.

---

## 1. BUTTONS

### Primary Action Button
```jsx
<Button className="bg-slate-900 text-white hover:bg-slate-800 text-sm h-9 px-4">
  Save
</Button>

// Mobile version
<Button className="bg-slate-900 text-white hover:bg-slate-800 text-base h-11 w-full">
  Save
</Button>
```

### Secondary Button
```jsx
<Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 text-sm h-9">
  Cancel
</Button>

// Mobile
<Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 text-base h-11 w-full">
  Cancel
</Button>
```

### Icon Buttons
```jsx
<button className="p-1.5 hover:bg-slate-100 rounded transition-colors">
  <Pencil className="w-4 h-4 text-slate-500" />
</button>

<button className="p-1.5 hover:bg-red-50 rounded transition-colors">
  <Trash2 className="w-4 h-4 text-red-500" />
</button>
```

### Button Group
```jsx
<div className="flex gap-2">
  <Button variant="outline" className="h-11">Cancel</Button>
  <Button className="h-11">Save</Button>
</div>

// Mobile (full width)
<div className="flex gap-2 flex-col">
  <Button variant="outline" className="h-11 w-full">Cancel</Button>
  <Button className="h-11 w-full">Save</Button>
</div>
```

---

## 2. FORM ELEMENTS

### Text Input
```jsx
<div>
  <Label className="text-xs font-medium text-slate-700">Field Name</Label>
  <Input 
    placeholder="Enter value"
    className="h-9 text-sm mt-1"
  />
  <p className="text-xs text-slate-500 mt-1">Helper text</p>
</div>
```

### Select Dropdown
```jsx
<div>
  <Label className="text-xs font-medium text-slate-700">Choose Option</Label>
  <select className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm mt-1 bg-white">
    <option value="">— Select —</option>
    <option value="opt1">Option 1</option>
    <option value="opt2">Option 2</option>
  </select>
</div>
```

### Checkbox
```jsx
<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" className="w-4 h-4" />
  <span className="text-sm text-slate-700">Check this option</span>
</label>
```

### Radio Group
```jsx
<div className="space-y-2">
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="radio" name="option" value="a" className="w-4 h-4" />
    <span className="text-sm text-slate-700">Option A</span>
  </label>
  <label className="flex items-center gap-2 cursor-pointer">
    <input type="radio" name="option" value="b" className="w-4 h-4" />
    <span className="text-sm text-slate-700">Option B</span>
  </label>
</div>
```

### Textarea
```jsx
<div>
  <Label className="text-xs font-medium text-slate-700">Description</Label>
  <textarea 
    placeholder="Enter details"
    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm mt-1 resize-none"
    rows="3"
  />
</div>
```

### Form Section (Multiple Fields)
```jsx
<div className="space-y-3">
  <div>
    <Label className="text-xs font-medium text-slate-700">Field 1</Label>
    <Input className="h-9 text-sm mt-1" placeholder="Value" />
  </div>
  <div>
    <Label className="text-xs font-medium text-slate-700">Field 2</Label>
    <select className="w-full h-9 border border-slate-200 rounded-md px-3 text-sm mt-1 bg-white">
      <option>— Select —</option>
    </select>
  </div>
  <div className="flex gap-2 pt-2">
    <Button variant="outline" className="h-9 text-sm">Cancel</Button>
    <Button className="h-9 text-sm">Save</Button>
  </div>
</div>
```

---

## 3. CARDS & CONTAINERS

### Basic Card
```jsx
<div className="border border-slate-200 rounded-lg bg-white p-4">
  <p className="text-sm text-slate-900">Card content</p>
</div>
```

### Card with Header
```jsx
<div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
  <div className="border-b border-slate-100 bg-slate-50 p-4">
    <h3 className="font-semibold text-slate-900 text-sm">Header</h3>
  </div>
  <div className="p-4">
    <p className="text-sm text-slate-700">Content</p>
  </div>
</div>
```

### Card with Hover
```jsx
<div className="border border-slate-200 rounded-lg bg-white p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer">
  Content
</div>
```

### Info Box
```jsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
  <p className="text-xs text-blue-800">Information message</p>
</div>
```

### Warning Box
```jsx
<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
  <p className="text-xs text-amber-800">Warning message</p>
</div>
```

### Error Box
```jsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
  <p className="text-xs text-red-800">Error message</p>
</div>
```

---

## 4. BADGES & STATUS

### Status Badge (Multiple variants)
```jsx
// Draft
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
  Draft
</span>

// Approved (Success)
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
  Approved
</span>

// Rejected (Danger)
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
  Rejected
</span>

// Pending (Warning)
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
  Pending
</span>

// In Progress (Info)
<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
  In Progress
</span>
```

### Role/Tag Badge
```jsx
<span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
  purchase_manager
</span>
```

---

## 5. TABLES

### Simple Table
```jsx
<div className="overflow-x-auto border border-slate-200 rounded-lg">
  <table className="w-full text-sm">
    <thead className="bg-slate-100 text-slate-700 uppercase tracking-wide">
      <tr>
        <th className="px-4 py-2 text-left font-semibold">Column A</th>
        <th className="px-4 py-2 text-left font-semibold">Column B</th>
        <th className="px-4 py-2 text-center font-semibold">Action</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {data.map(item => (
        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
          <td className="px-4 py-2">{item.a}</td>
          <td className="px-4 py-2">{item.b}</td>
          <td className="px-4 py-2 text-center">
            <button className="p-1.5 hover:bg-slate-200 rounded">
              <Pencil className="w-4 h-4" />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

// Empty state
{data.length === 0 && (
  <div className="text-center py-8 text-slate-500 text-sm">
    No records found
  </div>
)}
```

---

## 6. MODALS & DIALOGS

### Dialog (using shadcn)
```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <p className="text-sm text-slate-700">Dialog content goes here</p>
    </div>
    <DialogFooter className="gap-2">
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Confirmation Dialog
```jsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle className="text-base">Confirm Delete?</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-slate-700">This action cannot be undone.</p>
    <DialogFooter className="gap-2">
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 7. EMPTY & LOADING STATES

### Loading Spinner
```jsx
<div className="flex justify-center py-12">
  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
</div>
```

### Empty State
```jsx
<div className="text-center py-12">
  <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
  <p className="text-sm text-slate-500">No records found</p>
  <Button className="mt-4 gap-1.5 text-xs h-9">
    <Plus className="w-3.5 h-3.5" /> Create First Item
  </Button>
</div>
```

### Unauthorized
```jsx
<div className="text-center py-12 text-slate-500">
  <p className="text-sm">You don't have permission to access this page</p>
</div>
```

---

## 8. LAYOUT PATTERNS

### Page Header
```jsx
<div className="space-y-4 mb-6">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">Page Title</h1>
    <p className="text-sm text-slate-500 mt-1">Page description or subtitle</p>
  </div>
</div>
```

### Page Header with Action
```jsx
<div className="flex justify-between items-start gap-4 mb-6">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">Page Title</h1>
    <p className="text-sm text-slate-500 mt-1">Description</p>
  </div>
  <Button className="gap-1.5 text-xs h-11">
    <Plus className="w-4 h-4" /> Add New
  </Button>
</div>

// Mobile: Stack vertically
<div className="flex flex-col gap-4 mb-6">
  <div>
    <h1 className="text-2xl font-bold text-slate-900">Page Title</h1>
    <p className="text-sm text-slate-500 mt-1">Description</p>
  </div>
  <Button className="gap-1.5 text-sm h-11 w-full">
    <Plus className="w-4 h-4" /> Add New
  </Button>
</div>
```

### Filter & Search Bar
```jsx
<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
  <div className="relative flex-1">
    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
    <Input 
      className="pl-8 h-9 text-sm"
      placeholder="Search…"
      value={search}
      onChange={e => setSearch(e.target.value)}
    />
  </div>
  <select className="w-full sm:w-auto h-9 border border-slate-200 rounded-md px-3 text-sm bg-white">
    <option>All Status</option>
    <option>Draft</option>
    <option>Approved</option>
  </select>
</div>
```

### Tabs
```jsx
<div className="flex gap-2 border-b border-slate-200 mb-4">
  <button
    onClick={() => setTab('tab1')}
    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
      tab === 'tab1'
        ? 'border-slate-900 text-slate-900'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`}
  >
    Tab 1
  </button>
  <button
    onClick={() => setTab('tab2')}
    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
      tab === 'tab2'
        ? 'border-slate-900 text-slate-900'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`}
  >
    Tab 2
  </button>
</div>
```

---

## 9. SPACING & LAYOUT

### Page Container
```jsx
<div className="space-y-4">
  {/* space-y-4 = 16px gap between elements */}
</div>

<div className="space-y-6">
  {/* space-y-6 = 24px gap (for major sections) */}
</div>
```

### Responsive Grid
```jsx
{/* 1 col on mobile, 2 on tablet, 3 on desktop */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</div>
```

### Flex with Wrap
```jsx
<div className="flex flex-wrap gap-2">
  {roles.map(role => (
    <span key={role.id} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs">
      {role.label}
    </span>
  ))}
</div>
```

---

## 10. RESPONSIVE HELPERS

### Hide/Show by Breakpoint
```jsx
{/* Hidden on mobile, visible on desktop */}
<div className="hidden md:block">Desktop content</div>

{/* Visible on mobile, hidden on desktop */}
<div className="md:hidden">Mobile content</div>

{/* Responsive text size */}
<h1 className="text-xl md:text-2xl lg:text-3xl font-bold">
  Responsive Title
</h1>

{/* Responsive padding */}
<div className="p-3 md:p-4 lg:p-6">
  Content
</div>

{/* Responsive grid columns */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</div>
```

---

## 11. MOBILE-FIRST CHECKLIST

Before marking component done:
- [ ] Button/input height ≥ 44px (h-11) on mobile
- [ ] Touch targets ≥ 40px × 40px
- [ ] Font size ≥ 14px on mobile (text-sm or text-base)
- [ ] Stack vertically (flex-col) on mobile
- [ ] Full width inputs/buttons on mobile
- [ ] Test 2-finger zoom (don't disable)
- [ ] Test on actual phone, not just browser

---

## 12. COLOR REFERENCE

| Use | Class | Notes |
|-----|-------|-------|
| Primary text | `text-slate-900` | Dark navy-gray |
| Secondary text | `text-slate-600` | Medium gray |
| Muted text | `text-slate-500` | Light gray |
| Helper/hint | `text-slate-400` | Very light |
| Success | `text-green-700` | Approval, complete |
| Danger | `text-red-700` | Delete, reject |
| Warning | `text-amber-700` | Pending, caution |
| Info | `text-blue-700` | Information |
| Bg primary | `bg-slate-900` | Button fill |
| Bg secondary | `bg-slate-100` | Card, hover |
| Bg success | `bg-green-100` | + `text-green-700` |
| Bg danger | `bg-red-100` | + `text-red-700` |
| Border | `border-slate-200` | Most borders |
| Border hover | `border-slate-300` | Hover states |
| Divider | `border-slate-100` | Table dividers |

---

**Copy these snippets as-is. They're tested and follow K95 standards.**