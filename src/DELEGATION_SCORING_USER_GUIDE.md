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

*Last Updated: 05/05/2026*