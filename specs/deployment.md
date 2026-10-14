# Strapi HRIS Deployment & Seeding Specification

This document provides a comprehensive overview of the deployment infrastructure, automated bootstrap mechanisms, seeding endpoints, runtime behavior, and production readiness checklists for the `sc-tapper-hris` Strapi backend.

---

## 1. Overview & Architecture

`sc-tapper-hris` is designed as a centralized headless backend serving both the administrative HR portal and edge RFID kiosk devices located at physical security gates.

When deploying this backend to a new machine (cloud server, on-premises server, or container cluster), the application must immediately:
1. **Grant correct API permissions** so client applications (such as the Nuxt Guardhouse UI) can communicate without requiring manual toggling in the Strapi admin dashboard.
2. **Provision baseline operator accounts** (`admin`, `kiosk`, `guard`, and gate device accounts).
3. **Initialize standard gate attendance sessions** (`GATE-01`, `GATE-02`, `GATE-03`) so kiosk terminals can immediately commence scanning operations upon boot.

---

## 2. What Is Done

The following components and endpoints have been implemented and verified:

### A. Automated Role & Permission Bootstrapping (`src/index.ts`)
Strapi's lifecycle bootstrap hook (`src/index.ts`) automatically executes on every application startup. It dynamically ensures that dedicated API roles (**`Super Admin`**, **`Guard`**, **`Registrar`**, and **`IT`**) are created alongside the default **`Authenticated`** role, and grants full API permissions to all roles for all required operations:

* **Attendance Sessions:**
  * `api::attendance.attendance.openSession`
  * `api::attendance.attendance.closeSession`
  * `api::attendance.attendance.currentSession`
  * `api::attendance.attendance.scan`
  * `api::attendance-session.attendance-session.*` (find, findOne, create, update, delete)
* **Attendance Events:**
  * `api::attendance-event.attendance-event.*` (find, findOne, create, update, delete)
* **Employees & Identity:**
  * `api::employee.employee.*` (find, findOne, create, update, delete)
  * `api::employee.import.importEmployees`
* **Employee RFID Cards:**
  * `api::employee-card.employee-card.*` (find, findOne, create, update, delete)
  * `api::employee-card.employee-card.disable`
  * `api::employee-card.employee-card.issue`
* **RFID Allowlist Inventory:**
  * `api::allowed-rfid.allowed-rfid.*` (find, findOne, create, update, delete)
  * `api::allowed-rfid.allowed-rfid.bulkUpload`
* **Import Processing:**
  * `api::import-job.import-job.*` (find, findOne, create, update, delete)
* **Analytics & Reports:**
  * `api::reports.reports.daily`
  * `api::reports.reports.monthly`
  * `api::reports.reports.employee`
* **Edge Kiosk Synchronization:**
  * `api::sync.sync.pull`
  * `api::sync.sync.push`
* **Kiosk Branding & Customization:**
  * `api::kiosk-setting.kiosk-setting.find` (Granted to `Public` and all authenticated roles)
  * `api::kiosk-setting.kiosk-setting.update` (Granted to `Super Admin` and `IT` roles)
  * `plugin::upload.content-api.upload` / `destroy` (Granted to `Super Admin` and `IT` roles)

> **Result:** No manual permission assignment in the Strapi Admin UI is necessary when spinning up a new instance.


### B. Setup Seeding Endpoints (`src/api/setup`)
A dedicated setup API is implemented with two endpoints:

#### 1. `POST /api/setup/seed`
* **Access:** Public (`auth: false`), allowing deployment scripts or administrators to trigger initial setup without prior authentication.
* **Idempotency:** Safe to run multiple times. If users or gate sessions already exist, it detects them and preserves them without throwing errors or duplicating data. If `admin` exists under a different role, it is upgraded to `Super Admin`.
* **Password Encryption:** Utilizes Strapi's user-permissions document service to automatically hash passwords with bcrypt.
* **Custom Password Option:** Supports custom passwords passed via `{ "password": "MySecretPassword123!" }` in the POST body or via the `SEED_DEFAULT_PASSWORD` environment variable (defaults to `Password123!`).

#### Seeded Accounts Provisioned:
| Username | Role | Default Email | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **`admin`** | `Super Admin` | `admin@sc-tapper.local` | HR & Security Administrator API account |
| **`guard`** | `Guard` | `guard@sc-tapper.local` | Security guard & kiosk scanning operator account |
| **`registrar`** | `Registrar` | `registrar@sc-tapper.local` | Employee registration & card enrollment operator account |
| **`it`** | `IT` | `it@sc-tapper.local` | IT personnel and technical administration account |

