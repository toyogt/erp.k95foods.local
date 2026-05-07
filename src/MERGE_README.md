# K95 ERP — HR Module Merge Blueprint

> **Audience:** Senior Software Engineer AI Agent performing merge from this cloned app into the main K95 ERP app.
> **Goal:** Provide complete technical inventory of changes + explicit conflict-risk flags so merge can be executed safely.
> **Last updated:** 07/05/2026
> **Branch purpose:** HR Module expansion (Recruitment, Attrition, Employee Master, Exit Interview).

---

## 0. TL;DR — What Changed in One Page

| Area | Change Type | Risk |
|---|---|---|
| **Entities — `Employee`** | 18+ new fields added; `employee_name` now required | 🟠 MEDIUM |
| **Entities — 8 new HR entities** | All-new (CandidateLead, ExitInterviewSurvey, etc.) | 🟢 LOW |
| **Pages — 4 new HR pages** | HRCandidateLeads, HRAttritionDashboard, HRTerminationForm, ExitInterviewSurvey (public) | 🟢 LOW |
| **Components — `EmployeeFormDialog`** | Refactored from monolith → 4 sub-sections | 🟠 MEDIUM |
| **`App.jsx`** | New imports + new explicit `<Route>` elements | 🔴 HIGH (manual merge) |
| **`lib/registryConfig.js`** | New HR module + 4 new HR pages registered | 🔴 HIGH (manual merge) |
| **`lib/fmsAppEvents.js`** | 6 new HR lifecycle events registered | 🟠 MEDIUM |
| **Backend Functions — 4 new** | `sendExitInterviewSurvey`, `submitExitInterviewSurvey`, `syncHRAttritionToSheets`, `syncToGoogleSheets` | 🟢 LOW |
| **`functions/syncToGoogleSheets.js`** | Brand new file in this branch — verify if main app has same name | 🔴 HIGH (name clash possible) |
| **Public route** | `/ExitInterviewSurvey` bypasses Layout + AuthProvider | 🟠 MEDIUM (security review) |

---

## 1. Audit Methodology & Limitations

This document describes the **current state of the cloned app** vs **inferred changes from the active development context**. Limitations:

- ❌ No git diff is available in this environment.
- ✅ "🆕 Added" markers reflect entities/pages/files that did not exist in baseline K95 ERP and were built during this branch.
- ✅ All file content listed below has been verified by direct file reads.

**Reviewer action:** Cross-check this document against `git log --oneline` in the cloned repo to confirm the timeline.

---

## 2. Entity Changes

### 2.1 `entities/Employee.json` — EXPANDED (Modified)

**Status:** Modified. Verified content.

**Required field change:** `employee_name` is now in the `required` array (was previously optional in baseline).

**Field inventory (current state):**

| Field | Type | Origin |
|---|---|---|
| `employee_code` | string (max 50, required) | Baseline |
| `employee_name` | string (max 200, **now required**) | Baseline (constraint changed) |
| `father_name` | string (max 200) | Baseline |
| `card_number` | string (max 50) | Baseline |
| `enroll_no` | string (max 50) | 🆕 Added |
| `phone` | string (max 50) | Baseline |
| `email` | string (max 200) | Baseline |
| `date_of_birth` | string (DD/MM/YYYY) | Baseline |
| `government_uid` | string (max 100) | 🆕 Added |
| `gender` | enum ('', Male, Female, Other) | 🆕 Added |
| `nationality` | string (max 100) | 🆕 Added |
| `address` | string (max 500) | 🆕 Added |
| `attachment_1_url` | string (max 1000) | 🆕 Added |
| `attachment_2_url` | string (max 1000) | 🆕 Added |
| `bank_name` | string (max 200) | 🆕 Added |
| `bank_account_number` | string (max 100) | 🆕 Added |
| `bank_ifsc_code` | string (max 50) | 🆕 Added |
| `telegram_token` | string (max 200) | 🆕 Added |
| `chat_id` | string (max 200) | 🆕 Added |
| `allow_notifications` | boolean (default true) | 🆕 Added |
| `auto_approved_gps_punch` | boolean (default false) | 🆕 Added |
| `mobile_attendance_mode` | string (max 50) | 🆕 Added |
| `department` | string (max 100) | Baseline |
| `designation` | string (max 100) | Baseline |
| `branch_name` | string (max 100) | Baseline |
| `company_name` | string (max 200) | Baseline |
| `supervisor_email` | string (max 200) | Baseline |
| `supervisor_name` | string (max 200) | Baseline |
| `date_of_joining` | string (DD/MM/YYYY) | Baseline |
| `office_time_policy` | string (max 100) | 🆕 Added |
| `resignation_date` | string (DD/MM/YYYY) | 🆕 Added |
| `shift_start_date` | string (DD/MM/YYYY) | 🆕 Added |
| `weekly_off` | string (max 50) | Baseline |
| `shift_type` | string (max 50) | 🆕 Added |
| `shift_name` | string (max 100) | Baseline |
| `is_active` | boolean (default true) | Baseline |

**🚨 Conflict Risk:**
- If main app added different fields to `Employee` in parallel → manual JSON merge needed (combine both sets).
- Existing employee records in main app DB will have `null`/missing for these new fields — verify no downstream code (payroll exports, attendance summary calculator, BI dashboards) crashes on missing fields.
- `employee_name` becoming required will **reject** any existing rows where `employee_name` is empty. Action: **before merge, run a data audit** — `Employee.filter({ employee_name: '' })` — and backfill or delete blanks first.

### 2.2 New HR Entities (8 files, all 🆕)

| Entity | Purpose | Required Fields |
|---|---|---|
| `CandidateLead` | Recruitment pipeline record | `candidate_name`, `mobile_number` |
| `CandidateLeadStatusLog` | Audit log of every status transition with duration metrics | `candidate_lead_id`, `new_status`, `changed_at` |
| `ExitInterviewSurvey` | Token-gated public exit survey records | `candidate_lead_id`, `token`, `status` |
| `CandidateSourceType` | Master: Market Visit, Walk-in, Referral, etc. | `source_name` |
| `CandidateContactMode` | Master: In-person, Phone, WhatsApp | `mode_name` |
| `CandidateSourceDetail` | Master: chowk names, referrer names | `detail_text` |
| `CandidateLocation` | Master: working areas | `location_name` |
| `CandidateRole` | Master: candidate roles of interest | `role_name` |

