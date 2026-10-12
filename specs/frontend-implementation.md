# Frontend Implementation Specification - Nuxt Guardhouse UI

This document serves as the developer specification for building the Nuxt 3/4 frontend (the Guardhouse Kiosk) for the `sc-trapper-hris` attendance system. It outlines the API contracts, logic flows, and hardware integration steps required to implement the UI.

## 1. Authentication Flow
The Guardhouse UI must authenticate the operator before allowing session creation or scanning.

**Endpoint:** `POST /api/auth/local`
**Payload:**
```json
{
  "identifier": "guard@example.com",
  "password": "yourpassword"
}
```
**Response:** Returns a `jwt` token and `user` object.
**Action:** Store the JWT token securely (e.g., using `@sidebase/nuxt-auth` or a secure cookie). All subsequent API requests must include the header:
`Authorization: Bearer <your-jwt-token>`

---

## 2. Session Management
Before any scans can be processed, an active "Attendance Session" must exist.

### A. Check Current Session
When the kiosk loads after login, check if a session is already open.
**Endpoint:** `GET /api/attendance/sessions/current?deviceId=GATE-01`
**Response (Active Session Exists):**
```json
{
  "success": true,
  "session": {
    "documentId": "abc-123",
    "name": "Gate 1 - Morning",
    "status": "Open",
    "deviceId": "GATE-01"
  }
}
```
**Response (No Session):**
```json
{
  "success": true,
  "session": null
}
```

### B. Open a Session
If `session` is null, prompt the guard to open a new session.
**Endpoint:** `POST /api/attendance/sessions/open`
**Payload:**
```json
{
  "name": "Gate 1 - Morning",
  "location": "Main Gate",
  "deviceId": "GATE-01"
}
```

### C. Close a Session
At the end of the shift, the guard closes the session.
**Endpoint:** `POST /api/attendance/sessions/:documentId/close`

---

## 3. The RFID Scan API
This is the core endpoint triggered whenever an RFID card is scanned.

**Endpoint:** `POST /api/attendance/scan`
**Payload:**
```json
{
  "rfidUid": "04AABBCCDD",
  "deviceId": "GATE-01",
  "scannedAt": "2026-10-09T08:03:15+08:00" 
}
```
*(Note: `scannedAt` is optional. If omitted, the server uses current time)*

### Expected Responses

**1. Success (Valid Scan): HTTP 200**
```json
{
  "success": true,
  "event": {
    "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "direction": "IN",
    "eventTime": "2026-10-09T08:03:15.000Z"
  },
  "employee": {
    "employeeNumber": "EMP-001",
    "displayName": "Juan Dela Cruz",
    "profilePicture": null
  },
  "message": "Welcome, Juan!"
}
```
*Frontend Action:* Briefly display the employee's photo, name, and their IN/OUT status in a large, readable format on the screen. Add the record to a "Today's Attendance" list on the side.

**2. Duplicate Scan Error: HTTP 400**
```json
{
  "error": {
    "message": "Card scanned recently",
    "details": {
      "code": "DUPLICATE_SCAN"
    }
  }
}
```
*Frontend Action:* Ignore or show a brief warning toast ("Card already scanned"). Do not update the main display.

**3. Unknown Card / Inactive Employee: HTTP 400**
*Codes:* `UNKNOWN_CARD`, `UNKNOWN_EMPLOYEE`, `EMPLOYEE_INACTIVE`
*Frontend Action:* Display an error overlay ("Unregistered Card" or "Inactive Employee") accompanied by an alert sound.

---

## 4. Hardware Integration (RFID Scanner)
The hardware integration utilizes a physical RFID scanner that acts as a standard USB keyboard emulator.

**How it works:**
1. When an RFID card is tapped, the scanner reads the ID from the card and rapidly "types" the UID characters into the system.
2. Immediately upon completing the ID read, the scanner sends an `Enter` key press (newline).
3. This `Enter` keystroke serves as the submit action (equivalent to clicking a "Submit" button).

**Frontend Implementation:**
To provide a seamless kiosk experience, do *not* require the user to manually click into a text input. Use a global keystroke listener in Nuxt:
1. Listen to `window.addEventListener('keydown')`.
2. Accumulate typed characters into a buffer string.
3. When the `Enter` key event is detected (acting as the submit action), send the accumulated buffer string as the `rfidUid` to the `/api/attendance/scan` endpoint.
4. Clear the buffer immediately after submission.
5. Implement a small timeout (e.g., 50ms per key) to clear the buffer if a human accidentally types on the keyboard, ensuring only fast machine-inputs from the scanner are processed.

