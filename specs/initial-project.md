Yes. I would keep the first version intentionally simple, but design the backend so it can later become a proper HRIS. The most important architectural decision is to make **attendance scans append-only events**, rather than continually modifying an employee's attendance record.

For Strapi 5, I would implement the business logic in **custom routes → controllers → services**, using the Strapi 5 Document Service API rather than the deprecated Entity Service. Strapi explicitly supports custom controllers, services, routes, policies and middleware for this kind of backend customization. ([Strapi Docs][1])

# Developer Specification — ID-Based HRIS Attendance System

## 1. Project Overview

Build a lightweight HRIS/Employee ID and Attendance System using:

* **Backend:** Strapi 5
* **Database — Cloud:** PostgreSQL
* **Database — Local/Offline:** SQLite
* **Frontend:** Nuxt 3/4
* **Authentication:** Strapi Users & Permissions
* **ID scanner:** USB RFID/NFC scanner operating as keyboard input
* **Profile photos:** Strapi Media Library
* **Deployment modes:**

  * Cloud/server deployment
  * Local/offline deployment
* **Primary users:**

  * Administrator
  * HR/Staff
  * Guardhouse/Attendance Operator

The first version should focus on:

1. Employee profiles
2. Employee ID/RFID assignment
3. Attendance sessions
4. RFID scanning
5. Automatic IN/OUT determination
6. Attendance history
7. Manual attendance
8. Attendance reports
9. Employee import
10. Profile-photo import/linking
11. Cloud/local synchronization architecture

---

# 2. Important Design Principle

Do **not** make the employee record itself contain the attendance history.

Instead:

```text
Employee
   │
   ├── Employee ID / RFID
   │
   └── Attendance Events
          │
          ├── IN
          ├── OUT
          ├── IN
          ├── OUT
          └── ...
```

Every RFID scan creates an **immutable attendance event**.

For example:

```text
08:01  EMP-001  IN
12:02  EMP-001  OUT
13:01  EMP-001  IN
17:05  EMP-001  OUT
```

This makes reporting, auditing, synchronization and offline operation much easier.

---

# 3. Core Content Types

Create these Strapi collection types.

## A. Employee

API ID:

```text
employee
```

Suggested fields:

| Field                  | Type        | Required | Description                         |
| ---------------------- | ----------- | -------: | ----------------------------------- |
| employeeNumber         | String      |      Yes | HR/company employee number          |
| firstName              | String      |      Yes | First name                          |
| middleName             | String      |       No | Middle name                         |
| lastName               | String      |      Yes | Last name                           |
| suffix                 | String      |       No | Jr., Sr., III, etc.                 |
| displayName            | String      |       No | Computed/display name               |
| email                  | Email       |       No | Employee email                      |
| mobileNumber           | String      |       No | Contact number                      |
| birthDate              | Date        |       No | Date of birth                       |
| gender                 | Enumeration |       No | Male/Female/Other                   |
| department             | String      |       No | Department                          |
| position               | String      |       No | Job position                        |
| employmentStatus       | Enumeration |      Yes | Active/Inactive/On Leave/Terminated |
| dateHired              | Date        |       No | Hiring date                         |
| dateTerminated         | Date        |       No | Termination date                    |
| address                | Text        |       No | Address                             |
| emergencyContactName   | String      |       No | Emergency contact                   |
| emergencyContactNumber | String      |       No | Emergency contact number            |
| profilePicture         | Media       |       No | Employee photograph                 |
| idCardNumber           | String      |      Yes | Physical ID card number             |
| rfidUid                | String      |       No | RFID UID/card number                |
| externalId             | String      |       No | ID from another HR system           |
| externalSource         | String      |       No | Source system                       |
| notes                  | Text        |       No | Notes                               |
| active                 | Boolean     |      Yes | Whether ID is currently usable      |

### Important

`employeeNumber`, `idCardNumber`, and `rfidUid` should be treated as unique identifiers where applicable.

For example:

```text
employeeNumber = EMP-000123
idCardNumber   = ID-2026-000123
rfidUid        = 04AABBCCDD
```

Do not assume the RFID UID and employee ID are always the same thing.

---

# 4. Employee ID / Card

I actually recommend separating the physical card from the employee.

Create:

```text
employee-card
```

Fields:

| Field      | Type                |
| ---------- | ------------------- |
| cardNumber | String              |
| rfidUid    | String              |
| employee   | Relation → Employee |
| cardType   | Enumeration         |
| status     | Enumeration         |
| issuedAt   | DateTime            |
| expiresAt  | DateTime            |
| issuedBy   | Relation → User     |
| notes      | Text                |

Status:

```text
Active
Lost
Disabled
Expired
Replaced
```

This allows:

```text
John
 ├── Old RFID card → Disabled
 └── New RFID card → Active
```

instead of overwriting John's history.

---

# 5. Attendance Session

Create:

```text
attendance-session
```

A session represents the operating period during which a guardhouse/kiosk is accepting attendance scans.

Fields:

| Field       | Type            |
| ----------- | --------------- |
| name        | String          |
| sessionDate | Date            |
| startTime   | DateTime        |
| endTime     | DateTime        |
| status      | Enumeration     |
| location    | String          |
| deviceId    | String          |
| openedBy    | Relation → User |
| closedBy    | Relation → User |
| notes       | Text            |

Status:

```text
Open
Closed
```

Example:

```text
October 9, 2026 — Main Gate
Status: Open
Device: GATE-01
```

---

# 6. Attendance Event

This is the most important content type.

```text
attendance-event
```

Fields:

| Field              | Type                          | Description                   |
| ------------------ | ----------------------------- | ----------------------------- |
| eventId            | String                        | Globally unique UUID          |
| employee           | Relation → Employee           | Employee                      |
| card               | Relation → Employee Card      | Card used                     |
| session            | Relation → Attendance Session | Session                       |
| direction          | Enumeration                   | IN / OUT                      |
| eventTime          | DateTime                      | Actual scan time              |
| source             | Enumeration                   | RFID / Manual / Import / Sync |
| deviceId           | String                        | Device that generated event   |
| location           | String                        | Gate/location                 |
| verificationMethod | Enumeration                   | RFID / Manual                 |
| status             | Enumeration                   | Valid / Rejected / Corrected  |
| notes              | Text                          | Notes                         |
| syncStatus         | Enumeration                   | Local / Synced / Conflict     |
| originalEventId    | String                        | Used for synchronization      |
| createdBy          | Relation → User               | User if manually created      |

### `eventId`

This should be generated **on the device**, not only by the server.

Example:

```text
01JZQ2F4T6Q2...
```

or UUID.

This becomes extremely important when offline devices eventually synchronize with the cloud.

---

# 7. Why `eventId` matters for offline mode

Imagine:

```text
Guardhouse PC
      │
      │ Offline
      ▼
SQLite
      │
      ├── event A
      ├── event B
      ├── event C
      └── event D
```

Later:

```text
Internet available
       │
       ▼
Cloud Strapi
       │
       ├── event A
       ├── event B
       ├── event C
       └── event D
```

The cloud should recognize that:

```text
event A already exists
```

and not create it twice.

Therefore:

```text
eventId = unique
```

must be enforced.

---

# 8. Attendance Rules

The basic rule requested is:

> If the employee's latest attendance record is IN, the next scan becomes OUT. If the latest record is OUT, the next becomes IN.

Implement this inside an **Attendance Service**, not the Nuxt frontend.

Example:

```text
Employee has no scan today

RFID scan
↓
IN
```

Next:

```text
Latest = IN

RFID scan
↓
OUT
```

Next:

```text
Latest = OUT

RFID scan
↓
IN
```

Next:

```text
Latest = IN

RFID scan
↓
OUT
```

---

# 9. `processScan()` Service

Create a central service:

```text
attendance.processScan()
```

Input:

```json
{
  "rfidUid": "04AABBCCDD",
  "sessionId": "session-document-id",
  "deviceId": "GATE-01",
  "scannedAt": "2026-10-09T08:03:15+08:00"
}
```

The service should:

### Step 1

Validate the session.

```text
Session exists?
Session is OPEN?
```

If not:

```text
SESSION_NOT_OPEN
```

---

### Step 2

Find the RFID card.

```text
rfidUid → employee-card
```

If not found:

```text
UNKNOWN_CARD
```

---

### Step 3

Check employee.

```text
employee.status == Active
```

If inactive:

```text
EMPLOYEE_INACTIVE
```

---

### Step 4

Find the latest attendance event.

For example:

```text
Employee: EMP-001

Latest event:
08:02 IN
```

---

### Step 5

Determine direction.

```text
no previous event → IN

previous = IN → OUT

previous = OUT → IN
```

---

### Step 6

Create attendance event.

```text
eventId
employee
card
session
direction
eventTime
source = RFID
deviceId
location
```

---

### Step 7

Return a useful response to Nuxt.

Example:

```json
{
  "success": true,
  "event": {
    "eventId": "abc123",
    "direction": "IN",
    "eventTime": "2026-10-09T08:03:15+08:00"
  },
  "employee": {
    "employeeNumber": "EMP-001",
    "displayName": "Juan Dela Cruz",
    "profilePicture": "/uploads/juan.jpg"
  },
  "message": "Welcome, Juan!"
}
```

This allows the guardhouse screen to immediately display:

```text
┌──────────────────────────────┐
│                              │
│       [Employee Photo]       │
│                              │
│       JUAN DELA CRUZ         │
│       EMP-001                │
│                              │
│          ✓ IN                │
│                              │
│       08:03:15 AM            │
│                              │
└──────────────────────────────┘
```

---

# 10. Custom API Routes

I would expose dedicated routes rather than having Nuxt directly manipulate attendance events.

## Session

```http
POST /api/attendance/sessions/open
POST /api/attendance/sessions/:documentId/close
GET  /api/attendance/sessions/current
```

### Open session

```json
{
  "sessionDate": "2026-10-09",
  "location": "Main Gate",
  "deviceId": "GATE-01"
}
```

---

# 11. RFID Scan API

```http
POST /api/attendance/scan
```

Request:

```json
{
  "rfidUid": "04AABBCCDD",
  "deviceId": "GATE-01"
}
```

The backend determines:

```text
employee
↓
previous attendance
↓
IN/OUT
↓
attendance event
```

The frontend should **not** determine IN/OUT.

---

# 12. Manual Attendance

Provide:

```http
POST /api/attendance/manual
```

Example:

```json
{
  "employeeId": "abc123",
  "direction": "IN",
  "eventTime": "2026-10-09T08:10:00+08:00",
  "reason": "RFID card damaged"
}
```

This should produce:

```text
source = Manual
verificationMethod = Manual
createdBy = current user
```

Manual corrections must always be auditable.

---

# 13. Attendance Correction

Do **not** delete attendance events whenever possible.

Instead:

```text
Original:
08:00 IN

Correction:
08:00 IN
corrected → 08:05 IN
reason → RFID clock error
```

Create optionally:

```text
attendance-adjustment
```

Fields:

```text
attendanceEvent
originalValue
newValue
reason
adjustedBy
adjustedAt
```

This is much safer for HR records.

---

# 14. Attendance Reports

Create custom reporting endpoints.

## Daily Attendance

```http
GET /api/reports/attendance/daily?date=2026-10-09
```

Return:

```text
Employee
ID
First IN
Last OUT
Current Status
Total Hours
Number of Scans
```

Example:

| Employee       | First IN | Last OUT | Status |  Hours |
| -------------- | -------: | -------: | ------ | -----: |
| Juan Dela Cruz |    08:02 |    17:04 | OUT    | 8h 02m |
| Maria Santos   |    07:58 |        — | IN     |      — |

---

# 15. Employee Attendance Report

```http
GET /api/reports/attendance/employee/:employeeId
```

Support:

```text
startDate
endDate
```

Example:

```text
October 1 → October 31
```

Return daily:

```text
Date
First IN
Last OUT
Total Hours
Missing OUT
Missing IN
Number of Scans
```

---

# 16. Monthly Attendance Report

```http
GET /api/reports/attendance/monthly
```

Filters:

```text
month
year
department
employee
status
```

Potential output:

```text
Employee
Working Days
Days Present
Days Absent
Late Days
Missing IN
Missing OUT
Total Hours
```

---

# 17. Dashboard API

Create:

```http
GET /api/attendance/dashboard
```

Return:

```json
{
  "date": "2026-10-09",
  "totalEmployees": 150,
  "present": 103,
  "currentlyInside": 82,
  "currentlyOutside": 21,
  "notRecorded": 47,
  "late": 8
}
```

Nuxt can use this for the guardhouse/admin dashboard.

---

# 18. Employee Import

This is important for your existing HR data.

Create:

```http
POST /api/employees/import
```

Support CSV initially.

Example CSV:

```csv
employeeNumber,firstName,middleName,lastName,email,department,position,idCardNumber,rfidUid,profilePictureUrl
EMP001,Juan,,Dela Cruz,juan@example.com,IT,Developer,ID001,04AABBCCDD,https://example.com/photos/EMP001.jpg
EMP002,Maria,,Santos,maria@example.com,HR,HR Officer,ID002,04EEFF1122,https://example.com/photos/EMP002.jpg
```

---

# 19. Employee Import Rules

The importer should support:

```text
CREATE
UPDATE
SKIP
ERROR
```

Matching priority:

### First

```text
externalSource + externalId
```

### Second

```text
employeeNumber
```

### Third

```text
idCardNumber
```

Do not match employees purely by name.

For example:

```text
Juan Dela Cruz
```

is not a safe unique identifier.

---

# 20. Existing Account Integration

Since you mentioned getting data from an existing account, don't tightly couple the new HRIS to one particular existing system.

Add:

```text
externalSource
externalId
```

to Employee.

Example:

```text
externalSource = existing-hris
externalId = 84721
```

Another organization could have:

```text
externalSource = payroll-system
externalId = PAY-10291
```

This lets the new system import employee information while maintaining the original system's identifier.

---

# 21. Import Mapping

The import API should allow column mapping.

For example:

```text
Existing CSV:

employee_no
given_name
surname
dept
job_title
photo
```

Map to:

```text
employee_no → employeeNumber
given_name  → firstName
surname     → lastName
dept        → department
job_title   → position
photo       → profilePictureUrl
```

This is much better than requiring the source system to exactly match your database structure.

---

# 22. Profile Picture Import

Support two approaches.

### Option A — URL

CSV:

```csv
employeeNumber,profilePictureUrl
EMP001,https://company.com/photos/EMP001.jpg
EMP002,https://company.com/photos/EMP002.jpg
```

Backend:

```text
Download image
↓
Upload to Strapi Media Library
↓
Attach media to Employee
```

Strapi's REST upload mechanism can be used for media; if GraphQL is added later, note that GraphQL itself does not provide media upload and Strapi directs uploads through the REST `/upload` endpoint. ([Strapi Docs][2])

### Option B — ZIP

Allow:

```text
employees.csv
photos/
    EMP001.jpg
    EMP002.jpg
    EMP003.jpg
```

CSV:

```csv
employeeNumber,firstName,lastName,photoFile
EMP001,Juan,Dela Cruz,EMP001.jpg
EMP002,Maria,Santos,EMP002.jpg
```

Importer:

```text
CSV
 +
ZIP
 ↓
Match employeeNumber
 ↓
Find photo
 ↓
Upload photo
 ↓
Attach Employee.profilePicture
```

I would support **both**, with ZIP being particularly useful for organizations migrating existing employee databases.

---

# 23. Import Job

For large imports, don't process everything in a single HTTP request.

Create:

```text
import-job
```

Fields:

```text
type
status
filename
totalRecords
processedRecords
createdRecords
updatedRecords
skippedRecords
failedRecords
startedAt
completedAt
errorLog
createdBy
```

Status:

```text
Pending
Processing
Completed
Completed With Errors
Failed
```

The frontend can display:

```text
Employee Import

██████████████████░░ 89%

890 / 1,000 employees

Created: 750
Updated: 125
Skipped: 5
Errors: 10
```

---

# 24. Existing Account → Employee Import

If the existing account is another application with an API, create an integration layer:

```text
Employee Import Service
       │
       ├── CSV Adapter
       ├── JSON Adapter
       ├── REST API Adapter
       └── Existing HRIS Adapter
```

The normalized result should always become:

```text
EmployeeImportRecord
```

before being saved.

This prevents the core Employee system from becoming dependent on a particular existing application.

---

# 25. Nuxt Frontend

Create these screens.

## Login

```text
/login
```

---

## Dashboard

```text
/dashboard
```

Show:

```text
Employees
Present
Currently Inside
Currently Outside
No Attendance
Late
```

---

## Guardhouse

```text
/attendance/kiosk
```

This is the most important screen.

It should have:

```text
Today's Session
Main Gate
OPEN

[ RFID Scanner Ready ]

Please tap your ID card

--------------------------

Last Scan

[PHOTO]

Juan Dela Cruz
EMP001

IN
08:03 AM
```