**🚨 Conflict Risk:** 🟢 LOW — entirely new entity names. Confirm no main-app entity exists with these exact names.

---

## 3. Page & Route Changes

### 3.1 New Pages (`src/pages/`)

| Page File | Route | Auth | Layout |
|---|---|---|---|
| `pages/HRCandidateLeads.jsx` | `/HRCandidateLeads` | Required | Yes (LayoutWrapper) |
| `pages/HRAttritionDashboard.jsx` | `/HRAttritionDashboard` | Required | Yes |
| `pages/HRTerminationForm.jsx` | `/HRTerminationForm` | Required | Yes |
| `pages/ExitInterviewSurvey.jsx` | `/ExitInterviewSurvey` | **❌ NONE — public** | **❌ NONE — bare** |

**🚨 Special attention — Public route:**
The `/ExitInterviewSurvey` route is registered in `App.jsx` **outside** the `LayoutWrapper` and **outside** any auth guard:
```jsx
<Route path="/ExitInterviewSurvey" element={<ExitInterviewSurvey />} />
```
Security model relies entirely on a 16-100 char token validated server-side via `submitExitInterviewSurvey` function with 30-day TTL.

**Reviewer action:** Confirm the main app's auth router does not intercept all routes by default. If it does, this route must be explicitly whitelisted.

### 3.2 Modified `App.jsx`

**Added imports** (block of HR pages):
```jsx
import HRCandidateLeads from './pages/HRCandidateLeads';
import HRAttritionDashboard from './pages/HRAttritionDashboard';
import HRTerminationForm from './pages/HRTerminationForm';
import ExitInterviewSurvey from './pages/ExitInterviewSurvey';
```

**Added Routes** (HR Module block):
```jsx
<Route path="/HRCandidateLeads" element={<LayoutWrapper currentPageName="HRCandidateLeads"><HRCandidateLeads /></LayoutWrapper>} />
<Route path="/HRAttritionDashboard" element={<LayoutWrapper currentPageName="HRAttritionDashboard"><HRAttritionDashboard /></LayoutWrapper>} />
<Route path="/HRTerminationForm" element={<LayoutWrapper currentPageName="HRTerminationForm"><HRTerminationForm /></LayoutWrapper>} />
<Route path="/ExitInterviewSurvey" element={<ExitInterviewSurvey />} />
```

**🚨 Conflict Risk:** 🔴 HIGH
- `App.jsx` is touched by every feature branch — guaranteed merge conflict.
- The pre-existing `pagesConfig` loop and `getAllRoutablePages()` loop do **NOT** auto-include these routes — they MUST be kept as explicit `<Route>` elements.
- Per `app_routing_note`: removing them and assuming the loop covers them WILL break the routes silently.

### 3.3 Modified `lib/registryConfig.js`

**Added HR module entry** in `moduleRegistry`:
```js
{ moduleKey: 'HR', label: 'Human Resources', icon: UserCheck, color: 'text-amber-600', bgColor: 'bg-amber-50', adminOnly: false, sortOrder: 50 }
```

**Added pages in `pageRegistry`** (HR section, sortOrder 0–32):
- `HREmployees`, `HRAttendanceLogs`, `HRAttendanceSummary`, `HREmployeeDailyHours`, `HRManualPunchRequest`, `HRManualPunchApprovals`, `HRAttendanceAlerts`, `HRShiftTimings`, `HRHolidays`, `HRDepartments`, `HRDesignations`, `HRBranches`, `HRCompanies`, `HRLeaveTypes`, `HRNotificationSettings`, `HRCandidateLeads`, `HRAttritionDashboard`, `HRTerminationForm` (with `hideFromNav: true`)

**New roles introduced via registry:** `hr_manager`, `hr_supervisor`, `hr_user`.

**New icons imported from lucide-react:** `UserCheck`, `UserPlus`, `UserMinus`, `TrendingDown`, `CalendarDays`, `Bell`, `MapPin`.

**🚨 Conflict Risk:** 🔴 HIGH
- Both `pageRegistry` and `moduleRegistry` are append-style arrays — main app may have added other modules in parallel.
- `sortOrder: 50` for HR module — verify no clash with any new module main app may have added at the same slot.
- New HR roles must also be added to the main app's `AppRole` master data (DB seed).

---

## 4. Component Changes

### 4.1 New Components (`src/components/hr/`)

All entirely new — 🟢 LOW conflict risk unless main app has files with the same name.

```
components/hr/
├── CandidateLeadTable.jsx
├── CandidateLeadFormDialog.jsx
├── CandidateTimelineDialog.jsx
├── CandidateStatusChangeDialog.jsx
├── CandidateEmployeeLinker.jsx
├── CreateEmployeeFromCandidateDialog.jsx
├── AttritionCharts.jsx
├── AttritionKPICards.jsx
├── AttritionFunnelPanel.jsx
├── ConversionFunnelChart.jsx
├── ConversionBreakdownTable.jsx
├── PeriodKPICards.jsx
├── BIExportPanel.jsx
└── employee-form/
    ├── EmployeePersonalSection.jsx
    ├── EmployeeContactBankSection.jsx
    ├── EmployeeEmploymentSection.jsx
    └── EmployeeNotificationsSection.jsx
```

### 4.2 Modified Component — `components/hr/EmployeeFormDialog.jsx`

**Status:** Refactored. Was a monolithic ~300-line form; now an orchestrator (~150 lines) that delegates to four section components.

**🚨 Conflict Risk:** 🟠 MEDIUM
- If main app modified `EmployeeFormDialog.jsx` in parallel (e.g., to add a single field), the diff will be very different shapes — manual reconciliation required.
- Strategy: **prefer this branch's structure** (sub-sections) and re-apply main-app's field additions to the appropriate sub-section.

