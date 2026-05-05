# Delegation Scoring — User Guide

> **Who is this for?** Everyone who gets tasks assigned via the Director/EA Dashboard.  
> This document explains exactly how your weekly performance score is calculated.

---

## 1. The Basics

Every task you are assigned is **scored** at the end of each week (Monday to Sunday).  
Your score for each task falls into one of three categories:

| Colour | Meaning | What it means for you |
|--------|---------|----------------------|
| 🟢 **Green** | On Track | You completed the task on time, or no issues were found. |
| 🟡 **Yellow** | Minor Issue | There was one date change within the same week, or a short overdue (1 day). |
| 🔴 **Red** | Serious Issue | Multiple date changes, a week shift, or overdue without action (2+ days). |

### Your Weekly Health Score

| Health Label | Condition |
|---|---|
| **Good** | Red% ≤ 30% and Yellow% ≤ 30% |
| **Needs Follow-up** | Yellow% > 30% (but Red% ≤ 30%) |
| **Critical** | Red% > 30% |

---

## 2. What is a "Scoring Cycle"?

Each task has at least **one scoring cycle**. A scoring cycle is tied to the **Monday–Sunday week** in which the task's due date falls.

- If you change the due date to a **different week**, the old cycle closes and a **new cycle** starts.
- This means a single task can generate **multiple scores** if it keeps getting pushed across weeks.

---

## 3. Penalty Points — How Your Score is Decided

Your task starts at **0 penalty points** (Green). Penalties are added based on what happens:

### 3.1 Date Change Penalty (Same-Week Changes)

If you request a date change but the new date is still **within the same week**:

| Same-Week Date Changes | Penalty | Score |
|---|---|---|
| 0 changes | 0 | 🟢 Green |
| 1 change | 1 | 🟡 Yellow |
| 2 or more changes | 2 | 🔴 Red |

### 3.2 Week Shift Penalty

If you request a date change and the new date falls in a **different week**:

- The **old cycle is immediately closed** with **penalty 2** (🔴 Red)
- A **new cycle starts** in the new week with **penalty 0** (🟢 Green)

### 3.3 Unmanaged Overdue Penalty

If a task's due date has passed and you have **not**:
- Requested a date change, **or**
- Marked the task as done

Then you are penalised for "not managing" the overdue:

| Days Overdue (without action) | Penalty | Score |
|---|---|---|
| 1 day | 1 | 🟡 Yellow |
| 2 or more days | 2 | 🔴 Red |

> **Important:** If you request a date change before or after the due date, the overdue penalty **does not apply** for that cycle — it's considered "managed."

### 3.4 How Penalties Combine

The system takes the **highest** penalty from the three categories above (it does not add them together). The maximum is always capped at 2.

**Formula:**  
`Final Penalty = max(Date Change Penalty, Week Shift Penalty, Unmanaged Overdue Penalty)`  
Capped at 2.

| Final Penalty | Score |
|---|---|
| 0 | 🟢 Green |
| 1 | 🟡 Yellow |
| 2 | 🔴 Red |

---

## 4. Examples

### Example 1: Perfect Execution 🟢

> **Task:** "Submit monthly report"  
> **Due Date:** Wednesday, 07/05/2026  
> **What happened:** You completed it on Tuesday, 06/05/2026.

| Factor | Value |
|---|---|
| Date changes | 0 |
| Week shift | No |
| Overdue | No |
| **Final Penalty** | **0 → 🟢 Green** |

---

### Example 2: One Same-Week Date Change 🟡

> **Task:** "Prepare presentation"  
> **Original Due Date:** Tuesday, 06/05/2026  
> **What happened:** You requested a date change to Thursday, 08/05/2026 (same week). Completed on Thursday.

| Factor | Value |
|---|---|
| Same-week date changes | 1 |
| Week shift | No |
| Overdue | No |
| **Final Penalty** | **1 → 🟡 Yellow** |

---

### Example 3: Two Same-Week Date Changes 🔴

