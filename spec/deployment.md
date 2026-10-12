# Implementation and Deployment Guide

## Prerequisites

Ensure your system meets the following requirements before proceeding:
- **Node.js**: >= 20.0.0 and <= 26.x.x
- **NPM**: >= 6.0.0
- **Database**: SQLite (default for development), PostgreSQL, or MySQL.

## Local Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd sc-tapper-hris
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory based on `.env.example` (if available), or ensure the following core variables are set:
   ```env
   # Server Details
   HOST=0.0.0.0
   PORT=1337
   
   # Secrets (Generate these using a secure random string generator)
   APP_KEYS=key1,key2,key3,key4
   API_TOKEN_SALT=your-api-token-salt
   ADMIN_JWT_SECRET=your-admin-jwt-secret
   TRANSFER_TOKEN_SALT=your-transfer-token-salt
   JWT_SECRET=your-jwt-secret
   
   # Database (Local Development uses SQLite by default)
   DATABASE_CLIENT=sqlite
   DATABASE_FILENAME=.tmp/data.db
   ```

## Local Development

To start the server in development mode with auto-reloading:

```bash
npm run dev
```

- The Strapi server will be available at: `http://localhost:1337`
- Admin dashboard: `http://localhost:1337/admin`
- The local SQLite database will be created at `.tmp/data.db`.

## Production Build

Before running the application in a production environment, you must build the admin panel UI:

```bash
NODE_ENV=production npm run build
```

*Note: This command transpiles the backend code and builds the React application for the Admin dashboard.*

## Deployment Instructions

Strapi applications require a Node.js hosting environment and a compatible database. Here is the general workflow for deploying to production.

### 1. Production Environment Variables

Ensure your production hosting environment is configured with the following `.env` variables:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
APP_KEYS=your-production-app-keys
API_TOKEN_SALT=your-production-api-token-salt
ADMIN_JWT_SECRET=your-production-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-production-transfer-token-salt
JWT_SECRET=your-production-jwt-secret

# Database variables for PostgreSQL (Example)
DATABASE_CLIENT=postgres
DATABASE_HOST=your-database-host
DATABASE_PORT=5432
DATABASE_NAME=your-database-name
DATABASE_USERNAME=your-database-user
DATABASE_PASSWORD=your-database-password
DATABASE_SSL=true
```

### 2. Deployment to PaaS (Render, Railway, Heroku)

These platforms provide an excellent environment for running Node.js applications with native support for build and start commands.

1. **Connect Repository**: Link your Git repository to the platform.
2. **Build Command**: Set to `npm install && npm run build`
3. **Start Command**: Set to `npm run start`
4. **Environment Variables**: Add your `.env` variables in the platform's settings dashboard.
5. **Database**: Provision a managed PostgreSQL or MySQL database on the platform and add the connection details to your environment variables.

### 3. Deployment on Traditional VPS (Ubuntu / Debian) using PM2

For raw virtual private servers (like AWS EC2, DigitalOcean Droplets, Linode):

1. **Install Node.js & dependencies:** Ensure the correct version of Node.js is installed.
2. **Setup Database:** Install and secure a Postgres or MySQL instance, create a database and user.
3. **Clone and Install:**
   ```bash
   git clone <repo-url>
   cd sc-tapper-hris
   npm install --production
   ```
4. **Configure Environment:** Create your production `.env` file.
5. **Build Application:**
   ```bash
   NODE_ENV=production npm run build
   ```
6. **Start with PM2:**
   Install PM2 globally if you haven't: `npm install -g pm2`
   ```bash
   NODE_ENV=production pm2 start npm --name "strapi-app" -- run start
   pm2 save
   pm2 startup
   ```
7. **Reverse Proxy (Nginx):** Configure Nginx to proxy requests from port 80/443 to `localhost:1337`.

### Starting the Server in Production

If starting the server manually, always use the production start command (never `npm run dev` in production):

```bash
npm run start
```
