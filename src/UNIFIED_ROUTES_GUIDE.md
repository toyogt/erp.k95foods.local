# Unified Routes & Registry System

## Overview

K95 ERP now uses a **single source of truth** for all routes, pages, modules, and navigation. No more manual route additions scattered across App.jsx and moduleConfig.js.

**Source:** `lib/registryConfig.js`

## Architecture

```
┌─────────────────────────────────────────────┐
│   lib/registryConfig.js                     │
│   - pageRegistry[]  (all pages)             │
│   - moduleRegistry[] (modules)              │
│   - specialPages[] (hidden pages)           │
└─────────────────────────────────────────────┘
         ↓           ↓              ↓
    ┌────────┐   ┌───────┐   ┌──────────┐
    │ App.jsx│   │Layout │   │moduleConfig
    │(Routes)│   │(Sidebar)  (Backward compat)
    └────────┘   └───────┘   └──────────┘
         ↓
┌─────────────────────────────────────────────┐
│   lib/routeValidator.js                     │
│   - Checks for orphans, duplicates          │
│   - Generates diagnostics report            │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│   pages/RoutesDiagnostics.jsx               │
│   - Admin page to view validation results   │
└─────────────────────────────────────────────┘
```

## Registry Structure

### pageRegistry

Each page entry includes:
```javascript
{
  pageKey: 'ProductionControl',    // Route path & unique ID
  title: 'Production Control',     // Display name
  moduleKey: 'PRODUCTION',         // Module it belongs to
  icon: Factory,                   // lucide-react icon
  roles: ['admin', 'user'],        // Allowed user roles
  adminOnly: false,                // Only admin can access
  mobileVisible: true,             // Show on mobile app
  description: 'text',             // Optional description
  system: false,                   // System/hidden page
}
```

### moduleRegistry

Each module entry includes:
```javascript
{
  moduleKey: 'PRODUCTION',
  label: 'Production',
  icon: Factory,
  color: 'text-blue-600',          // Icon color
  bgColor: 'bg-blue-50',           // Background color
  adminOnly: false,
  sortOrder: 2,                    // Order in sidebar
}
```

### specialPages

Hidden system pages still routable but not in navigation:
```javascript
{
  pageKey: 'BarcodeOCRTest',
  title: 'Barcode OCR Test',
  roles: ['admin'],
  system: true,
}
```

## Adding a New Page

### 1. Create page file
```javascript
// pages/MyNewPage.jsx
export default function MyNewPage() {
  return <div>My New Page</div>;
}
```

### 2. Register in lib/registryConfig.js

Add entry to `pageRegistry`:
```javascript
{
  pageKey: 'MyNewPage',
  title: 'My New Page',
  moduleKey: 'ADMIN',              // or existing module
  icon: Settings,                  // lucide-react icon
  roles: ['admin'],
  adminOnly: false,
}
```

### 3. Import component in App.jsx

Add import:
```javascript
import MyNewPage from './pages/MyNewPage';
```

Add to `PAGE_COMPONENTS`:
```javascript
const PAGE_COMPONENTS = {
  MyNewPage,
  // ... other pages
};
```

### Done!
- Route auto-generated: `/MyNewPage`
- Sidebar auto-updated if module visible
- Permissions auto-checked

## Removing a Page

1. Remove from `pageRegistry` (or `specialPages`)
2. Remove import and component from App.jsx
3. Delete page file

Routes & navigation auto-update.

## Changing Module Assignment

1. Edit page entry in `pageRegistry`
2. Change `moduleKey: 'OLD_MODULE'` → `moduleKey: 'NEW_MODULE'`
3. Save

Sidebar updates automatically.

## Checking System Health

### View Diagnostics Page
Go to: **Admin → Routes Diagnostics**

Shows:
- ✅ Valid configuration
- ❌ Errors (duplicates, missing modules, etc.)
- ⚠️ Warnings (missing icons, unused modules, etc.)
- 📊 Statistics (total pages, modules, roles)
- 🔍 Pages by module
- 👥 All defined roles

### Programmatic Check
```javascript
import { validateRoutes, getDiagnosticsReport } from '@/lib/routeValidator';

const validation = validateRoutes();
if (!validation.stats.isValid) {
  console.error('Configuration errors:', validation.errors);
}

const report = getDiagnosticsReport();
console.log(report.summary);
```

## Registry API

### Reading Registry

```javascript
import {
  getAllPages,
  getPageByKey,
  getPagesInModule,
  getModuleByKey,
  getModuleForPage,
  getVisibleModules,
  getVisiblePagesInModule,
  canAccessPage,
  getAllRoutablePages,
} from '@/lib/registryConfig';

// Get all pages
const pages = getAllPages();

// Get single page
const page = getPageByKey('Dashboard');

// Get pages in module
const prodPages = getPagesInModule('PRODUCTION');

// Get visible pages for user role
const visiblePages = getVisiblePagesInModule('PRODUCTION', 'production_manager');

// Get module for page
const mod = getModuleForPage('ProductionControl');

// Check access
if (canAccessPage('AdminPanel', userRole)) {
  // show page
}
```

## Backward Compatibility

**`components/nav/moduleConfig.js`** still exists but now derives from registry.

Old code continues working:
```javascript
import { MODULES, getVisibleModules, getVisiblePages } from '@/components/nav/moduleConfig';

// Still works but uses registry underneath
const mods = getVisibleModules(role);
```

**New code should use:**
```javascript
import { getVisibleModules } from '@/lib/registryConfig';

const mods = getVisibleModules(role);
```