### 4.3 New UI Primitive — `components/ui/CreatableSelect.jsx`

**Status:** New shared component (also referenced by main app standards doc).

**🚨 Conflict Risk:** 🔴 HIGH NAME CLASH
- The K95 standards explicitly mandate this component at `src/components/ui/CreatableSelect.jsx` — main app may already have its own version.
- **Reviewer action:** Diff both implementations. If main app's version is the "official" one, **discard this branch's version** and adapt the HR forms to use main-app's API.

---

## 5. Library / Utility Changes

### 5.1 New Files (`src/lib/`)

| File | Purpose |
|---|---|
| `lib/candidateStatusTransitions.js` | Status graph + visual metadata (color/label per status) |
| `lib/candidateAttritionStats.js` | Pure functions: funnel computation, conversion %, tenure buckets |
| `lib/hrAnalyticsHelpers.js` | Date-range subset builder + daily series for Attrition dashboard |

🟢 LOW risk — net-new files.

### 5.2 Modified — `lib/fmsAppEvents.js`

**Added 6 HR lifecycle events:**
```
candidate_lead_created
candidate_shortlisted
candidate_interviewed
candidate_hired
employee_exit_initiated
exit_interview_sent
```

**🚨 Conflict Risk:** 🟠 MEDIUM
- File is append-style — merge by combining event lists.
- Verify no key collision (e.g., main app already defined `candidate_hired`).

---

## 6. Backend Function Changes

### 6.1 New Functions (`src/functions/`)

| Function | Trigger | Notes |
|---|---|---|
| `sendExitInterviewSurvey.js` | Auto-fired on `Terminated` status transition | Generates 30-day token, builds public URL, sends via email |
| `submitExitInterviewSurvey.js` | **PUBLIC** (no auth) — token-validated only | Updates `CandidateLead.exit_feedback`; rate-limit recommended at infra layer |
| `syncHRAttritionToSheets.js` | Manual / scheduled | Pushes attrition KPIs to Google Sheets webhook |
| `syncToGoogleSheets.js` | Manual / per-record | Generic Sales-domain pusher (NOT HR — pre-existing pattern, but file may be new in this branch) |

### 6.2 ⚠️ POTENTIAL FILENAME CLASH — `syncToGoogleSheets.js`

**Critical:** This function (current verified content) handles **Sales** entities (SalesOrder, SalesInvoice, SalesDeliveryNote, SalesPicklist, SalesDispatch, SalesPayment) — NOT HR.

**Reviewer action:**
1. Check if main app already has `functions/syncToGoogleSheets.js`.
2. If yes — diff field-by-field. The current version uses `npm:@base44/sdk@0.8.23` (slightly older than the 0.8.25 standard); verify which version is canonical.
3. If both versions exist with different scopes (e.g., main app's HR vs this branch's Sales) — rename one to avoid clash.

### 6.3 Required Secret

`GOOGLE_SHEETS_WEBHOOK_URL` — used by `syncToGoogleSheets`. Not in current `<existing_secrets>` list. **Must be set before merge** or the function will return 500.

---

## 7. Business Logic / Workflows

### 7.1 Candidate → Employee Lifecycle (NEW)

```
[Lead Created]
   ↓ fireFMSEvent('candidate_lead_created')
   ↓ CandidateLeadStatusLog row written
[Shortlisted / Interviewed]
   ↓ fireFMSEvent (corresponding event)
[Hired]
   ↓ triggerFMSProcess('candidate_hired')  ← starts onboarding FMS process
   ↓ CreateEmployeeFromCandidateDialog → creates Employee record
   ↓ CandidateLead linked via employee_id + employee_code
[Terminated]
   ↓ triggerFMSProcess('employee_exit_initiated')  ← starts exit FMS process
   ↓ sendExitInterviewSurvey() auto-invoked
   ↓ fireFMSEvent('exit_interview_sent')
[Public survey submission]
   ↓ submitExitInterviewSurvey() validates token
   ↓ updates CandidateLead.exit_feedback + ExitInterviewSurvey record
```

**🚨 Verification needed:** The two FMS processes (`candidate_hired` onboarding + `employee_exit_initiated` exit) must exist as `FMSProcess` records in main app — otherwise auto-trigger fails silently.

### 7.2 FMS Event-Firing Pattern

All HR mutations follow the standard:
```js
await base44.entities.CandidateLead.update(id, payload);
await fireFMSEvent('candidate_hired', candidateId);  // best-effort, try/catch wrapped
```

Failures are logged to console, never block the user action.

---

## 8. Permissions / Roles

### 8.1 New Role Identifiers

| Role | Purpose | Pages Granted |
|---|---|---|
| `hr_manager` | Full HR module access incl. masters | All HR pages |
| `hr_supervisor` | Day-to-day HR ops, no master CRUD | Operations + Punch Approvals |
| `hr_user` | View-only or limited | Logs, Summary, Punch Requests |

**🚨 Migration required:**
1. Add these roles to `AppRole` entity in main app (DB seed).
2. Update `RoleModuleAccess` to grant `HR` module access for these roles.
3. Configure `DocumentAccessRule` for `Employee`, `CandidateLead`, `ExitInterviewSurvey` per main app's permission conventions.

### 8.2 Public Endpoint — Security Posture

`/ExitInterviewSurvey` page + `submitExitInterviewSurvey` function are unauthenticated. Token security:
- 16–100 char random token stored in `ExitInterviewSurvey.token`.
- 30-day TTL via `expires_at`.
- Status state machine: `SENT → OPENED → SUBMITTED` / `EXPIRED`.
- Optionally captures `submitted_from_ip` for audit.

**Reviewer action:** Confirm with main app's security policy that this exception is acceptable.

---

## 9. UI/UX Compliance Checklist