The RFID scanner can normally behave like a keyboard:

```text
RFID → keyboard input → Nuxt
```

So no complicated RFID SDK is necessarily required.

---

# 26. RFID Scanner Input

Create a reusable component:

```text
<RfidScanner />
```

It should:

1. Capture keyboard input.
2. Detect rapid character input.
3. Detect Enter.
4. Build the RFID UID.
5. Send it to:

```http
POST /api/attendance/scan
```

Example:

```text
04AABBCCDD + ENTER
```

becomes:

```json
{
  "rfidUid": "04AABBCCDD"
}
```

---

# 27. Employee Management

Nuxt:

```text
/employees
/employees/create
/employees/:id
/employees/:id/edit
```

Employee page:

```text
Photo

Juan Dela Cruz
EMP-001

Department: IT
Position: Developer

ID Card
ID-2026-001

RFID
04AABBCCDD

Status
Active
```

---

# 28. Card Management

```text
/cards
```

Allow staff to:

```text
Issue Card
Replace Card
Disable Card
Assign RFID
Unassign RFID
```

Example:

```text
Employee: Juan Dela Cruz

Current Card:
RFID: 04AABBCCDD
Status: Active

[Replace Card]
```

---

# 29. Attendance History

```text
/attendance/history
```

Filters:

```text
Date
Employee
Department
Direction
Device
Location
Source
```

Example:

| Time  | Employee | Direction | Source | Device  |
| ----- | -------- | --------- | ------ | ------- |
| 08:01 | Juan     | IN        | RFID   | GATE-01 |
| 08:05 | Maria    | IN        | RFID   | GATE-01 |
| 12:01 | Juan     | OUT       | RFID   | GATE-01 |

---

# 30. Session Management

Admin/staff/guardhouse should be able to:

```text
Open Session
Close Session
View Current Session
```

Example:

```text
Attendance Session

October 9, 2026
Main Gate

Status: OPEN

Opened by:
Security Staff

Started:
07:00 AM

[ CLOSE SESSION ]
```

---

# 31. Roles

Use Strapi Users & Permissions for application users and restrict the custom routes using policies. Strapi supports extending Users & Permissions and adding custom policies to routes. ([Strapi Docs][3])

Create:

### Administrator

Everything.

```text
Employees
Cards
Attendance
Reports
Imports
Sessions
Settings
```

### HR / Staff

```text
Employees
Cards
Attendance
Reports
Imports
```

### Guardhouse

```text
Open Session
Close Session
RFID Scan
Manual Attendance
Today's Attendance
```

No access to:

```text
Employee deletion
System settings
Bulk imports
```

---

# 32. Offline Architecture

This is where I would make an important distinction.

Do **not** make Nuxt directly responsible for SQLite.

Instead:

```text
                 CLOUD

              PostgreSQL
                  │
                Strapi
                  │
                  │
             Nuxt Cloud
```

And locally:

```text
              LOCAL PC

             SQLite
                │
             Strapi
                │
             Nuxt
                │
          RFID Scanner
```

So the exact same application architecture operates in both environments.

Strapi supports SQLite for local development/deployment, and its current documentation lists Python as a prerequisite when using SQLite. ([Strapi Docs][4])

---

# 33. Cloud vs Local

### Cloud

```text
Nuxt
  ↓
Cloud Strapi
  ↓
PostgreSQL
```

### Local

```text
Nuxt
  ↓
Local Strapi
  ↓
SQLite
```

This gives you a very clean deployment model.

---

# 34. Synchronization

Don't synchronize database tables directly.

Synchronize **domain events**.

Local:

```text
attendance-event
eventId = ABC123
```

Cloud receives:

```text
ABC123
```

If it already exists:

```text
return already_synced
```

If it doesn't:

```text
create event
```

This makes synchronization idempotent.

---

# 35. Future Sync API

Design for:

```http
POST /api/sync/push
```

and:

```http
GET /api/sync/pull
```

Push:

```json
{
  "deviceId": "GATE-01",
  "events": [
    {
      "eventId": "abc123",
      "employeeId": "employee-document-id",
      "direction": "IN",
      "eventTime": "2026-10-09T08:01:00+08:00"
    }
  ]
}
```

