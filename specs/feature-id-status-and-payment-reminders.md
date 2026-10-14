# Feature: Assigned ID Suspension, Disablement, `current_status` Flagging & Overdue Payment SMS Reminders

## 1. Overview
Organizations and schools using `sc-tapper-hris` need fine-grained control over assigned user/student ID cards (`api::employee-card.employee-card`). Specifically:
1. **Disable or Suspend Assigned IDs:** Administrators and Registrars must be able to either permanently **Disable** an ID card (e.g., lost/revoked) or temporarily **Suspend** an ID card (e.g., administrative or financial hold) and later **Activate/Reactivate** it once resolved.
2. **`current_status` Account/Payment Flagging:** Each assigned ID carries a `current_status` field (`Cleared`, `Payment_Overdue`, `Payment_Pending`, `Flagged`, `Under_Review`) alongside `statusReason` and `paymentDueDate`.
3. **Kiosk Scan Warning + Automated SMS/Notification Reminders:**
   - When a student's ID has `status: "Active"` and `current_status: "Payment_Overdue"`, tapping the ID at a gate kiosk **allows gate entry** (logs the `IN`/`OUT` attendance event), returns a structured `warning` payload for the Kiosk UI, and automatically triggers an **SMS / Notification reminder** (protected by a configurable cooldown window, default 24 hours).
   - When a student's ID has `status: "Suspended"`, tapping the ID **blocks gate entry** (`code: "CARD_SUSPENDED"`), returns the suspension reason to the Kiosk UI, and triggers a cooldown-protected reminder if flagged.
   - When a student's ID has `status: "Disabled"` (or `Lost`/`Expired`/`Replaced`), tapping the ID **blocks gate entry** (`code: "CARD_DISABLED"`).

---

## 2. Data Model Changes

### 2.0 Unified Profile Model (`api::employee.employee`) for Students & Personnel
The `employees` collection (`api::employee.employee`) serves as the unified **Cardholder / Person Profile** table for both employees and students so all gate scanning, RFID allowlist, card issuance, offline sync, and reporting flows work seamlessly from a single profile table:
| Attribute | Type | Enum / Default | Description |
| :--- | :--- | :--- | :--- |
| `personType` | `enumeration` | `Student`, `Employee` (default), `Faculty`, `Staff`, `Visitor` | Discriminates whether the profile belongs to a Student, Employee, Faculty, Staff, or Visitor. |
| `employeeNumber` | `string` (unique) | *Required* | Unified ID number (Employee ID or Student ID / LRN). |
| `courseOrProgram` | `string` | `null` | Student course, degree program, or senior high strand (e.g., `"BS Computer Science"`, `"STEM"`). |
| `yearOrGradeLevel` | `string` | `null` | Student year or grade level (e.g., `"3rd Year"`, `"Grade 11"`). |
| `section` | `string` | `null` | Class section (e.g., `"BSCS-3A"`). |
| `academicTerm` | `string` | `null` | Current semester or school year (e.g., `"1st Semester SY 2026-2027"`). |
| `notifyGuardianSms` | `boolean` | `true` | When `true` for a `Student`, SMS reminders prioritize `emergencyContactNumber` (Parent/Guardian) before falling back to `mobileNumber`. |

### 2.1 `api::employee-card.employee-card` (`employee_cards`)
| Attribute | Type | Enum / Default | Description |
| :--- | :--- | :--- | :--- |
| `status` | `enumeration` | `Active` (default), `Suspended`, `Lost`, `Disabled`, `Expired`, `Replaced` | Operational state of the physical ID card. |
| `current_status` | `enumeration` | `Cleared` (default), `Payment_Overdue`, `Payment_Pending`, `Flagged`, `Under_Review` | Financial/compliance standing associated with the user's ID. |
| `statusReason` | `text` | `null` | Reason for the flag, suspension, or disablement (e.g., `"Unpaid Tuition - October Installment"`). |
| `paymentDueDate` | `date` | `null` | Optional due date for the pending/overdue payment. |
| `flaggedAt` | `datetime` | `null` | Timestamp when `current_status` was set to a non-`Cleared` state. |
| `suspendedAt` | `datetime` | `null` | Timestamp when `status` was changed to `Suspended`. |
| `lastReminderSentAt` | `datetime` | `null` | Timestamp of the most recent SMS/notification reminder sent for cooldown enforcement. |

