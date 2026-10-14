# Active Context

## Current Work Focus
- Nuxt Guardhouse UI specification structured into 4 execution phases:
  - Phase 1: Foundation & Core Kiosk Loop (The MVP - `/login`, `/kiosk`, RFID hardware keystroke capture, session management).
  - Phase 2: Gate Administration & Identity Management (`/admin/history`, `/admin/profiles`, Tap-to-Assign card enrollment).
  - Phase 3: Insights, Reporting, and Exports (`/admin/reports`, roll-call headcount, daily attendance metrics, CSV/print manifests).
  - Phase 4: Offline Resilience & Cloud Synchronization (`/admin/sync`, network status badges, auto push/pull sync coordinator).
- Ready to proceed with frontend implementation.

## Recent Changes
- Implemented Assigned ID Suspension, Disablement, `current_status` Flagging & Overdue Payment SMS Reminders:
  - Extended `api::employee-card.employee-card` schema with `Suspended` in `status` enum, `current_status` (`Cleared`, `Payment_Overdue`, `Payment_Pending`, `Flagged`, `Under_Review`), `statusReason`, `paymentDueDate`, `flaggedAt`, `suspendedAt`, and `lastReminderSentAt`.
  - Extended `api::allowed-rfid.allowed-rfid` schema to include `Suspended` status and automatic status sync when cards are suspended, disabled, or reactivated.
  - Created `api::notification-log.notification-log` content type, controller, routes, and service supporting SMS gateway dispatch (with simulated fallback mode), recipient resolution (`mobileNumber` / `emergencyContactNumber`), and cooldown protection (`SMS_REMINDER_COOLDOWN_HOURS`, default 24h).
  - Added ID management endpoints: `POST /api/employee-cards/:documentId/suspend`, `POST /api/employee-cards/:documentId/activate`, `POST /api/employee-cards/:documentId/disable`, `PATCH /api/employee-cards/:documentId/current-status`, `POST /api/employee-cards/:documentId/send-reminder`, `POST /api/employee-cards/bulk-flag`, and `POST /api/notifications/send-overdue-reminders`.
  - Updated `attendance.processScan` (`POST /api/attendance/scan`) so `Active` cards with `current_status: 'Payment_Overdue'` allow gate entry, return a structured `warning` payload, and trigger cooldown-protected SMS reminders; `Suspended` cards return `CARD_SUSPENDED`; `Disabled` cards return `CARD_DISABLED`.
  - Updated `/api/sync/pull`, `src/index.ts` bootstrap permissions, `.env.example`, and `/api/testing/seed` (`TEST-004` Overdue and `TEST-005` Suspended fixtures).
  - Authored `specs/feature-id-status-and-payment-reminders.md` and `specs/frontend-id-status-and-payment-reminders.md`.
- Implemented Kiosk Logo & Background Customization (`api::kiosk-setting.kiosk-setting`):
  - Created Single Type `kiosk-setting` (`schema.json`, controller, service, routes) supporting `companyName`, `welcomeTitle`, `welcomeSubtitle`, `logo`, `backgroundImage`, `useLogoAsBackground`, `backgroundFit` (`watermark`, `contain`, `cover`), `backgroundOpacity` (`0-100`), and `primaryColor`.
  - Added role-guarded `PUT /api/kiosk-setting` restricting modifications to `Super Admin` (`super_admin`) and `IT` (`it`) roles, with built-in support for both Strapi Media IDs and direct Base64 image uploads (`logoBase64`, `backgroundImageBase64`).
  - Configured `src/index.ts` bootstrap permissions so `Public` and all authenticated roles can read `kiosk-setting`, while `Super Admin` and `IT` roles receive update and upload permissions.
  - Integrated default `kiosk-setting` initialization into `/api/setup/seed` and `/api/setup/status`, and included `kioskSetting` in `/api/sync/pull` for offline kiosk caching.
  - Authored `specs/feature-kiosk-customization.md` and `specs/frontend-kiosk-customization.md`.