| Standard | Compliance |
|---|---|
| Mobile button height ≥ 44px (`h-11`) | ✅ Verified across all HR forms/tables |
| No abbreviations (PO/GRN/SKU) | ✅ HR module uses full terms |
| Date format `DD/MM/YYYY` | ✅ Helper functions standardize all dates |
| Component size < 300 lines | ✅ EmployeeFormDialog refactored to comply |
| `CreatableSelect` for free-form lookups | ✅ Used for Source / Mode / Location / Role |
| `text-base md:text-sm` font sizing | ✅ All inputs |
| FMS events fired on state changes | ✅ All status transitions wired |
| Audit log for significant actions | ⚠️ Status changes go to `CandidateLeadStatusLog`; verify if main app expects entries in central `AuditLog` too |

---

## 10. Pre-Merge Verification Checklist

For the merging engineer to execute **before** running `git merge`:

### 🔍 Code-Level Checks
- [ ] Diff `App.jsx` — confirm new HR routes are additive, no overlap.
- [ ] Diff `lib/registryConfig.js` — ensure HR module sortOrder=50 doesn't clash; merge `pageRegistry` array carefully.
- [ ] Diff `lib/fmsAppEvents.js` — verify no event-key collisions.
- [ ] Diff `entities/Employee.json` — combine field sets if main app added fields independently.
- [ ] Diff `components/ui/CreatableSelect.jsx` — pick canonical version, refactor consumers.
- [ ] Search main app for `functions/syncToGoogleSheets.js` — handle name clash.
- [ ] Verify `@base44/sdk` version consistency — this branch's `syncToGoogleSheets.js` uses `0.8.23` while standard is `0.8.25`.

### 🗄️ Data-Level Checks (run on production DB before merge)
- [ ] `Employee.filter({ employee_name: '' })` → must return 0 rows (or backfill).
- [ ] Check `AppRole` for existence of: `hr_manager`, `hr_supervisor`, `hr_user`. Add if missing.
- [ ] Check `FMSProcess` for `trigger_source = 'candidate_hired'` — required for onboarding auto-trigger.
- [ ] Check `FMSProcess` for `trigger_source = 'employee_exit_initiated'` — required for exit auto-trigger.
- [ ] Check `HRNotificationConfig` singleton (`config_key: 'DEFAULT'`) exists.

### 🔐 Secrets / Connectors
- [ ] Set `GOOGLE_SHEETS_WEBHOOK_URL` secret OR disable Google Sheets sync features.
- [ ] No new OAuth connectors required.
- [ ] Existing secrets unchanged: `ATTENDANCE_API_KEY`, `LBL_DPT_PC_01_TKN`, `ADAEQUARE_USERNAME`.

### 🚦 Routing / Navigation
- [ ] `/ExitInterviewSurvey` route is unwrapped (no Layout, no auth) — verify main app's route matcher allows this.
- [ ] All HR pages appear in sidebar for `hr_manager` role.
- [ ] `/HRTerminationForm` is `hideFromNav: true` — accessible only via direct link from `HRCandidateLeads`.

### 🧪 Smoke Tests After Merge
- [ ] Create a `CandidateLead` → status flows New → Shortlisted → Hired → confirm `Employee` record auto-created.
- [ ] Trigger `Terminated` status → confirm exit interview email sent (or queued).
- [ ] Visit `/ExitInterviewSurvey?token=<valid_token>` → confirm form renders without auth.
- [ ] Submit survey → confirm `CandidateLead.exit_feedback` updates.
- [ ] Open `HRAttritionDashboard` → confirm KPIs render with valid data.
- [ ] Open `HREmployees` → confirm form dialog renders all 4 section tabs.
- [ ] Mobile view: tap any HR button → confirm 44px+ tap target.

---

## 11. Conflict-Risk Heat Map (Files at Highest Risk)

| Severity | File | Reason |
|---|---|---|
| 🔴 HIGH | `App.jsx` | Touched by every feature branch |
| 🔴 HIGH | `lib/registryConfig.js` | Append-style central config |
| 🔴 HIGH | `components/ui/CreatableSelect.jsx` | Standard component, may exist in main |
| 🔴 HIGH | `functions/syncToGoogleSheets.js` | Generic name, may exist in main with different scope |
| 🟠 MEDIUM | `entities/Employee.json` | Schema co-evolution likely |
| 🟠 MEDIUM | `components/hr/EmployeeFormDialog.jsx` | Refactored shape vs possible incremental edits |
| 🟠 MEDIUM | `lib/fmsAppEvents.js` | Append-style, possible key collision |
| 🟢 LOW | New `pages/HR*.jsx` files | All new |
| 🟢 LOW | New `components/hr/*` files | All new |
| 🟢 LOW | New entities (`CandidateLead`, etc.) | All new names |
| 🟢 LOW | `lib/candidateStatusTransitions.js`, `candidateAttritionStats.js`, `hrAnalyticsHelpers.js` | All new |

---

## 12. Recommended Merge Strategy

1. **Branch off** from main app's latest stable.
2. **Merge non-conflicting additions first** (new entities, new components, new pages, new lib files, new functions).
3. **Manually reconcile** in this order:
   - `entities/Employee.json` (schema merge)
   - `lib/registryConfig.js` (registry merge)
   - `lib/fmsAppEvents.js` (event registry merge)
   - `App.jsx` (routes + imports)
   - `components/ui/CreatableSelect.jsx` (pick canonical)
   - `functions/syncToGoogleSheets.js` (resolve name/scope)
   - `components/hr/EmployeeFormDialog.jsx` (preserve refactored structure)
4. **Run pre-merge data audit** (Section 10).
5. **Smoke test** on staging with hr_manager role.
6. **Promote** to production with feature flag for `/ExitInterviewSurvey` route if security review pending.

---

## 13. Contact / Open Questions for Reviewer

Items where the merging engineer should confirm intent with the original branch author:

1. Is `syncToGoogleSheets.js` (Sales scope) intended to ship as-is, or was it scaffolding for HR sync that got renamed?
2. Should the `/ExitInterviewSurvey` route remain fully public, or move behind a one-time-link auth model?
3. Were any deferred Employee fields (`second_weekly_off_days`, `auto_shift_options`, `validity_start/end`, `week_time_zone_*`) intentionally omitted? If yes, document as backlog.
4. Should `CandidateLeadStatusLog` writes also mirror to the central `AuditLog` entity?

