# WhatsApp Template: DATE_CHANGE_REQUESTED

**Template Name:** `k95_task_date_change`  
**Category:** UTILITY  
**Language:** English (en)  
**Purpose:** Sent immediately when an assignee requests a deadline change. Notifies the Director and Executive Assistant(s) so they can approve/reject the request promptly.

---

## Template Structure

**Header:** TEXT  
**Body:** Date change details with reason  
**Footer:** Static sign-off  

### Parameters

| # | Parameter | Description | Example |
|---|-----------|-------------|---------|
| 1 | `{{1}}` | Recipient name | Vikram Shah |
| 2 | `{{2}}` | Task number | DT-0045 |
| 3 | `{{3}}` | Task name | Prepare vendor audit report |
| 4 | `{{4}}` | Requested by name | Rajesh Kumar |
| 5 | `{{5}}` | Current deadline (DD/MM/YYYY) | 06/05/2026 |
| 6 | `{{6}}` | Requested new date (DD/MM/YYYY) | 08/05/2026 |
| 7 | `{{7}}` | Reason for change | Waiting for supplier data, expected by 07/05 |

---

## Sample 1 — Sent to the Director

```
📅 *Date Change Requested*

Hi Vikram Shah,

A team member has requested a deadline extension:

📌 *DT-0045 — Prepare vendor audit report*
👤 Requested by: Rajesh Kumar
📅 Current deadline: 06/05/2026
📅 Requested new date: 08/05/2026

💬 Reason: Waiting for supplier data, expected by 07/05

Please approve or reject this request in the K95 ERP dashboard.

— K95 ERP Task Management
```

---

## Sample 2 — Sent to the Executive Assistant

```
📅 *Date Change Requested*

Hi Anita Desai,

A date change has been requested for a task under Director Vikram Shah:

📌 *DT-0045 — Prepare vendor audit report*
👤 Requested by: Rajesh Kumar
📅 Current deadline: 06/05/2026
📅 Requested new date: 08/05/2026

💬 Reason: Waiting for supplier data, expected by 07/05

Please coordinate with the Director for approval.

— K95 ERP Task Management
```

---

## Sample 3 — Confirmation to the Assignee

```
📅 *Date Change Request Submitted*

Hi Rajesh Kumar,

Your date change request has been submitted:

📌 *DT-0045 — Prepare vendor audit report*
📅 Current deadline: 06/05/2026
📅 Requested new date: 08/05/2026

💬 Your reason: Waiting for supplier data, expected by 07/05

The Director and Executive Assistant have been notified. You will be informed once the request is approved or rejected.

— K95 ERP Task Management
```

---

## Meta Business Manager Configuration

```json
{
  "name": "k95_task_date_change",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "📅 Date Change Requested"
    },
    {
      "type": "BODY",
      "text": "Hi {{1}},\n\nA deadline change has been requested:\n\n📌 *{{2}} — {{3}}*\n👤 Requested by: {{4}}\n📅 Current deadline: {{5}}\n📅 Requested new date: {{6}}\n\n💬 Reason: {{7}}\n\nPlease take action in the K95 ERP dashboard.",
      "example": {
        "body_text": [
          ["Vikram Shah", "DT-0045", "Prepare vendor audit report", "Rajesh Kumar", "06/05/2026", "08/05/2026", "Waiting for supplier data"]
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
| **Managing Director** | "A team member has requested extension — approve/reject in dashboard" |
| **Executive Assistant** | "Date change requested under your Director — coordinate for approval" |
| **Assignee (User)** | "Your request has been submitted — Director and EA are notified" |

## Trigger

- **Real-time** — fires immediately when `status` changes to `date_change_requested` on a DirectorTask
- Can be triggered via:
  - Entity automation on DirectorTask update (when `status === 'date_change_requested'`)
  - OR inline call from the frontend component that handles the date change action
- Sends to all recipients who have `phone_number` configured on their User record

## Data Source

All parameters are available on the DirectorTask entity:
- `task_number`, `task_name`, `assigned_to_name` / `assigned_to_email`
- `end_date` (current deadline)
- `requested_new_date` (new requested date)
- `date_change_reason` (reason text)
- `director_email` → lookup User for `phone_number`
- `ea_emails` → lookup Users for `phone_number