---

## 5. Gate Activity & Real-Time History
To allow gate administrators and guards to verify who entered and exited through a specific gate, the UI provides a **Gate History** view.

### A. Gate History Feed
This view displays a live or paginated ledger of all scan events at the gate.

**Endpoint:** `GET /api/attendance-events`
**Query Parameters:**
```
?populate[employee][populate]=profilePicture
&populate=card
&populate=session
&sort=eventTime:desc
&pagination[page]=1
&pagination[pageSize]=25
```

**Optional Filters for Gate Admins:**
- Filter by Gate / Device: `&filters[deviceId][$eq]=GATE-01`
- Filter by Direction: `&filters[direction][$eq]=IN` (or `OUT`)
- Filter by Date Range: `&filters[eventTime][$gte]=2026-10-12T00:00:00.000Z&filters[eventTime][$lte]=2026-10-12T23:59:59.999Z`
- Search by Employee: `&filters[employee][displayName][$containsi]=Juan` or `&filters[employee][employeeNumber][$containsi]=EMP-001`

### B. Displayed Data in History Table
Each log row in the Gate History displays:
1. **Timestamp:** Formatted as `hh:mm:ss A` (and date if viewing historical records).
2. **Direction Badge:** 
   - `IN` - Green badge with entry indicator.
   - `OUT` - Blue/Amber badge with exit indicator.
3. **Employee Details:**
   - Thumbnail profile picture (fallback to initials avatar).
   - Display name and Employee Number.
   - Department and position.
4. **Card Info:** Card number / masked RFID UID (e.g., `****CCDD`).
5. **Gate / Device:** e.g., `GATE-01` / `Main Gate`.
6. **Status:** `Valid` (or `Rejected`).

---

## 6. Employee Profile Management & Card Assignment
Admin users can manage employee profiles and link physical RFID cards directly from the kiosk interface.

### A. Employee Profile Management
**1. Fetch Employee Directory:**
- **Endpoint:** `GET /api/employees?populate[cards]=*&populate=profilePicture&sort=lastName:asc`
- Displays active employees with their currently assigned RFID card, department, and status.

**2. Create / Register New Profile:**
- **Endpoint:** `POST /api/employees`
- **Payload:**
```json
{
  "data": {
    "employeeNumber": "EMP-004",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "department": "Security",
    "position": "Officer",
    "employmentStatus": "Active",
    "email": "juan.delacruz@example.com"
  }
}
```

### B. RFID Card Enrollment ("Tap-to-Assign" Workflow)
Admins can enroll and assign an RFID card to an employee without manually typing complex UID strings.

**Workflow:**
1. In the Employee Directory, Admin clicks **"Assign RFID Card"** on an employee row.
2. An **"Enroll RFID Card"** modal opens with a prompt: *"Please tap the RFID card on the scanner..."*
3. The modal captures keystrokes from the RFID reader:
   - Scanner reads card UID and emits the `Enter` key.
   - The modal automatically captures the input and populates the `rfidUid` field.
4. Admin confirms the assignment by clicking submit.

**Issue Card Endpoint:**
- **Endpoint:** `POST /api/employee-cards/issue`
- **Payload:**
```json
{
  "employeeId": "<employee-documentId>",
  "rfidUid": "04AABBCCDD",
  "cardNumber": "CARD-004",
  "cardType": "RFID",
  "notes": "Issued at Gate 1 Kiosk"
}
```

### C. Disable / Revoke Card
If a card is lost or damaged:
- **Endpoint:** `POST /api/employee-cards/:documentId/disable`
- Immediately revokes access; subsequent scans with that card return `UNKNOWN_CARD`.

---

## 7. ID System & Attendance Reporting
To provide actionable insights tailored to an ID badge and gate access system, the admin dashboard includes specialized reporting views.

### A. Real-Time On-Premise Headcount (Gate Roll-Call)
Essential for facility safety, security audits, and emergency roll-calls.
- **Metric Cards:**
  - **Currently On-Premises:** Total headcount where the latest event is `IN`.
  - **Total Entrances Today:** Total `IN` events today.
  - **Total Exits Today:** Total `OUT` events today.