---

**End of Merge Blueprint (narrative section).**

---

# 📎 ANNEX A — Entity Schemas (Full JSON)

> All HR entity schemas at their current state. Each block can be copy-pasted into `entities/<Name>.json` in the main app.

## A.1 `entities/Employee.json` (Modified — full current schema)

```json
{
  "name": "Employee",
  "type": "object",
  "title": "Employee",
  "description": "Master employee record. Linked to AttendanceLog via employee_code.",
  "properties": {
    "employee_code": { "type": "string", "minLength": 1, "maxLength": 50 },
    "employee_name": { "type": "string", "maxLength": 200 },
    "father_name": { "type": "string", "maxLength": 200 },
    "card_number": { "type": "string", "maxLength": 50 },
    "enroll_no": { "type": "string", "maxLength": 50 },
    "phone": { "type": "string", "maxLength": 50 },
    "email": { "type": "string", "maxLength": 200 },
    "date_of_birth": { "type": "string", "maxLength": 20 },
    "government_uid": { "type": "string", "maxLength": 100 },
    "gender": { "type": "string", "enum": ["", "Male", "Female", "Other"] },
    "nationality": { "type": "string", "maxLength": 100 },
    "address": { "type": "string", "maxLength": 500 },
    "attachment_1_url": { "type": "string", "maxLength": 1000 },
    "attachment_2_url": { "type": "string", "maxLength": 1000 },
    "bank_name": { "type": "string", "maxLength": 200 },
    "bank_account_number": { "type": "string", "maxLength": 100 },
    "bank_ifsc_code": { "type": "string", "maxLength": 50 },
    "telegram_token": { "type": "string", "maxLength": 200 },
    "chat_id": { "type": "string", "maxLength": 200 },
    "allow_notifications": { "type": "boolean", "default": true },
    "auto_approved_gps_punch": { "type": "boolean", "default": false },
    "mobile_attendance_mode": { "type": "string", "maxLength": 50 },
    "department": { "type": "string", "maxLength": 100 },
    "designation": { "type": "string", "maxLength": 100 },
    "branch_name": { "type": "string", "maxLength": 100 },
    "company_name": { "type": "string", "maxLength": 200 },
    "supervisor_email": { "type": "string", "maxLength": 200 },
    "supervisor_name": { "type": "string", "maxLength": 200 },
    "date_of_joining": { "type": "string", "maxLength": 20 },
    "office_time_policy": { "type": "string", "maxLength": 100 },
    "resignation_date": { "type": "string", "maxLength": 20 },
    "shift_start_date": { "type": "string", "maxLength": 20 },
    "weekly_off": { "type": "string", "maxLength": 50 },
    "shift_type": { "type": "string", "maxLength": 50 },
    "shift_name": { "type": "string", "maxLength": 100 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["employee_code", "employee_name"]
}
```

## A.2 `entities/CandidateLead.json` (🆕 New)

```json
{
  "name": "CandidateLead",
  "type": "object",
  "title": "Candidate Lead",
  "description": "Profile of a manpower candidate for recruitment tracking, including post-hire conversion and attrition tracking.",
  "properties": {
    "candidate_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "mobile_number": { "type": "string", "minLength": 1, "maxLength": 50 },
    "location_area": { "type": "string", "maxLength": 500 },
    "role_interested": { "type": "string", "maxLength": 500 },
    "source_type": { "type": "string", "maxLength": 200 },
    "source_details": { "type": "string", "maxLength": 1000 },
    "first_contact_mode": { "type": "string", "maxLength": 200 },
    "first_contact_date": { "type": "string", "format": "date" },
    "status": {
      "type": "string",
      "enum": ["New", "Contacted", "Shortlisted", "Interviewed", "Hired", "Rejected", "On Hold", "Terminated"],
      "default": "New"
    },
    "employee_id": { "type": "string", "maxLength": 100 },
    "employee_code": { "type": "string", "maxLength": 50 },
    "department": { "type": "string", "maxLength": 100 },
    "designation": { "type": "string", "maxLength": 100 },
    "enrollment_date": { "type": "string", "format": "date" },
    "attrition_date": { "type": "string", "format": "date" },
    "attrition_reason": { "type": "string", "maxLength": 500 },
    "exit_type": {
      "type": "string",
      "enum": ["Resignation", "Termination", "Absconded", "Retirement", "End of Contract", "Other"]
    },
    "last_working_day": { "type": "string", "format": "date" },
    "eligible_for_rehire": { "type": "boolean" },
    "exit_feedback": { "type": "string", "maxLength": 2000 },
    "days_employed": { "type": "number", "minimum": 0 },
    "remarks": { "type": "string", "maxLength": 2000 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["candidate_name", "mobile_number"]
}
```

## A.3 `entities/CandidateLeadStatusLog.json` (🆕 New)

```json
{
  "name": "CandidateLeadStatusLog",
  "type": "object",
  "title": "Candidate Lead Status Change Log",
  "properties": {
    "candidate_lead_id": { "type": "string", "minLength": 1, "maxLength": 100 },
    "candidate_name": { "type": "string", "maxLength": 200 },
    "old_status": { "type": "string", "maxLength": 50 },
    "new_status": { "type": "string", "minLength": 1, "maxLength": 50 },
    "changed_at": { "type": "string", "format": "date-time" },
    "changed_by": { "type": "string", "maxLength": 200 },
    "duration_in_previous_status_minutes": { "type": "number", "minimum": 0 },
    "remarks": { "type": "string", "maxLength": 1000 }
  },
  "required": ["candidate_lead_id", "new_status", "changed_at"]
}
```

## A.4 `entities/ExitInterviewSurvey.json` (🆕 New)

