# Frontend Implementation Specification - ID Suspension, `current_status` Flagging & Payment Reminders

This document outlines the frontend UI/UX and API integration requirements for managing ID card lifecycles (`Active`, `Suspended`, `Disabled`), flagging student/user IDs with `current_status` (e.g., `Payment_Overdue`), displaying live Kiosk overdue banners, and reviewing SMS reminder logs in `sc-tapper-hris-web`.

---

## 1. Kiosk Screen (`pages/kiosk.vue`) Behavior on Tap

When an RFID card is scanned via `POST /api/attendance/scan`, the Kiosk UI handles three distinct ID states:

### 1.1 Active ID + Flagged `current_status` (e.g., `Payment_Overdue`)
- **Gate Entry:** **Allowed** (`success: true`, logs `IN` or `OUT`).
- **Visual Treatment:**
  - Display the student/employee profile card with a prominent **Amber Warning Banner** at the top or bottom of the scan card:
    - **Badge:** `PAYMENT OVERDUE` (or formatted `current_status`).
    - **Detail Text:** Display `warning.statusReason` (e.g., *"Unpaid Tuition - October Installment"*) and `warning.paymentDueDate` if present.
    - **SMS Status Pill:** If `warning.reminderTriggered === true`, show a subtle pill: `"SMS Reminder Sent to Registered Mobile"`.
- **Audio Cue:** Play standard valid scan chime followed by a soft secondary alert tone so the guard is aware without holding up the gate line.

### 1.2 Suspended ID (`code: "CARD_SUSPENDED"`)
- **Gate Entry:** **Blocked** (`success: false, code: "CARD_SUSPENDED"`).
- **Visual Treatment:**
  - Full-width **Orange/Red Held State Card** showing the student's name and photo (returned in `response.employee`) with a large **`ID SUSPENDED`** badge.
  - Display `response.message` / `response.card.statusReason` (e.g., *"Account Suspended - Delinquent Balance. Please proceed to the Accounting Office."*).
- **Audio Cue:** Play error/hold buzzer.

### 1.3 Disabled / Lost ID (`code: "CARD_DISABLED"`)
- **Gate Entry:** **Blocked** (`success: false, code: "CARD_DISABLED"`).
- **Visual Treatment:**
  - High-contrast **Red Error Card** displaying **`ID CARD DISABLED`** and `response.message`.

---

## 2. Admin Profile & ID Management (`pages/admin/profiles/[id].vue` & `/admin/cards`)

### 2.1 Assigned ID Status & `current_status` Badges
In the Employee/Student Profile drawer and Card Management table, render two distinct badges for each assigned ID:
1. **Card Operational Status (`status`):**
   - `Active`: Emerald/Green badge
   - `Suspended`: Amber/Orange badge
   - `Disabled` / `Lost`: Red/Slate badge
2. **Account / Payment Standing (`current_status`):**
   - `Cleared`: Neutral/Green check badge (`Cleared`)
   - `Payment_Overdue`: Red/Amber pulsing badge (`Payment Overdue`)
   - `Payment_Pending`: Blue/Amber badge (`Payment Pending`)
   - `Flagged` / `Under_Review`: Purple/Orange badge

### 2.2 ID Action Controls (`CardStatusActionModal.vue`)
Provide quick action buttons on any assigned ID row:
- **"Flag Status / Payment"**: Opens a modal to set:
  - `current_status` dropdown (`Cleared`, `Payment_Overdue`, `Payment_Pending`, `Flagged`, `Under_Review`)
  - `statusReason` text input (e.g., `"Unpaid Tuition - 2nd Semester"`)
  - `paymentDueDate` date picker
  - Checkbox: **"Also suspend ID gate access (`status = Suspended`)"**
  - Checkbox: **"Send SMS reminder immediately"** (default checked when `Payment_Overdue` is selected)
  - Calls `PATCH /api/employee-cards/:documentId/current-status`.
- **"Suspend ID"**: Calls `POST /api/employee-cards/:documentId/suspend` with a reason prompt.
- **"Reactivate / Clear ID"**: Shown when a card is `Suspended` or `Disabled`; calls `POST /api/employee-cards/:documentId/activate` (resets `status = Active` and `current_status = Cleared`).
- **"Disable ID"**: Calls `POST /api/employee-cards/:documentId/disable` when a card is permanently revoked or lost.
- **"Send SMS Reminder"**: Shown when `current_status !== 'Cleared'`; calls `POST /api/employee-cards/:documentId/send-reminder`.

---

## 3. Bulk Overdue Payment Flagging (`BulkFlagOverdueModal.vue`)

Allows Registrar / Accounting staff to flag dozens of students who missed a payment deadline in one action:
1. **Input:** Paste a list of Student/Employee Numbers (`employeeNumbers`), Card Numbers (`cardNumbers`), or upload a CSV.
2. **Configuration:**
   - Select `current_status` (default: `Payment_Overdue`)
   - Enter `statusReason` (e.g., `"October Tuition Installment Overdue"`) and `paymentDueDate`
   - Toggle **"Suspend IDs"** (optional; leave unchecked to allow gate entry with warning + SMS on tap)
   - Toggle **"Send Immediate SMS Reminders"**
3. **API Call:** `POST /api/employee-cards/bulk-flag`
4. **Result Summary:** Displays `totalMatched`, `updated`, and `remindersSent`.

---

## 4. Notification & SMS Audit Log (`pages/admin/notifications.vue`)

A dedicated tab or page to monitor outbound SMS and in-app reminders:
- **Header Action:** **"Send Reminders to All Overdue IDs"** button -> calls `POST /api/notifications/send-overdue-reminders`.
- **Table Columns (`GET /api/notification-logs?populate[0]=employee&populate[1]=card&sort=sentAt:desc`):**
  - **Sent At** (`sentAt`)
  - **Student / User** (`employee.firstName employee.lastName` + `employee.employeeNumber`)
  - **Card / RFID** (`card.cardNumber` / `card.rfidUid`)
  - **Trigger Source** (`Gate_Scan`, `Admin_Flag`, `Manual_Reminder`, `Batch_Reminder`)
  - **Status Flag** (`Payment_Overdue`, etc.)
  - **Recipient** (`recipientNumber` or `In_App`)
  - **Delivery Status** (`Sent`, `Simulated`, `Failed`, `Skipped_Cooldown`, `Skipped_No_Recipient`)
  - **Message Preview** (`message`)