- **On-Premise Roll-Call Table:** Real-time list of employees currently inside the premises with their entry time and gate location.

### B. Daily Attendance Summary Report
Provides daily work hours and punch tracking for HR and security.
- **Endpoint:** `GET /api/reports/attendance/daily?date=YYYY-MM-DD`
- **Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "employee": {
        "id": "emp-doc-id",
        "employeeNumber": "EMP-001",
        "displayName": "Juan Dela Cruz"
      },
      "firstIn": "2026-10-12T08:02:15.000Z",
      "lastOut": "2026-10-12T17:05:30.000Z",
      "totalHours": 9.05,
      "numberOfScans": 2,
      "currentStatus": "OUT",
      "missingOut": false
    }
  ]
}
```

### C. ID System Anomaly & Exception Reports
Detects irregularities in card usage and attendance compliance:
1. **Missing OUT Scans (`missingOut: true`):** Employees who tapped IN but have not tapped OUT at shift end.
2. **Missing IN Scans:** Employees whose first recorded event of the day was an OUT.
3. **Suspicious / Rapid Duplicate Scans:** Consecutive taps within the 5-second debounce window.
4. **Unregistered / Inactive Card Attempts:** Log of rejected taps with unregistered cards or inactive employees for security review.

### D. Individual Employee Attendance History
For auditing a specific employee's gate history over a date range.
- **Endpoint:** `GET /api/reports/attendance/employee/:employeeDocumentId?startDate=2026-10-01&endDate=2026-10-31`

### E. Exporting & Print Support
- **CSV Export:** Direct browser export of Daily Attendance and Gate History logs.
- **Printable Gate Manifest:** Print-optimized view (`@media print`) allowing guards/admins to print the daily sign-in manifest / roll-call on demand.

---

## 8. UI State Machine & Navigation
The application supports two operating modes: **Kiosk Scanning Mode** and **Admin Dashboard**.

```
[ Unauthenticated ]
        |
        v
    [ Login ] (/login)
        |
        +-----------------------------------------+
        |                                         |
        v (Operator / Guard)                      v (Admin Access)
[ Check Active Session ]                    [ Admin Portal ]
        |                                         |-- /admin/history (Gate History)
        +---> [ No Session: Open Session Modal ]  |-- /admin/profiles (Employee & Card Enrollment)
        |                                         |-- /admin/reports (Headcount & Attendance Reports)
        v                                         +-- /admin/sync (Offline Sync Control Panel)
[ Kiosk Mode: Ready to Scan ] <---------------------------+ (Switch back to Kiosk)
        | (Card Tapped + Enter)
        v
[ Processing Scan ]
        |
        +---> [ Success: Display Employee 3s ] ---> [ Kiosk Mode ]
        +---> [ Error: Show Alert Toast/Sound ] ---> [ Kiosk Mode ]
```

### Kiosk Mode vs Admin Mode Controls:
- **Kiosk Mode (`/kiosk`):** Fullscreen, distraction-free scanning terminal. Global RFID listener active.
- **Admin Access:** Accessible via a subtle "Admin Menu" button in the corner, protected by an Admin PIN or user permission check (`user.role === 'Admin'`).
- In Admin views (Profiles, Reports, History), the global background scanner listener is paused, except inside dedicated input modals (such as the "Tap to Assign Card" modal).

---

## 9. Testing & Mock Commands

The backend API is pre-configured to allow access to the `Authenticated` role. You can test the endpoints in your terminal using these `curl` commands.

### A. Login to get your JWT
*(Ensure you have created a User in the Strapi Admin Panel first)*
```bash
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{"identifier": "guard@example.com", "password": "yourpassword"}'
```

### B. Open a Session
```bash
curl -X POST http://localhost:1337/api/attendance/sessions/open \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"name": "Gate 1", "deviceId": "GATE-01"}'
```

### C. Check Current Session
```bash
curl -X GET "http://localhost:1337/api/attendance/sessions/current?deviceId=GATE-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### D. Simulate an RFID Scan
```bash
curl -X POST http://localhost:1337/api/attendance/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"rfidUid": "1234567890", "deviceId": "GATE-01"}'
```