### 2.2 `api::allowed-rfid.allowed-rfid` (`allowed_rfids`)
- Added `Suspended` to the `status` enum (`["Unassigned", "Assigned", "Suspended", "Disabled"]`).
- Whenever an `employee-card` is suspended, disabled, or reactivated, the corresponding `allowed-rfid` inventory record is automatically synchronized (`Suspended`, `Disabled`, or `Assigned`).

### 2.3 New Content Type: `api::notification-log.notification-log` (`notification_logs`)
Stores an immutable audit trail of all SMS and in-app reminders triggered across the system.
| Attribute | Type | Description |
| :--- | :--- | :--- |
| `employee` | `relation` (`manyToOne`) | Target student/employee (`api::employee.employee`). |
| `card` | `relation` (`manyToOne`) | Associated ID card (`api::employee-card.employee-card`). |
| `channel` | `enumeration` | `SMS`, `In_App`, `Email` (default: `SMS`). |
| `recipientNumber` | `string` | Phone number used (`employee.mobileNumber` or fallback `employee.emergencyContactNumber`). |
| `triggerSource` | `enumeration` | `Gate_Scan`, `Admin_Flag`, `Manual_Reminder`, `Batch_Reminder`. |
| `statusFlag` | `string` | The `current_status` value at the time of notification (e.g., `Payment_Overdue`). |
| `message` | `text` (required) | Rendered reminder message body. |
| `deliveryStatus` | `enumeration` | `Sent`, `Simulated`, `Failed`, `Skipped_Cooldown`, `Skipped_No_Recipient`. |
| `providerResponse` | `json` | Raw gateway response or simulation metadata. |
| `sentAt` | `datetime` | Timestamp when the notification was processed. |

---

## 3. API Endpoints

### 3.1 Suspend an Assigned ID
- **Endpoint:** `POST /api/employee-cards/:documentId/suspend`
- **Payload:**
```json
{
  "reason": "Account Suspended - Delinquent Tuition Balance",
  "current_status": "Payment_Overdue",
  "paymentDueDate": "2026-09-30",
  "sendReminder": true
}
```
- **Behavior:** Sets `status = "Suspended"`, `suspendedAt = now`, updates `current_status` and `statusReason`, syncs `allowed-rfid.status = "Suspended"`, and optionally dispatches an immediate SMS reminder.

### 3.2 Disable an Assigned ID
- **Endpoint:** `POST /api/employee-cards/:documentId/disable`
- **Payload:**
```json
{
  "reason": "Lost ID card reported by student"
}
```
- **Behavior:** Sets `status = "Disabled"`, updates `statusReason`, and syncs `allowed-rfid.status = "Disabled"`.

### 3.3 Activate / Reactivate an Assigned ID
- **Endpoint:** `POST /api/employee-cards/:documentId/activate`
- **Payload:**
```json
{
  "current_status": "Cleared",
  "reason": "Balance settled at Cashier Office"
}
```
- **Behavior:** Restores `status = "Active"`, clears `suspendedAt`, resets `current_status = "Cleared"` (unless another status is specified), and syncs `allowed-rfid.status = "Assigned"`.

### 3.4 Flag / Update `current_status` on an Assigned ID
- **Endpoint:** `PATCH /api/employee-cards/:documentId/current-status`
- **Payload:**
```json
{
  "current_status": "Payment_Overdue",
  "statusReason": "Unpaid Tuition - October Installment",
  "paymentDueDate": "2026-10-10",
  "suspendCard": false,
  "sendReminder": true,
  "forceReminder": false
}
```
- **Response (`200 OK`):**
```json
{
  "success": true,
  "card": {
    "documentId": "card-doc-id",
    "cardNumber": "C-TEST-005",
    "rfidUid": "666666",
    "status": "Active",
    "current_status": "Payment_Overdue",
    "statusReason": "Unpaid Tuition - October Installment",
    "paymentDueDate": "2026-10-10"
  },
  "notification": {
    "triggered": true,
    "deliveryStatus": "Simulated",
    "channel": "SMS",
    "recipientNumber": "+639171234567",
    "message": "[SC Tapper Notice] Reminder for Mark Overdue (ID: TEST-004): Your account is flagged as PAYMENT OVERDUE (Unpaid Tuition - October Installment). Due date: 2026-10-10. Please settle your balance at the Cashier/Accounting Office."
  }
}
```