> **Task:** "Update inventory records"  
> **Original Due Date:** Monday, 05/05/2026  
> **What happened:** Changed to Wednesday 07/05 (same week), then changed again to Friday 09/05 (same week). Completed on Friday.

| Factor | Value |
|---|---|
| Same-week date changes | 2 |
| Week shift | No |
| Overdue | No |
| **Final Penalty** | **2 → 🔴 Red** |

---

### Example 4: Week Shift (Pushed to Next Week) — Two Scores! 🔴 + 🟢

> **Task:** "Complete audit checklist"  
> **Original Due Date:** Friday, 09/05/2026 (Week of 05/05–11/05)  
> **What happened:** You requested a change to Monday, 12/05/2026 (Week of 12/05–18/05). Completed on Monday 12/05.

**Cycle 1 (Week 05/05–11/05):**

| Factor | Value |
|---|---|
| Week shift | Yes |
| **Final Penalty** | **2 → 🔴 Red** |

**Cycle 2 (Week 12/05–18/05):**

| Factor | Value |
|---|---|
| Date changes | 0 |
| Week shift | No |
| Overdue | No |
| **Final Penalty** | **0 → 🟢 Green** |

> ⚠️ This means the task generates **two scores** — one Red for the old week and one Green for the new week.

---

### Example 5: Overdue Without Action (Unmanaged) 🟡 → 🔴

> **Task:** "Send quotation to vendor"  
> **Due Date:** Wednesday, 07/05/2026  
> **What happened:** You did nothing — no date change request, not marked done.

**On Thursday (1 day overdue):**

| Factor | Value |
|---|---|
| Unmanaged overdue days | 1 |
| **Final Penalty** | **1 → 🟡 Yellow** |

**On Friday (2 days overdue):**

| Factor | Value |
|---|---|
| Unmanaged overdue days | 2 |
| **Final Penalty** | **2 → 🔴 Red** |

> **Tip:** If the due date passes, immediately either complete the task or request a date change. Even requesting a change will prevent the "unmanaged overdue" penalty.

---

### Example 6: Overdue BUT Managed (Date Change Requested) 🟡

> **Task:** "Review contract"  
> **Due Date:** Wednesday, 07/05/2026  
> **What happened:** On Thursday (1 day after due), you requested a date change to Friday, 09/05/2026 (same week). Completed on Friday.

| Factor | Value |
|---|---|
| Same-week date changes | 1 |
| Unmanaged overdue | **No** (you requested a change) |
| **Final Penalty** | **1 → 🟡 Yellow** |

> The overdue penalty does not apply because you took action by requesting a date change.

---

### Example 7: Multiple Issues — Highest Penalty Wins 🔴

> **Task:** "File tax documents"  
> **Original Due Date:** Monday, 05/05/2026  
> **What happened:** Changed to Wednesday 07/05 (1 same-week change, penalty = 1). Then it went overdue for 3 days without action (unmanaged overdue penalty = 2).

| Factor | Penalty |
|---|---|
| Same-week date changes: 1 | 1 |
| Unmanaged overdue: 3 days | 2 |
| **Final = max(1, 2)** | **2 → 🔴 Red** |

---

## 5. What Counts as a "Date Change"?

The system tracks these as date-change events:

1. **Date Change Requested** — You request a new due date through the task interface
2. **Date Change Approved** — A director/EA approves a date change
3. **Date Change Rejected** — A director/EA rejects a date change
4. **Direct Edit** — A director/EA directly edits the due date

> **De-duplication:** If a date change request and its approval/rejection have the same old→new dates, they count as **one** event, not two. You won't be penalised twice for the same change.

---

## 6. Weekly Planning (Next Week Planned %)

During the weekly meeting, the director sets **planned percentages** for the next week:

| Field | Meaning |
|---|---|
| Green % | Target percentage of tasks expected to be Green |
| Yellow % | Target percentage of tasks expected to be Yellow |
| Red % | Target percentage of tasks expected to be Red |