### E. Query Gate History
```bash
curl -X GET "http://localhost:1337/api/attendance-events?populate[employee][populate]=profilePicture&populate=card&sort=eventTime:desc&filters[deviceId]=GATE-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### F. Issue/Assign RFID Card to Employee
```bash
curl -X POST http://localhost:1337/api/employee-cards/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"employeeId": "EMPLOYEE_DOCUMENT_ID", "rfidUid": "1234567890", "cardNumber": "CARD-001"}'
```

### G. Get Daily Attendance & Headcount Report
```bash
curl -X GET "http://localhost:1337/api/reports/attendance/daily?date=2026-10-12" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### H. Push Local Attendance Events to Cloud Server
```bash
curl -X POST http://cloud-server-host:1337/api/sync/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLOUD_JWT_TOKEN" \
  -d '{
    "deviceId": "GATE-01",
    "events": [
      {
        "eventId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "employeeNumber": "EMP-001",
        "rfidUid": "04AABBCCDD",
        "direction": "IN",
        "eventTime": "2026-10-12T08:03:15.000Z"
      }
    ]
  }'
```

### I. Pull Master Data from Cloud Server
```bash
curl -X GET "http://cloud-server-host:1337/api/sync/pull?lastSyncTime=2026-10-12T00:00:00.000Z" \
  -H "Authorization: Bearer YOUR_CLOUD_JWT_TOKEN"
```

---

## 10. Offline Mode & Cloud Synchronization

The guardhouse kiosk is designed to operate against a **local offline Strapi instance (SQLite)** to ensure instantaneous, zero-latency RFID scanning even during network downtime. The Nuxt frontend acts as the synchronization coordinator between the Local Strapi instance and the Central Cloud Server (PostgreSQL).

### A. Network & Sync Status UI
- **Live Connection Badge:** A persistent connection indicator in the header (e.g., Green dot = Cloud Online, Amber/Red dot = Cloud Offline). Nuxt periodically pings the Cloud Server's `/api/sync/pull` or health check endpoint.
- **Pending Scans Counter:** A badge showing how many local scans have not yet been synchronized to the cloud (`syncStatus: 'Local'`).
- **Offline Mode Notification:** A subtle notification informing the operator that scans are being captured offline safely and will auto-sync once internet connectivity is restored.

### B. Synchronization Architecture (Nuxt as Sync Coordinator)

```
[ RFID Tap ] ──> [ Local Strapi (SQLite) ] (Stores scan instantly with syncStatus: "Local")
                           ▲
                           │ 1. Fetch unsynced events (syncStatus: 'Local')
                     [ Nuxt Kiosk App ]
                           │ 2. POST /api/sync/push (Batch upload to Cloud)
                           ▼
                 [ Cloud Strapi (PostgreSQL) ]
                           │
                     (Returns syncedEventIds)
                           ▼
                     [ Nuxt Kiosk App ]
                           │ 3. Mark events locally as syncStatus: "Synced"
                           ▼
                 [ Local Strapi (SQLite) ]
```

#### 1. Push: Local Scans to Cloud (Auto-Sync & Manual)
- **Auto-Sync Interval:** A background timer (every 2-5 minutes) runs in Nuxt when the browser detects an active network connection (`navigator.onLine === true`).
- **Step 1 - Retrieve Local Unsynced Events:**
  `GET LOCAL_STRAPI/api/attendance-events?filters[syncStatus][$eq]=Local&populate[employee]=*&populate[card]=*`
- **Step 2 - Transmit to Cloud Server:**
  `POST CLOUD_STRAPI/api/sync/push`
  Payload contains `deviceId` and array of formatted events with original `eventId`, `employeeNumber`, `rfidUid`, `direction`, and `eventTime`.
- **Step 3 - Acknowledge Local Records:**
  For each `eventId` returned in `result.syncedEventIds`:
  `PUT LOCAL_STRAPI/api/attendance-events/:documentId` with `{ "data": { "syncStatus": "Synced" } }`.

#### 2. Pull: Master Directory Data from Cloud
To ensure new employees or replaced RFID cards issued by HR on the Cloud portal are available at the gate:
- **Trigger:** Initiated at shift start, session open, or via manual click in `/admin/sync`.
- **Step 1 - Fetch Updates from Cloud:**
  `GET CLOUD_STRAPI/api/sync/pull?lastSyncTime=<LAST_SYNC_TIMESTAMP>`
  Returns updated employees, active cards, and session data since the last sync.
- **Step 2 - Upsert Local Cache:**
  Nuxt iterates over the returned records and updates the local SQLite database via local Strapi endpoints (`/api/employees`, `/api/employee-cards`), saving the `serverTime` returned by the cloud as the new `lastSyncTime`.