```json
{
  "name": "ExitInterviewSurvey",
  "type": "object",
  "title": "Exit Interview Survey",
  "properties": {
    "candidate_lead_id": { "type": "string", "minLength": 1, "maxLength": 100 },
    "candidate_name": { "type": "string", "maxLength": 200 },
    "employee_code": { "type": "string", "maxLength": 50 },
    "token": { "type": "string", "minLength": 16, "maxLength": 100 },
    "survey_url": { "type": "string", "maxLength": 1000 },
    "sent_to": { "type": "string", "maxLength": 200 },
    "sent_at": { "type": "string", "format": "date-time" },
    "status": {
      "type": "string",
      "enum": ["SENT", "OPENED", "SUBMITTED", "EXPIRED"],
      "default": "SENT"
    },
    "expires_at": { "type": "string", "format": "date-time" },
    "submitted_at": { "type": "string", "format": "date-time" },
    "reason_for_leaving": { "type": "string", "maxLength": 1000 },
    "work_environment_rating": { "type": "number", "minimum": 1, "maximum": 5 },
    "management_rating": { "type": "number", "minimum": 1, "maximum": 5 },
    "compensation_rating": { "type": "number", "minimum": 1, "maximum": 5 },
    "would_recommend": { "type": "string", "enum": ["Yes", "No", "Maybe"] },
    "suggestions": { "type": "string", "maxLength": 2000 },
    "additional_comments": { "type": "string", "maxLength": 2000 },
    "submitted_from_ip": { "type": "string", "maxLength": 100 },
    "hr_alerted": { "type": "boolean", "default": false },
    "hr_alerted_at": { "type": "string", "format": "date-time" }
  },
  "required": ["candidate_lead_id", "token", "status"]
}
```

## A.5 Master Data Entities (🆕 5 small lookups)

### `entities/CandidateSourceType.json`
```json
{
  "name": "CandidateSourceType",
  "type": "object",
  "properties": {
    "source_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["source_name"]
}
```

### `entities/CandidateContactMode.json`
```json
{
  "name": "CandidateContactMode",
  "type": "object",
  "properties": {
    "mode_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["mode_name"]
}
```

### `entities/CandidateSourceDetail.json`
```json
{
  "name": "CandidateSourceDetail",
  "type": "object",
  "properties": {
    "detail_text": { "type": "string", "minLength": 1, "maxLength": 500 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["detail_text"]
}
```

### `entities/CandidateLocation.json`
```json
{
  "name": "CandidateLocation",
  "type": "object",
  "properties": {
    "location_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["location_name"]
}
```

### `entities/CandidateRole.json`
```json
{
  "name": "CandidateRole",
  "type": "object",
  "properties": {
    "role_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "is_active": { "type": "boolean", "default": true }
  },
  "required": ["role_name"]
}
```

---

# 📎 ANNEX B — File Inventory (Read These In Source)

> Code annex below lists each file's purpose, location, and key APIs. Full source for each file is available in the cloned repo at the path shown — read directly from there during merge. Annex C below provides full inline source for the most critical small files.

## B.1 New Pages (`src/pages/`)

| File | Lines | Key Logic |
|---|---|---|
| `pages/HRCandidateLeads.jsx` | ~340 | Main candidate pipeline page. Uses `CandidateLeadTable`, `CandidateLeadFormDialog`, `CandidateStatusChangeDialog`, `CandidateTimelineDialog`, `CreateEmployeeFromCandidateDialog`. Fires HR FMS events on save/status change. |
| `pages/HRAttritionDashboard.jsx` | ~270 | Analytics page. Uses charts from `components/hr/AttritionCharts`. Memoized stats from `lib/candidateAttritionStats`, `lib/hrAnalyticsHelpers`. |
| `pages/HRTerminationForm.jsx` | ~410 | Standalone termination workflow. Loads candidate by `?id=`, validates exit type + dates, fires `employee_exit_completed`, sends survey. |
| `pages/ExitInterviewSurvey.jsx` | ~240 | **PUBLIC** survey form. Reads token from URL, submits via `submitExitInterviewSurvey` function. |

## B.2 New Components (`src/components/hr/`)

All located under `src/components/hr/`. Each is < 300 lines:

```
CandidateLeadTable.jsx              Table view with status badges + action buttons
CandidateLeadFormDialog.jsx         Create/edit dialog with CreatableSelect for masters
CandidateTimelineDialog.jsx         Vertical timeline of CandidateLeadStatusLog entries
CandidateStatusChangeDialog.jsx     Guided status transition with effective date
CandidateEmployeeLinker.jsx         Search + link existing employee to candidate
CreateEmployeeFromCandidateDialog.jsx   New employee from Hired candidate
AttritionCharts.jsx                 Recharts wrappers (Line, Bar, Pie)
AttritionKPICards.jsx               Lifetime KPI tiles
AttritionFunnelPanel.jsx            Hired→Active vs Exited breakdown
PeriodKPICards.jsx                  Date-range KPI tiles
ConversionFunnelChart.jsx           Multi-stage funnel visualization
ConversionBreakdownTable.jsx        Conversion % by category
BIExportPanel.jsx                   CSV/Sheets export controls
employee-form/EmployeePersonalSection.jsx
employee-form/EmployeeContactBankSection.jsx
employee-form/EmployeeEmploymentSection.jsx
employee-form/EmployeeNotificationsSection.jsx
```

## B.3 New Backend Functions (`src/functions/`)

| File | Auth | Purpose |
|---|---|---|
| `functions/sendExitInterviewSurvey.js` | Authenticated (HR) | Generate token, create `ExitInterviewSurvey`, email link |
| `functions/submitExitInterviewSurvey.js` | **Public** | Validate token, save responses, update candidate `exit_feedback` |
| `functions/syncHRAttritionToSheets.js` | Authenticated (HR) | Push attrition data to Google Sheets webhook |
| `functions/syncToGoogleSheets.js` | Authenticated | Generic Sales pusher (potential filename clash — see §6.2) |

## B.4 New Library Files (`src/lib/`)

