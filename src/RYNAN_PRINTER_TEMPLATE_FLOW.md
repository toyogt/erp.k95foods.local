# Rynan Printer — Template Checking & Print Command Flow

## Overview

This document explains exactly how the K95 ERP system:
1. Checks whether a label template is loaded on the physical printer
2. Sends the STAR print command to trigger label printing

All logic lives in `lib/rynanPrinterService.js`.

---

## Part 1 — Template Checking (RQLI → RSLI)

### Why RQLI (not MON)?

The MON command is used only for **connection and cartridge health checks**. It does NOT reliably return the full printer template list in all firmware versions.

The correct command to query the printer's loaded templates is **RQLI**. The printer responds with **RSLI** containing the full array of template names.

---

### Step-by-Step: fetchPrinterTemplateList()

```
Operator clicks "Check Status"
        │
        ▼
checkAndSyncPrinterConfig(printer, templateName)
        │
        ├── STEP 1: GET /printers → verify printer_id registered
        ├── STEP 2: Auto-fix IP/port if mismatched
        ├── STEP 3: POST /print { command: "MON" } → connection alive?
        ├── STEP 4: Parse MON response → cartridge present? Ink level?
        │
        └── STEP 5: POST /print { command: "RQLI" }  ← Template Check
                        │
                        ▼
               fetchPrinterTemplateList(printer, maxRetries=3)
                        │
              ┌─────────┴────────────────┐
              │    Attempt 1 / 2 / 3     │
              │                          │
              │  POST /print             │
              │  { command: "RQLI" }     │
              │         │                │
              │         ▼                │
              │  Response received?      │
              │         │                │
              │    Yes  │  No (network)  │
              │         │  → wait 1s     │
              │         │  → retry       │
              │         ▼                │
              │  printer_response_command│
              │    === "RSLI" ?          │
              │         │                │
              │    Yes  │  No            │
              │         │  → wait 1s     │
              │         │  → retry       │
              │         ▼                │
              │  extractTemplateList()   │
              │  templates.length > 0 ?  │
              │         │                │
              │    Yes  │  No → retry    │
              │         ▼                │
              │  return { templates[] }  │
              └──────────────────────────┘
```

### RQLI Payload Sent

```json
{
  "printer_id": "P1",
  "printer": { "ip": "192.168.29.110", "port": 2030 },
  "command": { "command": "RQLI" }
}
```

### RSLI Response Received

```json
{
  "success": true,
  "printer_response_command": "RSLI",
  "printer_response_payload": {
    "command": "RSLI",
    "template": [
      "Default-1", "Default-2", "Default-3",
      "Noice Iced Tea", "Noice Kombucha",
      "TK-EXPE-LS-GLS-330", "DEMO", ...
    ]
  },
  "response": {
    "response": {
      "command": "RSLI",
      "template": [ ... ]
    }
  },
  "printer_raw_response": "{ \"command\": \"RSLI\", \"template\": [...] }"
}
```

### Template Extraction Priority (extractTemplateList)

The function checks these locations in order, returns the first non-empty array found:

| Priority | Location in Response Body |
|---|---|
| 1 ✅ Most Reliable | `body.printer_response_payload.template` |
| 2 | `body.response.response.template` |
| 3 | `body.response.details.response.template` |
| 4 | `body.printer_raw_response` (parse JSON string) |
| 5 | `body.printer_response_payload` (parse JSON string) |
| 6 | `body.template` (flat fallback) |

### Template Name Matching

```js
// Case-insensitive + whitespace-trimmed match
const found = templates.some(t =>
  String(t).trim().toLowerCase() === templateName.trim().toLowerCase()
);
```

Example: `"TK-EXPE-LS-GLS-330"` matches `"tk-expe-ls-gls-330"` ✓

---

### Retry Logic

| Attempt | What happens on failure |
|---|---|
| 1 | Transport error or no RSLI → wait 1s → retry |
| 2 | Same failure → wait 2s → retry |
| 3 | Same failure → return `unavailable: true` |

---

### Return Values from checkTemplateExists()

```js
{
  found: true | false,
  availableTemplates: string[],      // full list from printer
  error: string | null,              // error message if unavailable
  templateListUnavailable: bool      // true = couldn't read list at all
}
```

---

### UI Behaviour (LblPrinterStatusPanel)

| State | What User Sees |
|---|---|
| `templateFound === true` | ✅ "Found on printer (24 total templates)" |
| `templateFound === false` AND `unavailable === false` | ❌ "NOT found on printer" + shows all available templates |
| `templateFound === false` AND `unavailable === true` | ⚠️ "Template list unreadable — printing allowed" + confirmation prompt |

When `templateListUnavailable === true`, printing is **NOT blocked** — the user is shown a warning and can manually confirm the template is present before proceeding.

---

## Part 2 — Sending the STAR Print Command

### Flow Overview

