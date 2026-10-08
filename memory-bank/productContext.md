# Product Context

## Purpose
The purpose of `sc-trapper-hris` is to provide a centralized, secure, and manageable system for human resources operations. 

## Problems Solved
- Centralizes scattered employee records and organizational data.
- Simplifies access control and administrative duties related to HR.
- Provides a headless architecture allowing flexibility to build custom frontends or integrations for employee portals.

## How It Works
The application leverages Strapi v5 to expose REST (or GraphQL) APIs. Data is stored in a PostgreSQL database. HR administrators use the Strapi Admin Panel to manage content types (e.g., Employees, Departments, Leave Requests), while frontend applications consume the API for employee self-service features.

## User Experience Goals
- For HR Admins: A clean, intuitive interface via the Strapi Admin Panel for managing complex organizational data.
- For Developers: Well-documented, consistent APIs to build out internal company tools.