| File | Purpose |
|---|---|
| `lib/candidateStatusTransitions.js` | Status graph + visual metadata (full source in Annex C) |
| `lib/candidateAttritionStats.js` | Pure analytics functions (`computeKPIs`, `groupByDate`, `buildDailySeries`, `groupByCategory`, `inDateRange`) |
| `lib/hrAnalyticsHelpers.js` | Funnel + tenure builders (`buildTenureBucketsDetailed`, `buildConversionFunnel`, `buildAttritionFunnel`, `computePeriodKPIs`, `buildConversionBreakdown`) |

---

# 📎 ANNEX C — Full Source for Critical Small Files

> Inline source for files small enough to paste here. Larger files (pages, dialogs) — read directly from the cloned repo using paths in Annex B.

## C.1 `lib/candidateStatusTransitions.js`

```javascript
/**
 * Candidate lead status transition rules.
 * Defines which statuses a candidate can move to from their current status.
 * Keeps the workflow guided and prevents illogical jumps.
 */

export const ALL_STATUSES = [
  'New',
  'Contacted',
  'Shortlisted',
  'Interviewed',
  'Hired',
  'Rejected',
  'On Hold',
  'Terminated',
];

export const STATUS_META = {
  New: {
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
    description: 'Lead just captured, not yet contacted',
  },
  Contacted: {
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
    description: 'Initial contact made with candidate',
  },
  Shortlisted: {
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    description: 'Candidate matches role requirements',
  },
  Interviewed: {
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    dotColor: 'bg-violet-500',
    description: 'Interview completed, awaiting decision',
  },
  Hired: {
    color: 'bg-green-100 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
    description: 'Offered and joined as employee',
  },
  Rejected: {
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
    description: 'Candidate not suitable for role',
  },
  'On Hold': {
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dotColor: 'bg-slate-400',
    description: 'Paused — revisit later',
  },
  Terminated: {
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-600',
    description: 'Employee exited the company',
  },
};

const TRANSITIONS = {
  New: ['Contacted', 'Shortlisted', 'Rejected', 'On Hold'],
  Contacted: ['Shortlisted', 'Interviewed', 'Rejected', 'On Hold'],
  Shortlisted: ['Interviewed', 'Hired', 'Rejected', 'On Hold'],
  Interviewed: ['Hired', 'Shortlisted', 'Rejected', 'On Hold'],
  Hired: ['Terminated'],
  Rejected: ['New', 'Shortlisted'],
  'On Hold': ['Contacted', 'Shortlisted', 'Interviewed', 'Rejected'],
  Terminated: [],
};

export function getAllowedNextStatuses(currentStatus) {
  const key = currentStatus || 'New';
  return TRANSITIONS[key] || [];
}

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.New;
}
```

## C.2 HR Lifecycle FMS Events — Append to `lib/fmsAppEvents.js`

These six entries must be merged into the main app's existing `APP_EVENTS` array:

```javascript
// HR Lifecycle Events (HR Module)
{ key: 'candidate_lead_created',     label: 'Candidate Lead Created',     category: 'HR', canTrigger: true,  canComplete: true  },
{ key: 'candidate_shortlisted',      label: 'Candidate Shortlisted',      category: 'HR', canTrigger: false, canComplete: true  },
{ key: 'candidate_interviewed',      label: 'Candidate Interviewed',      category: 'HR', canTrigger: false, canComplete: true  },
{ key: 'candidate_hired',            label: 'Candidate Hired',            category: 'HR', canTrigger: true,  canComplete: true  },
{ key: 'employee_exit_initiated',    label: 'Employee Exit Initiated',    category: 'HR', canTrigger: true,  canComplete: true  },
{ key: 'exit_interview_sent',        label: 'Exit Interview Sent',        category: 'HR', canTrigger: false, canComplete: true  },
```

> **Verify** the exact shape against main app's existing entries (some apps use `name` instead of `label`, etc.) before pasting.

## C.3 Registry Patch — `lib/registryConfig.js`

### Module entry to add to `moduleRegistry`:
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

### Page entries to add to `pageRegistry` (HR section):
```javascript
{ pageKey: 'HREmployees',             title: 'Employees',                moduleKey: 'HR', icon: Users,         roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'],          sortOrder: 0  },
{ pageKey: 'HRAttendanceLogs',        title: 'Attendance Logs',          moduleKey: 'HR', icon: UserCheck,     roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user', 'user'], sortOrder: 1  },
{ pageKey: 'HRAttendanceSummary',     title: 'Attendance Summary',       moduleKey: 'HR', icon: ClipboardList, roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'],         sortOrder: 2  },
{ pageKey: 'HREmployeeDailyHours',    title: 'Employee Daily Hours',     moduleKey: 'HR', icon: BarChart3,     roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user', 'supervisor'], sortOrder: 3 },
{ pageKey: 'HRManualPunchRequest',    title: 'Punch Requests',           moduleKey: 'HR', icon: ClipboardList, roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user', 'user'], sortOrder: 4  },
{ pageKey: 'HRManualPunchApprovals',  title: 'Punch Approvals',          moduleKey: 'HR', icon: ClipboardCheck, roles: ['admin', 'hr_manager', 'hr_supervisor', 'supervisor'],     sortOrder: 5  },
{ pageKey: 'HRAttendanceAlerts',      title: 'Attendance Alerts',        moduleKey: 'HR', icon: Bell,          roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'],         sortOrder: 6  },
{ pageKey: 'HRShiftTimings',          title: 'Shift Timings',            moduleKey: 'HR', icon: Settings,      roles: ['admin', 'hr_manager'],                                     sortOrder: 10 },
{ pageKey: 'HRHolidays',              title: 'Holidays',                 moduleKey: 'HR', icon: CalendarDays,  roles: ['admin', 'hr_manager'],                                     sortOrder: 11 },
{ pageKey: 'HRDepartments',           title: 'Departments',              moduleKey: 'HR', icon: Users,         roles: ['admin', 'hr_manager', 'hr_supervisor'],                    sortOrder: 20 },
{ pageKey: 'HRDesignations',          title: 'Designations',             moduleKey: 'HR', icon: Tag,           roles: ['admin', 'hr_manager', 'hr_supervisor'],                    sortOrder: 21 },
{ pageKey: 'HRBranches',              title: 'Branches',                 moduleKey: 'HR', icon: MapPin,        roles: ['admin', 'hr_manager', 'hr_supervisor'],                    sortOrder: 22 },
{ pageKey: 'HRCompanies',             title: 'Companies',                moduleKey: 'HR', icon: Factory,       roles: ['admin', 'hr_manager'],                                     sortOrder: 23 },
{ pageKey: 'HRLeaveTypes',            title: 'Leave Types',              moduleKey: 'HR', icon: CalendarDays,  roles: ['admin', 'hr_manager'],                                     sortOrder: 24 },
{ pageKey: 'HRNotificationSettings',  title: 'Notification Settings',    moduleKey: 'HR', icon: Bell,          roles: ['admin', 'hr_manager'],                                     sortOrder: 25 },
{ pageKey: 'HRCandidateLeads',        title: 'Candidate Leads',          moduleKey: 'HR', icon: UserPlus,      roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'],         sortOrder: 30 },
{ pageKey: 'HRAttritionDashboard',    title: 'Attrition Analytics',      moduleKey: 'HR', icon: TrendingDown,  roles: ['admin', 'hr_manager', 'hr_supervisor', 'hr_user'],         sortOrder: 31 },
{ pageKey: 'HRTerminationForm',       title: 'Termination Form',         moduleKey: 'HR', icon: UserMinus,     roles: ['admin', 'hr_manager', 'hr_supervisor'],                    sortOrder: 32, hideFromNav: true },
```

