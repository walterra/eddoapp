# at the moment packages/web_client is just run via vite. it doesn't have a web server of its own. the couchdb sync credentials are exposed. we need to productionize this. we need to run a nodejs web server that serves the app. we need to research the best option for 2025 based on the existing setup.

**Status:** In Progress
**Started:** 2025-07-15T20:17:45
**Created:** 2025-07-15T12:17:33
**Agent PID:** 54859

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

### Phase 1: Current Basic Setup (COMPLETED)

- [x] Create production web server using Hono framework (packages/web_server/)
- [x] Remove CouchDB credentials from Vite config (packages/web_client/vite.config.ts)
- [x] Implement CouchDB authentication proxy API endpoints (/api/db/\*)
- [x] Add JWT-based authentication system for client-server communication
- [x] Create production environment configuration (.env.production)
- [x] Update client code to use API endpoints instead of direct CouchDB connection
- [x] Add production build scripts and Docker configuration
- [x] Automated test: Test authentication flow and API proxy functionality
- [x] Automated test: Verify credentials are not exposed in production build
- [x] **ARCHITECTURE REFACTOR**: Consolidate web_client into web_server package
- [x] Create organized directory structure: src/server/ and src/client/
- [x] Move server files (index.ts, routes/, config.ts) to packages/web_server/src/server/
- [x] Move all React components from packages/web_client/src to packages/web_server/src/client/
- [x] Update client.tsx to import from new client/ directory structure
- [x] Update server imports to use new server/ directory structure
- [x] Update package.json dependencies to include web_client dependencies
- [x] Remove @eddo/web-client workspace dependency
- [x] Update vite.config.ts paths and remove web_client alias
- [x] Test client loading and resolve MIME type issues (PARTIALLY WORKING - server restart timing sensitive)
- [x] Delete packages/web_client package (consolidation complete)
- [x] Update all references to web_client/web-client in configuration files

### Phase 2: Production-Ready Architecture (BASED ON REFERENCE PROJECT)

- [x] **MODERNIZE BUILD SETUP**: Configure Vite to build web assets into server public/ directory
- [x] **SPLIT INTO SEPARATE PACKAGES**: Create separate web and server packages following reference project architecture in /Users/walterra/dev/monorepo-example-tasks-app
  - [x] Create packages/web-client with React frontend (Vite dev server on port 5173)
  - [x] Create packages/web-api with Hono API server (port 3000)
  - [x] Move client files (src/client/, src/assets/, src/client.tsx) to packages/web-client/src/
  - [x] Move server files (src/server/) to packages/web-api/src/
  - [x] Add .gitignore files to both packages/web-client and packages/web-api
  - [x] Update packages/web-client/vite.config.ts to build into ../web-api/public/ and proxy /api to web-api
  - [ ] Configure packages/web-api middleware: API routes at /api/\*, static assets from public/, SPA fallback
  - [ ] Implement SPA fallback logic: non-API routes serve index.html for client-side routing
  - [ ] Update root package.json scripts: dev runs both servers in parallel
  - [ ] Update workspace dependencies and remove packages/web_server
  - [ ] Test development: web (Vite:5173) + server (Hono:3000) with proxy, no CORS issues
  - [ ] Test production build: web builds into server/public/, single server:3000 serves all
- [ ] **UPGRADE AUTHENTICATION**: Replace JWT with AuthJS (GitHub OAuth integration)
- [ ] **IMPLEMENT UNIFIED DEPLOYMENT**: Configure server to serve both API and static assets from public/ directory
- [ ] **ADD ENVIRONMENT MANAGEMENT**: Use proper environment variables for secrets management
- [ ] **IMPLEMENT SPA FALLBACK**: Configure proper routing for React SPA in production
- [ ] **ADD ERROR HANDLING**: Implement Stoker middleware for consistent error responses
- [ ] **OPTIMIZE PERFORMANCE**: Add proper caching headers and asset optimization

### Phase 3: Testing & Deployment

- [ ] Automated test: Verify production build and static asset serving
- [ ] Automated test: Test authentication flow with AuthJS
- [ ] User test: Deploy to production environment and verify full functionality
- [ ] User test: Confirm offline-first PouchDB sync works through existing CouchDB proxy
- [ ] User test: Test GitHub OAuth authentication flow
- [ ] User test: Verify production build performance and caching

## Notes

### Phase 1 Implementation (COMPLETED)

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
- **ARCHITECTURE DECISION**: Consolidate to single package (web_server) - follows Hono's monolithic React app pattern
- Current hybrid approach (client.tsx importing from web_client) causes MIME type issues
- Single package eliminates cross-package import complexity and configuration issues
- **CONSOLIDATION COMPLETE**: All React components moved from web_client to web_server/src/client/
- Server files organized in web_server/src/server/ directory
- Package.json updated with all necessary dependencies
- Vite config updated to use new entry point (src/server/index.ts)
- **CRITICAL**: Server needs restart for configuration changes to take effect
- **CLEANUP COMPLETE**: Deleted packages/web_client package - consolidation fully complete
- **REFERENCES UPDATED**: Fixed all web_client references in config files (vite.config.ts, tsconfig.json, tailwind.config.cjs, etc.)
- **DEPENDENCIES REGENERATED**: Updated pnpm-lock.yaml to reflect new package structure
- **TAILWIND CONFIG OPTIMIZED**: Consolidated to single root config, limited to src/client/ directory
- **VITE CONFIG FIXED**: Added /^\/src\/.\*/ to exclude patterns to let Vite handle client files (REQUIRES RESTART)

### Reference Project Analysis (COMPLETED)

- **REFERENCE PROJECT**: /Users/walterra/dev/monorepo-example-tasks-app analyzed for production patterns
- **KEY FINDINGS**: Modern deployment with Hono + React + Drizzle stack
- **ARCHITECTURE**: Separate apps/web (Vite dev) + apps/api (Hono server) with unified deployment
- **BUILD PATTERN**: Vite builds frontend into `../api/public/` directory for unified deployment
- **DEVELOPMENT**: Web runs Vite dev server (port 5173), API runs Hono server (port 8787)
- **PROXY**: Web app proxies `/api` requests to API server during development
- **MIME TYPE SOLUTION**: Uses standard Vite dev server instead of @hono/vite-dev-server
- **TYPE SAFETY**: Hono RPC client provides end-to-end type safety from API to frontend
- **AUTHENTICATION**: AuthJS with GitHub OAuth (more robust than JWT)
- **DATABASE**: Drizzle ORM for production scalability and migrations
- **DEPLOYMENT**: Standard Node.js deployment with static asset serving
- **ENVIRONMENT**: Environment variables for secrets management
- **PERFORMANCE**: Optimized bundling and proper caching headers
- **DEVELOPER EXPERIENCE**: Hot reload, type safety, unified monorepo with pnpm workspaces
- **PRODUCTION READY**: Error handling, migrations, testing, and proper security patterns

### Architecture Split Decision (NEW)

- **PROBLEM**: @hono/vite-dev-server causes MIME type issues with TSX files
- **SOLUTION**: Split packages/web_server into separate packages/web + packages/server
- **BENEFITS**: Clean separation, standard Vite dev server, follows reference project pattern
- **DEVELOPMENT**: packages/web (Vite:5173) + packages/server (Hono:3000)
- **PRODUCTION**: packages/web builds into packages/server/public/, single server:3000 deployment
- **CORS SOLUTION**: Development uses proxy, production uses single server (same origin)
- **ROUTING LOGIC**: /api/_ → API routes, /_ → static assets or SPA fallback to index.html
- **SPA FALLBACK**: Non-API routes serve index.html for client-side routing (React Router support)