The first version does not necessarily need to implement full synchronization, but **the data model should be ready for it from day one**.

---

# 36. Device

I would also create:

```text
attendance-device
```

Fields:

```text
deviceId
name
location
type
status
lastSeenAt
lastSyncAt
isOffline
```

Example:

```text
GATE-01
Main Entrance
Guardhouse
Online
```

Later:

```text
GATE-02
Back Entrance
GATE-03
Warehouse
```

---

# 37. Device Registration

Eventually:

```http
POST /api/devices/register
```

returns:

```text
deviceId
deviceToken
configuration
```

The local installation can identify itself to the cloud.

This will be important when you have multiple branches.

---

# 38. Attendance Business Rules

Implement these centrally in the backend.

### Rule 1

Inactive employee cannot scan.

### Rule 2

Disabled RFID card cannot scan.

### Rule 3

Unknown RFID must not create an attendance event.

### Rule 4

Closed session cannot accept normal scans.

### Rule 5

Every successful scan creates an attendance event.

### Rule 6

Every manual change is recorded.

### Rule 7

Attendance events should not normally be deleted.

### Rule 8

Every event gets a unique `eventId`.

### Rule 9

Server/device timestamp must be retained.

### Rule 10

The backend determines IN/OUT.

---

# 39. Duplicate Scan Protection

This is very important with RFID readers.

Someone may leave their card on the reader for 1 second and produce:

```text
08:00:01
08:00:02
08:00:03
08:00:04
```

You don't want:

```text
IN
OUT
IN
OUT
```

Implement a configurable debounce period.

Example:

```text
duplicateScanWindow = 5 seconds
```

If the same employee/card is scanned within 5 seconds:

```text
Ignore duplicate
```

Response:

```json
{
  "success": false,
  "code": "DUPLICATE_SCAN",
  "message": "Card scanned recently"
}
```

---

# 40. More Important: Don't blindly toggle across days

The simple rule needs one refinement.

Suppose:

```text
October 8
08:00 IN
17:00 OUT
```

Then October 9:

```text
08:00 scan
```

It should become:

```text
IN
```

even though the previous global event was OUT.

Therefore determine the previous state **within the current attendance session/day**, not across the employee's entire history.

---

# 41. Handling Missing OUT

Example:

```text
Monday
08:00 IN

No OUT
```

Tuesday:

```text
08:00 scan
```

The system should **not** simply treat this as OUT.

It should determine the state for Tuesday:

```text
No attendance today
↓
IN
```

The Monday record becomes:

```text
Missing OUT
```

This makes your attendance reports much more useful.

---

# 42. Attendance Summary

I recommend generating the summary dynamically from events initially rather than storing duplicate attendance data.

For:

```text
Employee
+
Date
```

derive:

```text
firstIn
lastOut
currentStatus
totalHours
missingOut
```

Example:

```text
Juan
October 9

First IN: 08:01
Last OUT: 17:03
Total: 8h 02m
Status: OUT
```

This avoids synchronization problems between:

```text
attendance_events
```

and:

```text
attendance_daily_summary
```

You can add cached daily summaries later if performance requires them.

---

# 43. Suggested Strapi Folder Structure

```text
src/
├── api/
│   ├── employee/
│   ├── employee-card/
│   ├── attendance-session/
│   ├── attendance-event/
│   ├── attendance-device/
│   ├── import-job/
│   └── reports/
│
├── services/
│   ├── attendance/
│   │   ├── scan.ts
│   │   ├── session.ts
│   │   ├── report.ts
│   │   └── correction.ts
│   │
│   ├── employee/
│   │   ├── import.ts
│   │   └── photo.ts
│   │
│   └── sync/
│       ├── push.ts
│       └── pull.ts
│
└── policies/
    ├── is-admin.ts
    ├── is-hr.ts
    └── is-guardhouse.ts
```

The exact Strapi organization can use standard API controllers/services and custom services rather than putting all business logic inside controllers. Strapi's customization architecture explicitly supports this separation. ([Strapi Docs][1])

---

# 44. Custom Service API

I would define these backend services before building the Nuxt frontend:

```text
employeeService
```

Methods:

```text
findByEmployeeNumber()
findByCardNumber()
findByRfid()
createEmployee()
updateEmployee()
importEmployees()
```

---

```text
attendanceService
```

Methods:

```text
openSession()
closeSession()
getCurrentSession()
processScan()
recordManualAttendance()
getLatestEvent()
getDailyAttendance()
getEmployeeAttendance()
```

---

```text
reportService
```

Methods:

```text
daily()
monthly()
employee()
department()
currentlyInside()
```

---

```text
syncService
```

Methods:

```text
pushEvents()
pullEvents()
checkEvent()
resolveConflict()
```

---

# 45. API Summary

The developer should eventually implement approximately:

```text
AUTH
POST   /api/auth/local

EMPLOYEES
GET    /api/employees
GET    /api/employees/:id
POST   /api/employees
PUT    /api/employees/:id
DELETE /api/employees/:id

CARDS
GET    /api/employee-cards
POST   /api/employee-cards
PUT    /api/employee-cards/:id
POST   /api/employee-cards/:id/disable

SESSIONS
GET    /api/attendance/sessions/current
POST   /api/attendance/sessions/open
POST   /api/attendance/sessions/:id/close

ATTENDANCE
POST   /api/attendance/scan
POST   /api/attendance/manual
GET    /api/attendance/history

REPORTS
GET    /api/reports/attendance/daily
GET    /api/reports/attendance/monthly
GET    /api/reports/attendance/employee/:id

IMPORT
POST   /api/employees/import
GET    /api/import-jobs/:id

SYNC
POST   /api/sync/push
GET    /api/sync/pull
```

---

# 46. One Change I Strongly Recommend

Don't call the main entity simply `User`.

Use:

```text
Employee
```

for the HR/person record.

Then use Strapi's Users & Permissions `User` for:

```text
Administrator
HR Staff
Guardhouse Staff
```

So:

```text
Strapi User
    │
    └── Application access

Employee
    │
    └── HR/attendance identity
```

These are fundamentally different things.

A guardhouse employee might **not** have a Strapi login at all, while a guardhouse operator does.

---

# 47. MVP Development Phases

I'd give the developer this implementation order.

### Phase 1 — Core

```text
Employee
Employee Card
Attendance Session
Attendance Event
```

### Phase 2 — Attendance Engine

```text
Open session
RFID scan
IN/OUT logic
Duplicate scan prevention
Manual attendance
```

### Phase 3 — Nuxt Guardhouse

```text
Login
Session opening
RFID kiosk
Employee display
Today's attendance
```

### Phase 4 — Employee Management

```text
Employee CRUD
Card management
Profile photos
```

### Phase 5 — Reports

```text
Daily
Monthly
Employee
Department
Currently inside
```

### Phase 6 — Import

```text
CSV
Column mapping
Existing employee matching
Photo URL
ZIP photo import
Import logs
```

### Phase 7 — Offline

```text
Local Strapi
SQLite
Device ID
Event UUID
Sync queue
Push
Pull
Conflict handling
```

---

## One architectural improvement for your cloud/local idea

I would **not build the cloud and offline versions as two different applications**.

Build one codebase:

```text
                 SAME APPLICATION

             ┌─────────────────────┐
             │      Nuxt UI         │
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │      Strapi 5        │
             │                     │
             │ Attendance Service  │
             │ Employee Service    │
             │ Import Service      │
             │ Report Service      │
             │ Sync Service        │
             └───────┬─────┬───────┘
                     │     │
                Cloud│     │Local
                     │     │
                PostgreSQL SQLite
```

The **database changes**, not the business logic.

That gives you a very attractive product later: an organization could run the HRIS entirely locally if Internet reliability is poor, while larger organizations could run the cloud version.

Also, because Strapi 5's Document Service supports selecting fields and populating relations, your services can deliberately return only the employee information needed by the guardhouse rather than exposing the entire employee record. ([Strapi Docs][5])

One further enhancement I would plan for from the beginning is **auditability**: Strapi's built-in Content History should not be treated as your attendance audit log because it only tracks certain Content Manager edits and isn't a permanent record of programmatic changes. Your `attendance-event` and adjustment records should therefore remain the authoritative audit trail. ([Strapi Docs][6])

If you hand the above to a developer, they can start building the Strapi content types and custom services immediately. The next logical artifact would be a **complete Strapi 5 implementation specification with the exact `schema.json` for each content type, route definitions, controller/service method signatures, policies, and example request/response JSON**, which would make this much closer to a coding-ready blueprint.