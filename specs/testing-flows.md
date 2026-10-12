# Testing Flows & Criteria

This document outlines the procedures and criteria for testing the core attendance functionalities in the sc-tapper-hris system using the newly developed Testing API.

## 1. Environment Setup

### 1.1 Seeding the Database
To quickly populate the database with test data, an unauthenticated seeding endpoint is available.

**Endpoint:** `POST /api/testing/seed`
**Payload:** `{}`
**Response:**
Returns a JSON object containing the created test employees, RFID cards, and an open attendance session.

### 1.2 Resetting the Database
To clear the test data and start fresh without affecting real production data, use the reset endpoint.

**Endpoint:** `POST /api/testing/reset`
**Payload:** `{}`
**Response:**
Returns a success message indicating all test entries (prefixed with `TEST-` or `C-TEST-`) have been deleted.

---

## 2. Test Data Reference

After running the seed endpoint, the following entities are available:

### Employees
1. **TEST-001 (John Doe)** - Status: `Active`
2. **TEST-002 (Jane Smith)** - Status: `Active`
3. **TEST-003 (Bob Inactive)** - Status: `Inactive`

### RFID Cards
1. **111111** - Assigned to TEST-001, Status: `Active`
2. **222222** - Assigned to TEST-002, Status: `Active`
3. **333333** - Assigned to TEST-003, Status: `Active`
4. **444444** - Unassigned, Status: `Active`

### Attendance Session
- **TEST-SESSION-TODAY** - Status: `Open`, Device ID: `TEST-DEVICE-01`

---

## 3. Testing Criteria & Scenarios

### Scenario A: Happy Path (Standard Clock-In/Clock-Out)
**Pre-requisite:** Database is seeded.

1. **Step 1:** Simulate a scan for `111111` on `TEST-DEVICE-01`.
   - **Endpoint:** `POST /api/attendance/scan`
   - **Payload:** `{ "rfidUid": "111111", "deviceId": "TEST-DEVICE-01" }`
   - **Expected Result:**
     - `success: true`
     - `direction: "IN"`
     - A welcome message returning John Doe's information.
     - HTTP Status 200.

2. **Step 2:** Wait for more than 5 seconds.
3. **Step 3:** Simulate another scan for `111111` on `TEST-DEVICE-01`.
   - **Expected Result:**
     - `success: true`
     - `direction: "OUT"`
     - A goodbye message returning John Doe's information.
     - HTTP Status 200.

### Scenario B: Debounce & Duplicate Scan Prevention
**Pre-requisite:** Database is seeded. Employee TEST-002 hasn't scanned yet.

1. **Step 1:** Simulate a scan for `222222` on `TEST-DEVICE-01`.
   - **Expected Result:** Success (`IN`).
2. **Step 2:** Immediately (within 5 seconds) simulate another scan for `222222`.
   - **Expected Result:**
     - `success: false`
     - `code: "DUPLICATE_SCAN"`
     - HTTP Status 400.

### Scenario C: Unassigned Card
1. **Step 1:** Simulate a scan for `444444` on `TEST-DEVICE-01`.
   - **Expected Result:**
     - `success: false`
     - `code: "UNKNOWN_EMPLOYEE"`
     - HTTP Status 400.

### Scenario D: Inactive Employee
1. **Step 1:** Simulate a scan for `333333` on `TEST-DEVICE-01`.
   - **Expected Result:**
     - `success: false`
     - `code: "EMPLOYEE_INACTIVE"`
     - HTTP Status 400.

### Scenario E: Unrecognized Card
1. **Step 1:** Simulate a scan for `999999` (Non-existent card) on `TEST-DEVICE-01`.
   - **Expected Result:**
     - `success: false`
     - `code: "UNKNOWN_CARD"`
     - HTTP Status 400.

### Scenario F: Closed / No Session
1. **Step 1:** Attempt to scan using a non-existent device ID `UNKNOWN-DEVICE` or close the active session first via `POST /api/attendance/sessions/:id/close`.
2. **Step 2:** Simulate a scan for `111111` on `UNKNOWN-DEVICE`.
   - **Expected Result:**
     - `success: false`
     - `code: "SESSION_NOT_OPEN"`
     - HTTP Status 400.