These must add up to **100%**. The following week, the system compares your **actual** percentages against these planned targets.

---

## 7. Tips to Keep Your Score Green

1. ✅ **Complete tasks before or on the due date** — no penalties at all
2. ✅ **If you need more time, request a date change immediately** — don't let the task go overdue without action
3. ✅ **Keep date changes within the same week** — 1 change = Yellow; pushing to another week = Red
4. ✅ **Avoid multiple date changes** — 2+ same-week changes = Red
5. ✅ **Communicate early** — even if you think you'll be late, request the change before the due date passes

---

## 8. Quick Reference — Penalty Matrix

| Scenario | Date Change Penalty | Week Shift Penalty | Overdue Penalty | Final Score |
|---|---|---|---|---|
| Completed on time | 0 | 0 | 0 | 🟢 Green |
| 1 same-week date change | 1 | 0 | 0 | 🟡 Yellow |
| 2+ same-week date changes | 2 | 0 | 0 | 🔴 Red |
| Date pushed to next week | — | 2 (old cycle) | 0 | 🔴 Red (old), 🟢 Green (new) |
| 1 day overdue, no action | 0 | 0 | 1 | 🟡 Yellow |
| 2+ days overdue, no action | 0 | 0 | 2 | 🔴 Red |
| Overdue + requested date change | 1 | 0 | 0 | 🟡 Yellow |
| 1 date change + 2 days overdue | 1 | 0 | 2 | 🔴 Red |

---

## 9. Using "My Tasks" — Your Daily Task Hub

When you log into the app, you land on **My Tasks**. This is where you see every task assigned to you and take action on them.

### 9.1 What You'll See on Each Task Card

Each task card shows:

| Element | Description |
|---|---|
| **Task Name** | The title of what you need to do |
| **Due Date** | When the task must be completed (DD/MM/YYYY format) |
| **Status Badge** | Current status — Open, Blocked, Pending Verification, Completed, Date Change Requested, Cancelled |
| **Urgency Indicator** | Colour-coded left border: 🔵 Normal, 🟡 Due Soon, 🟠 Due Today, 🔴 Overdue |
| **Important Flag** | ⚠️ Tasks marked "Important" get deadline notifications |
| **OVERDUE Badge** | Red flashing badge if the due date has passed |
| **Progress Note** | Your latest status update (shown as a preview) |

### 9.2 Actions You Can Take

#### ✅ Mark Done
When you finish a task, tap **"Mark Done"**. This changes the status to **Pending Verification** — the director/EA will review and confirm.

> **Scoring Impact:** Once verified as completed, the task is scored based on whether it was done on time and any date changes.

#### 📝 Update Progress
Tap **"Update Progress"** to share a quick status update. This is visible to your director/EA and helps show you're actively working on the task. It does **not** affect your score.

#### 📅 Request Date Change
If you need more time, tap **"Request Date Change"**. You'll need to:
1. Pick a **new end date** (must be a future date)
2. Optionally set a **new end time**
3. Provide a **reason** (mandatory)

After submitting, the task status changes to **Date Change Requested**. The director/EA will approve or reject it.

> **Scoring Impact:**  
> - If the new date is in the **same week** → 1 penalty point (🟡 Yellow)  
> - If the new date is in a **different week** → old cycle closes as 🔴 Red, new cycle starts fresh  
> - Even if rejected, the date change **still counts** as a scoring event (you took action, so no "unmanaged overdue" penalty)

#### 🔍 Details
Tap **"Details"** to expand and see:
- Task ID (e.g., DT-0001)
- Project name (if part of a project)
- Who assigned the task
- Full task description ("What to do")
- Start and end dates
- Predecessor tasks (if blocked)

#### 📋 Log
Tap **"Log"** to see the full activity history — every action taken on the task in chronological order (created, date changes, marked done, verified, etc.).

### 9.3 Task Statuses Explained