### C. Admin Dashboard: Sync Control Panel (`/admin/sync`)
Dedicated administrative interface to manage and diagnose data synchronization:
- **Cloud Connectivity Diagnostic:** Live ping indicator and latency to the Cloud backend.
- **Unsynced Queue Inspector:** View exact list of attendance events waiting to sync.
- **Manual "Push Scans Now" Button:** Immediately forces a push of all pending events.
- **Manual "Pull Master Data" Button:** Pulls down the latest employee and card registry.
- **Sync History Log:** Timestamped table of recent sync operations, success counts, failed event counts, and error descriptions.


---

## 11. Implementation Roadmap & Phases

To ensure structured development and early validation of hardware interactions, the frontend implementation is divided into four distinct phases.

### Phase 1: Foundation & Core Kiosk Loop (The MVP)
*Goal: Deliver the functional scanning terminal for operators with real-time feedback.*
- **Pages & Routes:**
  - `/login` - Operator authentication screen.
  - `/kiosk` (or `/`) - Primary fullscreen scanning terminal.
- **Key Deliverables:**
  - Nuxt 3/4 project scaffold with Pinia and Tailwind CSS / UI library.
  - JWT Authentication state with persistent session storage.
  - Gate Session management (check active session on mount, "Open Session" modal, "Close Session" action).
  - Global Keystroke Listener for the RFID scanner (accumulate UID + submit on `Enter` newline with input debounce).
  - Kiosk UI state transitions: Idle state ("Ready to Scan"), 3-second temporary Employee Verification Card overlay on valid scan, and error alert toasts/sounds on failure.
  - Recent scans ticker/feed on the kiosk screen.

### Phase 2: Gate Administration & Identity Management
*Goal: Empower gate supervisors to review gate throughput and enroll RFID cards locally.*
- **Pages & Routes:**
  - `/admin/history` - Live Gate History & Audit Trail.
  - `/admin/profiles` - Employee Directory & Card Enrollment.
- **Key Deliverables:**
  - Admin layout wrapper with navigation sidebar/header and security protection (Admin PIN / role gate).
  - Gate Activity Table with real-time/paginated logs, direction badges (Green IN / Blue OUT), employee photos, and filtering (by direction, gate, date range, or name).
  - Employee profile directory view and modal to add/register a new employee.
  - "Tap-to-Assign" Card Enrollment Modal: Pauses background listener and listens specifically for the next card tap to auto-populate the RFID UID and associate it with an employee via `/api/employee-cards/issue`.
  - Ability to disable/revoke lost cards via `/api/employee-cards/:documentId/disable`.

### Phase 3: Insights, Reporting, and Exports
*Goal: Provide facilities, HR, and security with actionable gate metrics and emergency roll-calls.*
- **Pages & Routes:**
  - `/admin/reports` - Gate Reports & Analytics Dashboard.
- **Key Deliverables:**
  - Real-Time Headcount & Roll-Call Widget: Displaying live count of personnel currently on-premises (status `IN`) for security and evacuation roll-calls.
  - Daily Attendance Summary Table: First IN, Last OUT, total hours calculated, and missing punch flags.
  - Exception Tracking: Filtering for anomalies (Missing OUTs, rapid duplicate scans, unregistered card attempts).
  - Individual Employee Attendance punch history query.
  - CSV Export utility and print-ready stylesheet (`@media print`) for daily gate manifests.

### Phase 4: Offline Resilience & Cloud Synchronization
*Goal: Enable seamless operation on local SQLite with background sync to the live PostgreSQL cloud server.*
- **Pages & Routes:**
  - Persistent Header Component - Network & Sync Status indicators.
  - `/admin/sync` - Offline Sync Control Panel.
- **Key Deliverables:**
  - Network Health Check: Periodic health-check pinger to cloud server and reactive online/offline status badge.
  - Pending Scans Counter: Reactive badge displaying the count of local records with `syncStatus: 'Local'`.
  - Nuxt Background Sync Coordinator: Automated interval-based push of local scans to `POST CLOUD/api/sync/push` and status update to `syncStatus: 'Synced'`.
  - Master Directory Pull: Shift-start / manual pull from `GET CLOUD/api/sync/pull` and local SQLite cache upsert.
  - Admin Sync Control Panel: Queue inspector, manual "Push Scans" & "Pull Master Data" action triggers, and sync audit log history.
