# Tech Context

## Technologies Used
- **Framework:** Strapi v5.57.0
- **Runtime:** Node.js (>=20.0.0 <=26.x.x)
- **Database:** PostgreSQL (pg ^8.20.0, containerized with `postgres:16-alpine`)
- **Containerization:** Docker & Docker Compose (multi-stage build supporting development and production targets)
- **Language:** TypeScript (^5), JavaScript
- **Admin Panel UI:** React (^18.0.0), Styled Components

## Development Setup
- `docker compose up --build`: Runs both PostgreSQL and Strapi in containers with live-reload volume mounts.
- `npm run develop`: Starts the Strapi application locally with autoReload enabled.
- `npm run build`: Builds the admin panel UI and compiles TypeScript.
- `npm run start`: Starts the server without autoReload (production mode).

## Constraints & Dependencies
- Must adhere to Strapi's plugin and extension system conventions.
- Database schema changes should be managed through Strapi's content-type builder or schema files to avoid sync issues.
- PostgreSQL host port default in Docker Compose is set to 5433 (`${DATABASE_HOST_PORT:-5433}`) to prevent port collisions if another PostgreSQL instance is running on host port 5432.
