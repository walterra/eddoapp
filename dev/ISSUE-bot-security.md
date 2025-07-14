# Telegram Bot Security Issue

## Current Status

The Telegram bot currently has no user authentication or authorization mechanisms. Any Telegram user who knows the bot's username can interact with it and access all features.

## Security Assessment

### What's Missing
- No user authentication/whitelist
- No authorization checks on commands
- No user role differentiation (admin/user)
- No per-user data isolation
- No command-level permissions

### Current Vulnerabilities
- Any Telegram user can create/read/update/delete todos
- Full access to time tracking features
- Access to all contexts (work, personal, etc.)
- No audit trail of who made changes
- Shared database access for all users

### Existing Security Measures
- Rate limiting: 1 message per second per user (`packages/telegram_bot/src/bot/bot.ts:78-96`)
- MCP API key authentication to server (`packages/telegram_bot/src/mcp/connection-manager.ts:121-122`)
- Session tracking with user IDs
- Comprehensive logging of interactions

## Implementation Todos

### Phase 1: Basic User Authentication ✅
- [x] Add `TELEGRAM_ALLOWED_USERS` environment variable to store comma-separated list of allowed user IDs
- [x] Create authentication middleware in `packages/telegram_bot/src/bot/middleware/auth.ts`
- [x] Implement user ID verification before processing any commands
- [x] Add unauthorized user rejection with informative message
- [x] Update `packages/telegram_bot/src/utils/config.ts` to parse allowed users list
- [x] Add authentication check to message handler (`packages/telegram_bot/src/bot/handlers/message.ts`)

### Phase 2: Per-User Data Isolation
- [ ] Implement user registry system with database-per-user pattern
- [ ] Create user mapping from Telegram IDs to eddo usernames (e.g., 12345 → walterra)
- [ ] Generate per-user API keys for MCP client access
- [ ] Ensure complete data isolation between users
- [ ] **See detailed implementation plan**: [ISSUE-user-registry.md](./ISSUE-user-registry.md)

### Phase 3: Role-Based Access Control
- [ ] Define user roles (admin, user, readonly)
- [ ] Create role configuration in environment variables
- [ ] Implement command-level permission checks
- [ ] Add admin-only commands (user management, stats)
- [ ] Create permission matrix documentation

### Phase 4: Security Enhancements
- [ ] Add audit logging for all user actions
- [ ] Implement session timeouts
- [ ] Add command usage analytics per user
- [ ] Create security documentation for deployment
- [ ] Add user onboarding flow for new authorized users

## Example Implementation

### Environment Configuration
```bash
# .env
TELEGRAM_ALLOWED_USERS=123456789,987654321,555555555
TELEGRAM_ADMIN_USERS=123456789
```

### Authentication Middleware
```typescript
// packages/telegram_bot/src/bot/middleware/auth.ts
export function authenticateUser(userId: number): boolean {
  const allowedUsers = config.TELEGRAM_ALLOWED_USERS;
  return allowedUsers.includes(userId.toString());
}
```

### Message Handler Update
```typescript
// packages/telegram_bot/src/bot/handlers/message.ts
if (!authenticateUser(ctx.from.id)) {
  await ctx.reply('Unauthorized. This bot is private.');
  return;
}
```

## Testing Plan
- [ ] Test with unauthorized user IDs
- [ ] Verify authorized users have full access
- [ ] Test data isolation between users
- [ ] Verify rate limiting still works
- [ ] Test admin-only commands (Phase 3)

## Deployment Considerations
- Document how to configure allowed users
- Create migration guide for existing data
- Plan rollback strategy
- Monitor unauthorized access attempts
- Set up alerts for security events