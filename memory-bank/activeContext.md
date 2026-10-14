# Active Context

## Current Work Focus
- Nuxt Guardhouse UI specification structured into 4 execution phases:
  - Phase 1: Foundation & Core Kiosk Loop (The MVP - `/login`, `/kiosk`, RFID hardware keystroke capture, session management).
  - Phase 2: Gate Administration & Identity Management (`/admin/history`, `/admin/profiles`, Tap-to-Assign card enrollment).
  - Phase 3: Insights, Reporting, and Exports (`/admin/reports`, roll-call headcount, daily attendance metrics, CSV/print manifests).
  - Phase 4: Offline Resilience & Cloud Synchronization (`/admin/sync`, network status badges, auto push/pull sync coordinator).
- Ready to proceed with frontend implementation.

## Recent Changes
- Created Deployment Seeding API (`/api/setup/seed` & `/api/setup/status`) in `src/api/setup`:
  - Automatically provisions essential operational API users: `admin`, `kiosk`, `guard`, `gate-01`, `gate-02`, `gate-03` (with `gate-1`, `gate-2`, `gate-3` aliases).
  - Uses native Strapi document service to ensure password hashing with bcrypt.
  - Provisions 3 baseline open physical gate sessions for today (`GATE-01` Main Entrance, `GATE-02` Back Entrance, `GATE-03` Warehouse).
  - Designed with strict idempotency (safe to run repeatedly on any machine without duplicates).
- Updated `src/index.ts` bootstrap:
  - Grants full core and custom endpoint permissions to the `Authenticated` role automatically on server start.
  - Added support for `AUTO_SEED=true` environment variable to enable zero-touch automated seeding on first container startup.
- Authored comprehensive deployment specification document in `specs/deployment.md`.
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
