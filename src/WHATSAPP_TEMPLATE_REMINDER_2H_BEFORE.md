# WhatsApp Template: REMINDER_2H_BEFORE (Important Tasks Only)

**Template Name:** `k95_task_reminder_2h`  
**Category:** UTILITY  
**Language:** English (en)  
**Purpose:** Sent 2 hours before the deadline for tasks marked as **Important** only. Notifies the Assignee, Executive Assistant(s), and the Director as a pre-deadline heads up.

---

## Template Structure

**Header:** TEXT  
**Body:** Urgent reminder with task details  
**Footer:** Static sign-off  

### Parameters

| # | Parameter | Description | Example |
|---|-----------|-------------|---------|
| 1 | `{{1}}` | Recipient name | Rajesh Kumar |
| 2 | `{{2}}` | Task number | DT-0045 |
| 3 | `{{3}}` | Task name | Prepare vendor audit report |
| 4 | `{{4}}` | Assigned to name | Rajesh Kumar |
| 5 | `{{5}}` | Deadline time (HH:MM) | 4:00 PM |
| 6 | `{{6}}` | Deadline date (DD/MM/YYYY) | 06/05/2026 |
| 7 | `{{7}}` | Director name | Vikram Shah |

---

## Sample 1 — Sent to the Assignee

```
🔴 *Reminder: Important Task Due in 2 Hours*

Hi Rajesh Kumar,

Your important task is due soon:

📌 *DT-0045 — Prepare vendor audit report*
📅 Deadline: 06/05/2026 at 4:00 PM
🏢 Director: Vikram Shah

⏰ You have approximately 2 hours remaining.

Please ensure this is completed on time. If you need more time, request a date change now.

— K95 ERP Task Management
```

---

## Sample 2 — Sent to the Executive Assistant

```
🔴 *Reminder: Important Task Due in 2 Hours*

Hi Anita Desai,

An important task under Director Vikram Shah is due in 2 hours:

📌 *DT-0045 — Prepare vendor audit report*
👤 Assigned to: Rajesh Kumar
📅 Deadline: 06/05/2026 at 4:00 PM

⏰ Please check with the assignee on completion status.

— K95 ERP Task Management
```

---

## Sample 3 — Sent to the Director

```
🔴 *Reminder: Important Task Due in 2 Hours*

Hi Vikram Shah,

An important task you assigned is due in 2 hours:

📌 *DT-0045 — Prepare vendor audit report*
👤 Assigned to: Rajesh Kumar
📅 Deadline: 06/05/2026 at 4:00 PM

The assignee and your Executive Assistant have been reminded.

— K95 ERP Task Management
```

---

## Meta Business Manager Configuration

```json
{
  "name": "k95_task_reminder_2h",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "🔴 Important Task — 2 Hour Reminder"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}},\n\nAn important task is due in 2 hours:\n\n📌 *{{2}} — {{3}}*\n👤 Assigned to: {{4}}\n📅 Deadline: {{6}} at {{5}}\n🏢 Director: {{7}}\n\n⏰ Please ensure this is completed on time.",
      "example": {
        "body_text": [
          ["Rajesh Kumar", "DT-0045", "Prepare vendor audit report", "Rajesh Kumar", "4:00 PM", "06/05/2026", "Vikram Shah"]
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
    "name": "k95_task_reminder_2h",
    "language": "en",
    "category": "UTILITY",
    "components": [
      {
        "type": "HEADER",
        "format": "TEXT",
        "text": "🔴 Important Task — 2 Hour Reminder"
      },
      {
        "type": "BODY",
        "text": "Hi {{1}},\n\nAn important task is due in 2 hours:\n\n📌 *{{2}} — {{3}}*\n👤 Assigned to: {{4}}\n📅 Deadline: {{6}} at {{5}}\n🏢 Director: {{7}}\n\n⏰ Please ensure this is completed on time.",
        "example": {
          "body_text": [
            ["Rajesh Kumar", "DT-0045", "Prepare vendor audit report", "Rajesh Kumar", "4:00 PM", "06/05/2026", "Vikram Shah"]
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

| Role | Message Tone |
|------|-------------|
| **Assignee (User)** | "Your important task is due in 2 hours — complete or request extension" |
| **Executive Assistant** | "Important task under your Director is due in 2 hours — check status" |
| **Managing Director** | "Important task you assigned is due in 2 hours — team has been reminded" |

## Trigger

- **Scheduled automation** — runs every 15 minutes
- Only fires for tasks where `is_important === true` and `status === 'open'`
- Uses a flag `reminder_2h_sent` on DirectorTask to prevent duplicate sends
- Window: fires when current IST time is between 2h and 1h45m before `end_date + end_time`
- Only sends to recipients who have `phone_number` configured on their User record

## Entity Change Required

Add `reminder_2h_sent` (boolean, default: false) to the **DirectorTask** entity to track whether this reminder has already been sent.