## Auto-Generated Routes (App.jsx)

Routes are now auto-generated from registry:

```javascript
{getAllRoutablePages().map((pageEntry) => {
  const Component = PAGE_COMPONENTS[pageEntry.pageKey];
  return (
    <Route
      key={pageEntry.pageKey}
      path={`/${pageEntry.pageKey}`}
      element={
        <LayoutWrapper currentPageName={pageEntry.pageKey}>
          <Component />
        </LayoutWrapper>
      }
    />
  );
})}
```

**Benefits:**
- ✅ No more manual route additions
- ✅ Automatic sidebar updates
- ✅ Single source of truth
- ✅ Easy to audit (all routes in one place)

## Auto-Generated Navigation (Layout.jsx)

Sidebar uses registry to build navigation:

```javascript
const visibleModules = getVisibleModules(role);

{visibleModules.map(mod => {
  const pages = getVisiblePagesInModule(mod.moduleKey, role);
  // render module + sub-pages
})}
```

**Benefits:**
- ✅ Sidebar auto-filters by role
- ✅ Modules only show if they have visible pages
- ✅ No hardcoded page lists
- ✅ Changes to registry = instant sidebar update

## Naming Convention

| Property | Format | Example |
|----------|--------|---------|
| pageKey | PascalCase | `ProductionControl`, `MyNewPage` |
| moduleKey | UPPER_SNAKE_CASE | `PRODUCTION`, `ADMIN` |
| title | Title Case | `Production Control` |
| roles | lowercase | `production_manager`, `user` |

## Role Management

Define roles in registry pages:

```javascript
roles: ['admin', 'production_manager', 'filling_operator', 'user']
```

All unique roles automatically collected in diagnostics report.

## Mobile Visibility

Control mobile app visibility with `mobileVisible` flag:

```javascript
{ pageKey: 'Dashboard', mobileVisible: true, ... }   // Shows on mobile
{ pageKey: 'MasterData', mobileVisible: false, ... } // Hidden on mobile
```

## System Pages

Hidden from normal navigation but still routable:

```javascript
// In specialPages
{ pageKey: 'BarcodeOCRTest', title: '...', system: true, roles: ['admin'] }
```

- Not shown in sidebar
- Can be routed directly: `/BarcodeOCRTest`
- Useful for internal tools, testing, special workflows

## Validation Rules

Registry validates:
1. ✅ No duplicate page keys
2. ✅ No duplicate routes
3. ✅ All pages have module mapping
4. ✅ All modules referenced actually exist
5. ✅ Pages have role restrictions
6. ✅ All pages have icons

View violations on **Routes Diagnostics** page.

## Migration from Old System

### Old Way (❌ Don't do this anymore)
```javascript
// App.jsx - scattered manual routes
<Route path="/ProductionControl" element={<ProductionControl />} />
<Route path="/FillingStation" element={<FillingStation />} />

// moduleConfig.js - hardcoded page lists
pages: [
  { key: 'ProductionControl', label: '...' },
  { key: 'FillingStation', label: '...' },
]
```

### New Way (✅ Do this)
```javascript
// lib/registryConfig.js - single registry
pageRegistry: [
  { pageKey: 'ProductionControl', moduleKey: 'PRODUCTION', ... },
  { pageKey: 'FillingStation', moduleKey: 'PRODUCTION', ... },
]

// App.jsx - auto-generated routes
{getAllRoutablePages().map(page => (...))}
```

## Common Tasks

### Find all pages in a module
```javascript
import { getPagesInModule } from '@/lib/registryConfig';

const prodPages = getPagesInModule('PRODUCTION');
```

### Check if page is admin-only
```javascript
import { getPageByKey } from '@/lib/registryConfig';

const page = getPageByKey('SKUSetup');
if (page.adminOnly) { /* ... */ }
```

### Get all roles used in app
```javascript
import { getDiagnosticsReport } from '@/lib/routeValidator';

const report = getDiagnosticsReport();
console.log(report.details.roles); // ['admin', 'user', ...]
```

### Filter pages by mobile visibility
```javascript
const mobilePages = getAllPages().filter(p => p.mobileVisible);
```

## Files Changed

| File | Purpose |
|------|---------|
| `lib/registryConfig.js` | ✨ NEW - Master registry |
| `lib/routeValidator.js` | ✨ NEW - Validation & diagnostics |
| `pages/RoutesDiagnostics.jsx` | ✨ NEW - Admin diagnostics page |
| `App.jsx` | Updated - Auto-generated routes |
| `layout.jsx` | Updated - Use registry for sidebar |
| `components/nav/moduleConfig.js` | Updated - Now derives from registry |

## Performance Impact

- **Minimal** - Registry loaded once at app startup
- **Sidebar rendering** - O(n) where n = visible pages (typically <50)
- **Route matching** - React Router still O(1)
- **No additional API calls** - All data local

## Troubleshooting

### Page not appearing in sidebar
1. Check `pageRegistry` has entry
2. Verify `roles` includes user's role
3. Check module exists in `moduleRegistry`
4. Check `adminOnly: false` if not admin

### Route not working
1. Check import in App.jsx
2. Check component in `PAGE_COMPONENTS`
3. Check page name matches exactly
4. Run Routes Diagnostics page

### Permission denied on page
1. Check user role in debug panel
2. Check page's `roles` array in registry
3. Check `adminOnly` flag
4. Check user has permission policy

---

**Last Updated:** 2026-03-19  
**Status:** Production Ready  
**Backward Compatible:** ✅ Yes