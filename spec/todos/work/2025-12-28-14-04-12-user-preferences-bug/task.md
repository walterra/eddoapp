# User preferences bug: filters reset after login

**Status:** In Progress
**GitHub Issue:** #307
**Started:** 2025-12-28-14-15
**Created:** 2025-12-28-14-04-12
**Agent PID:** 75447

## Description

After login, user ends up with default filters. Only after a full page refresh do the stored user preferences get restored.

**Root Cause:** The `useAuth` hook uses local `useState` instead of shared React Context. When user logs in:

1. Only the `Eddo` component's `useAuth` instance gets the token via `setAuthToken()`
2. Child components (via `useProfile` → `useAuth()`) have their own instances that start with `authToken = null`
3. These child instances only get the token after their `useEffect` reads from localStorage
4. By then, the initial render has already happened with default filter values
5. Even though the profile eventually loads, the timing causes a flash of defaults

**Why refresh works:** On page refresh, all `useAuth` instances read from localStorage in their first `useEffect`, so all components get the token at roughly the same time before the first meaningful render.

**Fix:** Convert `useAuth` to use React Context so all components share the same auth state. This ensures that when login sets the token, all consumers immediately see the updated value.

## Implementation Plan

- [x] Create AuthContext with AuthProvider wrapper (packages/web-client/src/hooks/use_auth.tsx)
  - Created `AuthContext` using `createContext`
  - Created `AuthProvider` component that manages auth state
  - Kept existing logic but moved state to context provider
  - Exported `useAuth` hook that uses `useContext`
  - Renamed file from .ts to .tsx for JSX support

- [x] Wrap app with AuthProvider (packages/web-client/src/eddo.tsx)
  - Imported `AuthProvider`
  - Created `EddoContent` component that uses `useAuth`
  - Wrapped with `AuthProvider` in main `Eddo` export
- [x] Automated test: Add test that simulates login flow and verifies immediate token availability across components
  - Created packages/web-client/src/hooks/use_auth.test.tsx with 11 tests
  - Tests context sharing, authentication flow, registration, token persistence
- [x] User test:
  1. Log out if logged in
  2. Set some non-default filter preferences (e.g., select specific tags/contexts)
  3. Log out
  4. Log in again
  5. Verify filters are restored immediately (no page refresh needed)
  - ✅ PASSED - logout/login retains custom filters

## Review

- [x] Check for any breaking changes in components using useAuth
  - API unchanged, all existing consumers work without modification
- [x] Verify logout flow still works correctly
  - Tested via user test - logout clears auth state properly
- [x] Ensure token expiration checking still works
  - Token expiration logic preserved in AuthProvider, interval check remains

## Notes

Files changed:

- `packages/web-client/src/hooks/use_auth.tsx` (renamed from .ts) - Converted to context-based implementation with AuthProvider
- `packages/web-client/src/eddo.tsx` - Wrapped with AuthProvider, extracted EddoContent component
- `packages/web-client/src/hooks/use_auth.test.tsx` (new) - 11 tests for auth context

All 480 tests pass. Dev server restart required after file rename.
