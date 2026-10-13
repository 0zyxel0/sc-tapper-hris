# Active Context

## Current Work Focus
- Nuxt Guardhouse UI specification structured into 4 execution phases:
  - Phase 1: Foundation & Core Kiosk Loop (The MVP - `/login`, `/kiosk`, RFID hardware keystroke capture, session management).
  - Phase 2: Gate Administration & Identity Management (`/admin/history`, `/admin/profiles`, Tap-to-Assign card enrollment).
  - Phase 3: Insights, Reporting, and Exports (`/admin/reports`, roll-call headcount, daily attendance metrics, CSV/print manifests).
  - Phase 4: Offline Resilience & Cloud Synchronization (`/admin/sync`, network status badges, auto push/pull sync coordinator).
- Ready to proceed with frontend implementation.

## Recent Changes
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