- Standard Deployment Roles & 4 Core Users Configuration:
  - Programmatic Role Creation in `src/index.ts`: Automatically provisions and verifies `Super Admin` (`super_admin`), `Guard` (`guard`), `Registrar` (`registrar`), and `IT` (`it`) API roles, granting all HRIS and attendance API permissions across all roles on server startup.
  - Standardized 4 Core Deployment Accounts in `src/api/setup/services/setup.ts`:
    1. `admin` (`admin@sc-tapper.local`) -> Role: `Super Admin`
    2. `guard` (`guard@sc-tapper.local`) -> Role: `Guard` (used for gate terminal and kiosk operation)
    3. `registrar` (`registrar@sc-tapper.local`) -> Role: `Registrar` (used for employee & card registration)
    4. `it` (`it@sc-tapper.local`) -> Role: `IT` (used for IT support & technical administration)
  - `getStatus()` updated to check role presence (`authenticatedRoleFound`, `superAdminRoleFound`, `guardRoleFound`, `registrarRoleFound`, `itRoleFound`) and status of the 4 core accounts.
  - `seed()` upgraded to ensure all 4 custom roles exist and seeds or upgrades the 4 accounts idempotently.
  - Updated `specs/deployment.md` and `specs/kiosk-setup.md` reflecting the 4 core accounts and roles.
- Implemented RFID Card Allowlist (Whitelist) Backend Flows & Specs:
  - Created `allowed-rfid` content type (`schema.json`, controller, service, routes).
  - Implemented `POST /api/rfid-allowlist/bulk-upload` for batch inventory uploads.
  - Added strict validation to `employee-card.issueCard` service to reject unlisted (`UNAUTHORIZED_CARD`) or occupied (`CARD_UNAVAILABLE`) cards.
  - Added automatic inventory status synchronization on card issue and disable.
  - Updated testing seeder (`/api/testing/seed`) and teardown (`/api/testing/reset`) to support allowed cards.
  - Updated `specs/test-data-setup.md` documentation with seeded Allowed RFID inventory (including `555555` unassigned card for Tap-to-Assign enrollment testing) and enrollment test scenarios.
  - Registered `allowed-rfid` endpoints in `src/index.ts` bootstrap permissions.
  - Authored comprehensive Frontend Implementation Specification in `specs/frontend-rfid-allowlist.md`.
- Authored RFID Card Allowlist (Whitelist) Feature Specification in `specs/feature-rfid-allowlist.md`.
- Created Deployment Seeding API (`/api/setup/seed` & `/api/setup/status`) in `src/api/setup`:
  - Automatically provisions essential operational API users: `admin`, `kiosk`, `guard`, `gate-01`, `gate-02`, `gate-03` (with `gate-1`, `gate-2`, `gate-3` aliases).
  - Uses native Strapi document service to ensure password hashing with bcrypt.
  - Provisions 3 baseline open physical gate sessions for today (`GATE-01` Main Entrance, `GATE-02` Back Entrance, `GATE-03` Warehouse).
  - Designed with strict idempotency (safe to run repeatedly on any machine without duplicates).
- Updated `src/index.ts` bootstrap:
  - Grants full core and custom endpoint permissions to the `Authenticated` role automatically on server start.
  - Added support for `AUTO_SEED=true` environment variable to enable zero-touch automated seeding on first container startup.
- Authored comprehensive deployment specification document in `specs/deployment.md`.
- Authored Kiosk & Frontend Setup Guide in `specs/kiosk-setup.md` detailing operational credentials, environment configuration, and device session mapping.
- Resolved login and session initialization issues in `sc-tapper-hris` and `sc-tapper-hris-web`:
  - Fixed an issue where the Nuxt server-side Strapi helper (`useServerStrapi` in `server/utils/strapi.ts`) automatically attached the client's existing (expired) `auth_token` cookie as an `Authorization` header when forwarding requests to the Strapi authentication endpoint (`/api/auth/local`). This caused Strapi to reject the login attempt with `401 Missing or invalid credentials` before even checking credentials.
  - Added an exclusion rule for auth routes in `useServerStrapi` (`endpoint.startsWith('/api/auth/')`) so client bearer tokens are never forwarded to authentication endpoints.
  - Configured Strapi `users-permissions` with `jwtManagement: 'legacy-support'` and `expiresIn: '30d'` so issued tokens remain valid for 30 days without premature expiration.
  - Verified full login, session check, and session opening workflow end-to-end.
- Created `specs/test-data-setup.md` outlining the test data seeding and resetting workflows.
- Strapi project successfully bootstrapped.
- Memory Bank initialized.

## Next Steps
- Define and implement the initial content-types (e.g., Employee, Department, Role, Leave Request).
- Configure database relationships between content types.
- Set up initial admin users and roles.

## Active Decisions
- Using Strapi v5.57.0 with PostgreSQL as the underlying database.
- TypeScript is used for extensions and configurations.
