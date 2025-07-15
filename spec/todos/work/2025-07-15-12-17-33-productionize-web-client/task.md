# at the moment packages/web_client is just run via vite. it doesn't have a web server of its own. the couchdb sync credentials are exposed. we need to productionize this. we need to run a nodejs web server that serves the app. we need to research the best option for 2025 based on the existing setup.

**Status:** Refining
**Created:** 2025-07-15T12:17:33
**Agent PID:** 1664

## Original Todo

at the moment packages/web_client is just run via vite. it doesn't have a web server of its own. the couchdb sync credentials are exposed. we need to productionize this. we need to run a nodejs web server that serves the app. we need to research the best option for 2025 based on the existing setup.

## Description

The web client currently runs only in development mode using Vite with a **critical security vulnerability**: CouchDB credentials are hardcoded into the client bundle, making them publicly accessible. To productionize this application, we need to:

1. **Remove credential exposure** by implementing a secure authentication proxy
2. **Add a production web server** using Hono framework (chosen for 2025)
3. **Implement proper authentication** with token-based security  
4. **Create production build pipeline** with environment-specific configurations
5. **Add deployment configuration** for various hosting platforms

The current PouchDB/CouchDB architecture can be maintained while adding a secure server layer that proxies database requests and handles authentication.

## Implementation Plan

- [ ] Create production web server using Hono framework (packages/web_server/)
- [ ] Remove CouchDB credentials from Vite config (packages/web_client/vite.config.ts)
- [ ] Implement CouchDB authentication proxy API endpoints (/api/db/*)
- [ ] Add JWT-based authentication system for client-server communication
- [ ] Create production environment configuration (.env.production)
- [ ] Update client code to use API endpoints instead of direct CouchDB connection
- [ ] Add production build scripts and Docker configuration
- [ ] Automated test: Test authentication flow and API proxy functionality
- [ ] Automated test: Verify credentials are not exposed in production build
- [ ] User test: Deploy to staging environment and verify full functionality
- [ ] User test: Confirm offline-first PouchDB sync works through proxy
- [ ] User test: Test authentication flow and session management