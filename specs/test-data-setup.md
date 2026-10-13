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

### Employees
| Employee Number | Full Name | Status | Purpose / Test Role |
| :--- | :--- | :--- | :--- |
| **`TEST-001`** | John Doe | `Active` | Standard valid employee for clock-in/clock-out testing |
| **`TEST-002`** | Jane Smith | `Active` | Secondary valid employee for debounce / concurrent scan testing |
| **`TEST-003`** | Bob Inactive | `Inactive` | Edge-case verification for inactive employee scanning |

### RFID Cards
| Card Number | RFID UID | Assigned Employee | Card Status | Purpose / Test Role |
| :--- | :--- | :--- | :--- | :--- |
| **`C-TEST-001`** | `111111` | `TEST-001` (John Doe) | `Active` | Normal scan sequence (`IN` / `OUT`) |
| **`C-TEST-002`** | `222222` | `TEST-002` (Jane Smith) | `Active` | Debounce / duplicate scan rate limit testing |
| **`C-TEST-003`** | `333333` | `TEST-003` (Bob Inactive) | `Active` | Valid card assigned to inactive employee |
| **`C-TEST-004`** | `444444` | *None (Unassigned)* | `Active` | Unassigned / lost card scan verification |

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

---

## 5. Quick Verification Checklist

After running the seed endpoint, you can immediately test the setup using the attendance scan endpoint:

```bash
# Test valid scan (Clock-in for John Doe on TEST-DEVICE-01)
curl -X POST http://localhost:1337/api/attendance/scan \
  -H "Content-Type: application/json" \
  -d '{"rfidUid": "111111", "deviceId": "TEST-DEVICE-01"}'
```

Refer to `specs/testing-flows.md` for full scenario walk-throughs including debounce thresholds and error handling criteria.
