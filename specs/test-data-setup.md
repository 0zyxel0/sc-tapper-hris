# Test Data Setup Guide

This guide explains how to initialize, seed, and manage test data for the `sc-tapper-hris` backend to enable seamless manual and automated testing of kiosk devices, attendance engines, and administrative interfaces.

---

## 1. Prerequisites

Before attempting to seed test data, ensure that the Strapi backend is running:

1. **Start the database and server** (if not already running):
   ```bash
   # Option A: Local Strapi development server
   npm run develop

   # Option B: Docker Compose environment
   docker compose up
   ```
2. Confirm the Strapi server is responding at `http://localhost:1337` (or your configured `HOST`/`PORT`).

---

## 2. Seeding Test Data

A dedicated testing endpoint is exposed at `/api/testing/seed`. This endpoint is configured with public access (`auth: false`), meaning **no JWT authorization header is required**.

### What happens when you seed?
1. **Automated Cleanup**: The endpoint first removes any existing test entities (prefixed with `TEST-` or `C-TEST-`) to ensure a fresh, conflict-free state.
2. **Entity Generation**: Generates standard active/inactive employees, associated RFID cards, and an open attendance session.

### Execution Commands

#### A. PowerShell (Windows)
```powershell
Invoke-RestMethod -Uri "http://localhost:1337/api/testing/seed" -Method POST
```

#### B. cURL (macOS / Linux / Git Bash)
```bash
curl -X POST http://localhost:1337/api/testing/seed
```

#### C. HTTP Request (Postman / Thunder Client / Insomnia)
* **Method:** `POST`
* **URL:** `http://localhost:1337/api/testing/seed`
* **Headers:** `Content-Type: application/json`
* **Body:** `{}` (empty JSON object or no body required)

### Expected Response
A successful request returns `200 OK` with JSON containing the seeded entities:
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "documentId": "...",
        "employeeNumber": "TEST-001",
        "firstName": "John",
        "lastName": "Doe",
        "employmentStatus": "Active"
      },
      ...
    ],
    "cards": [ ... ],
    "allowedCards": [
      {
        "rfidUid": "111111",
        "status": "Assigned",
        "batchReference": "TEST-BATCH-001"
      },
      ...
    ],
    "session": {
      "documentId": "...",
      "name": "TEST-SESSION-TODAY",
      "sessionDate": "YYYY-MM-DD",
      "status": "Open",
      "deviceId": "TEST-DEVICE-01"
    }
  }
}
```

---

## 3. Seeded Test Data Reference

The following records are injected into the database:

### Employees & Students (`api::employee.employee`)
| ID Number (`employeeNumber`) | `personType` | Full Name | Status | Course / Section | Purpose / Test Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`TEST-001`** | `Employee` | John Doe | `Active` | — | Standard valid employee for clock-in/clock-out testing |
| **`TEST-002`** | `Employee` | Jane Smith | `Active` | — | Secondary valid employee for debounce / concurrent scan testing |
| **`TEST-003`** | `Employee` | Bob Inactive | `Inactive` | — | Edge-case verification for inactive employee scanning |
| **`TEST-004`** | `Student` | Mark Overdue | `Active` | `BS Computer Science` / `BSCS-3A` | Active student with `current_status: Payment_Overdue` (`+639171234567`) |
| **`TEST-005`** | `Student` | Sarah Suspended | `Active` | `BS Information Technology` / `BSIT-2B` | Active student whose ID card is `Suspended` (`+639187654321`) |

### RFID Cards
| Card Number | RFID UID | Assigned Employee | Card Status | `current_status` | Purpose / Test Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`C-TEST-001`** | `111111` | `TEST-001` (John Doe) | `Active` | `Cleared` | Normal scan sequence (`IN` / `OUT`) |
| **`C-TEST-002`** | `222222` | `TEST-002` (Jane Smith) | `Active` | `Cleared` | Debounce / duplicate scan rate limit testing |
| **`C-TEST-003`** | `333333` | `TEST-003` (Bob Inactive) | `Active` | `Cleared` | Valid card assigned to inactive employee |
| **`C-TEST-004`** | `444444` | *None (Unassigned)* | `Active` | `Cleared` | Unassigned / lost card scan verification |
| **`C-TEST-005`** | `666666` | `TEST-004` (Mark Overdue) | `Active` | `Payment_Overdue` | Allows gate scan + returns overdue `warning` + triggers SMS reminder |
| **`C-TEST-006`** | `777777` | `TEST-005` (Sarah Suspended) | `Suspended` | `Payment_Overdue` | Rejects gate scan with `CARD_SUSPENDED` + triggers overdue reminder |

### Allowed RFID Inventory (Allowlist)
| RFID UID | Status | Batch Reference | Assigned Employee / Card | Purpose / Test Role |
| :--- | :--- | :--- | :--- | :--- |
| **`111111`** | `Assigned` | `TEST-BATCH-001` | `TEST-001` / `C-TEST-001` | Pre-approved card already paired to John Doe |
| **`222222`** | `Assigned` | `TEST-BATCH-001` | `TEST-002` / `C-TEST-002` | Pre-approved card already paired to Jane Smith |
| **`333333`** | `Assigned` | `TEST-BATCH-001` | `TEST-003` / `C-TEST-003` | Pre-approved card mapped to inactive employee |
| **`444444`** | `Assigned` | `TEST-BATCH-001` | `None` / `C-TEST-004` | Pre-approved card marked assigned in allowlist inventory |
| **`555555`** | `Unassigned` | `TEST-BATCH-001` | *None* | **Tap-to-Assign Enrollment Testing**: Pre-approved allowlist card ready to be enrolled and mapped to an employee |
| **`666666`** | `Assigned` | `TEST-BATCH-001` | `TEST-004` / `C-TEST-005` | Assigned to student with `Payment_Overdue` flag |
| **`777777`** | `Suspended` | `TEST-BATCH-001` | `TEST-005` / `C-TEST-006` | Assigned to student with `Suspended` ID card |

### Attendance Session
| Session Name | Status | Device ID | Date |
| :--- | :--- | :--- | :--- |
| **`TEST-SESSION-TODAY`** | `Open` | `TEST-DEVICE-01` | Current date (`YYYY-MM-DD`) |

---

## 4. Resetting & Cleaning Up Test Data

To cleanly tear down test fixtures without wiping non-test database records (production or custom manually added data), call the reset endpoint.

### Reset Endpoint Details
* **Method:** `POST`
* **URL:** `http://localhost:1337/api/testing/reset`
* **Authentication:** None required (`auth: false`)