### Required new icon imports at top of `lib/registryConfig.js`:
```javascript
import {
  // ... existing imports ...
  UserCheck, UserPlus, UserMinus, TrendingDown, CalendarDays, MapPin, Bell,
} from 'lucide-react';
```

## C.4 Routing Patch — `App.jsx`

### Imports to add (top of file):
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

### Routes to add inside `<Routes>` block:
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

### Page component lookup map — add to `PAGE_COMPONENTS`:
```jsx
HREmployees, HRAttendanceLogs, HRAttendanceSummary, HREmployeeDailyHours,
HRManualPunchRequest, HRManualPunchApprovals, HRAttendanceAlerts,
HRShiftTimings, HRHolidays,
HRDepartments, HRDesignations, HRBranches, HRCompanies, HRLeaveTypes,
HRNotificationSettings,
HRCandidateLeads, HRAttritionDashboard, HRTerminationForm,
```

## C.5 Backend Function Signatures (See repo for full source)

### `functions/sendExitInterviewSurvey.js`
- **Path:** `src/functions/sendExitInterviewSurvey.js`
- **Auth:** Requires authenticated HR user
- **Input:** `{ candidate_lead_id, app_origin }`
- **Output:** `{ success: true, survey_url, surveyRecordId }`
- **Side effects:** Creates `ExitInterviewSurvey` row with random token, 30-day expiry; calls `Core.SendEmail` if candidate has email.

### `functions/submitExitInterviewSurvey.js`
- **Path:** `src/functions/submitExitInterviewSurvey.js`
- **Auth:** **PUBLIC** — token-validated only
- **Input:** `{ token, surveyData }`
- **Output:** `{ success: true }` or 4xx with error
- **Side effects:** Updates `ExitInterviewSurvey` to `SUBMITTED`; writes summary to `CandidateLead.exit_feedback`.

### `functions/syncHRAttritionToSheets.js`
- **Path:** `src/functions/syncHRAttritionToSheets.js`
- **Auth:** Requires `admin` / `hr_manager` / `hr_supervisor`
- **Input:** `{ startDate, endDate, format, candidates }`
- **Output:** `{ success: true, sheet, result }`
- **Required secret:** `GOOGLE_SHEETS_WEBHOOK_URL`

### `functions/syncToGoogleSheets.js` ⚠️
- **Path:** `src/functions/syncToGoogleSheets.js`
- **Scope:** Sales (NOT HR) — see §6.2 conflict warning.
- **Required secret:** `GOOGLE_SHEETS_WEBHOOK_URL`

---

# 📎 ANNEX D — Page File Locations (Read From Repo)

The following files exceed 200 lines each — read them directly from the cloned repo using these paths during merge:

```
src/pages/HRCandidateLeads.jsx
src/pages/HRAttritionDashboard.jsx
src/pages/HRTerminationForm.jsx
src/pages/ExitInterviewSurvey.jsx

src/components/hr/CandidateLeadTable.jsx
src/components/hr/CandidateLeadFormDialog.jsx
src/components/hr/CandidateTimelineDialog.jsx
src/components/hr/CandidateStatusChangeDialog.jsx
src/components/hr/CandidateEmployeeLinker.jsx
src/components/hr/CreateEmployeeFromCandidateDialog.jsx
src/components/hr/AttritionCharts.jsx
src/components/hr/AttritionKPICards.jsx
src/components/hr/AttritionFunnelPanel.jsx
src/components/hr/PeriodKPICards.jsx
src/components/hr/ConversionFunnelChart.jsx
src/components/hr/ConversionBreakdownTable.jsx
src/components/hr/BIExportPanel.jsx
src/components/hr/employee-form/EmployeePersonalSection.jsx
src/components/hr/employee-form/EmployeeContactBankSection.jsx
src/components/hr/employee-form/EmployeeEmploymentSection.jsx
src/components/hr/employee-form/EmployeeNotificationsSection.jsx

src/lib/candidateAttritionStats.js
src/lib/hrAnalyticsHelpers.js

src/functions/sendExitInterviewSurvey.js
src/functions/submitExitInterviewSurvey.js
src/functions/syncHRAttritionToSheets.js
src/functions/syncToGoogleSheets.js
```

> Each file is self-contained. Standard imports follow the convention: React → Base44 → UI → Custom → Utils → Icons.

---

**End of Merge Blueprint.**