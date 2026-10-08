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

## 4. Hardware Integration (RFID Keystrokes)
Standard USB RFID readers act as a keyboard. They "type" the RFID UID and automatically press the `Enter` key.

**Frontend Implementation:**
Do *not* require the user to click into a text input. Use a global keystroke listener in Nuxt.
1. Listen to `window.addEventListener('keydown')`.
2. Accumulate typed characters into a buffer string.
3. If the user presses `Enter`, send the buffer string as the `rfidUid` to the `/api/attendance/scan` endpoint.
4. Clear the buffer.
5. Implement a small timeout (e.g., 50ms per key) to clear the buffer if a human accidentally types on the keyboard, ensuring only fast machine-inputs are processed.

---

## 5. UI State Machine Workflow
1. **Unauthenticated** -> Redirect to `/login`
2. **Authenticated, Checking Session** -> Calls `/api/attendance/sessions/current`
3. **No Session** -> Display "Open Session" Form
4. **Session Active (Kiosk Mode)** -> Display idle screen ("Ready to Scan"). Global keystroke listener is active.
5. **Scan Processing** -> Call `/api/attendance/scan`.
6. **Scan Success** -> Show Employee Card overlay for 3 seconds, then revert to Idle Screen.

---

## 6. Testing & Mock Commands

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