### 3.5 Bulk Flag Student/User IDs
- **Endpoint:** `POST /api/employee-cards/bulk-flag`
- **Payload:**
```json
{
  "employeeNumbers": ["TEST-001", "TEST-002"],
  "current_status": "Payment_Overdue",
  "statusReason": "Tuition 2nd Installment Overdue",
  "paymentDueDate": "2026-10-15",
  "suspendCard": false,
  "sendReminder": true
}
```
- **Response (`200 OK`):**
```json
{
  "success": true,
  "summary": {
    "totalMatched": 2,
    "updated": 2,
    "remindersSent": 2
  },
  "cards": [ ... ]
}
```

### 3.6 Trigger Manual or Batch Overdue Reminders
- **Single Card Reminder:** `POST /api/employee-cards/:documentId/send-reminder`
  - Optional body: `{ "force": true, "customMessage": "..." }`
- **Batch Overdue Reminders:** `POST /api/notifications/send-overdue-reminders`
  - Optional body: `{ "current_status": "Payment_Overdue", "force": false }`
- **Audit Logs:** `GET /api/notification-logs?populate[0]=employee&populate[1]=card&sort=sentAt:desc`

---

## 4. Kiosk Scan Flow (`POST /api/attendance/scan`)

1. **Active ID + `current_status: "Payment_Overdue"` (or other non-`Cleared` flag):**
   - **Allows gate entry** and creates the `IN`/`OUT` `attendance-event`.
   - Returns `warning` object in the scan response:
     ```json
     {
       "success": true,
       "event": { "eventId": "...", "direction": "IN", "eventTime": "..." },
       "employee": { "employeeNumber": "TEST-004", "displayName": "Mark Overdue" },
       "card": {
         "status": "Active",
         "current_status": "Payment_Overdue",
         "statusReason": "Unpaid Tuition - October Installment",
         "paymentDueDate": "2026-10-10"
       },
       "warning": {
         "flagged": true,
         "current_status": "Payment_Overdue",
         "statusReason": "Unpaid Tuition - October Installment",
         "paymentDueDate": "2026-10-10",
         "reminderTriggered": true,
         "deliveryStatus": "Simulated",
         "warningMessage": "Payment Overdue: Unpaid Tuition - October Installment. Reminder notification triggered."
       },
       "message": "Welcome, Mark!"
     }
     ```
   - Automatically dispatches an SMS/notification reminder if no reminder was sent within `SMS_REMINDER_COOLDOWN_HOURS` (default `24` hours).

2. **Suspended ID (`status: "Suspended"`):**
   - **Blocks gate entry** and returns:
     ```json
     {
       "success": false,
       "code": "CARD_SUSPENDED",
       "message": "ID Suspended: Account Suspended - Delinquent Balance",
       "card": {
         "status": "Suspended",
         "current_status": "Payment_Overdue",
         "statusReason": "Account Suspended - Delinquent Balance"
       },
       "employee": { "employeeNumber": "TEST-005", "displayName": "Sarah Suspended" }
     }
     ```

3. **Disabled ID (`status: "Disabled" | "Lost" | "Expired" | "Replaced"`):**
   - **Blocks gate entry** and returns `{ "success": false, "code": "CARD_DISABLED", "message": "..." }`.

---

## 5. Environment Configuration (`.env`)

```dotenv
SMS_ENABLED=false
SMS_PROVIDER=mock
SMS_PROVIDER_URL=https://api.semaphore.co/api/v4/messages
SMS_API_KEY=your_sms_gateway_api_key
SMS_SENDER_NAME=SCTAPPER
SMS_REMINDER_COOLDOWN_HOURS=24
```
- When `SMS_ENABLED=false`, reminders run in **Simulated** mode (`deliveryStatus: "Simulated"`), writing full audit records to `notification-log` and Strapi server logs without requiring external SMS credits.

