# Remember me for login

**Status:** Done
**Started:** 2026-01-01T22:25:09
**Created:** 2026-01-01-22-49-34
**Agent PID:** 7069
**GitHub Issue:** [#327](https://github.com/walterra/eddoapp/issues/327)

## Description

Add a "Remember me" checkbox to the login page. When checked, authentication persists across browser sessions using longer-lived JWT tokens.

**Current behavior:**

- JWT tokens expire after 24 hours (hardcoded in `packages/web-api/src/routes/auth.ts`)
- Tokens stored in localStorage persist until expiration
- No user choice for session duration

**Target behavior:**

- Default (unchecked): Short session (e.g., 1 hour or session-only)
- Remember me (checked): Long session (e.g., 30 days)
- Backend accepts `rememberMe` flag and adjusts token expiration accordingly

**Success criteria:**

- Login form shows "Remember me" checkbox
- Unchecked: Token expires in 1 hour (or cleared on browser close)
- Checked: Token expires in 30 days
- Existing tests pass, new tests cover the feature

## Implementation Plan

- [x] Backend: Update `/auth/login` to accept `rememberMe` boolean and adjust token expiration (packages/web-api/src/routes/auth.ts:109-141)
- [x] Backend: Update `/auth/register` to accept `rememberMe` boolean (packages/web-api/src/routes/auth.ts:43-100)
- [x] Backend: Add tests for rememberMe parameter (packages/web-api/src/routes/auth.test.ts)
- [x] Frontend: Add `rememberMe` checkbox to Login component (packages/web-client/src/components/login.tsx)
- [x] Frontend: Update `useAuth` hook to pass `rememberMe` to authenticate call (packages/web-client/src/hooks/use_auth.tsx)
- [x] Frontend: Add test for Login component checkbox (packages/web-client/src/components/login.test.tsx - new file created)
- [x] Automated test: Verify short vs long token expiration (5 backend tests + 2 hook tests + 9 component tests)
- [x] User test: Login with/without "Remember me" and verify behavior (verified 30d in localStorage)

## Review

- [x] No bugs found - all tests pass
- [x] Code follows project patterns (functional style, Zod validation, Flowbite components)
- [x] Lint passes with 0 errors

## Notes

- Token expiration is set via `exp` claim in JWT: `Math.floor(Date.now() / 1000) + 24 * 60 * 60`
- Both `/auth/login` and `/auth/register` endpoints generate tokens with same 24h expiration
- Frontend stores token in localStorage regardless of remember me - for short sessions, could use sessionStorage instead