| Status | What It Means | What You Should Do |
|---|---|---|
| **Open** | Task is active and waiting for you | Work on it and mark done before the due date |
| **Blocked** | Waiting for a predecessor task to finish | Nothing — it will auto-unblock when dependencies complete |
| **Date Change Requested** | You've asked for a new deadline | Wait for director/EA to approve or reject |
| **Pending Verification** | You marked it done, awaiting confirmation | Wait for director/EA to verify |
| **Completed** | Director/EA confirmed it's done | Nothing — task is closed ✅ |
| **Cancelled** | Task was cancelled | Nothing — task is removed from active list |

### 9.4 What Happens After You Mark Done?

1. You tap **"Mark Done"** → Status becomes **Pending Verification**
2. Your director or EA sees the task in their dashboard
3. They either:
   - **Confirm Done** → Status becomes **Completed** ✅
   - **Reopen** → Status goes back to **Open** (they felt it wasn't actually finished)

> **Scoring Note:** The scoring uses the date you marked it done (not when it was verified). So if you mark done on time but verification happens later, you still get a good score.

### 9.5 What Happens With Date Change Requests?

1. You tap **"Request Date Change"** → Status becomes **Date Change Requested**
2. Director/EA sees the request with your reason
3. They either:
   - **Approve** → Due date updates to your requested date, status returns to **Open**
   - **Reject** → Due date stays the same, status returns to **Open**

> **Important for Scoring:**  
> - Whether approved or rejected, the date change **request itself** counts as a scoring event  
> - A rejected request won't get the "unmanaged overdue" penalty — you took action  
> - But the original due date stays, so complete the task as soon as possible

### 9.6 Overdue Tasks — What to Do

If you see the red **OVERDUE** badge on a task:

1. **Act immediately** — every day you wait adds to the unmanaged overdue penalty
2. **Option A:** Complete the task now → Tap "Mark Done"
3. **Option B:** Request more time → Tap "Request Date Change"

> ⏱️ **Day 1 overdue without action** = 🟡 Yellow  
> ⏱️ **Day 2+ overdue without action** = 🔴 Red  
> 
> Taking **any** action (mark done or request date change) stops the overdue penalty from applying.

### 9.7 Best Practices for Daily Task Management

| Practice | Why It Matters |
|---|---|
| Check My Tasks **every morning** | Catch new tasks and approaching deadlines early |
| **Update progress** regularly | Keeps your director informed, builds trust |
| **Mark done immediately** when finished | Don't delay — the system tracks when you mark it |
| Request date changes **before** the due date | Avoids unmanaged overdue penalty entirely |
| Provide **clear reasons** for date changes | Helps directors approve faster |
| Review **blocked tasks** periodically | Know what's coming once dependencies clear |

---

## 10. For Directors/EAs — The Delegation Score Dashboard

The **Delegation Score** page shows a weekly overview of all team members' performance.

### 10.1 What You See

- **KPI Cards** — Total tasks, Green/Yellow/Red counts and percentages
- **Person Table** — Each team member's score breakdown with:
  - This Week Planned % (Green/Yellow/Red targets set in previous meeting)
  - Actual task counts and percentages
  - Next Week Planned % (set during current meeting)
- **Task Drilldown** — Click any person to see individual task scoring cycles

### 10.2 Weekly Meeting Workflow

1. **Navigate** to the week using the week selector (← Previous | Current | Next →)
2. **Review** each person's actual performance vs. planned targets
3. **Set Next Week Planned %** — Enter target Green/Yellow/Red percentages (must total 100%)
4. **Add Notes** — Click the 💬 icon to add:
   - **Next Week Commitment Notes** — Goals and commitments for next week
   - **Meeting Remarks** — Observations and action items from the discussion
5. **Save** — Click "Save" to lock the meeting for that person

> **Carry-Forward:** Next week, the "Next Week Commitment Notes" you enter today will automatically appear as "This Week Commitment Notes" — making it easy to review last week's commitments.

### 10.3 Export

Click **"Export CSV"** to download the full week's scoring data as a spreadsheet for reporting.

---

*Last Updated: 05/05/2026*