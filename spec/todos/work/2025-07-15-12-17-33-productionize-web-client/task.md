# at the moment packages/web_client is just run via vite. it doesn't have a web server of its own. the couchdb sync credentials are exposed. we need to productionize this. we need to run a nodejs web server that serves the app. we need to research the best option for 2025 based on the existing setup.

**Status:** In Progress
**Started:** 2025-07-15T20:17:45
**Created:** 2025-07-15T12:17:33
**Agent PID:** 32139

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
  - [x] Configure packages/web-api middleware: API routes at /api/\*, static assets from public/, SPA fallback
  - [x] Implement SPA fallback logic: non-API routes serve index.html for client-side routing
  - [x] Update root package.json scripts: dev runs both servers in parallel
  - [x] Cleanup: Remove packages/web_server directory and update workspace dependencies
  - [x] Update all remaining references to web_server/web-server in config files
  - [x] Fix serveStatic import path in web-api (from 'hono/node-server' to '@hono/node-server/serve-static')
  - [x] Add tsconfig.json and tsconfig.node.json to web-client package
  - [x] Test development: web (Vite:5173) + server (Hono:3000) with proxy, no CORS issues
  - [x] Clean up dev mode: Remove faux "use Vite dev server" message handler from web-api
  - [x] **CRITICAL ARCHITECTURE FIX**: Reverse proxy direction - web-api should proxy to web-client (not vice versa)
    - [x] Remove proxy config from packages/web-client/vite.config.ts
    - [x] Add proxy logic to packages/web-api/src/index.ts for non-API routes in development
    - [x] Update development flow: users access localhost:3000, API handles directly, non-API proxied to Vite:5173
  - [x] Fix environment variables: Add VITE_ prefix for client-side env vars
  - [x] **STANDARDIZE ENV UTILITIES**: Consistent use of @eddo/core env utilities across packages
    - [x] Add VITE_API_URL to @eddo/core envSchema for client-side validation
    - [x] Fix web-client inconsistencies: use import.meta.env consistently with validateEnv
    - [x] Simplify web-api config: reduce duplication with core schema
    - [x] Update all packages to use consistent env handling pattern
  - [x] **CRITICAL ARCHITECTURE FIX VERIFIED**: Proxy architecture working correctly via Playwright testing
    - [x] Confirmed localhost:3000 serves app correctly (web-api → vite proxy)
    - [x] Verified all static assets load from web-api server (86+ successful requests)
    - [x] Confirmed Vite dev server integration and HMR working
    - [x] Verified monorepo @eddo/core imports work through proxy
  - [x] **FIX APPLICATION ERROR**: Resolve React error in <Eddo> component before proceeding
    - [x] Debug and fix the React component error preventing app from rendering
    - [x] Merge useSyncDev and useSyncProduction into unified sync hook (always uses /api endpoint)
    - [x] Fix context provider issue by moving sync call inside PouchDbContext.Provider
    - [x] Eliminate unnecessary 401 errors by only syncing when authenticated
    - [x] Ensure development environment is fully functional
    - [x] Verify app loads and renders correctly in browser
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

### Development vs Production Architecture

**Reference Implementation Analysis (Cloudflare Workers):**
- Uses `c.env.ASSETS` for static file serving (Cloudflare-specific feature)
- Single middleware handles both dev and prod because Cloudflare's wrangler manages assets
- No need for conditional dev/prod logic

**Our Implementation (Node.js/Hono):**
- Must handle static files differently in dev vs prod
- **Development**: Vite dev server (5173) serves client with HMR, API server (3000) only handles API routes
- **Production**: API server (3000) serves both API routes and static files from public/
- This split is necessary because Node.js doesn't have Cloudflare's built-in asset handling

**Current Dev Mode Issue:**
- API server returns "Development mode - use Vite dev server on port 5173" for non-API routes
- This is unnecessary and confusing - should just let routes 404 naturally
- Need to remove the explicit dev mode handler that returns faux messages

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

### Architecture Discovery: Proxy Direction Issue

- **PROBLEM IDENTIFIED**: Current proxy setup is backwards from reference implementation
- **CURRENT (WRONG)**: Web-client (Vite:5173) proxies `/api` to web-api (Hono:3000)
- **CORRECT**: Web-api (Hono:3000) should proxy non-API routes to web-client (Vite:5173)
- **WHY**: Single entry point at localhost:3000, matches production architecture
- **BENEFIT**: Production and development have same entry point, cleaner architecture

### Environment Variables Analysis & Recommendation

**@eddo/core env utility provides:**
- ✅ **Zod validation** with defaults and type safety
- ✅ **Centralized schema** for all env vars  
- ✅ **Helper functions** like `getEffectiveDbName()`, `getCouchDbConfig()`
- ✅ **Consistent** environment handling across packages

**Current inconsistencies identified:**
1. **Web-client mixed usage**: 
   - `pouch_db.ts` uses `validateEnv(import.meta.env)` ✅ correct
   - `page_wrapper.tsx` uses `validateEnv(process.env)` ❌ wrong for client-side
   - `use_sync_production.ts` uses `import.meta.env.VITE_API_URL` ✅ correct but bypasses validation
2. **Web-api redundancy**: Uses both `validateEnv(process.env)` and custom schema (duplicates core logic)

**MCP server approach (good example):**
- Uses `validateEnv(process.env)` consistently ✅
- Leverages all helper functions from @eddo/core ✅
- Clean, type-safe configuration ✅

**RECOMMENDATION**: Standardize on @eddo/core env utilities across all packages:
1. **Fix web-client inconsistencies** - use `import.meta.env` consistently with validateEnv
2. **Simplify web-api config** - reduce duplication with core schema
3. **Add missing env vars** to core schema (like `VITE_API_URL`)
4. **Consistent type safety** across all packages

**BENEFITS**: Better maintainability, consistency, fewer environment-related bugs

### Proxy Architecture Testing Results (Playwright MCP)

**🎯 CRITICAL ARCHITECTURE FIX - VERIFIED SUCCESSFUL!**

**✅ Architecture Working Correctly:**
- **Single entry point**: Users access `localhost:3000` (web-api server) ✅
- **API routes**: Handled directly by Hono server ✅  
- **Static routes**: Proxied to Vite dev server on `localhost:5173` ✅
- **Production alignment**: Same entry point for dev and prod ✅

**✅ Comprehensive Testing Results:**
- **86+ successful HTTP requests**: All resources loading from web-api server ✅
- **HTML structure**: Complete and proper with correct title ✅
- **Vite integration**: HMR connection working, React refresh active ✅
- **Monorepo imports**: @eddo/core packages loading through proxy ✅
- **Environment variables**: All VITE_ prefixed vars accessible ✅

**⚠️ Current Blocker:**
- **React error in `<Eddo>` component**: Application not rendering due to component error
- **Console error**: "The above error occurred in the <Eddo> component"
- **Impact**: Prevents testing of application functionality (proxy architecture confirmed working)

**🚫 BLOCKING ISSUE**: Before proceeding with production build testing or further productionization, the React application error must be resolved to ensure a working development environment.
