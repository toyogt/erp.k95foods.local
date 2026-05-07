# WhatsApp Template: REMINDER_DUE_TODAY

**Template Name:** `k95_tasks_due_today`  
**Category:** UTILITY  
**Language:** English (en)  
**Purpose:** Sent once daily (e.g. 9:00 AM IST) to User, Executive Assistant, and Managing Director with a summary of all tasks due that day.

---

## Template Structure

**Header:** TEXT  
**Body:** Contains summary of tasks due today  
**Footer:** Static sign-off  

### Parameters

| # | Parameter | Description | Example |
|---|-----------|-------------|---------|
| 1 | `{{1}}` | Recipient name | Rajesh Kumar |
| 2 | `{{2}}` | Date (DD/MM/YYYY) | 06/05/2026 |
| 3 | `{{3}}` | Total task count | 4 |
| 4 | `{{4}}` | Task summary list (multi-line) | See samples below |

---

## Sample 1 — Multiple Tasks Due (Sent to Assignee)

```
📋 *Tasks Due Today*

Hi Rajesh Kumar,

You have *4 tasks* due today (06/05/2026):

1. 🔴 DT-0045 — Prepare vendor audit report
   ⏰ Due: 4:00 PM | Assigned by: Vikram Shah

2. DT-0048 — Update ingredient stock sheet
   ⏰ Due: 2:00 PM | Assigned by: Priya Mehta

3. DT-0051 — Send revised quotation to ABC Corp
   ⏰ Due: 5:00 PM | Assigned by: Vikram Shah

4. DT-0052 — Schedule chamber maintenance call
   ⏰ Due: 3:30 PM | Assigned by: Priya Mehta

🔴 = Important task

Please complete these before the deadlines.
— K95 ERP Task Management
```

---

## Sample 2 — Single Task Due (Sent to Executive Assistant)

```
📋 *Tasks Due Today*

Hi Anita Desai,

There is *1 task* due today (06/05/2026) under Director Vikram Shah:

1. 🔴 DT-0045 — Prepare vendor audit report
   👤 Assigned to: Rajesh Kumar
   ⏰ Due: 4:00 PM

🔴 = Important task

Please follow up with the assignee if needed.
— K95 ERP Task Management
```

---

## Sample 3 — Summary for Director (Managing Director View)

```
📋 *Tasks Due Today*

Hi Vikram Shah,

Your team has *3 tasks* due today (06/05/2026):

1. 🔴 DT-0045 — Prepare vendor audit report
   👤 Rajesh Kumar | ⏰ 4:00 PM

2. DT-0051 — Send revised quotation to ABC Corp
   👤 Rajesh Kumar | ⏰ 5:00 PM

3. DT-0053 — Review production schedule for next week
   👤 Sanjay Patel | ⏰ 3:00 PM

🔴 = Important task

— K95 ERP Task Management
```

---

## Meta Business Manager Configuration

```json
{
  "name": "k95_tasks_due_today",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "📋 Tasks Due Today"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}},\n\nYou have *{{3}} task(s)* due today ({{2}}):\n\n{{4}}\n\nPlease complete these before the deadlines.",
      "example": {
        "body_text": [
          ["Rajesh Kumar", "06/05/2026", "2", "1. 🔴 DT-0045 — Prepare vendor audit report\n   ⏰ Due: 4:00 PM | Assigned by: Vikram Shah\n\n2. DT-0048 — Update ingredient stock sheet\n   ⏰ Due: 2:00 PM | Assigned by: Priya Mehta"]
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

## cURL Command — Submit to Meta for Approval

Replace `<WHATSAPP_BUSINESS_ACCOUNT_ID>` with your WhatsApp Business Account ID and `<ACCESS_TOKEN>` with your Meta access token.

```bash
curl -X POST \
  "https://graph.facebook.com/v21.0/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "k95_tasks_due_today",
    "language": "en",
    "category": "UTILITY",
    "components": [
      {
        "type": "HEADER",
        "format": "TEXT",
        "text": "📋 Tasks Due Today"
      },
      {
        "type": "BODY",
        "text": "Hi {{1}},\n\nYou have *{{3}} task(s)* due today ({{2}}):\n\n{{4}}\n\nPlease complete these before the deadlines.",
        "example": {
          "body_text": [
            ["Rajesh Kumar", "06/05/2026", "2", "1. 🔴 DT-0045 — Prepare vendor audit report\n   ⏰ Due: 4:00 PM | Assigned by: Vikram Shah\n\n2. DT-0048 — Update ingredient stock sheet\n   ⏰ Due: 2:00 PM | Assigned by: Priya Mehta"]
          ]
        }
      },
      {
        "type": "FOOTER",
        "text": "K95 ERP Task Management"
      }
    ]
  }'
```

---

## Recipients

| Role | What They Receive |
|------|-------------------|
| **Assignee (User)** | Their own tasks due today |
| **Executive Assistant** | All tasks due today under their mapped Director(s) |
| **Managing Director** | All tasks due today assigned by them / under their team |

## Trigger

- **Scheduled automation** — runs daily at 09:00 AM IST
- Only sends if user has `phone_number` configured on their User record
- Groups tasks per recipient to send ONE summary message (not per-task)