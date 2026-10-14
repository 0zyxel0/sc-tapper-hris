# Active Context

## Current Work Focus
- Nuxt Guardhouse UI specification structured into 4 execution phases:
  - Phase 1: Foundation & Core Kiosk Loop (The MVP - `/login`, `/kiosk`, RFID hardware keystroke capture, session management).
  - Phase 2: Gate Administration & Identity Management (`/admin/history`, `/admin/profiles`, Tap-to-Assign card enrollment).
  - Phase 3: Insights, Reporting, and Exports (`/admin/reports`, roll-call headcount, daily attendance metrics, CSV/print manifests).
  - Phase 4: Offline Resilience & Cloud Synchronization (`/admin/sync`, network status badges, auto push/pull sync coordinator).
- Ready to proceed with frontend implementation.

## Recent Changes
- Programmatic `Super Admin` API Role & Permission Implementation:
  - Added programmatic creation of `Super Admin` role (`type: 'super_admin'`) during `bootstrap` lifecycle in `src/index.ts`.
  - Configured `src/index.ts` to grant full API permissions to both `Authenticated` and `Super Admin` roles automatically on server start.
  - Updated `src/api/setup/services/setup.ts` to provision the `admin` API account under the `Super Admin` role (with automatic role upgrade support if already present under another role).
  - Updated `specs/deployment.md` documentation reflecting the `Super Admin` role and permissions.
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