```
Operator fills label data + clicks "Send Demo Print"
        │
        ▼
LblDemoPrintStep validates:
  - Printer selected? ✓
  - Status checked? ✓
  - Cartridge detected? ✓
  - Template found or user confirmed? ✓
  - Batch number, MFG date, MRP filled? ✓
        │
        ▼
Preview modal shown (POD field values)
        │
Operator clicks "Confirm & Print"
        │
        ▼
sendStarCommand(printer, templateName, quantity, { jobId, commandType, user })
        │
        ▼
  For each label (loop quantity times):
        │
        ├── Build STAR payload (buildStarCommand)
        │     {
        │       command: "STAR",
        │       templatename: "TK-EXPE-LS-GLS-330",
        │       startpage: "1", endpage: "1", loop: "true"
        │     }
        │
        ├── POST /print → middleware
        │
        ├── Check response: success? printer_ok? no RSAL codes?
        │
        ├── Persist LblPrintCommand audit record
        │
        └── If fail → stop loop, return error
        │
        ▼
  All labels sent?
        │
        ├── YES → update job status to "demo_print_sent"
        │         log LblEventLog entry
        │         toast "Demo Print Sent"
        │
        └── NO  → toast error, log failure, stay on step
```

### STAR Payload Structure

```json
{
  "printer_id": "P1",
  "printer": { "ip": "192.168.29.110", "port": 2030 },
  "command": {
    "command": "STAR",
    "templatename": "TK-EXPE-LS-GLS-330",
    "startpage": "1",
    "endpage": "1",
    "loop": "true"
  },
  "priority": "normal"
}
```

> ⚠️ **Important**: Label data (batch number, MRP, expiry date) is NOT sent in the STAR payload. These values are pre-configured inside the template on the Rynan middleware side. One POST = one label printed.

---

### STAR Response Success Criteria

All of the following must be true:

| Check | Condition |
|---|---|
| HTTP transport | No network/timeout error |
| `success` | `=== true` |
| `status` | `!== 'failed'` |
| `printer_ok` | `!== false` |
| `printer_protocol_error_code` | Not in HARD_FAILURE_CODES list |

**HARD_FAILURE_CODES**: `NYES`, `RSAL`, `RSMPOD`, `SYSN`, `FAILED`, `ERROR`, `FULL`, `NOK`

---

### Audit Record (LblPrintCommand)

Every STAR command creates one `LblPrintCommand` record:

| Field | Value |
|---|---|
| `command_id` | `CMD-{timestamp}-{random}` |
| `job_id` | Labelling job ID |
| `middleware_job_id` | Job ID from middleware response |
| `printer_id` | Printer config ID |
| `command_type` | `demo` / `bulk_start` / `test_ping` |
| `quantity` | Always `1` per record |
| `status` | `acknowledged` (success) or `failed` |
| `request_payload` | Full STAR payload sent |
| `response_payload` | Full response from middleware |
| `sent_by` | Operator email |

---

## Complete Sequence Diagram

```
Operator                LblDemoPrintStep         rynanPrinterService         Rynan Middleware         Printer
   │                          │                          │                          │                    │
   │─── Click Check Status ──▶│                          │                          │                    │
   │                          │── checkAndSyncPrinterConfig ──────────────────────▶│                    │
   │                          │                          │── GET /printers ────────▶│                    │
   │                          │                          │◀── printers list ────────│                    │
   │                          │                          │── POST /print MON ───────▶│── MON ───────────▶│
   │                          │                          │◀── MON response ──────────│◀─── MON ACK ──────│
   │                          │                          │── POST /print RQLI ──────▶│── RQLI ──────────▶│
   │                          │                          │◀── RSLI response ─────────│◀─── RSLI ─────────│
   │                          │                          │   (template list)         │                    │
   │◀── Printer Ready ────────│                          │                          │                    │
   │    Template: FOUND ✓     │                          │                          │                    │
   │                          │                          │                          │                    │
   │─── Click Send Print ────▶│                          │                          │                    │
   │                          │── sendStarCommand ───────▶│                          │                    │
   │                          │   (x quantity)           │── POST /print STAR ──────▶│── STAR ──────────▶│
   │                          │                          │◀── job acknowledged ──────│◀─── print start ──│
   │                          │                          │   persist LblPrintCommand │                    │
   │◀── Demo Print Sent ──────│                          │                          │                    │
   │    Job → demo_print_sent │                          │                          │                    │
```

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `fetchPrinterTemplateList(printer, maxRetries)` | Sends RQLI, retries up to N times, returns full template array |
| `checkTemplateExists(printer, templateName, maxRetries)` | Calls fetchPrinterTemplateList + case-insensitive match |
| `checkAndSyncPrinterConfig(printer, templateName)` | Full 5-step check: config → MON → RQLI |
| `sendStarCommand(printer, templateName, qty, ctx)` | Sends N STAR commands, one per label, persists audit |
| `extractTemplateList(body)` | Parses RQLI response, extracts template[] from any nesting |
| `isRsliResponse(body)` | Validates printer responded with RSLI command |

---

## Configuration (LblPrinterConfig fields used)

| Field | Used For |
|---|---|
| `register_app_link` | Middleware base URL |
| `ip_address` | Printer IP passed in every command payload |
| `port` | Printer port passed in every command payload |
| `request_timeout_ms` | HTTP timeout (default: 10000ms) |
| `send_retries` | STAR command retries (default: 1) |
| `default_priority` | `normal` or `high` for STAR commands |
| `auth_header_key/value` | Authorization headers for middleware |