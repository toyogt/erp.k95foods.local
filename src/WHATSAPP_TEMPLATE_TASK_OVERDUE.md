# WhatsApp Template: TASK_OVERDUE

**Template Name:** `k95_task_overdue`  
**Category:** UTILITY  
**Language:** English (en)  
**Purpose:** Sent when a task crosses its deadline without being completed. Notifies the Assignee, Executive Assistant(s), and the Director.

---

## Template Structure

**Header:** TEXT  
**Body:** Task details with overdue warning  
**Footer:** Static sign-off  

### Parameters

| # | Parameter | Description | Example |
|---|-----------|-------------|---------|
| 1 | `{{1}}` | Recipient name | Rajesh Kumar |
| 2 | `{{2}}` | Task number | DT-0045 |
| 3 | `{{3}}` | Task name | Prepare vendor audit report |
| 4 | `{{4}}` | Assigned to name | Rajesh Kumar |
| 5 | `{{5}}` | Deadline (DD/MM/YYYY HH:MM) | 05/05/2026 4:00 PM |
| 6 | `{{6}}` | Director name | Vikram Shah |
| 7 | `{{7}}` | Overdue duration | 1 day 2 hours |

---

## Sample 1 — Sent to the Assignee

```
⚠️ *Task Overdue*

Hi Rajesh Kumar,

Your task is past its deadline:

📌 *DT-0045 — Prepare vendor audit report*
👤 Assigned to: Rajesh Kumar
📅 Deadline was: 05/05/2026 4:00 PM
⏱️ Overdue by: 1 day 2 hours
🏢 Director: Vikram Shah

Please complete this task immediately or request a date change.

— K95 ERP Task Management
```

---

## Sample 2 — Sent to the Executive Assistant

```
⚠️ *Task Overdue*

Hi Anita Desai,

A task under Director Vikram Shah is overdue:

📌 *DT-0045 — Prepare vendor audit report*
👤 Assigned to: Rajesh Kumar
📅 Deadline was: 05/05/2026 4:00 PM
⏱️ Overdue by: 1 day 2 hours
🏢 Director: Vikram Shah

Please follow up with the assignee.

— K95 ERP Task Management
```

---

## Sample 3 — Sent to the Director

```
⚠️ *Task Overdue*

Hi Vikram Shah,

A task you assigned is overdue:

📌 *DT-0045 — Prepare vendor audit report*
👤 Assigned to: Rajesh Kumar
📅 Deadline was: 05/05/2026 4:00 PM
⏱️ Overdue by: 1 day 2 hours

The assignee and your Executive Assistant have also been notified.

— K95 ERP Task Management
```

---

## Meta Business Manager Configuration

```json
{
  "name": "k95_task_overdue",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "⚠️ Task Overdue"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}},\n\nA task is past its deadline:\n\n📌 *{{2}} — {{3}}*\n👤 Assigned to: {{4}}\n📅 Deadline was: {{5}}\n⏱️ Overdue by: {{7}}\n🏢 Director: {{6}}\n\nPlease take immediate action.",
      "example": {
        "body_text": [
          ["Rajesh Kumar", "DT-0045", "Prepare vendor audit report", "Rajesh Kumar", "05/05/2026 4:00 PM", "Vikram Shah", "1 day 2 hours"]
        ]
      }
    },
    {
      "type": "FOOTER",
      "text": "K95 ERP Task Management"
    }
  ]
}
```

---

## Recipients

| Role | Message Tone |
|------|-------------|
| **Assignee (User)** | "Your task is overdue — complete it or request a date change" |
| **Executive Assistant** | "A task under your Director is overdue — please follow up" |
| **Managing Director** | "A task you assigned is overdue — assignee and EA have been notified" |

## Trigger

- **Scheduled automation** — runs every 30 minutes (checks `end_date` + `end_time` against current IST time)
- Only fires once per task (uses `overdue_notified` flag on DirectorTask entity)
- Sends to all recipients who have `phone_number` configured on their User record
- Also sends Telegram notification in parallel (existing behaviour)