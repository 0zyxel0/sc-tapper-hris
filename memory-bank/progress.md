# Progress

## What Works
- Project scaffolding completed.
- Dockerfile (multi-stage: development & production) and docker-compose.yml with PostgreSQL 16 container added and verified.
- Basic Strapi v5 configuration with PostgreSQL setup.
- Core HRIS Phase 1 Content Types implemented (`employee`, `employee-card`, `attendance-session`, `attendance-event`).
- Phase 2 Attendance Engine logic implemented (IN/OUT logic, duplicate scan prevention).
- Phase 3 `frontend-implementation.md` developer specs written.
- Phase 4 Employee & Card Management custom logic implemented and exposed.
- Phase 5 Reports Engine logic (Daily, Monthly, Employee) implemented and exposed.
- Phase 6 Import Engine logic (Background processing, photo parsing, JSON payload) implemented and exposed.
- Phase 7 Offline Sync (Push/Pull mechanisms for remote local-SQLite kiosks) implemented and exposed.
- Test data seeding API and setup documentation (`specs/test-data-setup.md`) established and updated with Allowed RFID inventory & test scenarios.
- Deployment seeding endpoint (`POST /api/setup/seed`), status endpoint (`GET /api/setup/status`), automated `AUTO_SEED=true` bootstrap, programmatic role creation (`Super Admin`, `Guard`, `Registrar`, `IT`), standardized 4 deployment users (`admin`, `guard`, `registrar`, `it`), and deployment documentation (`specs/deployment.md`) implemented and verified.
- Kiosk setup guide (`specs/kiosk-setup.md`) documented.
- JWT configuration resolved with 30-day token lifetime (`legacy-support`) to support gate kiosks.
- RFID Card Allowlist (Whitelist) Backend & Frontend Specifications completed:
  - `allowed-rfid` content type created with bulk upload endpoint (`POST /api/rfid-allowlist/bulk-upload`).
  - Strict card mapping validation and status synchronization implemented in `employee-card.issueCard` and `disableCard`.
  - Testing seeder updated with allowed card provisioning.
  - Frontend implementation specification authored in `specs/frontend-rfid-allowlist.md`.
- Kiosk Logo & Background Customization (`api::kiosk-setting.kiosk-setting`) completed:
  - Global Single Type created with automatic media population, default fallback, Base64/media upload support, and `Super Admin` / `IT` RBAC protection.
  - Integrated with `/api/setup/seed`, `/api/setup/status`, and `/api/sync/pull`.
  - Backend and Nuxt frontend specifications authored in `specs/feature-kiosk-customization.md` and `specs/frontend-kiosk-customization.md`.
- Assigned ID Suspension, Disablement, `current_status` Flagging & Overdue Payment SMS Reminders completed:
  - Added `Suspended` card status and `current_status` (`Cleared`, `Payment_Overdue`, `Payment_Pending`, `Flagged`, `Under_Review`) on `employee-card`, synced with `allowed-rfid`.
  - Created `notification-log` content type and SMS reminder service with 24-hour cooldown and live/simulated SMS provider support.
  - Updated `POST /api/attendance/scan` to allow gate entry with a `warning` payload and SMS reminder when `current_status` is flagged (`Payment_Overdue`), while blocking `Suspended` (`CARD_SUSPENDED`) and `Disabled` (`CARD_DISABLED`) cards.
  - Authored `specs/feature-id-status-and-payment-reminders.md` and `specs/frontend-id-status-and-payment-reminders.md`.

## What's Left to Build
- Set up authentication and authorization policies (so Nuxt can hit the endpoints).
- Phase 3: Nuxt Guardhouse UI.
- Customize the admin panel for better UX if necessary.

## Current Status
- Completed Phase 1 (Core Models).
- Completed Phase 2 (Attendance Engine).
- Completed Phase 3 (Nuxt Guardhouse Spec with RFID scanner, Gate History, Card Enrollment, ID Reporting, and Offline Sync).
- Completed Phase 4 (Employee Management).
- Completed Phase 5 (Reports).
- Completed Phase 6 (Import).
- Completed Phase 7 (Offline Sync).

## Known Issues
- None at this time.