#### Seeded Physical Gates Provisioned:
| Device ID | Gate Name | Location | Initial Status |
| :--- | :--- | :--- | :--- |
| **`GATE-01`** | Gate 1 - Main Entrance | Main Entrance / Guardhouse | `Open` (Today's date) |
| **`GATE-02`** | Gate 2 - Back Entrance | Back Entrance | `Open` (Today's date) |
| **`GATE-03`** | Gate 3 - Warehouse | Warehouse Gate | `Open` (Today's date) |

#### 2. `GET /api/setup/status`
* **Access:** Public (`auth: false`).
* **Purpose:** Inspects whether the application has been initialized, returning current counts of seeded users and active gate sessions without mutating state.

### C. Zero-Touch Automatic Seeding (`AUTO_SEED=true`)
When `AUTO_SEED=true` is set in the environment or Docker compose file, Strapi automatically runs the seeding routine directly during the `bootstrap` phase on boot, requiring zero HTTP calls.


---

## 3. What Is Happening (Runtime Architecture)

```
+-----------------------------------------------------------------------------------+
|                              DEPLOYMENT LIFECYCLE                                 |
+-----------------------------------------------------------------------------------+
  1. Boot:
     - PostgreSQL database starts.
     - Strapi connects and compiles schemas.
  2. Bootstrap (src/index.ts):
     - Automatically scans & applies API permissions to 'Authenticated' role.
     - Checks process.env.AUTO_SEED === 'true' -> if true, triggers setup service.
  3. Edge Kiosk / Client Initialization:
     - Deployment script calls: POST /api/setup/seed (or already seeded via AUTO_SEED).
     - Kiosk authenticates: POST /api/auth/local -> returns 30-day JWT.
     - Kiosk queries active session: GET /api/attendance/sessions/current?deviceId=GATE-01
     - System responds with the seeded Open session -> Ready for live RFID tapping!
+-----------------------------------------------------------------------------------+
```

### Key Runtime Mechanics:
1. **Password Hashing:** Passwords passed during seeding are intercepted by Strapi's native `users-permissions` service and hashed using salted bcrypt before database persistence.
2. **Session Collision Prevention:** The seeder verifies whether an open session for each `deviceId` already exists. If an active session is detected, it is preserved without modification.
3. **Token Longevity:** JWT tokens issued to authenticated devices have a 30-day expiration (`legacy-support` configuration), ensuring gate kiosks do not get prematurely locked out during daily operation.

---

## 4. How to Seed a New Machine

### Option A: Via HTTP Request (Post-deployment or Local)

#### PowerShell (Windows):
```powershell
Invoke-RestMethod -Uri "http://localhost:1337/api/setup/seed" -Method POST
```

#### cURL (Linux / macOS / Bash):
```bash
curl -X POST http://localhost:1337/api/setup/seed \
  -H "Content-Type: application/json" \
  -d '{"password": "OptionalCustomPassword123!"}'
```

#### Verification:
```bash
curl http://localhost:1337/api/setup/status
```

---

### Option B: Automatic Container Seeding (Docker Compose)
Add `AUTO_SEED=true` to your environment variables in `.env` or `docker-compose.yml`:

```yaml
services:
  strapi:
    environment:
      - AUTO_SEED=true
      - SEED_DEFAULT_PASSWORD=YourSecurePasswordHere!
```
Upon container startup, Strapi will automatically log:
```
[info] API permissions automatically granted to the Authenticated role on start.
[info] AUTO_SEED=true detected. Seeding deployment data...
[info] Deployment data seeded: {"message":"Deployment seeding completed successfully."...}
```

---

## 5. Things To Do (Production Deployment Checklist)

Before releasing the application to production, complete the following items:

### 1. Initial Admin Panel Registration
* **Important Note:** Users created by `/api/setup/seed` are **API users** (`plugin::users-permissions.user`), used by the Nuxt frontend and Kiosk terminals.
* To access the Strapi Admin Dashboard (`http://your-server:1337/admin`), visit the URL in your browser upon initial deployment to create the primary Super Admin account.

### 2. Password Hardening & Rotation
* The default seed password is `Password123!`.
* In production:
  * Provide `SEED_DEFAULT_PASSWORD` via a secure environment variable before running the seeder, OR
  * Immediately change the passwords of `admin`, `guard`, `kiosk`, and `gate-0*` accounts either via the Strapi Admin Panel under **Users & Permissions -> Users** or via the `/api/auth/change-password` endpoint.

### 3. Securing or Disabling the Setup Endpoint
Once the deployment setup is complete on a public or corporate network:
* If desired, disable the setup route or restrict it behind an internal network proxy / IP whitelist.
* Alternatively, add a header token validation check (e.g., `X-Setup-Token`) in `src/api/setup/controllers/setup.ts` matching an environment variable `SETUP_SECRET_TOKEN`.

### 4. Hardware Gate Device Configuration
For each kiosk terminal:
* Set the terminal's device ID in its local configuration:
  * Guardhouse terminal: `DEVICE_ID=GATE-01`
  * Back gate terminal: `DEVICE_ID=GATE-02`
  * Warehouse terminal: `DEVICE_ID=GATE-03`
* Ensure the local kiosk uses the corresponding login credentials (`gate-01`, `gate-02`, etc.) to obtain its session token.

### 5. Automated Database Backups
* In production, configure automated daily PostgreSQL snapshots:
```bash
pg_dump -U postgres -h localhost -d hrisdb -F c -b -v -f /backups/hris_$(date +\%Y\%m\%d).dump
```

---

## 6. Verification & Test Commands

### 1. Test Admin Login & Token Generation:
```bash
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin", "password": "Password123!"}'
```

### 2. Verify Gate 1 Session Query:
```bash
curl -X GET "http://localhost:1337/api/attendance/sessions/current?deviceId=GATE-01" \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_1>"
```

### 3. Verify Attendance Scan Operation:
```bash
curl -X POST http://localhost:1337/api/attendance/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_1>" \
  -d '{"rfidUid": "111111", "deviceId": "GATE-01"}'
```

