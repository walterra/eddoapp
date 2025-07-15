# at the moment packages/web_client is just run via vite. it doesn't have a web server of its own. the couchdb sync credentials are exposed. we need to productionize this. we need to run a nodejs web server that serves the app. we need to research the best option for 2025 based on the existing setup.

**Status:** In Progress
**Started:** 2025-07-15T20:17:45
**Created:** 2025-07-15T12:17:33
**Agent PID:** 26868

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

- [x] Create production web server using Hono framework (packages/web_server/)
- [x] Remove CouchDB credentials from Vite config (packages/web_client/vite.config.ts)
- [x] Implement CouchDB authentication proxy API endpoints (/api/db/*)
- [x] Add JWT-based authentication system for client-server communication
- [x] Create production environment configuration (.env.production)
- [x] Update client code to use API endpoints instead of direct CouchDB connection
- [x] Add production build scripts and Docker configuration
- [x] Automated test: Test authentication flow and API proxy functionality
- [x] Automated test: Verify credentials are not exposed in production build
- [ ] User test: Deploy to staging environment and verify full functionality (FAILED - MIME type issue)
- [ ] User test: Confirm offline-first PouchDB sync works through proxy (BLOCKED - can't test due to MIME type issue)
- [ ] User test: Test authentication flow and session management (BLOCKED - can't test due to MIME type issue)

## Notes

- Web server implemented using Hono framework with TypeScript
- CouchDB credentials successfully removed from client bundle
- JWT authentication system working with demo credentials (demo/password)
- Environment configuration created for production deployment
- Docker configuration and build scripts added
- Authentication flow tests passing
- Credentials exposure tests confirm no sensitive data in production build
- **CRITICAL ISSUE IDENTIFIED**: @hono/vite-dev-server default exclude patterns exclude TypeScript/TSX files
- Error: "Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of 'text/html'"
- Root cause: Default exclude patterns include `/.*\.tsx$/` which prevents Vite from handling TypeScript files
- **FIX IMPLEMENTED**: Updated vite.config.ts to remove TypeScript/TSX exclusion and added manual Vite client script injection
- Server needs restart for changes to take effect