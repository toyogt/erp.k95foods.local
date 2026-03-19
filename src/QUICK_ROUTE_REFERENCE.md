# Quick Route Reference

## Adding a New Page (30 seconds)

1. **Create** `pages/MyPage.jsx`
2. **Edit** `lib/registryConfig.js` → add to `pageRegistry`:
   ```javascript
   { pageKey: 'MyPage', title: 'My Page', moduleKey: 'ADMIN', icon: Settings, roles: ['admin'] }
   ```
3. **Edit** `App.jsx` → add import and to `PAGE_COMPONENTS`:
   ```javascript
   import MyPage from './pages/MyPage';
   const PAGE_COMPONENTS = { MyPage, ... };
   ```
4. **Done!** Route `/MyPage` auto-created, sidebar updated

## Removing a Page (15 seconds)

1. **Delete** `lib/registryConfig.js` entry
2. **Delete** `App.jsx` import + component reference
3. **Done!** Route gone, sidebar updated

## Changing Module (5 seconds)

Edit `lib/registryConfig.js`:
```javascript
// Before
{ pageKey: 'MyPage', moduleKey: 'ADMIN', ... }

// After
{ pageKey: 'MyPage', moduleKey: 'PRODUCTION', ... }
```

Sidebar updates instantly.

## Making Page Admin-Only

Edit registry:
```javascript
{ pageKey: 'MyPage', adminOnly: true, roles: ['admin'], ... }
```

Only admins see in sidebar + routes blocked automatically.

## Hidden System Page

Use `specialPages` instead of `pageRegistry`:
```javascript
export const specialPages = [
  { pageKey: 'BarcodeOCRTest', title: '...', roles: ['admin'], system: true }
];
```

- Not in sidebar
- Still routable: `/BarcodeOCRTest`
- Good for testing, internal tools

## All Registry Functions

```javascript
import {
  getAllPages,                    // Get all navigable pages
  getPageByKey,                   // Get single page
  getPagesInModule,               // Get pages in module
  getModuleByKey,                 // Get single module
  getModuleForPage,               // Which module owns this page?
  getVisibleModules,              // Get modules visible to role
  getVisiblePagesInModule,        // Get visible pages in module for role
  canAccessPage,                  // Can user access page?
  getAllRoutablePages,            // Get all pages (including special)
} from '@/lib/registryConfig';
```

## Validation

Check registry health:
```javascript
import { validateRoutes, getDiagnosticsReport } from '@/lib/routeValidator';

const report = getDiagnosticsReport();
if (report.summary.isHealthy) console.log('✅ All good');
```

Or visit **Admin → Routes Diagnostics** page.

## Files

| File | What's In It |
|------|------------|
| `lib/registryConfig.js` | 📋 MASTER REGISTRY - edit here |
| `App.jsx` | 🛣️ Auto-generated routes |
| `layout.jsx` | 📱 Auto-generated sidebar |
| `lib/routeValidator.js` | 🔍 Validation checks |
| `pages/RoutesDiagnostics.jsx` | 📊 Admin diagnostics UI |
| `UNIFIED_ROUTES_GUIDE.md` | 📚 Full documentation |

---

**TL;DR:** Edit `lib/registryConfig.js` → routes & sidebar auto-update.