### Execution Commands

#### PowerShell (Windows)
```powershell
Invoke-RestMethod -Uri "http://localhost:1337/api/testing/reset" -Method POST
```

#### cURL
```bash
curl -X POST http://localhost:1337/api/testing/reset
```

### Reset Behavior
The reset service systematically identifies and deletes:
1. Any `attendance-event` associated with employees whose `employeeNumber` starts with `TEST-` or sessions named `TEST-SESSION*`.
2. Any `attendance-session` with names starting with `TEST-SESSION`.
3. Any `employee-card` with card numbers starting with `C-TEST-`.
4. Any `employee` with employee numbers starting with `TEST-`.
5. Any `allowed-rfid` record with `batchReference` starting with `TEST-` or matching test UIDs (`111111`, `222222`, `333333`, `444444`, `555555`).

---

## 5. Quick Verification Checklist

After running the seed endpoint, you can test attendance and card enrollment workflows against the seeded fixtures:

### A. Attendance Kiosk Scans
```bash
# 1. Test valid scan (Clock-in for John Doe on TEST-DEVICE-01)
curl -X POST http://localhost:1337/api/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"rfidUid": "111111", "deviceId": "TEST-DEVICE-01"}'

# 2. Test inactive employee scan (Bob Inactive) -> Expected: 403 Forbidden / INACTIVE_EMPLOYEE
curl -X POST http://localhost:1337/api/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"rfidUid": "333333", "deviceId": "TEST-DEVICE-01"}'

# 3. Test unassigned card scan -> Expected: 404 Not Found / UNREGISTERED_CARD
curl -X POST http://localhost:1337/api/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"rfidUid": "444444", "deviceId": "TEST-DEVICE-01"}'
```

### B. RFID Allowlist & Card Enrollment Verification
```bash
# 1. Fetch allowed cards inventory
curl -X GET "http://localhost:1337/api/allowed-rfids" \
  -H "Authorization: Bearer <JWT_TOKEN>"

# 2. Tap-to-Assign Enrollment with Pre-Approved Card (UID: 555555)
# Replace <EMPLOYEE_DOCUMENT_ID> with John Doe's documentId or another unassigned employee
curl -X POST http://localhost:1337/api/employee-cards/issue \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "<EMPLOYEE_DOCUMENT_ID>",
    "rfidUid": "555555",
    "cardNumber": "C-TEST-005"
  }'
# Expected: 200 OK, card created and UID 555555 status transitions to "Assigned"

# 3. Reject Unlisted / Rogue Card Enrollment (e.g. UID: 999999)
curl -X POST http://localhost:1337/api/employee-cards/issue \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "<EMPLOYEE_DOCUMENT_ID>",
    "rfidUid": "999999",
    "cardNumber": "C-TEST-006"
  }'
# Expected: 400 Bad Request with message: "UNAUTHORIZED_CARD: This RFID card is not in the system allowlist."

# 4. Reject Already Occupied Card Enrollment (e.g. UID: 111111)
curl -X POST http://localhost:1337/api/employee-cards/issue \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "<EMPLOYEE_DOCUMENT_ID>",
    "rfidUid": "111111",
    "cardNumber": "C-TEST-007"
  }'
# Expected: 400 Bad Request with message: "CARD_UNAVAILABLE: This RFID card is already assigned to another employee or disabled."
```

Refer to `specs/testing-flows.md` and `specs/frontend-rfid-allowlist.md` for full scenario walk-throughs including debounce thresholds, bulk upload specifications, and error handling criteria.
