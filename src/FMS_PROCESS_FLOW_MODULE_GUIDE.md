# Process Flow Module (FMS) — Complete Integration Guide

> **Version:** 1.0 · **Date:** 30/04/2026  
> **Applicable to:** K95 ERP and any Base44 application requiring multi-step workflow orchestration.

---

## Table of Contents

1. [What Is the Process Flow Module?](#1-what-is-the-process-flow-module)
2. [Core Concepts](#2-core-concepts)
3. [Data Model (Entities)](#3-data-model-entities)
4. [Module Pages Reference](#4-module-pages-reference)
   - 4.1 [My Tasks](#41-my-tasks--fmsmytasks)
   - 4.2 [Processes (Template Designer)](#42-processes-template-designer--fmsprocesses)
   - 4.3 [Active Runs](#43-active-runs--fmsactiveruns)
   - 4.4 [Monitor](#44-monitor--fmsmonitor)
   - 4.5 [FMS Health Dashboard](#45-fms-health-dashboard--fmshealthdashboard)
   - 4.6 [Scheduled Tasks](#46-scheduled-tasks--scheduledtaskmanager)
   - 4.7 [EA Dashboard](#47-ea-dashboard--eadashboard)
   - 4.8 [Director Dashboard](#48-director-dashboard--directordashboard)
5. [Role Model](#5-role-model)
6. [Event System (fireFMSEvent)](#6-event-system-firefmsevent)
7. [Document Linking (ref_chain)](#7-document-linking-ref_chain)
8. [TAT (Turn-Around Time) Engine](#8-tat-turn-around-time-engine)
9. [Step Completion Modes](#9-step-completion-modes)
10. [Scheduled Tasks Sub-System](#10-scheduled-tasks-sub-system)
11. [Director Task Sub-System](#11-director-task-sub-system)
12. [Adding FMS to a New Application](#12-adding-fms-to-a-new-application)
13. [Developer Integration Checklist](#13-developer-integration-checklist)
14. [Event Key Registry](#14-event-key-registry)

---

## 1. What Is the Process Flow Module?

The **Process Flow Module (FMS)** is a configurable, event-driven workflow engine that:

- Defines multi-step **business processes** (templates).
- Automatically **starts** a process run when a configured business event occurs (e.g., Purchase Order created).
- Assigns **steps** to specific users with deadlines (TAT).
- Surfaces pending work to assignees via **My Tasks**.
- Provides operations managers with a **Monitor** and **Health Dashboard** to track overdue / at-risk work.
- Integrates with a **Scheduled Tasks** system for recurring operational duties.
- Includes a **Director Task** sub-system for delegation-style task management with an EA (Executive Assistant) layer.

The FMS does **not** replace your business forms — it runs **alongside** them, tracking the human workflow steps needed to move a document from creation to completion.

---

## 2. Core Concepts

| Concept | What it means |
|---|---|
| **Process Template** | A reusable blueprint of ordered steps (`FMSProcess` + `FMSProcessStep`) |
| **Process Instance** | A live run of a template, tied to a specific business record (`FMSProcessInstance`) |
| **Step Instance** | A single live step within a run, assigned to a user with a deadline (`FMSStepInstance`) |
| **Trigger** | The event that automatically starts a process (auto-trigger) or a manual start button |
| **ref_chain** | An array on each instance storing all record IDs associated with the run; enables precise step matching |
| **fireFMSEvent** | A frontend helper that auto-completes the matching step on the matching instance |
| **TAT** | Turn-Around Time — deadline computed from step start or process start |
| **Auto-Complete** | A step that closes itself when a specified app event fires; no user action needed |

---

## 3. Data Model (Entities)

### FMSProcess
Template. One per business process definition.

| Field | Type | Description |
|---|---|---|
| `name` | string | Human-readable process name |
| `description` | string | What the process covers |
| `category` | string | Grouping label (e.g. Purchase, Sales) |
| `trigger_type` | enum: `auto` / `manual` | How instances are started |
| `trigger_source` | string | App event key that auto-starts the process |
| `is_active` | boolean | Only active processes can be triggered |

### FMSProcessStep
Ordered step definition within a template.

| Field | Type | Description |
|---|---|---|
| `process_id` | string | Parent FMSProcess ID |
| `name` | string | Step name shown to assignee |
| `step_order` | number | Sequence position (1, 2, 3…) |
| `assignee_email` | string | Who receives this step |
| `assignee_name` | string | Display name of assignee |
| `completion_mode` | enum: `manual` / `auto` | How the step closes |
| `completion_submode` | enum: `simple` / `checklist` | For manual steps: simple confirm or checklist |
| `auto_complete_event` | string | App event key that auto-closes this step |
| `tat_type` | string | TAT calculation method |
| `tat_value` | number | TAT quantity |
| `tat_unit` | string | Hours / days / weeks |
| `tat_anchor_type` | string | `run_start` or `step_start` |
| `fixed_due_time` | string | Optional HH:MM fixed time |
| `instructions` | string | What the assignee must do |
| `description` | string | Context / background |

### FMSProcessInstance
A live run of a process template.

| Field | Type | Description |
|---|---|---|
| `process_id` | string | Template ID |
| `process_name` | string | Snapshot of template name |
| `status` | enum: `active` / `completed` / `cancelled` | Run state |
| `trigger_ref_id` | string | ID of the record that started this run |
| `ref_chain` | array of strings | All record IDs linked throughout the run |
| `title` | string | Human-readable label for this specific run |
| `triggered_at` | datetime | When the run started |
| `trigger_data` | object | Arbitrary metadata from the trigger call |

### FMSStepInstance
A live step within a process run.

| Field | Type | Description |
|---|---|---|
| `instance_id` | string | Parent FMSProcessInstance ID |
| `process_id` | string | Template process ID |
| `step_name` | string | Snapshot of step name |
| `assignee_email` | string | Who owns this step |
| `assignee_name` | string | Display name |
| `status` | enum: `pending` / `active` / `completed` / `escalated` | Step state |
| `deadline` | datetime | Computed TAT deadline |
| `activated_at` | datetime | When step became active |
| `completed_at` | datetime | When step was completed |
| `completion_note` | string | Note left by the assignee |
| `completion_mode` | string | Mirror of template: `manual` / `auto` |
| `completion_submode` | string | `simple` / `checklist` |

### FMSEscalationLog
Audit of all escalation actions.

| Field | Type | Description |
|---|---|---|
| `step_instance_id` | string | Step that was escalated |
| `from_email` | string | Original assignee |
| `to_email` | string | New assignee |
| `reason` | string | Why escalated |
| `escalated_by` | string | Who triggered the escalation |
| `escalated_at` | datetime | When |

---

## 4. Module Pages Reference

### 4.1 My Tasks (`/FMSMyTasks`)

**Purpose:** Personal task inbox. Surfaces all work pending for the logged-in user.

**Shows three task types (in separate sections):**

| Section | Source Entity | When shown |
|---|---|---|
| Process Steps | `FMSStepInstance` | status = `active`, assignee = current user |
| Director Assigned Tasks | `DirectorTask` | assigned_to_email = current user, status in `[open, pending_verification, date_change_requested]` |
| Scheduled Tasks | `ScheduledTaskInstance` | assignee_email = current user, status = `PENDING` |

**Step prioritisation order:** Overdue → At Risk (< 4 hours to deadline) → On Time.

**Step completion actions:**

- **Simple step:** "Mark Done" button → optional note modal → calls `fmsTriggerProcess` backend function with `action: complete_step`.
- **Checklist step:** "Fill & Complete" → opens `StepChecklistRunner` modal → submits responses + note.

**Stat summary bar:** Total Pending | Overdue | At Risk | On Time.

---

### 4.2 Processes (Template Designer) (`/FMSProcesses`)

**Purpose:** Admin / Process Designer interface to create and manage process templates and their steps.

**Access:** Only users with role `admin` or `process_designer` can create / edit / delete.

**Key actions:**
- Create / edit / delete a **Process** (via `ProcessForm` component).
- Add / edit / delete **Steps** within a process (via `StepForm` component).
- Toggle a process Active / Inactive (inactive processes will not auto-trigger).
- Expand a process row to see its ordered step list inline.

**Process Form fields:** Name, Description, Category, Trigger Type (Auto / Manual), Trigger Source (app event key).

**Step Form fields:** Name, Description, Instructions, Assignee (user picker), Step Order, Completion Mode (Manual / Auto), Auto-Complete Event (if Auto), TAT configuration, Checklist items (if submode = checklist).

---

### 4.3 Active Runs (`/FMSActiveRuns`)

**Purpose:** Live list of all in-progress process instances across the organisation.

**Access:** Process Controller (`process_controller`) or Admin.

**Shows:**
- Instance title, process name, status.
- Current active step(s) and their assignee + TAT badge.
- Option to manually advance / escalate a stuck step.

**Used by:** Operations managers to check where work is blocked.

---

### 4.4 Monitor (`/FMSMonitor`)

**Purpose:** Detailed operational view. Allows Process Controllers to drill into any instance, view the full step timeline, reassign steps, escalate, and leave notes.

**Key components used:**
- `InstanceDetail` — full timeline of all steps (completed, active, pending).
- `EscalateModal` — reassign active step to another user.
- `ReassignModal` — change the assignee of future steps.
- `StepTimeline` — visual step-by-step progress view.

**Access:** `admin` or `process_controller`.

---

### 4.5 FMS Health Dashboard (`/FMSHealthDashboard`)

**Purpose:** Admin-only analytics snapshot of process health across all instances.

**Access:** `admin` only — returns "Admin access required" for other roles.

**Metrics displayed:**

| Metric | Description |
|---|---|
| Active Processes | Count of instances with status = `active` |
| Overdue Steps | Steps where deadline is in the past |
| At Risk (4h) | Steps due within 4 hours |
| Escalated | Steps with status = `escalated` |
| Top Bottlenecks | Assignees with the most open active steps |

---

### 4.6 Scheduled Tasks (`/ScheduledTaskManager`)

**Purpose:** Configure recurring operational task definitions and their schedules.

**Entities involved:**
- `ScheduledTaskGroup` — A named group of tasks (e.g. "Daily Hygiene Checks").
- `ScheduledTaskTemplate` — Individual recurring task definition (name, instructions, assignee, schedule, due time).
- `ScheduledTaskInstance` — Live instance auto-generated by a backend scheduler function.

**Instance statuses:** `PENDING` → `COMPLETED` / `MISSED`.

**Integration with My Tasks:** All `PENDING` instances for the current user appear in the Scheduled Tasks section of My Tasks.

---

### 4.7 EA Dashboard (`/EADashboard`)

**Purpose:** Dashboard for Executive Assistants (EAs) to:
- Create tasks on behalf of Directors they are mapped to.
- Track all tasks raised for their Director(s).
- Monitor overdue tasks and send reminders.

**Access:** Users mapped in `EADirectorMapping` as an EA.

**Key features:**
- Create Director Task (using `CreateDirectorTaskModal`).
- See all tasks grouped by Director.
- See task statuses: Open / Pending Verification / Completed / Date Change Requested.
- Receive Telegram notifications when a task is marked done by the assignee.

---

### 4.8 Director Dashboard (`/DirectorDashboard`)

**Purpose:** Dashboard for Directors to:
- View all tasks they have assigned (via themselves or their EAs).
- Verify completed tasks.
- Approve or reject date change requests from assignees.
- Create new tasks directly.

**Access:** Users with `director_email` in any `DirectorTask` record, or with role `admin`.

**Key workflow:**
1. Director / EA creates task with end date.
2. Assignee sees task in My Tasks → marks it done.
3. Task moves to `pending_verification`.
4. Director sees it in their Dashboard → Verifies or Reopens.
5. If assignee requests a date change → Director Approves / Rejects.

---

## 5. Role Model

| Role Key | Access Level |
|---|---|
| `admin` | Full access to all FMS pages + Health Dashboard |
| `process_designer` | Can create / edit process templates and steps |
| `process_controller` | Can view Active Runs, Monitor, escalate / reassign steps |
| `user` | Can only see My Tasks (their own steps + director tasks + scheduled tasks) |

Role checks use helpers from `lib/fmsHelpers.js`:

```js
import { isProcessDesigner, isPC, isAdmin } from '@/lib/fmsHelpers';

isProcessDesigner(user)   // admin OR process_designer
isPC(user)                // admin OR process_controller
isAdmin(user)             // admin only
```

---

## 6. Event System (`fireFMSEvent`)

The FMS event system is the bridge between your business actions and the workflow engine.

### Importing

```js
import { fireFMSEvent, linkFMSRef, triggerFMSProcess, findFMSInstanceByRef } from '@/lib/useFMSAutoComplete';
```

### `fireFMSEvent(eventKey, refId)`

Auto-completes the active step on the instance that has `refId` in its `ref_chain`.

```js
// After confirming a GRN:
await fireFMSEvent('grn_received', grnHeader.id);
```

- `eventKey` must match the `auto_complete_event` value on a step template.
- `refId` must be an ID already in that instance's `ref_chain`.
- Without `refId`: completes ALL active steps with this event (use only when safe).

### `triggerFMSProcess({ triggerSource, triggerRefId, title, triggerData })`

Auto-starts all active process templates whose `trigger_source` matches `triggerSource`.

```js
await triggerFMSProcess({
  triggerSource: 'purchase_order_created',
  triggerRefId: po.id,
  title: `Purchase Order ${po.po_number}`,
  triggerData: { supplier: po.supplier_name },
});
```

### `linkFMSRef(instanceId, newRefId)`

Adds a new document ID into an instance's `ref_chain` so future events can match against it.

```js
// After creating a PO from a PR:
await linkFMSRef(instance.id, po.id);
// Now ref_chain = [pr.id, po.id]
// Future events can use po.id to target this instance
```

### `findFMSInstanceByRef(refId)`

Returns active instances that contain `refId` in their `ref_chain`. Useful when you need the `instanceId` to call `linkFMSRef`.

```js
const instances = await findFMSInstanceByRef(pr.id);
if (instances[0]) await linkFMSRef(instances[0].id, po.id);
```

---

## 7. Document Linking (`ref_chain`)

The `ref_chain` is the traceability backbone. Every document ID that participates in a process run is recorded in the chain.

### Rule of Thumb

> Pass the ID of a record **already in the chain** to `fireFMSEvent`.  
> After producing a **new** record in a step, call `linkFMSRef` so the new ID joins the chain.

### Full Example — Purchase Process

```
Step 1: Purchase Request raised
  → triggerFMSProcess({ triggerSource: 'purchase_request_created', triggerRefId: pr.id })
  → ref_chain = [pr.id]

Step 2: Purchase Order created against that PR
  → fireFMSEvent('purchase_order_created', pr.id)    // pr.id is in chain ✓
  → linkFMSRef(instance.id, po.id)                   // ref_chain = [pr.id, po.id]

Step 3: Purchase Order approved
  → fireFMSEvent('purchase_order_approved', po.id)   // po.id is now in chain ✓

Step 4: GRN received
  → fireFMSEvent('grn_received', grnHeader.id)       // only if grn.id was linked ✓
```

---

## 8. TAT (Turn-Around Time) Engine

TAT (deadline) for each step is calculated by the backend (`fmsTriggerProcess` function) when the step is activated.

### TAT Types

| `tat_type` | Meaning |
|---|---|
| `calendar_days` | Simple calendar day offset from anchor |
| `working_days` | Business days (Mon–Fri) from anchor |
| `hours` | Fixed hours from anchor |

### TAT Anchors

| `tat_anchor_type` | Deadline calculated from |
|---|---|
| `run_start` | When the entire process instance started |
| `step_start` | When the previous step was completed (or process start for step 1) |

### TAT Status (frontend helpers from `lib/fmsHelpers.js`)

```js
getTATStatus(deadline)       // → 'overdue' | 'at_risk' | 'on_time' | 'unknown'
getTATBadgeClass(deadline)   // → Tailwind CSS classes for badge
getTimeRemaining(deadline)   // → '2h left' | '30m overdue' | '3d left'
```

### At-Risk Threshold
A step is "at risk" when fewer than **4 hours** remain before the deadline.

---

## 9. Step Completion Modes

### Manual — Simple
User clicks "Mark Done" in My Tasks → optional note → `fmsTriggerProcess` called with `action: complete_step`.

### Manual — Checklist
Step has `completion_submode: 'checklist'`. User clicks "Fill & Complete" → `StepChecklistRunner` modal opens → user fills each checklist item → submits all responses in a single call.

### Auto
Step has `completion_mode: 'auto'` and `auto_complete_event` set. When the business page fires `fireFMSEvent(eventKey, refId)`, the backend auto-completes this step. No user interaction required in My Tasks.

---

## 10. Scheduled Tasks Sub-System

Recurring, predictable operational duties (e.g., daily hygiene checks, weekly stock counts) are managed separately from process steps but surface in the same **My Tasks** page.

### Entity Hierarchy

```
ScheduledTaskGroup
  └── ScheduledTaskTemplate (name, instructions, schedule, assignee, due_time)
        └── ScheduledTaskInstance (auto-generated per occurrence)
```

### Instance Lifecycle
`PENDING` → `COMPLETED` (when user clicks Mark Done) or `MISSED` (if overdue and next occurrence fires)

### Generation
A backend scheduled automation (`generateScheduledTasks` function) runs at configured intervals and creates `ScheduledTaskInstance` records for templates whose next due date has passed.

### My Tasks Integration
All `PENDING` instances assigned to the current user appear in the "Scheduled Tasks" section at the bottom of My Tasks. Sorted overdue-first.

---

## 11. Director Task Sub-System

A lightweight delegation system for Directors to assign ad-hoc tasks to team members, with EAs acting as their proxies.

### Entities

| Entity | Purpose |
|---|---|
| `DirectorTask` | The task record (name, assignee, end date, status, importance flag) |
| `DirectorTaskLog` | Full audit trail of every status change |
| `EADirectorMapping` | Maps EA users to the Director(s) they support |

### Status Flow

```
open
  → pending_verification  (assignee clicks "Mark Done")
    → completed           (Director verifies)
    → open               (Director reopens)
  → date_change_requested (assignee requests extension)
    → open               (Director approves new date)
    → open               (Director rejects → stays open)
  → cancelled
```

### Notification System
Telegram notifications are sent (via `TELEGRAM_BOT_TOKEN` secret) to:
- EA: when a new task is created.
- EA + Director: when a task is marked done by the assignee.
- Assignee: when a task is verified or rejected.

### Important Flag
Tasks marked `is_important: true` trigger overdue reminders via the `checkOverdueDirectorTasks` scheduled backend function.

---

## 12. Adding FMS to a New Application

Follow these steps to drop the Process Flow Module into any new Base44 app.

### Step 1 — Copy Entities
Create these entities in the new app (copy the JSON schemas):
- `FMSProcess`
- `FMSProcessStep`
- `FMSProcessInstance`
- `FMSStepInstance`
- `FMSEscalationLog`
- `ScheduledTaskGroup`
- `ScheduledTaskTemplate`
- `ScheduledTaskInstance`
- `DirectorTask`
- `DirectorTaskLog`
- `EADirectorMapping`

### Step 2 — Copy Backend Function
Copy `functions/fmsTriggerProcess.js` — this is the core engine. It handles:
- `action: 'trigger'` — starts a new process run.
- `action: 'complete_step'` — marks a step done and activates the next.
- `action: 'auto_complete'` — event-based step completion.
- `action: 'link_ref'` — adds a record to an instance's ref_chain.

### Step 3 — Copy Library Files
```
lib/useFMSAutoComplete.js   ← fireFMSEvent, triggerFMSProcess, linkFMSRef
lib/fmsHelpers.js           ← TAT helpers, role checks
lib/fmsAppEvents.js         ← event registry (extend with app-specific events)
lib/directorTaskHelpers.js  ← date/overdue helpers for Director Tasks
```

### Step 4 — Copy Pages
```
pages/FMSMyTasks.jsx
pages/FMSProcesses.jsx
pages/FMSActiveRuns.jsx
pages/FMSMonitor.jsx
pages/FMSHealthDashboard.jsx
pages/ScheduledTaskManager.jsx
pages/EADashboard.jsx
pages/DirectorDashboard.jsx
```

### Step 5 — Copy Components
```
components/fms/ProcessForm.jsx
components/fms/StepForm.jsx
components/fms/InstanceDetail.jsx
components/fms/StepTimeline.jsx
components/fms/TATBadge.jsx
components/fms/StepChecklistRunner.jsx
components/fms/EscalateModal.jsx
components/fms/ReassignModal.jsx
components/tasks/DirectorTaskCard.jsx
components/tasks/DirectorTaskLogPanel.jsx
components/tasks/CreateDirectorTaskModal.jsx
components/tasks/DatePickerField.jsx
components/admin/EADirectorMappingPanel.jsx
components/admin/TelegramConfigPanel.jsx
components/tasks/ScheduledTaskMonitor.jsx
components/tasks/TaskGroupManager.jsx
components/tasks/TaskTemplateManager.jsx
```

### Step 6 — Register Routes in App.jsx

```jsx
import FMSMyTasks from './pages/FMSMyTasks';
import FMSProcesses from './pages/FMSProcesses';
import FMSActiveRuns from './pages/FMSActiveRuns';
import FMSMonitor from './pages/FMSMonitor';
import FMSHealthDashboard from './pages/FMSHealthDashboard';
import ScheduledTaskManager from './pages/ScheduledTaskManager';
import EADashboard from './pages/EADashboard';
import DirectorDashboard from './pages/DirectorDashboard';

// Inside <Routes>:
<Route path="/" element={<LayoutWrapper currentPageName="FMSMyTasks"><FMSMyTasks /></LayoutWrapper>} />
<Route path="/FMSProcesses" element={<LayoutWrapper currentPageName="FMSProcesses"><FMSProcesses /></LayoutWrapper>} />
<Route path="/FMSActiveRuns" element={<LayoutWrapper currentPageName="FMSActiveRuns"><FMSActiveRuns /></LayoutWrapper>} />
<Route path="/FMSMonitor" element={<LayoutWrapper currentPageName="FMSMonitor"><FMSMonitor /></LayoutWrapper>} />
<Route path="/FMSHealthDashboard" element={<LayoutWrapper currentPageName="FMSHealthDashboard"><FMSHealthDashboard /></LayoutWrapper>} />
<Route path="/ScheduledTaskManager" element={<LayoutWrapper currentPageName="ScheduledTaskManager"><ScheduledTaskManager /></LayoutWrapper>} />
<Route path="/EADashboard" element={<LayoutWrapper currentPageName="EADashboard"><EADashboard /></LayoutWrapper>} />
<Route path="/DirectorDashboard" element={<LayoutWrapper currentPageName="DirectorDashboard"><DirectorDashboard /></LayoutWrapper>} />
```

### Step 7 — Add User Roles to User Entity

Add these roles to `entities/User.json`:

```json
{
  "role": {
    "type": "string",
    "enum": ["admin", "process_designer", "process_controller", "user"]
  }
}
```

### Step 8 — Set Required Secrets

| Secret | Required for |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Director task Telegram notifications |

### Step 9 — Set Up Scheduled Automations

| Automation | Function | Schedule |
|---|---|---|
| Generate Scheduled Tasks | `generateScheduledTasks` | Every 30 minutes |
| Check Overdue Director Tasks | `checkOverdueDirectorTasks` | Daily at 16:00 |

### Step 10 — Wire App Events

In every page where a significant business action occurs, fire the corresponding FMS event **after** saving the record:

```js
import { fireFMSEvent } from '@/lib/useFMSAutoComplete';

// Example: after creating an order
const order = await base44.entities.Order.create(payload);
await fireFMSEvent('order_created', order.id);
```

Add any new events to `lib/fmsAppEvents.js` before wiring them.

---

## 13. Developer Integration Checklist

Use this checklist for every new workflow integration:

```
□ Event key exists in lib/fmsAppEvents.js
□ fireFMSEvent called AFTER the business record is saved
□ refId passed to fireFMSEvent is a record already in ref_chain
□ linkFMSRef called when a new record is produced mid-workflow
□ Process template created in the app with matching trigger_source
□ Step auto_complete_event matches the event key exactly (case-sensitive)
□ Assignee email on step template is a valid registered user email
□ TAT is set on all steps (no step should have tat_value = 0)
□ My Tasks page accessible to all assignees
□ Health Dashboard restricted to admin role only
□ Processes page restricted to process_designer / admin
□ Monitor page restricted to process_controller / admin
```

---

## 14. Event Key Registry

All available event keys are defined in `lib/fmsAppEvents.js`. Below is the full reference:

### Purchase & Goods Receipt

| Event Key | Label | Can Trigger | Can Complete Step |
|---|---|---|---|
| `purchase_request_created` | Purchase Request Created | ✅ | ✅ |
| `purchase_order_created` | Purchase Order Created | ✅ | ✅ |
| `purchase_order_approved` | Purchase Order Approved | ✅ | ✅ |
| `gate_entry_created` | Gate Entry Created | ✅ | ✅ |
| `grn_received` | Goods Receipt Received | ✅ | ✅ |
| `grn_qc_approved` | Goods Receipt QC Approved | ❌ | ✅ |
| `grn_qc_rejected` | Goods Receipt QC Rejected | ❌ | ✅ |
| `invoice_captured` | Supplier Invoice Captured | ✅ | ✅ |
| `three_way_match_done` | 3-Way Match Completed | ❌ | ✅ |
| `payment_request_created` | Payment Request Created | ✅ | ✅ |

### Production

| Event Key | Label | Can Trigger | Can Complete Step |
|---|---|---|---|
| `production_order_created` | Production Order Created | ✅ | ✅ |
| `liquid_plan_created` | Liquid Batch Plan Created | ✅ | ✅ |
| `batch_started` | Batch Started | ✅ | ✅ |
| `batch_qc_approved` | Batch Quality Control Approved | ❌ | ✅ |
| `batch_qc_rejected` | Batch Quality Control Rejected | ❌ | ✅ |
| `batch_completed` | Batch Completed | ❌ | ✅ |
| `packing_wo_created` | Packing Work Order Created | ✅ | ✅ |
| `packing_wo_completed` | Packing Work Order Completed | ❌ | ✅ |

### Warehouse & Dispatch

| Event Key | Label | Can Trigger | Can Complete Step |
|---|---|---|---|
| `putaway_done` | Putaway Completed | ❌ | ✅ |
| `dispatch_created` | Dispatch Created | ✅ | ✅ |
| `dispatch_completed` | Dispatch Completed | ❌ | ✅ |
| `fg_pallet_sealed` | Finished Goods Pallet Sealed | ❌ | ✅ |

### Quality

| Event Key | Label | Can Trigger | Can Complete Step |
|---|---|---|---|
| `qc_inspection_created` | Quality Control Inspection Created | ✅ | ✅ |
| `qc_inspection_completed` | Quality Control Inspection Completed | ❌ | ✅ |

### Labels & Printing

| Event Key | Label | Can Trigger | Can Complete Step |
|---|---|---|---|
| `label_approval_requested` | Label Approval Requested | ✅ | ✅ |
| `label_approved` | Label Approved | ❌ | ✅ |
| `label_rejected` | Label Rejected | ❌ | ✅ |

### Sales

| Event Key | Label | Can Trigger | Can Complete Step |
|---|---|---|---|
| `sales_order_created` | Sales Order Created | ✅ | ✅ |
| `sales_logistics_review` | Sales Order Under Logistics Review | ❌ | ✅ |
| `sales_picking_started` | Sales Order Approved for Picking | ❌ | ✅ |
| `sales_picklist_created` | Picklist Created | ❌ | ✅ |
| `sales_dispatch_scheduled` | Picklist Dispatch Date Confirmed | ❌ | ✅ |
| `sales_picklist_completed` | Picklist Pick and Pack Done | ❌ | ✅ |
| `sales_dn_created` | Delivery Note Created | ❌ | ✅ |
| `sales_dn_advanced` | Delivery Note Advanced | ❌ | ✅ |
| `sales_dn_bills_generated` | Delivery Note Bills Generated | ❌ | ✅ |
| `sales_invoiced` | Sales Invoice Created | ❌ | ✅ |
| `sales_invoice_submitted` | Sales Invoice Submitted for E-Invoice | ❌ | ✅ |
| `sales_invoice_bills_generated` | Sales Invoice E-Invoice and E-Way Bill Done | ❌ | ✅ |
| `sales_invoice_dispatched` | Sales Invoice Dispatched | ❌ | ✅ |
| `sales_invoice_bilty_received` | Sales Invoice Bilty Received | ❌ | ✅ |
| `sales_invoice_delivered` | Sales Invoice Delivered (Proof of Delivery) | ❌ | ✅ |
| `sales_return_initiated` | Sales Return Submitted | ✅ | ✅ |
| `sales_return_approved` | Sales Return Approved | ❌ | ✅ |
| `sales_return_completed` | Sales Return Completed | ❌ | ✅ |
| `sales_tally_posted` | Sales Posted to Tally | ❌ | ✅ |
| `sales_payment_received` | Sales Payment Received | ❌ | ✅ |

### Custom Placeholders

| Event Key | Label |
|---|---|
| `custom_event_1` | Custom Event 1 |
| `custom_event_2` | Custom Event 2 |
| `custom_event_3` | Custom Event 3 |

> To add a new event: append a new entry to the `FMS_APP_EVENTS` array in `lib/fmsAppEvents.js`. No other code changes required — the Process Designer UI will pick it up automatically.

---

*End of Process Flow Module Guide — K95 ERP*