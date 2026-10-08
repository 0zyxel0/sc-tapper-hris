# Tech Context

## Technologies Used
- **Framework:** Strapi v5.57.0
- **Runtime:** Node.js (>=20.0.0 <=26.x.x)
- **Database:** PostgreSQL (pg ^8.20.0)
- **Language:** TypeScript (^5), JavaScript
- **Admin Panel UI:** React (^18.0.0), Styled Components

## Development Setup
- `npm run develop`: Starts the Strapi application with autoReload enabled for local development.
- `npm run build`: Builds the admin panel UI.
- `npm run start`: Starts the server without autoReload (production mode).

## Constraints & Dependencies
- Must adhere to Strapi's plugin and extension system conventions.
- Database schema changes should be managed through Strapi's content-type builder or schema files to avoid sync issues.
