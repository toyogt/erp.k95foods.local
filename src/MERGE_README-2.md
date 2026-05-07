# K95 ERP — HR Module Merge Companion (Part 2)

> **Audience:** Senior Software Engineer AI Agent performing the merge.
> **Purpose:** Deep-dive on the **6 highest-risk merge artefacts** flagged in `MERGE_README.md`.
> **Scope:** Each section below explains the file/artefact's responsibility, current behaviour, entity impact, and exact merge action required.
> **Last updated:** 07/05/2026

---

## Table of Contents

1. [`lib/fmsAppEvents.js`](#1-libfmsappeventsjs--event-registry)
2. [`lib/registryConfig.js`](#2-libregistryconfigjs--page--module-registry)
3. [`App.jsx`](#3-appjsx--root-router)
4. [`functions/syncToGoogleSheets.js`](#4-functionssynctogooglesheetsjs--name-clash-warning)
5. [Missing Secrets](#5-missing-secrets)
6. [Missing DB Seeds](#6-missing-db-seeds)

---

## 1. `lib/fmsAppEvents.js` — Event Registry

### 🎯 Responsibility
Central registry for all events that can trigger or complete steps in the FMS (Process Flow Management System). Every entity action that participates in a workflow MUST have its event key declared here.

### ⚙️ How It Works
- File exports an array (`APP_EVENTS` or similar) of event-definition objects.
- Each event has:
  - `key` — unique machine identifier (e.g. `candidate_hired`)
  - `label` — human-readable name shown in FMS UI
  - `category` — grouping (Purchase, Production, HR, etc.) used for dropdown organisation
  - `canTrigger` — true if this event can START a new FMS process instance
  - `canComplete` — true if this event can MARK a step as done in an active instance
- UI helpers (`getTriggerEvents()`, `getCompletionEvents()`, `getEventsByCategory()`) filter and group these for dropdowns.
- Runtime: `fireFMSEvent('event_key', recordId)` from `lib/useFMSAutoComplete.js` looks up the key here before dispatching.

### 🗂️ Entities Affected
- `FMSProcess` (uses event keys as `trigger_source`)
- `FMSStepInstance` (uses event keys as `auto_complete_event`)
- `CandidateLead`, `Employee` — fire HR lifecycle events on status transitions

### 🆕 New Events Added by HR Module

| Event Key | Label | Category | canTrigger | canComplete |
|---|---|---|---|---|
| `candidate_lead_created` | Candidate Lead Created | HR | ✅ | ✅ |
| `candidate_shortlisted` | Candidate Shortlisted | HR | ❌ | ✅ |
| `candidate_interviewed` | Candidate Interviewed | HR | ❌ | ✅ |
| `candidate_hired` | Candidate Hired | HR | ✅ | ✅ |
| `employee_exit_initiated` | Employee Exit Initiated | HR | ✅ | ✅ |
| `exit_interview_sent` | Exit Interview Sent | HR | ❌ | ✅ |

### 🔧 Merge Action

**Step 1:** Open main app's `lib/fmsAppEvents.js` and locate the events array.
**Step 2:** Append the 6 HR entries listed above. Match the existing object shape used by main app (some apps use `name` instead of `label` — verify before pasting).
**Step 3:** If a category constant exists (e.g. `CATEGORIES.HR`), use it instead of the literal string.
**Step 4:** Verify no key collision — `grep "candidate_hired" lib/fmsAppEvents.js` after merge should return exactly one match.

### ⚠️ Conflict Risk: 🟠 MEDIUM
- Append-style file → mechanical merge usually clean.
- Risk: main app may have introduced its own HR events or differently-shaped entries. Do a structural diff.

---

## 2. `lib/registryConfig.js` — Page & Module Registry

### 🎯 Responsibility
Single source of truth for navigation, page metadata, and role-based access. Drives:
- Sidebar module groups
- Page titles, icons, sort order
- Role gating per page (`roles: [...]`, `adminOnly: true`)
- `hideFromNav` for routes that exist but should not appear in menus

### ⚙️ How It Works
File exports two arrays + helper selectors:
- `pageRegistry` — every page (key, title, moduleKey, icon, roles, sortOrder, hideFromNav, mobileVisible)
- `moduleRegistry` — module groups (moduleKey, label, icon, color, bgColor, adminOnly, sortOrder)
- Helpers: `getVisibleModules(role)`, `getVisiblePagesInModule(moduleKey, role)`, `getModuleForPage(pageKey)`, `canAccessPage(pageKey, userRole)`, `getAllRoutablePages()`.
- `Layout.jsx` calls these helpers to render the sidebar dynamically.
- `App.jsx` calls `getAllRoutablePages()` to drive the auto-route loop (NOTE: per app routing note, this loop only contains OLD pages — new HR pages still need explicit `<Route>` declarations).

### 🗂️ Entities Affected
- `AppRole` — role keys referenced here must exist as `AppRole` records
- `RoleModuleAccess` — non-admin users' allowed modules are stored here in DB; registry defines what's *possible*, DB defines what's *granted*
- `User` — `user.role` is matched against `roles` arrays

### 🆕 New Module Entry

```javascript
{
  moduleKey: 'HR',
  label: 'Human Resources',
  icon: UserCheck,
  color: 'text-amber-600',
  bgColor: 'bg-amber-50',
  adminOnly: false,
  sortOrder: 50,
}
```

### 🆕 New Page Entries (18 total — see `MERGE_README.md` Annex C.3 for full list)

Most relevant ones for HR module:
- `HREmployees`, `HRAttendanceLogs`, `HRAttendanceSummary`, `HREmployeeDailyHours`
- `HRManualPunchRequest`, `HRManualPunchApprovals`, `HRAttendanceAlerts`
- `HRShiftTimings`, `HRHolidays`
- `HRDepartments`, `HRDesignations`, `HRBranches`, `HRCompanies`, `HRLeaveTypes`
- `HRNotificationSettings`
- `HRCandidateLeads`, `HRAttritionDashboard`
- `HRTerminationForm` (with `hideFromNav: true`)

### 🆕 New Lucide Icons Required at Top of File

```javascript
import {
  // ...existing imports preserved...
  UserCheck, UserPlus, UserMinus, TrendingDown, CalendarDays, MapPin, Bell,
} from 'lucide-react';
```

### 🆕 New Roles Referenced (must be seeded in DB — see §6)
- `hr_manager`
- `hr_supervisor`
- `hr_user`

### 🔧 Merge Action

**Step 1:** Open `lib/registryConfig.js` from main app.
**Step 2:** Add the 7 new icon imports at the top (some may already exist — only add the missing ones).
**Step 3:** Insert the HR module entry into `moduleRegistry`. Confirm `sortOrder: 50` doesn't clash; if it does, pick the next free slot ≥ 50.
**Step 4:** Insert the 18 page entries into `pageRegistry`. Group them together for readability.
**Step 5:** No helper function changes required — registry is data-only.
**Step 6:** Verify `getAllRoutablePages().find(p => p.pageKey === 'HRCandidateLeads')` returns the new entry after merge.

### ⚠️ Conflict Risk: 🔴 HIGH
- Both arrays are append-style hot spots — every feature branch touches them.
- Manual reconciliation of import block + array insertions is required.
- Sort-order collisions are silent — verify visually in dev sidebar.

---

## 3. `App.jsx` — Root Router

### 🎯 Responsibility
Application root. Sets up:
- `AuthProvider` (user session)
- `QueryClientProvider` (React Query cache)
- `BrowserRouter` (URL routing)
- `Toaster` (global notifications)
- `LayoutWrapper` (sidebar + header chrome)
- All explicit `<Route>` elements

### ⚙️ How It Works
- Imports every page component statically.
- Maintains a `PAGE_COMPONENTS` lookup map for the auto-route loop.
- Renders `<Routes>` containing both:
  - **Explicit `<Route>` elements** — for pages with custom routing needs (params, public access, etc.)
  - **Auto-loop** — `getAllRoutablePages().map(...)` — for standard wrapped pages
- ⚠️ **Per `app_routing_note`**: the auto-loop is NOT regenerated. New pages MUST be added as explicit `<Route>` blocks OR also be added to `pages.config.js` (legacy) — the safe path is explicit routes.

### 🗂️ Entities Affected
None directly — but it makes pages reachable, which is what allows users to interact with entity data.

### 🆕 Imports Added (19 page components)

```jsx
import HREmployees             from './pages/HREmployees';
import HRAttendanceLogs        from './pages/HRAttendanceLogs';
import HRAttendanceSummary     from './pages/HRAttendanceSummary';
import HREmployeeDailyHours    from './pages/HREmployeeDailyHours';
import HRManualPunchRequest    from './pages/HRManualPunchRequest';
import HRManualPunchApprovals  from './pages/HRManualPunchApprovals';
import HRAttendanceAlerts      from './pages/HRAttendanceAlerts';
import HRShiftTimings          from './pages/HRShiftTimings';
import HRHolidays              from './pages/HRHolidays';
import HRDepartments           from './pages/HRDepartments';
import HRDesignations          from './pages/HRDesignations';
import HRBranches              from './pages/HRBranches';
import HRCompanies             from './pages/HRCompanies';
import HRLeaveTypes            from './pages/HRLeaveTypes';
import HRNotificationSettings  from './pages/HRNotificationSettings';
import HRCandidateLeads        from './pages/HRCandidateLeads';
import HRAttritionDashboard    from './pages/HRAttritionDashboard';
import HRTerminationForm       from './pages/HRTerminationForm';
import ExitInterviewSurvey     from './pages/ExitInterviewSurvey';
```

### 🆕 Routes Added (19 elements)

```jsx
{/* HR Module — wrapped routes */}
<Route path="/HREmployees"            element={<LayoutWrapper currentPageName="HREmployees"><HREmployees /></LayoutWrapper>} />
<Route path="/HRAttendanceLogs"       element={<LayoutWrapper currentPageName="HRAttendanceLogs"><HRAttendanceLogs /></LayoutWrapper>} />
<Route path="/HRAttendanceSummary"    element={<LayoutWrapper currentPageName="HRAttendanceSummary"><HRAttendanceSummary /></LayoutWrapper>} />
<Route path="/HREmployeeDailyHours"   element={<LayoutWrapper currentPageName="HREmployeeDailyHours"><HREmployeeDailyHours /></LayoutWrapper>} />
<Route path="/HRManualPunchRequest"   element={<LayoutWrapper currentPageName="HRManualPunchRequest"><HRManualPunchRequest /></LayoutWrapper>} />
<Route path="/HRManualPunchApprovals" element={<LayoutWrapper currentPageName="HRManualPunchApprovals"><HRManualPunchApprovals /></LayoutWrapper>} />
<Route path="/HRAttendanceAlerts"     element={<LayoutWrapper currentPageName="HRAttendanceAlerts"><HRAttendanceAlerts /></LayoutWrapper>} />
<Route path="/HRShiftTimings"         element={<LayoutWrapper currentPageName="HRShiftTimings"><HRShiftTimings /></LayoutWrapper>} />
<Route path="/HRHolidays"             element={<LayoutWrapper currentPageName="HRHolidays"><HRHolidays /></LayoutWrapper>} />
<Route path="/HRDepartments"          element={<LayoutWrapper currentPageName="HRDepartments"><HRDepartments /></LayoutWrapper>} />
<Route path="/HRDesignations"         element={<LayoutWrapper currentPageName="HRDesignations"><HRDesignations /></LayoutWrapper>} />
<Route path="/HRBranches"             element={<LayoutWrapper currentPageName="HRBranches"><HRBranches /></LayoutWrapper>} />
<Route path="/HRCompanies"            element={<LayoutWrapper currentPageName="HRCompanies"><HRCompanies /></LayoutWrapper>} />
<Route path="/HRLeaveTypes"           element={<LayoutWrapper currentPageName="HRLeaveTypes"><HRLeaveTypes /></LayoutWrapper>} />
<Route path="/HRNotificationSettings" element={<LayoutWrapper currentPageName="HRNotificationSettings"><HRNotificationSettings /></LayoutWrapper>} />
<Route path="/HRCandidateLeads"       element={<LayoutWrapper currentPageName="HRCandidateLeads"><HRCandidateLeads /></LayoutWrapper>} />
<Route path="/HRAttritionDashboard"   element={<LayoutWrapper currentPageName="HRAttritionDashboard"><HRAttritionDashboard /></LayoutWrapper>} />
<Route path="/HRTerminationForm"      element={<LayoutWrapper currentPageName="HRTerminationForm"><HRTerminationForm /></LayoutWrapper>} />

{/* Public exit interview survey — no layout, no auth gate (token-validated server-side) */}
<Route path="/ExitInterviewSurvey" element={<ExitInterviewSurvey />} />
```

### 🚨 Special Case: `/ExitInterviewSurvey`

**This route is intentionally unwrapped** — no `LayoutWrapper`, no auth check. Security relies entirely on the survey token (16–100 chars, 30-day TTL, validated server-side in `submitExitInterviewSurvey`).

**Reviewer must confirm:**
- Main app's `AuthProvider` does not redirect-on-mount for unauthenticated users on this path.
- If a global auth guard exists (e.g. middleware-style route gate), `/ExitInterviewSurvey` must be explicitly whitelisted.

### 🔧 Merge Action

**Step 1:** Open main app's `App.jsx`.
**Step 2:** Add the 19 import statements alongside existing page imports (alphabetical or grouped by module — match main app's convention).
**Step 3:** Locate the `<Routes>` block. Add the 19 explicit `<Route>` elements. Keep all 18 HR routes wrapped with `LayoutWrapper`. Add `/ExitInterviewSurvey` as an unwrapped route.
**Step 4:** Add HR page components to the `PAGE_COMPONENTS` lookup map (so the auto-loop also recognises them — defensive belt-and-suspenders).
**Step 5:** Smoke test: navigate to `/HRCandidateLeads` (auth required, layout rendered) and `/ExitInterviewSurvey?token=test` (no auth, no layout).

### ⚠️ Conflict Risk: 🔴 HIGH
- `App.jsx` is touched by virtually every feature branch.
- Imports + routes both grow in append-style — manual diff and merge.
- Public-route placement is a security-sensitive change.

---

## 4. `functions/syncToGoogleSheets.js` — Name Clash Warning

### 🎯 Responsibility
Backend Deno function that pushes individual entity records to Google Sheets via a webhook. **In this branch's version, scope is Sales — NOT HR.**

### ⚙️ How It Works
- Accepts `{ entity_type, entity_id }` payload.
- Authenticates the caller via `createClientFromRequest(req)`.
- Reads the matching record from the relevant entity using service-role privileges.
- Maps fields to a flat row object based on `entity_type`.
- POSTs `{ meta: { doctype, sheet_name }, data: [row] }` to `Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL')`.
- Returns the webhook's response text.

### 🗂️ Entities Affected (this branch's version)
- `SalesOrder`
- `SalesInvoice`
- `SalesDeliveryNote`
- `SalesPicklist`
- `SalesDispatch`
- `SalesPayment`

> ⚠️ Despite living in an HR-feature branch, this file's logic is Sales-domain. It does **not** affect any HR entity directly.

### 🚨 The Clash Problem

Main app **already has** `functions/syncToGoogleSheets.js` (per `<existing_backend_functions>` list).

| Scenario | Action |
|---|---|
| Main app's version is identical to this branch's | Do not copy — leave main app's untouched |
| Main app's version is different but same Sales scope | Diff line-by-line; pick the more complete one |
| Main app's version is for a *different* domain (e.g. Production) | **Rename one of them.** Suggested: rename HR-branch file to `syncSalesToGoogleSheets.js` and update any callers |

### 🔍 SDK Version Note

This branch's file imports `npm:@base44/sdk@0.8.23` while main app standard is `0.8.25`. After resolving the clash:
- Bump the chosen version's import to `npm:@base44/sdk@0.8.25` for consistency.

### 🔧 Merge Action

**Step 1:** Run `find functions -name "syncToGoogleSheets.js"` in main app.
**Step 2:** If exists, `diff` against this branch's version.
**Step 3:** Decide: keep main / overwrite / rename. Document the decision.
**Step 4:** Bump SDK version to `0.8.25`.
**Step 5:** Verify any frontend caller (`base44.functions.invoke('syncToGoogleSheets', ...)`) still resolves correctly.

### ⚠️ Conflict Risk: 🔴 HIGH
- File name is generic; collision is likely.
- Silent overwrite would lose either Sales or HR sync logic.

---

## 5. Missing Secrets

### 🎯 Responsibility
Environment variables consumed by backend functions to authenticate against external services. Stored in Base44 dashboard, **never in code**.

### Currently Set
```
ATTENDANCE_API_KEY      ✅ (used by ingestBiometricPunch / captureAttendance)
LBL_DPT_PC_01_TKN       ✅ (used by Labelling print server)
ADAEQUARE_USERNAME      ✅ (used by GST compliance)
```

### ❌ Missing for HR Module

| Secret | Used By | Failure Mode If Missing |
|---|---|---|
| `GOOGLE_SHEETS_WEBHOOK_URL` | `syncToGoogleSheets.js`, `syncHRAttritionToSheets.js` | Functions return 500 with `"GOOGLE_SHEETS_WEBHOOK_URL not set"` |

> Note: `ATTENDANCE_API_KEY` was previously listed as "missing" in some review notes — it is **already set** per the current secret inventory above. The only HR-module-specific secret to add is the Google Sheets webhook URL.

### 🗂️ Entities Affected
None directly — but `CandidateLead` attrition exports and Sales doc syncs will fail until the secret exists.

### 🔧 Merge Action

**Step 1:** Provision a Google Apps Script Web App that accepts POST `{ meta, data }` and writes rows to your spreadsheet.
**Step 2:** In Base44 dashboard → Settings → Environment Variables, add:
```
GOOGLE_SHEETS_WEBHOOK_URL = https://script.google.com/macros/s/.../exec
```
**Step 3:** Test: invoke `syncHRAttritionToSheets` from `HRAttritionDashboard`'s `BIExportPanel` — confirm rows appear in target sheet.

### ⚠️ Conflict Risk: 🟢 LOW
- Pure configuration step. Cannot conflict with code.
- But: HR features that depend on it will silently fail until set.

---

## 6. Missing DB Seeds

### 🎯 Responsibility
Database records required for the HR module to function correctly post-merge. Code alone is insufficient — these rows must exist for permissions, automations, and notifications to work.

### 6.1 `AppRole` — New Roles

Three new role keys are referenced throughout the registry, layout, and pages.

**Required records in `AppRole` entity:**

```json
[
  {
    "role_key": "hr_manager",
    "role_label": "HR Manager",
    "module_access": ["DASHBOARD", "HR", "FMS"],
    "is_active": true,
    "description": "Full HR module access including masters and settings"
  },
  {
    "role_key": "hr_supervisor",
    "role_label": "HR Supervisor",
    "module_access": ["DASHBOARD", "HR", "FMS"],
    "is_active": true,
    "description": "Day-to-day HR ops, no master CRUD"
  },
  {
    "role_key": "hr_user",
    "role_label": "HR User",
    "module_access": ["DASHBOARD", "HR"],
    "is_active": true,
    "description": "View-only access to attendance and candidate records"
  }
]
```

**Without these:** Users assigned an `hr_*` role will see an empty sidebar and be blocked from every HR page (registry's `roles: [...]` checks fail).

### 6.2 `FMSProcess` — New Workflow Definitions

The HR module **auto-triggers two FMS processes**. If the corresponding `FMSProcess` records don't exist, `triggerFMSProcess()` calls fail silently (best-effort try/catch wrapped — user actions still complete, but no workflow starts).

#### Process A: Onboarding (triggered on `candidate_hired`)

```json
{
  "process_name": "Employee Onboarding",
  "trigger_source": "candidate_hired",
  "category": "HR",
  "is_active": true,
  "description": "Standard onboarding flow for newly hired candidates"
}
```

Add `FMSProcessStep` rows for: documentation collection, ID card issue, training assignment, etc. (left to HR ops to define).

#### Process B: Exit (triggered on `employee_exit_initiated`)

```json
{
  "process_name": "Employee Exit",
  "trigger_source": "employee_exit_initiated",
  "category": "HR",
  "is_active": true,
  "description": "Offboarding flow for terminated employees"
}
```

Add steps for: asset return, exit interview, final settlement, access revocation.

### 6.3 `HRNotificationConfig` — Singleton Settings Record

This entity already exists in the codebase (verified). It expects a singleton row with `config_key: 'DEFAULT'`.

**Required record:**

```json
{
  "config_key": "DEFAULT",
  "hr_emails": ["hr@yourcompany.com"],
  "alert_on_missing_out": true,
  "alert_on_missing_in": true,
  "alert_on_no_punches": false,
  "alert_on_flagged": false,
  "skip_holidays": true,
  "skip_weekly_off": true,
  "is_active": true,
  "notes": "Default HR alert configuration — edit via HRNotificationSettings page"
}
```

**Without it:** `sendAttendanceAnomalyAlert` function has no recipient list and silently no-ops; the `HRNotificationSettings` page will show an empty form with all defaults.

### 6.4 Optional but Recommended: HR Master Data Seeds

For `CandidateLeadFormDialog` smart dropdowns to feel populated on day one:

| Entity | Suggested seed values |
|---|---|
| `CandidateSourceType` | Market Visit, Walk-in, Incoming Call, Referral |
| `CandidateContactMode` | In-person, Phone, WhatsApp |
| `CandidateLocation` | (leave empty — auto-populates as HR adds) |
| `CandidateRole` | Helper, Packing, Loading, Operator |
| `Department` | (already seeded in main app — verify) |

Smart dropdowns auto-create entries on free-text input, so this is optional UX polish, not a hard requirement.

### 🔧 Merge Action

**Step 1 (AppRoles):** In Base44 dashboard → Data → AppRole, add the 3 records above. Also update `RoleModuleAccess` entries if main app uses that pattern for granular module access.

**Step 2 (FMSProcesses):** In Base44 dashboard → Data → FMSProcess, add the 2 process records. Build out `FMSProcessStep` children based on actual HR workflow.

**Step 3 (HRNotificationConfig):** Open `/HRNotificationSettings` post-merge → save the form once → singleton row created automatically. OR insert directly via dashboard with the JSON above.

**Step 4 (Optional masters):** Insert via dashboard or let HR populate organically through the smart dropdowns.

**Step 5 (Verification):**
- Log in as `hr_manager` user → confirm HR module visible in sidebar
- Hire a test candidate → confirm onboarding FMS instance created
- Terminate the same candidate → confirm exit FMS instance + survey email
- Open `/HRNotificationSettings` → confirm form pre-populated

### ⚠️ Conflict Risk: 🟢 LOW
- These are data operations, not code merges. No git conflict possible.
- Risk is operational: if forgotten, HR features appear broken without obvious error.

---

## 📋 Consolidated Pre-Merge Checklist

Quick reference — all 6 items in execution order:

- [ ] **§1** Append 6 HR events to `lib/fmsAppEvents.js`
- [ ] **§2** Add HR module + 18 pages + 7 icon imports to `lib/registryConfig.js`
- [ ] **§3** Add 19 imports + 19 routes (incl. unwrapped `/ExitInterviewSurvey`) to `App.jsx`
- [ ] **§4** Resolve `syncToGoogleSheets.js` clash (diff/rename/keep)
- [ ] **§5** Set `GOOGLE_SHEETS_WEBHOOK_URL` secret in Base44 dashboard
- [ ] **§6a** Seed `AppRole` records: `hr_manager`, `hr_supervisor`, `hr_user`
- [ ] **§6b** Seed `FMSProcess` records: Onboarding, Exit
- [ ] **§6c** Seed `HRNotificationConfig` singleton (or open settings page once)

---

**End of Companion Doc.** Cross-reference with `MERGE_README.md` for full file inventory and entity schemas.