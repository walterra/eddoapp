# ISSUE-005: Configure Content Security Policy Headers

**Priority:** Critical  
**Category:** Security  
**Estimated Effort:** 1-2 days  
**Impact:** High - Prevents XSS and other injection attacks  

## Description

The application currently has no Content Security Policy (CSP) headers configured, leaving it vulnerable to XSS attacks, injection attacks, and other security threats. CSP headers are a critical security measure for modern web applications.

## Current Security Gap

### Missing Security Headers
- No Content Security Policy configured
- No X-Frame-Options protection
- No X-Content-Type-Options header
- No Referrer-Policy configured
- No Permissions-Policy set

### Attack Vectors
- **XSS Attacks:** Malicious scripts can be injected and executed
- **Data Injection:** Untrusted content can be loaded from any source
- **Clickjacking:** Application can be embedded in malicious frames
- **MIME Sniffing:** Browsers may misinterpret content types

## Implementation Strategy

### CSP Policy Design

Based on the application's requirements:
- **React SPA:** Needs inline styles and scripts for development
- **PouchDB:** Local storage, no external API calls currently
- **TailwindCSS:** May generate inline styles
- **Vite:** Development server needs WebSocket for HMR

### Development vs Production Policies

**Development Policy (Permissive):**
```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' ws://localhost:*;
  img-src 'self' data: blob:;
```

**Production Policy (Strict):**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
```

## Acceptance Criteria

- [ ] CSP headers configured for development and production
- [ ] Application functions correctly with CSP enabled
- [ ] No CSP violations in browser console
- [ ] Additional security headers implemented
- [ ] CSP policy tested with different scenarios
- [ ] CSP monitoring/reporting configured for production

## Implementation Plan

### Phase 1: Basic CSP Implementation (Day 1)

1. **Configure CSP in Vite development server**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     plugins: [react()],
     server: {
       headers: {
         'Content-Security-Policy': 
           "default-src 'self'; " +
           "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
           "style-src 'self' 'unsafe-inline'; " +
           "connect-src 'self' ws://localhost:*; " +
           "img-src 'self' data: blob:;"
       }
     }
   });
   ```

2. **Add production CSP configuration**
   ```typescript
   // For production builds, configure via build process or server
   const productionCSP = 
     "default-src 'self'; " +
     "script-src 'self'; " +
     "style-src 'self' 'unsafe-inline'; " +
     "connect-src 'self'; " +
     "img-src 'self' data:; " +
     "font-src 'self'; " +
     "object-src 'none'; " +
     "base-uri 'self'; " +
     "form-action 'self'; " +
     "frame-ancestors 'none'; " +
     "upgrade-insecure-requests";
   ```

3. **Test application functionality**
   - Verify all features work with CSP enabled
   - Check browser console for violations
   - Test both development and production builds

### Phase 2: Additional Security Headers (Day 1-2)

4. **Add comprehensive security headers**
   ```typescript
   // Complete security headers configuration
   const securityHeaders = {
     'Content-Security-Policy': cspPolicy,
     'X-Frame-Options': 'DENY',
     'X-Content-Type-Options': 'nosniff',
     'Referrer-Policy': 'strict-origin-when-cross-origin',
     'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
     'X-XSS-Protection': '1; mode=block'
   };
   ```

5. **Configure for different environments**
   ```typescript
   // Environment-specific configuration
   const getSecurityHeaders = (env: 'development' | 'production') => {
     const baseHeaders = {
       'X-Frame-Options': 'DENY',
       'X-Content-Type-Options': 'nosniff',
       'Referrer-Policy': 'strict-origin-when-cross-origin'
     };

     if (env === 'production') {
       return {
         ...baseHeaders,
         'Content-Security-Policy': productionCSP,
         'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
       };
     }

     return {
       ...baseHeaders,
       'Content-Security-Policy': developmentCSP
     };
   };
   ```

### Phase 3: Testing and Monitoring (Day 2)

6. **Implement CSP violation reporting**
   ```typescript
   // Add report-uri for production monitoring
   const cspWithReporting = productionCSP + 
     "; report-uri /api/csp-violation-report";
   ```

7. **Add CSP testing utilities**
   ```typescript
   // Test helper to verify CSP compliance
   export function testCSPCompliance() {
     // Check for inline scripts/styles
     // Verify external resource loading
     // Test violation reporting
   }
   ```

8. **Create CSP validation tests**
   - Unit tests for CSP configuration
   - Integration tests with real browser
   - Automated CSP compliance checking

## CSP Directives Explanation

### Core Directives
- **default-src 'self':** Default policy - only load from same origin
- **script-src 'self':** Only execute scripts from same origin
- **style-src 'self' 'unsafe-inline':** Styles from same origin + inline (needed for Tailwind)
- **connect-src 'self':** AJAX/WebSocket only to same origin
- **img-src 'self' data::** Images from same origin + data URLs

### Security Directives
- **object-src 'none':** Block plugins (Flash, Java applets)
- **base-uri 'self':** Prevent base tag injection
- **form-action 'self':** Forms can only submit to same origin
- **frame-ancestors 'none':** Prevent clickjacking
- **upgrade-insecure-requests:** Force HTTPS in production

## Testing Strategy

### Manual Testing
- [ ] Application loads and functions correctly
- [ ] No CSP violations in console
- [ ] All user interactions work (forms, buttons, etc.)
- [ ] Time tracking functionality unaffected
- [ ] Modal dialogs function properly

### Automated Testing
- [ ] CSP compliance tests
- [ ] Security header verification
- [ ] Cross-browser compatibility
- [ ] Performance impact assessment

### Production Validation
- [ ] CSP headers present in production
- [ ] Violation reporting functional
- [ ] No legitimate functionality blocked

## Browser Compatibility

CSP Level 2 support:
- ✅ Chrome 25+
- ✅ Firefox 23+
- ✅ Safari 7+
- ✅ Edge 12+

All modern browsers support the proposed CSP configuration.

## Dependencies

None - this can be implemented independently of other issues.

## Rollback Plan

If CSP causes functionality issues:
1. Switch to report-only mode: `Content-Security-Policy-Report-Only`
2. Identify and fix violations
3. Re-enable enforcement mode
4. Keep backup configuration without CSP

## Definition of Done

- CSP headers configured for development and production
- All application functionality works with CSP enabled
- Additional security headers implemented
- No CSP violations in browser console
- CSP compliance tests pass
- Documentation updated with security configuration
- Production deployment includes security headers